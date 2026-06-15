import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Search } from 'lucide-react';

export function SearchModal() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = query.trim()
    ? state.notes.filter(n => n.title.toLowerCase().includes(query.toLowerCase()) || n.content.toLowerCase().includes(query.toLowerCase()))
    : [];

  useEffect(() => { setIdx(0); }, [query]);

  return (
    <div className="fixed inset-0 animate-fade-in" style={{ zIndex: 150, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={() => dispatch({ type: 'TOGGLE_SEARCH' })}>
      <div className="animate-scale-in" style={{ width: 480, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2" style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a' }}>
          <Search size={14} style={{ color: '#444' }} />
          <input ref={inputRef} type="text" placeholder="Search all notes..." value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && results[idx]) { dispatch({ type: 'OPEN_TAB', payload: results[idx].id }); dispatch({ type: 'TOGGLE_SEARCH' }); }
              if (e.key === 'Escape') dispatch({ type: 'TOGGLE_SEARCH' });
            }}
            style={{ flex: 1, background: 'none', border: 'none', color: '#bbb', fontSize: 14, outline: 'none' }} />
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {results.length === 0 && query.trim() && (
            <div style={{ padding: '16px 14px', color: '#333', fontSize: 13 }}>No results found</div>
          )}
          {results.map((note, i) => (
            <div key={note.id} className="flex items-center gap-2 cursor-pointer"
              style={{ padding: '8px 14px', background: i === idx ? '#141414' : 'transparent', borderLeft: i === idx ? '2px solid #666' : '2px solid transparent', transition: 'all 0.08s' }}
              onMouseEnter={() => setIdx(i)}
              onClick={() => { dispatch({ type: 'OPEN_TAB', payload: note.id }); dispatch({ type: 'TOGGLE_SEARCH' }); }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#bbb' }}>{note.title}</div>
                <div style={{ fontSize: 11, color: '#333', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {note.content.replace(/[#*\[\]`]/g, '').substring(0, 80)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '6px 14px', borderTop: '1px solid #1a1a1a', fontSize: 10, color: '#333', display: 'flex', gap: 12 }}>
          <span>↑↓ Navigate</span><span>↵ Open</span><span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
