/**
 * tab-bar.js — Tab management
 */

'use strict';

function renderTabBar() {
  const tb = document.getElementById('tab-bar');
  if (!tb) return;

  let html = '';
  for (let i = 0; i < store.tabs.length; i++) {
    const tab = store.tabs[i];
    const active = i === store.activeTabIndex ? ' active' : '';
    const label = tab.path.split('/').pop() || '/';
    html += `<div class="tab${active}" data-tab="${i}">
      <span class="tab-label" title="${escapeHtml(tab.path)}">${escapeHtml(label)}</span>
      ${store.tabs.length > 1 ? `<span class="tab-close" data-tab-close="${i}">\u00D7</span>` : ''}
    </div>`;
  }
  html += `<div class="tab-add" id="tab-add-btn">+</div>`;

  tb.innerHTML = html;

  // Event delegation (single attach)
  if (!tb._eventsAttached) {
    tb._eventsAttached = true;

    tb.addEventListener('click', (e) => {
      // Close button
      const closeBtn = e.target.closest('[data-tab-close]');
      if (closeBtn) {
        e.stopPropagation();
        const idx = parseInt(closeBtn.dataset.tabClose);
        _closeTab(idx);
        return;
      }

      // Add button
      if (e.target.closest('#tab-add-btn')) {
        _addTab();
        return;
      }

      // Tab switch
      const tabEl = e.target.closest('.tab[data-tab]');
      if (tabEl) {
        const idx = parseInt(tabEl.dataset.tab);
        if (idx !== store.activeTabIndex) {
          store.activeTabIndex = idx;
          store.focusedIndex = -1;
          store.searchQuery = '';
          renderTabBar();
          renderToolbar();
          renderSidebar();
          loadCurrentDir();
        }
      }
    });
  }
}

function _addTab() {
  const home = ipc.homeDir || '/home';
  store.tabs.push(createTab(home));
  store.activeTabIndex = store.tabs.length - 1;
  store.focusedIndex = -1;
  store.searchQuery = '';
  renderTabBar();
  renderToolbar();
  renderSidebar();
  loadCurrentDir();
}

function _closeTab(idx) {
  if (store.tabs.length <= 1) return;
  store.tabs.splice(idx, 1);
  if (store.activeTabIndex >= store.tabs.length) {
    store.activeTabIndex = store.tabs.length - 1;
  }
  store.focusedIndex = -1;
  renderTabBar();
  renderToolbar();
  renderSidebar();
  loadCurrentDir();
}
