/**
 * app.js — Application entry point
 * Init, navigation, keyboard shortcuts, filesystem watcher.
 */

'use strict';

async function init() {
  // Load theme from YAML config via IPC
  const themeResult = await ipc.getTheme();
  if (themeResult.ok) {
    store.theme = themeResult.data;
    applyThemeCSS(store.theme);
  }

  // Load categories
  const catResult = await ipc.getCategories();
  if (catResult.ok) store.categories = catResult.data;

  // Create initial tab
  const home = ipc.homeDir || '/home';
  store.tabs.push(createTab(home));

  // Render everything
  renderSidebar();
  renderToolbar();
  renderTabBar();
  renderStatusBar();

  // Load directory
  await loadCurrentDir();

  // Watch for filesystem changes
  ipc.onFsChanged(() => loadCurrentDir());

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeydown);

  console.log('[NewPfinder] Ready');
}

async function loadCurrentDir() {
  const tab = getActiveTab();
  if (!tab) return;

  // Save scroll position
  const fl = document.getElementById('file-list');
  const scrollTop = fl ? fl.scrollTop : 0;

  const result = await ipc.readDir(tab.path, store.showHidden);
  if (!result.ok) {
    showToast('\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3092\u8AAD\u3081\u307E\u305B\u3093: ' + (result.error || ''), 'error');
    return;
  }

  _allFiles = sortFiles(result.data || [], tab.sortBy, tab.sortAsc);

  if (store.searchQuery) {
    const q = store.searchQuery.toLowerCase();
    _currentFiles = _allFiles.filter(f => f.name.toLowerCase().includes(q));
  } else {
    _currentFiles = _allFiles;
  }

  // Unwatch old, watch new
  ipc.unwatchDir();
  ipc.watchDir(tab.path);

  renderFileList();
  renderStatusBar();

  // Restore scroll position
  if (fl) fl.scrollTop = scrollTop;
}

function navigateTo(dirPath) {
  const tab = getActiveTab();
  if (!tab) return;

  tab.history = tab.history.slice(0, tab.historyIndex + 1);
  tab.history.push(dirPath);
  tab.historyIndex = tab.history.length - 1;
  tab.path = dirPath;
  tab.selectedFiles = [];
  store.focusedIndex = -1;
  store.searchQuery = '';

  renderToolbar();
  renderTabBar();
  renderSidebar();
  loadCurrentDir();
}

function navigateBack() {
  const tab = getActiveTab();
  if (!tab || tab.historyIndex <= 0) return;
  tab.historyIndex--;
  tab.path = tab.history[tab.historyIndex];
  tab.selectedFiles = [];
  store.focusedIndex = -1;
  store.searchQuery = '';
  renderToolbar();
  renderTabBar();
  renderSidebar();
  loadCurrentDir();
}

function navigateForward() {
  const tab = getActiveTab();
  if (!tab || tab.historyIndex >= tab.history.length - 1) return;
  tab.historyIndex++;
  tab.path = tab.history[tab.historyIndex];
  tab.selectedFiles = [];
  store.focusedIndex = -1;
  renderToolbar();
  renderTabBar();
  renderSidebar();
  loadCurrentDir();
}

function navigateUp() {
  const tab = getActiveTab();
  if (!tab) return;
  const parent = tab.path.replace(/\/[^/]+\/?$/, '') || '/';
  if (parent !== tab.path) navigateTo(parent);
}

