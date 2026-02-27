/**
 * toolbar.js — Navigation, breadcrumbs, search, view toggles
 * Event delegation + search focus preservation.
 */

'use strict';

let _searchHadFocus = false;

function renderToolbar() {
  const tb = document.getElementById('toolbar');
  if (!tb) return;

  const tab = getActiveTab();
  if (!tab) return;

  const searchEl = document.getElementById('search-input');
  _searchHadFocus = searchEl && document.activeElement === searchEl;
  const selStart = searchEl ? searchEl.selectionStart : 0;
  const selEnd = searchEl ? searchEl.selectionEnd : 0;

  const canBack = tab.historyIndex > 0;
  const canForward = tab.historyIndex < tab.history.length - 1;
  const parts = tab.path.split('/').filter(Boolean);

  let breadcrumbs = `<span class="breadcrumb-item" data-path="/">PC</span>`;
  let cumPath = '';
  for (const part of parts) {
    cumPath += '/' + part;
    breadcrumbs += `<span class="breadcrumb-sep">&#xe0;</span><span class="breadcrumb-item" data-path="${escapeHtml(cumPath)}">${escapeHtml(part)}</span>`;
  }

  tb.innerHTML = `
    <div class="toolbar-nav">
      <button class="tb-btn tb-nav${canBack ? '' : ' disabled'}" data-action="back" title="\u623B\u308B">\u2190</button>
      <button class="tb-btn tb-nav${canForward ? '' : ' disabled'}" data-action="forward" title="\u9032\u3080">\u2192</button>
      <button class="tb-btn tb-nav" data-action="up" title="\u89AA\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA">\u2191</button>
    </div>
    <div class="toolbar-address">${breadcrumbs}</div>
    <div class="toolbar-search">
      <input type="text" id="search-input" placeholder="\u691C\u7D22" value="${escapeHtml(store.searchQuery)}">
    </div>
    <div class="toolbar-actions">
      <button class="tb-btn${store.showHidden ? ' active' : ''}" data-action="hidden" title="\u96A0\u3057\u30D5\u30A1\u30A4\u30EB">H</button>
      <button class="tb-btn${store.viewMode === 'grid' ? ' active' : ''}" data-action="viewmode" title="\u8868\u793A\u5207\u66FF">${store.viewMode === 'detail' ? '\u25A6' : '\u2261'}</button>
      <button class="tb-btn${store.showPreview ? ' active' : ''}" data-action="preview" title="\u30D7\u30EC\u30D3\u30E5\u30FC">\uD83D\uDC41</button>
      <button class="tb-btn${store.showDualPane ? ' active' : ''}" data-action="dualpane" title="\u30C7\u30E5\u30A2\u30EB\u30DA\u30A4\u30F3">\u2B0C</button>
      <button class="tb-btn" data-action="dark" title="\u30C0\u30FC\u30AF\u30E2\u30FC\u30C9">${store.darkTheme ? '\u2600' : '\u263D'}</button>
    </div>
  `;

  if (_searchHadFocus) {
    const newSearch = document.getElementById('search-input');
    if (newSearch) { newSearch.focus(); newSearch.setSelectionRange(selStart, selEnd); }
  }

  if (!tb._eventsAttached) {
    tb._eventsAttached = true;

    tb.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.dataset.action;
        if (action === 'back') navigateBack();
        else if (action === 'forward') navigateForward();
        else if (action === 'up') navigateUp();
        else if (action === 'hidden') { store.showHidden = !store.showHidden; loadCurrentDir(); renderToolbar(); }
        else if (action === 'viewmode') { toggleViewMode(); }
        else if (action === 'preview') { store.showPreview = !store.showPreview; renderToolbar(); renderPreviewPanel(); }
        else if (action === 'dualpane') { store.showDualPane = !store.showDualPane; renderToolbar(); renderDualPane(); }
        else if (action === 'dark') { toggleDarkTheme(); }
        return;
      }

      const bc = e.target.closest('.breadcrumb-item');
      if (bc) { navigateTo(bc.dataset.path); return; }
    });

    tb.addEventListener('input', (e) => {
      if (e.target.id === 'search-input') {
        store.searchQuery = e.target.value;
        applyFilter();
      }
    });
  }
}
