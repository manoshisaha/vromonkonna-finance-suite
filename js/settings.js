/**
 * js/settings.js
 *
 * Page controller for pages/settings.html.
 *
 * Reads/writes through settings-store.js, host-directory.js, and
 * expense-category-store.js, all of which now call the real Apps Script
 * API — so changes made here take effect everywhere else in the app.
 */

import { initShell, showToast } from './app.js';
import { getSettings, saveSettings, getCalculationSettings, DEFAULT_APP_SETTINGS } from './modules/settings-store.js';
import { getHosts, addHost, deleteHost } from './modules/host-directory.js';
import { getAllCategories, addCustomCategory, removeCustomCategory } from './modules/expense-category-store.js';
import { DEFAULT_EXPENSE_CATEGORIES } from '../components/expense-row.js';
import { determineHostCategory } from './modules/calculations.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { formModal } from '../components/form-modal.js';

initShell({
  activeNavId: 'settings',
  title: 'Settings',
  basePath: '../',
});

const form = document.getElementById('settings-form');
const logoPreview = document.getElementById('logo-preview');
const logoFileInput = document.getElementById('logo-file-input');
const durationTabsEl = document.getElementById('duration-tabs');

let logoDataUrl = '';

const DURATION_LABELS = { dayOnly: 'Day only', dayNight: 'Day, night journey', overnight: 'Overnight (2-day)' };

/** Full local state for all three durations x three tiers x {minimum, maximum} — only one duration's inputs are visible at a time. */
let durationCapsState = {
  dayOnly: { beginner: {}, intermediate: {}, advanced: {} },
  dayNight: { beginner: {}, intermediate: {}, advanced: {} },
  overnight: { beginner: {}, intermediate: {}, advanced: {} },
};
let activeDuration = 'dayOnly';

function renderDurationTabs() {
  durationTabsEl.querySelectorAll('.fund-tab').forEach((btn) => {
    btn.setAttribute('aria-selected', String(btn.dataset.duration === activeDuration));
  });
}

/** Fills the visible Minimum/Maximum inputs from state for whichever duration is currently active. */
function renderDurationCapInputs() {
  const caps = durationCapsState[activeDuration];
  document.getElementById('durationCapBeginnerMin').value = caps.beginner.minimum ?? '';
  document.getElementById('durationCapBeginnerMax').value = caps.beginner.maximum ?? '';
  document.getElementById('durationCapIntermediateMin').value = caps.intermediate.minimum ?? '';
  document.getElementById('durationCapIntermediateMax').value = caps.intermediate.maximum ?? '';
  document.getElementById('durationCapAdvancedMin').value = caps.advanced.minimum ?? '';
  document.getElementById('durationCapAdvancedMax').value = caps.advanced.maximum ?? '';
}

/** Reads the currently-visible inputs back into state before switching tabs or saving, so nothing typed is lost. */
function captureDurationCapInputs() {
  const parse = (id) => (document.getElementById(id).value === '' ? undefined : Number(document.getElementById(id).value));
  durationCapsState[activeDuration] = {
    beginner: { minimum: parse('durationCapBeginnerMin'), maximum: parse('durationCapBeginnerMax') },
    intermediate: { minimum: parse('durationCapIntermediateMin'), maximum: parse('durationCapIntermediateMax') },
    advanced: { minimum: parse('durationCapAdvancedMin'), maximum: parse('durationCapAdvancedMax') },
  };
}

durationTabsEl.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-duration]');
  if (!btn) return;
  captureDurationCapInputs();
  activeDuration = btn.dataset.duration;
  renderDurationTabs();
  renderDurationCapInputs();
});

/** ---------- Load ---------- */

