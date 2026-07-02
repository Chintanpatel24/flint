export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  collapsed: boolean;
}

export interface Vault {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  lastOpened: number;
  isFolderVault?: boolean;
  folderPath?: string;
}

export interface AISettings {
  provider: 'ollama' | 'openai' | 'gemini' | 'openai-compatible' | 'local-gguf';
  ollamaUrl: string;
  apiKey: string;
  apiBaseUrl: string;
  localModelPath: string;
  localModelContext: number;
  localModelThreads: number;
  maxOutputTokens: number;
  model: string;
  maxContextNotes: number;
  temperature: number;
  internetAccess: boolean;
  systemPrompt: string;
}

export interface FlintSettings {
  fontSize: number;
  spellCheck: boolean;
  autoSave: boolean;
  showLineNumbers: boolean;
  tabSize: number;
  wordWrap: boolean;
  theme: 'dark' | 'light' | 'sepia';
  editorStyle: 'default' | 'tiptap';
  dailyNoteTemplate?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface VaultWorkspace {
  notes: Note[];
  folders: Folder[];
  openTabs: string[];
  activeNoteId: string | null;
  hasFolderHandle: boolean;
  canvasCards: CanvasCard[];
}

export interface CanvasCard {
  id: string;
  type: 'text' | 'note' | 'web';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string; // For text cards
  noteId?: string; // For note cards
  url?: string;   // For web cards
  color?: string;
}

export interface CanvasConnection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

export interface AppState {
  vaults: Vault[];
  vaultData: Record<string, VaultWorkspace>;
  activeVaultId: string | null;

  // Current vault state (mirrored for easy access)
  notes: Note[];
  folders: Folder[];
  openTabs: string[];
  activeNoteId: string | null;
  secondaryNoteId: string | null;
  hasFolderHandle: boolean;

  viewMode: 'edit' | 'preview' | 'split';
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  showGraphView: boolean;
  showCanvasView: boolean;
  showSearch: boolean;
  showCommandPalette: boolean;
  showQuickSwitcher: boolean;
  settingsOpen: boolean;
  showAIChat: boolean;

  aiMessages: ChatMessage[];
  aiSettings: AISettings;
  appSettings: FlintSettings;
}
