/**
 * js/modules/calculations.test.js
 *
 * Lightweight smoke tests (no test framework — run directly with `node`).
 * Verifies calculateTripFinancials() and its building blocks against
 * hand-worked numbers, including every example from the multi-host spec.
 */
import {
  calculateTripFinancials,
  calculateHostPayment,
  distributeHostBudget,
  calculateForeignHostBudget,
  validateHostTeam,
  determineHostCategory,
  findHostsOutrankingLead,
} from './calculations.js';
import assert from 'node:assert/strict';

function scenarioLabel(name, fn) {
  fn();
  console.log(`✔ ${name}`);
}

// ==================== Single-host / legacy backward compatibility ====================

scenarioLabel('Beginner host tier — fixed 500 BDT payment', () => {
  const result = calculateTripFinancials({
    participantCount: 20,
    packagePrice: 3000,
    otherIncome: 0,
    expenses: [{ category: 'Hotel', amount: 30000 }, { category: 'Transport', amount: 10000 }],
    hostLifetimeTripCount: 3, // beginner, legacy single-host field
  });

  assert.equal(result.income, 60000);
  assert.equal(result.totalExpenses, 40000);
  assert.equal(result.grossProfit, 20000);
  assert.equal(result.tshirtFund, 5000);
  assert.equal(result.adjustedProfit, 15000);
  assert.equal(result.hostCategory, 'beginner');
  assert.equal(result.hostPayment, 500);
  assert.equal(result.remaining, 14500);
  assert.equal(result.socialMediaFund, 1450);
  assert.equal(result.organizationProfit, 13050);
  // Legacy single host is normalized to one Lead Host at 100%.
  assert.equal(result.hostBreakdown.length, 1);
  assert.equal(result.hostBreakdown[0].amount, 500);
});

scenarioLabel('Tier boundaries — 8 trips beginner, 9 trips intermediate, 20 intermediate, 21 advanced', () => {
  assert.equal(determineHostCategory(8), 'beginner');
  assert.equal(determineHostCategory(9), 'intermediate');
  assert.equal(determineHostCategory(20), 'intermediate');
  assert.equal(determineHostCategory(21), 'advanced');
});

// ==================== Host Budget examples straight from the spec ====================

scenarioLabel('Spec Example 1 — Adjusted Profit 80,000, Advanced lead, 30% -> Host Budget 24,000', () => {
  const budget = calculateHostPayment('advanced', 80000);
  assert.equal(budget, 24000);
});

scenarioLabel('Spec Example 2 — Adjusted Profit 200,000, Advanced lead, 30% = 60,000, capped at maximum 40,000', () => {
  const settings = {
    tshirtPrice: 250,
    socialMediaFundPercent: 0.10,
    hostTiers: {
      beginner: { maxTrips: 8, type: 'fixed', amount: 500 },
      intermediate: { maxTrips: 20, type: 'percent', percent: 0.15, minimum: 1000, maximum: null },
      advanced: { type: 'percent', percent: 0.30, minimum: 2000, maximum: 40000 },
    },
    roleWeights: { lead: 5, coHost: 3, support: 2 },
  };
  const budget = calculateHostPayment('advanced', 200000, settings);
  assert.equal(budget, 40000);
});

scenarioLabel('Spec Example 3 — Adjusted Profit 3,000, Advanced lead, 30% = 900, floored to minimum 2,000', () => {
  const budget = calculateHostPayment('advanced', 3000);
  assert.equal(budget, 2000);
});

// ==================== Role weight distribution ====================

scenarioLabel('Spec distribution example — Budget 24,000 split Lead(5)/Co-host(3)/Support(2) -> 12000/7200/4800', () => {
  const hosts = [
    { name: 'Lead Host', lifetimeTripCount: 25, role: 'lead' },
    { name: 'Co-host', lifetimeTripCount: 25, role: 'coHost' },
    { name: 'Support Host', lifetimeTripCount: 25, role: 'support' },
  ];
  const breakdown = distributeHostBudget(hosts, 24000);

  const byName = Object.fromEntries(breakdown.map((h) => [h.name, h.amount]));
  assert.equal(byName['Lead Host'], 12000);
  assert.equal(byName['Co-host'], 7200);
  assert.equal(byName['Support Host'], 4800);

  const total = breakdown.reduce((sum, h) => sum + h.amount, 0);
  assert.equal(total, 24000);
});

