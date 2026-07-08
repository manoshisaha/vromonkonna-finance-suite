/**
 * js/modules/fund-ledger.js
 *
 * Fund ledger: now backed by the real Apps Script API
 * (apps-script/FundsApi.gs). Contribution rows are written server-side
 * automatically whenever a trip is saved (see TripsApi.gs's saveTrip),
 * so this module no longer derives them from a trip list client-side —
 * it simply reads the ledger the server already computed.
 */

import { apiGet, apiPost } from './api-client.js';

export const FUND_KEYS = ['SocialMediaFund', 'TshirtFund', 'OrganizationProfit'];

export const FUND_LABELS = {
  SocialMediaFund: 'Social media fund',
  TshirtFund: 'T-shirt fund',
  OrganizationProfit: 'Organization profit',
};

/**
 * Fetches the full ledger for one fund: contributions + manual entries,
 * sorted chronologically with a running balance per row (all computed
 * server-side).
 * @param {string} fundKey - one of FUND_KEYS
 * @returns {Promise<{ entries: Object[], currentBalance: number }>}
 */
export async function buildLedger(fundKey) {
  return apiGet('funds', { fundType: fundKey });
}

/**
 * Adds a manual withdrawal/adjustment entry for a fund.
 * @param {string} fundKey
 * @param {{ date: string, description: string, amount: number, type?: 'withdrawal'|'adjustment' }} entry
 */
export async function addManualEntry(fundKey, entry) {
  return apiPost('addFundEntry', { fundType: fundKey, entry });
}

/** Removes a manual entry by id. */
export async function deleteManualEntry(entryId) {
  return apiPost('deleteFundEntry', { entryId });
}
