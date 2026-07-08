/**
 * js/modules/config.js
 *
 * Single place holding the deployed Google Apps Script Web App URL.
 * Every API call in the app goes through js/modules/api-client.js,
 * which reads this constant — so redeploying the backend only ever
 * means updating this one line.
 */

export const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxXhQlJdzETFFsFhNbpD4h98fJC_OaZVy4hdvkhPaxn0dZC80u05Oop0QUwN45HbnLs/exec';

/**
 * Shared-secret key sent with every request and checked by the backend's
 * isAuthorized_() (see apps-script/Code.gs). This is NOT real per-user
 * authentication — it just stops the API from being casually discoverable
 * by anyone who finds the public deployment URL. Must exactly match the
 * value set via apps-script/Security.gs's setApiKey().
 */
export const API_KEY = 'zecG-0lOoU0aU_9OB71zYguoPZCtoNfc_8YxUyx6sx8';
