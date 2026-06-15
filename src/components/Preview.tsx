import { useMemo } from 'react';
import { useStore } from '../store';

export function Preview({ noteId }: { noteId: string }) {
  const { state, dispatch, getNoteByTitle } = useStore();
  const note = state.notes.find(n => n.id === noteId);

  const html = useMemo(() => {
    if (!note) return '';
    let md = note.content;

    // Escape HTML
    md = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Code blocks
    md = md.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Inline code
    md = md.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Wiki links
    md = md.replace(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (_: string, target: string, display?: string) => {
      const found = getNoteByTitle(target);
      const cls = found ? 'wiki-link' : 'wiki-link unresolved';
      const text = display || target;
      return `<a class="${cls}" data-target="${target}">${text}</a>`;
    });

    // Images
    md = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');

    // Links
    md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Headers
    md = md.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    md = md.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    md = md.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    md = md.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold
    md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    md = md.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Strikethrough
    md = md.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Blockquotes
    md = md.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Horizontal rule
    md = md.replace(/^---$/gm, '<hr />');

    // Task lists
    md = md.replace(/^- \[x\] (.+)$/gm, '<div style="display:flex;align-items:flex-start;gap:6px;margin:2px 0"><input type="checkbox" checked disabled /><span>$1</span></div>');
    md = md.replace(/^- \[ \] (.+)$/gm, '<div style="display:flex;align-items:flex-start;gap:6px;margin:2px 0"><input type="checkbox" disabled /><span>$1</span></div>');

    // Unordered lists
    md = md.replace(/^- (.+)$/gm, '<li>$1</li>');

    // Ordered lists
    md = md.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Tags
    md = md.replace(/#(\w+)/g, '<span style="color:#555;font-size:0.9em">#$1</span>');

    // Tables
    md = md.replace(/^\|(.+)\|$/gm, (match: string) => {
      if (match.match(/^\|[\s-|]+\|$/)) return '';
      const cells = match.split('|').filter(c => c.trim());
      const isHeader = false;
      const tag = isHeader ? 'th' : 'td';
      return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
    });

    // Wrap in table
    md = md.replace(/((<tr>.*<\/tr>\n?)+)/g, '<table>$1</table>');

    // Paragraphs — wrap loose text
    md = md.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>');

    // Merge consecutive blockquotes
    md = md.replace(/<\/blockquote>\n<blockquote>/g, '<br />');

    return md;
  }, [note?.content, getNoteByTitle]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest('.wiki-link');
    if (link) {
      const title = link.getAttribute('data-target');
      if (title) {
        const found = getNoteByTitle(title);
        if (found) dispatch({ type: 'OPEN_TAB', payload: found.id });
      }
    }
  };

  if (!note) return null;

  return <div className="flint-preview" dangerouslySetInnerHTML={{ __html: html }} onClick={handleClick} />;
}
