import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { useTranslation } from 'react-i18next';
import {
  Plus, CalendarDays, FolderPlus, Waypoints, LayoutGrid, Search,
  PenLine, Eye, Columns2, PanelLeftOpen, PanelRightOpen, Settings, Brain, Command
} from 'lucide-react';

export function CommandPalette() {
  const { t } = useTranslation();
  const { dispatch, createNote, createFolder, openDailyNote } = useStore();
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = [
    { icon: <Plus size={14} />, label: t('common.newNote'), action: () => { createNote(); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <CalendarDays size={14} />, label: t('common.dailyNote'), action: () => { openDailyNote(); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <FolderPlus size={14} />, label: t('common.newFolder'), action: () => { createFolder('New Folder'); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <Waypoints size={14} />, label: t('command.openGraph'), action: () => { dispatch({ type: 'TOGGLE_GRAPH_VIEW' }); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <LayoutGrid size={14} />, label: t('command.openCanvas'), action: () => { dispatch({ type: 'TOGGLE_CANVAS_VIEW' }); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <Search size={14} />, label: t('common.search'), action: () => { dispatch({ type: 'TOGGLE_SEARCH' }); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <PenLine size={14} />, label: t('common.edit'), action: () => { dispatch({ type: 'SET_VIEW_MODE', payload: 'edit' }); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <Eye size={14} />, label: t('common.preview'), action: () => { dispatch({ type: 'SET_VIEW_MODE', payload: 'preview' }); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <Columns2 size={14} />, label: t('common.split'), action: () => { dispatch({ type: 'SET_VIEW_MODE', payload: 'split' }); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <PanelLeftOpen size={14} />, label: t('common.toggleSidebar'), action: () => { dispatch({ type: 'TOGGLE_SIDEBAR' }); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <PanelRightOpen size={14} />, label: t('common.toggleRightPanel'), action: () => { dispatch({ type: 'TOGGLE_RIGHT_PANEL' }); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <Settings size={14} />, label: t('command.openSettings'), action: () => { dispatch({ type: 'TOGGLE_SETTINGS' }); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
    { icon: <Brain size={14} />, label: t('common.aiChat'), action: () => { dispatch({ type: 'TOGGLE_AI_CHAT' }); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); } },
  ];

  const filtered = query.trim() ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase())) : commands;

  useEffect(() => { inputRef.current?.focus(); setIdx(0); }, [query]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[idx]) filtered[idx].action();
    if (e.key === 'Escape') dispatch({ type: 'TOGGLE_COMMAND_PALETTE' });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100 }}
      onClick={() => dispatch({ type: 'TOGGLE_COMMAND_PALETTE' })}>
      <div className="animate-scale-in" style={{ width: 440, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #1a1a1a' }}>
          <Command size={14} style={{ color: '#444' }} />
          <input ref={inputRef} type="text" placeholder={t('command.typeCommand')} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKey}
            style={{ flex: 1, background: 'none', border: 'none', color: '#bbb', fontSize: 14, outline: 'none' }} />
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {filtered.map((cmd, i) => (
            <div key={cmd.label}
              className="flex items-center gap-3 cursor-pointer"
              style={{ padding: '8px 14px', background: i === idx ? '#141414' : 'transparent', color: i === idx ? '#bbb' : '#555', fontSize: 13, transition: 'background 0.08s' }}
              onMouseEnter={() => setIdx(i)}
              onClick={() => cmd.action()}>
              {cmd.icon} {cmd.label}
            </div>
          ))}
        </div>
        <div style={{ padding: '6px 14px', borderTop: '1px solid #1a1a1a', fontSize: 10, color: '#333', display: 'flex', gap: 12 }}>
          <span>↑↓ Navigate</span><span>↵ Execute</span><span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
