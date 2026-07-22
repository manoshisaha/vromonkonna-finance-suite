/**
 * js/trip-history.js
 *
 * Page controller for pages/trip-history.html.
 *
 * Data comes from the real Apps Script API (js/modules/trips-store.js),
 * which falls back to the bundled mock dataset if the API is briefly
 * unreachable.
 *
 * Edit and Duplicate reuse the New Trip page: this controller writes the
 * selected trip into sessionStorage under PREFILL_STORAGE_KEY and
 * navigates to new-trip.html, which reads and clears that key on load.
 */

import { initShell, showToast } from './app.js';
import { fetchTrips, deleteTripRemote } from './modules/trips-store.js';
import { getCalculationSettings } from './modules/settings-store.js';
import { enrichTripWithFinancials, searchTrips, filterTrips, sortTrips, uniqueValues, uniqueHostNames } from './modules/trip-utils.js';
import { formatBDT, formatNumber } from './utils/format.js';
import { confirmDialog } from '../components/confirm-dialog.js';

export const PREFILL_STORAGE_KEY = 'vfs-new-trip-prefill';

initShell({
  activeNavId: 'trip-history',
  title: 'Trip History',
  basePath: '../',
});

/** ---------- State ---------- */

let trips = [];
let state = {
  search: '',
  status: 'all',
  destination: 'all',
  hostName: 'all',
  sortKey: 'tripDate',
  sortDir: 'desc',
};

const tbody = document.getElementById('trip-table-body');
const emptyState = document.getElementById('empty-state');
const resultsCount = document.getElementById('results-count');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const destinationFilter = document.getElementById('destination-filter');
const hostFilter = document.getElementById('host-filter');

async function loadTrips() {
  const [rawTrips, calcSettings] = await Promise.all([fetchTrips(), getCalculationSettings()]);
  return rawTrips.map((trip) => enrichTripWithFinancials(trip, calcSettings));
}

function populateFilterOptions() {
  const destinations = uniqueValues(trips, 'destination');
  const hosts = uniqueHostNames(trips);

  destinations.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    destinationFilter.appendChild(opt);
  });

  hosts.forEach((h) => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    hostFilter.appendChild(opt);
  });
}

function getVisibleTrips() {
  let result = searchTrips(trips, state.search);
  result = filterTrips(result, {
    status: state.status,
    destination: state.destination,
    hostName: state.hostName,
  });
  result = sortTrips(result, state.sortKey, state.sortDir);
  return result;
}

function statusBadgeClass(status) {
  if (status === 'Completed') return 'badge-success';
  if (status === 'Upcoming') return 'badge-info';
  return 'badge-danger';
}

function renderRows() {
  const visible = getVisibleTrips();

  tbody.innerHTML = visible.map((trip) => `
    <tr data-trip-id="${trip.id}">
      <td>${escapeHtml(trip.tripName)}</td>
      <td>${escapeHtml(trip.destination)}</td>
      <td>${escapeHtml(trip.hostDisplay)}</td>
      <td>${formatTripDateRange(trip)}</td>
      <td>${formatNumber(trip.participantCount)}</td>
      <td><span class="badge ${statusBadgeClass(trip.status)}">${trip.status}</span></td>
      <td>${formatBDT(trip.financials.grossProfit)}</td>
      <td>${formatBDT(trip.financials.organizationProfit)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-button" data-action="edit" aria-label="Edit trip">
            <i class="ti ti-edit" aria-hidden="true"></i>
          </button>
          <button type="button" class="icon-button" data-action="duplicate" aria-label="Duplicate trip">
            <i class="ti ti-copy" aria-hidden="true"></i>
          </button>
          <button type="button" class="icon-button" data-action="print" aria-label="Print trip">
            <i class="ti ti-printer" aria-hidden="true"></i>
          </button>
          <button type="button" class="icon-button icon-button--danger" data-action="delete" aria-label="Delete trip">
            <i class="ti ti-trash" aria-hidden="true"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  emptyState.hidden = visible.length > 0;
  resultsCount.textContent = `${visible.length} trip${visible.length === 1 ? '' : 's'}`;
  updateSortIndicators();
}

function updateSortIndicators() {
  document.querySelectorAll('.sortable-th').forEach((th) => {
    const isActive = th.dataset.sortKey === state.sortKey;
    th.dataset.active = String(isActive);
    const icon = th.querySelector('.sortable-th__icon');
    if (icon) {
      icon.className = `ti sortable-th__icon ${isActive ? (state.sortDir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending') : 'ti-arrows-sort'}`;
    }
  });
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Formats a trip's date as "15 Jul – 16 Jul 2026" if it has an end date, otherwise just the single date. */
function formatTripDateRange(trip) {
  if (!trip.tripEndDate) return formatDate(trip.tripDate);
  const start = new Date(trip.tripDate);
  const end = new Date(trip.tripEndDate);
  const startStr = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const endStr = end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** ---------- Toolbar wiring ---------- */

searchInput.addEventListener('input', () => {
  state.search = searchInput.value;
  renderRows();
});

statusFilter.addEventListener('change', () => {
  state.status = statusFilter.value;
  renderRows();
});

destinationFilter.addEventListener('change', () => {
  state.destination = destinationFilter.value;
  renderRows();
});

hostFilter.addEventListener('change', () => {
  state.hostName = hostFilter.value;
  renderRows();
});

document.querySelectorAll('.sortable-th').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sortKey;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDir = 'asc';
    }
    renderRows();
  });
});

