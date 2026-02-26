/**
 * IPC handlers — all main-process IPC in one file (pforce pattern: single router)
 */

'use strict';

const { ipcMain, shell } = require('electron');
const fileService = require('../services/file-service');
const gitService = require('../services/git-service');
const idService = require('../services/id-service');
const config = require('../services/config-service');

function register(mainWindow, watcher) {
  // --- File operations ---
  ipcMain.handle('readDir', (_e, dirPath, showHidden) =>
    fileService.readDir(dirPath, showHidden));

  ipcMain.handle('getFileInfo', (_e, filePath) =>
    fileService.getFileInfo(filePath));

  ipcMain.handle('copyFiles', (_e, srcPaths, destDir) =>
    fileService.copyFiles(srcPaths, destDir));

  ipcMain.handle('moveFiles', (_e, srcPaths, destDir) =>
    fileService.moveFiles(srcPaths, destDir));

  ipcMain.handle('trashFiles', (_e, filePaths) =>
    fileService.trashFiles(filePaths));

  ipcMain.handle('renameFile', (_e, oldPath, newName) =>
    fileService.renameFile(oldPath, newName));

  ipcMain.handle('createFolder', (_e, dirPath, name) =>
    fileService.createFolder(dirPath, name));

  ipcMain.handle('createFile', (_e, dirPath, name) =>
    fileService.createFile(dirPath, name));

  ipcMain.handle('openFile', (_e, filePath) =>
    fileService.openFile(filePath));

  ipcMain.handle('getDiskUsage', (_e, dirPath) =>
    fileService.getDiskUsage(dirPath));

  ipcMain.handle('openExternal', (_e, url) => {
    shell.openExternal(url);
    return { ok: true };
  });

  // --- Git ---
  ipcMain.handle('getGitInfo', (_e, dirPath) =>
    gitService.getGitInfo(dirPath));

  // --- Config ---
  ipcMain.handle('getTheme', () => ({ ok: true, data: config.getTheme() }));
  ipcMain.handle('getCategories', () => ({ ok: true, data: config.getCategories() }));

  // --- ID service ---
  ipcMain.handle('idStats', () => ({
    ok: true,
    data: { tracked: idService.size() },
  }));

  // --- Watcher control ---
  ipcMain.handle('watchDir', (_e, dirPath) => {
    watcher.watch(dirPath, (event, filePath) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('fs:changed', { event, path: filePath });
      }
    });
    return { ok: true };
  });

  ipcMain.handle('unwatchDir', () => {
    watcher.stop();
    return { ok: true };
  });

  // --- Clipboard path ---
  ipcMain.handle('readClipboardPath', () => {
    const { clipboard } = require('electron');
    return { ok: true, data: clipboard.readText() };
  });

  ipcMain.handle('writeClipboardText', (_e, text) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
    return { ok: true };
  });
}

module.exports = { register };
