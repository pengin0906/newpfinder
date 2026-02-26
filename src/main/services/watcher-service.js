/**
 * watcher-service.js — chokidar file watcher with debounce + KVS invalidation
 *
 * Multiple rapid filesystem events are collapsed into one callback (200ms debounce).
 * KVS cache is invalidated on every change so next readDir() gets fresh data.
 */

'use strict';

const chokidar = require('chokidar');
const path = require('path');
const kvs = require('./kvs');

let _watcher = null;
let _callback = null;
let _debounceTimer = null;
let _watchedDir = null;

const DEBOUNCE_MS = 200;

function watch(dirPath, onChange) {
  if (_watchedDir === dirPath) return; // already watching this dir
  stop();
  _watchedDir = dirPath;
  _callback = onChange;
  _watcher = chokidar.watch(dirPath, {
    depth: 0,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  _watcher.on('all', (event, filePath) => {
    // Invalidate KVS cache immediately
    kvs.invalidateDir(path.dirname(filePath));

    // Debounce the renderer notification
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null;
      if (_callback) _callback(event, filePath);
    }, DEBOUNCE_MS);
  });
}

function stop() {
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
  if (_watcher) { _watcher.close(); _watcher = null; }
  _watchedDir = null;
}

module.exports = { watch, stop };
