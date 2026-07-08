/**
 * js/modules/config.js
 *
 * Single place holding the deployed Google Apps Script Web App URL.
 * Every API call in the app goes through js/modules/api-client.js,
 * which reads this constant — so redeploying the backend only ever
 * means updating this one line.
 */

export const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxXhQlJdzETFFsFhNbpD4h98fJC_OaZVy4hdvkhPaxn0dZC80u05Oop0QUwN45HbnLs/exec';
