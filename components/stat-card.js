/**
 * components/stat-card.js
 *
 * Reusable "stat card" used on the Dashboard (and any future summary screens)
 * to display a single KPI: a label, a formatted value, an icon, and an
 * optional trend delta.
 */

/**
 * @typedef {Object} StatCardConfig
 * @property {string} label
 * @property {string} value        - pre-formatted display value (e.g. "৳1,24,500")
 * @property {string} iconKey      - key into ICONS below
 * @property {'accent'|'success'|'warning'|'info'|'danger'} tint
 * @property {{ text: string, direction: 'up'|'down'|'neutral' }} [delta]
 */

const ICONS = {
  trips: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12l2.5-7A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.4L21 12M3 12v6a1 1 0 0 0 1 1h1.5M3 12h18M21 12v6a1 1 0 0 1-1 1h-1.5M7 19v1M17 19v1"/></svg>',
  revenue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l6-6 4 4 8-8M21 7v6M15 7h6"/></svg>',
  expense: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7l6 6 4-4 8 8M21 17v-6M15 17h6"/></svg>',
  profit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1"/></svg>',
  shirt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8z"/></svg>',
  megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6l-5 4H4a1 1 0 0 0-1 1z"/><path d="M14 9a3 3 0 0 1 0 6"/></svg>',
  host: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7"/></svg>',
};

/**
 * Returns an HTML string for a single stat card. Caller inserts this into a
 * container with class "stat-grid".
 * @param {StatCardConfig} config
 * @returns {string}
 */
export function statCardHtml(config) {
  const { label, value, iconKey, tint = 'accent', delta } = config;
  return `
    <div class="stat-card">
      <div class="stat-card__top">
        <span class="stat-card__label">${label}</span>
        <span class="stat-card__icon icon-tint-${tint}" aria-hidden="true">${ICONS[iconKey] || ''}</span>
      </div>
      <div class="stat-card__value">${value}</div>
      ${delta ? deltaHtml(delta) : ''}
    </div>
  `;
}

function deltaHtml(delta) {
  const arrow = delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '•';
  return `<span class="stat-card__delta stat-card__delta--${delta.direction}">${arrow} ${delta.text}</span>`;
}

/**
 * Renders a list of stat card configs into a container element.
 * @param {HTMLElement} containerEl
 * @param {StatCardConfig[]} cards
 */
export function renderStatCards(containerEl, cards) {
  containerEl.innerHTML = cards.map(statCardHtml).join('');
}
