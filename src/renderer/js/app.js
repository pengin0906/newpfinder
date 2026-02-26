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

  // Start watching this dir
  ipc.watchDir(tab.path);

  renderFileList();
  renderStatusBar();
}

function navigateTo(dirPath) {
  const tab = getActiveTab();
  if (!tab) return;

  // Trim forward history
  tab.history = tab.history.slice(0, tab.historyIndex + 1);
  tab.history.push(dirPath);
  tab.historyIndex = tab.history.length - 1;
  tab.path = dirPath;
  tab.selectedFiles = [];
  store.focusedIndex = -1;
  store.searchQuery = '';

  renderToolbar();
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
  if (tag === 'input' || tag === 'textarea') return;

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
      renderFileList();
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

  // Ctrl+L — focus path bar
  if (e.ctrlKey && e.key === 'l') {
    e.preventDefault();
    const input = document.getElementById('search-input');
    if (input) input.focus();
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

  // Arrow keys for file navigation
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
    renderFileList();
    renderStatusBar();
    // Scroll into view
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

  // Ctrl+A — select all
  if (e.ctrlKey && e.key === 'a') {
    e.preventDefault();
    const tab = getActiveTab();
    if (tab) {
      tab.selectedFiles = getCurrentFiles().map(f => f.path);
      renderFileList();
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

  // Sidebar
  if (theme.sidebar) {
    root.style.setProperty('--sidebar-width', theme.sidebar.width + 'px');
    root.style.setProperty('--sidebar-bg', theme.sidebar.background);
    root.style.setProperty('--sidebar-brand-color', theme.sidebar.brandColor);
    root.style.setProperty('--sidebar-text-color', theme.sidebar.textColor);
    root.style.setProperty('--sidebar-active-color', theme.sidebar.activeColor);
    root.style.setProperty('--sidebar-hover-bg', theme.sidebar.hoverBg);
    root.style.setProperty('--sidebar-section-color', theme.sidebar.sectionColor);
  }

  // Content
  if (theme.content) {
    root.style.setProperty('--content-bg', theme.content.background);
    root.style.setProperty('--card-bg', theme.content.cardBg);
    root.style.setProperty('--card-border', theme.content.cardBorder);
    root.style.setProperty('--card-radius', theme.content.cardRadius + 'px');
  }

  // Toolbar
  if (theme.toolbar) {
    root.style.setProperty('--toolbar-height', theme.toolbar.height + 'px');
    root.style.setProperty('--toolbar-bg', theme.toolbar.background);
    root.style.setProperty('--toolbar-border', theme.toolbar.borderColor);
  }

  // Tab bar
  if (theme.tabBar) {
    root.style.setProperty('--tab-height', theme.tabBar.height + 'px');
    root.style.setProperty('--tab-active-bg', theme.tabBar.activeBg);
    root.style.setProperty('--tab-inactive-bg', theme.tabBar.inactiveBg);
  }

  // Status bar
  if (theme.statusBar) {
    root.style.setProperty('--statusbar-height', theme.statusBar.height + 'px');
    root.style.setProperty('--statusbar-bg', theme.statusBar.background);
    root.style.setProperty('--statusbar-text', theme.statusBar.textColor);
  }

  // Accent
  if (theme.accent) {
    root.style.setProperty('--accent-primary', theme.accent.primary);
    root.style.setProperty('--accent-success', theme.accent.success);
    root.style.setProperty('--accent-warning', theme.accent.warning);
    root.style.setProperty('--accent-danger', theme.accent.danger);
    root.style.setProperty('--accent-info', theme.accent.info);
  }

  // File list
  if (theme.fileList) {
    root.style.setProperty('--fl-row-height', theme.fileList.rowHeight + 'px');
    root.style.setProperty('--fl-icon-size', theme.fileList.iconSize + 'px');
    root.style.setProperty('--fl-selected-bg', theme.fileList.selectedBg);
    root.style.setProperty('--fl-selected-border', theme.fileList.selectedBorder);
    root.style.setProperty('--fl-hover-bg', theme.fileList.hoverBg);
  }

  // Font
  if (theme.font) {
    root.style.setProperty('--font-family', theme.font.family);
    root.style.setProperty('--font-size', theme.font.sizeBase + 'px');
    root.style.setProperty('--font-size-sm', theme.font.sizeSm + 'px');
    root.style.setProperty('--font-mono', theme.font.monoFamily);
  }
}

// Boot
document.addEventListener('DOMContentLoaded', init);
