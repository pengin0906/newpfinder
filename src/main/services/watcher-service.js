/**
 * watcher-service.js — chokidar file watcher
 * Notifies renderer of filesystem changes in the current directory.
 */

'use strict';

const chokidar = require('chokidar');

let _watcher = null;
let _callback = null;

function watch(dirPath, onChange) {
  stop();
  _callback = onChange;
  _watcher = chokidar.watch(dirPath, {
    depth: 0,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  _watcher.on('all', (event, filePath) => {
    if (_callback) _callback(event, filePath);
  });
}

function stop() {
  if (_watcher) {
    _watcher.close();
    _watcher = null;
  }
}

module.exports = { watch, stop };
