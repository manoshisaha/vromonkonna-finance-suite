/**
 * components/participant-row.js
 *
 * A single dynamic "participant" row used in the New Trip form (and later
 * reused by Trip History's edit view). Each row is a self-contained DOM
 * fragment with its own remove button; the parent page reads current
 * values via `getParticipantRowData()`.
 *
 * Phone autocomplete: if a `phoneDirectory` (array of { phone, name }
 * from every participant across every past trip) is passed in, the phone
 * field gets a native <datalist> of suggestions, and typing/selecting a
 * phone number that exactly matches someone in the directory auto-fills
 * their name (only if the Name field is still empty, so it never
 * overwrites something the user already typed).
 */

const PAYMENT_STATUSES = ['Paid', 'Partial', 'Due'];
const PAYMENT_MODES = ['Bkash', 'Bank', 'Cash', 'Other'];

let rowIdCounter = 0;

/** Strips non-digits and normalizes a Bangladeshi phone number for matching. */
function normalizePhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.slice(3);
  if (digits && !digits.startsWith('0')) digits = `0${digits}`;
  return digits;
}

/**
 * Creates a participant row element.
 * @param {{ onChange?: () => void, onRemove?: () => void, phoneDirectory?: Array<{phone: string, name: string}> }} [handlers]
 * @returns {HTMLElement}
 */
export function createParticipantRow(handlers = {}) {
  const { onChange, onRemove, phoneDirectory = [] } = handlers;
  const rowId = `participant-${++rowIdCounter}`;
  const datalistId = `phone-suggestions-${rowId}`;

  // Build a normalized-phone -> name lookup once per row for autofill matching.
  const phoneToName = new Map();
  phoneDirectory.forEach((entry) => {
    const key = normalizePhone(entry.phone);
    if (key && !phoneToName.has(key)) phoneToName.set(key, entry.name);
  });

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
        <input class="field__control" type="tel" name="phone" placeholder="01XXXXXXXXX" list="${datalistId}" autocomplete="off" />
        <datalist id="${datalistId}">
          ${phoneDirectory.map((entry) => `<option value="${entry.phone}">${entry.name}</option>`).join('')}
        </datalist>
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

  const phoneInput = row.querySelector('[name="phone"]');
  const nameInput = row.querySelector('[name="name"]');

  phoneInput.addEventListener('input', () => {
    const match = phoneToName.get(normalizePhone(phoneInput.value));
    if (match && !nameInput.value.trim()) {
      nameInput.value = match;
    }
  });

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
