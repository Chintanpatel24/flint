import { createContext, useContext, useReducer, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { Note, Folder, Vault, AppState, ChatMessage, AISettings, VaultWorkspace } from './types';

const STORAGE_KEY = 'flint-data';
const SUPPORTED_AI_PROVIDERS = ['ollama', 'openai', 'gemini', 'openai-compatible', 'local-gguf'] as const;

const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  apiKey: '',
  apiBaseUrl: '',
  localModelPath: '',
  localModelContext: 2048,
  localModelThreads: 4,
  maxOutputTokens: 180,
  model: '',
  maxContextNotes: 8,
  temperature: 0.7,
  internetAccess: true,
  systemPrompt: 'You are Flint AI, an intelligent assistant embedded in the Flint note-taking app. You have access to the user\'s notes as your memory. Use this knowledge to provide helpful, contextual answers. When referencing notes, mention them by name. Think carefully based on the connected notes.',
};

function generateId() { return Math.random().toString(36).substring(2, 11) + Date.now().toString(36); }

function isSupportedProvider(v: unknown): v is AISettings['provider'] {
  return typeof v === 'string' && (SUPPORTED_AI_PROVIDERS as readonly string[]).includes(v);
}

function normalizeAISettings(raw: unknown): AISettings {
  const partial = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<AISettings> & { provider?: unknown };
  const merged: AISettings = { ...DEFAULT_AI_SETTINGS, ...partial };
  if (!isSupportedProvider(partial.provider)) {
    merged.provider = 'ollama';
  }
  return merged;
}

function buildWorkspace(notes: Note[], folders: Folder[], openTabs?: string[], activeNoteId?: string | null, hasFolderHandle = false, canvasCards: CanvasCard[] = []): VaultWorkspace {
  const firstNoteId = notes[0]?.id || null;
  const normalizedTabs = (openTabs || []).filter(id => notes.some(note => note.id === id));
  const fallbackTabs = normalizedTabs.length ? normalizedTabs : firstNoteId ? [firstNoteId] : [];
  const fallbackActive = activeNoteId && notes.some(note => note.id === activeNoteId)
    ? activeNoteId
    : fallbackTabs[0] || null;

  return {
    notes,
    folders,
    openTabs: fallbackTabs,
    activeNoteId: fallbackActive,
    hasFolderHandle,
    canvasCards,
  };
}

function syncActiveVaultState(state: AppState): AppState {
  if (!state.activeVaultId) {
    return {
      ...state,
      notes: [],
      folders: [],
      openTabs: [],
      activeNoteId: null,
      hasFolderHandle: false,
    };
  }

  const workspace = state.vaultData[state.activeVaultId] || buildWorkspace([], []);
  return {
    ...state,
    notes: workspace.notes,
    folders: workspace.folders,
    openTabs: workspace.openTabs,
    activeNoteId: workspace.activeNoteId,
    hasFolderHandle: workspace.hasFolderHandle,
  };
}

function updateCurrentWorkspace(state: AppState, updater: (workspace: VaultWorkspace) => VaultWorkspace): AppState {
  if (!state.activeVaultId) return state;
  const current = state.vaultData[state.activeVaultId] || buildWorkspace([], []);
  const updated = updater(current);
  const nextWorkspace = buildWorkspace(
    updated.notes,
    updated.folders,
    updated.openTabs,
    updated.activeNoteId,
    updated.hasFolderHandle,
    updated.canvasCards,
  );
  const nextState = {
    ...state,
    vaultData: {
      ...state.vaultData,
      [state.activeVaultId]: nextWorkspace,
    },
  };
  return syncActiveVaultState(nextState);
}

function saveState(state: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn('Save failed:', e); }
}

