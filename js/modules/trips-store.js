/**
 * js/modules/trips-store.js
 *
 * Trips data access: now backed by the real Apps Script API
 * (apps-script/TripsApi.gs). Falls back to the bundled mock dataset (with
 * a console warning) if the API is unreachable, so the app still shows
 * *something* usable rather than a blank page during an outage.
 */

import { apiGet, apiPost } from './api-client.js';
import { MOCK_TRIPS } from '../data/mock-trips.js';

/**
 * Fetches every trip (each with nested participants[] and expenses[]).
 * @returns {Promise<Object[]>}
 */
export async function fetchTrips() {
  try {
    return await apiGet('trips');
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
  return apiPost('saveTrip', { payload });
}

/** Deletes a trip (and its participants/expenses/fund contributions). */
export async function deleteTripRemote(tripId) {
  return apiPost('deleteTrip', { tripId });
}
