/**
 * NewPfinder — Electron main process
 * pforce-longid powered file explorer
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const config = require('./src/main/services/config-service');
const idService = require('./src/main/services/id-service');
const bookmarkService = require('./src/main/services/bookmark-service');
const watcher = require('./src/main/services/watcher-service');
const ipcHandlers = require('./src/main/ipc/handlers');

let mainWindow = null;

function createWindow() {
  const theme = config.getTheme();
  const win = theme.window || {};

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: win.minWidth || 1024,
    minHeight: win.minHeight || 600,
    title: 'NewPfinder',
    icon: path.join(__dirname, 'src/renderer/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile('src/renderer/index.html');

  // Forward renderer console to main process stdout
  mainWindow.webContents.on('console-message', (_e, level, msg, line, sourceId) => {
    const tag = ['LOG', 'WARN', 'ERR'][level] || 'LOG';
    console.log(`[renderer:${tag}] ${msg}  (${sourceId}:${line})`);
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- App lifecycle ---

app.whenReady().then(() => {
  // 1. Load YAML configs
  config.loadAll();

  // 2. Init pforce-longid with categories
  idService.init();

  // 3. Load bookmarks
  bookmarkService.load();

  // 4. Create window
  createWindow();

  // 4. Register IPC handlers
  ipcHandlers.register(mainWindow, watcher);

  console.log('[NewPfinder] Ready. Tracked files:', idService.size());
});

app.on('window-all-closed', () => {
  // Save ID state before quit
  idService.saveState();
  watcher.stop();
  app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});

// Save state periodically (every 60s)
setInterval(() => {
  idService.saveState();
}, 60000);
