/**
 * context-menu.js — Right-click menu
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
    }
    items.push({ type: 'sep' });
    items.push({ label: '\u30B3\u30D4\u30FC', shortcut: 'Ctrl+C', action: () => _clipAction('copy') });
    items.push({ label: '\u5207\u308A\u53D6\u308A', shortcut: 'Ctrl+X', action: () => _clipAction('cut') });
    items.push({ label: '\u30D1\u30B9\u3092\u30B3\u30D4\u30FC', action: () => ipc.writeClipboard(entry.path) });
    items.push({ type: 'sep' });
    items.push({ label: '\u540D\u524D\u5909\u66F4', shortcut: 'F2', action: () => _startRename(entry) });
    items.push({ label: '\u30B4\u30DF\u7BB1\u3078', shortcut: 'Del', action: () => _trashSelected() });
    if (entry.id) {
      items.push({ type: 'sep' });
      items.push({ label: `ID: ${entry.id.slice(-8)}`, action: () => ipc.writeClipboard(entry.id), disabled: false });
      items.push({ label: `\u30AB\u30C6\u30B4\u30EA: ${entry.category || 'other'}`, disabled: true });
    }
  } else {
    // Background click
    items.push({ label: '\u8CBC\u308A\u4ED8\u3051', shortcut: 'Ctrl+V', action: () => _pasteFiles(), disabled: store.clipboard.length === 0 });
    items.push({ type: 'sep' });
    items.push({ label: '\u65B0\u3057\u3044\u30D5\u30A9\u30EB\u30C0', shortcut: 'Ctrl+Shift+N', action: () => _createNewFolder() });
    items.push({ label: '\u65B0\u3057\u3044\u30D5\u30A1\u30A4\u30EB', action: () => _createNewFile() });
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

  // Clamp to viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';

  // Close on click outside
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
    store.clipboard = [];
    store.clipboardMode = null;
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

function _startRename(entry) {
  const name = prompt('\u65B0\u3057\u3044\u540D\u524D:', entry.name);
  if (!name || name === entry.name) return;
  ipc.renameFile(entry.path, name).then(() => loadCurrentDir());
}
