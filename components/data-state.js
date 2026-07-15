/**
 * components/data-state.js
 *
 * Two small helpers every page uses while fetching data:
 *   - showLoadingState(container): a spinner + message, shown while a
 *     fetch is in flight, so the screen never just sits blank (which on
 *     a slow connection looks like the site is broken).
 *   - showErrorState(container, message, onRetry): a message + Retry
 *     button, shown if a fetch fails, so a dropped connection doesn't
 *     leave the user stuck with no way forward except a manual refresh.
 */

/**
 * Replaces a container's content with a loading spinner.
 * @param {HTMLElement} container
 * @param {string} [message]
 */
export function showLoadingState(container, message = 'Loading...') {
  if (!container) return;
  container.innerHTML = `
    <div class="data-state">
      <span class="spinner" aria-hidden="true"></span>
      <span class="data-state__message">${message}</span>
    </div>
  `;
}

/**
 * Replaces a container's content with an error message and a Retry button.
 * @param {HTMLElement} container
 * @param {string} message
 * @param {() => void} onRetry - called when the Retry button is clicked
 */
export function showErrorState(container, message, onRetry) {
  if (!container) return;
  container.innerHTML = `
    <div class="data-state data-state--error">
      <i class="ti ti-alert-triangle" aria-hidden="true"></i>
      <span class="data-state__message">${message}</span>
      <button type="button" class="btn btn-secondary btn-sm" data-action="retry">Retry</button>
    </div>
  `;
  const btn = container.querySelector('[data-action="retry"]');
  if (btn && onRetry) {
    btn.addEventListener('click', onRetry);
  }
}
