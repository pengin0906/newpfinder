/**
 * config-service.js — YAML-driven configuration (pforce pattern)
 *
 * Loads categories.yaml + theme.yaml → exposes as JS objects.
 * Watches for changes → emits 'config:changed' so UI reloads live.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONFIG_DIR = path.join(__dirname, '..', '..', '..', 'config');

let _categories = null;   // parsed categories.yaml
let _theme = null;         // parsed theme.yaml
let _extMap = null;        // extension → category name (built from categories.yaml)

/**
 * Load all config files. Call once at startup.
 */
function loadAll() {
  _categories = _loadYaml('categories.yaml');
  _theme = _loadYaml('theme.yaml');
  _buildExtMap();
}

/**
 * Get the full theme config.
 */
function getTheme() {
  return _theme ? _theme.theme : {};
}

/**
 * Get category code by name.
 */
function getCategoryCode(name) {
  if (!_categories || !_categories.categories) return null;
  return _categories.categories[name] ?? null;
}

/**
 * Get all categories { name → code }.
 */
function getCategories() {
  return _categories ? _categories.categories : {};
}

/**
 * Get category name for a file extension.
 * @param {string} ext  e.g. '.jpg', '.py'
 * @returns {string} category name or 'other'
 */
function categoryForExt(ext) {
  if (!_extMap) _buildExtMap();
  return _extMap.get(ext.toLowerCase()) || 'other';
}

/**
 * Get category color from theme.
 */
function categoryColor(categoryName) {
  const t = getTheme();
  return (t.categoryColors && t.categoryColors[categoryName]) || '#757575';
}

/**
 * Reload a specific config file.
 */
function reload(filename) {
  if (filename === 'categories.yaml') {
    _categories = _loadYaml('categories.yaml');
    _buildExtMap();
  } else if (filename === 'theme.yaml') {
    _theme = _loadYaml('theme.yaml');
  }
}

// --- Internal ---

function _loadYaml(filename) {
  const filePath = path.join(CONFIG_DIR, filename);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return yaml.load(raw);
  } catch (e) {
    console.error(`[config] Failed to load ${filename}:`, e.message);
    return {};
  }
}

function _buildExtMap() {
  _extMap = new Map();
  if (!_categories || !_categories.extensions) return;

  for (const [cat, exts] of Object.entries(_categories.extensions)) {
    if (!Array.isArray(exts)) continue;
    for (const ext of exts) {
      _extMap.set(ext.toLowerCase(), cat);
    }
  }
}

module.exports = {
  loadAll,
  getTheme,
  getCategories,
  getCategoryCode,
  categoryForExt,
  categoryColor,
  reload,
};
