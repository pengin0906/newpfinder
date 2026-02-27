/**
 * sidebar.js — Left panel: Directory Tree (top) + Quick Access (bottom)
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

  let html = '';

  // === Tree section (main area — Explorer-style, no brand) ===
  html += `<div id="tree-view" class="sidebar-tree"></div>`;

  // === Divider ===
  html += `<div class="sidebar-divider"></div>`;

  // === Quick Access section (bottom, collapsible) ===
  const qaCollapsed = store._qaCollapsed || false;
  html += `<div class="sidebar-quick-access">`;
  html += `<div class="sidebar-section-title sidebar-qa-toggle" data-qa-toggle="true">`;
  html += `<span class="qa-arrow">${qaCollapsed ? '▸' : '▾'}</span> クイックアクセス</div>`;

  if (!qaCollapsed) {
    for (const fav of FAVORITES) {
      const p = _resolvePath(fav.pathKey);
      const active = currentPath === p ? ' active' : '';
      html += `<div class="sidebar-item${active}" data-path="${escapeHtml(p)}">
        <span class="sidebar-icon">${fav.icon}</span>
        <span class="sidebar-label">${fav.name}</span>
      </div>`;
    }

    // Bookmarks
    if (store.bookmarks && store.bookmarks.length > 0) {
      html += `<div class="sidebar-section-title">ブックマーク</div>`;
      for (const bm of store.bookmarks) {
        const active = currentPath === bm.path ? ' active' : '';
        html += `<div class="sidebar-item${active}" data-path="${escapeHtml(bm.path)}" data-bookmark="true">
          <span class="sidebar-icon">📌</span>
          <span class="sidebar-label">${escapeHtml(bm.name)}</span>
          <span class="sidebar-bm-remove" data-bm-remove="${escapeHtml(bm.path)}">×</span>
        </div>`;
      }
    }
  }
  html += `</div>`;

  sb.innerHTML = html;

  // Render the tree inside the container
  renderTreeView();

  if (!sb._eventsAttached) {
    sb._eventsAttached = true;

    sb.addEventListener('click', (e) => {
      // Tree view handles its own clicks via #tree-view delegation
      if (e.target.closest('#tree-view')) return;

      // Quick access collapse toggle
      const qaToggle = e.target.closest('[data-qa-toggle]');
      if (qaToggle) {
        store._qaCollapsed = !store._qaCollapsed;
        renderSidebar();
        return;
      }

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
