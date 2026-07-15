/**
 * components/participant-row.js
 *
 * A single dynamic "participant" row used in the New Trip form (and later
 * reused by Trip History's edit view). Each row is a self-contained DOM
 * fragment with its own remove button; the parent page reads current
 * values via `getParticipantRowData()`.
 */

const PAYMENT_STATUSES = ['Paid', 'Partial', 'Due'];
const PAYMENT_MODES = ['Bkash', 'Bank', 'Cash', 'Other'];

let rowIdCounter = 0;

/**
 * Creates a participant row element.
 * @param {{ onChange?: () => void, onRemove?: () => void }} [handlers]
 * @returns {HTMLElement}
 */
export function createParticipantRow(handlers = {}) {
  const { onChange, onRemove } = handlers;
  const rowId = `participant-${++rowIdCounter}`;

  const row = document.createElement('div');
  row.className = 'dynamic-row';
  row.dataset.rowId = rowId;
  row.innerHTML = `
    <div class="dynamic-row__grid">
      <div class="field field--compact">
        <label class="field__label">Name</label>
        <input class="field__control" type="text" name="name" placeholder="Full name" />
      </div>
      <div class="field field--compact">
        <label class="field__label">Phone</label>
        <input class="field__control" type="tel" name="phone" placeholder="01XXXXXXXXX" />
      </div>
      <div class="field field--compact">
        <label class="field__label">Paid amount</label>
        <input class="field__control" type="number" name="paidAmount" min="0" step="1" placeholder="0" />
      </div>
      <div class="field field--compact">
        <label class="field__label">Due amount</label>
        <input class="field__control" type="number" name="dueAmount" min="0" step="1" placeholder="0" />
      </div>
      <div class="field field--compact">
        <label class="field__label">Payment mode</label>
        <select class="field__control" name="paymentMode">
          ${PAYMENT_MODES.map((m) => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </div>
      <div class="field field--compact">
        <label class="field__label">Payment status</label>
        <select class="field__control" name="paymentStatus">
          ${PAYMENT_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <button type="button" class="icon-button dynamic-row__remove" aria-label="Remove participant">
      <i class="ti ti-trash" aria-hidden="true"></i>
    </button>
  `;

  row.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('input', () => onChange && onChange());
    el.addEventListener('change', () => onChange && onChange());
  });

  row.querySelector('.dynamic-row__remove').addEventListener('click', () => {
    row.remove();
    onRemove && onRemove();
  });

  return row;
}

/**
 * Reads current field values out of a participant row element.
 * @param {HTMLElement} rowEl
 * @returns {{ name: string, phone: string, paidAmount: number, dueAmount: number, paymentMode: string, paymentStatus: string }}
 */
export function getParticipantRowData(rowEl) {
  return {
    name: rowEl.querySelector('[name="name"]').value.trim(),
    phone: rowEl.querySelector('[name="phone"]').value.trim(),
    paidAmount: Number(rowEl.querySelector('[name="paidAmount"]').value) || 0,
    dueAmount: Number(rowEl.querySelector('[name="dueAmount"]').value) || 0,
    paymentMode: rowEl.querySelector('[name="paymentMode"]').value,
    paymentStatus: rowEl.querySelector('[name="paymentStatus"]').value,
  };
}
