/**
 * js/modules/calculations.js
 *
 * Pure financial calculation engine for a single trip. No DOM access, no
 * side effects — every function takes plain data in and returns plain data
 * out, so it can be reused identically by New Trip (live preview), Trip
 * History (recompute on edit), Reports, and Funds.
 *
 * Business rules encoded here:
 *   Income            = participants × packagePrice + otherIncome
 *   Gross Profit      = Income − Expenses
 *   T-shirt Fund      = participantCount × TSHIRT_PRICE (default 250 BDT)
 *   Adjusted Profit   = Gross Profit − T-shirt Fund
 *
 *   HOST BUDGET (one number per trip, regardless of how many hosts):
 *     Domestic trips: computed exactly like the original single-host
 *       formula, using ONLY the Lead Host's tier (Beginner/Intermediate/
 *       Advanced — fixed or percent, with minimum/maximum). Co-hosts and
 *       Support Hosts never affect this number — their tiers are ignored
 *       for budget purposes.
 *     Foreign trips: Host Budget = a fixed base amount + (a per-participant
 *       rate × participantCount), both set per trip, not tier-based.
 *       Domestic-only concepts (tier, minimum, maximum) do not apply.
 *
 *   HOST BUDGET DISTRIBUTION: the one Host Budget number is then split
 *     among however many hosts are on the trip, proportional to each
 *     host's Role Weight (Lead/Co-host/Support — configurable in
 *     Settings, defaults 5/3/2). Individual host payments have no
 *     separate minimum/maximum — only the Host Budget itself was capped/
 *     floored, once.
 *
 *   Remaining         = Adjusted Profit − Host Budget
 *   Social Media Fund = 10% of Remaining
 *   Organization Profit = Remaining − Social Media Fund
 *
 * All percentages/prices/weights are configurable via the `settings`
 * argument so Settings page changes propagate without touching this file.
 */

/** Default settings — overridden by whatever the Settings page has saved. */
export const TRIP_DURATIONS = ['dayOnly', 'dayNight', 'overnight'];

export const DEFAULT_SETTINGS = {
  tshirtPrice: 250,
  socialMediaFundPercent: 0.10,
  hostTiers: {
    beginner: { maxTrips: 8, type: 'fixed', amount: 500, minimum: null, maximum: null, durationCaps: {} },
    intermediate: { maxTrips: 20, type: 'percent', percent: 0.15, minimum: 1000, maximum: null, durationCaps: {} },
    advanced: { type: 'percent', percent: 0.30, minimum: 2000, maximum: null, durationCaps: {} },
  },
  roleWeights: {
    lead: 5,
    coHost: 3,
    support: 2,
  },
};

export const HOST_ROLES = ['lead', 'coHost', 'support'];

/** Numeric seniority order for tier comparison — used only for the
 * New Trip "tier mismatch" guidance warning below, not for any payment
 * math (the payment formulas only ever look at the Lead's own tier). */
export const TIER_RANK = { beginner: 0, intermediate: 1, advanced: 2 };

/**
 * Checks whether any non-Lead host on the team outranks the Lead's own
 * tier (e.g. a Beginner Lead with an Advanced Co-host). This never
 * blocks anything and has no effect on the Host Budget — it exists so
 * New Trip can show a heads-up to whoever is entering the trip, since
 * that pairing means the senior host will be paid off the Lead's
 * (smaller) tier rather than their own.
 * @param {HostInput[]} hosts
 * @param {Object} [settings]
 * @returns {{ name: string, category: string }[]} hosts that outrank the Lead (empty if none, or if there's no clear Lead)
 */
export function findHostsOutrankingLead(hosts, settings = DEFAULT_SETTINGS) {
  if (!hosts || hosts.length === 0) return [];
  const lead = hosts.find((h) => h.role === 'lead');
  if (!lead) return [];

  const leadCategory = determineHostCategory(lead.lifetimeTripCount, settings);
  const leadRank = TIER_RANK[leadCategory];

  return hosts
    .filter((h) => h.role !== 'lead')
    .map((h) => ({ name: h.name, category: determineHostCategory(h.lifetimeTripCount, settings) }))
    .filter((h) => TIER_RANK[h.category] > leadRank);
}

/**
 * @typedef {Object} Expense
 * @property {string} category
 * @property {number} amount
 */

