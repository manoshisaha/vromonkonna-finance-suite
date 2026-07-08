/**
 * js/modules/api-client.js
 *
 * Thin wrapper around fetch() for the Google Apps Script backend.
 * Every page controller goes through apiGet()/apiPost() instead of
 * calling fetch() directly, so the CORS workaround and error handling
 * live in exactly one place.
 *
 * CORS note: POST requests MUST use Content-Type: text/plain — see the
 * comment at the top of apps-script/Code.gs for why. The body is still
 * JSON text; the server parses it manually.
 */

import { API_BASE_URL } from './config.js';

/**
 * Performs a GET request against a resource.
 * @param {string} resource - 'trips' | 'hosts' | 'settings' | 'expenseCategories' | 'funds'
 * @param {Object} [params] - extra query params, e.g. { id: 'trip-1' } or { fundType: 'TshirtFund' }
 * @returns {Promise<any>} the `data` field of the API response
 * @throws if the network request fails or the API returns success:false
 */
export async function apiGet(resource, params = {}) {
  const query = new URLSearchParams({ resource, ...params }).toString();
  const response = await fetch(`${API_BASE_URL}?${query}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Unknown API error');
  }
  return result.data;
}

/**
 * Performs a POST "write" action against the backend.
 * @param {string} action - e.g. 'saveTrip', 'deleteTrip', 'addHost'
 * @param {Object} [body] - extra fields merged alongside `action`, e.g. { payload: {...} }
 * @returns {Promise<any>} the `data` field of the API response
 * @throws if the network request fails or the API returns success:false
 */
export async function apiPost(action, body = {}) {
  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...body }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Unknown API error');
  }
  return result.data;
}
