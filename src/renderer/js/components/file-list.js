/**
 * file-list.js — Detail view + inline rename + drag & drop
 */

'use strict';

let _allFiles = [];
let _currentFiles = [];

function getCurrentFiles() { return _currentFiles; }

function renderFileList() {
  // Dispatch to grid view if needed
  if (store.viewMode === 'grid') { renderFileGrid(); return; }

  const container = document.getElementById('file-list');
  if (!container) return;

  const tab = getActiveTab();
  if (!tab) return;

  const files = _currentFiles;
  const selected = new Set(tab.selectedFiles);

  let html = `<div class="fl-header">
    <div class="fl-col fl-col-icon"></div>
    <div class="fl-col fl-col-name fl-sortable" data-sort="name">\u540D\u524D${_sortArrow('name', tab)}</div>
    <div class="fl-col fl-col-date fl-sortable" data-sort="modified">\u66F4\u65B0\u65E5\u6642${_sortArrow('modified', tab)}</div>
    <div class="fl-col fl-col-cat fl-sortable" data-sort="category">\u7A2E\u985E${_sortArrow('category', tab)}</div>
    <div class="fl-col fl-col-size fl-sortable" data-sort="size">\u30B5\u30A4\u30BA${_sortArrow('size', tab)}</div>
    <div class="fl-col fl-col-id">ID</div>
  </div>`;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const sel = selected.has(f.path) ? ' selected' : '';
    const focused = i === store.focusedIndex ? ' focused' : '';
    const cut = (store.clipboardMode === 'cut' && store.clipboard.includes(f.path)) ? ' cut' : '';
    const gitClass = _gitClass(f);
    const catColor = f.categoryColor || '#757575';
    const catBadge = f.isDirectory ? '' :
      `<span class="cat-badge" style="background:${catColor}">${escapeHtml(f.category || 'other')}</span>`;
    const shortId = f.id ? f.id.slice(-8) : '';

    html += `<div class="fl-row${sel}${focused}${cut}${gitClass}" data-index="${i}" data-path="${escapeHtml(f.path)}" draggable="true">
      <div class="fl-col fl-col-icon">${getFileIcon(f)}</div>
      <div class="fl-col fl-col-name" data-name="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
      <div class="fl-col fl-col-date">${formatDate(f.modified)}</div>
      <div class="fl-col fl-col-cat">${catBadge}</div>
      <div class="fl-col fl-col-size">${f.isDirectory ? '--' : formatSize(f.size)}</div>
      <div class="fl-col fl-col-id"><span class="id-badge">${shortId}</span></div>
    </div>`;
  }

  if (files.length === 0) {
    html += `<div class="fl-empty">\u30D5\u30A1\u30A4\u30EB\u304C\u3042\u308A\u307E\u305B\u3093</div>`;
  }

  container.innerHTML = html;

  if (!container._eventsAttached) {
    container._eventsAttached = true;
    container.addEventListener('click', _handleClick);
    container.addEventListener('dblclick', _handleDblClick);
    container.addEventListener('contextmenu', _handleContextMenu);

    // Drag & drop
    container.addEventListener('dragstart', _handleDragStart);
    container.addEventListener('dragover', _handleDragOver);
    container.addEventListener('dragleave', _handleDragLeave);
    container.addEventListener('drop', _handleDrop);
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
  if (store.viewMode === 'grid') return; // handled by file-grid.js

  const sortCol = e.target.closest('.fl-sortable');
  if (sortCol) {
    const tab = getActiveTab();
    const col = sortCol.dataset.sort;
    if (tab.sortBy === col) tab.sortAsc = !tab.sortAsc;
    else { tab.sortBy = col; tab.sortAsc = true; }
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
    const idx = tab.selectedFiles.indexOf(filePath);
    if (idx >= 0) tab.selectedFiles.splice(idx, 1);
    else tab.selectedFiles.push(filePath);
  } else if (e.shiftKey && tab.selectedFiles.length > 0) {
    const lastPath = tab.selectedFiles[tab.selectedFiles.length - 1];
    const lastIdx = _currentFiles.findIndex(f => f.path === lastPath);
    const [start, end] = lastIdx < index ? [lastIdx, index] : [index, lastIdx];
    tab.selectedFiles = _currentFiles.slice(start, end + 1).map(f => f.path);
  } else {
    tab.selectedFiles = [filePath];
  }

  _updateSelectionDOM(tab);
  renderStatusBar();
  updatePreviewIfNeeded();
}

/** Update selected/focused classes directly without replacing innerHTML */
function _updateSelectionDOM(tab) {
  const container = document.getElementById('file-list');
  if (!container) return;
  const selected = new Set(tab.selectedFiles);
  const rows = container.querySelectorAll('.fl-row, .fg-item');
  for (const row of rows) {
    const p = row.dataset.path;
    row.classList.toggle('selected', selected.has(p));
    row.classList.toggle('focused', parseInt(row.dataset.index) === store.focusedIndex);
    row.classList.toggle('cut', store.clipboardMode === 'cut' && store.clipboard.includes(p));
  }
}

