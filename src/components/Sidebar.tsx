import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { FileText, Folder, FolderOpen, ChevronRight, ChevronDown, Plus, FolderPlus, Search, Pin, Trash2, CalendarDays, Pencil } from 'lucide-react';

export function Sidebar() {
  const { state, dispatch, createNote, createFolder, openDailyNote } = useStore();
  const [search, setSearch] = useState('');
  const [ctx, setCtx] = useState<{ type: 'note' | 'folder'; id: string; x: number; y: number } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

  const filtered = search.trim()
    ? state.notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()))
    : state.notes;

  const pinnedNotes = filtered.filter(n => n.pinned);
  const rootNotes = filtered.filter(n => !n.folderId && !n.pinned);
  const folders = state.folders;

  const allTags = Array.from(new Set(state.notes.flatMap(n => {
    const matches = n.content.matchAll(/#(\w+)/g);
    return Array.from(matches, m => m[1]);
  })));

  return (
    <div className="animate-slide-right flex flex-col shrink-0"
      style={{ width: 268, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.03)' }}>

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <label htmlFor="sidebar-search" className="sr-only">Search notes in sidebar</label>
        <div className="flex items-center gap-2" style={{ padding: '6px 8px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 7, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}>
          <Search size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} aria-hidden="true" />
          <input 
            id="sidebar-search"
            type="text" 
            placeholder="Search notes..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            aria-label="Filter notes by title"
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, outline: 'none' }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1" style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <button 
          onClick={() => createNote()} 
          title="New note"
          aria-label="Create a new note"
          style={{ padding: '4px 9px', background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', fontSize: 11, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-focus)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
          <Plus size={11} /> Note
        </button>
        <button 
          onClick={() => setShowNewFolder(true)} 
          title="New folder"
          aria-label="Create a new folder"
          style={{ padding: '4px 9px', background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', fontSize: 11, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-focus)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
          <FolderPlus size={11} /> Folder
        </button>
        <button 
          onClick={() => openDailyNote()} 
          title="Daily note"
          aria-label="Open or create today's daily note"
          style={{ padding: '4px 9px', background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', fontSize: 11, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-focus)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
          <CalendarDays size={11} /> Daily
        </button>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #1a1a1a' }}>
          <input type="text" placeholder="Folder name..." value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newFolderName.trim()) { createFolder(newFolderName.trim()); setNewFolderName(''); setShowNewFolder(false); } if (e.key === 'Escape') setShowNewFolder(false); }}
            autoFocus
            style={{ width: '100%', padding: '4px 8px', background: '#080808', border: '1px solid #222', borderRadius: 4, color: '#bbb', fontSize: 12, outline: 'none' }} />
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '6px 0' }} onClick={() => setCtx(null)}>
        {/* Pinned */}
        {pinnedNotes.length > 0 && (
          <>
            <div style={{ padding: '4px 12px', fontSize: 10, fontWeight: 600, color: '#333', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pinned
            </div>
            {pinnedNotes.map(note => (
              <NoteItem key={note.id} note={note} active={note.id === state.activeNoteId}
                renaming={renamingNoteId === note.id}
                onRename={(newTitle) => { dispatch({ type: 'RENAME_NOTE', payload: { id: note.id, title: newTitle } }); setRenamingNoteId(null); }}
                onCancelRename={() => setRenamingNoteId(null)}
                onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })}
                onContext={(e) => { e.preventDefault(); setCtx({ type: 'note', id: note.id, x: e.clientX, y: e.clientY }); }} />
            ))}
          </>
        )}

        {/* Folders */}
        {folders.map(folder => {
          const notes = filtered.filter(n => n.folderId === folder.id);
          const isRenaming = renamingFolderId === folder.id;
          return (
            <div key={folder.id}>
              <div 
                className="flex items-center gap-1 cursor-pointer"
                aria-label={folder.name}
                style={{ padding: '4px 12px', color: '#666', fontSize: 12 }}
                onClick={() => !isRenaming && dispatch({ type: 'TOGGLE_FOLDER', payload: folder.id })}
                onContextMenu={e => { e.preventDefault(); setCtx({ type: 'folder', id: folder.id, x: e.clientX, y: e.clientY }); }}>
                {folder.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {folder.collapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
                
                {isRenaming ? (
                  <RenameInput 
                    initialValue={folder.name}
                    onSave={(newName) => { dispatch({ type: 'SET_STATE', payload: { ...state, folders: state.folders.map(f => f.id === folder.id ? { ...f, name: newName } : f) } }); setRenamingFolderId(null); }}
                    onCancel={() => setRenamingFolderId(null)}
                  />
                ) : (
                  <>
                    <span style={{ marginLeft: 4 }}>{folder.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#333' }}>{notes.length}</span>
                  </>
                )}
              </div>
              {!folder.collapsed && notes.map(note => (
                <NoteItem key={note.id} note={note} active={note.id === state.activeNoteId} indented
                  renaming={renamingNoteId === note.id}
                  onRename={(newTitle) => { dispatch({ type: 'RENAME_NOTE', payload: { id: note.id, title: newTitle } }); setRenamingNoteId(null); }}
                  onCancelRename={() => setRenamingNoteId(null)}
                  onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })}
                  onContext={(e) => { e.preventDefault(); setCtx({ type: 'note', id: note.id, x: e.clientX, y: e.clientY }); }} />
              ))}
            </div>
          );
        })}

        {/* Root notes */}
        {rootNotes.map(note => (
          <NoteItem key={note.id} note={note} active={note.id === state.activeNoteId}
            renaming={renamingNoteId === note.id}
            onRename={(newTitle) => { dispatch({ type: 'RENAME_NOTE', payload: { id: note.id, title: newTitle } }); setRenamingNoteId(null); }}
            onCancelRename={() => setRenamingNoteId(null)}
            onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })}
            onContext={(e) => { e.preventDefault(); setCtx({ type: 'note', id: note.id, x: e.clientX, y: e.clientY }); }} />
        ))}

        {/* Tags */}
        {allTags.length > 0 && (
          <>
            <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 600, color: '#333', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: '1px solid #1a1a1a', marginTop: 4, paddingTop: 8 }}>
              Tags
            </div>
            <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {allTags.slice(0, 12).map(tag => (
                <span key={tag} style={{ padding: '2px 6px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 3, fontSize: 10, color: '#555' }}>
                  #{tag}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Context menu */}
      {ctx && (
        <div 
          aria-label={ctx.type === 'note' ? 'Note options' : 'Folder options'}
          style={{ position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 300, background: '#111', border: '1px solid #222', borderRadius: 6, padding: '4px 0', minWidth: 140, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
          className="animate-scale-in">
          {ctx.type === 'note' && (
            <>
              <CtxItem icon={<Pencil size={12} />} label="Rename note" onClick={() => { setRenamingNoteId(ctx.id); setCtx(null); }} />
              <CtxItem icon={<Pin size={12} />} label="Toggle pin" onClick={() => { dispatch({ type: 'PIN_NOTE', payload: ctx.id }); setCtx(null); }} />
              <CtxItem icon={<Trash2 size={12} />} label="Delete note" onClick={() => { dispatch({ type: 'DELETE_NOTE', payload: ctx.id }); setCtx(null); }} />
            </>
          )}
          {ctx.type === 'folder' && (
            <>
              <CtxItem icon={<Pencil size={12} />} label="Rename folder" onClick={() => { setRenamingFolderId(ctx.id); setCtx(null); }} />
              <CtxItem icon={<Plus size={12} />} label="New note here" onClick={() => { createNote(ctx.id); setCtx(null); }} />
              <CtxItem icon={<Trash2 size={12} />} label="Delete folder" onClick={() => { dispatch({ type: 'DELETE_FOLDER', payload: ctx.id }); setCtx(null); }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NoteItem({ note, active, indented, renaming, onClick, onContext, onRename, onCancelRename }: { note: { id: string; title: string }; active: boolean; indented?: boolean; renaming?: boolean; onClick: () => void; onContext: (e: React.MouseEvent) => void; onRename?: (title: string) => void; onCancelRename?: () => void; }) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/flint-note-id', note.id);
    e.dataTransfer.setData('text/flint-note-title', note.title);
    e.dataTransfer.setData('text/plain', `[[${note.title}]]`);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex items-center gap-2 cursor-pointer"
      role="treeitem"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      draggable={!renaming}
      style={{ padding: '5px 12px', paddingLeft: indented ? 28 : 12, background: active ? '#232934' : 'transparent', borderLeft: active ? '2px solid #93a4c0' : '2px solid transparent', transition: 'all 0.08s' }}
      onClick={() => !renaming && onClick()}
      onDragStart={handleDragStart}
      onContextMenu={onContext}
      onMouseEnter={e => { if (!active && !renaming) e.currentTarget.style.background = '#1d222b'; }}
      onMouseLeave={e => { if (!active && !renaming) e.currentTarget.style.background = 'transparent'; }}>
      <FileText size={13} style={{ color: active ? '#c7d1de' : '#7b8698', flexShrink: 0 }} aria-hidden="true" />
      {renaming ? (
        <RenameInput initialValue={note.title} onSave={onRename!} onCancel={onCancelRename!} />
      ) : (
        <span style={{ fontSize: 12, color: active ? '#eef2f8' : '#b0b9c8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{note.title}</span>
      )}
    </div>
  );
}

function RenameInput({ initialValue, onSave, onCancel }: { initialValue: string; onSave: (val: string) => void; onCancel: () => void; }) {
  const [val, setVal] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input 
      ref={inputRef}
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSave(val.trim() || initialValue);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => onSave(val.trim() || initialValue)}
      onClick={e => e.stopPropagation()}
      style={{
        flex: 1, padding: '2px 4px', background: '#0a0a0a', border: '1px solid #333', 
        borderRadius: 4, color: '#fff', fontSize: 12, outline: 'none', marginLeft: 2
      }}
    />
  );
}

function CtxItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void; }) {
  return (
    <button 
      className="flex items-center gap-2 cursor-pointer"
      style={{ padding: '5px 12px', fontSize: 12, color: '#999', transition: 'background 0.08s', background: 'transparent', border: 'none', width: '100%', textAlign: 'left' }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      {icon} {label}
    </button>
  );
}
