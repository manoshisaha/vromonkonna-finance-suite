/**
 * components/confirm-dialog.js
 *
 * Reusable, promise-based confirmation modal. Used anywhere a destructive
 * or irreversible action needs explicit confirmation (Delete trip, etc.).
 *
 * Usage:
 *   import { confirmDialog } from '../components/confirm-dialog.js';
 *   const ok = await confirmDialog({ title: 'Delete trip?', message: '...' });
 *   if (ok) { ... }
 */

/**
 * Shows a confirmation modal and resolves true/false based on the user's choice.
 * @param {{ title: string, message: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} config
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__title">${escapeHtml(title)}</div>
        <div class="modal__message">${escapeHtml(message)}</div>
        <div class="modal__actions">
          <button type="button" class="btn btn-secondary" data-action="cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') close(false);
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false);
    });
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(overlay);
    overlay.querySelector('[data-action="confirm"]').focus();
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
