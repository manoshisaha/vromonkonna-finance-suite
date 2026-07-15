/**
 * components/info-popover.js
 *
 * Small "ⓘ" trigger next to a section title that reveals an explanatory
 * popover on click. Used where a rule (like host payment logic) is too
 * long for a one-line field-hint but shouldn't clutter the page by
 * default.
 *
 * Usage — write the markup directly (no JS needed to create it, only to
 * wire it up):
 *   <span class="info-popover">
 *     <button type="button" class="info-popover__trigger" aria-label="How this works">
 *       <i class="ti ti-info-circle" aria-hidden="true"></i>
 *     </button>
 *     <div class="info-popover__panel" hidden>...content...</div>
 *   </span>
 *
 * Then call initInfoPopovers() once per page (already wired into
 * js/app.js's initShell(), so every page gets this automatically).
 */

let globalListenersAttached = false;

/**
 * Wires up every `.info-popover__trigger` under `root`: click to toggle,
 * click outside or Escape to close, only one open at a time.
 * @param {Document|Element} [root]
 */
export function initInfoPopovers(root = document) {
  root.querySelectorAll('.info-popover__trigger').forEach((trigger) => {
    if (trigger.dataset.infoPopoverWired) return;
    trigger.dataset.infoPopoverWired = 'true';

    const panel = trigger.nextElementSibling;
    if (!panel || !panel.classList.contains('info-popover__panel')) return;

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const isCurrentlyOpen = !panel.hidden;
      closeAllPopovers();
      panel.hidden = isCurrentlyOpen;
    });
  });

  if (globalListenersAttached) return;
  globalListenersAttached = true;

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.info-popover')) closeAllPopovers();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllPopovers();
  });
}

function closeAllPopovers() {
  document.querySelectorAll('.info-popover__panel').forEach((panel) => {
    panel.hidden = true;
  });
}
