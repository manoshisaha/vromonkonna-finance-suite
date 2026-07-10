/**
 * components/host-row.js
 *
 * A single dynamic "host" row used in New Trip's Host Team section.
 * Each row lets you pick a host from the directory (or add a new one),
 * assign their Role (Lead/Co-host/Support), and shows their tier
 * (read-only, derived from lifetime trip count — informational only;
 * only the Lead's tier ever affects the Host Budget). The page
 * controller owns all business logic — this component only renders and
 * reads/writes its own DOM.
 */

export const ADD_HOST_OPTION_VALUE = '__add_new_host__';

export const ROLE_LABELS = {
  lead: 'Lead Host',
  coHost: 'Co-host',
  support: 'Support Host',
};

let rowIdCounter = 0;

function hostOptionsHtml(hostsList, selectedName) {
  return `
    <option value="" disabled ${!selectedName ? 'selected' : ''}>Select a host</option>
    ${hostsList.map((h) => `<option value="${h.name}" ${h.name === selectedName ? 'selected' : ''}>${h.name} (${h.lifetimeTripCount} trips)</option>`).join('')}
    <option value="${ADD_HOST_OPTION_VALUE}">+ Add new host...</option>
  `;
}

function roleOptionsHtml(selectedRole) {
  return Object.entries(ROLE_LABELS)
    .map(([value, label]) => `<option value="${value}" ${value === selectedRole ? 'selected' : ''}>${label}</option>`)
    .join('');
}

/**
 * Creates a host row element.
 * @param {Array<{ name: string, lifetimeTripCount: number }>} hostsList - current directory
 * @param {{ onChange?: (row: HTMLElement) => void, onRoleChange?: (row: HTMLElement) => void, onRemove?: () => void, defaultRole?: string }} [handlers]
 * @returns {HTMLElement}
 */
export function createHostRow(hostsList, handlers = {}) {
  const { onChange, onRoleChange, onRemove, defaultRole = 'coHost' } = handlers;
  const rowId = `host-${++rowIdCounter}`;

  const row = document.createElement('div');
  row.className = 'dynamic-row';
  row.dataset.rowId = rowId;
  row.innerHTML = `
    <div class="dynamic-row__grid" style="grid-template-columns: 2fr 1.2fr 1fr;">
      <div class="field field--compact">
        <label class="field__label">Host</label>
        <select class="field__control" name="hostName">${hostOptionsHtml(hostsList, '')}</select>
      </div>
      <div class="field field--compact">
        <label class="field__label">Role</label>
        <select class="field__control" name="role">${roleOptionsHtml(defaultRole)}</select>
      </div>
      <div class="field field--compact">
        <label class="field__label">Tier</label>
        <input class="field__control field__control--readonly" type="text" name="tierDisplay" readonly value="—" />
      </div>
    </div>
    <button type="button" class="icon-button dynamic-row__remove" aria-label="Remove host">
      <i class="ti ti-trash" aria-hidden="true"></i>
    </button>
  `;

  row.querySelector('[name="hostName"]').addEventListener('change', () => onChange && onChange(row));
  row.querySelector('[name="role"]').addEventListener('change', () => onRoleChange && onRoleChange(row));
  row.querySelector('.dynamic-row__remove').addEventListener('click', () => {
    row.remove();
    onRemove && onRemove();
  });

  return row;
}

/** Rebuilds a row's select options (e.g. after a new host is added to the directory). */
export function refreshHostRowOptions(row, hostsList, selectedName) {
  row.querySelector('[name="hostName"]').innerHTML = hostOptionsHtml(hostsList, selectedName);
}

/** Reads the selected host name and role out of a row. */
export function getHostRowData(row) {
  return {
    name: row.querySelector('[name="hostName"]').value,
    role: row.querySelector('[name="role"]').value,
  };
}

/** Sets a row's role selector value (e.g. auto-promoting the first host to Lead). */
export function setHostRowRole(row, role) {
  row.querySelector('[name="role"]').value = role;
}

/** Sets the read-only tier label shown in a row. */
export function setHostRowTierDisplay(row, label) {
  row.querySelector('[name="tierDisplay"]').value = label;
}
