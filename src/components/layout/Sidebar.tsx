import { useState } from 'react';
import { useStore } from '../../store';
import { useTranslation } from 'react-i18next';
import {
  Plus, FolderPlus, Pin, Folder, Tag, Calendar as CalendarIcon,
  ChevronRight, ChevronDown, MoreVertical, Trash2, Edit3
} from 'lucide-react';
import { Calendar } from './Calendar';

export function Sidebar() {
  const { t } = useTranslation();
  const { state, dispatch, createNote, createFolder } = useStore();
  const [showCalendar, setShowCalendar] = useState(false);

  const pinnedNotes = state.notes.filter(n => n.pinned);

  return (
    <div className="w-64 bg-[#080808] border-r border-[#1a1a1a] flex flex-col shrink-0">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => createNote()} className="flex-1 flex items-center justify-center gap-2 bg-[#111] hover:bg-[#181818] text-[#888] text-[11px] font-bold py-2 rounded-lg border border-[#1a1a1a] transition-colors uppercase tracking-widest">
            <Plus size={14} /> {t('common.newNote')}
          </button>
          <button onClick={() => createFolder('New Folder')} className="p-2 bg-[#111] hover:bg-[#181818] text-[#444] hover:text-[#888] rounded-lg border border-[#1a1a1a] transition-colors">
            <FolderPlus size={14} />
          </button>
        </div>

        <button onClick={() => setShowCalendar(!showCalendar)} className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${showCalendar ? 'text-[#4a9eff]' : 'text-[#333] hover:text-[#666]'}`}>
          <CalendarIcon size={14} /> {t('sidebar.calendar')}
        </button>
        {showCalendar && <div className="animate-fade-in"><Calendar /></div>}

        <div className="flex flex-col gap-6">
          {pinnedNotes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#222] mb-3">{t('sidebar.pinned')}</div>
              <div className="flex flex-col gap-1">
                {pinnedNotes.map(n => (
                  <SidebarItem key={n.id} icon={<Pin size={12} />} title={n.title} active={state.activeNoteId === n.id} onClick={() => dispatch({ type: 'OPEN_TAB', payload: n.id })} />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#222] mb-3">{t('sidebar.folders')}</div>
            <div className="flex flex-col gap-1">
              {state.folders.map(f => (
                <FolderItem key={f.id} folder={f} />
              ))}
              {state.notes.filter(n => !n.folderId && !n.pinned).map(n => (
                <SidebarItem key={n.id} title={n.title} active={state.activeNoteId === n.id} onClick={() => dispatch({ type: 'OPEN_TAB', payload: n.id })} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ icon, title, active, onClick }: { icon?: React.ReactNode; title: string; active?: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors group ${active ? 'bg-[#111] text-[#888]' : 'hover:bg-[#0a0a0a] text-[#444] hover:text-[#666]'}`}>
      {icon}
      <span className="text-[11px] font-medium truncate flex-1">{title}</span>
    </div>
  );
}

function FolderItem({ folder }: { folder: any }) {
  const { t } = useTranslation();
  const { state, dispatch } = useStore();
  const notes = state.notes.filter(n => n.folderId === folder.id);

  return (
    <div>
      <div onClick={() => dispatch({ type: 'TOGGLE_FOLDER', payload: folder.id })} className="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer hover:bg-[#0a0a0a] text-[#333] hover:text-[#555] transition-colors group">
        {folder.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <Folder size={12} />
        <span className="text-[11px] font-bold uppercase tracking-wider flex-1 truncate">{folder.name}</span>
        <span className="text-[9px] text-[#222] group-hover:text-[#333] transition-colors">{notes.length}</span>
      </div>
      {!folder.collapsed && (
        <div className="pl-6 flex flex-col gap-1 mt-1">
          {notes.map(n => (
            <SidebarItem key={n.id} title={n.title} active={state.activeNoteId === n.id} onClick={() => dispatch({ type: 'OPEN_TAB', payload: n.id })} />
          ))}
        </div>
      )}
    </div>
  );
}