/** ---------- Row action wiring (event delegation) ---------- */

tbody.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;

  const row = btn.closest('tr');
  const tripId = row.dataset.tripId;
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) return;

  const action = btn.dataset.action;

  if (action === 'edit') {
    goToNewTripForm(trip, 'edit');
  } else if (action === 'duplicate') {
    goToNewTripForm(trip, 'duplicate');
  } else if (action === 'print') {
    printTrip(trip);
  } else if (action === 'delete') {
    const ok = await confirmDialog({
      title: 'Delete this trip?',
      message: `"${trip.tripName}" and all of its participants and expenses will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete trip',
    });
    if (ok) {
      try {
        await deleteTripRemote(tripId);
        trips = trips.filter((t) => t.id !== tripId);
        renderRows();
        showToast('Trip deleted', 'success');
      } catch (err) {
        console.error(err);
        showToast('Failed to delete trip — check your connection', 'danger');
      }
    }
  }
});

function goToNewTripForm(trip, mode) {
  const payload = {
    mode,
    trip: mode === 'duplicate'
      ? { ...trip, id: null, tripName: `${trip.tripName} (Copy)`, tripDate: '', tripEndDate: '' }
      : trip,
  };
  sessionStorage.setItem(PREFILL_STORAGE_KEY, JSON.stringify(payload));
  window.location.href = 'new-trip.html';
}

function printTrip(trip) {
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    showToast('Please allow pop-ups to print', 'warning');
    return;
  }

  const expenseRows = trip.expenses.map((e) => `<tr><td>${escapeHtml(e.category)}</td><td>${formatBDT(e.amount)}</td></tr>`).join('');
  const roleLabels = { lead: 'Lead', coHost: 'Co-host', support: 'Support' };
  const hostRows = (trip.financials.hostBreakdown || []).map((h) =>
    `<tr><td>${escapeHtml(h.name)}</td><td>${roleLabels[h.role] || h.role}</td><td>${formatBDT(h.amount)}</td></tr>`
  ).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(trip.tripName)}</title>
      <style>
        body { font-family: -apple-system, sans-serif; padding: 32px; color: #14151a; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p { color: #565a66; font-size: 13px; margin: 0 0 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .summary div { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
        .summary span { display: block; font-size: 11px; color: #8a8f9c; }
        .summary strong { font-size: 15px; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(trip.tripName)}</h1>
      <p>${escapeHtml(trip.destination)} &middot; ${escapeHtml(trip.hostDisplay)} &middot; ${formatTripDateRange(trip)} &middot; ${trip.tripType === 'foreign' ? 'Foreign trip' : 'Domestic trip'}</p>
      <div class="summary">
        <div><span>Income</span><strong>${formatBDT(trip.financials.income)}</strong></div>
        <div><span>Total expenses</span><strong>${formatBDT(trip.financials.totalExpenses)}</strong></div>
        <div><span>Gross profit</span><strong>${formatBDT(trip.financials.grossProfit)}</strong></div>
        <div><span>Host budget</span><strong>${formatBDT(trip.financials.hostPayment)}</strong></div>
        <div><span>Social media fund</span><strong>${formatBDT(trip.financials.socialMediaFund)}</strong></div>
        <div><span>Organization profit</span><strong>${formatBDT(trip.financials.organizationProfit)}</strong></div>
      </div>
      <h2>Hosts</h2>
      <table><thead><tr><th>Name</th><th>Role</th><th>Amount</th></tr></thead><tbody>${hostRows}</tbody></table>
      <h2>Expenses</h2>
      <table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>${expenseRows}</tbody></table>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

/** ---------- Init ---------- */

async function init() {
  tbody.innerHTML = tableStateRow('Loading trips...');

  try {
    trips = await loadTrips();
    populateFilterOptions();
    renderRows();
  } catch (err) {
    console.error(err);
    showToast('Failed to load trip history', 'danger');
    tbody.innerHTML = tableStateRow(null, "Couldn't load trip history — check your connection and try again.");
    tbody.querySelector('[data-action="retry"]')?.addEventListener('click', init);
  }
}

/** Builds a full-width <tr> for loading/error states inside the trips <tbody>. */
function tableStateRow(loadingMessage, errorMessage) {
  if (errorMessage) {
    return `
      <tr><td colspan="9">
        <div class="data-state data-state--error">
          <i class="ti ti-alert-triangle" aria-hidden="true"></i>
          <span class="data-state__message">${errorMessage}</span>
          <button type="button" class="btn btn-secondary btn-sm" data-action="retry">Retry</button>
        </div>
      </td></tr>
    `;
  }
  return `
    <tr><td colspan="9">
      <div class="data-state">
        <span class="spinner" aria-hidden="true"></span>
        <span class="data-state__message">${loadingMessage}</span>
      </div>
    </td></tr>
  `;
}

init();