scenarioLabel('Distribution always sums exactly to the Host Budget, even with rounding', () => {
  // Weights that don't divide evenly into the budget, to force rounding.
  const hosts = [
    { name: 'A', lifetimeTripCount: 25, role: 'lead' },
    { name: 'B', lifetimeTripCount: 25, role: 'coHost' },
    { name: 'C', lifetimeTripCount: 25, role: 'support' },
  ];
  const breakdown = distributeHostBudget(hosts, 10000);
  const total = breakdown.reduce((sum, h) => sum + h.amount, 0);
  assert.equal(total, 10000);
});

scenarioLabel('Co-host and Support tiers never affect the Host Budget — only the Lead\'s tier matters', () => {
  const result = calculateTripFinancials({
    participantCount: 20,
    packagePrice: 3000,
    otherIncome: 0,
    expenses: [{ category: 'Hotel', amount: 40000 }],
    hosts: [
      { name: 'Lead', lifetimeTripCount: 25, role: 'lead' },       // advanced
      { name: 'Co-host', lifetimeTripCount: 3, role: 'coHost' },    // beginner — irrelevant to budget size
      { name: 'Support', lifetimeTripCount: 12, role: 'support' },   // intermediate — irrelevant to budget size
    ],
  });

  // Adjusted profit = 15000 (same as the beginner test above). The BUDGET
  // (Stage 1) must be determined by the Lead's Advanced tier alone: 30%
  // of 15000 = 4500 — the Co-host/Support tiers never change this number.
  assert.equal(result.adjustedProfit, 15000);
  assert.equal(result.hostCategory, 'advanced');
  assert.equal(result.hostBudget, 4500);

  // Stage 2: split 5/3/2 -> raw shares 2250/1350/900. Support (Intermediate,
  // own minimum 1000) has a raw share below their own floor, so it's
  // bumped up to 1000 — same two-stage clamp as the dedicated tests below.
  // hostPayment (the ACTUAL amount paid, used for Remaining/Org Profit)
  // legitimately differs from hostBudget (4500) here, on purpose.
  const byName = Object.fromEntries(result.hostBreakdown.map((h) => [h.name, h.amount]));
  assert.equal(byName['Lead'], 2250);
  assert.equal(byName['Co-host'], 1350);
  assert.equal(byName['Support'], 1000);
  assert.equal(result.hostPayment, 4600);

  const total = result.hostBreakdown.reduce((sum, h) => sum + h.amount, 0);
  assert.equal(total, 4600);
});

// ==================== Foreign trips ====================

scenarioLabel('Foreign trip — Host Budget = fixed base + (rate per participant × participant count), tiers ignored', () => {
  assert.equal(calculateForeignHostBudget(20000, 1500, 20), 50000);
  assert.equal(calculateForeignHostBudget(0, 2500, 20), 50000); // base amount optional, defaults to 0

  const result = calculateTripFinancials({
    participantCount: 20,
    packagePrice: 15000,
    otherIncome: 0,
    expenses: [{ category: 'Flights', amount: 150000 }],
    tripType: 'foreign',
    foreignHostBaseAmount: 20000,
    foreignHostRatePerParticipant: 1500,
    hosts: [
      { name: 'Lead', lifetimeTripCount: 1, role: 'lead' }, // would be "beginner" domestically, but irrelevant here
    ],
  });

  assert.equal(result.hostCategory, 'foreign');
  assert.equal(result.hostPayment, 50000);
  assert.equal(result.hostBreakdown[0].amount, 50000);
});

// ==================== Validation ====================

