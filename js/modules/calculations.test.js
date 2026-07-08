/**
 * js/modules/calculations.test.js
 *
 * Lightweight smoke tests (no test framework — run directly with `node`).
 * Verifies calculateTripFinancials() against hand-worked numbers for
 * each host tier boundary.
 */
import { calculateTripFinancials } from './calculations.js';
import assert from 'node:assert/strict';

function scenarioLabel(name, fn) {
  fn();
  console.log(`✔ ${name}`);
}

// ---- Scenario 1: Beginner host (fixed 500 BDT) ----
scenarioLabel('Beginner host tier — fixed 500 BDT payment', () => {
  const result = calculateTripFinancials({
    participantCount: 20,
    packagePrice: 3000,
    otherIncome: 0,
    expenses: [{ category: 'Hotel', amount: 30000 }, { category: 'Transport', amount: 10000 }],
    hostLifetimeTripCount: 3, // beginner
  });

  // Income = 20*3000 = 60000; Expenses = 40000; Gross = 20000
  // T-shirt = 20*250 = 5000; Adjusted = 15000
  // Host (beginner, fixed) = 500
  // Remaining = 14500; Social = 10% = 1450; Org profit = 13050
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
});

// ---- Scenario 2: Intermediate host, percent payment exceeds minimum ----
scenarioLabel('Intermediate host tier — 15% exceeds 1000 minimum', () => {
  const result = calculateTripFinancials({
    participantCount: 30,
    packagePrice: 5000,
    otherIncome: 2000,
    expenses: [{ category: 'Hotel', amount: 60000 }],
    hostLifetimeTripCount: 12, // intermediate
  });

  // Income = 30*5000 + 2000 = 152000; Expenses = 60000; Gross = 92000
  // T-shirt = 30*250 = 7500; Adjusted = 84500
  // Host (15%) = 12675, which is > 1000 minimum -> use 12675
  assert.equal(result.hostCategory, 'intermediate');
  assert.equal(result.adjustedProfit, 84500);
  assert.equal(result.hostPayment, 84500 * 0.15);
});

// ---- Scenario 3: Intermediate host, percent payment below minimum floor ----
scenarioLabel('Intermediate host tier — floor kicks in at 1000 minimum', () => {
  const result = calculateTripFinancials({
    participantCount: 5,
    packagePrice: 2000,
    otherIncome: 0,
    expenses: [{ category: 'Hotel', amount: 8000 }],
    hostLifetimeTripCount: 15, // intermediate
  });

  // Income = 10000; Expenses = 8000; Gross = 2000; T-shirt = 1250; Adjusted = 750
  // Host 15% of 750 = 112.5, below 1000 minimum -> use 1000
  assert.equal(result.adjustedProfit, 750);
  assert.equal(result.hostPayment, 1000);
});

// ---- Scenario 4: Advanced host, minimum floor of 2000 ----
scenarioLabel('Advanced host tier — 30% floor at 2000 minimum', () => {
  const result = calculateTripFinancials({
    participantCount: 10,
    packagePrice: 1500,
    otherIncome: 0,
    expenses: [{ category: 'Hotel', amount: 5000 }],
    hostLifetimeTripCount: 25, // advanced
  });

  // Income = 15000; Expenses = 5000; Gross = 10000; T-shirt = 2500; Adjusted = 7500
  // Host 30% of 7500 = 2250, above 2000 minimum -> use 2250
  assert.equal(result.hostCategory, 'advanced');
  assert.equal(result.hostPayment, 2250);
});

// ---- Scenario 5: Boundary — exactly 8 trips is still beginner, 9 is intermediate ----
scenarioLabel('Tier boundaries — 8 trips beginner, 9 trips intermediate, 20 intermediate, 21 advanced', () => {
  const base = {
    participantCount: 10,
    packagePrice: 1000,
    otherIncome: 0,
    expenses: [],
  };
  assert.equal(calculateTripFinancials({ ...base, hostLifetimeTripCount: 8 }).hostCategory, 'beginner');
  assert.equal(calculateTripFinancials({ ...base, hostLifetimeTripCount: 9 }).hostCategory, 'intermediate');
  assert.equal(calculateTripFinancials({ ...base, hostLifetimeTripCount: 20 }).hostCategory, 'intermediate');
  assert.equal(calculateTripFinancials({ ...base, hostLifetimeTripCount: 21 }).hostCategory, 'advanced');
});

console.log('\nAll calculation engine tests passed.');
