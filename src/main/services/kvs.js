/**
 * KVS — in-memory cache with TTL (from NewFinder, proven fast)
 */

'use strict';

class KVS {
  constructor() {
    this._store = new Map();
    this._sweepInterval = setInterval(() => this._sweep(), 30000);
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs = 0) {
    this._store.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    });
  }

  del(key) {
    return this._store.delete(key);
  }

  invalidatePrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) this._store.delete(key);
    }
  }

  invalidateDir(dirPath) {
    this.invalidatePrefix(`dir:${dirPath}`);
    const parent = require('path').dirname(dirPath);
    if (parent !== dirPath) this.invalidatePrefix(`dir:${parent}`);
  }

  clear() { this._store.clear(); }

  _sweep() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (entry.expiresAt && now > entry.expiresAt) this._store.delete(key);
    }
  }

  destroy() {
    clearInterval(this._sweepInterval);
    this._store.clear();
  }
}

module.exports = new KVS();
