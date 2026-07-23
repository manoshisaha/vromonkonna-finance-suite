/**
 * js/modules/host-directory.js
 *
 * Host directory: backed by the real Apps Script API
 * (apps-script/HostsApi.gs). The host list rarely changes minute-to-minute,
 * so reads are cache-first with a short TTL (skips a network round-trip
 * on every page load that needs it — New Trip, Settings — while still
 * refreshing often enough that adding a host elsewhere shows up quickly).
 * The cache is also kept as an offline fallback if a fetch ever fails.
 */

import { apiGet, apiPost } from './api-client.js';

const CACHE_KEY = 'vfs-hosts-cache';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function readCache(respectTtl) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Backward-compatible with the old cache shape (a plain array, no timestamp).
    if (Array.isArray(parsed)) return respectTtl ? null : parsed;
    if (respectTtl && Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed.hosts;
  } catch {
    return null;
  }
}

function writeCache(hosts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ hosts, cachedAt: Date.now() }));
  } catch {
    // Non-fatal — caching is a nice-to-have, not a requirement.
  }
}

/**
 * Fetches the current host list. Serves from cache if it's fresh
 * (within the TTL); otherwise fetches from the API and refreshes the
 * cache. Falls back to any cached copy (even a stale one) if the
 * network request fails, so the app degrades gracefully offline.
 * @returns {Promise<Array<{id: string, name: string, lifetimeTripCount: number}>>}
 */
export async function getHosts() {
  const fresh = readCache(true);
  if (fresh) return fresh;

  try {
    const hosts = await apiGet('hosts');
    writeCache(hosts);
    return hosts;
  } catch (err) {
    console.warn('Failed to fetch hosts from API, using cached copy:', err.message);
    return readCache(false) || [];
  }
}

/** Adds a new host. Returns the updated host list. */
export async function addHost({ name, lifetimeTripCount = 0 }) {
  await apiPost('addHost', { payload: { name, lifetimeTripCount } });
  const hosts = await apiGet('hosts');
  writeCache(hosts);
  return hosts;
}

/** Updates an existing host's fields. Returns the updated host list. */
export async function updateHost(hostId, updates) {
  await apiPost('updateHost', { hostId, updates });
  const hosts = await apiGet('hosts');
  writeCache(hosts);
  return hosts;
}

/** Removes a host by id. Returns the updated host list. */
export async function deleteHost(hostId) {
  await apiPost('deleteHost', { hostId });
  const hosts = await apiGet('hosts');
  writeCache(hosts);
  return hosts;
}
