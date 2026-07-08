/**
 * js/new-trip.js
 *
 * Page controller for pages/new-trip.html.
 *
 * Responsibilities:
 *   - Mount shared shell (sidebar/topbar) with basePath '../' since this
 *     page lives inside /pages/.
 *   - Load hosts, expense categories, and calculation settings from the
 *     real Apps Script API once at page load.
 *   - Manage dynamic participant and expense rows.
 *   - Recalculate financials on every relevant input change using the
 *     shared calculation engine (js/modules/calculations.js) and render
 *     results into the collapsible live summary panel.
 *   - Handle Save Trip: POSTs to the real API (js/modules/trips-store.js),
 *     including the last-calculated financials so the backend can write
 *     fund contribution rows. The backend increments the host's lifetime
 *     trip count automatically on creation — the frontend no longer needs to.
 */

import { initShell, showToast } from './app.js';
import { renderLiveSummaryPanel } from '../components/live-summary-panel.js';
import { createParticipantRow, getParticipantRowData } from '../components/participant-row.js';
import { createExpenseRow, getExpenseRowData } from '../components/expense-row.js';
import { calculateTripFinancials, determineHostCategory } from './modules/calculations.js';
import { getCalculationSettings } from './modules/settings-store.js';
import { getHosts, addHost } from './modules/host-directory.js';
import { getAllCategories } from './modules/expense-category-store.js';
import { saveTripRemote } from './modules/trips-store.js';
import { formatBDT } from './utils/format.js';
import { formModal } from '../components/form-modal.js';

const PREFILL_STORAGE_KEY = 'vfs-new-trip-prefill';
const prefill = readPrefillFromSessionStorage();

initShell({
  activeNavId: 'new-trip',
  title: prefill ? (prefill.mode === 'edit' ? 'Edit Trip' : 'Duplicate Trip') : 'New Trip',
  basePath: '../',
});

/**
 * Reads and clears the one-shot handoff payload written by Trip History's
 * Edit/Duplicate actions (see js/trip-history.js goToNewTripForm()).
 * Returns null on a normal "create new" visit.
 */