scenarioLabel('validateHostTeam — requires exactly one lead, no duplicates, all roles set', () => {
  assert.deepEqual(validateHostTeam([]), ['At least one host is required.']);

  assert.deepEqual(
    validateHostTeam([{ name: 'A', lifetimeTripCount: 5, role: 'coHost' }]),
    ['Exactly one Lead Host is required.']
  );

  assert.deepEqual(
    validateHostTeam([
      { name: 'A', lifetimeTripCount: 5, role: 'lead' },
      { name: 'B', lifetimeTripCount: 5, role: 'lead' },
    ]),
    ['Only one Lead Host is allowed — pick a single lead.']
  );

  assert.deepEqual(
    validateHostTeam([
      { name: 'A', lifetimeTripCount: 5, role: 'lead' },
      { name: 'A', lifetimeTripCount: 5, role: 'coHost' },
    ]),
    ['The same host is assigned more than once — remove the duplicate.']
  );

  assert.deepEqual(
    validateHostTeam([{ name: 'A', lifetimeTripCount: 5, role: 'lead' }]),
    []
  );
});

scenarioLabel('findHostsOutrankingLead — flags a senior host under a junior Lead, never affects payment', () => {
  const hosts = [
    { name: 'Junior Lead', lifetimeTripCount: 3, role: 'lead' },       // beginner
    { name: 'Senior Co-host', lifetimeTripCount: 25, role: 'coHost' },  // advanced
  ];

  const flagged = findHostsOutrankingLead(hosts);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].name, 'Senior Co-host');
  assert.equal(flagged[0].category, 'advanced');

  // No warning when everyone is at or below the Lead's tier.
  const fine = findHostsOutrankingLead([
    { name: 'Senior Lead', lifetimeTripCount: 25, role: 'lead' },
    { name: 'Junior Co-host', lifetimeTripCount: 3, role: 'coHost' },
  ]);
  assert.equal(fine.length, 0);
});

scenarioLabel('Beginner tier — optional minimum/maximum clamp around the fixed amount', () => {
  const settings = {
    tshirtPrice: 250,
    socialMediaFundPercent: 0.10,
    hostTiers: {
      beginner: { maxTrips: 8, type: 'fixed', amount: 500, minimum: 800, maximum: 1200 },
      intermediate: { maxTrips: 20, type: 'percent', percent: 0.15, minimum: 1000, maximum: null },
      advanced: { type: 'percent', percent: 0.30, minimum: 2000, maximum: null },
    },
    roleWeights: { lead: 5, coHost: 3, support: 2 },
  };

  // Fixed amount (500) is below the minimum (800) -> floored up to 800.
  assert.equal(calculateHostPayment('beginner', 15000, settings), 800);

  // Fixed amount above a lower maximum gets capped.
  const cappedSettings = {
    ...settings,
    hostTiers: { ...settings.hostTiers, beginner: { maxTrips: 8, type: 'fixed', amount: 500, minimum: null, maximum: 300 } },
  };
  assert.equal(calculateHostPayment('beginner', 15000, cappedSettings), 300);

  // Leaving both blank (null) behaves exactly as before — pure fixed amount.
  assert.equal(calculateHostPayment('beginner', 15000), 500);
});

scenarioLabel('Two-stage clamp — a host\'s own minimum is honored even if it pushes the total above the Stage-1 budget', () => {
  const settings = {
    tshirtPrice: 250,
    socialMediaFundPercent: 0.10,
    hostTiers: {
      beginner: { maxTrips: 8, type: 'fixed', amount: 500, minimum: null, maximum: null },
      intermediate: { maxTrips: 20, type: 'percent', percent: 0.15, minimum: 1000, maximum: 5000 },
      advanced: { type: 'percent', percent: 0.30, minimum: 2000, maximum: null },
    },
    roleWeights: { lead: 5, coHost: 3, support: 2 },
  };

  // Adjusted profit 20,000; Lead = Intermediate (15% of 20000 = 3000, within own range) -> Stage-1 budget = 3000.
  // Split 5:3 -> Lead raw 1875, Co-host raw 1125.
  // Co-host is Advanced (own minimum 2000) -> 1125 is below their own floor -> bumped up to 2000.
  // Total paid = 1875 + 2000 = 3875, which exceeds the Stage-1 budget of 3000 — allowed, by design.
  const breakdown = distributeHostBudget(
    [
      { name: 'Lead', lifetimeTripCount: 12, role: 'lead' },     // intermediate
      { name: 'Co-host', lifetimeTripCount: 25, role: 'coHost' }, // advanced
    ],
    3000, // Stage-1 budget, already computed from the Lead's tier
    settings
  );

  const byName = Object.fromEntries(breakdown.map((h) => [h.name, h.amount]));
  assert.equal(byName['Lead'], 1875);
  assert.equal(byName['Co-host'], 2000); // bumped up from raw 1125

  const total = breakdown.reduce((sum, h) => sum + h.amount, 0);
  assert.equal(total, 3875); // exceeds the 3000 Stage-1 budget, on purpose
});

