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
 *
 * Collapse: each row can be collapsed to a one-line summary (tap the
 * chevron), which matters a lot on mobile where a 20+ participant trip
 * would otherwise be a very long scroll of full-size fields.
 *
 * Bulk import: parseParticipantBulkText() turns pasted spreadsheet rows
 * (tab-separated, as copied straight from Excel/Google Sheets, or plain
 * CSV) into an array of participant records, so a large trip roster
 * doesn't have to be typed in one field at a time.
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
    <button type="button" class="icon-button dynamic-row__collapse-toggle" aria-label="Collapse row">
      <i class="ti ti-chevron-up" aria-hidden="true"></i>
    </button>
    <div class="dynamic-row__body">
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
      <div class="dynamic-row__summary" hidden></div>
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

  wireCollapseToggle(row);

  return row;
}

/** Wires the collapse/expand chevron: hides the field grid, shows a one-line summary instead. */
function wireCollapseToggle(row) {
  const toggleBtn = row.querySelector('.dynamic-row__collapse-toggle');
  const grid = row.querySelector('.dynamic-row__grid');
  const summary = row.querySelector('.dynamic-row__summary');

  toggleBtn.addEventListener('click', () => {
    const collapsing = grid.hidden === false;
    grid.hidden = collapsing;
    summary.hidden = !collapsing;
    toggleBtn.querySelector('i').className = collapsing ? 'ti ti-chevron-down' : 'ti ti-chevron-up';
    toggleBtn.setAttribute('aria-label', collapsing ? 'Expand row' : 'Collapse row');
    if (collapsing) {
      const data = getParticipantRowData(row);
      summary.textContent = data.name || data.phone
        ? `${data.name || 'Unnamed'} · ${data.phone || 'no phone'} · ${data.paymentStatus}`
        : 'Empty participant';
    }
  });
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

/**
 * Fills an existing participant row's fields from a data object (used by
 * both bulk-paste import and Edit/Duplicate prefill).
 * @param {HTMLElement} rowEl
 * @param {{ name?: string, phone?: string, paidAmount?: number, dueAmount?: number, paymentMode?: string, paymentStatus?: string }} data
 */
export function setParticipantRowData(rowEl, data) {
  if (data.name != null) rowEl.querySelector('[name="name"]').value = data.name;
  if (data.phone != null) rowEl.querySelector('[name="phone"]').value = data.phone;
  if (data.paidAmount != null) rowEl.querySelector('[name="paidAmount"]').value = data.paidAmount;
  if (data.dueAmount != null) rowEl.querySelector('[name="dueAmount"]').value = data.dueAmount;
  if (data.paymentMode != null) rowEl.querySelector('[name="paymentMode"]').value = data.paymentMode;
  if (data.paymentStatus != null) rowEl.querySelector('[name="paymentStatus"]').value = data.paymentStatus;
}

const BULK_STATUS_ALIASES = {
  paid: 'Paid', partial: 'Partial', due: 'Due', unpaid: 'Due',
};
const BULK_MODE_ALIASES = {
  bkash: 'Bkash', bank: 'Bank', cash: 'Cash',
};

/**
 * Parses pasted spreadsheet text into participant records. Accepts
 * tab-separated rows (Excel/Google Sheets copy-paste) or comma-separated
 * (CSV). Expected column order: Name, Phone, Paid amount, Due amount,
 * Payment mode, Payment status — trailing columns are optional and fall
 * back to sensible defaults. A header row (starting with "name") is
 * detected and skipped automatically. Blank lines are ignored.
 * @param {string} text
 * @returns {Array<{ name: string, phone: string, paidAmount: number, dueAmount: number, paymentMode: string, paymentStatus: string }>}
 */
export function parseParticipantBulkText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const splitLine = (line) => (line.includes('\t') ? line.split('\t') : line.split(','))
    .map((cell) => cell.trim());

  const firstCells = splitLine(lines[0]);
  const looksLikeHeader = /^name$/i.test(firstCells[0] || '');
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cells = splitLine(line);
    const [name = '', phone = '', paid = '', due = '', mode = '', status = ''] = cells;

    return {
      name: name.trim(),
      phone: phone.trim(),
      paidAmount: Number(paid.replace(/[^\d.-]/g, '')) || 0,
      dueAmount: Number(due.replace(/[^\d.-]/g, '')) || 0,
      paymentMode: BULK_MODE_ALIASES[mode.trim().toLowerCase()] || 'Cash',
      paymentStatus: BULK_STATUS_ALIASES[status.trim().toLowerCase()] || 'Paid',
    };
  }).filter((p) => p.name || p.phone);
}