function readPrefillFromSessionStorage() {
  const raw = sessionStorage.getItem(PREFILL_STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PREFILL_STORAGE_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const summaryPanel = renderLiveSummaryPanel(document.getElementById('live-summary-slot'));

const participantRowsEl = document.getElementById('participant-rows');
const expenseRowsEl = document.getElementById('expense-rows');
const participantEmptyHint = document.getElementById('participant-empty-hint');
const expenseEmptyHint = document.getElementById('expense-empty-hint');
const participantCountLabel = document.getElementById('participant-count-label');
const expenseCountLabel = document.getElementById('expense-count-label');

const hostSelect = document.getElementById('hostSelect');
const hostTripCountDisplay = document.getElementById('hostTripCountDisplay');
const hostCategoryDisplay = document.getElementById('hostCategoryDisplay');
const currentParticipantsDisplay = document.getElementById('currentParticipantsDisplay');
const packagePriceInput = document.getElementById('packagePrice');
const otherIncomeInput = document.getElementById('otherIncome');
const saveTripBtn = document.getElementById('save-trip-btn');

const CATEGORY_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const ADD_HOST_OPTION_VALUE = '__add_new_host__';

/** ---------- Module state, populated once during init() ---------- */

let hosts = [];
let expenseCategories = [];
let calcSettings = null;
let lastFinancials = null;

function populateHostSelect(selectedName) {
  hostSelect.innerHTML = `
    <option value="" disabled ${!selectedName ? 'selected' : ''}>Select a host</option>
    ${hosts.map((h) => `<option value="${h.name}" ${h.name === selectedName ? 'selected' : ''}>${h.name} (${h.lifetimeTripCount} trips)</option>`).join('')}
    <option value="${ADD_HOST_OPTION_VALUE}">+ Add new host...</option>
  `;
}

function getSelectedHost() {
  return hosts.find((h) => h.name === hostSelect.value) || null;
}

hostSelect.addEventListener('change', async () => {
  if (hostSelect.value === ADD_HOST_OPTION_VALUE) {
    const result = await formModal({
      title: 'Add new host',
      fields: [
        { name: 'name', label: 'Host name', type: 'text', required: true },
        { name: 'lifetimeTripCount', label: 'Lifetime trip count so far', type: 'number', required: true, min: 0 },
      ],
      submitLabel: 'Add host',
    });

    if (result) {
      try {
        hosts = await addHost({ name: result.name, lifetimeTripCount: result.lifetimeTripCount });
        populateHostSelect(result.name);
      } catch (err) {
        console.error(err);
        showToast('Failed to add host — check your connection', 'danger');
        populateHostSelect('');
      }
    } else {
      populateHostSelect('');
    }
  }
  recalculate();
});

/** ---------- Participants ---------- */

function addParticipantRow() {
  const row = createParticipantRow({
    onChange: recalculate,
    onRemove: () => {
      updateEmptyHints();
      recalculate();
    },
  });
  participantRowsEl.appendChild(row);
  updateEmptyHints();
  recalculate();
}

document.getElementById('add-participant-btn').addEventListener('click', addParticipantRow);

/** ---------- Expenses ---------- */

function addExpenseRow() {
  const row = createExpenseRow({
    categories: expenseCategories,
    onChange: recalculate,
    onRemove: () => {
      updateEmptyHints();
      recalculate();
    },
  });
  expenseRowsEl.appendChild(row);
  updateEmptyHints();
  recalculate();
}

document.getElementById('add-expense-btn').addEventListener('click', addExpenseRow);

/** ---------- Shared recalculation ---------- */

function updateEmptyHints() {
  const participantCount = participantRowsEl.children.length;
  const expenseCount = expenseRowsEl.children.length;

  participantEmptyHint.hidden = participantCount > 0;
  expenseEmptyHint.hidden = expenseCount > 0;

  participantCountLabel.textContent = `${participantCount} participant${participantCount === 1 ? '' : 's'}`;
  expenseCountLabel.textContent = `${expenseCount} expense${expenseCount === 1 ? '' : 's'}`;
  currentParticipantsDisplay.value = String(participantCount);
}

function recalculate() {
  const participantCount = participantRowsEl.children.length;
  const packagePrice = Number(packagePriceInput.value) || 0;
  const otherIncome = Number(otherIncomeInput.value) || 0;
  const selectedHost = getSelectedHost();
  const hostTripCount = selectedHost ? selectedHost.lifetimeTripCount : 0;

  hostTripCountDisplay.value = selectedHost ? String(selectedHost.lifetimeTripCount) : '—';

  const expenses = Array.from(expenseRowsEl.children).map((row) => getExpenseRowData(row));

  const category = determineHostCategory(hostTripCount, calcSettings);
  hostCategoryDisplay.value = CATEGORY_LABELS[category];

  const result = calculateTripFinancials({
    participantCount,
    packagePrice,
    otherIncome,
    expenses,
    hostLifetimeTripCount: hostTripCount,
    settings: calcSettings,
  });

  lastFinancials = result;
  summaryPanel.update(result, formatBDT);
}

[packagePriceInput, otherIncomeInput].forEach((input) => {
  input.addEventListener('input', recalculate);
});

/** ---------- Save ---------- */

document.getElementById('new-trip-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.target;
  const selectedHost = getSelectedHost();
  if (!form.checkValidity() || !selectedHost) {
    if (!selectedHost) showToast('Please select a host', 'warning');
    form.reportValidity();
    return;
  }

  const participants = Array.from(participantRowsEl.children).map((row) => getParticipantRowData(row));
  const expenses = Array.from(expenseRowsEl.children).map((row) => getExpenseRowData(row));

  const payload = {
    tripId: prefill && prefill.mode === 'edit' ? prefill.trip.id : undefined,
    tripName: document.getElementById('tripName').value.trim(),
    destination: document.getElementById('destination').value.trim(),
    tripDate: document.getElementById('tripDate').value,
    hostName: selectedHost.name,
    hostTripCount: selectedHost.lifetimeTripCount,
    packagePrice: Number(packagePriceInput.value) || 0,
    maxParticipants: Number(document.getElementById('maxParticipants').value) || null,
    otherIncome: Number(otherIncomeInput.value) || 0,
    notes: document.getElementById('notes').value.trim(),
    participants,
    expenses,
    financials: lastFinancials,
  };

  saveTripBtn.disabled = true;
  saveTripBtn.textContent = 'Saving...';

  try {
    await saveTripRemote(payload);
    showToast('Trip saved', 'success');
    window.location.href = 'trip-history.html';
  } catch (err) {
    console.error(err);
    showToast('Failed to save trip — check your connection and try again', 'danger');
    saveTripBtn.disabled = false;
    saveTripBtn.textContent = 'Save trip';
  }
});

/** ---------- Prefill (Edit / Duplicate from Trip History) ---------- */

function populateFromPrefill(trip) {
  document.getElementById('tripName').value = trip.tripName || '';
  document.getElementById('destination').value = trip.destination || '';
  document.getElementById('tripDate').value = trip.tripDate || '';
  packagePriceInput.value = trip.packagePrice ?? '';
  document.getElementById('maxParticipants').value = trip.maxParticipants ?? '';
  otherIncomeInput.value = trip.otherIncome ?? '';
  document.getElementById('notes').value = trip.notes || '';

  const hostExists = hosts.some((h) => h.name === trip.hostName);
  if (!hostExists && trip.hostName) {
    hosts.push({ id: `host-prefill-${Date.now()}`, name: trip.hostName, lifetimeTripCount: trip.hostLifetimeTripCount || 0 });
  }
  populateHostSelect(trip.hostName || '');

  (trip.participants || []).forEach((p) => {
    const row = createParticipantRow({ onChange: recalculate, onRemove: () => { updateEmptyHints(); recalculate(); } });
    row.querySelector('[name="name"]').value = p.name || '';
    row.querySelector('[name="phone"]').value = p.phone || '';
    row.querySelector('[name="paidAmount"]').value = p.paidAmount ?? '';
    row.querySelector('[name="dueAmount"]').value = p.dueAmount ?? '';
    row.querySelector('[name="pickupPoint"]').value = p.pickupPoint || '';
    row.querySelector('[name="paymentStatus"]').value = p.paymentStatus || 'Paid';
    participantRowsEl.appendChild(row);
  });

  (trip.expenses || []).forEach((e) => {
    const row = createExpenseRow({ categories: expenseCategories, onChange: recalculate, onRemove: () => { updateEmptyHints(); recalculate(); } });
    const categorySelect = row.querySelector('[name="category"]');
    const hasOption = Array.from(categorySelect.options).some((o) => o.value === e.category);
    if (hasOption) {
      categorySelect.value = e.category;
    } else {
      categorySelect.value = '__custom__';
      row.querySelector('.custom-category-field').hidden = false;
      row.querySelector('[name="customCategory"]').value = e.category;
    }
    row.querySelector('[name="amount"]').value = e.amount ?? '';
    row.querySelector('[name="note"]').value = e.note || '';
    expenseRowsEl.appendChild(row);
  });
}

/** ---------- Init ---------- */

async function init() {
  try {
    [hosts, expenseCategories, calcSettings] = await Promise.all([
      getHosts(),
      getAllCategories(),
      getCalculationSettings(),
    ]);
  } catch (err) {
    console.error(err);
    showToast('Failed to load hosts/categories/settings — check your connection', 'danger');
  }

  populateHostSelect('');

  if (prefill && prefill.trip) {
    populateFromPrefill(prefill.trip);
  } else {
    addParticipantRow();
    addExpenseRow();
  }

  updateEmptyHints();
  recalculate();
}

init();
