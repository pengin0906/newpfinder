/**
 * context-menu.js — Right-click menu with archive support
 */

'use strict';

function showContextMenu(x, y, entry) {
  _removeContextMenu();

  const tab = getActiveTab();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  let items = [];

  if (entry) {
    if (entry.isDirectory) {
      items.push({ label: '\u958B\u304F', action: () => navigateTo(entry.path) });
    } else {
      items.push({ label: '\u958B\u304F', action: () => ipc.openFile(entry.path) });
      // Archive browsing
      const archiveExts = ['.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2', '.tbz2', '.tar.xz', '.txz'];
      if (archiveExts.some(e => entry.path.toLowerCase().endsWith(e))) {
        items.push({ label: '\u30A2\u30FC\u30AB\u30A4\u30D6\u3092\u958B\u304F', action: () => _browseArchive(entry) });
      }
    }
    items.push({ type: 'sep' });
    items.push({ label: '\u30B3\u30D4\u30FC', shortcut: 'Ctrl+C', action: () => _clipAction('copy') });
    items.push({ label: '\u5207\u308A\u53D6\u308A', shortcut: 'Ctrl+X', action: () => _clipAction('cut') });
    items.push({ label: '\u30D1\u30B9\u3092\u30B3\u30D4\u30FC', action: () => ipc.writeClipboard(entry.path) });
    items.push({ type: 'sep' });
    items.push({ label: '\u540D\u524D\u5909\u66F4', shortcut: 'F2', action: () => startInlineRename(entry) });
    items.push({ label: '\u30B4\u30DF\u7BB1\u3078', shortcut: 'Del', action: () => _trashSelected() });

    // Compress
    if (tab && tab.selectedFiles.length > 0) {
      items.push({ type: 'sep' });
      items.push({ label: 'ZIP\u306B\u5727\u7E2E', action: () => _compressSelected('zip') });
      items.push({ label: 'tar.gz\u306B\u5727\u7E2E', action: () => _compressSelected('tar.gz') });
    }

    // Extract
    const extExts = ['.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2', '.tbz2', '.tar.xz', '.txz'];
    if (extExts.some(e => entry.path.toLowerCase().endsWith(e))) {
      items.push({ label: '\u3053\u3053\u306B\u5C55\u958B', action: () => _extractHere(entry) });
    }

    // Bookmark
    if (entry.isDirectory) {
      items.push({ type: 'sep' });
      items.push({ label: '\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u8FFD\u52A0', action: () => _addBookmark(entry.path) });
    }

    if (entry.id) {
      items.push({ type: 'sep' });
      items.push({ label: `ID: ${entry.id.slice(-8)}`, action: () => ipc.writeClipboard(entry.id) });
      items.push({ label: `\u30AB\u30C6\u30B4\u30EA: ${entry.category || 'other'}`, disabled: true });
    }
  } else {
    items.push({ label: '\u8CBC\u308A\u4ED8\u3051', shortcut: 'Ctrl+V', action: () => _pasteFiles(), disabled: store.clipboard.length === 0 });
    items.push({ type: 'sep' });
    items.push({ label: '\u65B0\u3057\u3044\u30D5\u30A9\u30EB\u30C0', shortcut: 'Ctrl+Shift+N', action: () => _createNewFolder() });
    items.push({ label: '\u65B0\u3057\u3044\u30D5\u30A1\u30A4\u30EB', action: () => _createNewFile() });
    items.push({ type: 'sep' });
    items.push({ label: '\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u8FFD\u52A0', action: () => { const t = getActiveTab(); if (t) _addBookmark(t.path); } });
  }

  for (const item of items) {
    if (item.type === 'sep') {
      menu.appendChild(Object.assign(document.createElement('div'), { className: 'ctx-sep' }));
      continue;
    }
    const el = document.createElement('div');
    el.className = 'ctx-item' + (item.disabled ? ' disabled' : '');
    el.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : ''}`;
    if (item.action && !item.disabled) {
      el.addEventListener('click', () => { _removeContextMenu(); item.action(); });
    }
    menu.appendChild(el);
  }

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';

  setTimeout(() => {
    document.addEventListener('click', _removeContextMenu, { once: true });
  }, 0);
}

function _removeContextMenu() {
  document.querySelectorAll('.context-menu').forEach(el => el.remove());
}

function _clipAction(mode) {
  const tab = getActiveTab();
  if (!tab || tab.selectedFiles.length === 0) return;
  store.clipboard = [...tab.selectedFiles];
  store.clipboardMode = mode;
  _updateSelectionDOM(tab);
  const label = mode === 'copy' ? '\u30B3\u30D4\u30FC' : '\u5207\u308A\u53D6\u308A';
  showToast(`${store.clipboard.length}\u30D5\u30A1\u30A4\u30EB${label}`, 'info', 1500);
}

async function _pasteFiles() {
  const tab = getActiveTab();
  if (!tab || store.clipboard.length === 0) return;
  if (store.clipboardMode === 'copy') {
    await ipc.copyFiles(store.clipboard, tab.path);
  } else if (store.clipboardMode === 'cut') {
    await ipc.moveFiles(store.clipboard, tab.path);
    store.clipboard = []; store.clipboardMode = null;
  }
  loadCurrentDir();
}

async function _trashSelected() {
  const tab = getActiveTab();
  if (!tab || tab.selectedFiles.length === 0) return;
  await ipc.trashFiles(tab.selectedFiles);
  tab.selectedFiles = [];
  loadCurrentDir();
}

async function _createNewFolder() {
  const tab = getActiveTab();
  if (!tab) return;
  const name = prompt('\u30D5\u30A9\u30EB\u30C0\u540D:');
  if (!name) return;
  await ipc.createFolder(tab.path, name);
  loadCurrentDir();
}

async function _createNewFile() {
  const tab = getActiveTab();
  if (!tab) return;
  const name = prompt('\u30D5\u30A1\u30A4\u30EB\u540D:');
  if (!name) return;
  await ipc.createFile(tab.path, name);
  loadCurrentDir();
}

function _addBookmark(dirPath) {
  ipc.addBookmark(dirPath).then(() => {
    ipc.getBookmarks().then(r => {
      if (r.ok) { store.bookmarks = r.data; renderSidebar(); }
    });
  });
  showToast('\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u8FFD\u52A0', 'success', 1500);
}

async function _browseArchive(entry) {
  const result = await ipc.listArchive(entry.path);
  if (!result.ok) {
    showToast('\u30A2\u30FC\u30AB\u30A4\u30D6\u3092\u958B\u3051\u307E\u305B\u3093: ' + (result.error || ''), 'error');
    return;
  }
  _showArchiveDialog(entry.name, entry.path, result.data);
}

function _showArchiveDialog(name, archivePath, entries) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">
    <div class="modal-header">
      <span>\uD83D\uDCE6 ${escapeHtml(name)}</span>
      <span class="modal-close">\u00D7</span>
    </div>
    <div class="modal-body archive-list">
      ${entries.map(e => `<div class="archive-entry${e.isDirectory ? ' is-dir' : ''}">
        <span>${e.isDirectory ? '\uD83D\uDCC1' : '\uD83D\uDCC4'} ${escapeHtml(e.name)}</span>
        <span>${e.isDirectory ? '' : formatSize(e.size)}</span>
      </div>`).join('')}
      ${entries.length === 0 ? '<div class="archive-empty">\u7A7A\u306E\u30A2\u30FC\u30AB\u30A4\u30D6</div>' : ''}
    </div>
    <div class="modal-footer">
      <button class="modal-btn" data-extract>ここに展開</button>
      <button class="modal-btn secondary" data-close>閉じる</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-extract]').addEventListener('click', async () => {
    const tab = getActiveTab();
    const dest = tab ? tab.path : ipc.homeDir;
    overlay.remove();
    showToast('\u5C55\u958B\u4E2D...', 'info', 2000);
    const result = await ipc.extractArchive(archivePath, dest);
    if (result.ok) { showToast('\u5C55\u958B\u5B8C\u4E86', 'success', 2000); loadCurrentDir(); }
    else showToast('\u5C55\u958B\u5931\u6557: ' + (result.error || ''), 'error');
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

async function _extractHere(entry) {
  const tab = getActiveTab();
  const dest = tab ? tab.path : ipc.homeDir;
  showToast('\u5C55\u958B\u4E2D...', 'info', 2000);
  const result = await ipc.extractArchive(entry.path, dest);
  if (result.ok) { showToast('\u5C55\u958B\u5B8C\u4E86', 'success', 2000); loadCurrentDir(); }
  else showToast('\u5C55\u958B\u5931\u6557: ' + (result.error || ''), 'error');
}

async function _compressSelected(format) {
  const tab = getActiveTab();
  if (!tab || tab.selectedFiles.length === 0) return;
  const baseName = tab.selectedFiles.length === 1
    ? tab.selectedFiles[0].split('/').pop().replace(/\.[^.]+$/, '')
    : 'archive';
  const ext = format === 'zip' ? '.zip' : '.tar.gz';
  const destPath = tab.path + '/' + baseName + ext;
  showToast('\u5727\u7E2E\u4E2D...', 'info', 2000);
  const result = await ipc.createArchive(tab.selectedFiles, destPath, format);
  if (result.ok) { showToast('\u5727\u7E2E\u5B8C\u4E86', 'success', 2000); loadCurrentDir(); }
  else showToast('\u5727\u7E2E\u5931\u6557: ' + (result.error || ''), 'error');
}
