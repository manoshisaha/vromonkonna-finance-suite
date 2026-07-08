/**
 * components/topbar.js
 *
 * Reusable topbar component: page title, mobile nav toggle, and
 * dark/light theme switch. Theme preference is persisted in
 * localStorage under the key 'vfs-theme'.
 */

const THEME_STORAGE_KEY = 'vfs-theme';

/**
 * Renders the topbar into targetEl.
 * @param {HTMLElement} targetEl
 * @param {{ title: string, subtitle?: string }} pageInfo
 */
export function renderTopbar(targetEl, pageInfo) {
  const { title, subtitle = '' } = pageInfo;

  targetEl.innerHTML = `
    <header class="topbar">
      <div class="topbar__left">
        <button class="sidebar-toggle" type="button" aria-label="Toggle navigation" data-action="toggle-sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18">
            <path d="M4 7h16M4 12h16M4 17h16"/>
          </svg>
        </button>
        <span class="topbar__page-title">${title}</span>
      </div>
      <div class="topbar__right">
        <button class="icon-button" type="button" aria-label="Toggle dark mode" data-action="toggle-theme">
          <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
          </svg>
        </button>
      </div>
    </header>
  `;

  wireThemeToggle(targetEl);
  wireSidebarToggle(targetEl);
}

function wireThemeToggle(targetEl) {
  const btn = targetEl.querySelector('[data-action="toggle-theme"]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  });
}

function wireSidebarToggle(targetEl) {
  const btn = targetEl.querySelector('[data-action="toggle-sidebar"]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const shell = document.querySelector('.app-shell');
    if (!shell) return;
    const isOpen = shell.getAttribute('data-sidebar-open') === 'true';
    shell.setAttribute('data-sidebar-open', String(!isOpen));
  });
}

/** Applies the persisted theme before first paint (call this early in <head> or top of app.js). */
export function applyStoredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    document.documentElement.setAttribute('data-theme', stored);
  }
}