async function loadForm() {
  let s;
  try {
    s = await getSettings();
  } catch (err) {
    console.error(err);
    showToast('Failed to load settings — check your connection', 'danger');
    return;
  }

  document.getElementById('orgName').value = s.orgName;
  document.getElementById('currency').value = s.currency;
  document.getElementById('contactPhone').value = s.contactPhone;
  document.getElementById('contactEmail').value = s.contactEmail;
  document.getElementById('address').value = s.address;
  document.getElementById('fiscalYearStartMonth').value = String(s.fiscalYearStartMonth);

  logoDataUrl = s.logoDataUrl;
  renderLogoPreview();

  document.getElementById('tshirtPrice').value = s.tshirtPrice;
  document.getElementById('socialMediaFundPercent').value = s.socialMediaFundPercent;

  document.getElementById('defaultForeignBase').value = s.foreignTripDefaults.baseAmount;
  document.getElementById('defaultForeignRate').value = s.foreignTripDefaults.ratePerParticipant;

  document.getElementById('beginnerMaxTrips').value = s.hostTiers.beginner.maxTrips;
  document.getElementById('beginnerAmount').value = s.hostTiers.beginner.amount;
  document.getElementById('beginnerMinimum').value = s.hostTiers.beginner.minimum ?? '';
  document.getElementById('beginnerMaximum').value = s.hostTiers.beginner.maximum ?? '';
  document.getElementById('intermediateMaxTrips').value = s.hostTiers.intermediate.maxTrips;
  document.getElementById('intermediatePercent').value = s.hostTiers.intermediate.percent;
  document.getElementById('intermediateMinimum').value = s.hostTiers.intermediate.minimum;
  document.getElementById('intermediateMaximum').value = s.hostTiers.intermediate.maximum ?? '';
  document.getElementById('advancedPercent').value = s.hostTiers.advanced.percent;
  document.getElementById('advancedMinimum').value = s.hostTiers.advanced.minimum;
  document.getElementById('advancedMaximum').value = s.hostTiers.advanced.maximum ?? '';

  document.getElementById('leadWeight').value = s.roleWeights.lead;
  document.getElementById('coHostWeight').value = s.roleWeights.coHost;
  document.getElementById('supportWeight').value = s.roleWeights.support;

  durationCapsState = {
    dayOnly: {
      beginner: { ...(s.hostTiers.beginner.durationCaps?.dayOnly || {}) },
      intermediate: { ...(s.hostTiers.intermediate.durationCaps?.dayOnly || {}) },
      advanced: { ...(s.hostTiers.advanced.durationCaps?.dayOnly || {}) },
    },
    dayNight: {
      beginner: { ...(s.hostTiers.beginner.durationCaps?.dayNight || {}) },
      intermediate: { ...(s.hostTiers.intermediate.durationCaps?.dayNight || {}) },
      advanced: { ...(s.hostTiers.advanced.durationCaps?.dayNight || {}) },
    },
    overnight: {
      beginner: { ...(s.hostTiers.beginner.durationCaps?.overnight || {}) },
      intermediate: { ...(s.hostTiers.intermediate.durationCaps?.overnight || {}) },
      advanced: { ...(s.hostTiers.advanced.durationCaps?.overnight || {}) },
    },
  };
  activeDuration = 'dayOnly';
  renderDurationTabs();
  renderDurationCapInputs();

  updateTierRangeLabels();
  await renderHostsTable();
  await renderCategoryChips();
}

function updateTierRangeLabels() {
  const beginnerMax = Number(document.getElementById('beginnerMaxTrips').value) || 0;
  const intermediateMax = Number(document.getElementById('intermediateMaxTrips').value) || 0;
  document.getElementById('intermediateMinTripsLabel').textContent = String(beginnerMax + 1);
  document.getElementById('advancedMinTripsLabel').textContent = String(intermediateMax + 1);
}

['beginnerMaxTrips', 'intermediateMaxTrips'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateTierRangeLabels);
});

function renderLogoPreview() {
  logoPreview.innerHTML = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Organization logo" />`
    : 'Logo';
}

document.getElementById('logo-upload-btn').addEventListener('click', () => logoFileInput.click());

logoFileInput.addEventListener('change', () => {
  const file = logoFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    logoDataUrl = reader.result;
    renderLogoPreview();
  };
  reader.readAsDataURL(file);
});

/** ---------- Hosts directory ---------- */

