/**
 * sidebar.js — Left panel: Quick Access (favorites + bookmarks) + Directory Tree
 * Windows Explorer-style layout. Event delegation + D&D bookmark support.
 */

'use strict';

const FAVORITES = [
  { name: 'ホーム', icon: '🏠', pathKey: 'HOME' },
  { name: 'デスクトップ', icon: '🖥️', pathKey: 'DESKTOP' },
  { name: 'ドキュメント', icon: '📁', pathKey: 'DOCUMENTS' },
  { name: 'ダウンロード', icon: '⬇️', pathKey: 'DOWNLOADS' },
  { name: 'ミュージック', icon: '🎵', pathKey: 'MUSIC' },
  { name: 'ピクチャ', icon: '🖼️', pathKey: 'PICTURES' },
  { name: 'ビデオ', icon: '🎥', pathKey: 'VIDEOS' },
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

  // Quick Access section
  html += `<div class="sidebar-quick-access">`;
  html += `<div class="sidebar-section"><span class="sidebar-section-title">クイックアクセス</span>`;
  for (const fav of FAVORITES) {
    const p = _resolvePath(fav.pathKey);
    const active = currentPath === p ? ' active' : '';
    html += `<div class="sidebar-item${active}" data-path="${escapeHtml(p)}">
      <span class="sidebar-icon">${fav.icon}</span>
      <span class="sidebar-label">${fav.name}</span>
    </div>`;
  }
  html += `</div>`;

  // Bookmarks
  if (store.bookmarks && store.bookmarks.length > 0) {
    html += `<div class="sidebar-section"><span class="sidebar-section-title">ブックマーク</span>`;
    for (const bm of store.bookmarks) {
      const active = currentPath === bm.path ? ' active' : '';
      html += `<div class="sidebar-item${active}" data-path="${escapeHtml(bm.path)}" data-bookmark="true">
        <span class="sidebar-icon">📌</span>
        <span class="sidebar-label">${escapeHtml(bm.name)}</span>
        <span class="sidebar-bm-remove" data-bm-remove="${escapeHtml(bm.path)}">×</span>
      </div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  // Divider
  html += `<div class="sidebar-divider"></div>`;

  // Tree section header
  html += `<div class="sidebar-section-title sidebar-tree-title">フォルダー</div>`;

  // Tree view container (rendered separately by tree-view.js)
  html += `<div id="tree-view" class="sidebar-tree"></div>`;

  sb.innerHTML = html;

  // Render the tree inside the container
  renderTreeView();

  if (!sb._eventsAttached) {
    sb._eventsAttached = true;

    sb.addEventListener('click', (e) => {
      // Tree view handles its own clicks via #tree-view delegation
      if (e.target.closest('#tree-view')) return;

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
