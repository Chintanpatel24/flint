import { useMemo } from 'react';
import { useStore } from '../../store';
import { parseMarkdown } from '../../utils/markdown';

export function Preview({ noteId }: { noteId: string }) {
  const { state, dispatch, getNoteByTitle } = useStore();
  const note = state.notes.find(n => n.id === noteId);

  const html = useMemo(() => {
    if (!note) return '';
    return parseMarkdown(note.content, getNoteByTitle);
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
