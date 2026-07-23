/**
 * js/modules/initiatives-store.js
 *
 * Data access for the Initiatives tracker — credit/debit entries for
 * activities outside the trip system (e.g. Shikkhon training/dorm, or
 * any other side initiative). Backed by apps-script/InitiativesApi.gs.
 */

import { apiGet, apiPost } from './api-client.js';

/** Fetches every initiative entry, newest first. */
export async function fetchInitiativeEntries() {
  return apiGet('initiatives');
}

/**
 * Adds a new entry.
 * @param {{ date: string, initiativeName: string, entryType: 'Credit'|'Debit', amount: number, description: string }} entry
 */
export async function addInitiativeEntry(entry) {
  return apiPost('addInitiativeEntry', { payload: entry });
}

/** Deletes an entry by id. */
export async function deleteInitiativeEntry(entryId) {
  return apiPost('deleteInitiativeEntry', { entryId });
}
