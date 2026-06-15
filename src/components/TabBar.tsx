import { useStore } from '../store';
import { X } from 'lucide-react';

export function TabBar() {
  const { state, dispatch } = useStore();

  if (state.openTabs.length === 0) return null;

  return (
    <div className="flex shrink-0" style={{ height: 34, borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
      {state.openTabs.map(tabId => {
        const note = state.notes.find(n => n.id === tabId);
        if (!note) return null;
        const active = tabId === state.activeNoteId;
        return (
          <div key={tabId} className="flex items-center gap-1 cursor-pointer"
            style={{ padding: '0 12px', borderRight: '1px solid var(--border)', background: active ? 'var(--bg-elevated)' : 'var(--bg-base)', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', maxWidth: 180, minWidth: 108, transition: 'all 0.08s' }}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tabId })}>
            <span style={{ flex: 1, fontSize: 11, color: active ? 'var(--text)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {note.title}
            </span>
            <button onClick={e => { e.stopPropagation(); dispatch({ type: 'CLOSE_TAB', payload: tabId }); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, display: 'flex', borderRadius: 4 }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}>
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
