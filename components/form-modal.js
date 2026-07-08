/**
 * components/form-modal.js
 *
 * Reusable, promise-based modal containing a small form. Used by Funds'
 * "Add withdrawal" action; reusable anywhere else a quick modal form is
 * needed (a handful of fields, one submit action).
 *
 * Usage:
 *   const result = await formModal({
 *     title: 'Add withdrawal',
 *     fields: [
 *       { name: 'date', label: 'Date', type: 'date', required: true },
 *       { name: 'description', label: 'Description', type: 'text', required: true },
 *       { name: 'amount', label: 'Amount', type: 'number', required: true, min: 0 },
 *     ],
 *     submitLabel: 'Add withdrawal',
 *   });
 *   if (result) { ... use result.date / result.description / result.amount ... }
 */

/**
 * @typedef {Object} FormField
 * @property {string} name
 * @property {string} label
 * @property {'text'|'number'|'date'|'textarea'} [type]
 * @property {boolean} [required]
 * @property {number} [min]
 * @property {string} [placeholder]
 */

/**
 * @param {{ title: string, fields: FormField[], submitLabel?: string, cancelLabel?: string }} config
 * @returns {Promise<Object|null>} field values keyed by name, or null if cancelled
 */
export function formModal({ title, fields, submitLabel = 'Save', cancelLabel = 'Cancel' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__title">${escapeHtml(title)}</div>
        <form data-form-modal>
          ${fields.map(fieldHtml).join('')}
          <div class="modal__actions">
            <button type="button" class="btn btn-secondary" data-action="cancel">${escapeHtml(cancelLabel)}</button>
            <button type="submit" class="btn btn-primary" data-action="submit">${escapeHtml(submitLabel)}</button>
          </div>
        </form>
      </div>
    `;

    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') close(null);
    }

    const form = overlay.querySelector('[data-form-modal]');

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(null);
    });
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(null));
    document.addEventListener('keydown', onKeydown);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const values = {};
      fields.forEach((f) => {
        const el = form.querySelector(`[name="${f.name}"]`);
        values[f.name] = f.type === 'number' ? Number(el.value) : el.value;
      });
      close(values);
    });

    document.body.appendChild(overlay);
    const firstInput = form.querySelector('input, textarea, select');
    if (firstInput) firstInput.focus();
  });
}

function fieldHtml(field) {
  const { name, label, type = 'text', required = false, min, placeholder = '' } = field;
  const requiredAttr = required ? 'required' : '';
  const minAttr = min !== undefined ? `min="${min}"` : '';

  const control = type === 'textarea'
    ? `<textarea class="field__control" name="${name}" ${requiredAttr} placeholder="${escapeAttr(placeholder)}" style="height: auto; padding: 10px 12px;"></textarea>`
    : `<input class="field__control" type="${type}" name="${name}" ${requiredAttr} ${minAttr} placeholder="${escapeAttr(placeholder)}" />`;

  return `
    <div class="field">
      <label class="field__label">${escapeHtml(label)}</label>
      ${control}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}