/**
 * @typedef {Object} HostInput
 * @property {string} name
 * @property {number} lifetimeTripCount   - snapshot at time of booking; used for tier lookup
 * @property {'lead'|'coHost'|'support'} role
 * @property {number} [weightOverride]     - optional per-trip weight, replacing the role's default weight for the split (e.g. for a genuinely 50/50-shared trip). Leave unset to use Role Weight × the tier system normally.
 */

/**
 * @typedef {Object} TripFinancialsInput
 * @property {number} participantCount
 * @property {number} packagePrice
 * @property {number} [otherIncome]
 * @property {Expense[]} expenses
 * @property {'domestic'|'foreign'} [tripType]        - defaults to 'domestic'
 * @property {'dayOnly'|'dayNight'|'overnight'} [tripDuration] - domestic trips only; selects duration-specific min/max overrides if the tier defines any
 * @property {HostInput[]} [hosts]                      - preferred: full host team with roles
 * @property {number} [hostLifetimeTripCount]            - legacy single-host fallback (no `hosts` array): treated as one Lead Host
 * @property {string} [hostName]                          - legacy single-host fallback, paired with hostLifetimeTripCount
 * @property {number} [foreignHostBaseAmount]                    - fixed base amount, required when tripType === 'foreign'
 * @property {number} [foreignHostRatePerParticipant]       - per-participant rate, required when tripType === 'foreign'
 * @property {Object} [settings]                             - overrides for DEFAULT_SETTINGS
 */

/**
 * @typedef {Object} HostPaymentBreakdown
 * @property {string} name
 * @property {'lead'|'coHost'|'support'} role
 * @property {number} weight     - the role weight snapshot used for this calculation
 * @property {number} amount     - this host's share of the Host Budget
 */

/**
 * @typedef {Object} TripFinancialsResult
 * @property {number} income
 * @property {number} totalExpenses
 * @property {number} grossProfit
 * @property {number} tshirtFund
 * @property {number} adjustedProfit
 * @property {'beginner'|'intermediate'|'advanced'|'foreign'} hostCategory  - the Lead Host's tier (domestic) or 'foreign'
 * @property {number} hostBudget          - the Stage-1 theoretical total, from the Lead's tier (or the foreign flat fee) alone, before any per-host clamping
 * @property {number} hostPayment         - the ACTUAL total paid across all hosts (sum of hostBreakdown) — this is what's subtracted to get Remaining, and can differ from hostBudget once Stage 2 clamping kicks in
 * @property {HostPaymentBreakdown[]} hostBreakdown  - per-host split of hostPayment
 * @property {number} remaining
 * @property {number} socialMediaFund
 * @property {number} organizationProfit
 */

/**
 * Runs the full calculation pipeline for a single trip.
 * @param {TripFinancialsInput} input
 * @returns {TripFinancialsResult}
 */