function handleKeydown(e) {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    // Escape blurs search input
    if (e.key === 'Escape') { e.target.blur(); e.preventDefault(); }
    return;
  }

  // Ctrl+T — new tab
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    const home = ipc.homeDir || '/home';
    store.tabs.push(createTab(home));
    store.activeTabIndex = store.tabs.length - 1;
    renderTabBar(); renderToolbar(); renderSidebar(); loadCurrentDir();
    return;
  }

  // Ctrl+W — close tab
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault();
    if (store.tabs.length > 1) {
      store.tabs.splice(store.activeTabIndex, 1);
      if (store.activeTabIndex >= store.tabs.length) store.activeTabIndex = store.tabs.length - 1;
      renderTabBar(); renderToolbar(); renderSidebar(); loadCurrentDir();
    }
    return;
  }

  // Ctrl+C / Ctrl+X / Ctrl+V
  if (e.ctrlKey && e.key === 'c') {
    e.preventDefault();
    const tab = getActiveTab();
    if (tab && tab.selectedFiles.length > 0) {
      store.clipboard = [...tab.selectedFiles];
      store.clipboardMode = 'copy';
      showToast(`${store.clipboard.length}\u30D5\u30A1\u30A4\u30EB\u30B3\u30D4\u30FC`, 'info', 1500);
    }
    return;
  }
  if (e.ctrlKey && e.key === 'x') {
    e.preventDefault();
    const tab = getActiveTab();
    if (tab && tab.selectedFiles.length > 0) {
      store.clipboard = [...tab.selectedFiles];
      store.clipboardMode = 'cut';
      _updateSelectionDOM(tab);
      showToast(`${store.clipboard.length}\u30D5\u30A1\u30A4\u30EB\u5207\u308A\u53D6\u308A`, 'info', 1500);
    }
    return;
  }
  if (e.ctrlKey && e.key === 'v') {
    e.preventDefault();
    if (store.clipboard.length > 0) {
      const tab = getActiveTab();
      if (!tab) return;
      const fn = store.clipboardMode === 'cut' ? ipc.moveFiles : ipc.copyFiles;
      fn(store.clipboard, tab.path).then(() => {
        if (store.clipboardMode === 'cut') { store.clipboard = []; store.clipboardMode = null; }
        loadCurrentDir();
      });
    }
    return;
  }

  // Ctrl+H — toggle hidden
  if (e.ctrlKey && e.key === 'h') {
    e.preventDefault();
    store.showHidden = !store.showHidden;
    loadCurrentDir();
    return;
  }

  // Ctrl+L / Ctrl+F — focus search
  if (e.ctrlKey && (e.key === 'l' || e.key === 'f')) {
    e.preventDefault();
    const input = document.getElementById('search-input');
    if (input) { input.focus(); input.select(); }
    return;
  }

  // F2 — rename
  if (e.key === 'F2') {
    e.preventDefault();
    const tab = getActiveTab();
    if (tab && tab.selectedFiles.length === 1) {
      const f = _currentFiles.find(f => f.path === tab.selectedFiles[0]);
      if (f) {
        const name = prompt('\u65B0\u3057\u3044\u540D\u524D:', f.name);
        if (name && name !== f.name) ipc.renameFile(f.path, name).then(() => loadCurrentDir());
      }
    }
    return;
  }

  // Delete — trash
  if (e.key === 'Delete') {
    e.preventDefault();
    const tab = getActiveTab();
    if (tab && tab.selectedFiles.length > 0) {
      ipc.trashFiles(tab.selectedFiles).then(() => {
        tab.selectedFiles = [];
        loadCurrentDir();
      });
    }
    return;
  }

  // Backspace / Alt+Left — back
  if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
    e.preventDefault();
    navigateBack();
    return;
  }

  // Alt+Right — forward
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    navigateForward();
    return;
  }

  // Alt+Up — parent
  if (e.altKey && e.key === 'ArrowUp') {
    e.preventDefault();
    navigateUp();
    return;
  }

  // Arrow keys — DOM direct update (no renderFileList)
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const files = getCurrentFiles();
    if (files.length === 0) return;
    if (e.key === 'ArrowDown') {
      store.focusedIndex = Math.min(store.focusedIndex + 1, files.length - 1);
    } else {
      store.focusedIndex = Math.max(store.focusedIndex - 1, 0);
    }
    const tab = getActiveTab();
    if (tab) tab.selectedFiles = [files[store.focusedIndex].path];
    _updateSelectionDOM(tab);
    renderStatusBar();
    const focused = document.querySelector('.fl-row.focused');
    if (focused) focused.scrollIntoView({ block: 'nearest' });
    return;
  }

  // Enter — open
  if (e.key === 'Enter') {
    e.preventDefault();
    const files = getCurrentFiles();
    if (store.focusedIndex >= 0 && files[store.focusedIndex]) {
      const f = files[store.focusedIndex];
      if (f.isDirectory) navigateTo(f.path);
      else ipc.openFile(f.path);
    }
    return;
  }

  // Ctrl+A — select all (DOM direct update)
  if (e.ctrlKey && e.key === 'a') {
    e.preventDefault();
    const tab = getActiveTab();
    if (tab) {
      tab.selectedFiles = getCurrentFiles().map(f => f.path);
      _updateSelectionDOM(tab);
      renderStatusBar();
    }
    return;
  }
}

/**
 * Apply YAML theme as CSS custom properties.
 */
function applyThemeCSS(theme) {
  const root = document.documentElement;
  if (!theme) return;

  const set = (k, v) => { if (v !== undefined) root.style.setProperty(k, typeof v === 'number' ? v + 'px' : v); };

  if (theme.sidebar) {
    set('--sidebar-width', theme.sidebar.width);
    set('--sidebar-bg', theme.sidebar.background);
    set('--sidebar-brand-color', theme.sidebar.brandColor);
    set('--sidebar-text-color', theme.sidebar.textColor);
    set('--sidebar-active-color', theme.sidebar.activeColor);
    set('--sidebar-hover-bg', theme.sidebar.hoverBg);
    set('--sidebar-section-color', theme.sidebar.sectionColor);
  }
  if (theme.content) {
    set('--content-bg', theme.content.background);
    set('--card-bg', theme.content.cardBg);
    set('--card-border', theme.content.cardBorder);
    set('--card-radius', theme.content.cardRadius);
  }
  if (theme.toolbar) {
    set('--toolbar-height', theme.toolbar.height);
    set('--toolbar-bg', theme.toolbar.background);
    set('--toolbar-border', theme.toolbar.borderColor);
  }
  if (theme.tabBar) {
    set('--tab-height', theme.tabBar.height);
    set('--tab-active-bg', theme.tabBar.activeBg);
    set('--tab-inactive-bg', theme.tabBar.inactiveBg);
  }
  if (theme.statusBar) {
    set('--statusbar-height', theme.statusBar.height);
    set('--statusbar-bg', theme.statusBar.background);
    set('--statusbar-text', theme.statusBar.textColor);
  }
  if (theme.accent) {
    set('--accent-primary', theme.accent.primary);
    set('--accent-success', theme.accent.success);
    set('--accent-warning', theme.accent.warning);
    set('--accent-danger', theme.accent.danger);
    set('--accent-info', theme.accent.info);
  }
  if (theme.fileList) {
    set('--fl-row-height', theme.fileList.rowHeight);
    set('--fl-icon-size', theme.fileList.iconSize);
    set('--fl-selected-bg', theme.fileList.selectedBg);
    set('--fl-selected-border', theme.fileList.selectedBorder);
    set('--fl-hover-bg', theme.fileList.hoverBg);
  }
  if (theme.font) {
    set('--font-family', theme.font.family);
    set('--font-size', theme.font.sizeBase);
    set('--font-size-sm', theme.font.sizeSm);
    set('--font-mono', theme.font.monoFamily);
  }
}

// Boot
document.addEventListener('DOMContentLoaded', init);
