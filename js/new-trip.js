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
 *   - Manage a Host Team: one or more hosts, each with a Role (Lead/
 *     Co-host/Support). Exactly one Lead is required. On domestic trips,
 *     the Lead's tier alone determines the Host Budget (Co-host/Support
 *     tiers are ignored for budget purposes); on foreign trips, the
 *     budget is a per-participant rate × participant count instead. The
 *     budget is then split among the team by role weight — see
 *     calculateTripFinancials()/distributeHostBudget() in calculations.js.
 *   - Manage dynamic participant and expense rows.
 *   - Recalculate financials on every relevant input change and render
 *     results (including the per-host breakdown) into the collapsible
 *     live summary panel.
 *   - Handle Save Trip: validates the host team (validateHostTeam()),
 *     then POSTs to the real API (js/modules/trips-store.js), including
 *     the last-calculated financials so the backend can write fund
 *     contribution rows and per-host payment rows. The backend
 *     increments every assigned host's lifetime trip count automatically
 *     on creation.
 */

import { initShell, showToast } from './app.js';
import { renderLiveSummaryPanel } from '../components/live-summary-panel.js';
import { createParticipantRow, getParticipantRowData, setParticipantRowData, parseParticipantBulkText } from '../components/participant-row.js';
import { createExpenseRow, getExpenseRowData } from '../components/expense-row.js';
import { createHostRow, refreshHostRowOptions, getHostRowData, setHostRowRole, setHostRowWeightOverride, setHostRowTierDisplay, ADD_HOST_OPTION_VALUE } from '../components/host-row.js';
import { calculateTripFinancials, determineHostCategory, validateHostTeam, getEffectiveHostCaps } from './modules/calculations.js';
import { getCalculationSettings } from './modules/settings-store.js';
import { getHosts, addHost } from './modules/host-directory.js';
import { getAllCategories } from './modules/expense-category-store.js';
import { saveTripRemote, fetchTrips } from './modules/trips-store.js';
import { buildParticipantDirectory } from './modules/participant-utils.js';
import { formatBDT } from './utils/format.js';
import { formModal } from '../components/form-modal.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { showLoadingState, showErrorState } from '../components/data-state.js';

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

const hostRowsEl = document.getElementById('host-rows');
const hostEmptyHint = document.getElementById('host-empty-hint');
const hostCountLabel = document.getElementById('host-count-label');
const hostCapsInfo = document.getElementById('host-caps-info');

const participantRowsEl = document.getElementById('participant-rows');
const expenseRowsEl = document.getElementById('expense-rows');
const participantEmptyHint = document.getElementById('participant-empty-hint');
const expenseEmptyHint = document.getElementById('expense-empty-hint');
const participantCountLabel = document.getElementById('participant-count-label');
const expenseCountLabel = document.getElementById('expense-count-label');

const participantCountInput = document.getElementById('participantCountInput');
const trackDetailsToggle = document.getElementById('track-participant-details');
const participantsDetailSection = document.getElementById('participants-detail-section');
const packagePriceInput = document.getElementById('packagePrice');
const otherIncomeInput = document.getElementById('otherIncome');
const saveTripBtn = document.getElementById('save-trip-btn');

const tripTypeSelect = document.getElementById('tripType');
const tripDurationField = document.getElementById('tripDurationField');
const tripDurationSelect = document.getElementById('tripDuration');
const tripLengthSelect = document.getElementById('tripLength');
const tripEndDateField = document.getElementById('tripEndDateField');
const tripEndDateInput = document.getElementById('tripEndDate');
const tripDateInput = document.getElementById('tripDate');
const tripDateLabel = document.getElementById('tripDateLabel');

const CATEGORY_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

/** ---------- Module state, populated once during init() ---------- */

let hosts = [];
let expenseCategories = [];
let calcSettings = null;
let lastFinancials = null;
let phoneDirectory = [];

/** ---------- Trip type (domestic / foreign) ---------- */

function updateTripDurationVisibility() {
  tripDurationField.hidden = tripTypeSelect.value === 'foreign';
}

