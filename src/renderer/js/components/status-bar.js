/**
 * status-bar.js — Bottom bar: item count, disk, git, tracked IDs
 */

'use strict';

let _cachedDiskHtml = '';
let _cachedGitHtml = '';
let _statusBarPath = null;

function renderStatusBar() {
  const sb = document.getElementById('status-bar');
  if (!sb) return;

  const tab = getActiveTab();
  if (!tab) return;

  const files = getCurrentFiles();
  const selectedCount = tab.selectedFiles.length;
  const totalCount = files.length;

  let selectedSize = 0;
  if (selectedCount > 0) {
    const fileMap = new Map(files.map(f => [f.path, f]));
    for (const p of tab.selectedFiles) {
      const f = fileMap.get(p);
      if (f && !f.isDirectory) selectedSize += f.size;
    }
  }

  let itemInfo = `${totalCount} \u9805\u76EE`;
  if (selectedCount > 0) {
    itemInfo += ` (${selectedCount}\u9078\u629E, ${formatSize(selectedSize)})`;
  }

  sb.innerHTML = `
    <span class="status-item">${itemInfo}</span>
    <span class="status-spacer"></span>
    <span id="sb-git">${_cachedGitHtml}</span>
    <span id="sb-disk">${_cachedDiskHtml}</span>
  `;

  if (_statusBarPath !== tab.path) {
    _statusBarPath = tab.path;
    _refreshStatusBarAsync(tab.path);
  }
}

async function _refreshStatusBarAsync(dirPath) {
  const [diskResult, gitResult] = await Promise.all([
    ipc.getDiskUsage(dirPath).catch(() => null),
    ipc.getGitInfo(dirPath).catch(() => null),
  ]);

  if (diskResult && diskResult.ok) {
    _cachedDiskHtml = `<span class="status-item">\u7A7A\u304D: ${formatSize(diskResult.data.free)} / ${formatSize(diskResult.data.total)}</span>`;
  }

  if (gitResult && gitResult.ok && gitResult.data && gitResult.data.isRepo) {
    const g = gitResult.data;
    let counts = '';
    if (g.modified) counts += `<span class="git-count modified">~${g.modified}</span>`;
    if (g.staged) counts += `<span class="git-count staged">+${g.staged}</span>`;
    if (g.untracked) counts += `<span class="git-count untracked">?${g.untracked}</span>`;
    const ahead = g.ahead ? ` \u2191${g.ahead}` : '';
    const behind = g.behind ? ` \u2193${g.behind}` : '';
    _cachedGitHtml = `<span class="status-item git-status">\uD83C\uDF3F ${escapeHtml(g.branch)}${ahead}${behind} ${counts}</span>`;
    store._gitFileStatuses = g.fileStatuses || {};
  } else {
    _cachedGitHtml = '';
    store._gitFileStatuses = {};
  }

  const gitEl = document.getElementById('sb-git');
  const diskEl = document.getElementById('sb-disk');
  if (gitEl) gitEl.innerHTML = _cachedGitHtml;
  if (diskEl) diskEl.innerHTML = _cachedDiskHtml;
}
