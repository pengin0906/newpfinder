/**
 * toast.js — Notification toasts
 */

'use strict';

function showToast(msg, type = 'info', durationMs = 3000) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}
