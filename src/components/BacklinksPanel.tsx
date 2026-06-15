import { useStore } from '../store';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export function BacklinksPanel({ noteId }: { noteId: string }) {
  const { state, dispatch, getBacklinks, getOutgoingLinks } = useStore();
  const note = state.notes.find(n => n.id === noteId);
  const backlinks = getBacklinks(noteId);
  const outgoing = getOutgoingLinks(noteId);

  // Extract headings
  const headings = note ? note.content.match(/^#{1,4} (.+)$/gm)?.map(h => {
    const level = h.match(/^(#+)/)?.[1].length || 1;
    return { text: h.replace(/^#+ /, ''), level };
  }) || [] : [];

  if (!note) return null;

  const LinkItem = ({ n, icon }: { n: { id: string; title: string }; icon: React.ReactNode }) => (
    <div className="flex items-center gap-2 cursor-pointer"
      style={{ padding: '4px 8px', borderRadius: 4, transition: 'all 0.08s' }}
      onClick={() => dispatch({ type: 'OPEN_TAB', payload: n.id })}
      onMouseEnter={e => { e.currentTarget.style.background = '#141414'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      {icon}
      <span style={{ fontSize: 12, color: '#888' }}>{n.title}</span>
    </div>
  );

  return (
    <div className="animate-slide-right flex flex-col shrink-0"
      style={{ width: 250, background: '#0d0d0d', borderLeft: '1px solid #1a1a1a', overflow: 'auto' }}>

      {/* Outline */}
      {headings.length > 0 && (
        <div style={{ padding: '12px 12px 8px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#333', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Outline</div>
          {headings.map((h, i) => (
            <div key={i} style={{ paddingLeft: (h.level - 1) * 10, fontSize: 11, color: '#555', padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {h.text}
            </div>
          ))}
        </div>
      )}

      {/* Backlinks */}
      <div style={{ padding: '8px 12px', borderTop: headings.length ? '1px solid #1a1a1a' : 'none' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#333', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Backlinks ({backlinks.length})
        </div>
        {backlinks.length === 0 && <div style={{ fontSize: 11, color: '#333' }}>No backlinks yet</div>}
        {backlinks.map(n => <LinkItem key={n.id} n={n} icon={<ArrowLeft size={11} style={{ color: '#333' }} />} />)}
      </div>

      {/* Outgoing */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1a1a1a' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#333', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Outgoing ({outgoing.length})
        </div>
        {outgoing.length === 0 && <div style={{ fontSize: 11, color: '#333' }}>No outgoing links</div>}
        {outgoing.map(n => <LinkItem key={n.id} n={n} icon={<ArrowRight size={11} style={{ color: '#333' }} />} />)}
      </div>
    </div>
  );
}