export function calculateTripFinancials(input) {
  const settings = mergeSettings(input.settings);

  const income = calculateIncome(input.participantCount, input.packagePrice, input.otherIncome);
  const totalExpenses = calculateExpenseTotal(input.expenses);
  const grossProfit = income - totalExpenses;
  const tshirtFund = calculateTshirtFund(input.participantCount, settings);
  const adjustedProfit = grossProfit - tshirtFund;

  const hostTeam = normalizeHostTeam(input);
  const tripType = input.tripType || 'domestic';

  let hostBudget;
  let hostCategory;
  let hostBudgetReason; // 'foreign-flat-fee' | 'single-host-tier' | 'multi-host-ceiling'
  let leadCategoryForDisplay = null; // the Lead's OWN tier, even when the ceiling overrides it for budget purposes

  if (tripType === 'foreign') {
    hostBudget = calculateForeignHostBudget(input.foreignHostBaseAmount, input.foreignHostRatePerParticipant, input.participantCount);
    hostCategory = 'foreign';
    hostBudgetReason = 'foreign-flat-fee';
  } else {
    const lead = hostTeam.find((h) => h.role === 'lead') || hostTeam[0];
    const leadCategory = lead ? determineHostCategory(lead.lifetimeTripCount, settings) : 'beginner';
    leadCategoryForDisplay = leadCategory;

    // Multi-host budget rule: when 2+ hosts are on a trip AND at least one
    // of them (any role) is Intermediate or Advanced, the budget uses the
    // Advanced tier's own rate/minimum/maximum as a ceiling — regardless of
    // which host is actually Lead. This exists so a trip with real seniority
    // present generates a bigger pool to split, without ever exceeding the
    // Advanced rate. It deliberately does NOT trigger for an all-Beginner
    // multi-host team (their budget still comes from the Lead's own tier,
    // same as a single Beginner host would get).
    const hasSeniorHostPresent = hostTeam.some(
      (h) => determineHostCategory(h.lifetimeTripCount, settings) !== 'beginner'
    );
    const useMultiHostCeiling = hostTeam.length >= 2 && hasSeniorHostPresent;

    if (useMultiHostCeiling) {
      hostCategory = 'advanced';
      // Deliberately NOT calculateHostPayment('advanced', ...) — that would
      // also apply Advanced's own Minimum/Maximum to the TOTAL before any
      // dividing happens, giving a "cap → divide → cap again" sequence.
      // The intended process is 30% → divide → cap each host's own share
      // (Stage 2) — a single cap, applied only after the split, per host.
      const advancedTier = settings.hostTiers.advanced;
      hostBudget = safeNum(adjustedProfit) * advancedTier.percent;
      hostBudgetReason = 'multi-host-ceiling';
    } else {
      hostCategory = leadCategory;
      hostBudget = lead ? calculateHostPayment(leadCategory, adjustedProfit, settings, input.tripDuration) : 0;
      hostBudgetReason = 'single-host-tier';
    }
  }

  const hostBreakdown = distributeHostBudget(hostTeam, hostBudget, settings, tripType, input.tripDuration);
  // The actual cash paid to hosts — this can differ from `hostBudget` once
  // Stage 2's per-host minimum/maximum clamping kicks in (a minimum is
  // always honored even if it pushes the total above the budget). This is
  // the number that must flow into Remaining/Org Profit, since that's what
  // actually left the organization's pocket.
  const hostPayment = hostBreakdown.reduce((sum, h) => sum + h.amount, 0);

  const remaining = adjustedProfit - hostPayment;
  const socialMediaFund = calculateSocialMediaFund(remaining, settings);
  const organizationProfit = remaining - socialMediaFund;

  return {
    income,
    totalExpenses,
    grossProfit,
    tshirtFund,
    adjustedProfit,
    hostCategory,
    hostBudget,
    hostBudgetReason,
    leadCategory: leadCategoryForDisplay,
    hostPayment,
    hostBreakdown,
    tripType,
    tripDuration: input.tripDuration || null,
    remaining,
    socialMediaFund,
    organizationProfit,
  };
}

/**
 * Normalizes trip input into a host team array. Prefers `input.hosts`;
 * falls back to the legacy single-host fields (`hostName` +
 * `hostLifetimeTripCount`), treated as one Lead Host at 100% — this is
 * how old single-host trips keep working unchanged.
 */
function normalizeHostTeam(input) {
  if (input.hosts && input.hosts.length > 0) {
    return input.hosts.map((h) => ({
      name: h.name,
      lifetimeTripCount: h.lifetimeTripCount,
      role: h.role || 'lead',
    }));
  }
  if (input.hostLifetimeTripCount != null) {
    return [{ name: input.hostName || 'Host', lifetimeTripCount: input.hostLifetimeTripCount, role: 'lead' }];
  }
  return [];
}

/**
 * Validates a host team against the hard rules: at least one host,
 * exactly one Lead Host, every host has a role, no duplicate names.
 * Returns an array of error messages — empty array means valid. Intended
 * to be called at Save time (live preview stays lenient so the form isn't
 * blocked while it's still being filled in).
 * @param {HostInput[]} hosts
 * @returns {string[]}
 */
export function validateHostTeam(hosts) {
  const errors = [];

  if (!hosts || hosts.length === 0) {
    errors.push('At least one host is required.');
    return errors;
  }

  const leads = hosts.filter((h) => h.role === 'lead');
  if (leads.length === 0) errors.push('Exactly one Lead Host is required.');
  if (leads.length > 1) errors.push('Only one Lead Host is allowed — pick a single lead.');

  if (hosts.some((h) => !h.role)) {
    errors.push('Every host must have a role (Lead, Co-host, or Support).');
  }

  const names = hosts.map((h) => h.name);
  if (new Set(names).size !== names.length) {
    errors.push('The same host is assigned more than once — remove the duplicate.');
  }

  return errors;
}

/** Income = participants × package price + other income. */
export function calculateIncome(participantCount, packagePrice, otherIncome = 0) {
  return safeNum(participantCount) * safeNum(packagePrice) + safeNum(otherIncome);
}

/** Sums an array of { amount } expense records. */
export function calculateExpenseTotal(expenses = []) {
  return expenses.reduce((sum, e) => sum + safeNum(e.amount), 0);
}

