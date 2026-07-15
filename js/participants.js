/**
 * js/participants.js
 *
 * Page controller for pages/participants.html.
 *
 * Builds a phone-keyed participant directory from every trip (see
 * js/modules/participant-utils.js for the matching/flagging logic) and
 * renders it as an expandable list with search.
 */

import { initShell, showToast } from './app.js';
import { fetchTrips } from './modules/trips-store.js';
import { buildParticipantDirectory } from './modules/participant-utils.js';
import { showLoadingState, showErrorState } from '../components/data-state.js';
import { formatBDT } from './utils/format.js';

initShell({
  activeNavId: 'participants',
  title: 'Participants',
  basePath: '../',
});

const listEl = document.getElementById('directory-list');
const emptyEl = document.getElementById('directory-empty');
const resultsCount = document.getElementById('directory-results-count');
const searchInput = document.getElementById('directory-search');

let directory = [];
let expandedKeys = new Set();
let searchQuery = '';

async function loadDirectory() {
  const trips = await fetchTrips();
  return buildParticipantDirectory(trips);
}

function getVisibleEntries() {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return directory;
  return directory.filter(
    (entry) => entry.displayName.toLowerCase().includes(q) || entry.phone.includes(q)
  );
}

function initials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function flagBadgesHtml(entry) {
  const badges = [];
  if (entry.flags.multipleNamesSamePhone) {
    badges.push('<span class="flag-badge" title="This phone number has been entered under more than one name"><i class="ti ti-alert-triangle" aria-hidden="true"></i>Multiple names</span>');
  }
  if (entry.flags.sameNameDifferentPhone) {
    badges.push('<span class="flag-badge" title="This name has been entered with more than one phone number"><i class="ti ti-alert-triangle" aria-hidden="true"></i>Possible duplicate</span>');
  }
  return badges.join(' ');
}

function renderDirectoryRow(entry) {
  const isExpanded = expandedKeys.has(entry.phoneKey);

  const tripRows = entry.trips.map((t) => `
    <tr>
      <td>${escapeHtml(t.tripName)}</td>
      <td>${formatDate(t.tripDate)}</td>
      <td>${escapeHtml(t.paymentMode)}</td>
      <td>${formatBDT(t.paidAmount)}</td>
      <td>${formatBDT(t.dueAmount)}</td>
      <td><span class="badge ${statusBadgeClass(t.paymentStatus)}">${t.paymentStatus}</span></td>
    </tr>
  `).join('');

  return `
    <div class="directory-row" data-phone-key="${escapeAttr(entry.phoneKey)}" data-expanded="${isExpanded}">
      <button type="button" class="directory-row__summary" data-action="toggle">
        <span class="directory-row__avatar" aria-hidden="true">${initials(entry.displayName)}</span>
        <span class="directory-row__identity">
          <span class="directory-row__name">${escapeHtml(entry.displayName)} ${flagBadgesHtml(entry)}</span>
          <span class="directory-row__phone">${escapeHtml(entry.phone || 'No phone on file')}</span>
        </span>
        <span class="directory-row__stats">
          <span class="directory-row__stat"><strong>${entry.tripCount}</strong> trip${entry.tripCount === 1 ? '' : 's'}</span>
          <span class="directory-row__stat"><strong>${formatBDT(entry.totalPaid)}</strong> paid</span>
          <span class="directory-row__stat"><strong>${formatBDT(entry.totalDue)}</strong> due</span>
        </span>
        <i class="ti ti-chevron-down directory-row__chevron" aria-hidden="true"></i>
      </button>
      <div class="directory-row__detail">
        <table class="directory-row__trip-table">
          <thead>
            <tr><th>Trip</th><th>Date</th><th>Payment mode</th><th>Paid</th><th>Due</th><th>Status</th></tr>
          </thead>
          <tbody>${tripRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function statusBadgeClass(status) {
  if (status === 'Paid') return 'badge-success';
  if (status === 'Partial') return 'badge-warning';
  return 'badge-danger';
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function render() {
  const visible = getVisibleEntries();
  listEl.innerHTML = visible.map(renderDirectoryRow).join('');
  emptyEl.hidden = visible.length > 0;
  resultsCount.textContent = `${visible.length} ${visible.length === 1 ? 'person' : 'people'}`;
}

listEl.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-action="toggle"]');
  if (!btn) return;
  const row = btn.closest('.directory-row');
  const key = row.dataset.phoneKey;
  if (expandedKeys.has(key)) {
    expandedKeys.delete(key);
  } else {
    expandedKeys.add(key);
  }
  row.dataset.expanded = String(expandedKeys.has(key));
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  render();
});

async function init() {
  showLoadingState(listEl, 'Loading participants...');

  try {
    directory = await loadDirectory();
    render();
  } catch (err) {
    console.error(err);
    showToast('Failed to load participants', 'danger');
    showErrorState(listEl, "Couldn't load participants — check your connection and try again.", init);
  }
}

init();