tripTypeSelect.addEventListener('change', () => {
  updateTripDurationVisibility();
  recalculate();
});
tripDurationSelect.addEventListener('change', recalculate);
updateTripDurationVisibility();

/** ---------- Trip length (single day / multiple days) — independent of trip type ---------- */

function updateTripLengthVisibility() {
  const isMulti = tripLengthSelect.value === 'multi';
  tripEndDateField.hidden = !isMulti;
  tripEndDateInput.required = isMulti;
  tripDateLabel.textContent = isMulti ? 'Start date' : 'Trip date';
  tripEndDateInput.min = tripDateInput.value || '';
}

tripLengthSelect.addEventListener('change', updateTripLengthVisibility);
tripDateInput.addEventListener('change', updateTripLengthVisibility);
updateTripLengthVisibility();

/** ---------- Participant tracking mode (headcount-only vs. detailed) — optional, off by default ---------- */

function updateParticipantTrackingMode() {
  const detailed = trackDetailsToggle.checked;
  participantsDetailSection.hidden = !detailed;
  participantCountLabel.hidden = !detailed;
  participantCountInput.readOnly = detailed;
  participantCountInput.classList.toggle('field__control--readonly', detailed);

  if (detailed) {
    // Switching into detailed mode: the headcount now follows the rows.
    participantCountInput.value = String(participantRowsEl.children.length);
    if (participantRowsEl.children.length === 0) addParticipantRow();
  }
}

trackDetailsToggle.addEventListener('change', () => {
  updateParticipantTrackingMode();
  recalculate();
});
participantCountInput.addEventListener('input', recalculate);
updateParticipantTrackingMode();

/** ---------- Hosts ---------- */

function addHostRow() {
  const isFirstHost = hostRowsEl.children.length === 0;
  const row = createHostRow(hosts, {
    defaultRole: isFirstHost ? 'lead' : 'coHost',
    onChange: (row) => handleHostRowChange(row),
    onRoleChange: recalculate,
    onRemove: () => {
      updateHostCount();
      recalculate();
    },
  });
  hostRowsEl.appendChild(row);
  updateHostCount();
  recalculate();
}

document.getElementById('add-host-btn').addEventListener('click', addHostRow);

async function handleHostRowChange(row) {
  const select = row.querySelector('[name="hostName"]');

  if (select.value === ADD_HOST_OPTION_VALUE) {
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
        refreshAllHostRowOptions();
        select.value = result.name;
      } catch (err) {
        console.error(err);
        showToast('Failed to add host — check your connection', 'danger');
        refreshHostRowOptions(row, hosts, '');
      }
    } else {
      refreshHostRowOptions(row, hosts, '');
    }
  }

  recalculate();
}

function refreshAllHostRowOptions() {
  Array.from(hostRowsEl.children).forEach((row) => {
    const current = row.querySelector('[name="hostName"]').value;
    const preserved = current === ADD_HOST_OPTION_VALUE ? '' : current;
    refreshHostRowOptions(row, hosts, preserved);
  });
}

function updateHostCount() {
  const count = hostRowsEl.children.length;
  hostEmptyHint.hidden = count > 0;
  hostCountLabel.textContent = `${count} host${count === 1 ? '' : 's'}`;
}

function getHostTeam() {
  return Array.from(hostRowsEl.children)
    .map((row) => {
      const { name, role, weightOverride } = getHostRowData(row);
      const host = hosts.find((h) => h.name === name);
      return host ? { row, name: host.name, lifetimeTripCount: host.lifetimeTripCount, role, weightOverride } : null;
    })
    .filter(Boolean);
}

/** ---------- Participants ---------- */

