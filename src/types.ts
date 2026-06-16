export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  filePath?: string; // for folder-based vaults
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

export interface CanvasCard {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'note' | 'text';
  noteId?: string;
  content?: string;
  color?: string;
}

export interface VaultWorkspace {
  notes: Note[];
  folders: Folder[];
  openTabs: string[];
  activeNoteId: string | null;
  hasFolderHandle: boolean;
  canvasCards?: CanvasCard[];
}

export type ViewMode = 'edit' | 'split' | 'preview';

export interface FlintSettings {
  fontSize: number;
  spellCheck: boolean;
  autoSave: boolean;
  showLineNumbers: boolean;
  tabSize: number;
  wordWrap: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  noteContext?: string[];
  webResults?: string;
}

export interface AIAction {
  type: 'update_note' | 'rename_note' | 'create_note' | 'delete_note';
  target?: 'active' | 'id' | 'title';
  noteId?: string;
  matchTitle?: string;
  title?: string;
  content?: string;
}

export type AIProvider = 'ollama' | 'openai' | 'gemini' | 'openai-compatible' | 'local-gguf';

export interface AISettings {
  provider: AIProvider;
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
  systemPrompt: string;
  internetAccess: boolean;
}

export interface AppState {
  vaults: Vault[];
  vaultData: Record<string, VaultWorkspace>;
  activeVaultId: string | null;
  notes: Note[];
  folders: Folder[];
  openTabs: string[];
  activeNoteId: string | null;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  showGraphView: boolean;
  showCanvasView: boolean;
  showSearch: boolean;
  showCommandPalette: boolean;
  settingsOpen: boolean;
  showAIChat: boolean;
  aiMessages: ChatMessage[];
  aiSettings: AISettings;
  hasFolderHandle: boolean; // whether current vault has a live folder handle
}
