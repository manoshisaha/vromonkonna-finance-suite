/**
 * js/initiatives.js
 *
 * Page controller for pages/initiatives.html — a simple credit/debit
 * tracker for activities outside the trip system (e.g. Shikkhon
 * training/dorm, or any other side initiative). Deliberately modeled on
 * Funds' ledger pattern for consistency, but flat (one list, filterable
 * by initiative name) rather than per-fund tabs, since the number of
 * initiatives is open-ended and user-defined.
 */

import { initShell, showToast } from './app.js';
import { fetchInitiativeEntries, addInitiativeEntry, deleteInitiativeEntry } from './modules/initiatives-store.js';
import { renderStatCards } from '../components/stat-card.js';
import { showLoadingState, showErrorState } from '../components/data-state.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { formModal } from '../components/form-modal.js';
import { formatBDT } from './utils/format.js';

initShell({ activeNavId: 'initiatives', title: 'Initiatives' });

const statGrid = document.getElementById('stat-grid');
const filterSelect = document.getElementById('initiative-filter');
const entriesBody = document.getElementById('entries-body');
const entriesEmpty = document.getElementById('entries-empty');
const addEntryBtn = document.getElementById('add-entry-btn');

let entries = [];
let activeFilter = 'all';

/** ---------- Rendering ---------- */

function populateFilterOptions() {
  const names = [...new Set(entries.map((e) => e.initiativeName))].sort();
  filterSelect.innerHTML = `
    <option value="all">All initiatives</option>
    ${names.map((name) => `<option value="${escapeHtml(name)}" ${name === activeFilter ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
  `;
}

function render() {
  const filtered = activeFilter === 'all' ? entries : entries.filter((e) => e.initiativeName === activeFilter);

  const totalCredit = filtered.filter((e) => e.entryType === 'Credit').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalDebit = filtered.filter((e) => e.entryType === 'Debit').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const net = totalCredit - totalDebit;

  renderStatCards(statGrid, [
    { label: 'Total credit', value: formatBDT(totalCredit), iconKey: 'revenue', tint: 'success' },
    { label: 'Total debit', value: formatBDT(totalDebit), iconKey: 'expense', tint: 'danger' },
    { label: 'Net balance', value: formatBDT(net), iconKey: 'wallet', tint: net >= 0 ? 'accent' : 'danger' },
  ]);

  entriesBody.innerHTML = filtered.map((e) => `
    <tr data-entry-id="${e.id}">
      <td>${formatDate(e.date)}</td>
      <td>${escapeHtml(e.initiativeName)}</td>
      <td>${escapeHtml(e.description)}</td>
      <td><span class="ledger-type-badge ${e.entryType === 'Credit' ? 'ledger-type-badge--contribution' : 'ledger-type-badge--withdrawal'}">${e.entryType}</span></td>
      <td class="${e.entryType === 'Credit' ? 'ledger-amount--positive' : 'ledger-amount--negative'}">
        ${e.entryType === 'Credit' ? '+' : '−'}${formatBDT(e.amount)}
      </td>
      <td>
        <button type="button" class="icon-button icon-button--danger" data-action="delete-entry" aria-label="Delete entry">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </td>
    </tr>
  `).join('');

  entriesEmpty.hidden = filtered.length > 0;
}

/** ---------- Filter ---------- */

filterSelect.addEventListener('change', () => {
  activeFilter = filterSelect.value;
  render();
});

/** ---------- Add entry ---------- */

addEntryBtn.addEventListener('click', async () => {
  const existingNames = [...new Set(entries.map((e) => e.initiativeName))].sort();

  const result = await formModal({
    title: 'Add initiative entry',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      {
        name: 'initiativeName',
        label: existingNames.length > 0 ? `Initiative name (e.g. ${existingNames[0]})` : 'Initiative name (e.g. Shikkhon)',
        type: 'text',
        required: true,
        placeholder: 'Shikkhon',
      },
      {
        name: 'entryType',
        label: 'Type',
        type: 'select',
        required: true,
        options: [{ value: 'Credit', label: 'Credit (money in)' }, { value: 'Debit', label: 'Debit (money out)' }],
      },
      { name: 'amount', label: 'Amount', type: 'number', required: true, min: 0 },
      { name: 'description', label: 'Description', type: 'text', required: true, placeholder: 'e.g. Monthly dorm rent' },
    ],
    submitLabel: 'Add entry',
  });

  if (!result) return;

  try {
    await addInitiativeEntry({
      date: result.date,
      initiativeName: result.initiativeName.trim(),
      entryType: result.entryType,
      amount: Number(result.amount) || 0,
      description: result.description.trim(),
    });
    showToast('Entry added', 'success');
    await reload();
  } catch (err) {
    console.error(err);
    showToast('Failed to add entry — check your connection', 'danger');
  }
});

/** ---------- Delete entry ---------- */

entriesBody.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-action="delete-entry"]');
  if (!btn) return;

  const entryId = btn.closest('[data-entry-id]').dataset.entryId;

  const ok = await confirmDialog({
    title: 'Delete this entry?',
    message: 'This will permanently remove this credit/debit entry. This cannot be undone.',
    confirmLabel: 'Delete entry',
  });

  if (!ok) return;

  try {
    await deleteInitiativeEntry(entryId);
    entries = entries.filter((e) => e.id !== entryId);
    populateFilterOptions();
    render();
    showToast('Entry deleted', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to delete entry — check your connection', 'danger');
  }
});

/** ---------- Helpers ---------- */

function formatDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/** ---------- Init ---------- */

async function reload() {
  try {
    entries = await fetchInitiativeEntries();
    populateFilterOptions();
    render();
  } catch (err) {
    console.error(err);
    showToast('Failed to load initiatives', 'danger');
    showErrorState(statGrid, "Couldn't load initiatives — check your connection and try again.", reload);
  }
}

async function init() {
  showLoadingState(statGrid, 'Loading initiatives...');
  await reload();
}

init();
