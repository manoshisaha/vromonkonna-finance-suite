/**
 * js/modules/host-directory.js
 *
 * Host directory: now backed by the real Apps Script API (apps-script/HostsApi.gs)
 * instead of localStorage. A local cache is still kept as a fallback so the
 * app degrades gracefully (shows the last-known list) if the network or
 * the API is temporarily unavailable — it is not the source of truth.
 *
 * Note: incrementing a host's lifetime trip count on a new trip is now
 * done server-side (see TripsApi.gs's saveTrip -> incrementHostTripCount_),
 * so the frontend no longer needs to call anything after saving a trip.
 */

import { apiGet, apiPost } from './api-client.js';

const CACHE_KEY = 'vfs-hosts-cache';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCache(hosts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(hosts));
  } catch {
    // Non-fatal — caching is a nice-to-have, not a requirement.
  }
}

/**
 * Fetches the current host list from the API. Falls back to the last
 * cached list (and logs a warning) if the request fails.
 * @returns {Promise<Array<{id: string, name: string, lifetimeTripCount: number}>>}
 */
export async function getHosts() {
  try {
    const hosts = await apiGet('hosts');
    writeCache(hosts);
    return hosts;
  } catch (err) {
    console.warn('Failed to fetch hosts from API, using cached copy:', err.message);
    return readCache();
  }
}

/** Adds a new host. Returns the updated host list. */
export async function addHost({ name, lifetimeTripCount = 0 }) {
  await apiPost('addHost', { payload: { name, lifetimeTripCount } });
  return getHosts();
}

/** Updates an existing host's fields. Returns the updated host list. */
export async function updateHost(hostId, updates) {
  await apiPost('updateHost', { hostId, updates });
  return getHosts();
}

/** Removes a host by id. Returns the updated host list. */
export async function deleteHost(hostId) {
  await apiPost('deleteHost', { hostId });
  return getHosts();
}
