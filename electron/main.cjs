// Flint — Electron Desktop Wrapper
// .cjs = guaranteed CommonJS regardless of any "type":"module"

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let agentProcess = null;

const APP_DIR = __dirname;
const DIST_FILE = path.join(APP_DIR, 'dist', 'index.html');
const ICON_FILE = path.join(APP_DIR, 'icon.png');

// ── Start Python AI Agent ──────────────────────────────────
function startAgent() {
  const binDir = path.join(APP_DIR, 'bin');
  const executableName = process.platform === 'win32' ? 'agent.exe' : 'agent';
  const agentExecutable = path.join(binDir, executableName);

  if (!fs.existsSync(agentExecutable)) {
    console.log(`[Flint] No compiled agent found at ${agentExecutable} — AI will use browser fallback`);
    return;
  }

  console.log('[Flint] Starting standalone AI agent binary...');

  agentProcess = spawn(agentExecutable, [], {
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  });

  agentProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log('[Flint Agent]', msg);
  });

  agentProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('DeprecationWarning') && !msg.includes('WARNING')) {
      console.log('[Flint Agent]', msg);
    }
  });

  agentProcess.on('error', (err) => {
    console.log('[Flint] Agent failed to start:', err.message);
    console.log('[Flint] Install Python + Flask: pip3 install flask flask-cors requests');
  });

  agentProcess.on('exit', (code) => {
    console.log('[Flint] Agent stopped (code', code, ')');
    agentProcess = null;
  });
}

function stopAgent() {
  if (agentProcess) {
    console.log('[Flint] Stopping agent...');
    agentProcess.kill('SIGTERM');
    agentProcess = null;
  }
}

// ── Create Window ──────────────────────────────────────────

function createWindow() {
  if (!fs.existsSync(DIST_FILE)) {
    console.error('[Flint] ERROR: dist/index.html not found at ' + DIST_FILE);
    console.error('[Flint] Run: bash install.sh');
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Flint',
    backgroundColor: '#0a0a0a',
    icon: fs.existsSync(ICON_FILE) ? ICON_FILE : undefined,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadFile(DIST_FILE).then(() => {
    console.log('[Flint] Loaded successfully');
  }).catch(err => {
    console.error('[Flint] Failed to load:', err.message);
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      console.log('[Flint] Window displayed');
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App Lifecycle ──────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Start Python agent before creating window
    startAgent();
    createWindow();
    console.log('[Flint] App ready — desktop mode');
  });

  app.on('window-all-closed', () => {
    stopAgent();
    app.quit();
  });

  app.on('before-quit', () => {
    stopAgent();
  });

  app.on('activate', () => {
    if (mainWindow === null) createWindow();
  });
}
