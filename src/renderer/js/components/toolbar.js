/**
 * toolbar.js — Navigation bar + breadcrumbs + search
 * Event delegation + search focus preservation.
 */

'use strict';

let _searchHadFocus = false;

function renderToolbar() {
  const tb = document.getElementById('toolbar');
  if (!tb) return;

  const tab = getActiveTab();
  if (!tab) return;

  // Save search focus state before re-render
  const searchEl = document.getElementById('search-input');
  _searchHadFocus = searchEl && document.activeElement === searchEl;
  const selStart = searchEl ? searchEl.selectionStart : 0;
  const selEnd = searchEl ? searchEl.selectionEnd : 0;

  const canBack = tab.historyIndex > 0;
  const canForward = tab.historyIndex < tab.history.length - 1;
  const parts = tab.path.split('/').filter(Boolean);

  let breadcrumbs = `<span class="breadcrumb-item" data-path="/">/</span>`;
  let cumPath = '';
  for (const part of parts) {
    cumPath += '/' + part;
    breadcrumbs += `<span class="breadcrumb-sep">/</span><span class="breadcrumb-item" data-path="${escapeHtml(cumPath)}">${escapeHtml(part)}</span>`;
  }

  tb.innerHTML = `
    <div class="toolbar-nav">
      <button class="tb-btn${canBack ? '' : ' disabled'}" data-action="back" title="\u623B\u308B">\u25C0</button>
      <button class="tb-btn${canForward ? '' : ' disabled'}" data-action="forward" title="\u9032\u3080">\u25B6</button>
      <button class="tb-btn" data-action="up" title="\u89AA\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA">\u25B2</button>
    </div>
    <div class="toolbar-breadcrumbs">${breadcrumbs}</div>
    <div class="toolbar-search">
      <input type="text" id="search-input" placeholder="\uD83D\uDD0D \u691C\u7D22..." value="${escapeHtml(store.searchQuery)}">
    </div>
    <div class="toolbar-actions">
      <button class="tb-btn${store.showHidden ? ' active' : ''}" data-action="hidden" title="\u96A0\u3057\u30D5\u30A1\u30A4\u30EB">H</button>
    </div>
  `;

  // Restore search focus
  if (_searchHadFocus) {
    const newSearch = document.getElementById('search-input');
    if (newSearch) {
      newSearch.focus();
      newSearch.setSelectionRange(selStart, selEnd);
    }
  }

  // Event delegation — single attach
  if (!tb._eventsAttached) {
    tb._eventsAttached = true;

    tb.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.dataset.action;
        if (action === 'back') navigateBack();
        else if (action === 'forward') navigateForward();
        else if (action === 'up') navigateUp();
        else if (action === 'hidden') { store.showHidden = !store.showHidden; loadCurrentDir(); }
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
