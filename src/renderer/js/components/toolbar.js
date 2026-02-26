/**
 * toolbar.js — Navigation bar + breadcrumbs + search
 */

'use strict';

function renderToolbar() {
  const tb = document.getElementById('toolbar');
  if (!tb) return;

  const tab = getActiveTab();
  if (!tab) return;

  const canBack = tab.historyIndex > 0;
  const canForward = tab.historyIndex < tab.history.length - 1;
  const parts = tab.path.split('/').filter(Boolean);

  // Breadcrumbs
  let breadcrumbs = `<span class="breadcrumb-item" data-path="/">/</span>`;
  let cumPath = '';
  for (const part of parts) {
    cumPath += '/' + part;
    breadcrumbs += `<span class="breadcrumb-sep">/</span><span class="breadcrumb-item" data-path="${escapeHtml(cumPath)}">${escapeHtml(part)}</span>`;
  }

  tb.innerHTML = `
    <div class="toolbar-nav">
      <button class="tb-btn${canBack ? '' : ' disabled'}" id="btn-back" title="\u623B\u308B">\u25C0</button>
      <button class="tb-btn${canForward ? '' : ' disabled'}" id="btn-forward" title="\u9032\u3080">\u25B6</button>
      <button class="tb-btn" id="btn-up" title="\u89AA\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA">\u25B2</button>
    </div>
    <div class="toolbar-breadcrumbs">${breadcrumbs}</div>
    <div class="toolbar-search">
      <input type="text" id="search-input" placeholder="\uD83D\uDD0D \u691C\u7D22..." value="${escapeHtml(store.searchQuery)}">
    </div>
    <div class="toolbar-actions">
      <button class="tb-btn${store.showHidden ? ' active' : ''}" id="btn-hidden" title="\u96A0\u3057\u30D5\u30A1\u30A4\u30EB">H</button>
    </div>
  `;

  // Event handlers
  document.getElementById('btn-back').addEventListener('click', () => navigateBack());
  document.getElementById('btn-forward').addEventListener('click', () => navigateForward());
  document.getElementById('btn-up').addEventListener('click', () => navigateUp());
  document.getElementById('btn-hidden').addEventListener('click', () => {
    store.showHidden = !store.showHidden;
    loadCurrentDir();
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    store.searchQuery = e.target.value;
    applyFilter();
  });

  tb.querySelectorAll('.breadcrumb-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.path));
  });
}
