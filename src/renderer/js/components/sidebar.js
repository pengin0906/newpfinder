/**
 * sidebar.js — Left panel navigation
 * Event delegation (single attach) — no handler leak.
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
    HOME: home,
    DESKTOP: home + '/Desktop',
    DOCUMENTS: home + '/Documents',
    DOWNLOADS: home + '/Downloads',
    MUSIC: home + '/Music',
    PICTURES: home + '/Pictures',
    VIDEOS: home + '/Videos',
  };
  return map[pathKey] || home;
}

function renderSidebar() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;

  const tab = getActiveTab();
  const currentPath = tab ? tab.path : '';

  let html = `<div class="sidebar-brand">
    <span class="brand-icon">P</span>
    <span class="brand-text">NewPfinder</span>
  </div>`;

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

  html += `<div class="sidebar-section"><span class="sidebar-section-title">\u30C7\u30D0\u30A4\u30B9</span>`;
  html += `<div class="sidebar-item" data-path="/">
    <span class="sidebar-icon">\uD83D\uDCBF</span>
    <span class="sidebar-label">/ (root)</span>
  </div>`;
  html += `</div>`;

  sb.innerHTML = html;

  // Event delegation — single attach, no leak
  if (!sb._eventsAttached) {
    sb._eventsAttached = true;
    sb.addEventListener('click', (e) => {
      const item = e.target.closest('.sidebar-item[data-path]');
      if (item) navigateTo(item.dataset.path);
    });
  }
}