function addParticipantRow() {
  const row = createParticipantRow({
    phoneDirectory,
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

document.getElementById('bulk-add-participants-btn').addEventListener('click', async () => {
  const result = await formModal({
    title: 'Paste participants from Excel/CSV',
    fields: [
      {
        name: 'bulkText',
        label: 'Paste rows below — Name, Phone, Paid, Due, Payment mode, Status (columns after Name are optional)',
        type: 'textarea',
        required: true,
        placeholder: 'Rahim Uddin\t01712345678\t3000\t0\tBkash\tPaid\nKarim Ahmed\t01898765432\t2500\t500\tBank\tPartial',
      },
    ],
    submitLabel: 'Add participants',
  });

  if (!result || !result.bulkText) return;

  const parsed = parseParticipantBulkText(result.bulkText);
  if (parsed.length === 0) {
    showToast('No valid rows found — make sure each row at least has a name or phone', 'warning');
    return;
  }

  parsed.forEach((data) => {
    const row = createParticipantRow({
      phoneDirectory,
      onChange: recalculate,
      onRemove: () => { updateEmptyHints(); recalculate(); },
    });
    setParticipantRowData(row, data);
    participantRowsEl.appendChild(row);
  });

  updateEmptyHints();
  recalculate();
  showToast(`Added ${parsed.length} participant${parsed.length === 1 ? '' : 's'}`, 'success');
});

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
  const detailedCount = participantRowsEl.children.length;
  const expenseCount = expenseRowsEl.children.length;

  participantEmptyHint.hidden = detailedCount > 0;
  expenseEmptyHint.hidden = expenseCount > 0;

  participantCountLabel.textContent = `${detailedCount} participant${detailedCount === 1 ? '' : 's'}`;
  expenseCountLabel.textContent = `${expenseCount} expense${expenseCount === 1 ? '' : 's'}`;

  // When detailed tracking is on, the headcount field auto-follows the
  // number of rows entered — it's the source of truth in that mode. When
  // tracking is off, the field is directly editable and this is skipped.
  if (trackDetailsToggle.checked) {
    participantCountInput.value = String(detailedCount);
  }
}

function recalculate() {
  saveDraftIfApplicable();

  const participantCount = Number(participantCountInput.value) || 0;
  const packagePrice = Number(packagePriceInput.value) || 0;
  const otherIncome = Number(otherIncomeInput.value) || 0;
  const expenses = Array.from(expenseRowsEl.children).map((row) => getExpenseRowData(row));
  const hostTeam = getHostTeam();
  const tripType = tripTypeSelect.value;

  hostTeam.forEach(({ row, lifetimeTripCount }) => {
    const category = determineHostCategory(lifetimeTripCount, calcSettings);
    setHostRowTierDisplay(row, CATEGORY_LABELS[category]);
  });

  updateHostCapsInfo(hostTeam, tripType, tripDurationSelect.value);

  if (hostTeam.length === 0) {
    summaryPanel.update({
      income: 0, totalExpenses: 0, grossProfit: 0, tshirtFund: 0, adjustedProfit: 0,
      hostCategory: '—', hostPayment: 0, hostBreakdown: [], tripType,
      remaining: 0, socialMediaFund: 0, organizationProfit: 0,
    }, formatBDT);
    lastFinancials = null;
    return;
  }

  const result = calculateTripFinancials({
    participantCount,
    packagePrice,
    otherIncome,
    expenses,
    tripType,
    tripDuration: tripType === 'domestic' ? tripDurationSelect.value : null,
    foreignHostBaseAmount: calcSettings?.foreignTripDefaults?.baseAmount || 0,
    foreignHostRatePerParticipant: calcSettings?.foreignTripDefaults?.ratePerParticipant || 0,
    hosts: hostTeam.map(({ name, lifetimeTripCount, role, weightOverride }) => ({ name, lifetimeTripCount, role, weightOverride })),
    settings: calcSettings,
  });

  lastFinancials = result;
  summaryPanel.update(result, formatBDT);
}

/**
 * Shows a heads-up (never blocking) if any non-Lead host outranks the
 * Lead's own tier — e.g. an Advanced Co-host under a Beginner Lead. The
 * Host Budget is still governed only by the Lead's tier either way; this
 * is purely informational so whoever is entering the trip knows what
 * they're setting up before they save.
 */
const DURATION_LABELS = { dayOnly: 'Day only', dayNight: 'Day, night journey', overnight: 'Overnight (2-day)' };

/**
 * Shows each host's own tier and their effective Minimum/Maximum for the
 * currently selected trip duration — purely informational, not a warning.
 * This replaced an older "outranking" warning that assumed the Host
 * Budget always came from the Lead's tier alone; since the multi-host
 * ceiling rule was added, that's no longer generally true, so a plain
 * "here's what applies to each person" panel is both more accurate and
 * more directly useful (shows the actual capped amount per your trip's
 * nature — Day only / Day-night / Overnight).
 */
function updateHostCapsInfo(hostTeam, tripType, tripDuration) {
  if (tripType === 'foreign' || hostTeam.length === 0 || !calcSettings) {
    hostCapsInfo.hidden = true;
    return;
  }

  hostCapsInfo.hidden = false;
  const durationLabel = DURATION_LABELS[tripDuration] || 'this trip';

  const rows = hostTeam.map(({ name, lifetimeTripCount }) => {
    const { category, minimum, maximum } = getEffectiveHostCaps(lifetimeTripCount, calcSettings, tripDuration);
    const min = minimum != null ? formatBDT(minimum) : 'no floor';
    const max = maximum != null ? formatBDT(maximum) : 'no cap';
    return `
      <div class="host-caps-info__row">
        <span>${escapeHtmlLocal(name)} <span class="badge badge-info">${CATEGORY_LABELS[category] || category}</span></span>
        <strong>${min} – ${max}</strong>
      </div>
    `;
  }).join('');

  hostCapsInfo.innerHTML = `
    <div class="host-caps-info__title">
      <i class="ti ti-info-circle" aria-hidden="true"></i>
      Each host's own pay range for a "${durationLabel}" trip
    </div>
    ${rows}
  `;
}

function escapeHtmlLocal(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

[packagePriceInput, otherIncomeInput].forEach((input) => {
  input.addEventListener('input', recalculate);
});

/** ---------- Save ---------- */

document.getElementById('new-trip-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.target;
  const hostTeam = getHostTeam();
  const teamErrors = validateHostTeam(hostTeam);
  const isMultiDay = tripLengthSelect.value === 'multi';

  if (isMultiDay && tripEndDateInput.value && tripEndDateInput.value < tripDateInput.value) {
    showToast('End date can\'t be before the start date', 'warning');
    return;
  }

  if (!form.checkValidity() || teamErrors.length > 0) {
    teamErrors.forEach((msg) => showToast(msg, 'warning'));
    form.reportValidity();
    return;
  }

  const participants = trackDetailsToggle.checked
    ? Array.from(participantRowsEl.children).map((row) => getParticipantRowData(row))
    : [];
  const expenses = Array.from(expenseRowsEl.children).map((row) => getExpenseRowData(row));

  const payload = {
    tripId: prefill && prefill.mode === 'edit' ? prefill.trip.id : undefined,
    tripName: document.getElementById('tripName').value.trim(),
    destination: document.getElementById('destination').value.trim(),
    tripDate: tripDateInput.value,
    tripEndDate: isMultiDay ? tripEndDateInput.value : null,
    tripType: tripTypeSelect.value,
    tripDuration: tripTypeSelect.value === 'domestic' ? tripDurationSelect.value : null,
    foreignHostBaseAmount: tripTypeSelect.value === 'foreign' ? (calcSettings?.foreignTripDefaults?.baseAmount || 0) : null,
    foreignHostRatePerParticipant: tripTypeSelect.value === 'foreign' ? (calcSettings?.foreignTripDefaults?.ratePerParticipant || 0) : null,
    hosts: hostTeam.map(({ name, lifetimeTripCount, role, weightOverride }) => ({ name, lifetimeTripCount, role, weightOverride })),
    packagePrice: Number(packagePriceInput.value) || 0,
    participantCount: Number(participantCountInput.value) || 0,
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
    clearDraft();
    showToast('Trip saved', 'success');
    window.location.href = 'trip-history.html';
  } catch (err) {
    console.error(err);
    showToast('Failed to save trip — check your connection and try again', 'danger');
    saveTripBtn.disabled = false;
    saveTripBtn.textContent = 'Save trip';
  }
});

/** ---------- Autosave draft (protects against a dropped connection or crashed tab) ---------- */

const DRAFT_STORAGE_KEY = 'vfs-new-trip-draft';

/** Only autosave when creating a brand-new trip — editing an existing one has its own save flow. */
function saveDraftIfApplicable() {
  if (prefill) return;
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(collectDraftState()));
  } catch {
    // Non-fatal — autosave is a nice-to-have, not a requirement.
  }
}

