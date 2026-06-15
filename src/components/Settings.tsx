import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { FlintLogo, FlintLogoLarge } from './FlintLogo';
import { X, Type, Save, AlignLeft, Hash, WrapText, CheckSquare, Download, Upload, Trash2, Info, Brain, Wifi, WifiOff, RefreshCw, Globe, FolderOpen, FolderPlus } from 'lucide-react';
import { fetchOllamaModels, checkOllamaStatus, checkAgentStatus } from '../services/ollama';
import type { Note, Folder } from '../types';

interface Settings {
  fontSize: number;
  spellCheck: boolean;
  autoSave: boolean;
  showLineNumbers: boolean;
  tabSize: number;
  wordWrap: boolean;
  theme: 'dark' | 'light' | 'rose' | 'ocean' | 'forest' | 'amber';
}

const SETTINGS_KEY = 'flint-settings';
const DEFAULT_SETTINGS: Settings = {
  fontSize: 14, spellCheck: false, autoSave: true, showLineNumbers: false, tabSize: 2, wordWrap: true, theme: 'dark',
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings> & { theme?: string };
      const themeMap: Record<string, Settings['theme']> = {
        graphite: 'dark',
        sunset: 'amber',
        ocean: 'ocean',
        forest: 'forest',
        dark: 'dark',
        light: 'light',
        rose: 'rose',
        amber: 'amber',
      };
      return { ...DEFAULT_SETTINGS, ...parsed, theme: themeMap[parsed.theme || 'dark'] || 'dark' };
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function SettingsPanel() {
  const { state, dispatch } = useStore();
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [tab, setTab] = useState<'editor' | 'ai' | 'vault' | 'about'>('editor');
  const [models, setModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [agentUp, setAgentUp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const isCredentialProvider = state.aiSettings.provider === 'openai' || state.aiSettings.provider === 'gemini' || state.aiSettings.provider === 'openai-compatible';
  const isLocalProvider = state.aiSettings.provider === 'local-gguf';
  const isApiProvider = isCredentialProvider;
  const isOpenAICompatible = state.aiSettings.provider === 'openai-compatible';
  const localModelLabel = state.aiSettings.localModelPath.split(/[\\/]/).pop() || 'model.gguf';

  useEffect(() => { saveSettings(settings); }, [settings]);

  useEffect(() => {
    const style = document.getElementById('flint-dynamic-style');
    if (style) {
      style.textContent = `.flint-editor { font-size: ${settings.fontSize}px; tab-size: ${settings.tabSize}; ${settings.wordWrap ? '' : 'white-space: pre; overflow-x: auto;'} }`;
    }
  }, [settings.fontSize, settings.tabSize, settings.wordWrap]);

  useEffect(() => {
    document.body.dataset.theme = settings.theme;
  }, [settings.theme]);

  // Check Ollama connection and auto-select model
  useEffect(() => {
    const check = async () => {
      const aUp = await checkAgentStatus();
      setAgentUp(aUp);
      if (state.aiSettings.provider === 'ollama') {
        const status = await checkOllamaStatus(state.aiSettings.ollamaUrl);
        setOllamaStatus(status);
        if (status === 'connected') {
          const fetchedModels = await fetchOllamaModels(state.aiSettings.ollamaUrl);
          setModels(fetchedModels);
          // Auto-select first model if none selected
          if (fetchedModels.length > 0 && !state.aiSettings.model) {
            dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: fetchedModels[0] } });
          }
        } else {
          setModels([]);
        }
      } else {
        setOllamaStatus('disconnected');
        setModels([]);
      }
    };
    check();
  }, [state.aiSettings.ollamaUrl, state.aiSettings.model, state.aiSettings.provider, dispatch]);

  const close = () => dispatch({ type: 'TOGGLE_SETTINGS' });

  const exportData = () => {
    const data = localStorage.getItem('flint-data') || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'flint-vault-export.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data.vaults) {
            dispatch({ type: 'SET_STATE', payload: data });
            close();
          }
        } catch { alert('Invalid file format'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const clearAll = () => {
    if (confirm('This will delete ALL your vaults and notes. Are you sure?')) {
      localStorage.removeItem('flint-data');
      localStorage.removeItem('flint-settings');
      window.location.reload();
    }
  };

  const refreshModels = async () => {
    setRefreshing(true);
    try {
      const aUp = await checkAgentStatus();
      setAgentUp(aUp);
      if (state.aiSettings.provider === 'ollama') {
        const status = await checkOllamaStatus(state.aiSettings.ollamaUrl);
        setOllamaStatus(status);
        if (status === 'connected') {
          const fetchedModels = await fetchOllamaModels(state.aiSettings.ollamaUrl);
          setModels(fetchedModels);
          if (fetchedModels.length > 0 && !state.aiSettings.model) {
            dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: fetchedModels[0] } });
          }
        }
      } else {
        setModels([]);
      }
    } catch {
      setOllamaStatus('disconnected');
    }
    setRefreshing(false);
  };

  const applyCustomModel = () => {
    if (customModel.trim()) {
      dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: customModel.trim() } });
      setCustomModel('');
    }
  };

  const checkConnection = async () => {
    await refreshModels();
  };

  // Open a folder from system as a vault
  const openFolderAsVault = async () => {
    try {
      // Check if File System Access API is available
      if (!('showDirectoryPicker' in window)) {
        alert('Your browser does not support the File System Access API.\n\nTo use this feature, please use Chrome, Edge, or Opera.\n\nAlternatively, you can import .md files manually using the button below.');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      if (!dirHandle) return;

      const importedNotes: Note[] = [];
      const importedFolders: Folder[] = [];
      const folderMap = new Map<string, string>();

      // Create a root folder for this vault
      const rootFolderId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      importedFolders.push({ id: rootFolderId, name: dirHandle.name, parentId: null, collapsed: false });

      // Recursively read directory
      async function readDirectory(handle: any, parentId: string | null, path: string) {
        for await (const entry of handle.values()) {
          if (entry.kind === 'directory') {
            const folderId = Math.random().toString(36).slice(2) + Date.now().toString(36);
            importedFolders.push({ id: folderId, name: entry.name, parentId, collapsed: false });
            folderMap.set(path + '/' + entry.name, folderId);
            await readDirectory(entry, folderId, path + '/' + entry.name);
          } else if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            try {
              const file = await entry.getFile();
              const content = await file.text();
              const title = entry.name.replace('.md', '');
              importedNotes.push({
                id: Math.random().toString(36).slice(2) + Date.now().toString(36),
                title,
                content,
                folderId: parentId,
                pinned: false,
                filePath: path + '/' + entry.name,
                createdAt: file.lastModified || Date.now(),
                updatedAt: file.lastModified || Date.now(),
              });
            } catch { /* skip unreadable files */ }
          }
        }
      }

      await readDirectory(dirHandle, rootFolderId, dirHandle.name);

      if (importedNotes.length === 0) {
        alert('No .md files found in the selected folder.');
        return;
      }

      // Create a vault entry
      const vaultId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      dispatch({ type: 'CREATE_FOLDER_VAULT', payload: { id: vaultId, name: dirHandle.name, color: '#888', folderPath: dirHandle.name } });
      dispatch({ type: 'IMPORT_NOTES', payload: { notes: importedNotes, folders: importedFolders } });
      dispatch({ type: 'SET_FOLDER_HANDLE', payload: true });
      dispatch({ type: 'OPEN_VAULT', payload: vaultId });
      close();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        alert('Error opening folder: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  // Import individual .md files
  const importMarkdownFiles = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.multiple = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (input as any).webkitdirectory = false;
    input.onchange = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const importedNotes: Note[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const content = await file.text();
          const title = file.name.replace(/\.(md|markdown|txt)$/, '');
          importedNotes.push({
            id: Math.random().toString(36).slice(2) + Date.now().toString(36) + i,
            title,
            content,
            folderId: null,
            pinned: false,
            createdAt: file.lastModified || Date.now(),
            updatedAt: file.lastModified || Date.now(),
          });
        } catch { /* skip */ }
      }

      if (importedNotes.length > 0) {
        dispatch({ type: 'IMPORT_NOTES', payload: { notes: [...state.notes, ...importedNotes], folders: state.folders } });
        close();
      }
    };
    input.click();
  };

  const vault = state.vaults.find(v => v.id === state.activeVaultId);
  const noteCount = state.notes.length;
  const folderCount = state.folders.length;
  const totalLinks = state.notes.reduce((acc, n) => {
    const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
    let count = 0;
    for (const m of matches) {
      if (state.notes.find(nt => nt.title.toLowerCase() === m[1].toLowerCase())) count++;
    }
    return acc + count;
  }, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={close}>
      <div style={{ width: 560, maxHeight: '85vh', background: '#171b21', border: '1px solid #303744', borderRadius: 12, overflow: 'hidden', boxShadow: '0 18px 48px rgba(0,0,0,0.42)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '14px 18px', borderBottom: '1px solid #303744', background: 'linear-gradient(180deg, #1e232b, #171b21)' }}>
          <div className="flex items-center gap-2">
            <FlintLogo size={14} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#d5dbe5' }}>Settings</span>
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', color: '#768193', cursor: 'pointer', display: 'flex' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#d2d8e2'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#768193'; }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid #303744', background: '#161a20' }}>
          {(['editor', 'ai', 'vault', 'about'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, textTransform: 'capitalize',
                color: tab === t ? '#d5dbe5' : '#7a8597',
                borderBottom: tab === t ? '2px solid #93a4c0' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              {t === 'ai' ? 'AI' : t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '18px', overflowY: 'auto', maxHeight: 'calc(85vh - 110px)', background: 'linear-gradient(180deg, rgba(255,255,255,0.015), transparent 240px)' }}>

          {tab === 'editor' && (
            <div className="flex flex-col gap-5">
              <SettingRow icon={<Type size={14} />} label="Font size" value={`${settings.fontSize}px`}>
                <input type="range" min={10} max={24} value={settings.fontSize}
                  onChange={e => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
                  style={{ flex: 1, accentColor: '#666' }} />
              </SettingRow>
              <SettingRow icon={<Type size={14} />} label="App theme">
                <select value={settings.theme}
                  onChange={e => setSettings(s => ({ ...s, theme: e.target.value as Settings['theme'] }))}
                  style={{ flex: 1, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 4, padding: '5px 8px', color: '#aaa', fontSize: 12, outline: 'none' }}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="rose">Rose</option>
                  <option value="ocean">Ocean</option>
                  <option value="forest">Forest</option>
                  <option value="amber">Amber</option>
                </select>
              </SettingRow>
              <SettingRow icon={<Hash size={14} />} label="Tab size" value={`${settings.tabSize}`}>
                <input type="range" min={2} max={8} step={2} value={settings.tabSize}
                  onChange={e => setSettings(s => ({ ...s, tabSize: parseInt(e.target.value) }))}
                  style={{ flex: 1, accentColor: '#666' }} />
              </SettingRow>
              <SettingRow icon={<WrapText size={14} />} label="Word wrap">
                <Toggle checked={settings.wordWrap} onChange={v => setSettings(s => ({ ...s, wordWrap: v }))} />
              </SettingRow>
              <SettingRow icon={<Save size={14} />} label="Auto-save">
                <Toggle checked={settings.autoSave} onChange={v => setSettings(s => ({ ...s, autoSave: v }))} />
              </SettingRow>
              <SettingRow icon={<CheckSquare size={14} />} label="Spell check">
                <Toggle checked={settings.spellCheck} onChange={v => setSettings(s => ({ ...s, spellCheck: v }))} />
              </SettingRow>
              <SettingRow icon={<AlignLeft size={14} />} label="Line numbers">
                <Toggle checked={settings.showLineNumbers} onChange={v => setSettings(s => ({ ...s, showLineNumbers: v }))} />
              </SettingRow>
            </div>
          )}

          {tab === 'ai' && (
            <div className="flex flex-col gap-5">
              {/* Connection status */}
              <div style={{ padding: 14, background: '#0d0d0d', borderRadius: 8, border: '1px solid #1a1a1a' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <div className="flex items-center gap-2">
                    <Brain size={16} style={{ color: '#666' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>AI Agent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1" style={{ fontSize: 10, color: agentUp ? '#5a5' : '#655' }}>
                      {agentUp ? <Wifi size={10} /> : <WifiOff size={10} />}
                      {agentUp ? 'Agent Running' : 'Agent Down'}
                    </div>
                    <button onClick={checkConnection} style={{ padding: '5px 8px', background: '#141414', border: '1px solid #1a1a1a', borderRadius: 5, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                      <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                      {refreshing ? 'Checking' : 'Check connection'}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#95a1b3', lineHeight: 1.6 }}>
                  {!agentUp
                    ? 'Agent offline. Use Check connection after starting your local agent.'
                    : state.aiSettings.provider === 'ollama' && ollamaStatus === 'connected'
                    ? `Agent running. Found ${models.length} model${models.length !== 1 ? 's' : ''}: ${models.slice(0, 3).join(', ')}${models.length > 3 ? '...' : ''}`
                    : state.aiSettings.provider === 'ollama' && ollamaStatus === 'disconnected'
                    ? 'Agent running but Ollama not found. Start with: ollama serve'
                    : isLocalProvider
                    ? state.aiSettings.localModelPath
                      ? `Agent running. Flint will send prompts directly to the self-hosted GGUF runtime for ${localModelLabel}.`
                      : 'Agent running. Set a local GGUF model path to use your downloaded model directly through the self-hosted agent.'
                    : state.aiSettings.provider === 'ollama'
                    ? 'Checking connection...'
                    : 'Agent running. Requests will use your selected API provider and key.'}
                </div>
              </div>

              <SettingRow icon={<Brain size={14} />} label="Provider">
                <select value={state.aiSettings.provider}
                  onChange={e => dispatch({
                    type: 'UPDATE_AI_SETTINGS',
                    payload: {
                      provider: e.target.value as 'ollama' | 'openai' | 'gemini' | 'openai-compatible' | 'local-gguf',
                    },
                  })}
                  style={{ flex: 1, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 4, padding: '5px 8px', color: '#aaa', fontSize: 12, outline: 'none' }}>
                  <option value="ollama">Ollama (local)</option>
                  <option value="local-gguf">Self-hosted GGUF (local file)</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai-compatible">Other OpenAI-compatible API</option>
                </select>
              </SettingRow>

              {state.aiSettings.provider === 'ollama' && (
                <SettingRow icon={<Wifi size={14} />} label="Ollama URL">
                  <input type="text" value={state.aiSettings.ollamaUrl}
                    onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { ollamaUrl: e.target.value } })}
                    style={{ flex: 1, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 4, padding: '5px 8px', color: '#aaa', fontSize: 12, outline: 'none' }} />
                </SettingRow>
              )}

              {isApiProvider && (
                <SettingRow icon={<Brain size={14} />} label="API key">
                  <input type="password" value={state.aiSettings.apiKey}
                    onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { apiKey: e.target.value } })}
                    placeholder={state.aiSettings.provider === 'openai' ? 'sk-...' : state.aiSettings.provider === 'gemini' ? 'AIza...' : 'Paste provider key'}
                    style={{ flex: 1, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 4, padding: '5px 8px', color: '#aaa', fontSize: 12, outline: 'none' }} />
                </SettingRow>
              )}

              {isOpenAICompatible && (
                <SettingRow icon={<Globe size={14} />} label="API base URL">
                  <input type="text" value={state.aiSettings.apiBaseUrl}
                    onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { apiBaseUrl: e.target.value } })}
                    placeholder="https://api.provider.com/v1"
                    style={{ flex: 1, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 4, padding: '5px 8px', color: '#aaa', fontSize: 12, outline: 'none' }} />
                </SettingRow>
              )}

              {isLocalProvider && (
                <>
                  <SettingRow icon={<FolderOpen size={14} />} label="GGUF model path">
                    <input type="text" value={state.aiSettings.localModelPath}
                      onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { localModelPath: e.target.value } })}
                      placeholder="/path/to/model.gguf"
                      style={{ flex: 1, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 4, padding: '5px 8px', color: '#aaa', fontSize: 12, outline: 'none' }} />
                  </SettingRow>
                  <SettingRow icon={<Hash size={14} />} label="Local context" value={`${state.aiSettings.localModelContext}`}>
                    <input type="range" min={512} max={8192} step={256} value={state.aiSettings.localModelContext}
                      onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { localModelContext: parseInt(e.target.value) } })}
                      style={{ flex: 1, accentColor: '#666' }} />
                  </SettingRow>
                  <SettingRow icon={<Hash size={14} />} label="Local threads" value={`${state.aiSettings.localModelThreads}`}>
                    <input type="range" min={1} max={16} step={1} value={state.aiSettings.localModelThreads}
                      onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { localModelThreads: parseInt(e.target.value) } })}
                      style={{ flex: 1, accentColor: '#666' }} />
                  </SettingRow>
                </>
              )}

              {/* Model — works with ANY model */}
              <SettingRow icon={<Brain size={14} />} label="Model">
                {state.aiSettings.provider === 'ollama' && models.length > 0 ? (
                  <div className="flex items-center gap-2" style={{ flex: 1 }}>
                    <select value={state.aiSettings.model}
                      onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: e.target.value } })}
                      style={{ flex: 1, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 4, padding: '5px 8px', color: '#aaa', fontSize: 12, outline: 'none' }}>
                      <option value="">Select model...</option>
                      {models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-2" style={{ flex: 1 }}>
                    <input type="text" value={state.aiSettings.model}
                      onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { model: e.target.value } })}
                      placeholder={state.aiSettings.provider === 'openai' ? 'e.g. gpt-4o-mini' : state.aiSettings.provider === 'gemini' ? 'e.g. gemini-1.5-flash' : state.aiSettings.provider === 'openai-compatible' ? 'Provider model id' : state.aiSettings.provider === 'local-gguf' ? 'Optional alias for the GGUF model' : 'e.g. llama3.2, mistral, codellama, phi3'}
                      style={{ flex: 1, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 4, padding: '5px 8px', color: '#aaa', fontSize: 12, outline: 'none' }} />
                  </div>
                )}
              </SettingRow>

              {/* Custom model input for when models are detected */}
              {state.aiSettings.provider === 'ollama' && models.length > 0 && (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 10, color: '#444', width: 140, flexShrink: 0 }}>Use custom model</span>
                  <input type="text" value={customModel}
                    onChange={e => setCustomModel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') applyCustomModel(); }}
                    placeholder="Type any model name..."
                    style={{ flex: 1, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 4, padding: '5px 8px', color: '#aaa', fontSize: 11, outline: 'none' }} />
                  <button onClick={applyCustomModel}
                    style={{ padding: '4px 8px', background: '#141414', border: '1px solid #1a1a1a', borderRadius: 4, color: '#666', fontSize: 10, cursor: 'pointer' }}>
                    Set
                  </button>
                </div>
              )}

              {/* Internet Access */}
              <div style={{ padding: 14, background: '#0d0d0d', borderRadius: 8, border: `1px solid ${state.aiSettings.internetAccess ? '#1a2a1a' : '#1a1a1a'}` }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <div className="flex items-center gap-2">
                    <Globe size={16} style={{ color: state.aiSettings.internetAccess ? '#5a5' : '#444' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>Internet Access</span>
                  </div>
                  <Toggle
                    checked={state.aiSettings.internetAccess}
                    onChange={v => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { internetAccess: v } })}
                  />
                </div>
                <div style={{ fontSize: 11, color: '#444', lineHeight: 1.6 }}>
                  {state.aiSettings.internetAccess
                    ? 'AI can search the web (Wikipedia) to supplement answers with real-time information.'
                    : 'AI will only use your notes as context. Enable to allow web searches.'}
                </div>
              </div>

              {/* Context notes */}
              <SettingRow icon={<Hash size={14} />} label="Max context notes" value={`${state.aiSettings.maxContextNotes}`}>
                <input type="range" min={2} max={20} value={state.aiSettings.maxContextNotes}
                  onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { maxContextNotes: parseInt(e.target.value) } })}
                  style={{ flex: 1, accentColor: '#666' }} />
              </SettingRow>

              {/* Temperature */}
              <SettingRow icon={<AlignLeft size={14} />} label="Temperature" value={state.aiSettings.temperature.toFixed(2)}>
                <input type="range" min={0} max={200} value={Math.round(state.aiSettings.temperature * 100)}
                  onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { temperature: parseInt(e.target.value) / 100 } })}
                  style={{ flex: 1, accentColor: '#666' }} />
              </SettingRow>

              <SettingRow icon={<Hash size={14} />} label="Max output tokens" value={`${state.aiSettings.maxOutputTokens}`}>
                <input type="range" min={64} max={1024} step={32} value={state.aiSettings.maxOutputTokens}
                  onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { maxOutputTokens: parseInt(e.target.value) } })}
                  style={{ flex: 1, accentColor: '#666' }} />
              </SettingRow>

              {/* System prompt */}
              <div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>System prompt</div>
                <textarea value={state.aiSettings.systemPrompt}
                  onChange={e => dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { systemPrompt: e.target.value } })}
                  rows={4}
                  style={{ width: '100%', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 4, padding: '8px 10px', color: '#888', fontSize: 11, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
              </div>

              {/* How it works */}
              <div style={{ padding: 12, background: '#060606', borderRadius: 6, border: '1px solid #151515' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 6 }}>How Flint AI works</div>
                <div style={{ fontSize: 10, color: '#3a3a3a', lineHeight: 1.6 }}>
                  • Builds responses from your <strong style={{ color: '#555' }}>note memory + graph links</strong><br />
                  • Works with <strong style={{ color: '#555' }}>Ollama, local GGUF files, OpenAI, Gemini, and OpenAI-compatible APIs</strong><br />
                  • Use tiny local models (MB-scale GGUF) by setting a small model path + lower output tokens<br />
                  • Paste your API key in settings when using cloud providers<br />
                  • Requests are routed through the local <strong style={{ color: '#555' }}>Python agent</strong><br />
                  • Uses your <strong style={{ color: '#555' }}>notes as memory</strong> — builds context from note content<br />
                  • Follows <strong style={{ color: '#555' }}>graph connections</strong> — linked notes provide deeper context<br />
                  • <strong style={{ color: '#555' }}>Internet access</strong> — searches Wikipedia for real-time information<br />
                  • You can still run <strong style={{ color: '#555' }}>100% local</strong> with Ollama only<br />
                  • Install local models: <code style={{ background: '#111', padding: '1px 4px', borderRadius: 2 }}>ollama pull llama3.2</code>
                </div>
              </div>
            </div>
          )}

          {tab === 'vault' && (
            <div className="flex flex-col gap-5">
              {/* Current vault info */}
              <div style={{ padding: 14, background: '#0d0d0d', borderRadius: 8, border: '1px solid #1a1a1a' }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Current Vault</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#aaa', marginBottom: 10 }}>{vault?.name || 'None'}</div>
                {vault?.isFolderVault && vault.folderPath && (
                  <div style={{ fontSize: 10, color: '#444', marginBottom: 8, padding: '4px 8px', background: '#080808', borderRadius: 4, border: '1px solid #151515', wordBreak: 'break-all' }}>
                     {vault.folderPath}
                  </div>
                )}
                <div className="flex gap-4" style={{ fontSize: 11, color: '#444' }}>
                  <span>{noteCount} notes</span>
                  <span>{folderCount} folders</span>
                  <span>{totalLinks} links</span>
                </div>
              </div>

              {/* Open folder as vault */}
              <div style={{ padding: 14, background: '#0d0d0d', borderRadius: 8, border: '1px solid #1a1a1a' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                  <FolderOpen size={16} style={{ color: '#666' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>Open Folder as Vault</span>
                </div>
                <div style={{ fontSize: 11, color: '#444', lineHeight: 1.6, marginBottom: 10 }}>
                  Select a folder from your system. All <code style={{ background: '#111', padding: '1px 4px', borderRadius: 2 }}>.md</code> files
                  inside will be imported as notes. Subfolders become Flint folders. Changes save back to disk.
                </div>
                <button onClick={openFolderAsVault}
                  className="flex items-center gap-2"
                  style={{ padding: '10px 14px', background: '#111', border: '1px solid #222', borderRadius: 6, color: '#999', cursor: 'pointer', fontSize: 12, width: '100%', textAlign: 'left' }}>
                  <FolderOpen size={14} /> Choose Folder...
                </button>
              </div>

              {/* Import .md files */}
              <div style={{ padding: 14, background: '#0d0d0d', borderRadius: 8, border: '1px solid #1a1a1a' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                  <FolderPlus size={16} style={{ color: '#666' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>Import Markdown Files</span>
                </div>
                <div style={{ fontSize: 11, color: '#444', lineHeight: 1.6, marginBottom: 10 }}>
                  Select multiple <code style={{ background: '#111', padding: '1px 4px', borderRadius: 2 }}>.md</code> files from your system
                  to import into the current vault.
                </div>
                <button onClick={importMarkdownFiles}
                  className="flex items-center gap-2"
                  style={{ padding: '10px 14px', background: '#111', border: '1px solid #222', borderRadius: 6, color: '#999', cursor: 'pointer', fontSize: 12, width: '100%', textAlign: 'left' }}>
                  <FolderPlus size={14} /> Select Files...
                </button>
              </div>

              {/* Data management */}
              <div className="flex flex-col gap-2">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Data Management</div>
                <button onClick={exportData}
                  className="flex items-center gap-2"
                  style={{ padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 6, color: '#777', cursor: 'pointer', fontSize: 12, textAlign: 'left', width: '100%' }}>
                  <Download size={14} /> Export vault data
                </button>
                <button onClick={importData}
                  className="flex items-center gap-2"
                  style={{ padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 6, color: '#777', cursor: 'pointer', fontSize: 12, textAlign: 'left', width: '100%' }}>
                  <Upload size={14} /> Import vault data (.json)
                </button>
                <button onClick={clearAll}
                  className="flex items-center gap-2"
                  style={{ padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 6, color: '#664444', cursor: 'pointer', fontSize: 12, textAlign: 'left', width: '100%' }}>
                  <Trash2 size={14} /> Clear all data
                </button>
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="flex flex-col gap-4" style={{ textAlign: 'center', paddingTop: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, margin: '0 auto', border: '1px solid #1a1a1a', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FlintLogoLarge size={28} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#999' }}>Flint</div>
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Version 2.0.2</div>
              </div>
              <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
                A secure, local-first knowledge base<br />with AI-powered memory.<br />
                All data stays on your device. No cloud. No tracking.<br />
                AI powered by <strong>Ollama</strong> — works with any model.
              </div>
              <div style={{ fontSize: 10, color: '#333', marginTop: 8 }}>
                <Info size={10} style={{ display: 'inline', marginRight: 4 }} />
                Built with React, Vite & TypeScript · AI by Ollama
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ icon, label, value, children }: { icon: React.ReactNode; label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ color: '#444', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 12, color: '#777', flex: 1 }}>{label}</span>
      {value && <span style={{ fontSize: 11, color: '#444', marginRight: 8 }}>{value}</span>}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
        background: checked ? '#444' : '#1a1a1a', position: 'relative',
        transition: 'background 0.2s', border: `1px solid ${checked ? '#555' : '#222'}`,
      }}>
      <div style={{
        width: 14, height: 14, borderRadius: 7, background: checked ? '#ccc' : '#444',
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        transition: 'all 0.2s',
      }} />
    </div>
  );
}
