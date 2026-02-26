/**
 * file-grid.js — Grid/Icon view
 */

'use strict';

function renderFileGrid() {
  const container = document.getElementById('file-list');
  if (!container) return;

  const tab = getActiveTab();
  if (!tab) return;

  const files = _currentFiles;
  const selected = new Set(tab.selectedFiles);

  let html = '<div class="fg-grid">';
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const sel = selected.has(f.path) ? ' selected' : '';
    const focused = i === store.focusedIndex ? ' focused' : '';
    const cut = (store.clipboardMode === 'cut' && store.clipboard.includes(f.path)) ? ' cut' : '';

    const catColor = f.categoryColor || '#757575';
    const iconSize = f.isDirectory ? '48px' : '40px';

    html += `<div class="fg-item${sel}${focused}${cut}" data-index="${i}" data-path="${escapeHtml(f.path)}" draggable="true">
      <div class="fg-icon" style="font-size:${iconSize}">${getFileIcon(f)}</div>
      <div class="fg-name">${escapeHtml(f.name)}</div>
      ${!f.isDirectory ? `<div class="fg-badge" style="background:${catColor}"></div>` : ''}
    </div>`;
  }
  html += '</div>';

  if (files.length === 0) {
    html = '<div class="fl-empty">ファイルがありません</div>';
  }

  container.innerHTML = html;

  // Reuse file-list event delegation (same container)
  if (!container._gridEventsAttached) {
    container._gridEventsAttached = true;
    container.addEventListener('click', _handleGridClick);
    container.addEventListener('dblclick', _handleGridDblClick);
    container.addEventListener('contextmenu', _handleContextMenu);
  }
}

function _handleGridClick(e) {
  if (store.viewMode !== 'grid') return;
  const item = e.target.closest('.fg-item');
  if (!item) return;

  const index = parseInt(item.dataset.index);
  const tab = getActiveTab();
  if (!tab) return;

  store.focusedIndex = index;
  const filePath = item.dataset.path;

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

  _updateGridSelectionDOM(tab);
  renderStatusBar();
  updatePreviewIfNeeded();
}

function _handleGridDblClick(e) {
  if (store.viewMode !== 'grid') return;
  const item = e.target.closest('.fg-item');
  if (!item) return;
  const index = parseInt(item.dataset.index);
  const entry = _currentFiles[index];
  if (!entry) return;

  if (entry.isDirectory) navigateTo(entry.path);
  else ipc.openFile(entry.path);
}

function _updateGridSelectionDOM(tab) {
  const container = document.getElementById('file-list');
  if (!container) return;
  const selected = new Set(tab.selectedFiles);
  const items = container.querySelectorAll('.fg-item');
  for (const item of items) {
    const p = item.dataset.path;
    item.classList.toggle('selected', selected.has(p));
    item.classList.toggle('focused', parseInt(item.dataset.index) === store.focusedIndex);
    item.classList.toggle('cut', store.clipboardMode === 'cut' && store.clipboard.includes(p));
  }
}