function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed && parsed.vaults) {
      const notes = parsed.notes || [];
      const folders = parsed.folders || [];
      const openTabs = parsed.openTabs || [];
      const activeVaultId = parsed.activeVaultId || parsed.vaults[0]?.id || null;
      const legacyWorkspace = buildWorkspace(notes, folders, openTabs, parsed.activeNoteId || null, false);
      const savedVaultData = parsed.vaultData || {};
      const vaultData = Object.fromEntries(
        parsed.vaults.map(vault => {
          const workspace = savedVaultData[vault.id];
          return [vault.id, buildWorkspace(
            workspace?.notes || (vault.id === activeVaultId ? notes : []),
            workspace?.folders || (vault.id === activeVaultId ? folders : []),
            workspace?.openTabs || (vault.id === activeVaultId ? openTabs : []),
            workspace?.activeNoteId || (vault.id === activeVaultId ? parsed.activeNoteId || null : null),
            false,
            workspace?.canvasCards || [],
          )];
        })
      ) as Record<string, VaultWorkspace>;

      if (activeVaultId && !vaultData[activeVaultId]) {
        vaultData[activeVaultId] = legacyWorkspace;
      }

      const baseState: AppState = {
        vaults: parsed.vaults,
        vaultData,
        activeVaultId,
        notes: [],
        folders: [],
        openTabs: [],
        activeNoteId: null,
        viewMode: parsed.viewMode || 'edit',
        sidebarOpen: parsed.sidebarOpen ?? true,
        rightPanelOpen: parsed.rightPanelOpen ?? false,
        showGraphView: false,
        showCanvasView: false,
        showSearch: false,
        showCommandPalette: false,
        settingsOpen: false,
        showAIChat: parsed.showAIChat ?? false,
        aiMessages: parsed.aiMessages || [],
        aiSettings: normalizeAISettings(parsed.aiSettings),
        hasFolderHandle: false,
      };
      return syncActiveVaultState(baseState);
    }
  } catch { /* ignore */ }
  return null;
}

