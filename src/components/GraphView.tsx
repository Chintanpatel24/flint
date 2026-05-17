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
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 });
  const [filterQuery, setFilterQuery] = useState('');
  const [depthFilter, setDepthFilter] = useState(0);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [nodeScale, setNodeScale] = useState(1);
  const [linkDistance, setLinkDistance] = useState(160);
  const [centerForce, setCenterForce] = useState(0.0004);
  const [groupPull, setGroupPull] = useState(0.004);
  const [groupSpread, setGroupSpread] = useState(280);
  const [groupColors, setGroupColors] = useState<Record<string, string>>({});
  const [selectedGroup, setSelectedGroup] = useState('root');

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
      x: (targetMap[deriveGroup(n)]?.x || cx) + (Math.random() - 0.5) * 140,
      y: (targetMap[deriveGroup(n)]?.y || cy) + (Math.random() - 0.5) * 120,
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

    // Update state for display
    setGraphStats({ nodes: nodesRef.current.length, edges: edgesRef.current.length });
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

    // BFS to get nodes within N hops of active note
    function getVisibleNodeIds(): Set<string> | null {
      if (depthFilter === 0) return null; // show all
      const activeId = state.activeNoteId;
      if (!activeId) return null;
      const visible = new Set<string>();
      const queue: Array<{ id: string; depth: number }> = [{ id: activeId, depth: 0 }];
      const visited = new Set<string>([activeId]);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        visible.add(curr.id);
        if (curr.depth >= depthFilter) continue;
        const node = getNode(curr.id);
        if (!node) continue;
        // Find neighbors via edges
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

      // Repulsion between all pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const sameGroup = nodes[i].group === nodes[j].group;
          const f = (sameGroup ? 2800 : 4600) / (d * d);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }

      // Spring forces along edges
      for (const e of edges) {
        const a = getNode(e.from); const b = getNode(e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x; const dy = b.y - a.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = (d - linkDistance) * 0.005;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (cx - n.x) * centerForce;
        n.vy += (cy - n.y) * centerForce;

        const gt = groupTargetRef.current[n.group];
        if (gt) {
          n.vx += (gt.x - n.x) * groupPull;
          n.vy += (gt.y - n.y) * groupPull;
        }
      }

      // Apply velocity with heavy damping
      for (const n of nodes) {
        if (n.id === dragRef.current) {
          n.vx = 0; n.vy = 0;
          continue;
        }
        n.vx *= 0.55;
        n.vy *= 0.55;
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > 12) { n.vx = (n.vx / speed) * 12; n.vy = (n.vy / speed) * 12; }
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
        accentHover: css.getPropertyValue('--accent-hover').trim() || '#b5c0d5',
      };

      ctx!.clearRect(0, 0, w, h);

      // Background
      const bg = ctx!.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, theme.bgBase);
      bg.addColorStop(1, theme.bgDeep);
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, w, h);

      // Grid dots
      ctx!.fillStyle = 'rgba(255,255,255,0.03)';
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

      // Get visible set for depth filter
      const visibleIds = getVisibleNodeIds();

      // Filter nodes by search query
      const queryLower = filterQuery.toLowerCase();
      const matchesFilter = (n: GNode) => {
        if (!queryLower) return true;
        return n.title.toLowerCase().includes(queryLower);
      };

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.scale(z, z);

      // Edges
      for (const e of edges) {
        const a = getNode(e.from); const b = getNode(e.to);
        if (!a || !b) continue;
        if (visibleIds && (!visibleIds.has(a.id) || !visibleIds.has(b.id))) continue;
        if (queryLower && !matchesFilter(a) && !matchesFilter(b)) continue;
        const isHover = hoverRef.current === e.from || hoverRef.current === e.to;
        const isActive = state.activeNoteId === e.from || state.activeNoteId === e.to;
        const isSelectedEdge = selectedRef.current === e.from || selectedRef.current === e.to;

        ctx!.beginPath();
        ctx!.strokeStyle = isHover
          ? `${theme.accentHover}cc`
          : isSelectedEdge
          ? `${theme.accent}88`
          : isActive
          ? 'rgba(220,228,241,0.34)'
          : 'rgba(140,156,180,0.16)';
        ctx!.lineWidth = isSelectedEdge ? 1.6 : isActive ? 1.2 : isHover ? 1 : 0.6;
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }

      // Nodes
      const activeId = state.activeNoteId;
      for (const n of nodes) {
        if (visibleIds && !visibleIds.has(n.id)) continue;
        if (queryLower && !matchesFilter(n) && n.conns === 0) continue;

        const r = (2.5 + Math.min(n.conns, 12) * 0.8) * nodeScale;
        const isActive = n.id === activeId;
        const isHover = n.id === hoverRef.current;
        const isSelected = n.id === selectedRef.current;
        const dimmed = queryLower && !matchesFilter(n);
        const groupColor = groupColors[n.group];

        // Outer glow for active
        if (isActive) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
          ctx!.fillStyle = `${theme.accent}22`;
          ctx!.fill();
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
          ctx!.fillStyle = `${theme.accentHover}33`;
          ctx!.fill();
        }

        // Node circle
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);

        if (dimmed) {
          ctx!.fillStyle = 'rgba(70,70,70,0.35)';
          ctx!.fill();
        } else if (isActive) {
          ctx!.fillStyle = theme.text;
          ctx!.strokeStyle = theme.accentHover;
          ctx!.lineWidth = 1;
          ctx!.fill(); ctx!.stroke();
        } else if (groupColor) {
          ctx!.fillStyle = groupColor;
          ctx!.globalAlpha = 0.9;
          ctx!.fill();
          ctx!.globalAlpha = 1;
        } else if (n.conns > 0) {
          const shade = Math.min(215, 120 + n.conns * 10);
          ctx!.fillStyle = `rgba(${shade},${shade},${shade},0.92)`;
          ctx!.fill();
        } else {
          ctx!.fillStyle = 'rgba(120,130,145,0.28)';
          ctx!.fill();
        }

        // Hover ring
        if ((isHover || isSelected) && !isActive) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
          ctx!.strokeStyle = isHover ? `${theme.accentHover}cc` : `${theme.textSecondary}88`;
          ctx!.lineWidth = 0.8;
          ctx!.stroke();
        }

        // Labels
        if (!dimmed && (showAllLabels || isHover || isActive || isSelected)) {
          ctx!.fillStyle = isActive ? theme.text : theme.textSecondary;
          ctx!.font = `${isActive || isSelected ? 'bold 10' : '9'}px -apple-system, system-ui, sans-serif`;
          ctx!.textAlign = 'center';
          ctx!.fillText(n.title, n.x, n.y + r + 13);
        }
      }

      ctx!.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [state.activeNoteId, state.notes, buildGraph, filterQuery, depthFilter, nodeScale, linkDistance, centerForce, groupPull, showAllLabels]);

  const getNodeAt = useCallback((mx: number, my: number) => {
    const z = zoomRef.current; const p = panRef.current;
    const wx = (mx - p.x) / z; const wy = (my - p.y) / z;
    for (const n of [...nodesRef.current].reverse()) {
      const r = ((2.5 + Math.min(n.conns, 12) * 0.8) * nodeScale) + 10;
      if ((wx - n.x) ** 2 + (wy - n.y) ** 2 < r * r) return n;
    }
    return null;
  }, []);

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
    const cx = sizeRef.current.w / 2; const cy = sizeRef.current.h / 2;
    nodesRef.current.forEach(n => { n.x = cx; n.y = cy; n.vx = 0; n.vy = 0; });
    nodesRef.current.forEach((n, i) => {
      setTimeout(() => {
        const angle = (i / nodesRef.current.length) * Math.PI * 2;
        const dist = 100 + n.conns * 35;
        n.x = cx + Math.cos(angle) * dist;
        n.y = cy + Math.sin(angle) * dist;
        n.vx = (Math.random() - 0.5) * 3;
        n.vy = (Math.random() - 0.5) * 3;
      }, i * 80);
    });
  };

  const togglePhysics = () => { physicsRef.current = !physicsRef.current; };

  return (
    <div className="fixed inset-0 animate-fade-in" style={{ zIndex: 100, background: 'var(--bg-deep)' }}>
      <canvas ref={canvasRef}
        onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp}
        onClick={handleClick} onWheel={handleWheel}
        style={{ display: 'block' }} />

      {/* Header */}
      <div className="flex items-center justify-between" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 16px', background: 'color-mix(in srgb, var(--bg-base) 92%, transparent)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
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

      {/* Search filter + depth */}
      <div style={{ position: 'absolute', top: 48, left: 16, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', maxWidth: '70vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
          <Search size={12} style={{ color: 'var(--text-dim)' }} />
          <input type="text" placeholder="Filter nodes..." value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 11, outline: 'none', width: 120 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Depth</span>
          <input type="range" min={0} max={6} value={depthFilter}
            onChange={e => setDepthFilter(parseInt(e.target.value))}
            style={{ width: 60, accentColor: '#555' }} />
          <span style={{ fontSize: 9, color: 'var(--text-secondary)', width: 12 }}>{depthFilter === 0 ? '∞' : depthFilter}</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 10, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={showAllLabels} onChange={e => setShowAllLabels(e.target.checked)} />
          Show all titles
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Node</span>
          <input type="range" min={0.7} max={2} step={0.1} value={nodeScale}
            onChange={e => setNodeScale(parseFloat(e.target.value))}
            style={{ width: 74, accentColor: '#555' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Distance</span>
          <input type="range" min={90} max={320} step={5} value={linkDistance}
            onChange={e => setLinkDistance(parseInt(e.target.value))}
            style={{ width: 74, accentColor: '#555' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Center</span>
          <input type="range" min={0.0001} max={0.0015} step={0.0001} value={centerForce}
            onChange={e => setCenterForce(parseFloat(e.target.value))}
            style={{ width: 74, accentColor: '#555' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Groups</span>
          <input type="range" min={140} max={520} step={10} value={groupSpread}
            onChange={e => setGroupSpread(parseInt(e.target.value))}
            style={{ width: 74, accentColor: '#555' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
          <Palette size={12} style={{ color: 'var(--text-dim)' }} />
          <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 11, outline: 'none' }}>
            {['root', ...state.folders.map(folder => `folder:${folder.name}`)].map(group => (
              <option key={group} value={group}>{group.replace(/^folder:/, '')}</option>
            ))}
          </select>
          <input
            type="color"
            value={groupColors[selectedGroup] || '#8fa1bf'}
            onChange={e => setGroupColors(prev => ({ ...prev, [selectedGroup]: e.target.value }))}
            style={{ width: 20, height: 20, border: 'none', background: 'none', padding: 0 }}
          />
          <button
            onClick={() => setGroupColors(prev => {
              const next = { ...prev };
              delete next[selectedGroup];
              return next;
            })}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10 }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ position: 'absolute', top: 48, right: 16, display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
        {[
          { icon: <ZoomIn size={14} />, action: () => { zoomRef.current = Math.min(5, zoomRef.current + 0.2); }, title: 'Zoom in' },
          { icon: <ZoomOut size={14} />, action: () => { zoomRef.current = Math.max(0.15, zoomRef.current - 0.2); }, title: 'Zoom out' },
          { icon: <RotateCcw size={14} />, action: reset, title: 'Reset' },
          { icon: physicsRef.current ? <Pause size={14} /> : <Play size={14} />, action: togglePhysics, title: physicsRef.current ? 'Pause physics' : 'Resume physics' },
          { icon: <Play size={14} />, action: animate, title: 'Animate' },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} title={btn.title}
            style={{ width: 32, height: 32, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-dim)'; }}>
            {btn.icon}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 9, color: 'var(--text-dim)' }}>
        <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--text-secondary)' }}>Legend</div>
        <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text)' }} /> Active note
        </div>
        <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#9aa6b6' }} /> Connected
        </div>
        <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(120,130,145,0.35)' }} /> Orphan
        </div>
        <div style={{ marginTop: 4, color: 'var(--text-dim)' }}>Straight links · Scroll to zoom · Drag to pan</div>
      </div>
    </div>
  );
}
