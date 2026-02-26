/**
 * archive-service.js — Archive browsing & extraction
 * Supports: zip, tar, tar.gz, tar.bz2, tar.xz, gz
 * Uses standard Linux CLI tools (unzip, tar).
 */

'use strict';

const { exec } = require('child_process');
const path = require('path');
const fsp = require('fs').promises;

/**
 * List contents of an archive.
 * Returns array of { name, size, isDirectory, modified }.
 */
async function listArchive(archivePath) {
  const ext = archivePath.toLowerCase();

  if (ext.endsWith('.zip')) return _listZip(archivePath);
  if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) return _listTar(archivePath, 'z');
  if (ext.endsWith('.tar.bz2') || ext.endsWith('.tbz2')) return _listTar(archivePath, 'j');
  if (ext.endsWith('.tar.xz') || ext.endsWith('.txz')) return _listTar(archivePath, 'J');
  if (ext.endsWith('.tar')) return _listTar(archivePath, '');

  return { ok: false, error: 'Unsupported archive format' };
}

/**
 * Extract archive to destination directory.
 */
async function extractArchive(archivePath, destDir) {
  const ext = archivePath.toLowerCase();

  try {
    await fsp.mkdir(destDir, { recursive: true });

    if (ext.endsWith('.zip')) {
      await _exec(`unzip -o -q "${archivePath}" -d "${destDir}"`);
    } else if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) {
      await _exec(`tar -xzf "${archivePath}" -C "${destDir}"`);
    } else if (ext.endsWith('.tar.bz2') || ext.endsWith('.tbz2')) {
      await _exec(`tar -xjf "${archivePath}" -C "${destDir}"`);
    } else if (ext.endsWith('.tar.xz') || ext.endsWith('.txz')) {
      await _exec(`tar -xJf "${archivePath}" -C "${destDir}"`);
    } else if (ext.endsWith('.tar')) {
      await _exec(`tar -xf "${archivePath}" -C "${destDir}"`);
    } else {
      return { ok: false, error: 'Unsupported archive format' };
    }
    return { ok: true, data: { destDir } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Compress files into an archive.
 */
async function createArchive(srcPaths, destPath, format = 'zip') {
  try {
    const names = srcPaths.map(p => `"${path.basename(p)}"`).join(' ');
    const cwd = path.dirname(srcPaths[0]);

    if (format === 'zip') {
      await _exec(`cd "${cwd}" && zip -r "${destPath}" ${names}`);
    } else if (format === 'tar.gz') {
      await _exec(`cd "${cwd}" && tar -czf "${destPath}" ${names}`);
    } else {
      return { ok: false, error: 'Unsupported format: ' + format };
    }
    return { ok: true, data: { path: destPath } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// --- Internal ---

function _listZip(archivePath) {
  return new Promise((resolve) => {
    exec(`unzip -l "${archivePath}"`, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ ok: false, error: err.message });

      const lines = stdout.split('\n');
      const entries = [];
      // unzip -l format: "  Length      Date    Time    Name"
      // Skip header/footer lines
      let inBody = false;
      for (const line of lines) {
        if (line.startsWith('--------')) {
          inBody = !inBody;
          continue;
        }
        if (!inBody) continue;

        const match = line.match(/^\s*(\d+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)$/);
        if (!match) continue;

        const size = parseInt(match[1]);
        const modified = new Date(match[2]).getTime();
        const name = match[3];
        const isDirectory = name.endsWith('/');

        entries.push({
          name: isDirectory ? name.slice(0, -1) : name,
          size,
          isDirectory,
          modified,
        });
      }
      resolve({ ok: true, data: entries });
    });
  });
}

function _listTar(archivePath, flag) {
  return new Promise((resolve) => {
    exec(`tar -t${flag}vf "${archivePath}"`, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ ok: false, error: err.message });

      const entries = [];
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;
        // tar -tv format: "-rw-r--r-- user/group  size date time name"
        const parts = line.split(/\s+/);
        if (parts.length < 6) continue;

        const perms = parts[0];
        const size = parseInt(parts[2]) || 0;
        const dateStr = parts[3] + ' ' + parts[4];
        const name = parts.slice(5).join(' ');
        const isDirectory = perms.startsWith('d');

        entries.push({
          name: isDirectory && name.endsWith('/') ? name.slice(0, -1) : name,
          size,
          isDirectory,
          modified: new Date(dateStr).getTime() || 0,
        });
      }
      resolve({ ok: true, data: entries });
    });
  });
}

function _exec(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

/**
 * Check if a file is an archive we can browse.
 */
function isArchive(filePath) {
  const ext = filePath.toLowerCase();
  return ext.endsWith('.zip') || ext.endsWith('.tar') ||
    ext.endsWith('.tar.gz') || ext.endsWith('.tgz') ||
    ext.endsWith('.tar.bz2') || ext.endsWith('.tbz2') ||
    ext.endsWith('.tar.xz') || ext.endsWith('.txz');
}

module.exports = { listArchive, extractArchive, createArchive, isArchive };
