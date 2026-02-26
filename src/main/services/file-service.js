/**
 * file-service.js — Filesystem operations with pforce-longid integration
 *
 * Every file entry returned includes a BigInt ID (as hex string for IPC).
 * Category is determined at read time from extension → YAML mapping.
 */

'use strict';

const fsp = require('fs').promises;
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const idService = require('./id-service');
const config = require('./config-service');

/**
 * Read a directory and return entries with pforce IDs.
 * @param {string} dirPath  Absolute directory path
 * @param {boolean} showHidden  Include dotfiles
 * @returns {Promise<{ok: boolean, data?: Array, error?: string}>}
 */
async function readDir(dirPath, showHidden = false) {
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
      if (!showHidden && entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);
      const ext = path.extname(entry.name).toLowerCase();
      const isDir = entry.isDirectory();
      const isSymlink = entry.isSymbolicLink();

      // Assign pforce-longid
      const id = idService.idFor(fullPath, ext, isDir, isSymlink);

      let stat = null;
      try {
        stat = await fsp.stat(fullPath);
      } catch {}

      result.push({
        id: idService.toHex(id),
        name: entry.name,
        path: fullPath,
        isDirectory: isDir,
        isSymlink,
        size: stat ? stat.size : 0,
        modified: stat ? stat.mtimeMs : 0,
        created: stat ? stat.birthtimeMs : 0,
        ext,
        category: idService.categoryOf(id),
        categoryColor: config.categoryColor(idService.categoryOf(id)),
      });
    }

    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Get stat info for a single file with ID.
 */
async function getFileInfo(filePath) {
  try {
    const stat = await fsp.stat(filePath);
    const lstat = await fsp.lstat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const isDir = stat.isDirectory();
    const isSymlink = lstat.isSymbolicLink();
    const id = idService.idFor(filePath, ext, isDir, isSymlink);

    return {
      ok: true,
      data: {
        id: idService.toHex(id),
        name: path.basename(filePath),
        path: filePath,
        isDirectory: isDir,
        isSymlink,
        size: stat.size,
        modified: stat.mtimeMs,
        created: stat.birthtimeMs,
        accessed: stat.atimeMs,
        ext,
        category: idService.categoryOf(id),
        categoryColor: config.categoryColor(idService.categoryOf(id)),
        permissions: '0' + (stat.mode & 0o777).toString(8),
        uid: stat.uid,
        gid: stat.gid,
      },
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Copy files.
 */
async function copyFiles(srcPaths, destDir) {
  const results = [];
  for (const src of srcPaths) {
    const dest = path.join(destDir, path.basename(src));
    try {
      await fsp.cp(src, dest, { recursive: true });
      results.push({ src, dest, ok: true });
    } catch (e) {
      results.push({ src, dest, ok: false, error: e.message });
    }
  }
  return { ok: true, data: results };
}

/**
 * Move files.
 */
async function moveFiles(srcPaths, destDir) {
  const results = [];
  for (const src of srcPaths) {
    const dest = path.join(destDir, path.basename(src));
    try {
      await fsp.rename(src, dest);
      idService.rename(src, dest);
      results.push({ src, dest, ok: true });
    } catch (e) {
      results.push({ src, dest, ok: false, error: e.message });
    }
  }
  return { ok: true, data: results };
}

/**
 * Delete files (move to trash via gio, fallback to rm).
 */
async function trashFiles(filePaths) {
  const results = [];
  for (const fp of filePaths) {
    try {
      await new Promise((resolve, reject) => {
        exec(`gio trash "${fp}"`, (err) => {
          if (err) reject(err); else resolve();
        });
      });
      idService.remove(fp);
      results.push({ path: fp, ok: true });
    } catch {
      try {
        await fsp.rm(fp, { recursive: true });
        idService.remove(fp);
        results.push({ path: fp, ok: true });
      } catch (e2) {
        results.push({ path: fp, ok: false, error: e2.message });
      }
    }
  }
  return { ok: true, data: results };
}

/**
 * Rename a file.
 */
async function renameFile(oldPath, newName) {
  const dir = path.dirname(oldPath);
  const newPath = path.join(dir, newName);
  try {
    await fsp.rename(oldPath, newPath);
    idService.rename(oldPath, newPath);
    return { ok: true, data: { oldPath, newPath } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Create a new folder.
 */
async function createFolder(dirPath, name) {
  const fullPath = path.join(dirPath, name);
  try {
    await fsp.mkdir(fullPath);
    return { ok: true, data: { path: fullPath } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Create a new file.
 */
async function createFile(dirPath, name) {
  const fullPath = path.join(dirPath, name);
  try {
    await fsp.writeFile(fullPath, '', 'utf8');
    return { ok: true, data: { path: fullPath } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Open a file with system default application.
 */
function openFile(filePath) {
  const { shell } = require('electron');
  shell.openPath(filePath);
  return { ok: true };
}

/**
 * Get disk usage for a path.
 */
async function getDiskUsage(dirPath) {
  return new Promise((resolve) => {
    exec(`df -B1 "${dirPath}" 2>/dev/null | tail -1`, (err, stdout) => {
      if (err) return resolve({ ok: false });
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 4) {
        resolve({
          ok: true,
          data: {
            total: parseInt(parts[1]) || 0,
            used: parseInt(parts[2]) || 0,
            free: parseInt(parts[3]) || 0,
          },
        });
      } else {
        resolve({ ok: false });
      }
    });
  });
}

module.exports = {
  readDir,
  getFileInfo,
  copyFiles,
  moveFiles,
  trashFiles,
  renameFile,
  createFolder,
  createFile,
  openFile,
  getDiskUsage,
};
