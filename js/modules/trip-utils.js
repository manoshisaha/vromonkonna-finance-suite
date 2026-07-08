/**
 * js/modules/trip-utils.js
 *
 * Pure helper functions for working with a list of trip records:
 * attaching computed financials, text search, field filters, and sorting.
 * No DOM access — reusable by Trip History, Reports, and Dashboard alike.
 */

import { calculateTripFinancials } from './calculations.js';

/**
 * Returns a new trip object with a `.financials` property attached,
 * computed via the shared calculation engine. `calcSettings` is fetched
 * once per page load (via settings-store.js's getCalculationSettings())
 * and passed in here, rather than re-fetched per trip — settings-store
 * now hits a real API, so resolving it once for a whole list avoids N
 * redundant network calls.
 * @param {Object} trip
 * @param {Object} calcSettings - result of getCalculationSettings()
 * @returns {Object}
 */
export function enrichTripWithFinancials(trip, calcSettings) {
  const participantCount = trip.participants.length;
  const financials = calculateTripFinancials({
    participantCount,
    packagePrice: trip.packagePrice,
    otherIncome: trip.otherIncome,
    expenses: trip.expenses,
    hostLifetimeTripCount: trip.hostLifetimeTripCount,
    settings: calcSettings,
  });

  return { ...trip, participantCount, financials };
}

/**
 * Text search across trip name, destination, and host name (case-insensitive).
 * @param {Object[]} trips - trips already enriched with financials
 * @param {string} query
 */
export function searchTrips(trips, query) {
  const q = query.trim().toLowerCase();
  if (!q) return trips;
  return trips.filter((t) =>
    t.tripName.toLowerCase().includes(q) ||
    t.destination.toLowerCase().includes(q) ||
    t.hostName.toLowerCase().includes(q)
  );
}

/**
 * Filters by exact-match fields. Any filter value of '' or 'all' is ignored.
 * @param {Object[]} trips
 * @param {{ status?: string, destination?: string, hostName?: string }} filters
 */
export function filterTrips(trips, filters = {}) {
  return trips.filter((t) => {
    if (filters.status && filters.status !== 'all' && t.status !== filters.status) return false;
    if (filters.destination && filters.destination !== 'all' && t.destination !== filters.destination) return false;
    if (filters.hostName && filters.hostName !== 'all' && t.hostName !== filters.hostName) return false;
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

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
