import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { Plus, X, Link2, ExternalLink, StickyNote, Type, Globe, Maximize2, Minimize2 } from 'lucide-react';
import { CanvasCard, CanvasConnection } from '../../types';
import { TiptapEditor } from '../editor/TiptapEditor';

export function CanvasView() {
  const { state, dispatch } = useStore();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const cards = state.vaultData[state.activeVaultId!]?.canvasCards || [];
  const connections = state.vaultData[state.activeVaultId!]?.canvasConnections || [];

  const addCard = (type: CanvasCard['type']) => {
    const id = Math.random().toString(36).substring(7);
    const newCard: CanvasCard = {
      id, type, x: 100 - offset.x, y: 100 - offset.y, width: 250, height: 150,
      content: type === 'text' ? 'New Sticky Note' : '',
      url: type === 'web' ? 'https://wikipedia.org' : ''
    };
    dispatch({ type: 'UPDATE_CANVAS_CARDS', payload: [...cards, newCard] });
  };

  const updateCard = (id: string, updates: Partial<CanvasCard>) => {
    dispatch({ type: 'UPDATE_CANVAS_CARDS', payload: cards.map(c => c.id === id ? { ...c, ...updates } : c) });
  };

  const deleteCard = (id: string) => {
    dispatch({ type: 'UPDATE_CANVAS_CARDS', payload: cards.filter(c => c.id !== id) });
    dispatch({ type: 'UPDATE_CANVAS_CONNECTIONS', payload: connections.filter(conn => conn.fromId !== id && conn.toId !== id) });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.max(0.1, Math.min(5, z * delta)));
    } else {
      setOffset(o => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) setIsPanning(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) setOffset(o => ({ x: o.x + e.movementX, y: o.y + e.movementY }));
  };

  // Mini-map logic
  const minX = Math.min(0, ...cards.map(c => c.x));
  const minY = Math.min(0, ...cards.map(c => c.y));
  const maxX = Math.max(1000, ...cards.map(c => c.x + c.width));
  const maxY = Math.max(1000, ...cards.map(c => c.y + c.height));
  const mapScale = 0.1;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-[#050505] overflow-hidden"
      onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsPanning(false)}>

      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-2 flex items-center gap-4 shadow-2xl z-50">
        <button onClick={() => addCard('text')} className="flex items-center gap-2 text-xs text-[#666] hover:text-[#bbb] transition-colors"><Type size={14}/> Text</button>
        <button onClick={() => addCard('note')} className="flex items-center gap-2 text-xs text-[#666] hover:text-[#bbb] transition-colors"><StickyNote size={14}/> Note</button>
        <button onClick={() => addCard('web')} className="flex items-center gap-2 text-xs text-[#666] hover:text-[#bbb] transition-colors"><Globe size={14}/> Web</button>
        <div className="w-[1px] h-4 bg-[#1a1a1a]"/>
        <button onClick={() => dispatch({ type: 'TOGGLE_CANVAS_VIEW' })} className="text-[#666] hover:text-white transition-colors"><Maximize2 size={16}/></button>
      </div>

      {/* Infinite Surface */}
      <div style={{ transform: `scale(${zoom}) translate(${offset.x}px, ${offset.y}px)`, transformOrigin: '0 0', transition: isPanning ? 'none' : 'transform 0.1s' }}>
        {/* Connections */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: 5000, height: 5000 }}>
          {connections.map(conn => {
            const from = cards.find(c => c.id === conn.fromId);
            const to = cards.find(c => c.id === conn.toId);
            if (!from || !to) return null;
            return <line key={conn.id} x1={from.x + from.width/2} y1={from.y + from.height/2} x2={to.x + to.width/2} y2={to.y + to.height/2} stroke="#222" strokeWidth={2 / zoom}/>;
          })}
        </svg>

        {cards.map(card => (
          <div key={card.id} className="absolute bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg shadow-xl overflow-hidden group"
            style={{ left: card.x, top: card.y, width: card.width, height: card.height }}>
            <div className="h-6 bg-[#080808] border-bottom border-[#1a1a1a] flex items-center justify-between px-2 cursor-move"
              onMouseDown={(e) => {
                const startX = e.clientX; const startY = e.clientY;
                const startPosX = card.x; const startPosY = card.y;
                const onMove = (me: MouseEvent) => {
                  updateCard(card.id, { x: startPosX + (me.clientX - startX) / zoom, y: startPosY + (me.clientY - startY) / zoom });
                };
                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
              }}>
              <span className="text-[10px] text-[#444] uppercase font-bold tracking-tighter">{card.type}</span>
              <button onClick={() => deleteCard(card.id)} className="text-[#333] hover:text-red-500 transition-colors"><X size={12}/></button>
            </div>
            <div className="flex-1 h-[calc(100%-24px)]">
              {card.type === 'text' && <div className="p-4 text-sm text-[#888] outline-none h-full" contentEditable onBlur={e => updateCard(card.id, { content: e.currentTarget.innerText })}>{card.content}</div>}
              {card.type === 'web' && <iframe src={card.url} className="w-full h-full border-none grayscale contrast-125 opacity-70"/>}
              {card.type === 'note' && <div className="p-2 text-[11px] text-[#555] overflow-auto h-full">Note: {card.noteId || 'Select a note'}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Mini-map */}
      <div className="absolute bottom-6 right-6 w-48 h-32 bg-[#080808] border border-[#1a1a1a] rounded-lg opacity-50 hover:opacity-100 transition-opacity pointer-events-none overflow-hidden">
        {cards.map(c => (
          <div key={c.id} className="absolute bg-[#1a1a1a] rounded-sm"
            style={{ left: (c.x - minX) * mapScale, top: (c.y - minY) * mapScale, width: c.width * mapScale, height: c.height * mapScale }} />
        ))}
        {/* Viewport indicator */}
        <div className="absolute border border-[#4a9eff]"
          style={{ left: -offset.x * mapScale / zoom, top: -offset.y * mapScale / zoom, width: (containerRef.current?.clientWidth || 0) * mapScale / zoom, height: (containerRef.current?.clientHeight || 0) * mapScale / zoom }} />
      </div>
    </div>
  );
}
