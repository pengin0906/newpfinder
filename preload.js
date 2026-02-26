/**
 * preload.js — Context bridge (secure IPC)
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Environment
  homeDir: require('os').homedir(),

  // File operations
  readDir:          (dir, showHidden) => ipcRenderer.invoke('readDir', dir, showHidden),
  getFileInfo:      (path) => ipcRenderer.invoke('getFileInfo', path),
  copyFiles:        (srcs, dest) => ipcRenderer.invoke('copyFiles', srcs, dest),
  moveFiles:        (srcs, dest) => ipcRenderer.invoke('moveFiles', srcs, dest),
  trashFiles:       (paths) => ipcRenderer.invoke('trashFiles', paths),
  renameFile:       (old, name) => ipcRenderer.invoke('renameFile', old, name),
  createFolder:     (dir, name) => ipcRenderer.invoke('createFolder', dir, name),
  createFile:       (dir, name) => ipcRenderer.invoke('createFile', dir, name),
  openFile:         (path) => ipcRenderer.invoke('openFile', path),
  readTextFile:     (path, maxLines) => ipcRenderer.invoke('readTextFile', path, maxLines),
  getDiskUsage:     (dir) => ipcRenderer.invoke('getDiskUsage', dir),

  // Archive
  listArchive:      (path) => ipcRenderer.invoke('listArchive', path),
  extractArchive:   (path, dest) => ipcRenderer.invoke('extractArchive', path, dest),
  createArchive:    (srcs, dest, fmt) => ipcRenderer.invoke('createArchive', srcs, dest, fmt),
  isArchive:        (path) => ipcRenderer.invoke('isArchive', path),

  // Git
  getGitInfo:       (dir) => ipcRenderer.invoke('getGitInfo', dir),

  // Config
  getTheme:         () => ipcRenderer.invoke('getTheme'),
  getCategories:    () => ipcRenderer.invoke('getCategories'),

  // ID
  idStats:          () => ipcRenderer.invoke('idStats'),

  // Bookmarks
  getBookmarks:     () => ipcRenderer.invoke('getBookmarks'),
  addBookmark:      (path, name) => ipcRenderer.invoke('addBookmark', path, name),
  removeBookmark:   (path) => ipcRenderer.invoke('removeBookmark', path),
  renameBookmark:   (path, name) => ipcRenderer.invoke('renameBookmark', path, name),

  // Watcher
  watchDir:         (dir) => ipcRenderer.invoke('watchDir', dir),
  unwatchDir:       () => ipcRenderer.invoke('unwatchDir'),
  onFsChanged:      (cb) => ipcRenderer.on('fs:changed', (_e, data) => cb(data)),

  // Clipboard
  writeClipboard:   (text) => ipcRenderer.invoke('writeClipboardText', text),
});
