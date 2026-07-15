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
      { name: 'Co-host', lifetimeTripCount: 3, role: 'coHost' },    // beginner — irrelevant to budget
      { name: 'Support', lifetimeTripCount: 12, role: 'support' },   // intermediate — irrelevant to budget
    ],
  });

  // Adjusted profit = 15000 (same as the beginner test above). Budget must be
  // determined by the Lead's Advanced tier alone: 30% of 15000 = 4500.
  assert.equal(result.adjustedProfit, 15000);
  assert.equal(result.hostCategory, 'advanced');
  assert.equal(result.hostPayment, 4500);

  const total = result.hostBreakdown.reduce((sum, h) => sum + h.amount, 0);
  assert.equal(total, 4500);
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

console.log('\nAll calculation engine tests passed.');