const DEMO_NOTES: Note[] = [
  {
    id: 'n1', title: 'Welcome to Flint', folderId: null, pinned: true,
    content: `# Welcome to Flint

Flint is your **secure, local knowledge base** — all data stays on your device.

## Getting Started

- Create new notes with **Ctrl+N** or the **+** button
- Link notes with \`[[Note Name]]\` syntax
- Visualize connections in **Graph View** (Ctrl+G)
- Search all notes with **Ctrl+Shift+F**
- Command palette with **Ctrl+P**

## Key Features

- **Wiki Links**: \`[[note name]]\` connects notes
- **Graph View**: Visual knowledge network
- **Auto-Save**: Automatic & persistent
- **Tags**: Use #welcome #getting-started
- **Markdown**: Full support with live preview
- **Local Only**: 100% offline, zero cloud

## Explore

- [[Markdown Basics]] — Formatting guide
- [[Project Ideas]] — Brainstorming notes
- [[Daily Notes]] — Journal template
- [[Reading List]] — Books & articles
- [[Architecture Notes]] — Software design

> "The only way to do great work is to love what you do."`,
    createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 3600000,
  },
  {
    id: 'n2', title: 'Markdown Basics', folderId: null, pinned: false,
    content: `# Markdown Basics

A quick reference for Markdown formatting in Flint.

## Text Formatting

- **Bold** text with \`**bold**\`
- *Italic* text with \`*italic*\`
- ~~Strikethrough~~ with \`~~text~~\`
- Inline \`code\` with backticks

## Lists

1. First item
2. Second item
3. Third item

- Unordered item
- Another item
  - Nested item

## Task Lists

- [x] Learn Markdown
- [x] Install Flint
- [ ] Create a knowledge graph
- [ ] Write daily notes

## Links

Internal links: [[Welcome to Flint]]
More: [[Project Ideas]] and [[Daily Notes]]
Also: [[Reading List]] and [[Architecture Notes]]

#markdown #reference #formatting`,
    createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 7200000,
  },
  {
    id: 'n3', title: 'Project Ideas', folderId: 'f1', pinned: false,
    content: `# Project Ideas

A collection of project ideas and brainstorming notes.

## Web Development

- Personal portfolio with 3D elements
- Real-time collaboration tool
- Knowledge management system like [[Welcome to Flint]]

## Learning Goals

- [ ] Deep dive into TypeScript
- [ ] Learn WebGL / Three.js
- [ ] Master [[Markdown Basics]] for documentation

## Connections

- [[Welcome to Flint]] — The tool itself
- [[Daily Notes]] — Track progress daily
- [[Architecture Notes]] — Design patterns

## Priority Matrix

| Project | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Portfolio | High | Medium | Do first |
| Collab Tool | High | High | Plan |
| Knowledge App | Medium | Low | Quick win |

#projects #ideas #brainstorm`,
    createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 10800000,
  },
  {
    id: 'n4', title: 'Daily Notes', folderId: 'f1', pinned: false,
    content: `# Daily Notes

A journaling template for daily reflections.

## Template

### Morning
- [ ] Review goals
- [ ] Plan the day
- [ ] Read for 30 minutes

### Afternoon
- [ ] Deep work session
- [ ] Review [[Project Ideas]]
- [ ] Take notes on learnings

### Evening
- [ ] Reflect on the day
- [ ] Update task list
- [ ] Plan tomorrow

## Recent Entries

### Today
Worked on Flint — improving the graph view.
Connected notes: [[Welcome to Flint]] and [[Markdown Basics]].

### Yesterday
Researched force-directed graph layouts.
Found interesting patterns in [[Project Ideas]].

---

> "A day without learning is a day wasted."

#daily #journal #template`,
    createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 14400000,
  },
  {
    id: 'n5', title: 'Reading List', folderId: 'f2', pinned: false,
    content: `# Reading List

Books and articles to read.

## Currently Reading

- **"Atomic Habits"** by James Clear
  - Key takeaway: Small habits, remarkable results
  - See [[Daily Notes]] for habit tracking

## Up Next

- "Thinking, Fast and Slow" by Daniel Kahneman
- "The Pragmatic Programmer"
- "Designing Data-Intensive Applications"

## Completed

- [x] "Deep Work" by Cal Newport
- [x] "Getting Things Done" by David Allen

## Articles

- Understanding knowledge graphs
- The Zettelkasten method → relates to [[Welcome to Flint]]
- Spaced repetition systems

#reading #books #learning`,
    createdAt: Date.now() - 86400000, updatedAt: Date.now() - 18000000,
  },
  {
    id: 'n6', title: 'Architecture Notes', folderId: 'f2', pinned: false,
    content: `# Architecture Notes

Notes on software architecture and design patterns.

## Patterns

### MVC (Model-View-Controller)
- Separation of concerns
- Used in web frameworks

### Observer Pattern
- Event-driven architecture
- Pub/Sub systems

## System Design

- Microservices vs Monolith
- Database selection criteria
- Caching strategies

## Links

- [[Project Ideas]] — Implementation ideas
- [[Markdown Basics]] — Documentation format
- [[Reading List]] — Books on architecture

#architecture #design #patterns`,
    createdAt: Date.now() - 86400000 * 1.5, updatedAt: Date.now() - 20000000,
  },
];

const DEMO_FOLDERS: Folder[] = [
  { id: 'f1', name: 'Projects', parentId: null, collapsed: false },
  { id: 'f2', name: 'Resources', parentId: null, collapsed: false },
];

const DEFAULT_VAULT: Vault = {
  id: 'v1', name: 'My Vault', color: '#888', createdAt: Date.now() - 86400000 * 5, lastOpened: Date.now(),
};

function getInitialState(): AppState {
  const saved = loadState();
  if (saved && saved.vaults && saved.vaults.length > 0 && saved.activeVaultId) return saved;
  const defaultWorkspace = buildWorkspace(DEMO_NOTES, DEMO_FOLDERS, ['n1'], 'n1', false);
  return {
    vaults: [DEFAULT_VAULT],
    vaultData: { v1: defaultWorkspace },
    activeVaultId: 'v1',
    notes: defaultWorkspace.notes,
    folders: defaultWorkspace.folders,
    openTabs: defaultWorkspace.openTabs,
    activeNoteId: defaultWorkspace.activeNoteId,
    viewMode: 'edit',
    sidebarOpen: true,
    rightPanelOpen: false,
    showGraphView: false,
    showCanvasView: false,
    showSearch: false,
    showCommandPalette: false,
    settingsOpen: false,
    showAIChat: false,
    aiMessages: [],
    aiSettings: DEFAULT_AI_SETTINGS,
    hasFolderHandle: false,
  };
}

