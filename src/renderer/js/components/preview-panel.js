/**
 * preview-panel.js — File preview (WYSIWYG core)
 * Text, image, audio, video, file info.
 */

'use strict';

let _previewedPath = null;

function renderPreviewPanel() {
  const panel = document.getElementById('preview-panel');
  if (!panel) return;

  if (!store.showPreview) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'flex';

  const tab = getActiveTab();
  if (!tab || tab.selectedFiles.length === 0) {
    panel.innerHTML = '<div class="preview-empty">ファイルを選択してプレビュー</div>';
    _previewedPath = null;
    return;
  }

  if (tab.selectedFiles.length > 1) {
    const files = getCurrentFiles();
    let totalSize = 0;
    const sel = new Set(tab.selectedFiles);
    for (const f of files) { if (sel.has(f.path)) totalSize += f.size; }
    panel.innerHTML = `<div class="preview-multi">
      <div class="preview-multi-icon">📑</div>
      <div class="preview-multi-count">${tab.selectedFiles.length} 個選択</div>
      <div class="preview-multi-size">${formatSize(totalSize)}</div>
    </div>`;
    _previewedPath = null;
    return;
  }

  const filePath = tab.selectedFiles[0];
  if (filePath === _previewedPath) return; // already showing this
  _previewedPath = filePath;

  const entry = getCurrentFiles().find(f => f.path === filePath);
  if (!entry) return;

  _renderPreviewContent(panel, entry);
}

async function _renderPreviewContent(panel, entry) {
  const cat = entry.category || 'other';

  // Header
  let html = `<div class="preview-header">
    <span class="preview-icon">${getFileIcon(entry)}</span>
    <span class="preview-filename">${escapeHtml(entry.name)}</span>
  </div>`;

  // Info section
  html += `<div class="preview-info">
    <div class="preview-info-row"><span>サイズ</span><span>${entry.isDirectory ? '--' : formatSize(entry.size)}</span></div>
    <div class="preview-info-row"><span>更新日</span><span>${formatDate(entry.modified)}</span></div>
    <div class="preview-info-row"><span>カテゴリ</span><span class="cat-badge" style="background:${entry.categoryColor}">${cat}</span></div>
    <div class="preview-info-row"><span>ID</span><span class="id-badge">${entry.id ? entry.id.slice(-8) : ''}</span></div>
  </div>`;

  html += '<div class="preview-content" id="preview-content"></div>';
  panel.innerHTML = html;

  const contentEl = document.getElementById('preview-content');
  if (!contentEl) return;

  // Image preview
  if (cat === 'image') {
    contentEl.innerHTML = `<img class="preview-image" src="file://${encodeURI(entry.path)}" alt="${escapeHtml(entry.name)}">`;
    return;
  }

  // Video preview
  if (cat === 'video') {
    contentEl.innerHTML = `<video class="preview-video" controls preload="metadata">
      <source src="file://${encodeURI(entry.path)}">
    </video>`;
    return;
  }

  // Audio preview
  if (cat === 'audio') {
    contentEl.innerHTML = `<div class="preview-audio-icon">🎵</div>
      <audio class="preview-audio" controls preload="metadata">
        <source src="file://${encodeURI(entry.path)}">
      </audio>`;
    return;
  }

  // Text/code/config preview
  const textCats = ['code', 'config', 'script', 'document', 'data', 'log'];
  if (textCats.includes(cat) || entry.ext === '.md' || entry.ext === '.txt' || entry.ext === '.json') {
    const result = await ipc.readTextFile(entry.path, 80);
    if (result.ok) {
      const info = result.data.truncated ? `<div class="preview-truncated">${result.data.totalLines}行中 80行表示</div>` : '';
      contentEl.innerHTML = `<pre class="preview-code">${escapeHtml(result.data.content)}</pre>${info}`;
    } else {
      contentEl.innerHTML = '<div class="preview-empty">プレビューできません</div>';
    }
    return;
  }

  // PDF — just show icon
  if (cat === 'pdf') {
    contentEl.innerHTML = '<div class="preview-pdf-icon">📄 PDF</div>';
    return;
  }

  // Directory info
  if (entry.isDirectory) {
    const result = await ipc.readDir(entry.path, store.showHidden);
    if (result.ok) {
      const count = result.data.length;
      const dirs = result.data.filter(f => f.isDirectory).length;
      const files = count - dirs;
      contentEl.innerHTML = `<div class="preview-dir-info">
        <div>📁 ${count} 項目</div>
        <div>${dirs} フォルダ, ${files} ファイル</div>
      </div>`;
    }
    return;
  }

  // Fallback
  contentEl.innerHTML = '<div class="preview-empty">プレビューなし</div>';
}

function updatePreviewIfNeeded() {
  if (!store.showPreview) return;
  _previewedPath = null; // force refresh
  renderPreviewPanel();
}
