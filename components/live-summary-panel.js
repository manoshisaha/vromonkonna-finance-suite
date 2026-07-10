/**
 * components/live-summary-panel.js
 *
 * Collapsible top-of-page panel that displays live-calculated financial
 * results (income, expenses, gross profit, Host Budget, per-host split,
 * funds, org profit). Used by New Trip, and reusable later by Trip
 * History's edit view.
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
 * Renders the panel shell into targetEl. Call `update()` on the returned
 * handle whenever the underlying financial result changes.
 * @param {HTMLElement} targetEl
 * @returns {{ update: (result: import('../js/modules/calculations.js').TripFinancialsResult, formatFn: (n:number)=>string) => void }}
 */
export function renderLiveSummaryPanel(targetEl) {
  targetEl.innerHTML = `
    <div class="live-summary" data-expanded="true">
      <button type="button" class="live-summary__toggle" aria-expanded="true" data-action="toggle-summary">
        <span class="live-summary__title">Live summary</span>
        <i class="ti ti-chevron-up live-summary__chevron" aria-hidden="true"></i>
      </button>
      <div class="live-summary__body">
        <div class="live-summary__grid">
          ${metricHtml('income', 'Income')}
          ${metricHtml('totalExpenses', 'Expenses')}
          ${metricHtml('grossProfit', 'Gross profit')}
          ${metricHtml('tshirtFund', 'T-shirt fund')}
          ${metricHtml('adjustedProfit', 'Adjusted profit')}
          ${metricHtml('hostPayment', 'Host budget')}
          ${metricHtml('socialMediaFund', 'Social media fund')}
          ${metricHtml('organizationProfit', 'Organization profit')}
        </div>
        <div class="live-summary__host-tier">
          <span class="live-summary__host-label" data-field="hostCategoryLabel">Lead's tier</span>
          <span class="badge badge-info" data-field="hostCategory">—</span>
        </div>
        <div class="live-summary__host-breakdown" data-field="hostBreakdown" hidden></div>
      </div>
    </div>
  `;

  wireToggle(targetEl);

  return {
    update(result, formatFn = String) {
      Object.entries(result).forEach(([key, value]) => {
        if (key === 'hostBreakdown') return;
        const el = targetEl.querySelector(`[data-field="${key}"]`);
        if (!el) return;
        el.textContent = key === 'hostCategory' ? (CATEGORY_LABELS[value] || value) : formatFn(value);
      });

      const hostCategoryLabelEl = targetEl.querySelector('[data-field="hostCategoryLabel"]');
      if (hostCategoryLabelEl) {
        hostCategoryLabelEl.textContent = result.tripType === 'foreign' ? 'Trip type' : "Lead's tier";
      }

      const orgProfitEl = targetEl.querySelector('[data-field="organizationProfit"]');
      if (orgProfitEl) {
        orgProfitEl.classList.toggle('live-summary__value--negative', result.organizationProfit < 0);
      }

      const breakdownEl = targetEl.querySelector('[data-field="hostBreakdown"]');
      if (breakdownEl) {
        if (result.hostBreakdown && result.hostBreakdown.length > 0) {
          breakdownEl.hidden = false;
          breakdownEl.innerHTML = `
            <span class="live-summary__host-label">Host budget split</span>
            <div class="live-summary__host-breakdown-rows">
              ${result.hostBreakdown.map((h) => `
                <div class="live-summary__host-breakdown-row">
                  <span>${escapeHtml(h.name)} <span class="badge badge-info">${ROLE_LABELS[h.role] || h.role}</span></span>
                  <strong>${formatFn(h.amount)}</strong>
                </div>
              `).join('')}
            </div>
          `;
        } else {
          breakdownEl.hidden = true;
          breakdownEl.innerHTML = '';
        }
      }
    },
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function metricHtml(field, label) {
  return `
    <div class="live-summary__metric">
      <span class="live-summary__metric-label">${label}</span>
      <span class="live-summary__metric-value" data-field="${field}">—</span>
    </div>
  `;
}

function wireToggle(targetEl) {
  const toggleBtn = targetEl.querySelector('[data-action="toggle-summary"]');
  const panel = targetEl.querySelector('.live-summary');
  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener('click', () => {
    const isExpanded = panel.getAttribute('data-expanded') === 'true';
    panel.setAttribute('data-expanded', String(!isExpanded));
    toggleBtn.setAttribute('aria-expanded', String(!isExpanded));
  });
}
