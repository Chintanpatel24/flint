import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { Search, FileText } from 'lucide-react';

export function QuickSwitcher() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = state.notes
    .filter(n => n.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[idx]) {
      dispatch({ type: 'OPEN_TAB', payload: filtered[idx].id });
      dispatch({ type: 'TOGGLE_QUICK_SWITCHER' });
    }
    if (e.key === 'Escape') dispatch({ type: 'TOGGLE_QUICK_SWITCHER' });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100 }}
      onClick={() => dispatch({ type: 'TOGGLE_QUICK_SWITCHER' })}>
      <div style={{ width: 500, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
          <Search size={16} style={{ color: '#444' }} />
          <input ref={inputRef} type="text" placeholder="Search notes..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKey}
            style={{ flex: 1, background: 'none', border: 'none', color: '#bbb', fontSize: 15, outline: 'none' }} />
        </div>
        <div>
          {filtered.map((n, i) => (
            <div key={n.id} onClick={() => { dispatch({ type: 'OPEN_TAB', payload: n.id }); dispatch({ type: 'TOGGLE_QUICK_SWITCHER' }); }}
              style={{ padding: '10px 16px', background: i === idx ? '#141414' : 'transparent', color: i === idx ? '#4a9eff' : '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={14} /> {n.title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
