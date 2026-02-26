/**
 * file-service.js — Filesystem operations with pforce-longid + KVS cache
 *
 * Performance:
 * - KVS cache (2s TTL, invalidated by watcher)
 * - Parallel stat() via Promise.all (not sequential await)
 * - ID assignment is O(1) Map lookup
 */

'use strict';

const fsp = require('fs').promises;
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const idService = require('./id-service');
const config = require('./config-service');
const kvs = require('./kvs');

const DIR_CACHE_TTL = 2000; // 2s — watcher invalidates on change

/**
 * Read a directory and return entries with pforce IDs.
 * KVS cached + parallel stat().
 */
async function readDir(dirPath, showHidden = false) {
  const cacheKey = `dir:${dirPath}:${showHidden ? 1 : 0}`;
  const cached = kvs.get(cacheKey);
  if (cached) return { ok: true, data: cached };

  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    const visible = entries.filter(e => showHidden || !e.name.startsWith('.'));

    // Parallel stat — ALL at once, not one-by-one
    const statResults = await Promise.all(
      visible.map(e => fsp.stat(path.join(dirPath, e.name)).catch(() => null))
    );

    const result = visible.map((entry, i) => {
      const fullPath = path.join(dirPath, entry.name);
      const ext = path.extname(entry.name).toLowerCase();
      const isDir = entry.isDirectory();
      const isSymlink = entry.isSymbolicLink();
      const id = idService.idFor(fullPath, ext, isDir, isSymlink);
      const stat = statResults[i];

      return {
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
      };
    });

    kvs.set(cacheKey, result, DIR_CACHE_TTL);
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
  kvs.invalidateDir(destDir);
  return { ok: true, data: results };
}

/**
 * Move files.
 */
async function moveFiles(srcPaths, destDir) {
  const results = [];
  for (const src of srcPaths) {
    const srcDir = path.dirname(src);
    const dest = path.join(destDir, path.basename(src));
    try {
      await fsp.rename(src, dest);
      idService.rename(src, dest);
      results.push({ src, dest, ok: true });
    } catch (e) {
      results.push({ src, dest, ok: false, error: e.message });
    }
    kvs.invalidateDir(srcDir);
  }
  kvs.invalidateDir(destDir);
  return { ok: true, data: results };
}

/**
 * Delete files (move to trash via gio, fallback to rm).
 */
async function trashFiles(filePaths) {
  const results = [];
  const dirs = new Set();
  for (const fp of filePaths) {
    dirs.add(path.dirname(fp));
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
  for (const d of dirs) kvs.invalidateDir(d);
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
    kvs.invalidateDir(dir);
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
    kvs.invalidateDir(dirPath);
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
    kvs.invalidateDir(dirPath);
    return { ok: true, data: { path: fullPath } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Read first N lines of a text file (for preview).
 */
async function readTextFile(filePath, maxLines = 60) {
  try {
    const buf = await fsp.readFile(filePath);
    // Binary check: if too many non-text bytes, bail
    let nullCount = 0;
    const check = Math.min(buf.length, 8192);
    for (let i = 0; i < check; i++) { if (buf[i] === 0) nullCount++; }
    if (nullCount > check * 0.1) return { ok: false, error: 'Binary file' };

    const content = buf.toString('utf8');
    const lines = content.split('\n');
    return {
      ok: true,
      data: {
        content: lines.slice(0, maxLines).join('\n'),
        totalLines: lines.length,
        truncated: lines.length > maxLines,
      },
    };
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
 * Get disk usage for a path (cached 10s).
 */
async function getDiskUsage(dirPath) {
  const cacheKey = `disk:${dirPath}`;
  const cached = kvs.get(cacheKey);
  if (cached) return cached;

  return new Promise((resolve) => {
    exec(`df -B1 "${dirPath}" 2>/dev/null | tail -1`, (err, stdout) => {
      if (err) return resolve({ ok: false });
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 4) {
        const result = {
          ok: true,
          data: {
            total: parseInt(parts[1]) || 0,
            used: parseInt(parts[2]) || 0,
            free: parseInt(parts[3]) || 0,
          },
        };
        kvs.set(cacheKey, result, 10000);
        resolve(result);
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
  readTextFile,
  getDiskUsage,
};
