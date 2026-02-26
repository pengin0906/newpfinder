/**
 * file-list.js — Detail view with pforce-longid category colors
 */

'use strict';

let _allFiles = [];
let _currentFiles = [];

function getCurrentFiles() { return _currentFiles; }

function renderFileList() {
  const container = document.getElementById('file-list');
  if (!container) return;

  const tab = getActiveTab();
  if (!tab) return;

  const files = _currentFiles;
  const selected = new Set(tab.selectedFiles);

  // Column header
  let html = `<div class="fl-header">
    <div class="fl-col fl-col-icon"></div>
    <div class="fl-col fl-col-name fl-sortable" data-sort="name">\u540D\u524D${_sortArrow('name', tab)}</div>
    <div class="fl-col fl-col-cat fl-sortable" data-sort="category">\u30AB\u30C6\u30B4\u30EA${_sortArrow('category', tab)}</div>
    <div class="fl-col fl-col-size fl-sortable" data-sort="size">\u30B5\u30A4\u30BA${_sortArrow('size', tab)}</div>
    <div class="fl-col fl-col-date fl-sortable" data-sort="modified">\u66F4\u65B0\u65E5${_sortArrow('modified', tab)}</div>
    <div class="fl-col fl-col-id">ID</div>
  </div>`;

  // Rows
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const sel = selected.has(f.path) ? ' selected' : '';
    const focused = i === store.focusedIndex ? ' focused' : '';
    const cut = (store.clipboardMode === 'cut' && store.clipboard.includes(f.path)) ? ' cut' : '';
    const gitClass = _gitClass(f);

    // Category badge color from YAML theme
    const catColor = f.categoryColor || '#757575';
    const catBadge = f.isDirectory ? '' :
      `<span class="cat-badge" style="background:${catColor}">${escapeHtml(f.category || 'other')}</span>`;

    // Short ID (last 8 hex chars)
    const shortId = f.id ? f.id.slice(-8) : '';

    html += `<div class="fl-row${sel}${focused}${cut}${gitClass}" data-index="${i}" data-path="${escapeHtml(f.path)}">
      <div class="fl-col fl-col-icon">${getFileIcon(f)}</div>
      <div class="fl-col fl-col-name">${escapeHtml(f.name)}</div>
      <div class="fl-col fl-col-cat">${catBadge}</div>
      <div class="fl-col fl-col-size">${f.isDirectory ? '--' : formatSize(f.size)}</div>
      <div class="fl-col fl-col-date">${formatDate(f.modified)}</div>
      <div class="fl-col fl-col-id"><span class="id-badge">${shortId}</span></div>
    </div>`;
  }

  if (files.length === 0) {
    html += `<div class="fl-empty">\u30D5\u30A1\u30A4\u30EB\u304C\u3042\u308A\u307E\u305B\u3093</div>`;
  }

  container.innerHTML = html;

  // Event delegation (attach once)
  if (!container._eventsAttached) {
    container._eventsAttached = true;
    container.addEventListener('click', _handleClick);
    container.addEventListener('dblclick', _handleDblClick);
    container.addEventListener('contextmenu', _handleContextMenu);
  }
}

function _sortArrow(col, tab) {
  if (tab.sortBy !== col) return '';
  return tab.sortAsc ? ' \u25B2' : ' \u25BC';
}

function _gitClass(f) {
  const status = store._gitFileStatuses[f.name];
  if (!status) return '';
  return ` git-${status}`;
}

function _handleClick(e) {
  // Sort header click
  const sortCol = e.target.closest('.fl-sortable');
  if (sortCol) {
    const tab = getActiveTab();
    const col = sortCol.dataset.sort;
    if (tab.sortBy === col) {
      tab.sortAsc = !tab.sortAsc;
    } else {
      tab.sortBy = col;
      tab.sortAsc = true;
    }
    _currentFiles = sortFiles(_allFiles, tab.sortBy, tab.sortAsc);
    renderFileList();
    return;
  }

  const row = e.target.closest('.fl-row');
  if (!row) return;

  const index = parseInt(row.dataset.index);
  const tab = getActiveTab();
  if (!tab) return;

  store.focusedIndex = index;

  const filePath = row.dataset.path;
  if (e.ctrlKey || e.metaKey) {
    // Toggle selection
    const idx = tab.selectedFiles.indexOf(filePath);
    if (idx >= 0) tab.selectedFiles.splice(idx, 1);
    else tab.selectedFiles.push(filePath);
  } else if (e.shiftKey && tab.selectedFiles.length > 0) {
    // Range select
    const lastPath = tab.selectedFiles[tab.selectedFiles.length - 1];
    const lastIdx = _currentFiles.findIndex(f => f.path === lastPath);
    const [start, end] = lastIdx < index ? [lastIdx, index] : [index, lastIdx];
    tab.selectedFiles = _currentFiles.slice(start, end + 1).map(f => f.path);
  } else {
    tab.selectedFiles = [filePath];
  }

  renderFileList();
  renderStatusBar();
}

function _handleDblClick(e) {
  const row = e.target.closest('.fl-row');
  if (!row) return;
  const index = parseInt(row.dataset.index);
  const entry = _currentFiles[index];
  if (!entry) return;

  if (entry.isDirectory) {
    navigateTo(entry.path);
  } else {
    ipc.openFile(entry.path);
  }
}

function _handleContextMenu(e) {
  e.preventDefault();
  const row = e.target.closest('.fl-row');
  if (row) {
    const index = parseInt(row.dataset.index);
    const entry = _currentFiles[index];
    const tab = getActiveTab();
    if (tab && !tab.selectedFiles.includes(entry.path)) {
      tab.selectedFiles = [entry.path];
      store.focusedIndex = index;
      renderFileList();
    }
    showContextMenu(e.clientX, e.clientY, entry);
  } else {
    showContextMenu(e.clientX, e.clientY, null);
  }
}

function applyFilter() {
  const tab = getActiveTab();
  if (!tab) return;
  if (store.searchQuery) {
    const q = store.searchQuery.toLowerCase();
    _currentFiles = _allFiles.filter(f => f.name.toLowerCase().includes(q));
  } else {
    _currentFiles = sortFiles(_allFiles, tab.sortBy, tab.sortAsc);
  }
  renderFileList();
  renderStatusBar();
}
