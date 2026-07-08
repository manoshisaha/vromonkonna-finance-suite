/**
 * js/modules/report-utils.js
 *
 * Pure helpers for the Reports page: filtering trips by month/year/
 * destination/host, and summing their financials into one aggregate
 * summary. No DOM access — reusable by the page controller and, later,
 * by Dashboard if it needs the same aggregation logic.
 */

const SUMMARY_FIELDS = [
  'income',
  'totalExpenses',
  'grossProfit',
  'tshirtFund',
  'adjustedProfit',
  'hostPayment',
  'socialMediaFund',
  'organizationProfit',
];

/** Returns the sorted list of distinct years present in the trip data, newest first. */
export function getAvailableYears(trips) {
  const years = new Set(trips.map((t) => new Date(t.tripDate).getFullYear()));
  return [...years].sort((a, b) => b - a);
}

/** Returns 'YYYY-MM' for the current date, matching the <input type="month"> value format. */
export function getCurrentMonthValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Groups trips by calendar month (across all years present) and sums a
 * chosen financial field, returning chart-ready { labels, values } sorted
 * chronologically. Used by Dashboard's "Revenue by month" / "Profit by
 * month" charts.
 * @param {Object[]} trips - enriched trips (with `.financials`)
 * @param {string} field - a key of `.financials`, e.g. 'income' or 'organizationProfit'
 */
export function groupTripsByMonth(trips, field) {
  const byMonth = new Map();

  trips.forEach((t) => {
    const d = new Date(t.tripDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, (byMonth.get(key) || 0) + (t.financials[field] || 0));
  });

  const sortedKeys = [...byMonth.keys()].sort();
  return {
    labels: sortedKeys.map((key) => {
      const [, month] = key.split('-');
      return MONTH_LABELS[Number(month) - 1];
    }),
    values: sortedKeys.map((key) => byMonth.get(key)),
  };
}

/**
 * Sums expense amounts by category across every trip, returning
 * chart-ready { labels, values } sorted by amount descending.
 * @param {Object[]} trips
 */
export function groupExpensesByCategory(trips) {
  const byCategory = new Map();

  trips.forEach((t) => {
    t.expenses.forEach((e) => {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + (e.amount || 0));
    });
  });

  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  return {
    labels: sorted.map(([category]) => category),
    values: sorted.map(([, amount]) => amount),
  };
}

/**
 * Sums organization profit by destination and returns the top N,
 * chart-ready as { labels, values } sorted descending.
 * @param {Object[]} trips
 * @param {number} [limit]
 */
export function topDestinationsByProfit(trips, limit = 5) {
  const byDestination = new Map();

  trips.forEach((t) => {
    byDestination.set(t.destination, (byDestination.get(t.destination) || 0) + (t.financials.organizationProfit || 0));
  });

  const sorted = [...byDestination.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  return {
    labels: sorted.map(([destination]) => destination),
    values: sorted.map(([, profit]) => profit),
  };
}

/**
 * Filters trips (already enriched with `.financials`) according to a report spec.
 * @param {Object[]} trips
 * @param {{ type: 'month'|'year'|'destination'|'host', value: string }} report
 * @returns {Object[]}
 */
export function filterTripsByReport(trips, report) {
  const { type, value } = report;
  if (!value) return [];

  switch (type) {
    case 'month':
      return trips.filter((t) => t.tripDate.startsWith(value)); // value = 'YYYY-MM'
    case 'year':
      return trips.filter((t) => t.tripDate.startsWith(value)); // value = 'YYYY'
    case 'destination':
      return trips.filter((t) => t.destination === value);
    case 'host':
      return trips.filter((t) => t.hostName === value);
    default:
      return trips;
  }
}

/**
 * Sums financial fields across a list of enriched trips.
 * @param {Object[]} trips
 * @returns {Object} totals keyed the same as a single trip's `.financials`, plus `totalTrips`
 */
export function summarizeTrips(trips) {
  const totals = { totalTrips: trips.length };
  SUMMARY_FIELDS.forEach((field) => {
    totals[field] = trips.reduce((sum, t) => sum + (t.financials[field] || 0), 0);
  });
  return totals;
}
