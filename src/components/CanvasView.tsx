import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useStore } from '../store';
import { FlintLogo } from './FlintLogo';
import { Grip, RotateCcw, Search, X, Plus, Type, Trash2 } from 'lucide-react';
import type { CanvasCard } from '../types';

type CardPos = Record<string, { x: number; y: number; w: number; h: number }>;

function getStorageKey(vaultId: string | null) {
  return `flint-canvas-${vaultId || 'default'}`;
}

function loadPositions(vaultId: string | null): CardPos {
  try {
    const raw = localStorage.getItem(getStorageKey(vaultId));
    return raw ? JSON.parse(raw) as CardPos : {};
  } catch {
    return {};
  }
}

function savePositions(vaultId: string | null, positions: CardPos) {
  try {
    localStorage.setItem(getStorageKey(vaultId), JSON.stringify(positions));
  } catch {
    // ignore
  }
}

export function CanvasView() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const canvasDragRef = useRef<{ x: number; y: number } | null>(null);

  const activeVaultId = state.activeVaultId;
  const workspace = activeVaultId ? state.vaultData[activeVaultId] : null;
  const cards = workspace?.canvasCards || [];

  const updateCards = useCallback((newCards: CanvasCard[]) => {
    dispatch({ type: 'UPDATE_CANVAS_CARDS', payload: newCards });
  }, [dispatch]);

  // Initial layout if no cards exist
  useEffect(() => {
    if (activeVaultId && cards.length === 0 && state.notes.length > 0) {
      const initialCards: CanvasCard[] = state.notes.map((note, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        return {
          id: note.id,
          type: 'note',
          noteId: note.id,
          x: 80 + col * 320,
          y: 100 + row * 220,
          w: 260,
          h: 150,
        };
      });
      updateCards(initialCards);
    }
  }, [activeVaultId, state.notes.length]);

  const filteredCards = useMemo(() => {
    if (!query.trim()) return cards;
    const q = query.toLowerCase();
    return cards.filter(card => {
      if (card.type === 'note' && card.noteId) {
        const note = state.notes.find(n => n.id === card.noteId);
        return note && (note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q));
      }
      return card.content?.toLowerCase().includes(q);
    });
  }, [cards, query, state.notes]);

  const edges = useMemo(() => {
    const filteredIds = new Set(filteredCards.map(c => c.id));
    const noteTitleIdMap = new Map(state.notes.map(note => [note.title.toLowerCase(), note.id]));
    const pairs = new Set<string>();
    const list: Array<{ from: string; to: string }> = [];

    filteredCards.forEach((card) => {
      if (card.type !== 'note' || !card.noteId) return;
      const note = state.notes.find(n => n.id === card.noteId);
      if (!note) return;

      const matches = note.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const match of matches) {
        const targetId = noteTitleIdMap.get(match[1].toLowerCase());
        if (!targetId || !filteredIds.has(targetId) || targetId === note.id) continue;
        const key = [note.id, targetId].sort().join('::');
        if (pairs.has(key)) continue;
        pairs.add(key);
        list.push({ from: note.id, to: targetId });
      }
    });
    return list;
  }, [filteredCards, state.notes]);

  const setNodePosition = (id: string, x: number, y: number) => {
    updateCards(cards.map(c => c.id === id ? { ...c, x, y } : c));
  };

  const addTextCard = () => {
    const newCard: CanvasCard = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'text',
      content: 'New sticky note',
      x: (window.innerWidth / 2 - pan.x) / zoom,
      y: (window.innerHeight / 2 - pan.y) / zoom,
      w: 200,
      h: 120,
    };
    updateCards([...cards, newCard]);
  };

  const deleteCard = (id: string) => {
    updateCards(cards.filter(c => c.id !== id));
  };

  const updateTextCardContent = (id: string, content: string) => {
    updateCards(cards.map(c => c.id === id ? { ...c, content } : c));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      setNodePosition(
        dragRef.current.id,
        (e.clientX - pan.x - dragRef.current.offsetX) / zoom,
        (e.clientY - pan.y - dragRef.current.offsetY) / zoom,
      );
    } else if (canvasDragRef.current) {
      setPan({
        x: e.clientX - canvasDragRef.current.x,
        y: e.clientY - canvasDragRef.current.y,
      });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.max(0.1, Math.min(5, z * delta)));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const resetLayout = () => {
    if (confirm('Are you sure you want to reset the layout? This will clear all text cards and reset note positions.')) {
      updateCards([]);
    }
  };

  const findCard = (id: string) => cards.find(c => c.id === id);

  return (
    <div
      className="fixed inset-0 animate-fade-in overflow-hidden"
      style={{ zIndex: 110, background: 'var(--bg-deep)' }}
      onMouseMove={handleMouseMove}
      onMouseUp={() => { dragRef.current = null; canvasDragRef.current = null; }}
      onMouseLeave={() => { dragRef.current = null; canvasDragRef.current = null; }}
      onMouseDown={e => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
          canvasDragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        }
      }}
      onWheel={handleWheel}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: '0 0',
      }}>
        <svg style={{ position: 'absolute', inset: 0, width: '10000px', height: '10000px', pointerEvents: 'none' }}>
          {edges.map(edge => {
            const from = findCard(edge.from);
            const to = findCard(edge.to);
            if (!from || !to) return null;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x + from.w / 2}
                y1={from.y + from.h / 2}
                x2={to.x + to.w / 2}
                y2={to.y + to.h / 2}
                stroke="var(--border-light)"
                strokeWidth={1.4 / zoom}
                opacity="0.4"
              />
            );
          })}
        </svg>

        {filteredCards.map(card => {
          const isNote = card.type === 'note';
          const note = isNote ? state.notes.find(n => n.id === card.noteId) : null;
          const active = isNote && note?.id === state.activeNoteId;
          const preview = isNote && note ? note.content.split('\n').find(line => line.trim() && !line.startsWith('#')) || 'Empty note' : card.content;

          return (
            <div
              key={card.id}
              style={{
                position: 'absolute',
                left: card.x,
                top: card.y,
                width: card.w,
                minHeight: card.h,
                background: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                border: `${1 / zoom}px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                onMouseDown={e => {
                  e.stopPropagation();
                  dragRef.current = {
                    id: card.id,
                    offsetX: e.clientX - pan.x - card.x * zoom,
                    offsetY: e.clientY - pan.y - card.y * zoom,
                  };
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid var(--border)', cursor: 'grab', background: 'rgba(255,255,255,0.02)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <Grip size={10} style={{ color: 'var(--text-dim)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isNote ? note?.title : 'Text Card'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {isNote && (
                    <button
                      onClick={() => dispatch({ type: 'OPEN_TAB', payload: card.noteId! })}
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
                    >
                      <Plus size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteCard(card.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div style={{ padding: 10, flex: 1, display: 'flex' }}>
                {isNote ? (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflow: 'hidden' }}>
                    {preview?.slice(0, 200)}
                  </div>
                ) : (
                  <textarea
                    value={card.content}
                    onChange={e => updateTextCardContent(card.id, e.target.value)}
                    style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 12, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                    placeholder="Type something..."
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 16px', background: 'rgba(20, 20, 20, 0.8)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-3">
          <FlintLogo size={14} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Canvas</span>
          <div className="flex items-center gap-1 ml-4" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 4px' }}>
             <button onClick={addTextCard} title="Add Text Card" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <Type size={14} />
             </button>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
            {filteredCards.length} cards
          </span>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2" style={{ padding: '6px 8px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <Search size={12} style={{ color: 'var(--text-dim)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter canvas..."
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 12, width: 180 }}
            />
          </div>
          <button
            onClick={resetLayout}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button onClick={() => dispatch({ type: 'TOGGLE_CANVAS_VIEW' })} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
      </div>

    </div>
  );
}

