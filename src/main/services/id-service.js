/**
 * id-service.js — pforce-longid wrapper for file management
 *
 * Every file/folder gets a BigInt ID. Category is encoded in the upper 8 bits.
 * path → ID mapping is bidirectional and persistent across sessions.
 */

'use strict';

const lid = require('pforce-longid');
const path = require('path');
const fs = require('fs');
const config = require('./config-service');

/** @type {Map<string, bigint>} absolutePath → ID */
const _pathToId = new Map();

/** @type {Map<bigint, string>} ID → absolutePath */
const _idToPath = new Map();

const STATE_FILE = path.join(__dirname, '..', '..', '..', '.pfinder-state.json');

/**
 * Initialize: load categories into pforce-longid + restore saved state.
 */
function init() {
  // Register categories from YAML config
  const cats = config.getCategories();
  lid.reset();
  for (const [name, code] of Object.entries(cats)) {
    lid.defineCategory(Number(code), name);
  }

  // Restore persisted state
  _loadState();
}

/**
 * Get or create a BigInt ID for a file path.
 * @param {string} filePath  Absolute path
 * @param {string} ext       File extension (e.g. '.jpg')
 * @param {boolean} isDir    Is it a directory?
 * @param {boolean} isSymlink Is it a symlink?
 * @returns {bigint}
 */
function idFor(filePath, ext, isDir, isSymlink) {
  const existing = _pathToId.get(filePath);
  if (existing !== undefined) return existing;

  // Determine category
  let cat;
  if (isSymlink) cat = 'symlink';
  else if (isDir) cat = 'folder';
  else cat = config.categoryForExt(ext || '');

  // Generate new ID
  const id = lid.generate(cat);
  _pathToId.set(filePath, id);
  _idToPath.set(id, filePath);
  return id;
}

/**
 * Resolve an ID back to its path.
 */
function pathFor(id) {
  return _idToPath.get(id) || null;
}

/**
 * Get category name from ID (O(1) bitwise).
 */
function categoryOf(id) {
  return lid.categoryName(id);
}

/**
 * Get category code from ID.
 */
function categoryCodeOf(id) {
  return lid.categoryOf(id);
}

/**
 * Check if two IDs share the same category.
 */
function sameCategory(a, b) {
  return lid.sameCategory(a, b);
}

/**
 * Remove a path→ID mapping (e.g. file deleted).
 */
function remove(filePath) {
  const id = _pathToId.get(filePath);
  if (id !== undefined) {
    _pathToId.delete(filePath);
    _idToPath.delete(id);
  }
}

/**
 * Rename: update path mapping, keep same ID.
 */
function rename(oldPath, newPath) {
  const id = _pathToId.get(oldPath);
  if (id !== undefined) {
    _pathToId.delete(oldPath);
    _pathToId.set(newPath, id);
    _idToPath.set(id, newPath);
  }
}

/**
 * Get all IDs in a specific category.
 */
function allInCategory(categoryName) {
  const code = config.getCategoryCode(categoryName);
  if (code === null) return [];
  const catBig = BigInt(Number(code));
  const result = [];
  for (const [id] of _idToPath) {
    if ((id >> 56n) === catBig) result.push(id);
  }
  return result;
}

/**
 * Total tracked files.
 */
function size() {
  return _pathToId.size;
}

/**
 * Serialize ID to hex string (for renderer transport).
 */
function toHex(id) {
  return lid.toHex(id);
}

/**
 * Deserialize hex string to BigInt ID.
 */
function fromHex(hex) {
  return lid.fromHex(hex);
}

/**
 * Save state to disk for persistence across sessions.
 */
function saveState() {
  try {
    const data = {};
    // Save counters
    data.counters = {};
    const cats = config.getCategories();
    for (const [name] of Object.entries(cats)) {
      try {
        // Get current counter by generating + rolling back... or just export
      } catch {}
    }

    // Just save path→hex mappings (compact)
    const mappings = [];
    for (const [p, id] of _pathToId) {
      mappings.push([p, lid.toHex(id)]);
    }
    data.mappings = mappings;

    // Export lid state (counters)
    data.lidState = lid.exportState();
    // Clear entries from lid export — we manage our own registry
    data.lidState.entries = [];

    fs.writeFileSync(STATE_FILE, JSON.stringify(data), 'utf8');
  } catch (e) {
    console.error('[id-service] Failed to save state:', e.message);
  }
}

/**
 * Load persisted state.
 */
function _loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const data = JSON.parse(raw);

    // Restore lid counters
    if (data.lidState) {
      lid.importState(data.lidState);
    }

    // Restore path ↔ ID mappings
    if (data.mappings) {
      for (const [p, hex] of data.mappings) {
        const id = lid.fromHex(hex);
        _pathToId.set(p, id);
        _idToPath.set(id, p);
      }
    }
  } catch (e) {
    console.error('[id-service] Failed to load state:', e.message);
  }
}

module.exports = {
  init,
  idFor,
  pathFor,
  categoryOf,
  categoryCodeOf,
  sameCategory,
  remove,
  rename,
  allInCategory,
  size,
  toHex,
  fromHex,
  saveState,
};
