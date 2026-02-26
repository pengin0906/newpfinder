/**
 * app.js — Application entry point
 * Init, navigation, keyboard shortcuts, view mode, theme, dual pane.
 */

'use strict';

async function init() {
  // Load theme
  const themeResult = await ipc.getTheme();
  if (themeResult.ok) {
    store.theme = themeResult.data;
    applyThemeCSS(store.theme);
  }

  // Load categories
  const catResult = await ipc.getCategories();
  if (catResult.ok) store.categories = catResult.data;

  // Load bookmarks
  const bmResult = await ipc.getBookmarks();
  if (bmResult.ok) store.bookmarks = bmResult.data;

  // Create initial tab
  const home = ipc.homeDir || '/home';
  store.tabs.push(createTab(home));

  // Render everything
  renderSidebar();
  renderToolbar();
  renderTabBar();
  renderStatusBar();
  renderPreviewPanel();

  // Expand tree to initial directory
  await expandTreeToPath(home);

  // Load directory
  await loadCurrentDir();

  // Watch for filesystem changes
  ipc.onFsChanged(() => {
    const tab = getActiveTab();
    if (tab) invalidateTreeNode(tab.path);
    loadCurrentDir();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeydown);

  console.log('[NewPfinder] Ready');
}

async function loadCurrentDir() {
  const tab = getActiveTab();
  if (!tab) return;

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

  ipc.unwatchDir();
  ipc.watchDir(tab.path);

  renderFileList();
  renderStatusBar();
  updatePreviewIfNeeded();

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
  expandTreeToPath(dirPath);
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
  renderToolbar(); renderTabBar(); renderSidebar();
  expandTreeToPath(tab.path);
  loadCurrentDir();
}

function navigateForward() {
  const tab = getActiveTab();
  if (!tab || tab.historyIndex >= tab.history.length - 1) return;
  tab.historyIndex++;
  tab.path = tab.history[tab.historyIndex];
  tab.selectedFiles = [];
  store.focusedIndex = -1;
  store.searchQuery = '';
  renderToolbar(); renderTabBar(); renderSidebar();
  expandTreeToPath(tab.path);
  loadCurrentDir();
}

function navigateUp() {
  const tab = getActiveTab();
  if (!tab) return;
  const parent = tab.path.replace(/\/[^/]+\/?$/, '') || '/';
  if (parent !== tab.path) navigateTo(parent);
}

// --- View mode ---

function toggleViewMode() {
  store.viewMode = store.viewMode === 'detail' ? 'grid' : 'detail';
  renderToolbar();
  renderFileList();
}

// --- Dark theme ---

function toggleDarkTheme() {
  store.darkTheme = !store.darkTheme;
  document.documentElement.classList.toggle('dark', store.darkTheme);
  renderToolbar();
}

// --- Dual pane ---

function renderDualPane() {
  const dp = document.getElementById('dual-pane');
  if (!dp) return;

  if (!store.showDualPane) {
    dp.style.display = 'none';
    return;
  }
  dp.style.display = 'flex';

  if (!store.dualPanePath) {
    const tab = getActiveTab();
    store.dualPanePath = tab ? tab.path : ipc.homeDir;
  }

  _loadDualPane();
}

async function _loadDualPane() {
  const dp = document.getElementById('dual-pane');
  if (!dp || !store.showDualPane) return;

  const result = await ipc.readDir(store.dualPanePath, store.showHidden);
  if (!result.ok) return;

  const files = sortFiles(result.data || [], 'name', true);
  const pathParts = store.dualPanePath.split('/').filter(Boolean);
  const breadcrumb = '/' + pathParts.join('/');

  let html = `<div class="dp-header">
    <span class="dp-path" title="${escapeHtml(breadcrumb)}">${escapeHtml(breadcrumb)}</span>
  </div>`;

  html += '<div class="dp-list">';
  for (const f of files) {
    html += `<div class="dp-row" data-path="${escapeHtml(f.path)}" data-is-dir="${f.isDirectory}">
      <span class="dp-icon">${getFileIcon(f)}</span>
      <span class="dp-name">${escapeHtml(f.name)}</span>
      <span class="dp-size">${f.isDirectory ? '' : formatSize(f.size)}</span>
    </div>`;
  }
  html += '</div>';

  dp.innerHTML = html;

  if (!dp._eventsAttached) {
    dp._eventsAttached = true;
    dp.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.dp-row');
      if (!row) return;
      if (row.dataset.isDir === 'true') {
        store.dualPanePath = row.dataset.path;
        _loadDualPane();
      } else {
        ipc.openFile(row.dataset.path);
      }
    });

    // Drop zone
    dp.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
      dp.classList.add('drop-target');
    });
    dp.addEventListener('dragleave', () => dp.classList.remove('drop-target'));
    dp.addEventListener('drop', async (e) => {
      e.preventDefault();
      dp.classList.remove('drop-target');
      const raw = e.dataTransfer.getData('application/x-newpfinder-paths');
      if (!raw) return;
      const paths = JSON.parse(raw);
      const fn = e.ctrlKey ? ipc.copyFiles : ipc.moveFiles;
      await fn(paths, store.dualPanePath);
      loadCurrentDir();
      _loadDualPane();
    });
  }
}