type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'CREATE_VAULT'; payload: { id: string; name: string; color: string } }
  | { type: 'OPEN_VAULT'; payload: string }
  | { type: 'CLOSE_VAULT' }
  | { type: 'DELETE_VAULT'; payload: string }
  | { type: 'OPEN_TAB'; payload: string }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'UPDATE_NOTE'; payload: { id: string; content: string } }
  | { type: 'RENAME_NOTE'; payload: { id: string; title: string } }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'PIN_NOTE'; payload: string }
  | { type: 'ADD_FOLDER'; payload: Folder }
  | { type: 'DELETE_FOLDER'; payload: string }
  | { type: 'TOGGLE_FOLDER'; payload: string }
  | { type: 'SET_VIEW_MODE'; payload: 'edit' | 'preview' | 'split' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_RIGHT_PANEL' }
  | { type: 'TOGGLE_GRAPH_VIEW' }
  | { type: 'TOGGLE_CANVAS_VIEW' }
  | { type: 'TOGGLE_SEARCH' }
  | { type: 'TOGGLE_COMMAND_PALETTE' }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_AI_CHAT' }
  | { type: 'ADD_AI_MESSAGE'; payload: ChatMessage }
  | { type: 'CLEAR_AI_MESSAGES' }
  | { type: 'UPDATE_AI_SETTINGS'; payload: Partial<AISettings> }
  | { type: 'IMPORT_NOTES'; payload: { notes: Note[]; folders: Folder[] } }
  | { type: 'SET_FOLDER_HANDLE'; payload: boolean }
  | { type: 'CREATE_FOLDER_VAULT'; payload: { id: string; name: string; color: string; folderPath: string } }
  | { type: 'UPDATE_CANVAS_CARDS'; payload: CanvasCard[] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE': return syncActiveVaultState(action.payload);
    case 'CREATE_VAULT': {
      const vault: Vault = { id: action.payload.id, name: action.payload.name, color: action.payload.color, createdAt: Date.now(), lastOpened: Date.now() };
      return {
        ...state,
        vaults: [...state.vaults, vault],
        vaultData: {
          ...state.vaultData,
          [vault.id]: buildWorkspace([], []),
        },
      };
    }
    case 'UPDATE_CANVAS_CARDS': return updateCurrentWorkspace(state, workspace => ({ ...workspace, canvasCards: action.payload }));
    case 'OPEN_VAULT': {
      const vault = state.vaults.find(v => v.id === action.payload);
      if (!vault) return state;
      return syncActiveVaultState({ ...state, activeVaultId: vault.id, showGraphView: false, showCanvasView: false, showSearch: false, showCommandPalette: false });
    }
    case 'CLOSE_VAULT': return syncActiveVaultState({ ...state, activeVaultId: null, showGraphView: false, showCanvasView: false, showSearch: false, showCommandPalette: false });
    case 'DELETE_VAULT': {
      const vaults = state.vaults.filter(v => v.id !== action.payload);
      const vaultData = { ...state.vaultData };
      delete vaultData[action.payload];
      if (vaults.length === 0) return syncActiveVaultState({ ...state, vaults: [], vaultData: {}, activeVaultId: null });
      return syncActiveVaultState({ ...state, vaults, vaultData, activeVaultId: state.activeVaultId === action.payload ? vaults[0].id : state.activeVaultId });
    }
    case 'OPEN_TAB': {
      return updateCurrentWorkspace(
        { ...state, showGraphView: false },
        workspace => ({
          ...workspace,
          openTabs: workspace.openTabs.includes(action.payload) ? workspace.openTabs : [...workspace.openTabs, action.payload],
          activeNoteId: action.payload,
        })
      );
    }
    case 'CLOSE_TAB': {
      return updateCurrentWorkspace(state, workspace => {
        const idx = workspace.openTabs.indexOf(action.payload);
        const tabs = workspace.openTabs.filter(t => t !== action.payload);
        let activeId = workspace.activeNoteId;
        if (activeId === action.payload) activeId = tabs.length > 0 ? tabs[Math.min(idx, tabs.length - 1)] : null;
        return { ...workspace, openTabs: tabs, activeNoteId: activeId };
      });
    }
    case 'SET_ACTIVE_TAB': return updateCurrentWorkspace(state, workspace => ({ ...workspace, activeNoteId: action.payload }));
    case 'UPDATE_NOTE': return updateCurrentWorkspace(state, workspace => ({ ...workspace, notes: workspace.notes.map(n => n.id === action.payload.id ? { ...n, content: action.payload.content, updatedAt: Date.now() } : n) }));
    case 'RENAME_NOTE': return updateCurrentWorkspace(state, workspace => ({ ...workspace, notes: workspace.notes.map(n => n.id === action.payload.id ? { ...n, title: action.payload.title, updatedAt: Date.now() } : n) }));
    case 'ADD_NOTE': return updateCurrentWorkspace({ ...state, showGraphView: false }, workspace => ({ ...workspace, notes: [...workspace.notes, action.payload], openTabs: [...workspace.openTabs, action.payload.id], activeNoteId: action.payload.id }));
    case 'DELETE_NOTE': {
      return updateCurrentWorkspace(state, workspace => {
        const tabs = workspace.openTabs.filter(t => t !== action.payload);
        const activeId = workspace.activeNoteId === action.payload ? (tabs[0] || null) : workspace.activeNoteId;
        return { ...workspace, notes: workspace.notes.filter(n => n.id !== action.payload), openTabs: tabs, activeNoteId: activeId };
      });
    }
    case 'PIN_NOTE': return updateCurrentWorkspace(state, workspace => ({ ...workspace, notes: workspace.notes.map(n => n.id === action.payload ? { ...n, pinned: !n.pinned } : n) }));
    case 'ADD_FOLDER': return updateCurrentWorkspace(state, workspace => ({ ...workspace, folders: [...workspace.folders, action.payload] }));
    case 'DELETE_FOLDER': return updateCurrentWorkspace(state, workspace => ({ ...workspace, folders: workspace.folders.filter(f => f.id !== action.payload), notes: workspace.notes.map(n => n.folderId === action.payload ? { ...n, folderId: null } : n) }));
    case 'TOGGLE_FOLDER': return updateCurrentWorkspace(state, workspace => ({ ...workspace, folders: workspace.folders.map(f => f.id === action.payload ? { ...f, collapsed: !f.collapsed } : f) }));
    case 'SET_VIEW_MODE': return { ...state, viewMode: action.payload };
    case 'TOGGLE_SIDEBAR': return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'TOGGLE_RIGHT_PANEL': return { ...state, rightPanelOpen: !state.rightPanelOpen };
    case 'TOGGLE_GRAPH_VIEW': return { ...state, showGraphView: !state.showGraphView, showCanvasView: false };
    case 'TOGGLE_CANVAS_VIEW': return { ...state, showCanvasView: !state.showCanvasView, showGraphView: false };
    case 'TOGGLE_SEARCH': return { ...state, showSearch: !state.showSearch };
    case 'TOGGLE_COMMAND_PALETTE': return { ...state, showCommandPalette: !state.showCommandPalette };
    case 'TOGGLE_SETTINGS': return { ...state, settingsOpen: !state.settingsOpen };
    case 'TOGGLE_AI_CHAT': return { ...state, showAIChat: !state.showAIChat };
    case 'ADD_AI_MESSAGE': return { ...state, aiMessages: [...state.aiMessages, action.payload] };
    case 'CLEAR_AI_MESSAGES': return { ...state, aiMessages: [] };
    case 'UPDATE_AI_SETTINGS': return { ...state, aiSettings: { ...state.aiSettings, ...action.payload } };
    case 'IMPORT_NOTES': return updateCurrentWorkspace(state, workspace => ({ ...workspace, ...buildWorkspace(action.payload.notes, action.payload.folders, [action.payload.notes[0]?.id].filter(Boolean) as string[], action.payload.notes[0]?.id || null, workspace.hasFolderHandle) }));
    case 'SET_FOLDER_HANDLE': return updateCurrentWorkspace(state, workspace => ({ ...workspace, hasFolderHandle: action.payload }));
    case 'CREATE_FOLDER_VAULT': {
      const vault: Vault = { id: action.payload.id, name: action.payload.name, color: action.payload.color, createdAt: Date.now(), lastOpened: Date.now(), isFolderVault: true, folderPath: action.payload.folderPath };
      return {
        ...state,
        vaults: [...state.vaults, vault],
        vaultData: {
          ...state.vaultData,
          [vault.id]: buildWorkspace([], [], [], null, true),
        },
      };
    }
    default: return state;
  }
}

