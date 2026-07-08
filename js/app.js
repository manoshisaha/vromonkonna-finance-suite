/**
 * js/app.js
 *
 * Shared bootstrap logic run on every page: mounts the sidebar and topbar,
 * applies the persisted theme, and exposes a tiny toast helper.
 *
 * Each page's own script (e.g. js/dashboard.js) imports `initShell()` and
 * calls it with the page's nav id + title, then does its page-specific work.
 */

import { renderSidebar } from '../components/sidebar.js';
import { renderTopbar, applyStoredTheme } from '../components/topbar.js';

applyStoredTheme();

/**
 * Mounts the shared shell (sidebar + topbar) for the current page.
 * @param {{ activeNavId: string, title: string, subtitle?: string, basePath?: string }} config
 */
export function initShell(config) {
  const { activeNavId, title, subtitle, basePath = '' } = config;

  const sidebarSlot = document.getElementById('sidebar-slot');
  const topbarSlot = document.getElementById('topbar-slot');

  if (sidebarSlot) renderSidebar(sidebarSlot, activeNavId, { basePath });
  if (topbarSlot) renderTopbar(topbarSlot, { title, subtitle });

  ensureToastContainer();
}

function ensureToastContainer() {
  if (document.querySelector('.toast-container')) return;
  const el = document.createElement('div');
  el.className = 'toast-container';
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
}

/**
 * Shows a transient toast notification.
 * @param {string} message
 * @param {'default'|'success'|'warning'|'danger'} [variant]
 * @param {number} [durationMs]
 */
export function showToast(message, variant = 'default', durationMs = 3200) {
  const container = document.querySelector('.toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast${variant !== 'default' ? ` toast-${variant}` : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, durationMs);
}