function _handleDblClick(e) {
  if (store.viewMode === 'grid') return;
  const row = e.target.closest('.fl-row');
  if (!row) return;
  const index = parseInt(row.dataset.index);
  const entry = _currentFiles[index];
  if (!entry) return;

  // Archive browsing on double-click
  const archiveExts = ['.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2', '.tbz2', '.tar.xz', '.txz'];
  if (!entry.isDirectory && archiveExts.some(ext => entry.path.toLowerCase().endsWith(ext))) {
    _browseArchive(entry);
    return;
  }

  if (entry.isDirectory) navigateTo(entry.path);
  else ipc.openFile(entry.path);
}

function _handleContextMenu(e) {
  e.preventDefault();
  const row = e.target.closest('.fl-row, .fg-item');
  if (row) {
    const index = parseInt(row.dataset.index);
    const entry = _currentFiles[index];
    const tab = getActiveTab();
    if (tab && !tab.selectedFiles.includes(entry.path)) {
      tab.selectedFiles = [entry.path];
      store.focusedIndex = index;
      _updateSelectionDOM(tab);
    }
    showContextMenu(e.clientX, e.clientY, entry);
  } else {
    showContextMenu(e.clientX, e.clientY, null);
  }
}

// --- Drag & Drop ---

function _handleDragStart(e) {
  const row = e.target.closest('.fl-row, .fg-item');
  if (!row) return;
  const tab = getActiveTab();
  if (!tab) return;

  const filePath = row.dataset.path;
  if (!tab.selectedFiles.includes(filePath)) {
    tab.selectedFiles = [filePath];
    store.focusedIndex = parseInt(row.dataset.index);
    _updateSelectionDOM(tab);
  }

  const paths = JSON.stringify(tab.selectedFiles);
  e.dataTransfer.setData('application/x-newpfinder-paths', paths);
  e.dataTransfer.effectAllowed = 'copyMove';

  // Visual feedback
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = tab.selectedFiles.length > 1
    ? `${tab.selectedFiles.length} \u30D5\u30A1\u30A4\u30EB`
    : filePath.split('/').pop();
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 0, 0);
  setTimeout(() => ghost.remove(), 0);
}

function _handleDragOver(e) {
  e.preventDefault();
  const row = e.target.closest('.fl-row, .fg-item');
  if (row) {
    const idx = parseInt(row.dataset.index);
    const entry = _currentFiles[idx];
    if (entry && entry.isDirectory) {
      row.classList.add('drop-target');
      e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
      return;
    }
  }
  e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
}

function _handleDragLeave(e) {
  const row = e.target.closest('.fl-row, .fg-item');
  if (row) row.classList.remove('drop-target');
}

async function _handleDrop(e) {
  e.preventDefault();
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));

  const raw = e.dataTransfer.getData('application/x-newpfinder-paths');
  if (!raw) return;

  const paths = JSON.parse(raw);
  const row = e.target.closest('.fl-row, .fg-item');
  let destDir;

  if (row) {
    const idx = parseInt(row.dataset.index);
    const entry = _currentFiles[idx];
    if (entry && entry.isDirectory) destDir = entry.path;
    else return; // can't drop on a file
  } else {
    const tab = getActiveTab();
    destDir = tab ? tab.path : null;
  }

  if (!destDir) return;

  const fn = e.ctrlKey ? ipc.copyFiles : ipc.moveFiles;
  await fn(paths, destDir);
  if (!e.ctrlKey) { store.clipboard = []; store.clipboardMode = null; }
  loadCurrentDir();
}

// --- Inline Rename ---

function startInlineRename(entry) {
  const container = document.getElementById('file-list');
  if (!container) return;

  const index = _currentFiles.findIndex(f => f.path === entry.path);
  if (index < 0) return;

  const row = container.querySelector(`.fl-row[data-index="${index}"], .fg-item[data-index="${index}"]`);
  if (!row) return;

  const nameEl = row.querySelector('.fl-col-name, .fg-name');
  if (!nameEl) return;

  const originalName = entry.name;
  const ext = entry.ext || '';
  const nameWithoutExt = ext ? originalName.slice(0, -ext.length) : originalName;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-rename-input';
  input.value = originalName;

  nameEl.textContent = '';
  nameEl.appendChild(input);
  input.focus();

  // Select name part only (not extension)
  input.setSelectionRange(0, nameWithoutExt.length);

  const commit = async () => {
    const newName = input.value.trim();
    if (!newName || newName === originalName) {
      nameEl.textContent = originalName;
      return;
    }
    const result = await ipc.renameFile(entry.path, newName);
    if (result.ok) loadCurrentDir();
    else { nameEl.textContent = originalName; showToast('\u30EA\u30CD\u30FC\u30E0\u5931\u6557', 'error'); }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); nameEl.textContent = originalName; }
    e.stopPropagation(); // prevent app keydown handler
  });
  input.addEventListener('blur', commit, { once: true });
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
