/**
 * components/sidebar.js
 *
 * Reusable sidebar navigation component.
 * Renders the primary nav and wires up active-page highlighting,
 * mobile drawer toggling, and collapse behaviour.
 *
 * Usage:
 *   import { renderSidebar } from '../components/sidebar.js';
 *   renderSidebar(document.getElementById('sidebar-slot'), 'dashboard');
 */

/** Ordered nav definition. Single source of truth for the app's IA. */
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', href: 'index.html', icon: 'grid' },
  { id: 'new-trip', label: 'New Trip', href: 'pages/new-trip.html', icon: 'plus-circle' },
  { id: 'trip-history', label: 'Trip History', href: 'pages/trip-history.html', icon: 'clock' },
  { id: 'participants', label: 'Participants', href: 'pages/participants.html', icon: 'users' },
  { id: 'funds', label: 'Funds', href: 'pages/funds.html', icon: 'wallet' },
  { id: 'initiatives', label: 'Initiatives', href: 'pages/initiatives.html', icon: 'layers' },
  { id: 'reports', label: 'Reports', href: 'pages/reports.html', icon: 'bar-chart' },
  { id: 'settings', label: 'Settings', href: 'pages/settings.html', icon: 'settings' },
];

/** Minimal inline icon set (stroke-based, currentColor) so no icon font/CDN is required. */
const ICONS = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  'plus-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><circle cx="17" cy="8" r="2.6"/><path d="M22 20c0-2.6-2-4.8-4.8-5.6"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1"/></svg>',
  'bar-chart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

/**
 * Builds the sidebar markup and injects it into the target element.
 * @param {HTMLElement} targetEl - container to render into
 * @param {string} activeId - id of the currently active NAV_ITEMS entry
 * @param {{ orgName?: string, basePath?: string }} [options]
 */
export function renderSidebar(targetEl, activeId, options = {}) {
  const { orgName = 'Vromonkonna', basePath = '' } = options;
  const initials = orgName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  targetEl.innerHTML = `
    <aside class="sidebar" aria-label="Primary navigation">
      <div class="sidebar__brand">
        <div class="sidebar__brand-mark" aria-hidden="true"></div>
        <span class="sidebar__brand-name">Vromonkonna</span>
      </div>
      <nav class="sidebar__nav">
        <span class="sidebar__section-label">Menu</span>
        ${NAV_ITEMS.map((item) => navItemHtml(item, activeId, basePath)).join('')}
      </nav>
      <div class="sidebar__footer">
        <div class="sidebar__org">
          <div class="sidebar__org-avatar" aria-hidden="true">${initials}</div>
          <div class="sidebar__org-meta">
            <div class="sidebar__org-name">${escapeHtml(orgName)}</div>
            <div class="sidebar__org-role">Finance Suite</div>
          </div>
        </div>
      </div>
    </aside>
    <div class="sidebar-scrim" data-sidebar-scrim></div>
  `;

  wireMobileScrim(targetEl);
}

function navItemHtml(item, activeId, basePath) {
  const isActive = item.id === activeId;
  return `
    <a class="nav-item" href="${basePath}${item.href}" ${isActive ? 'aria-current="page"' : ''}>
      <span class="nav-item__icon" aria-hidden="true">${ICONS[item.icon] || ''}</span>
      <span class="nav-item__label">${item.label}</span>
    </a>
  `;
}

function wireMobileScrim(targetEl) {
  const scrim = targetEl.querySelector('[data-sidebar-scrim]');
  if (!scrim) return;
  scrim.addEventListener('click', () => {
    const shell = document.querySelector('.app-shell');
    if (shell) shell.setAttribute('data-sidebar-open', 'false');
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export { NAV_ITEMS };