document.getElementById('save-draft-btn').addEventListener('click', () => {
  if (prefill) {
    showToast('Drafts are only for new trips — use "Save trip" to save your edits', 'warning');
    return;
  }
  saveDraftIfApplicable();
  showToast('Draft saved — you can safely close this page and come back to it', 'success');
});

function collectDraftState() {
  return {
    savedAt: new Date().toISOString(),
    tripName: document.getElementById('tripName').value,
    destination: document.getElementById('destination').value,
    tripDate: document.getElementById('tripDate').value,
    tripLength: tripLengthSelect.value,
    tripEndDate: tripEndDateInput.value,
    tripType: tripTypeSelect.value,
    tripDuration: tripDurationSelect.value,
    packagePrice: packagePriceInput.value,
    participantCount: participantCountInput.value,
    trackDetails: trackDetailsToggle.checked,
    otherIncome: otherIncomeInput.value,
    notes: document.getElementById('notes').value,
    hosts: Array.from(hostRowsEl.children).map((row) => getHostRowData(row)),
    participants: Array.from(participantRowsEl.children).map((row) => getParticipantRowData(row)),
    expenses: Array.from(expenseRowsEl.children).map((row) => getExpenseRowData(row)),
  };
}

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

/** Rebuilds the whole form (hosts, participants, expenses, trip info) from a saved draft. */
function applyDraftState(draft) {
  document.getElementById('tripName').value = draft.tripName || '';
  document.getElementById('destination').value = draft.destination || '';
  document.getElementById('tripDate').value = draft.tripDate || '';
  tripLengthSelect.value = draft.tripLength || 'single';
  tripEndDateInput.value = draft.tripEndDate || '';
  updateTripLengthVisibility();
  tripTypeSelect.value = draft.tripType || 'domestic';
  tripDurationSelect.value = draft.tripDuration || 'dayOnly';
  updateTripDurationVisibility();
  packagePriceInput.value = draft.packagePrice || '';
  otherIncomeInput.value = draft.otherIncome || '';
  document.getElementById('notes').value = draft.notes || '';

  trackDetailsToggle.checked = !!draft.trackDetails;
  updateParticipantTrackingMode();
  if (!draft.trackDetails) {
    participantCountInput.value = draft.participantCount || '';
  }

  (draft.hosts || []).forEach((h) => {
    if (!h.name) return;
    const row = createHostRow(hosts, {
      defaultRole: h.role || 'coHost',
      onChange: (row) => handleHostRowChange(row),
      onRoleChange: recalculate,
      onRemove: () => { updateHostCount(); recalculate(); },
    });
    hostRowsEl.appendChild(row);
    refreshHostRowOptions(row, hosts, h.name);
    setHostRowRole(row, h.role || 'coHost');
    setHostRowWeightOverride(row, h.weightOverride);
  });

  if (draft.trackDetails) {
    (draft.participants || []).forEach((p) => {
      const row = createParticipantRow({
        phoneDirectory,
        onChange: recalculate,
        onRemove: () => { updateEmptyHints(); recalculate(); },
      });
      setParticipantRowData(row, p);
      participantRowsEl.appendChild(row);
    });
  }

  (draft.expenses || []).forEach((e) => {
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

  if (hostRowsEl.children.length === 0) addHostRow();
  if (trackDetailsToggle.checked && participantRowsEl.children.length === 0) addParticipantRow();
  if (expenseRowsEl.children.length === 0) addExpenseRow();
}

/** ---------- Prefill (Edit / Duplicate from Trip History) ---------- */

function populateFromPrefill(trip) {
  document.getElementById('tripName').value = trip.tripName || '';
  document.getElementById('destination').value = trip.destination || '';
  document.getElementById('tripDate').value = trip.tripDate || '';
  tripLengthSelect.value = trip.tripEndDate ? 'multi' : 'single';
  tripEndDateInput.value = trip.tripEndDate || '';
  updateTripLengthVisibility();
  packagePriceInput.value = trip.packagePrice ?? '';
  otherIncomeInput.value = trip.otherIncome ?? '';
  document.getElementById('notes').value = trip.notes || '';

  const hadDetailedParticipants = trip.participants && trip.participants.length > 0;
  trackDetailsToggle.checked = hadDetailedParticipants;
  updateParticipantTrackingMode();
  if (!hadDetailedParticipants) {
    participantCountInput.value = trip.participantCount ?? '';
  }

  tripTypeSelect.value = trip.tripType || 'domestic';
  tripDurationSelect.value = trip.tripDuration || 'dayOnly';
  updateTripDurationVisibility();

  const tripHosts = trip.hosts && trip.hosts.length > 0
    ? trip.hosts
    : (trip.hostName ? [{ name: trip.hostName, lifetimeTripCount: trip.hostLifetimeTripCount || 0, role: 'lead' }] : []);

  tripHosts.forEach((h) => {
    const hostExists = hosts.some((existing) => existing.name === h.name);
    if (!hostExists) {
      hosts.push({ id: `host-prefill-${Date.now()}-${h.name}`, name: h.name, lifetimeTripCount: h.lifetimeTripCount || 0 });
    }
  });

  tripHosts.forEach((h) => {
    const row = createHostRow(hosts, {
      defaultRole: h.role || 'coHost',
      onChange: (row) => handleHostRowChange(row),
      onRoleChange: recalculate,
      onRemove: () => { updateHostCount(); recalculate(); },
    });
    hostRowsEl.appendChild(row);
    refreshHostRowOptions(row, hosts, h.name);
    setHostRowRole(row, h.role || 'coHost');
    setHostRowWeightOverride(row, h.weightOverride);
  });

  (trip.participants || []).forEach((p) => {
    const row = createParticipantRow({ phoneDirectory, onChange: recalculate, onRemove: () => { updateEmptyHints(); recalculate(); } });
    row.querySelector('[name="name"]').value = p.name || '';
    row.querySelector('[name="phone"]').value = p.phone || '';
    row.querySelector('[name="paidAmount"]').value = p.paidAmount ?? '';
    row.querySelector('[name="dueAmount"]').value = p.dueAmount ?? '';
    row.querySelector('[name="paymentMode"]').value = p.paymentMode || 'Cash';
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
  showLoadingState(hostRowsEl, 'Loading hosts, categories, and settings...');

  try {
    [hosts, expenseCategories, calcSettings] = await Promise.all([
      getHosts(),
      getAllCategories(),
      getCalculationSettings(),
    ]);
  } catch (err) {
    console.error(err);
    showToast('Failed to load hosts/categories/settings — check your connection', 'danger');
    showErrorState(hostRowsEl, "Couldn't load this form — check your connection and try again.", init);
    return;
  }

  hostRowsEl.innerHTML = '';

  // Best-effort: powers phone-number autocomplete for participants. Not
  // critical to the rest of the page, so a failure here is silent rather
  // than blocking trip creation.
  try {
    const trips = await fetchTrips();
    phoneDirectory = buildParticipantDirectory(trips).map((entry) => ({
      phone: entry.phone,
      name: entry.displayName,
    }));
  } catch (err) {
    console.warn('Failed to load participant directory for phone autocomplete:', err.message);
  }

  if (prefill && prefill.trip) {
    populateFromPrefill(prefill.trip);
  } else {
    const draft = readDraft();
    const restore = draft && await confirmDialog({
      title: 'Restore unsaved trip?',
      message: `You have an unsaved trip from ${new Date(draft.savedAt).toLocaleString()} — pick up where you left off?`,
      confirmLabel: 'Restore draft',
      cancelLabel: 'Start fresh',
      danger: false,
    });

    if (restore) {
      applyDraftState(draft);
    } else {
      clearDraft();
      addHostRow();
      addExpenseRow();
    }
  }

  updateHostCount();
  updateEmptyHints();
  recalculate();
}

init();