/** T-shirt Fund = participants × tshirt price. */
export function calculateTshirtFund(participantCount, settings = DEFAULT_SETTINGS) {
  return safeNum(participantCount) * settings.tshirtPrice;
}

/**
 * Determines host category from lifetime trip count.
 * 0–8 = beginner, 9–20 = intermediate, 21+ = advanced.
 */
export function determineHostCategory(hostLifetimeTripCount, settings = DEFAULT_SETTINGS) {
  const count = safeNum(hostLifetimeTripCount);
  const { beginner, intermediate } = settings.hostTiers;
  if (count <= beginner.maxTrips) return 'beginner';
  if (count <= intermediate.maxTrips) return 'intermediate';
  return 'advanced';
}

/**
 * Resolves the minimum/maximum to actually use for a tier: a
 * duration-specific override if the trip's duration has one defined,
 * otherwise the tier's own default minimum/maximum. Domestic trips only
 * — foreign trips don't use tiers at all, so duration never applies there.
 * @param {Object} tier
 * @param {'dayOnly'|'dayNight'|'overnight'} [tripDuration]
 * @returns {{ minimum: number|null, maximum: number|null }}
 */
function resolveTierCaps(tier, tripDuration) {
  const override = tripDuration && tier.durationCaps && tier.durationCaps[tripDuration];
  if (override && (override.minimum != null || override.maximum != null)) {
    return { minimum: override.minimum ?? null, maximum: override.maximum ?? null };
  }
  return { minimum: tier.minimum ?? null, maximum: tier.maximum ?? null };
}

/**
 * Public lookup for the UI: given a host's lifetime trip count, returns
 * their tier and the effective minimum/maximum that would apply to their
 * OWN individual share (Stage 2) for a given domestic trip duration — the
 * duration-specific override if one is set, otherwise the tier's default.
 * Not meaningful for foreign trips, which don't use tiers at all.
 * @param {number} lifetimeTripCount
 * @param {Object} [settings]
 * @param {'dayOnly'|'dayNight'|'overnight'} [tripDuration]
 * @returns {{ category: 'beginner'|'intermediate'|'advanced', minimum: number|null, maximum: number|null }}
 */
export function getEffectiveHostCaps(lifetimeTripCount, settings = DEFAULT_SETTINGS, tripDuration) {
  const category = determineHostCategory(lifetimeTripCount, settings);
  const tier = settings.hostTiers[category];
  const { minimum, maximum } = resolveTierCaps(tier, tripDuration);
  return { category, minimum, maximum };
}

/**
 * Computes payment for a single tier given adjusted profit. This is the
 * ONLY formula used to determine the Host Budget on domestic trips —
 * always applied once, using the Lead Host's tier alone.
 * Intermediate and advanced tiers apply a minimum floor, and optionally a
 * maximum cap. If the trip has a duration and the tier defines a
 * duration-specific override for it, that override's min/max is used
 * instead of the tier's default min/max.
 */
export function calculateHostPayment(category, adjustedProfit, settings = DEFAULT_SETTINGS, tripDuration) {
  const tier = settings.hostTiers[category];
  if (!tier) throw new Error(`Unknown host category: ${category}`);

  const { minimum, maximum } = resolveTierCaps(tier, tripDuration);

  if (tier.type === 'fixed') {
    let payment = tier.amount;
    if (minimum != null) payment = Math.max(payment, minimum);
    if (maximum != null) payment = Math.min(payment, maximum);
    return payment;
  }

  let payment = safeNum(adjustedProfit) * tier.percent;
  payment = Math.max(payment, minimum ?? 0);
  if (maximum != null) {
    payment = Math.min(payment, maximum);
  }
  return payment;
}

/** Host Budget for a foreign trip: a fixed base amount + (per-participant rate × participant count). No tiers involved. */
export function calculateForeignHostBudget(baseAmount, ratePerParticipant, participantCount) {
  return safeNum(baseAmount) + safeNum(ratePerParticipant) * safeNum(participantCount);
}

/**
 * Splits a single Host Budget total among the host team, proportional to
 * each host's role weight (Settings-configurable; default Lead 5,
 * Co-host 3, Support 2). Rounds each share, then reconciles any rounding
 * remainder onto the Lead Host so the shares always sum to exactly the
 * Host Budget.
 * @param {HostInput[]} hosts
 * @param {number} hostBudget
 * @param {Object} [settings]
 * @returns {HostPaymentBreakdown[]}
 */
