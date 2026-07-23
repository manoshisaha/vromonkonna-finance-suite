/**
 * components/calculation-modal.js
 *
 * Shows the complete step-by-step HOST PAYMENT calculation for a trip —
 * this is the centerpiece of the modal, since it's the part people most
 * need to audit: how the Host Budget was determined (single-host tier,
 * multi-host ceiling, or foreign flat fee), the exact formula applied,
 * and for each host: their role weight, raw share, own tier, and whether
 * a minimum/maximum clamp adjusted their final amount.
 *
 * The rest of the trip's finances (Income → Adjusted Profit, and
 * Remaining → Organization Profit) are shown too, but condensed inside a
 * <details> disclosure, since they're simple arithmetic that rarely
 * needs auditing the way the host payment split does.
 *
 * Used by Trip History's "View calculation" row action.
 */

const CATEGORY_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  foreign: 'Foreign trip',
};

const ROLE_LABELS = {
  lead: 'Lead',
  coHost: 'Co-host',
  support: 'Support',
};

/**
 * Opens the calculation breakdown modal for a trip.
 * @param {Object} trip - an enriched trip (must have `.financials` attached, e.g. from trip-utils.js)
 * @param {(n: number) => string} formatFn - currency formatter, e.g. formatBDT
 */
export function showCalculationModal(trip, formatFn) {
  const f = trip.financials;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const budgetDiffers = Math.round(f.hostPayment) !== Math.round(f.hostBudget);

  overlay.innerHTML = `
    <div class="modal calculation-modal">
      <div class="modal__title">${escapeHtml(trip.tripName)} — how host payment was calculated</div>
      <div class="modal__message" style="margin-bottom: var(--space-4);">
        ${escapeHtml(trip.destination)} · ${escapeHtml(trip.hostDisplay || '')} · ${trip.tripType === 'foreign' ? 'Foreign trip' : 'Domestic trip'}
      </div>

      <div class="calculation-modal__section calculation-modal__section--primary">
        <div class="calculation-modal__section-title">Step 1 — the Host Budget</div>
        <p class="calculation-modal__explainer">${budgetReasonExplainer(f, formatFn)}</p>
        <div class="calculation-modal__rows">
          ${calcRow('Host Budget (Stage 1)', formatFn(f.hostBudget), true)}
        </div>
      </div>

      <div class="calculation-modal__section calculation-modal__section--primary">
        <div class="calculation-modal__section-title">Step 2 — split among hosts</div>
        ${f.hostBreakdown && f.hostBreakdown.length > 0 ? `
          <table class="calculation-modal__host-table">
            <thead><tr><th>Host</th><th>Weight</th><th>Raw share</th><th>Own tier</th><th>Final</th></tr></thead>
            <tbody>
              ${f.hostBreakdown.map((h) => hostRowHtml(h, formatFn)).join('')}
            </tbody>
          </table>
        ` : '<p class="calculation-modal__explainer">No host data recorded for this trip.</p>'}
        <div class="calculation-modal__rows" style="margin-top: var(--space-3);">
          ${calcRow('Host payment (actual total paid)', formatFn(f.hostPayment), true)}
        </div>
        ${budgetDiffers ? `
          <p class="calculation-modal__note">
            Actual payment differs from the Stage-1 budget because at least one host's own tier minimum or maximum adjusted their individual share (see "Final" column above) — this is expected, not an error.
          </p>
        ` : ''}
      </div>

      <details class="calculation-modal__details">
        <summary>Full trip finances (Income → Organization profit)</summary>
        <div class="calculation-modal__rows" style="margin-top: var(--space-3);">
          ${calcRow('Income', formatFn(f.income))}
          ${calcRow('− Total expenses', formatFn(f.totalExpenses))}
          ${calcRow('= Gross profit', formatFn(f.grossProfit), true)}
          ${calcRow('− T-shirt fund', formatFn(f.tshirtFund))}
          ${calcRow('= Adjusted profit', formatFn(f.adjustedProfit), true)}
          ${calcRow('− Host payment (from above)', formatFn(f.hostPayment))}
          ${calcRow('= Remaining', formatFn(f.remaining), true)}
          ${calcRow('− Social media fund (10%)', formatFn(f.socialMediaFund))}
          ${calcRow('= Organization profit', formatFn(f.organizationProfit), true)}
        </div>
      </details>

      <div class="modal__actions">
        <button type="button" class="btn btn-primary" data-action="close">Close</button>
      </div>
    </div>
  `;

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(event) {
    if (event.key === 'Escape') close();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);

  document.body.appendChild(overlay);
  overlay.querySelector('[data-action="close"]').focus();
}

/** Builds the plain-language explanation of how the Host Budget number was reached. */
function budgetReasonExplainer(f, formatFn) {
  if (f.hostBudgetReason === 'foreign-flat-fee') {
    return `Foreign trip — the budget is a flat fee (base amount + per-participant rate) set in Settings, with no tiers involved.`;
  }
  if (f.hostBudgetReason === 'multi-host-ceiling') {
    return `2+ hosts on this trip, and at least one is Intermediate or Advanced — so the budget uses the <strong>Advanced</strong> tier's rate as a ceiling, applied to Adjusted Profit (${formatFn(f.adjustedProfit)}). The Lead's own tier (<strong>${CATEGORY_LABELS[f.leadCategory] || f.leadCategory}</strong>) was NOT used for sizing the budget.`;
  }
  return `Only the Lead's tier — <strong>${CATEGORY_LABELS[f.hostCategory] || f.hostCategory}</strong> — determines the budget, applied to Adjusted Profit (${formatFn(f.adjustedProfit)}).`;
}

/** Builds one row of the per-host split table, including weight fraction and clamp explanation. */
function hostRowHtml(h, formatFn) {
  const weightDisplay = h.totalWeight
    ? `${h.weight}${h.weightWasOverridden ? ' (custom)' : ''} / ${h.totalWeight}`
    : '—';
  const tierDisplay = h.category ? CATEGORY_LABELS[h.category] || h.category : '—';
  const clampNote = h.clampReason
    ? `<div class="calculation-modal__clamp-tag">${h.clampReason === 'minimum' ? 'Floored to minimum' : 'Capped to maximum'}</div>`
    : '';

  return `
    <tr>
      <td>${escapeHtml(h.name)}<br><span class="calculation-modal__role-tag">${ROLE_LABELS[h.role] || h.role}</span></td>
      <td>${weightDisplay}</td>
      <td>${formatFn(h.rawAmount ?? h.amount)}</td>
      <td>${tierDisplay}</td>
      <td><strong>${formatFn(h.amount)}</strong>${clampNote}</td>
    </tr>
  `;
}

function calcRow(label, value, isTotal = false) {
  return `
    <div class="calculation-modal__row ${isTotal ? 'calculation-modal__row--total' : ''}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
