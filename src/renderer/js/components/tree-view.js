/**
 * tree-view.js — Windows Explorer-style directory tree
 * Lazy-loads subdirectories on expand. Only shows directories.
 */

'use strict';

// Tree state: path -> { expanded, children (dirs only), loaded }
const _treeState = {};

function _ensureTreeNode(path) {
  if (!_treeState[path]) {
    _treeState[path] = { expanded: false, children: null, loaded: false };
  }
  return _treeState[path];
}

async function _loadTreeChildren(path) {
  const node = _ensureTreeNode(path);
  const result = await ipc.readDir(path, store.showHidden);
  if (!result.ok) {
    node.children = [];
    node.loaded = true;
    return [];
  }

  node.children = (result.data || [])
    .filter(f => f.isDirectory)
    .sort((a, b) => a.name.localeCompare(b.name, 'ja', { sensitivity: 'base' }));
  node.loaded = true;
  return node.children;
}

async function toggleTreeNode(path) {
  const node = _ensureTreeNode(path);
  node.expanded = !node.expanded;

  if (node.expanded && !node.loaded) {
    await _loadTreeChildren(path);
  }

  renderTreeView();
}

/**
 * Expand the tree to reveal a target path (all ancestors get expanded).
 */
async function expandTreeToPath(targetPath) {
  if (!targetPath || targetPath === '/') {
    const rootNode = _ensureTreeNode('/');
    rootNode.expanded = true;
    if (!rootNode.loaded) await _loadTreeChildren('/');
    renderTreeView();
    return;
  }

  const home = ipc.homeDir || '/home';
  const parts = targetPath.split('/').filter(Boolean);
  let current = '/';

  // Expand root
  const rootNode = _ensureTreeNode('/');
  if (!rootNode.loaded) await _loadTreeChildren('/');
  rootNode.expanded = true;

  // If target is under home, also expand home
  if (targetPath.startsWith(home)) {
    const homeNode = _ensureTreeNode(home);
    if (!homeNode.loaded) await _loadTreeChildren(home);
    homeNode.expanded = true;
  }

  // Expand each ancestor
  for (const part of parts) {
    current = current === '/' ? '/' + part : current + '/' + part;
    if (current === targetPath) break;
    const node = _ensureTreeNode(current);
    if (!node.loaded) await _loadTreeChildren(current);
    node.expanded = true;
  }

  renderTreeView();
}

/**
 * Invalidate cached children so next expand reloads from disk.
 */
function invalidateTreeNode(path) {
  const node = _treeState[path];
  if (node) {
    node.loaded = false;
    node.children = null;
  }
}

function renderTreeView() {
  const container = document.getElementById('tree-view');
  if (!container) return;

  const tab = getActiveTab();
  const currentPath = tab ? tab.path : '';
  const home = ipc.homeDir || '/home';

  let html = '';
  html += _renderTreeBranch(home, 'ホーム', '🏠', 0, currentPath);
  html += _renderTreeBranch('/', '/ (root)', '💿', 0, currentPath);

  container.innerHTML = html;

  // Scroll active node into view
  const active = container.querySelector('.tree-node-label.active');
  if (active) active.scrollIntoView({ block: 'nearest' });

  if (!container._eventsAttached) {
    container._eventsAttached = true;

    container.addEventListener('click', (e) => {
      const toggle = e.target.closest('.tree-toggle');
      if (toggle) {
        e.stopPropagation();
        const nodeEl = toggle.closest('.tree-node');
        if (nodeEl) toggleTreeNode(nodeEl.dataset.path);
        return;
      }

      const label = e.target.closest('.tree-node-label');
      if (label) {
        const nodeEl = label.closest('.tree-node');
        if (nodeEl) navigateTo(nodeEl.dataset.path);
      }
    });
  }
}

function _renderTreeBranch(path, displayName, icon, depth, currentPath) {
  const node = _treeState[path] || { expanded: false, children: null, loaded: false };
  const isActive = currentPath === path;
  const hasChildren = !node.loaded || (node.children && node.children.length > 0);

  let html = `<div class="tree-node" data-path="${escapeHtml(path)}">`;
  html += `<div class="tree-node-label${isActive ? ' active' : ''}" style="padding-left:${8 + depth * 16}px">`;

  if (hasChildren) {
    html += `<span class="tree-toggle">${node.expanded ? '▾' : '▸'}</span>`;
  } else {
    html += `<span class="tree-toggle-spacer"></span>`;
  }

  html += `<span class="tree-icon">${icon}</span>`;
  html += `<span class="tree-name">${escapeHtml(displayName)}</span>`;
  html += `</div>`;

  if (node.expanded && node.children) {
    for (const child of node.children) {
      html += _renderTreeBranch(child.path, child.name, '📁', depth + 1, currentPath);
    }
  }

  html += `</div>`;
  return html;
}
