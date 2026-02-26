/**
 * sidebar.js — Left panel: favorites, devices, bookmarks
 * Event delegation + D&D bookmark support.
 */

'use strict';

const FAVORITES = [
  { name: '\u30DB\u30FC\u30E0', icon: '\uD83C\uDFE0', pathKey: 'HOME' },
  { name: '\u30C7\u30B9\u30AF\u30C8\u30C3\u30D7', icon: '\uD83D\uDDA5\uFE0F', pathKey: 'DESKTOP' },
  { name: '\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8', icon: '\uD83D\uDCC1', pathKey: 'DOCUMENTS' },
  { name: '\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9', icon: '\u2B07\uFE0F', pathKey: 'DOWNLOADS' },
  { name: '\u30DF\u30E5\u30FC\u30B8\u30C3\u30AF', icon: '\uD83C\uDFB5', pathKey: 'MUSIC' },
  { name: '\u30D4\u30AF\u30C1\u30E3', icon: '\uD83D\uDDBC\uFE0F', pathKey: 'PICTURES' },
  { name: '\u30D3\u30C7\u30AA', icon: '\uD83C\uDFA5', pathKey: 'VIDEOS' },
];

function _resolvePath(pathKey) {
  const home = ipc.homeDir || '/home';
  const map = {
    HOME: home, DESKTOP: home + '/Desktop', DOCUMENTS: home + '/Documents',
    DOWNLOADS: home + '/Downloads', MUSIC: home + '/Music',
    PICTURES: home + '/Pictures', VIDEOS: home + '/Videos',
  };
  return map[pathKey] || home;
}

function renderSidebar() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;

  if (!store.showSidebar) { sb.style.display = 'none'; return; }
  sb.style.display = '';

  const tab = getActiveTab();
  const currentPath = tab ? tab.path : '';

  let html = `<div class="sidebar-brand">
    <span class="brand-icon">P</span>
    <span class="brand-text">NewPfinder</span>
  </div>`;

  // Favorites
  html += `<div class="sidebar-section"><span class="sidebar-section-title">\u304A\u6C17\u306B\u5165\u308A</span>`;
  for (const fav of FAVORITES) {
    const p = _resolvePath(fav.pathKey);
    const active = currentPath === p ? ' active' : '';
    html += `<div class="sidebar-item${active}" data-path="${escapeHtml(p)}">
      <span class="sidebar-icon">${fav.icon}</span>
      <span class="sidebar-label">${fav.name}</span>
    </div>`;
  }
  html += `</div>`;

  // Devices
  html += `<div class="sidebar-section"><span class="sidebar-section-title">\u30C7\u30D0\u30A4\u30B9</span>`;
  html += `<div class="sidebar-item${currentPath === '/' ? ' active' : ''}" data-path="/">
    <span class="sidebar-icon">\uD83D\uDCBF</span>
    <span class="sidebar-label">/ (root)</span>
  </div></div>`;

  // Bookmarks
  if (store.bookmarks && store.bookmarks.length > 0) {
    html += `<div class="sidebar-section"><span class="sidebar-section-title">\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF</span>`;
    for (const bm of store.bookmarks) {
      const active = currentPath === bm.path ? ' active' : '';
      html += `<div class="sidebar-item${active}" data-path="${escapeHtml(bm.path)}" data-bookmark="true">
        <span class="sidebar-icon">\uD83D\uDCCC</span>
        <span class="sidebar-label">${escapeHtml(bm.name)}</span>
        <span class="sidebar-bm-remove" data-bm-remove="${escapeHtml(bm.path)}">\u00D7</span>
      </div>`;
    }
    html += `</div>`;
  }

  sb.innerHTML = html;

  if (!sb._eventsAttached) {
    sb._eventsAttached = true;

    sb.addEventListener('click', (e) => {
      const rmBtn = e.target.closest('[data-bm-remove]');
      if (rmBtn) {
        e.stopPropagation();
        const p = rmBtn.dataset.bmRemove;
        ipc.removeBookmark(p).then(() => {
          store.bookmarks = store.bookmarks.filter(b => b.path !== p);
          renderSidebar();
        });
        return;
      }
      const item = e.target.closest('.sidebar-item[data-path]');
      if (item) navigateTo(item.dataset.path);
    });

    // D&D for bookmarks
    sb.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'link';
      sb.classList.add('drop-target');
    });
    sb.addEventListener('dragleave', () => sb.classList.remove('drop-target'));
    sb.addEventListener('drop', (e) => {
      e.preventDefault();
      sb.classList.remove('drop-target');
      const raw = e.dataTransfer.getData('application/x-newpfinder-paths');
      if (!raw) return;
      const paths = JSON.parse(raw);
      for (const p of paths) {
        ipc.addBookmark(p).then(() => {
          ipc.getBookmarks().then(r => { if (r.ok) { store.bookmarks = r.data; renderSidebar(); } });
        });
      }
    });
  }
}
