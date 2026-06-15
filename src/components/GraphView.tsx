import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '../store';
import { FlintLogo } from './FlintLogo';
import { X, ZoomIn, ZoomOut, RotateCcw, Play, Pause, Search, Palette } from 'lucide-react';

interface GNode { id: string; title: string; x: number; y: number; vx: number; vy: number; conns: number; group: string; }
interface GEdge { from: string; to: string; }

function graphColorKey(vaultId: string | null) {
  return `flint-graph-colors-${vaultId || 'default'}`;
}

export function GraphView() {
  const { state, dispatch } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<GEdge[]>([]);
  const dragRef = useRef<string | null>(null);
  const wasDragRef = useRef(false);
  const panRef = useRef({ x: 0, y: 0, dragging: false, sx: 0, sy: 0 });
  const zoomRef = useRef(1);
  const animRef = useRef(0);
  const physicsRef = useRef(true);
  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const groupTargetRef = useRef<Record<string, { x: number; y: number }>>({});
  const sizeRef = useRef({ w: 0, h: 0 });
  const bloomRef = useRef<Map<string, { start: number; angle: number; magnitude: number; duration: number }>>(new Map());
  const bloomStartRef = useRef(0);
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 });
  const [filterQuery, setFilterQuery] = useState('');
  const [depthFilter, setDepthFilter] = useState(0);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [nodeScale, setNodeScale] = useState(2.5);
  const [linkDistance, setLinkDistance] = useState(320);
  const [centerForce, setCenterForce] = useState(0.0020);
  const [groupPull, setGroupPull] = useState(0.006);
  const [groupSpread, setGroupSpread] = useState(280);
  const [groupColors, setGroupColors] = useState<Record<string, string>>({});
  const [selectedGroup, setSelectedGroup] = useState('root');
  const [showSettings, setShowSettings] = useState(false);
  const [edgeOpacity, setEdgeOpacity] = useState(0.65);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(graphColorKey(state.activeVaultId));
      setGroupColors(raw ? JSON.parse(raw) as Record<string, string> : {});
    } catch {
      setGroupColors({});
    }
  }, [state.activeVaultId]);

  useEffect(() => {
    try {
      localStorage.setItem(graphColorKey(state.activeVaultId), JSON.stringify(groupColors));
    } catch {
      // ignore
    }
  }, [groupColors, state.activeVaultId]);

  const buildGraph = useCallback(() => {
    const links: Record<string, Set<string>> = {};
    const noteTitleIdMap = new Map(state.notes.map(n => [n.title.toLowerCase(), n.id]));

    state.notes.forEach(n => { links[n.id] = new Set(); });
    state.notes.forEach(n => {
      const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const targetId = noteTitleIdMap.get(m[1].toLowerCase());
        if (targetId && targetId !== n.id) {
          links[n.id].add(targetId);
          links[targetId].add(n.id);
        }
      }
    });

    const cx = sizeRef.current.w / 2 || 400;
    const cy = sizeRef.current.h / 2 || 300;

    const deriveGroup = (note: typeof state.notes[number]) => {
      if (note.folderId) {
        const folder = state.folders.find(f => f.id === note.folderId);
        return `folder:${folder?.name || note.folderId}`;
      }
      if (note.filePath && note.filePath.includes('/')) {
        const parts = note.filePath.split('/');
        if (parts.length > 1) return `path:${parts.slice(0, -1).join('/')}`;
      }
      return 'root';
    };

    const groups = Array.from(new Set(state.notes.map(deriveGroup)));
    const targetMap: Record<string, { x: number; y: number }> = {};
    groups.forEach((g, i) => {
      const angle = (i / Math.max(groups.length, 1)) * Math.PI * 2;
      const radius = Math.max(groupSpread, 120);
      targetMap[g] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });
    groupTargetRef.current = targetMap;

    nodesRef.current = state.notes.map((n) => ({
      group: deriveGroup(n),
      id: n.id, title: n.title,
      x: cx, y: cy,
      vx: 0, vy: 0,
      conns: links[n.id]?.size || 0,
    }));

    const edgeSet = new Set<string>();
    edgesRef.current = [];
    state.notes.forEach(n => {
      const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const targetId = noteTitleIdMap.get(m[1].toLowerCase());
        if (targetId && targetId !== n.id) {
          const key = [n.id, targetId].sort().join('-');
          if (!edgeSet.has(key)) { edgeSet.add(key); edgesRef.current.push({ from: n.id, to: targetId }); }
        }
      }
    });

    setGraphStats({ nodes: nodesRef.current.length, edges: edgesRef.current.length });
    setTimeout(() => animate(), 50);
  }, [state.notes, state.folders, groupSpread]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width; canvas.height = rect.height;
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let running = true;

    function getNode(id: string) { return nodesRef.current.find(n => n.id === id); }

    function getVisibleNodeIds(): Set<string> | null {
      if (depthFilter === 0) return null;
      const activeId = state.activeNoteId;
      if (!activeId) return null;
      const visible = new Set<string>();
      const queue: Array<{ id: string; depth: number }> = [{ id: activeId, depth: 0 }];
      const visited = new Set<string>([activeId]);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        visible.add(curr.id);
        if (curr.depth >= depthFilter) continue;
        for (const edge of edgesRef.current) {
          let neighborId: string | null = null;
          if (edge.from === curr.id) neighborId = edge.to;
          else if (edge.to === curr.id) neighborId = edge.from;
          if (neighborId && !visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push({ id: neighborId, depth: curr.depth + 1 });
          }
        }
      }
      return visible;
    }

    function simulate() {
      if (!physicsRef.current) return;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const cx = sizeRef.current.w / 2;
      const cy = sizeRef.current.h / 2;
      const now = performance.now();
      const isBlooming = bloomRef.current.size > 0;
      const bloomElapsed = now - bloomStartRef.current;
      const forceScale = isBlooming ? Math.min(1, bloomElapsed / 3500) : 1;
      const gravScale = isBlooming ? Math.min(1, bloomElapsed / 4500) : 1;

      // Strong Repulsion to prevent overlap
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const sameGroup = nodes[i].group === nodes[j].group;
          const f = ((sameGroup ? 8000 : 14000) / (d * d)) * forceScale;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }

      // Spring forces
      for (const e of edges) {
        const a = getNode(e.from); const b = getNode(e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x; const dy = b.y - a.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = (d - linkDistance) * 0.008 * forceScale;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Center & Group gravity
      for (const n of nodes) {
        n.vx += (cx - n.x) * centerForce * gravScale;
        n.vy += (cy - n.y) * centerForce * gravScale;

        const gt = groupTargetRef.current[n.group];
        if (gt) {
          n.vx += (gt.x - n.x) * groupPull * gravScale;
          n.vy += (gt.y - n.y) * groupPull * gravScale;
        }
      }

      // Bloom forces — gradual outward push with smooth easing
      for (const n of nodes) {
        const bloom = bloomRef.current.get(n.id);
        if (bloom) {
          const elapsed = now - bloom.start;
          if (elapsed > 0 && elapsed < bloom.duration) {
            const t = elapsed / bloom.duration;
            const ease = Math.sin(t * Math.PI);
            n.vx += Math.cos(bloom.angle) * bloom.magnitude * ease;
            n.vy += Math.sin(bloom.angle) * bloom.magnitude * ease;
          } else if (elapsed >= bloom.duration) {
            bloomRef.current.delete(n.id);
          }
        }
      }

      // Damping & Apply
      for (const n of nodes) {
        if (n.id === dragRef.current) {
          n.vx = 0; n.vy = 0;
          continue;
        }
        const damping = isBlooming ? 0.935 : 0.82;
        n.vx *= damping;
        n.vy *= damping;
        const maxSpd = isBlooming ? 6 : 18;
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > maxSpd) { n.vx = (n.vx / speed) * maxSpd; n.vy = (n.vy / speed) * maxSpd; }
        n.x += n.vx; n.y += n.vy;
      }
    }

    function draw() {
      if (!running) return;
      simulate();

      const w = canvas!.width; const h = canvas!.height;
      const z = zoomRef.current; const p = panRef.current;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const css = getComputedStyle(document.body);
      const theme = {
        bgBase: css.getPropertyValue('--bg-base').trim() || '#16181d',
        bgDeep: css.getPropertyValue('--bg-deep').trim() || '#121418',
        border: css.getPropertyValue('--border').trim() || '#303744',
        text: css.getPropertyValue('--text').trim() || '#d7dce5',
        textSecondary: css.getPropertyValue('--text-secondary').trim() || '#a3acba',
        accent: css.getPropertyValue('--accent').trim() || '#8fa1bf',
      };

      ctx!.clearRect(0, 0, w, h);

      const bg = ctx!.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, theme.bgBase);
      bg.addColorStop(1, theme.bgDeep);
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, w, h);

      ctx!.fillStyle = 'rgba(255,255,255,0.02)';
      const gs = 40 * z;
      if (gs > 10) {
        const ox = ((p.x % gs) + gs) % gs;
        const oy = ((p.y % gs) + gs) % gs;
        for (let x = ox; x < w; x += gs) {
          for (let y = oy; y < h; y += gs) {
            ctx!.beginPath();
            ctx!.arc(x, y, 1, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }

      const visibleIds = getVisibleNodeIds();
      const queryLower = filterQuery.toLowerCase();
      const matchesFilter = (n: GNode) => !queryLower || n.title.toLowerCase().includes(queryLower);

      const selectedNeighbors = new Set<string>();
      if (selectedRef.current) {
        for (const e of edges) {
          if (e.from === selectedRef.current) selectedNeighbors.add(e.to);
          if (e.to === selectedRef.current) selectedNeighbors.add(e.from);
        }
      }

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.scale(z, z);

      const drawTime = performance.now();

      // Edges
      for (const e of edges) {
        const a = getNode(e.from); const b = getNode(e.to);
        if (!a || !b) continue;
        if (visibleIds && (!visibleIds.has(a.id) || !visibleIds.has(b.id))) continue;
        if (queryLower && !matchesFilter(a) && !matchesFilter(b)) continue;

        const bloomA = bloomRef.current.get(a.id);
        const bloomB = bloomRef.current.get(b.id);
        const edgeBloomAlpha = Math.min(
          bloomA ? Math.min(1, Math.max(0, (drawTime - bloomA.start) / 800)) : 1,
          bloomB ? Math.min(1, Math.max(0, (drawTime - bloomB.start) / 800)) : 1
        );
        
        const isConnectedToSelected = selectedRef.current && (e.from === selectedRef.current || e.to === selectedRef.current);
        const isHovered = hoverRef.current === e.from || hoverRef.current === e.to;

        ctx!.beginPath();
        if (isConnectedToSelected) {
          ctx!.strokeStyle = `rgba(70, 140, 240, ${Math.min(1, edgeOpacity + 0.3) * edgeBloomAlpha})`;
          ctx!.lineWidth = 1.8;
        } else if (isHovered) {
          ctx!.strokeStyle = `rgba(180, 200, 225, ${edgeOpacity * edgeBloomAlpha})`;
          ctx!.lineWidth = 1.2;
        } else {
          ctx!.strokeStyle = `rgba(140, 156, 180, ${edgeOpacity * 0.7 * edgeBloomAlpha})`;
          ctx!.lineWidth = 0.8;
        }
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }

      // Nodes
      for (const n of nodes) {
        if (visibleIds && !visibleIds.has(n.id)) continue;
        if (queryLower && !matchesFilter(n) && n.conns === 0) continue;

        const bloom = bloomRef.current.get(n.id);
        const bloomScale = bloom ? Math.min(1, Math.max(0, (drawTime - bloom.start) / 700)) : 1;
        const bloomAlpha = bloom ? Math.min(1, Math.max(0, (drawTime - bloom.start + 100) / 600)) : 1;

        const r = ((2.5 + Math.floor(n.conns / 6) * 0.5) * nodeScale) * bloomScale;
        const isSelected = n.id === selectedRef.current;
        const isNeighbor = selectedNeighbors.has(n.id);
        const isHovered = n.id === hoverRef.current;
        const dimmed = queryLower && !matchesFilter(n);
        const groupColor = groupColors[n.group];

        if (isSelected) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(70, 140, 240, ${0.15 * bloomAlpha})`;
          ctx!.fill();
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(70, 140, 240, ${0.25 * bloomAlpha})`;
          ctx!.fill();
        } else if (isHovered) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(200, 210, 225, ${0.1 * bloomAlpha})`;
          ctx!.fill();
        }

        ctx!.beginPath();
        ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);

        if (dimmed) {
          ctx!.fillStyle = 'rgba(70,70,70,0.35)';
          ctx!.fill();
        } else if (isSelected) {
          ctx!.globalAlpha = bloomAlpha;
          ctx!.fillStyle = '#4a90e2';
          ctx!.fill();
          ctx!.globalAlpha = 1;
        } else if (isNeighbor) {
          ctx!.globalAlpha = 0.9 * bloomAlpha;
          ctx!.fillStyle = 'rgba(120, 170, 230, 0.9)';
          ctx!.fill();
          ctx!.globalAlpha = 1;
        } else if (groupColor) {
          ctx!.globalAlpha = 0.9 * bloomAlpha;
          ctx!.fillStyle = groupColor;
          ctx!.fill();
          ctx!.globalAlpha = 1;
        } else {
          ctx!.globalAlpha = 0.85 * bloomAlpha;
          ctx!.fillStyle = 'rgba(180, 190, 205, 0.85)';
          ctx!.fill();
          ctx!.globalAlpha = 1;
        }

        if (!dimmed && (showAllLabels || isHovered || isSelected || isNeighbor)) {
          ctx!.globalAlpha = bloomAlpha;
          ctx!.fillStyle = isSelected || isNeighbor ? theme.text : theme.textSecondary;
          ctx!.font = `${isSelected ? 'bold 11' : '10'}px -apple-system, system-ui, sans-serif`;
          ctx!.textAlign = 'center';
          ctx!.fillText(n.title, n.x, n.y + r + 14);
          ctx!.globalAlpha = 1;
        }
      }

      ctx!.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [state.activeNoteId, state.notes, buildGraph, filterQuery, depthFilter, nodeScale, linkDistance, centerForce, groupPull, showAllLabels, edgeOpacity]);

  const getNodeAt = useCallback((mx: number, my: number) => {
    const z = zoomRef.current; const p = panRef.current;
    const wx = (mx - p.x) / z; const wy = (my - p.y) / z;
    for (const n of [...nodesRef.current].reverse()) {
      const r = ((2.5 + Math.floor(n.conns / 6) * 0.5) * nodeScale) + 12;
      if ((wx - n.x) ** 2 + (wy - n.y) ** 2 < r * r) return n;
    }
    return null;
  }, [nodeScale]);

  const handleDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    wasDragRef.current = false;
    if (n) {
      dragRef.current = n.id;
      const node = nodesRef.current.find(nd => nd.id === n.id);
      if (node) { node.vx = 0; node.vy = 0; }
    } else {
      panRef.current.dragging = true;
      panRef.current.sx = e.clientX - panRef.current.x;
      panRef.current.sy = e.clientY - panRef.current.y;
    }
  };

  const handleMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if (dragRef.current) {
      wasDragRef.current = true;
      const z = zoomRef.current; const p = panRef.current;
      const n = nodesRef.current.find(nd => nd.id === dragRef.current);
      if (n) {
        n.x = (e.clientX - rect.left - p.x) / z;
        n.y = (e.clientY - rect.top - p.y) / z;
        n.vx = 0; n.vy = 0;
      }
    } else if (panRef.current.dragging) {
      panRef.current.x = e.clientX - panRef.current.sx;
      panRef.current.y = e.clientY - panRef.current.sy;
    } else {
      const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      hoverRef.current = n ? n.id : null;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = n ? 'pointer' : 'default';
      }
    }
  };

  const handleUp = () => {
    if (dragRef.current) {
      const n = nodesRef.current.find(nd => nd.id === dragRef.current);
      if (n) { n.vx = 0; n.vy = 0; }
    }
    dragRef.current = null;
    panRef.current.dragging = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (wasDragRef.current) { wasDragRef.current = false; return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (n) {
      selectedRef.current = n.id;
      dispatch({ type: 'OPEN_TAB', payload: n.id });
    } else {
      selectedRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.max(0.15, Math.min(5, zoomRef.current - e.deltaY * 0.001));
  };

  const reset = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0, dragging: false, sx: 0, sy: 0 };
    buildGraph();
  };

  const animate = () => {
    const cx = sizeRef.current.w / 2;
    const cy = sizeRef.current.h / 2;
    physicsRef.current = true;
    bloomRef.current.clear();
    const now = performance.now();
    bloomStartRef.current = now;

    nodesRef.current.forEach(n => {
      n.x = cx + (Math.random() - 0.5) * 2;
      n.y = cy + (Math.random() - 0.5) * 2;
      n.vx = 0;
      n.vy = 0;
    });

    const total = nodesRef.current.length;
    nodesRef.current.forEach((n, i) => {
      const angle = (i / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const magnitude = 0.25 + n.conns * 0.05 + Math.random() * 0.1;
      const duration = 2800 + Math.random() * 1400;
      bloomRef.current.set(n.id, {
        start: now + i * 18,
        angle,
        magnitude,
        duration,
      });
    });
  };

  const togglePhysics = () => { physicsRef.current = !physicsRef.current; };

  const inputStyle = { width: '100%', accentColor: 'var(--accent)', margin: 0 };
  const labelStyle = { fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' as const };

  return (
    <div className="fixed inset-0 animate-fade-in" style={{ zIndex: 100, background: 'var(--bg-deep)' }}>
      <canvas ref={canvasRef}
        onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp}
        onClick={handleClick} onWheel={handleWheel}
        style={{ display: 'block' }} />

      {/* Header */}
      <div className="flex items-center justify-between" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 16px', background: 'color-mix(in srgb, var(--bg-base) 92%, transparent)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSettings(!showSettings)} title="Settings"
            style={{ background: 'none', border: 'none', color: showSettings ? 'var(--text)' : 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 0, transition: 'color 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { if (!showSettings) e.currentTarget.style.color = 'var(--text-dim)'; }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <FlintLogo size={14} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Graph View</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
            {graphStats.nodes} nodes · {graphStats.edges} links
          </span>
        </div>
        <button onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}>
          <X size={18} />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{ position: 'absolute', top: 48, left: 16, width: 260, background: 'color-mix(in srgb, var(--bg-surface) 96%, transparent)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', zIndex: 10, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}><span>Search</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px' }}>
              <Search size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <input type="text" placeholder="Filter nodes..." value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 11, outline: 'none', width: '100%' }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}><span>Depth</span> <span>{depthFilter === 0 ? '∞' : depthFilter}</span></div>
            <input type="range" min={0} max={6} value={depthFilter}
              onChange={e => setDepthFilter(parseInt(e.target.value))}
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}><span>Line Visibility</span> <span>{Math.round(edgeOpacity * 100)}%</span></div>
            <input type="range" min={0.1} max={1} step={0.05} value={edgeOpacity}
              onChange={e => setEdgeOpacity(parseFloat(e.target.value))}
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showAllLabels} onChange={e => setShowAllLabels(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              Show all titles
            </label>
          </div>

          <div style={{ borderBottom: '1px solid var(--border)', margin: '8px 0' }}></div>

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}><span>Node Scale</span> <span>{nodeScale.toFixed(1)}</span></div>
            <input type="range" min={0.5} max={4.0} step={0.1} value={nodeScale}
              onChange={e => setNodeScale(parseFloat(e.target.value))}
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}><span>Link Distance</span> <span>{linkDistance}px</span></div>
            <input type="range" min={100} max={600} step={10} value={linkDistance}
              onChange={e => setLinkDistance(parseInt(e.target.value))}
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}><span>Center Gravity</span> <span>{centerForce.toFixed(4)}</span></div>
            <input type="range" min={0.0005} max={0.0050} step={0.0001} value={centerForce}
              onChange={e => setCenterForce(parseFloat(e.target.value))}
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}><span>Group Pull</span> <span>{groupPull.toFixed(3)}</span></div>
            <input type="range" min={0.001} max={0.015} step={0.001} value={groupPull}
              onChange={e => setGroupPull(parseFloat(e.target.value))}
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}><span>Group Spread</span> <span>{groupSpread}px</span></div>
            <input type="range" min={140} max={520} step={10} value={groupSpread}
              onChange={e => setGroupSpread(parseInt(e.target.value))}
              style={inputStyle} />
          </div>

          <div style={{ borderBottom: '1px solid var(--border)', margin: '8px 0' }}></div>

          <div style={{ marginBottom: 8 }}>
            <div style={labelStyle}><span>Color Groups</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px' }}>
              <Palette size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} style={{ background: 'var(--bg-deep)', color: 'var(--text)', border: 'none', fontSize: 11, outline: 'none', width: '100%' }}>
                {['root', ...state.folders.map(folder => `folder:${folder.name}`)].map(group => (
                  <option key={group} value={group}>{group.replace(/^folder:/, '')}</option>
                ))}
              </select>
              <input
                type="color"
                value={groupColors[selectedGroup] || '#8fa1bf'}
                onChange={e => setGroupColors(prev => ({ ...prev, [selectedGroup]: e.target.value }))}
                style={{ width: 20, height: 20, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
              />
            </div>
            <button
              onClick={() => setGroupColors(prev => {
                const next = { ...prev };
                delete next[selectedGroup];
                return next;
              })}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 9, marginTop: 4, padding: 0, opacity: 0.8 }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
            >
              Clear color
            </button>
          </div>

          <div style={{ borderBottom: '1px solid var(--border)', margin: '8px 0' }}></div>

          <button 
            onClick={animate} 
            style={{ width: '100%', padding: '6px 0', fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-deep)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Burst Animation
          </button>
        </div>
      )}

      {/* Controls */}
      <div style={{ position: 'absolute', top: 48, right: 16, display: 'flex', flexDirection: 'column', gap: 2, background: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, zIndex: 10 }}>
        {[
          { icon: <ZoomIn size={14} />, action: () => { zoomRef.current = Math.min(5, zoomRef.current + 0.2); }, title: 'Zoom in' },
          { icon: <ZoomOut size={14} />, action: () => { zoomRef.current = Math.max(0.15, zoomRef.current - 0.2); }, title: 'Zoom out' },
          { icon: <RotateCcw size={14} />, action: reset, title: 'Reset' },
          { icon: physicsRef.current ? <Pause size={14} /> : <Play size={14} />, action: togglePhysics, title: physicsRef.current ? 'Pause physics' : 'Resume physics' },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} title={btn.title}
            style={{ width: 32, height: 32, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-dim)'; }}>
            {btn.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
