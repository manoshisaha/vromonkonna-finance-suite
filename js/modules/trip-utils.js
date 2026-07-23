/**
 * js/modules/trip-utils.js
 *
 * Pure helper functions for working with a list of trip records:
 * attaching computed financials, text search, field filters, and sorting.
 * No DOM access — reusable by Trip History, Reports, and Dashboard alike.
 */

import { calculateTripFinancials, calculateIncome, calculateExpenseTotal } from './calculations.js';

/**
 * Returns a new trip object with a `.financials` property attached, plus
 * a convenience `.hostNames` array and `.hostDisplay` string for search/
 * filter/table display.
 *
 * IMPORTANT — historical accuracy: if the trip carries a
 * `financialsSnapshot` (written by the backend at save time — see
 * TripsApi.gs), that frozen snapshot is used for every settings-dependent
 * figure (T-shirt fund, adjusted profit, remaining, social fund, org
 * profit, host budget/breakdown) instead of recomputing them with
 * *today's* Settings. Otherwise editing Settings months later would
 * silently rewrite how old, already-completed trips display everywhere
 * (Trip History, Reports, Dashboard) — see the design note in
 * TripsApi.gs's buildFinancialsSnapshot_() for the full reasoning.
 *
 * Income/Expenses/Gross Profit are always computed fresh regardless,
 * since they depend only on the trip's own numbers (participants,
 * package price, expenses) and never on Settings — so recomputing them
 * is always safe and never goes stale.
 *
 * Trips saved before snapshotting existed (no `financialsSnapshot`) fall
 * back to a full live calculation, same as before — this only changes
 * behavior for trips saved after this feature shipped.
 *
 * `calcSettings` is fetched once per page load (via settings-store.js's
 * getCalculationSettings()) and passed in here rather than re-fetched
 * per trip; it's only actually used for the legacy-fallback path.
 * @param {Object} trip
 * @param {Object} calcSettings - result of getCalculationSettings()
 * @returns {Object}
 */
export function enrichTripWithFinancials(trip, calcSettings) {
  const participantCount = trip.participantCount != null ? trip.participantCount : trip.participants.length;
  const financials = trip.financialsSnapshot
    ? buildFinancialsFromSnapshot(trip, participantCount)
    : calculateTripFinancials({
        participantCount,
        packagePrice: trip.packagePrice,
        otherIncome: trip.otherIncome,
        expenses: trip.expenses,
        tripType: trip.tripType,
        tripDuration: trip.tripDuration,
        foreignHostBaseAmount: trip.foreignHostBaseAmount,
        foreignHostRatePerParticipant: trip.foreignHostRatePerParticipant,
        hosts: trip.hosts,
        settings: calcSettings,
      });

  const hostNames = (trip.hosts || []).map((h) => h.name);
  const leadHost = (trip.hosts || []).find((h) => h.role === 'lead');

  return {
    ...trip,
    participantCount,
    financials,
    hostNames,
    hostDisplay: hostNames.length > 1
      ? `${leadHost ? leadHost.name : hostNames[0]} +${hostNames.length - 1} more`
      : (hostNames[0] || '—'),
  };
}

/**
 * Assembles a full TripFinancialsResult from a trip's frozen snapshot,
 * recomputing only the settings-independent Income/Expenses/Gross Profit
 * fresh. See enrichTripWithFinancials()'s doc comment for why.
 */
function buildFinancialsFromSnapshot(trip, participantCount) {
  const income = calculateIncome(participantCount, trip.packagePrice, trip.otherIncome);
  const totalExpenses = calculateExpenseTotal(trip.expenses);
  const grossProfit = income - totalExpenses;
  const snap = trip.financialsSnapshot;

  return {
    income,
    totalExpenses,
    grossProfit,
    tshirtFund: snap.tshirtFund,
    adjustedProfit: snap.adjustedProfit,
    hostCategory: trip.leadHostTierSnapshot,
    hostPayment: trip.hostBudget,
    hostBreakdown: (trip.hosts || []).map((h) => ({ name: h.name, role: h.role, amount: h.amount })),
    tripType: trip.tripType,
    tripDuration: trip.tripDuration || null,
    remaining: snap.remaining,
    socialMediaFund: snap.socialMediaFund,
    organizationProfit: snap.organizationProfit,
  };
}

/**
 * Text search across trip name, destination, and every assigned host's name.
 * @param {Object[]} trips - trips already enriched with financials
 * @param {string} query
 */
export function searchTrips(trips, query) {
  const q = query.trim().toLowerCase();
  if (!q) return trips;
  return trips.filter((t) =>
    t.tripName.toLowerCase().includes(q) ||
    t.destination.toLowerCase().includes(q) ||
    (t.hostNames || []).some((name) => name.toLowerCase().includes(q))
  );
}

/**
 * Filters by exact-match fields. Any filter value of '' or 'all' is ignored.
 * `hostName` matches if ANY host on the trip (any role) has that name.
 * @param {Object[]} trips
 * @param {{ status?: string, destination?: string, hostName?: string }} filters
 */
export function filterTrips(trips, filters = {}) {
  return trips.filter((t) => {
    if (filters.status && filters.status !== 'all' && t.status !== filters.status) return false;
    if (filters.destination && filters.destination !== 'all' && t.destination !== filters.destination) return false;
    if (filters.hostName && filters.hostName !== 'all' && !(t.hostNames || []).includes(filters.hostName)) return false;
    return true;
  });
}

/**
 * Sorts trips by a given key. Supports nested `financials.X` keys via dot path.
 * @param {Object[]} trips
 * @param {string} sortKey - e.g. 'tripDate', 'participantCount', 'financials.organizationProfit'
 * @param {'asc'|'desc'} direction
 */
export function sortTrips(trips, sortKey, direction = 'asc') {
  const sorted = [...trips].sort((a, b) => {
    const aVal = getByPath(a, sortKey);
    const bVal = getByPath(b, sortKey);

    if (typeof aVal === 'string') {
      return aVal.localeCompare(bVal);
    }
    return (aVal ?? 0) - (bVal ?? 0);
  });

  return direction === 'desc' ? sorted.reverse() : sorted;
}

/** Returns the sorted list of unique values for a given top-level field, for filter dropdowns. */
export function uniqueValues(trips, field) {
  return [...new Set(trips.map((t) => t[field]))].sort();
}

/** Returns the sorted list of unique individual host names across every trip and role — for the host filter dropdown. */
export function uniqueHostNames(trips) {
  const all = trips.flatMap((t) => t.hostNames || []);
  return [...new Set(all)].sort();
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