async function renderHostsTable() {
  const tbody = document.getElementById('hosts-table-body');
  try {
    const [hosts, calcSettings] = await Promise.all([getHosts(), getCalculationSettings()]);

    tbody.innerHTML = hosts.map((h) => {
      const category = determineHostCategory(h.lifetimeTripCount, calcSettings);
      return `
        <tr data-host-id="${h.id}">
          <td>${escapeHtml(h.name)}</td>
          <td>${h.lifetimeTripCount}</td>
          <td><span class="badge ${tierBadgeClass(category)}">${tierLabel(category)}</span></td>
          <td>
            <button type="button" class="icon-button icon-button--danger" data-action="delete-host" aria-label="Delete host">
              <i class="ti ti-trash" aria-hidden="true"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    showToast('Failed to load hosts — check your connection', 'danger');
  }
}

function tierBadgeClass(category) {
  if (category === 'advanced') return 'badge-success';
  if (category === 'intermediate') return 'badge-info';
  return 'badge-warning';
}

function tierLabel(category) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

document.getElementById('add-host-btn').addEventListener('click', async () => {
  const result = await formModal({
    title: 'Add host',
    fields: [
      { name: 'name', label: 'Host name', type: 'text', required: true },
      { name: 'lifetimeTripCount', label: 'Lifetime trip count so far', type: 'number', required: true, min: 0 },
    ],
    submitLabel: 'Add host',
  });
  if (result) {
    try {
      await addHost({ name: result.name, lifetimeTripCount: result.lifetimeTripCount });
      await renderHostsTable();
      showToast('Host added', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to add host — check your connection', 'danger');
    }
  }
});

document.getElementById('hosts-table-body').addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-action="delete-host"]');
  if (!btn) return;
  const row = btn.closest('tr');
  const hostId = row.dataset.hostId;

  const ok = await confirmDialog({
    title: 'Remove this host?',
    message: 'They will no longer appear in the New Trip host list.',
    confirmLabel: 'Remove host',
  });
  if (ok) {
    try {
      await deleteHost(hostId);
      await renderHostsTable();
      showToast('Host removed', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to remove host — check your connection', 'danger');
    }
  }
});

/** ---------- Expense categories ---------- */

async function renderCategoryChips() {
  const container = document.getElementById('expense-category-chips');
  try {
    const all = await getAllCategories();
    const custom = all.filter((c) => !DEFAULT_EXPENSE_CATEGORIES.includes(c));

    const builtinChips = DEFAULT_EXPENSE_CATEGORIES.map((c) => `
      <span class="chip chip--builtin">${escapeHtml(c)}</span>
    `).join('');

    const customChips = custom.map((c) => `
      <span class="chip" data-category="${escapeAttr(c)}">
        ${escapeHtml(c)}
        <button type="button" class="chip__remove" data-action="remove-category" aria-label="Remove category">
          <i class="ti ti-x" aria-hidden="true" style="font-size: 12px;"></i>
        </button>
      </span>
    `).join('');

    container.innerHTML = builtinChips + customChips;
  } catch (err) {
    console.error(err);
    showToast('Failed to load expense categories — check your connection', 'danger');
  }
}

document.getElementById('add-category-btn').addEventListener('click', async () => {
  const input = document.getElementById('new-category-input');
  const value = input.value.trim();
  if (!value) return;
  try {
    await addCustomCategory(value);
    input.value = '';
    await renderCategoryChips();
    showToast('Category added', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to add category — check your connection', 'danger');
  }
});

document.getElementById('expense-category-chips').addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-action="remove-category"]');
  if (!btn) return;
  const category = btn.closest('[data-category]').dataset.category;
  try {
    await removeCustomCategory(category);
    await renderCategoryChips();
  } catch (err) {
    console.error(err);
    showToast('Failed to remove category — check your connection', 'danger');
  }
});

/** ---------- Data management ---------- */

document.getElementById('export-local-data-btn').addEventListener('click', async () => {
  try {
    const [settings, hosts, categories] = await Promise.all([getSettings(), getHosts(), getAllCategories()]);
    const data = {
      settings,
      hosts,
      expenseCategories: categories,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vromonkonna-data-backup.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Data exported', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to export data — check your connection', 'danger');
  }
});

document.getElementById('reset-demo-data-btn').addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Clear locally cached data?',
    message: 'Settings, Hosts, and Funds now live in your Google Sheet — this only clears the local offline-fallback cache stored in this browser, in case it ever gets stale. It does not delete anything from your Sheet.',
    confirmLabel: 'Clear local cache',
    danger: false,
  });
  if (ok) {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('vfs-'))
      .forEach((key) => localStorage.removeItem(key));
    showToast('Local cache cleared', 'success');
    loadForm();
  }
});

/** ---------- Save / Reset ---------- */

/** Reshapes durationCapsState (keyed by duration) into the per-tier shape calculations.js expects. */
function durationCapsByTier(tierKey) {
  const result = {};
  Object.keys(durationCapsState).forEach((duration) => {
    const caps = durationCapsState[duration][tierKey] || {};
    if (caps.minimum != null || caps.maximum != null) {
      result[duration] = { minimum: caps.minimum ?? null, maximum: caps.maximum ?? null };
    }
  });
  return result;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  captureDurationCapInputs();

  const settings = {
    orgName: document.getElementById('orgName').value.trim() || DEFAULT_APP_SETTINGS.orgName,
    logoDataUrl,
    currency: document.getElementById('currency').value,
    contactPhone: document.getElementById('contactPhone').value.trim(),
    contactEmail: document.getElementById('contactEmail').value.trim(),
    address: document.getElementById('address').value.trim(),
    fiscalYearStartMonth: Number(document.getElementById('fiscalYearStartMonth').value),
    tshirtPrice: Number(document.getElementById('tshirtPrice').value) || 0,
    socialMediaFundPercent: Number(document.getElementById('socialMediaFundPercent').value) || 0,
    foreignTripDefaults: {
      baseAmount: Number(document.getElementById('defaultForeignBase').value) || 0,
      ratePerParticipant: Number(document.getElementById('defaultForeignRate').value) || 0,
    },
    hostTiers: {
      beginner: {
        maxTrips: Number(document.getElementById('beginnerMaxTrips').value) || 0,
        amount: Number(document.getElementById('beginnerAmount').value) || 0,
        minimum: document.getElementById('beginnerMinimum').value === '' ? null : Number(document.getElementById('beginnerMinimum').value),
        maximum: document.getElementById('beginnerMaximum').value === '' ? null : Number(document.getElementById('beginnerMaximum').value),
        durationCaps: durationCapsByTier('beginner'),
      },
      intermediate: {
        maxTrips: Number(document.getElementById('intermediateMaxTrips').value) || 0,
        percent: Number(document.getElementById('intermediatePercent').value) || 0,
        minimum: Number(document.getElementById('intermediateMinimum').value) || 0,
        maximum: document.getElementById('intermediateMaximum').value === '' ? null : Number(document.getElementById('intermediateMaximum').value),
        durationCaps: durationCapsByTier('intermediate'),
      },
      advanced: {
        percent: Number(document.getElementById('advancedPercent').value) || 0,
        minimum: Number(document.getElementById('advancedMinimum').value) || 0,
        maximum: document.getElementById('advancedMaximum').value === '' ? null : Number(document.getElementById('advancedMaximum').value),
        durationCaps: durationCapsByTier('advanced'),
      },
    },
    roleWeights: {
      lead: Number(document.getElementById('leadWeight').value) || 0,
      coHost: Number(document.getElementById('coHostWeight').value) || 0,
      support: Number(document.getElementById('supportWeight').value) || 0,
    },
  };

  try {
    await saveSettings(settings);
    await renderHostsTable();
    showToast('Settings saved', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to save settings — check your connection', 'danger');
  }
});

document.getElementById('reset-defaults-btn').addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Reset settings to defaults?',
    message: 'Organization info, pricing, and host tiers will revert to their original defaults. Hosts and expense categories are not affected.',
    confirmLabel: 'Reset settings',
    danger: false,
  });
  if (ok) {
    try {
      await saveSettings(DEFAULT_APP_SETTINGS);
      await loadForm();
      showToast('Settings reset to defaults', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to reset settings — check your connection', 'danger');
    }
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

/** ---------- Init ---------- */

loadForm();