// --- Keyboard shortcuts ---

function handleKeydown(e) {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    if (e.key === 'Escape') { e.target.blur(); e.preventDefault(); }
    return;
  }

  // Ctrl+T — new tab
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    const home = ipc.homeDir || '/home';
    store.tabs.push(createTab(home));
    store.activeTabIndex = store.tabs.length - 1;
    store.focusedIndex = -1; store.searchQuery = '';
    renderTabBar(); renderToolbar(); renderSidebar(); loadCurrentDir();
    return;
  }

  // Ctrl+W — close tab
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault();
    if (store.tabs.length > 1) {
      store.tabs.splice(store.activeTabIndex, 1);
      if (store.activeTabIndex >= store.tabs.length) store.activeTabIndex = store.tabs.length - 1;
      store.focusedIndex = -1;
      renderTabBar(); renderToolbar(); renderSidebar(); loadCurrentDir();
    }
    return;
  }

  // Ctrl+Tab — next tab
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    if (store.tabs.length > 1) {
      store.activeTabIndex = e.shiftKey
        ? (store.activeTabIndex - 1 + store.tabs.length) % store.tabs.length
        : (store.activeTabIndex + 1) % store.tabs.length;
      store.focusedIndex = -1; store.searchQuery = '';
      renderTabBar(); renderToolbar(); renderSidebar(); loadCurrentDir();
    }
    return;
  }

  // Ctrl+1-9 — switch to tab N
  if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const idx = parseInt(e.key) - 1;
    if (idx < store.tabs.length) {
      store.activeTabIndex = idx;
      store.focusedIndex = -1; store.searchQuery = '';
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

  // Ctrl+Shift+C — copy path
  if (e.ctrlKey && e.shiftKey && e.key === 'C') {
    e.preventDefault();
    const tab = getActiveTab();
    if (tab && tab.selectedFiles.length > 0) {
      ipc.writeClipboard(tab.selectedFiles.join('\n'));
      showToast('\u30D1\u30B9\u3092\u30B3\u30D4\u30FC', 'info', 1500);
    }
    return;
  }

  // Ctrl+Shift+N — new folder
  if (e.ctrlKey && e.shiftKey && e.key === 'N') {
    e.preventDefault();
    const tab = getActiveTab();
    if (!tab) return;
    const name = prompt('\u30D5\u30A9\u30EB\u30C0\u540D:');
    if (name) ipc.createFolder(tab.path, name).then(() => loadCurrentDir());
    return;
  }

  // Ctrl+H — toggle hidden
  if (e.ctrlKey && e.key === 'h') {
    e.preventDefault();
    store.showHidden = !store.showHidden;
    renderToolbar(); loadCurrentDir();
    return;
  }

  // Ctrl+B — toggle sidebar
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault();
    store.showSidebar = !store.showSidebar;
    renderSidebar();
    return;
  }

  // Ctrl+Shift+P — toggle preview
  if (e.ctrlKey && e.shiftKey && e.key === 'P') {
    e.preventDefault();
    store.showPreview = !store.showPreview;
    renderToolbar(); renderPreviewPanel();
    return;
  }

  // Ctrl+Shift+D — toggle dual pane
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    store.showDualPane = !store.showDualPane;
    renderToolbar(); renderDualPane();
    return;
  }

  // Ctrl+L / Ctrl+F — focus search
  if (e.ctrlKey && (e.key === 'l' || e.key === 'f')) {
    e.preventDefault();
    const input = document.getElementById('search-input');
    if (input) { input.focus(); input.select(); }
    return;
  }

  // F2 — inline rename
  if (e.key === 'F2') {
    e.preventDefault();
    const tab = getActiveTab();
    if (tab && tab.selectedFiles.length === 1) {
      const f = _currentFiles.find(f => f.path === tab.selectedFiles[0]);
      if (f) startInlineRename(f);
    }
    return;
  }

  // F5 — refresh
  if (e.key === 'F5' && !e.ctrlKey) {
    e.preventDefault();
    loadCurrentDir();
    return;
  }

  // F11 — fullscreen
  if (e.key === 'F11') {
    e.preventDefault();
    // Electron fullscreen toggle is in main process; skip for now
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

  // Arrow keys — DOM direct update
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
    updatePreviewIfNeeded();
    const focused = document.querySelector('.fl-row.focused, .fg-item.focused');
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
      _updateSelectionDOM(tab);
      renderStatusBar();
    }
    return;
  }

  // Space — toggle selection without moving
  if (e.key === ' ') {
    e.preventDefault();
    const files = getCurrentFiles();
    const tab = getActiveTab();
    if (tab && store.focusedIndex >= 0 && files[store.focusedIndex]) {
      const p = files[store.focusedIndex].path;
      const idx = tab.selectedFiles.indexOf(p);
      if (idx >= 0) tab.selectedFiles.splice(idx, 1);
      else tab.selectedFiles.push(p);
      _updateSelectionDOM(tab);
      renderStatusBar();
      updatePreviewIfNeeded();
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
  if (theme.preview) {
    set('--preview-width', theme.preview.width);
    set('--preview-bg', theme.preview.background);
    set('--preview-border', theme.preview.borderColor);
  }
}

// Boot
document.addEventListener('DOMContentLoaded', init);
