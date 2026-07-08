/**
 * components/expense-row.js
 *
 * A single dynamic "expense" row used in the New Trip form (and reused by
 * Trip History's edit view). Supports the default category list plus a
 * user-defined custom category via the "Custom..." option.
 */

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Going Transport',
  'Return Transport',
  'Breakfast',
  'Lunch',
  'Dinner',
  'Hotel',
  'Guide',
  'Tips',
  'Snacks',
  'Tickets',
  'Emergency',
  'Miscellaneous',
];

const CUSTOM_OPTION_VALUE = '__custom__';

let rowIdCounter = 0;

/**
 * Creates an expense row element.
 * @param {{ onChange?: () => void, onRemove?: () => void, categories?: string[] }} [handlers]
 */
export function createExpenseRow(handlers = {}) {
  const { onChange, onRemove, categories = DEFAULT_EXPENSE_CATEGORIES } = handlers;
  const rowId = `expense-${++rowIdCounter}`;

  const row = document.createElement('div');
  row.className = 'dynamic-row';
  row.dataset.rowId = rowId;
  row.innerHTML = `
    <div class="dynamic-row__grid dynamic-row__grid--expense">
      <div class="field field--compact">
        <label class="field__label">Category</label>
        <select class="field__control" name="category">
          ${categories.map((c) => `<option value="${c}">${c}</option>`).join('')}
          <option value="${CUSTOM_OPTION_VALUE}">Custom...</option>
        </select>
      </div>
      <div class="field field--compact custom-category-field" hidden>
        <label class="field__label">Custom category name</label>
        <input class="field__control" type="text" name="customCategory" placeholder="e.g. Boat rental" />
      </div>
      <div class="field field--compact">
        <label class="field__label">Amount</label>
        <input class="field__control" type="number" name="amount" min="0" step="1" placeholder="0" />
      </div>
      <div class="field field--compact">
        <label class="field__label">Note</label>
        <input class="field__control" type="text" name="note" placeholder="Optional" />
      </div>
    </div>
    <button type="button" class="icon-button dynamic-row__remove" aria-label="Remove expense">
      <i class="ti ti-trash" aria-hidden="true"></i>
    </button>
  `;

  const categorySelect = row.querySelector('[name="category"]');
  const customField = row.querySelector('.custom-category-field');

  categorySelect.addEventListener('change', () => {
    customField.hidden = categorySelect.value !== CUSTOM_OPTION_VALUE;
    onChange && onChange();
  });

  row.querySelectorAll('input').forEach((el) => {
    el.addEventListener('input', () => onChange && onChange());
  });

  row.querySelector('.dynamic-row__remove').addEventListener('click', () => {
    row.remove();
    onRemove && onRemove();
  });

  return row;
}

/**
 * Reads current field values out of an expense row element.
 * @param {HTMLElement} rowEl
 * @returns {{ category: string, amount: number, note: string }}
 */
export function getExpenseRowData(rowEl) {
  const categorySelect = rowEl.querySelector('[name="category"]');
  const isCustom = categorySelect.value === CUSTOM_OPTION_VALUE;
  const category = isCustom
    ? (rowEl.querySelector('[name="customCategory"]').value.trim() || 'Miscellaneous')
    : categorySelect.value;

  return {
    category,
    amount: Number(rowEl.querySelector('[name="amount"]').value) || 0,
    note: rowEl.querySelector('[name="note"]').value.trim(),
  };
}
