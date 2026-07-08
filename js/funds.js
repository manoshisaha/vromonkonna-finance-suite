/**
 * js/funds.js
 *
 * Page controller for pages/funds.html.
 *
 * Three tabs (one per fund), each showing a running-balance ledger from
 * the real Apps Script API (js/modules/fund-ledger.js). Contribution rows
 * are written server-side automatically when a trip is saved; manual
 * withdrawals/adjustments are added/removed here via the API too.
 */

import { initShell, showToast } from './app.js';
import { FUND_KEYS, FUND_LABELS, buildLedger, addManualEntry, deleteManualEntry } from './modules/fund-ledger.js';
import { formatBDT } from './utils/format.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { formModal } from '../components/form-modal.js';

initShell({
  activeNavId: 'funds',
  title: 'Funds',
  basePath: '../',
});

const tabsEl = document.getElementById('fund-tabs');
const balanceLabel = document.getElementById('fund-balance-label');
const balanceValue = document.getElementById('fund-balance-value');
const ledgerBody = document.getElementById('ledger-body');
const ledgerEmpty = document.getElementById('ledger-empty');
const addWithdrawalBtn = document.getElementById('add-withdrawal-btn');

let activeFund = FUND_KEYS[0];

function renderTabs() {
  tabsEl.innerHTML = FUND_KEYS.map((key) => `
    <button type="button" class="fund-tab" role="tab" data-fund="${key}" aria-selected="${key === activeFund}">
      ${FUND_LABELS[key]}
    </button>
  `).join('');
}

function typeBadgeClass(type) {
  if (type === 'contribution') return 'ledger-type-badge--contribution';
  if (type === 'withdrawal') return 'ledger-type-badge--withdrawal';
  return 'ledger-type-badge--adjustment';
}

function typeBadgeLabel(type) {
  if (type === 'contribution') return 'Contribution';
  if (type === 'withdrawal') return 'Withdrawal';
  return 'Adjustment';
}

async function renderLedger() {
  try {
    const { entries, currentBalance } = await buildLedger(activeFund);

    balanceLabel.textContent = `${FUND_LABELS[activeFund]} — current balance`;
    balanceValue.textContent = formatBDT(currentBalance);
    balanceValue.classList.toggle('ledger-amount--negative', currentBalance < 0);

    ledgerBody.innerHTML = entries.map((entry) => `
      <tr data-entry-id="${entry.id}">
        <td>${formatDate(entry.date)}</td>
        <td>${escapeHtml(entry.description)}</td>
        <td><span class="ledger-type-badge ${typeBadgeClass(entry.type)}">${typeBadgeLabel(entry.type)}</span></td>
        <td class="${entry.amount < 0 ? 'ledger-amount--negative' : 'ledger-amount--positive'}">
          ${entry.amount < 0 ? '' : '+'}${formatBDT(entry.amount)}
        </td>
        <td>${formatBDT(entry.balance)}</td>
        <td>
          ${entry.type !== 'contribution' ? `
            <button type="button" class="icon-button icon-button--danger" data-action="delete-entry" aria-label="Delete entry">
              <i class="ti ti-trash" aria-hidden="true"></i>
            </button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    ledgerEmpty.hidden = entries.length > 0;
  } catch (err) {
    console.error(err);
    showToast('Failed to load fund ledger — check your connection', 'danger');
  }
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

tabsEl.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-fund]');
  if (!btn) return;
  activeFund = btn.dataset.fund;
  renderTabs();
  renderLedger();
});

ledgerBody.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-action="delete-entry"]');
  if (!btn) return;
  const row = btn.closest('tr');
  const entryId = row.dataset.entryId;

  const ok = await confirmDialog({
    title: 'Delete this entry?',
    message: 'This manual entry will be permanently removed from the ledger.',
    confirmLabel: 'Delete entry',
  });
  if (ok) {
    try {
      await deleteManualEntry(entryId);
      await renderLedger();
      showToast('Entry deleted', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete entry — check your connection', 'danger');
    }
  }
});

addWithdrawalBtn.addEventListener('click', async () => {
  const result = await formModal({
    title: `Add withdrawal / adjustment — ${FUND_LABELS[activeFund]}`,
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'description', label: 'Description', type: 'text', required: true, placeholder: 'e.g. Printed 40 T-shirts' },
      { name: 'amount', label: 'Amount (BDT)', type: 'number', required: true, min: 0 },
    ],
    submitLabel: 'Add entry',
  });

  if (result) {
    try {
      await addManualEntry(activeFund, {
        date: result.date,
        description: result.description,
        amount: result.amount,
        type: 'withdrawal',
      });
      await renderLedger();
      showToast('Withdrawal recorded', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to record withdrawal — check your connection', 'danger');
    }
  }
});

async function init() {
  renderTabs();
  await renderLedger();
}

init();