/**
 * Splits a single Host Budget total among the host team, proportional to
 * each host's role weight (Settings-configurable; default Lead 5,
 * Co-host 3, Support 2) — then clamps each host's individual share to
 * THEIR OWN tier's minimum/maximum (Stage 2).
 *
 * Minimums are always honored, even if that pushes the total paid above
 * the Stage-1 Host Budget — e.g. a junior co-host's small weighted slice
 * of a big trip still can't fall below their own tier's floor. Maximums
 * still cap a share downward. Because of this, the sum of shares is only
 * guaranteed to exactly equal `hostBudget` when no host needed clamping;
 * when clamping happens, the total may differ from the budget on
 * purpose — see the design note in the Settings info popover.
 * @param {HostInput[]} hosts
 * @param {number} hostBudget
 * @param {Object} [settings]
 * @param {'domestic'|'foreign'} [tripType] - foreign trips skip Stage 2's per-host domestic-tier clamping entirely, since tiers don't apply to foreign trips at all
 * @param {'dayOnly'|'dayNight'|'overnight'} [tripDuration] - selects each host's duration-specific min/max override, if their tier defines one
 * @returns {HostPaymentBreakdown[]}
 */
export function distributeHostBudget(hosts, hostBudget, settings = DEFAULT_SETTINGS, tripType = 'domestic', tripDuration) {
  if (!hosts || hosts.length === 0) return [];

  const weights = settings.roleWeights || DEFAULT_SETTINGS.roleWeights;
  const weightFor = (h) => (h.weightOverride != null ? h.weightOverride : (weights[h.role] || 0));
  const totalWeight = hosts.reduce((sum, h) => sum + weightFor(h), 0);

  let anyClamped = false;

  const shares = hosts.map((h) => {
    const weight = weightFor(h);
    const usedOverride = h.weightOverride != null;
    const rawShare = totalWeight > 0
      ? safeNum(hostBudget) * (weight / totalWeight)
      : safeNum(hostBudget) / hosts.length;

    let amount = Math.round(rawShare);
    const rawAmount = Math.round(rawShare);
    let clampReason = null;
    let ownCategory = null;

    // Stage 2: clamp to this host's OWN tier — not the Lead's — so a
    // junior host riding along on a senior-led trip still gets their own
    // floor, and a senior host doesn't walk away with more than their
    // own ceiling even if their weighted slice would otherwise exceed it.
    // Skipped entirely on foreign trips, where domestic tiers don't apply.
    if (tripType !== 'foreign' && h.lifetimeTripCount != null) {
      ownCategory = determineHostCategory(h.lifetimeTripCount, settings);
      const ownTier = settings.hostTiers[ownCategory];
      if (ownTier) {
        const { minimum, maximum } = resolveTierCaps(ownTier, tripDuration);
        if (minimum != null && amount < minimum) {
          amount = minimum;
          anyClamped = true;
          clampReason = 'minimum';
        }
        if (maximum != null && amount > maximum) {
          amount = maximum;
          anyClamped = true;
          clampReason = 'maximum';
        }
      }
    }

    return {
      name: h.name,
      role: h.role,
      category: ownCategory,
      weight,
      weightWasOverridden: usedOverride,
      totalWeight,
      rawAmount,
      clampReason,
      amount,
    };
  });

  // Only reconcile rounding drift back onto the Lead when nobody was
  // clamped — once a minimum/maximum has kicked in, the total is allowed
  // to legitimately differ from the Stage-1 budget, so forcing an exact
  // match here would silently override a minimum guarantee.
  if (!anyClamped) {
    const sumRounded = shares.reduce((sum, h) => sum + h.amount, 0);
    const remainder = Math.round(safeNum(hostBudget)) - sumRounded;
    if (remainder !== 0 && shares.length > 0) {
      const leadIndex = shares.findIndex((h) => h.role === 'lead');
      const targetIndex = leadIndex !== -1 ? leadIndex : 0;
      shares[targetIndex].amount += remainder;
    }
  }

  return shares;
}

/** Social Media Fund = percent of Remaining (post host-payment profit). */
export function calculateSocialMediaFund(remaining, settings = DEFAULT_SETTINGS) {
  return safeNum(remaining) * settings.socialMediaFundPercent;
}

function mergeSettings(overrides) {
  if (!overrides) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    hostTiers: {
      ...DEFAULT_SETTINGS.hostTiers,
      ...(overrides.hostTiers || {}),
    },
    roleWeights: {
      ...DEFAULT_SETTINGS.roleWeights,
      ...(overrides.roleWeights || {}),
    },
  };
}

function safeNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
