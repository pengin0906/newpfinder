/**
 * bookmark-service.js — Persistent bookmarks
 * Stored as JSON in ~/.config/newpfinder/bookmarks.json
 */

'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'newpfinder');
const BOOKMARKS_FILE = path.join(CONFIG_DIR, 'bookmarks.json');

let _bookmarks = [];

function load() {
  try {
    if (fs.existsSync(BOOKMARKS_FILE)) {
      _bookmarks = JSON.parse(fs.readFileSync(BOOKMARKS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[bookmark] Failed to load:', e.message);
    _bookmarks = [];
  }
  return _bookmarks;
}

async function save() {
  try {
    await fsp.mkdir(CONFIG_DIR, { recursive: true });
    await fsp.writeFile(BOOKMARKS_FILE, JSON.stringify(_bookmarks, null, 2), 'utf8');
  } catch (e) {
    console.error('[bookmark] Failed to save:', e.message);
  }
}

function getAll() {
  return [..._bookmarks];
}

function add(dirPath, name) {
  if (_bookmarks.some(b => b.path === dirPath)) return false;
  _bookmarks.push({ name: name || path.basename(dirPath), path: dirPath });
  save();
  return true;
}

function remove(dirPath) {
  const idx = _bookmarks.findIndex(b => b.path === dirPath);
  if (idx < 0) return false;
  _bookmarks.splice(idx, 1);
  save();
  return true;
}

function rename(dirPath, newName) {
  const bm = _bookmarks.find(b => b.path === dirPath);
  if (!bm) return false;
  bm.name = newName;
  save();
  return true;
}

module.exports = { load, getAll, add, remove, rename };