interface StoreContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  createNote: (folderId?: string | null) => void;
  openDailyNote: () => void;
  createFolder: (name: string) => void;
  getNoteByTitle: (title: string) => Note | undefined;
  getBacklinks: (noteId: string) => Note[];
  getOutgoingLinks: (noteId: string) => Note[];
  importNotes: (notes: Note[], folders: Folder[]) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);
  const [state, dispatch] = useReducer(reducer, null, getInitialState);

  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return; }
    saveState(state);
  }, [state]);

  const createNote = useCallback((folderId?: string | null) => {
    const note: Note = { id: generateId(), title: 'Untitled', content: '# Untitled\n\n', folderId: folderId || null, pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
    dispatch({ type: 'ADD_NOTE', payload: note });
  }, []);

  const openDailyNote = useCallback(() => {
    const now = new Date();
    const title = now.toISOString().slice(0, 10);
    const folder = state.folders.find(f => f.name.toLowerCase() === 'daily notes');
    const existing = state.notes.find(note => note.title === title);
    if (existing) {
      dispatch({ type: 'OPEN_TAB', payload: existing.id });
      return;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayTitle = yesterday.toISOString().slice(0, 10);

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowTitle = tomorrow.toISOString().slice(0, 10);

    const folderId = folder?.id || generateId();
    const note: Note = {
      id: generateId(),
      title,
      content: `# ${title}\n\n<< [[${yesterdayTitle}]] | [[${tomorrowTitle}]] >>\n\n## 🎯 Focus for Today\n- [ ] \n\n## 📝 Notes\n\n\n## ✅ Completed\n\n\n## 💭 Reflection\n\n`,
      folderId,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (!folder) {
      dispatch({ type: 'ADD_FOLDER', payload: { id: folderId, name: 'Daily Notes', parentId: null, collapsed: false } });
    }
    dispatch({ type: 'ADD_NOTE', payload: note });
  }, [state.folders, state.notes]);

  const createFolder = useCallback((name: string) => {
    const folder: Folder = { id: generateId(), name, parentId: null, collapsed: false };
    dispatch({ type: 'ADD_FOLDER', payload: folder });
  }, []);

  const getNoteByTitle = useCallback((title: string) => {
    return state.notes.find(n => n.title.toLowerCase() === title.toLowerCase());
  }, [state.notes]);

  const getBacklinks = useCallback((noteId: string) => {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return [];
    const title = note.title;
    return state.notes.filter(n => {
      if (n.id === noteId) return false;
      const regex = new RegExp(`\\[\\[(${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:\\|[^\\]]+)?\\]\\]`, 'i');
      return regex.test(n.content);
    });
  }, [state.notes]);

  const getOutgoingLinks = useCallback((noteId: string) => {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return [];
    const matches = note.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
    const titles = new Set<string>();
    for (const m of matches) titles.add(m[1]);
    return state.notes.filter(n => titles.has(n.title));
  }, [state.notes]);

  const importNotes = useCallback((notes: Note[], folders: Folder[]) => {
    dispatch({ type: 'IMPORT_NOTES', payload: { notes, folders } });
  }, []);

  return (
    <StoreContext.Provider value={{ state, dispatch, createNote, openDailyNote, createFolder, getNoteByTitle, getBacklinks, getOutgoingLinks, importNotes }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
