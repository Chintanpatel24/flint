import { useState } from 'react';
import { useStore } from '../store';
import { Plus, Trash2, Lock, FolderOpen, Folder, AlertCircle } from 'lucide-react';
import { FlintLogo, FlintLogoLarge } from './FlintLogo';
import {
  isFileSystemSupported,
  readAllMarkdownFiles,
  storeHandle,
  requestPermission,
  getHandle,
} from '../services/filesystem';
import type { Note, Folder as FolderType } from '../types';

// showDirectoryPicker is declared in src/types/fs.d.ts

export function VaultScreen() {
  const { state, dispatch, importNotes } = useStore();
  const [name, setName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const colors = ['#888', '#777', '#999', '#aaa', '#666', '#bbb', '#555', '#999'];

  const create = () => {
    if (!name.trim()) return;
    const id = 'v' + Date.now();
    dispatch({ type: 'CREATE_VAULT', payload: { id, name: name.trim(), color: colors[Math.floor(Math.random() * colors.length)] } });
    dispatch({ type: 'OPEN_VAULT', payload: id });
    setName('');
    setShowNew(false);
  };

  const openFolderAsVault = async () => {
    setError('');
    setLoading(true);
    try {
      if (!isFileSystemSupported()) {
        setError('Your browser does not support opening folders. Please use Chrome, Edge, or Opera.');
        setLoading(false);
        return;
      }

      // Show folder picker
      const dirHandle = await window.showDirectoryPicker!();
      const vaultName = dirHandle.name;

      // Check permission
      const permitted = await requestPermission(dirHandle);
      if (!permitted) {
        setError('Permission denied. Please allow access to the folder.');
        setLoading(false);
        return;
      }

      // Read all markdown files recursively
      const files = await readAllMarkdownFiles(dirHandle);

      // Convert to notes
      const folderMap = new Map<string, FolderType>();
      const notes: Note[] = files.map((f, i) => {
        // Create folder from directory path
        const pathParts = f.path.split('/');
        let folderId: string | null = null;
        if (pathParts.length > 1) {
          // Create parent folders
          let currentPath = '';
          for (let j = 0; j < pathParts.length - 1; j++) {
            const folderName = pathParts[j];
            currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            if (!folderMap.has(currentPath)) {
              const fid = 'fdir_' + currentPath.replace(/[^a-zA-Z0-9]/g, '_');
              folderMap.set(currentPath, {
                id: fid,
                name: folderName,
                parentId: null,
                collapsed: false,
              });
            }
            const parentFolder = folderMap.get(currentPath);
            if (parentFolder) folderId = parentFolder.id;
          }
        }

        return {
          id: 'nimport_' + i + '_' + Date.now(),
          title: f.name,
          content: f.content,
          folderId,
          pinned: false,
          createdAt: Date.now() - (files.length - i) * 1000,
          updatedAt: Date.now(),
          filePath: f.path,
        };
      });

      const folders = Array.from(folderMap.values());

      // Create vault
      const vaultId = 'vfolder_' + Date.now();
      dispatch({
        type: 'CREATE_FOLDER_VAULT',
        payload: { id: vaultId, name: vaultName, color: '#888', folderPath: vaultName },
      });

      // Store the directory handle in IndexedDB
      await storeHandle(vaultId, dirHandle);

      // Open vault
      dispatch({ type: 'OPEN_VAULT', payload: vaultId });
      dispatch({ type: 'SET_FOLDER_HANDLE', payload: true });

      // Import the notes
      importNotes(notes, folders);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled
      } else {
        setError(err instanceof Error ? err.message : 'Failed to open folder');
      }
    }
    setLoading(false);
  };

  const reopenFolderVault = async (vaultId: string) => {
    setError('');
    setLoading(true);
    try {
      const handle = await getHandle(vaultId);
      if (!handle) {
        setError('Folder access lost. Please open the folder again.');
        setLoading(false);
        return;
      }
      const permitted = await requestPermission(handle);
      if (!permitted) {
        setError('Permission denied. Please allow access to the folder.');
        setLoading(false);
        return;
      }
      const files = await readAllMarkdownFiles(handle);

      const folderMap = new Map<string, FolderType>();
      const notes: Note[] = files.map((f, i) => {
        const pathParts = f.path.split('/');
        let folderId: string | null = null;
        if (pathParts.length > 1) {
          let currentPath = '';
          for (let j = 0; j < pathParts.length - 1; j++) {
            const folderName = pathParts[j];
            currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            if (!folderMap.has(currentPath)) {
              const fid = 'fdir_' + currentPath.replace(/[^a-zA-Z0-9]/g, '_');
              folderMap.set(currentPath, { id: fid, name: folderName, parentId: null, collapsed: false });
            }
            const parentFolder = folderMap.get(currentPath);
            if (parentFolder) folderId = parentFolder.id;
          }
        }
        return {
          id: 'nimport_' + i + '_' + Date.now(),
          title: f.name,
          content: f.content,
          folderId,
          pinned: false,
          createdAt: Date.now() - (files.length - i) * 1000,
          updatedAt: Date.now(),
          filePath: f.path,
        };
      });

      const folders = Array.from(folderMap.values());
      dispatch({ type: 'OPEN_VAULT', payload: vaultId });
      dispatch({ type: 'SET_FOLDER_HANDLE', payload: true });
      importNotes(notes, folders);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reopen folder');
    }
    setLoading(false);
  };

  return (
    <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
      <div className="animate-fade-in" style={{ width: 480, maxWidth: '95vw' }}>
        {/* Logo */}
        <div className="text-center" style={{ marginBottom: 40 }}>
          <div style={{ width: 80, height: 96, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FlintLogoLarge size={60} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#e0e0e0', letterSpacing: '-0.03em' }}>Flint</h1>
          <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Local knowledge base</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, color: '#444', marginTop: 8 }}>
            <Lock size={9} /> Offline & Secure
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2" style={{ padding: '10px 14px', background: '#1a0a0a', border: '1px solid #331111', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#cc6666' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Existing vaults */}
        {state.vaults.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, padding: '0 4px' }}>
              Your Vaults
            </div>
            {state.vaults.map(vault => {
              const workspace = state.vaultData[vault.id];
              const noteCount = workspace?.notes.length || 0;
              const folderCount = workspace?.folders.length || 0;
              return (
              <div key={vault.id}
                className="flex items-center gap-3 cursor-pointer"
                style={{ padding: '12px 14px', borderRadius: 8, marginBottom: 2, background: '#0a0a0a', border: '1px solid #1a1a1a', transition: 'all 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.borderColor = '#2a2a2a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.borderColor = '#1a1a1a'; }}
                onClick={() => {
                  if (vault.isFolderVault) {
                    reopenFolderVault(vault.id);
                  } else {
                    dispatch({ type: 'OPEN_VAULT', payload: vault.id });
                  }
                }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #222' }}>
                  {vault.isFolderVault ? <FolderOpen size={14} style={{ color: '#666' }} /> : <FlintLogo size={16} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#ccc' }}>{vault.name}</div>
                  <div style={{ fontSize: 11, color: '#444', marginTop: 1 }}>
                    {vault.isFolderVault ? (
                      <span className="flex items-center gap-1"><Folder size={9} /> {vault.folderPath}</span>
                    ) : (
                      <span>{noteCount} notes · {folderCount} folders</span>
                    )}
                  </div>
                </div>
                <button
                  style={{ padding: 4, background: 'none', border: 'none', color: '#333', cursor: 'pointer', borderRadius: 4, display: 'flex' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#888'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#333'; }}
                  onClick={e => { e.stopPropagation(); if (confirm('Delete vault "' + vault.name + '"?')) dispatch({ type: 'DELETE_VAULT', payload: vault.id }); }}>
                  <Trash2 size={13} />
                </button>
              </div>
            );})}
          </div>
        )}

        {/* Open Folder as Vault — Primary action */}
        <button
          onClick={openFolderAsVault}
          disabled={loading}
          className="flex items-center justify-center gap-2"
          style={{
            width: '100%', padding: '14px 0',
            background: loading ? '#111' : '#0f0f0f',
            border: '1px solid #222',
            borderRadius: 8,
            color: loading ? '#444' : '#999',
            fontSize: 14, fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.15s',
            marginBottom: 10,
          }}
          onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#161616'; e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#ccc'; } }}
          onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = '#0f0f0f'; e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#999'; } }}>
          <FolderOpen size={18} />
          {loading ? 'Opening...' : 'Open Folder as Vault'}
        </button>

        {!isFileSystemSupported() && (
          <p style={{ fontSize: 11, color: '#555', textAlign: 'center', marginBottom: 10 }}>
            Folder access requires Chrome, Edge, or Opera browser
          </p>
        )}

        {/* Create empty vault */}
        {showNew ? (
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 10, padding: 16 }} className="animate-scale-in">
            <div style={{ fontSize: 13, fontWeight: 600, color: '#bbb', marginBottom: 12 }}>Create new vault</div>
            <input type="text" placeholder="Vault name" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setShowNew(false); }}
              autoFocus
              style={{ width: '100%', padding: '8px 12px', background: '#050505', border: '1px solid #1a1a1a', borderRadius: 6, color: '#ccc', fontSize: 14, outline: 'none', marginBottom: 12 }}
            />
            <div className="flex items-center gap-2">
              <button onClick={create}
                style={{ flex: 1, padding: '8px 0', background: '#888', color: '#000', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Create Vault
              </button>
              <button onClick={() => { setShowNew(false); setName(''); }}
                style={{ padding: '8px 16px', background: '#1a1a1a', color: '#888', border: '1px solid #222', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowNew(true)}
            className="flex items-center justify-center gap-2"
            style={{ width: '100%', padding: '10px 0', background: '#0a0a0a', border: '1px dashed #222', borderRadius: 8, color: '#555', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555'; }}>
            <Plus size={14} /> Create empty vault
          </button>
        )}

        {/* Footer */}
        <div className="text-center" style={{ marginTop: 32 }}>
          <div className="flex items-center justify-center gap-4" style={{ fontSize: 10, color: '#333' }}>
            <span>Encrypted storage</span>
            <span>·</span>
            <span>Zero cloud</span>
            <span>·</span>
            <span>Your data</span>
          </div>
        </div>
      </div>
    </div>
  );
}