scenarioLabel('Two-stage clamp — a host\'s own maximum caps their individual share downward', () => {
  const settings = {
    tshirtPrice: 250,
    socialMediaFundPercent: 0.10,
    hostTiers: {
      beginner: { maxTrips: 8, type: 'fixed', amount: 500, minimum: 800, maximum: 1200 },
      intermediate: { maxTrips: 20, type: 'percent', percent: 0.15, minimum: 1000, maximum: 5000 },
      advanced: { percent: 0.30, minimum: 2000, maximum: 8000, maxTrips: undefined, type: 'percent' },
    },
    roleWeights: { lead: 5, coHost: 3, support: 2 },
  };

  // Adjusted profit 100,000; Lead = Advanced (30% of 100000 = 30000, capped at own max 8000) -> Stage-1 budget = 8000.
  // Split 5:3 -> Lead raw 5000, Co-host raw 3000.
  // Co-host is Beginner (own maximum 1200) -> 3000 exceeds their own ceiling -> capped down to 1200.
  const breakdown = distributeHostBudget(
    [
      { name: 'Lead', lifetimeTripCount: 25, role: 'lead' },    // advanced
      { name: 'Co-host', lifetimeTripCount: 3, role: 'coHost' }, // beginner
    ],
    8000,
    settings
  );

  const byName = Object.fromEntries(breakdown.map((h) => [h.name, h.amount]));
  assert.equal(byName['Lead'], 5000);
  assert.equal(byName['Co-host'], 1200); // capped down from raw 3000

  const total = breakdown.reduce((sum, h) => sum + h.amount, 0);
  assert.equal(total, 6200); // less than the 8000 Stage-1 budget
});

scenarioLabel('Remaining/Organization Profit use the ACTUAL amount paid to hosts, not the theoretical Stage-1 budget', () => {
  const settings = {
    tshirtPrice: 250,
    socialMediaFundPercent: 0.10,
    hostTiers: {
      beginner: { maxTrips: 8, type: 'fixed', amount: 500, minimum: null, maximum: null },
      intermediate: { maxTrips: 20, type: 'percent', percent: 0.15, minimum: 1000, maximum: null },
      advanced: { percent: 0.30, minimum: 2000, maximum: null, type: 'percent' },
    },
    roleWeights: { lead: 5, coHost: 3, support: 2 },
  };

  const result = calculateTripFinancials({
    participantCount: 20,
    packagePrice: 3000,
    otherIncome: 0,
    expenses: [{ category: 'Hotel', amount: 40000 }],
    hosts: [
      { name: 'Lead', lifetimeTripCount: 25, role: 'lead' },        // advanced
      { name: 'Support', lifetimeTripCount: 12, role: 'support' },   // intermediate, will get clamped up
    ],
    settings,
  });

  // Budget (Stage 1) = 4500. Split 5:2 (weight) -> Lead 3214, Support 1286 (rounded).
  // Support's own Intermediate minimum (1000) doesn't bind here since 1286 > 1000,
  // so nothing is clamped in this particular split — use it to prove the
  // baseline still matches before checking the clamped case below.
  assert.equal(result.hostBudget, 4500);
  assert.equal(result.hostPayment, result.hostBreakdown.reduce((sum, h) => sum + h.amount, 0));
  assert.equal(result.remaining, result.adjustedProfit - result.hostPayment);
  assert.equal(result.organizationProfit, result.remaining - result.socialMediaFund);
});

