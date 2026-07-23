/**
 * js/modules/trips-store.js
 *
 * Trips data access: backed by the real Apps Script API
 * (apps-script/TripsApi.gs). Falls back to the bundled mock dataset (with
 * a console warning) if the API is unreachable, so the app still shows
 * *something* usable rather than a blank page during an outage.
 *
 * Caching: fetching every trip (each with nested participants/expenses)
 * is the single heaviest request the app makes, and it's called on
 * almost every page (Dashboard, Trip History, Reports, Participants, New
 * Trip's phone autocomplete). Apps Script's own latency (cold starts,
 * sheet reads) means this can take a couple of seconds — most of which
 * is wasted if the person just came from another page a few seconds ago
 * and the data hasn't changed. A short-lived cache (sessionStorage, so it
 * survives full page navigations within the same tab) avoids repeating
 * that fetch when hopping between pages, while still expiring quickly
 * enough that it never shows meaningfully stale data. Saving or deleting
 * a trip immediately invalidates it, so the next read is always fresh.
 */

import { apiGet, apiPost } from './api-client.js';
import { MOCK_TRIPS } from '../data/mock-trips.js';

const CACHE_KEY = 'vfs-trips-cache';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds — short enough to never feel stale, long enough to skip redundant fetches between pages

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, fetchedAt } = JSON.parse(raw);
    if (Date.now() - fetchedAt > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }));
  } catch {
    // Non-fatal — caching is a performance nicety, not a requirement.
  }
}

/** Clears the trips cache — call after any write so the next read is guaranteed fresh. */
export function invalidateTripsCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Non-fatal.
  }
}

/**
 * Fetches every trip (each with nested participants[] and expenses[]).
 * Serves from a short-lived cache when available; pass `forceRefresh:
 * true` to skip it (rarely needed, since saves/deletes already
 * invalidate the cache automatically).
 * @param {{ forceRefresh?: boolean }} [options]
 * @returns {Promise<Object[]>}
 */
export async function fetchTrips(options = {}) {
  if (!options.forceRefresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  try {
    const data = await apiGet('trips');
    writeCache(data);
    return data;
  } catch (err) {
    console.warn('Failed to fetch trips from API, showing bundled demo data instead:', err.message);
    return MOCK_TRIPS;
  }
}

/**
 * Creates or updates a trip. Include `payload.tripId` to update an
 * existing trip; omit it to create a new one.
 * @param {Object} payload
 * @returns {Promise<{ tripId: string }>}
 */
export async function saveTripRemote(payload) {
  const result = await apiPost('saveTrip', { payload });
  invalidateTripsCache();
  return result;
}

/** Deletes a trip (and its participants/expenses/fund contributions). */
export async function deleteTripRemote(tripId) {
  const result = await apiPost('deleteTrip', { tripId });
  invalidateTripsCache();
  return result;
}
