/**
 * store.js — Global state (pforce pattern)
 * Single source of truth for all UI state.
 */

'use strict';

const store = {
  // Tabs
  tabs: [],
  activeTabIndex: 0,

  // View state
  viewMode: 'detail',        // 'detail' | 'grid'
  showHidden: false,
  showSidebar: true,
  showPreview: false,
  showDualPane: false,
  darkTheme: false,

  // Search
  searchQuery: '',

  // Clipboard
  clipboard: [],              // paths
  clipboardMode: null,        // 'copy' | 'cut'

  // Selection
  focusedIndex: -1,

  // Preview
  previewFile: null,           // currently previewed file entry

  // Bookmarks
  bookmarks: [],

  // Theme (loaded from YAML via IPC)
  theme: {},

  // Categories (loaded from YAML via IPC)
  categories: {},

  // Git file statuses for current dir
  _gitFileStatuses: {},
};

function createTab(dirPath) {
  return {
    path: dirPath,
    history: [dirPath],
    historyIndex: 0,
    selectedFiles: [],       // paths
    sortBy: 'name',
    sortAsc: true,
  };
}

function getActiveTab() {
  return store.tabs[store.activeTabIndex] || null;
}