scenarioLabel('Duration-specific caps — override the tier default when the trip duration has one defined', () => {
  const settings = {
    tshirtPrice: 250,
    socialMediaFundPercent: 0.10,
    hostTiers: {
      beginner: { maxTrips: 8, type: 'fixed', amount: 500, minimum: null, maximum: null, durationCaps: {} },
      intermediate: { maxTrips: 20, type: 'percent', percent: 0.15, minimum: 1000, maximum: null, durationCaps: {} },
      advanced: {
        type: 'percent', percent: 0.30, minimum: 2000, maximum: null,
        durationCaps: {
          dayOnly: { minimum: 1500, maximum: 5000 },
          overnight: { minimum: 3000, maximum: null },
          // dayNight intentionally left undefined -> falls back to the tier default (2000/null)
        },
      },
    },
    roleWeights: { lead: 5, coHost: 3, support: 2 },
  };

  // Adjusted profit 10,000; Advanced = 30% of 10000 = 3000 (within every cap, no clamp needed anywhere).
  assert.equal(calculateHostPayment('advanced', 10000, settings, 'dayOnly'), 3000);

  // Adjusted profit 4,000; Advanced = 30% of 4000 = 1200.
  // dayOnly override minimum is 1500 -> floored up to 1500 (NOT the tier default 2000).
  assert.equal(calculateHostPayment('advanced', 4000, settings, 'dayOnly'), 1500);

  // Same profit, overnight duration -> its own override minimum is 3000 -> floored up to 3000.
  assert.equal(calculateHostPayment('advanced', 4000, settings, 'overnight'), 3000);

  // Same profit, dayNight duration -> no override defined -> falls back to tier default minimum 2000.
  assert.equal(calculateHostPayment('advanced', 4000, settings, 'dayNight'), 2000);

  // No duration passed at all -> also falls back to tier default minimum 2000.
  assert.equal(calculateHostPayment('advanced', 4000, settings), 2000);

  // High profit with a dayOnly maximum override (5000) capping what would otherwise be uncapped.
  assert.equal(calculateHostPayment('advanced', 100000, settings, 'dayOnly'), 5000);
});

scenarioLabel('Duration-specific caps flow through the full trip calculation and Stage-2 per-host clamp', () => {
  const settings = {
    tshirtPrice: 250,
    socialMediaFundPercent: 0.10,
    hostTiers: {
      beginner: { maxTrips: 8, type: 'fixed', amount: 500, minimum: null, maximum: null, durationCaps: {} },
      intermediate: {
        maxTrips: 20, type: 'percent', percent: 0.15, minimum: 1000, maximum: null,
        durationCaps: { overnight: { minimum: 2500, maximum: null } },
      },
      advanced: { type: 'percent', percent: 0.30, minimum: 2000, maximum: null, durationCaps: {} },
    },
    roleWeights: { lead: 5, coHost: 3, support: 2 },
  };

  const result = calculateTripFinancials({
    participantCount: 20,
    packagePrice: 3000,
    otherIncome: 0,
    expenses: [{ category: 'Hotel', amount: 40000 }],
    tripType: 'domestic',
    tripDuration: 'overnight',
    hosts: [
      { name: 'Lead', lifetimeTripCount: 25, role: 'lead' },      // advanced
      { name: 'Support', lifetimeTripCount: 12, role: 'support' }, // intermediate
    ],
    settings,
  });

  // Adjusted profit 15000; Lead is Advanced -> budget = 30% of 15000 = 4500.
  assert.equal(result.hostBudget, 4500);

  // Split 5:2 (weight 7) -> Lead raw 3214, Support raw 1286 (rounded).
  // Support is Intermediate; on an overnight trip their own minimum override is 2500 (not the default 1000) -> bumped up.
  const byName = Object.fromEntries(result.hostBreakdown.map((h) => [h.name, h.amount]));
  assert.equal(byName['Support'], 2500);
  assert.equal(result.tripDuration, 'overnight');
});

console.log('\nAll calculation engine tests passed.');
