import { useEffect, useState } from 'react';
import { useStore } from './store';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './components/layout/Sidebar';
import { TabBar } from './components/layout/TabBar';
import { Editor } from './components/editor/Editor';
import { Preview } from './components/editor/Preview';
import { TiptapEditor } from './components/editor/TiptapEditor';
import { GraphView } from './components/graph/GraphView';
import { CanvasView } from './components/canvas/CanvasView';
import { SearchModal } from './components/layout/SearchModal';
import { QuickSwitcher } from './components/layout/QuickSwitcher';
import { CommandPalette } from './components/layout/CommandPalette';
import { StatusBar } from './components/layout/StatusBar';
import { BacklinksPanel } from './components/layout/BacklinksPanel';
import { VaultScreen } from './components/VaultScreen';
import { SettingsPanel } from './components/layout/Settings';
import { AIChat } from './components/layout/AIChat';
import { FlintLogo } from './components/FlintLogo';
import {
  PanelLeftOpen, PenLine, Eye, Columns2, X,
  PanelRightOpen, PanelRightClose, Plus, Waypoints, Search,
  Bold, Italic, Code, List, Link2, Heading2, Quote,
  Command, Brain, CalendarDays, LayoutGrid, Hash, Brackets
} from 'lucide-react';

function AppContent() {
  const { t } = useTranslation();
  const { state, dispatch, createNote, openDailyNote } = useStore();
  const { activeNoteId, secondaryNoteId, viewMode, showGraphView, showCanvasView, showSearch, showCommandPalette, showQuickSwitcher, sidebarOpen, rightPanelOpen, activeVaultId, settingsOpen, showAIChat } = state;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') { e.preventDefault(); dispatch({ type: 'TOGGLE_SEARCH' }); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); createNote(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); openDailyNote(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); dispatch({ type: 'TOGGLE_GRAPH_VIEW' }); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); dispatch({ type: 'TOGGLE_CANVAS_VIEW' }); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); dispatch({ type: 'TOGGLE_QUICK_SWITCHER' }); }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); dispatch({ type: 'TOGGLE_SIDEBAR' }); }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); dispatch({ type: 'TOGGLE_SETTINGS' }); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') { e.preventDefault(); dispatch({ type: 'TOGGLE_AI_CHAT' }); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, createNote, openDailyNote, viewMode]);

  if (!activeVaultId) return <VaultScreen />;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#050505] text-[#888]">
      <div className="flex-1 flex min-h-0">

        {/* Ribbon */}
        <div className="flex flex-col items-center py-4 gap-4 shrink-0 w-12 bg-[#080808] border-r border-[#1a1a1a]">
          <FlintLogo size={20} />
          <div className="flex-1 flex flex-col items-center gap-2">
            <RibbonBtn icon={<PanelLeftOpen size={16} />} active={sidebarOpen} onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })} title={t('common.toggleSidebar')} />
            <RibbonBtn icon={<Search size={16} />} onClick={() => dispatch({ type: 'TOGGLE_SEARCH' })} title={t('common.search')} />
            <RibbonBtn icon={<Plus size={16} />} onClick={() => createNote()} title={t('common.newNote')} />
            <RibbonBtn icon={<CalendarDays size={16} />} onClick={() => openDailyNote()} title={t('common.dailyNote')} />
            <RibbonBtn icon={<Waypoints size={16} />} active={showGraphView} onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })} title={t('common.graph')} />
            <RibbonBtn icon={<LayoutGrid size={16} />} active={showCanvasView} onClick={() => dispatch({ type: 'TOGGLE_CANVAS_VIEW' })} title={t('common.canvas')} />
            <RibbonBtn icon={<Brain size={16} />} active={showAIChat} onClick={() => dispatch({ type: 'TOGGLE_AI_CHAT' })} title={t('common.aiChat')} />
          </div>
          <RibbonBtn icon={<Settings size={16} />} onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })} title={t('common.settings')} />
        </div>

        {/* Sidebar */}
        {sidebarOpen && <Sidebar />}

        {/* Center */}
        <div className="flex-1 flex min-w-0 bg-[#000]">
          <NotePane
            noteId={activeNoteId}
            onToggleSplit={() => dispatch({ type: 'SET_SECONDARY_TAB', payload: secondaryNoteId ? null : activeNoteId })}
            isSplit={!!secondaryNoteId}
          />
          {secondaryNoteId && (
            <NotePane
              noteId={secondaryNoteId}
              isSecondary
              onClose={() => dispatch({ type: 'SET_SECONDARY_TAB', payload: null })}
            />
          )}
        </div>

        {/* Right panel */}
        {rightPanelOpen && activeNoteId && <BacklinksPanel noteId={activeNoteId} />}

        {/* AI Chat panel */}
        {showAIChat && <AIChat />}
      </div>

      <StatusBar />
      {showGraphView && <GraphView />}
      {showCanvasView && <CanvasView />}
      {showSearch && <SearchModal />}
      {showCommandPalette && <CommandPalette />}
      {showQuickSwitcher && <QuickSwitcher />}
      {settingsOpen && <SettingsPanel />}
    </div>
  );
}

function NotePane({ noteId, isSplit, onToggleSplit, isSecondary, onClose }: { noteId: string | null; isSplit?: boolean; onToggleSplit?: () => void; isSecondary?: boolean; onClose?: () => void }) {
  const { t } = useTranslation();
  const { state, dispatch, createNote } = useStore();
  const activeNote = state.notes.find(n => n.id === noteId);
  const { viewMode } = state;

  if (!noteId || !activeNote) return (
    <div className="flex-1 flex items-center justify-center bg-black text-[#222]">{t('common.noNoteSelected')}</div>
  );

  return (
    <div className={`flex-1 flex flex-col min-w-0 ${isSecondary ? 'border-l border-[#1a1a1a]' : ''}`}>
      {/* Note title bar */}
      <div className="flex items-center px-4 h-9 border-b border-[#1a1a1a] bg-[#080808]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#444] flex-1">{activeNote.title}</span>
        <div className="flex items-center gap-2">
          {onToggleSplit && <button onClick={onToggleSplit} className={`p-1 rounded ${isSplit ? 'text-[#4a9eff]' : 'text-[#333]'}`}><Columns2 size={14}/></button>}
          {isSecondary && <button onClick={onClose} className="text-[#333]"><X size={14}/></button>}
          <div className="w-[1px] h-4 bg-[#1a1a1a] mx-1" />
          <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'edit' })} className={`text-[10px] uppercase font-bold px-2 ${viewMode==='edit'?'text-[#888]':'text-[#333]'}`}>{t('common.edit')}</button>
          <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'preview' })} className={`text-[10px] uppercase font-bold px-2 ${viewMode==='preview'?'text-[#888]':'text-[#333]'}`}>{t('common.preview')}</button>
          <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'split' })} className={`text-[10px] uppercase font-bold px-2 ${viewMode==='split'?'text-[#888]':'text-[#333]'}`}>{t('common.split')}</button>
        </div>
      </div>

      <TabBar />

      <div className="flex-1 min-h-0 flex">
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={viewMode === 'split' ? 'w-1/2 border-r border-[#1a1a1a]' : 'flex-1'}><Editor noteId={noteId} /></div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="flex-1 overflow-auto"><Preview noteId={noteId} /></div>
        )}
      </div>
    </div>
  );
}

function RibbonBtn({ icon, onClick, active, title }: { icon: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button onClick={onClick} title={title} className={`p-2 rounded-lg transition-colors ${active ? 'bg-[#111] text-[#4a9eff]' : 'text-[#333] hover:text-[#888]'}`}>
      {icon}
    </button>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
