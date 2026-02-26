/**
 * utils.js — Utility functions
 */

'use strict';

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return (i === 0 ? val : val.toFixed(1)) + ' ' + units[i];
}

function formatDate(ms) {
  if (!ms) return '--';
  const d = new Date(ms);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  if (d.toDateString() === now.toDateString()) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}/${pad(d.getDate())}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getFileIcon(entry) {
  if (entry.isDirectory) return '\uD83D\uDCC1';
  if (entry.isSymlink) return '\uD83D\uDD17';

  const cat = entry.category;
  const iconMap = {
    document: '\uD83D\uDCC4', pdf: '\uD83D\uDCC4', spreadsheet: '\uD83D\uDCCA',
    presentation: '\uD83D\uDCCA', image: '\uD83D\uDDBC\uFE0F', video: '\uD83C\uDFA5',
    audio: '\uD83C\uDFB5', font: '\uD83D\uDD24', code: '\uD83D\uDCDD', config: '\u2699\uFE0F',
    script: '\uD83D\uDCDC', data: '\uD83D\uDDC4\uFE0F', database: '\uD83D\uDDC4\uFE0F',
    log: '\uD83D\uDCCB', archive: '\uD83D\uDCE6', executable: '\u2699\uFE0F',
  };
  return iconMap[cat] || '\uD83D\uDCC4';
}

function sortFiles(files, sortBy, sortAsc) {
  const sorted = [...files].sort((a, b) => {
    // Folders always first
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;

    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'ja', { sensitivity: 'base' });
        break;
      case 'size':
        cmp = a.size - b.size;
        break;
      case 'modified':
        cmp = a.modified - b.modified;
        break;
      case 'category':
        cmp = (a.category || '').localeCompare(b.category || '');
        if (cmp === 0) cmp = a.name.localeCompare(b.name, 'ja', { sensitivity: 'base' });
        break;
      default:
        cmp = a.name.localeCompare(b.name, 'ja', { sensitivity: 'base' });
    }
    return sortAsc ? cmp : -cmp;
  });
  return sorted;
}
