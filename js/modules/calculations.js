/**
 * js/modules/calculations.js
 *
 * Pure financial calculation engine for a single trip. No DOM access, no
 * side effects — every function takes plain data in and returns plain data
 * out, so it can be reused identically by New Trip (live preview), Trip
 * History (recompute on edit), Reports, and Funds.
 *
 * Business rules encoded here (per spec):
 *   Income            = Σ(participant paidAmount basis: participants × packagePrice) + otherIncome
 *   Gross Profit      = Income − Expenses
 *   T-shirt Fund      = participantCount × TSHIRT_PRICE (default 250 BDT)
 *   Adjusted Profit   = Gross Profit − T-shirt Fund
 *   Host payment tiers (by host's total lifetime trip count):
 *     Beginner      (0–8 trips)   -> fixed 500 BDT
 *     Intermediate  (9–20 trips)  -> 15% of Adjusted Profit, minimum 1000 BDT
 *     Advanced      (21+ trips)   -> 30% of Adjusted Profit, minimum 2000 BDT
 *   Remaining         = Adjusted Profit − Host Payment
 *   Social Media Fund = 10% of Remaining
 *   Organization Profit = Remaining − Social Media Fund
 *
 * All percentages/prices are configurable via the `settings` argument so
 * Settings page changes (Step 8) propagate without touching this file.
 */

/** Default settings — overridden by whatever the Settings page has saved. */
export const DEFAULT_SETTINGS = {
  tshirtPrice: 250,
  socialMediaFundPercent: 0.10,
  hostTiers: {
    beginner: { maxTrips: 8, type: 'fixed', amount: 500 },
    intermediate: { maxTrips: 20, type: 'percent', percent: 0.15, minimum: 1000 },
    advanced: { type: 'percent', percent: 0.30, minimum: 2000 },
  },
};

/**
 * @typedef {Object} Participant
 * @property {number} paidAmount
 * @property {number} [dueAmount]
 */

/**
 * @typedef {Object} Expense
 * @property {string} category
 * @property {number} amount
 */

/**
 * @typedef {Object} TripFinancialsInput
 * @property {number} participantCount        - count of registered participants
 * @property {number} packagePrice             - per-person package price
 * @property {number} [otherIncome]             - additional income outside package price
 * @property {Expense[]} expenses
 * @property {number} hostLifetimeTripCount     - total trips this host has ever run (determines tier)
 * @property {Object} [settings]                - overrides for DEFAULT_SETTINGS
 */

/**
 * @typedef {Object} TripFinancialsResult
 * @property {number} income
 * @property {number} totalExpenses
 * @property {number} grossProfit
 * @property {number} tshirtFund
 * @property {number} adjustedProfit
 * @property {'beginner'|'intermediate'|'advanced'} hostCategory
 * @property {number} hostPayment
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

  const hostCategory = determineHostCategory(input.hostLifetimeTripCount, settings);
  const hostPayment = calculateHostPayment(hostCategory, adjustedProfit, settings);

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
    hostPayment,
    remaining,
    socialMediaFund,
    organizationProfit,
  };
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
 * Computes host payment given their category and the trip's adjusted profit.
 * Intermediate and advanced tiers apply a minimum floor.
 */
export function calculateHostPayment(category, adjustedProfit, settings = DEFAULT_SETTINGS) {
  const tier = settings.hostTiers[category];
  if (!tier) throw new Error(`Unknown host category: ${category}`);

  if (tier.type === 'fixed') {
    return tier.amount;
  }

  const percentPayment = safeNum(adjustedProfit) * tier.percent;
  return Math.max(percentPayment, tier.minimum);
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
  };
}

function safeNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
