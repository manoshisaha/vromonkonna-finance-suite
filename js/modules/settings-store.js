/**
 * js/modules/settings-store.js
 *
 * Organization settings: now backed by the real Apps Script API
 * (apps-script/SettingsApi.gs) instead of localStorage. A local cache is
 * kept as an offline fallback only — the Sheet is the source of truth.
 */

import { apiGet, apiPost } from './api-client.js';
import { DEFAULT_SETTINGS as CALC_DEFAULTS } from './calculations.js';

const CACHE_KEY = 'vfs-settings-cache';

export const DEFAULT_APP_SETTINGS = {
  orgName: 'Vromonkonna',
  logoDataUrl: '',
  currency: 'BDT',
  contactPhone: '',
  contactEmail: '',
  address: '',
  fiscalYearStartMonth: 1,
  tshirtPrice: CALC_DEFAULTS.tshirtPrice,
  socialMediaFundPercent: CALC_DEFAULTS.socialMediaFundPercent * 100,
  hostTiers: {
    beginner: { maxTrips: CALC_DEFAULTS.hostTiers.beginner.maxTrips, amount: CALC_DEFAULTS.hostTiers.beginner.amount },
    intermediate: {
      maxTrips: CALC_DEFAULTS.hostTiers.intermediate.maxTrips,
      percent: CALC_DEFAULTS.hostTiers.intermediate.percent * 100,
      minimum: CALC_DEFAULTS.hostTiers.intermediate.minimum,
    },
    advanced: {
      percent: CALC_DEFAULTS.hostTiers.advanced.percent * 100,
      minimum: CALC_DEFAULTS.hostTiers.advanced.minimum,
    },
  },
};

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(settings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Non-fatal.
  }
}

/**
 * Fetches current settings from the API, merged over defaults for any
 * missing fields. Falls back to the last cached copy (or hardcoded
 * defaults) if the request fails.
 * @returns {Promise<Object>}
 */
export async function getSettings() {
  try {
    const fetched = await apiGet('settings');
    const merged = {
      ...DEFAULT_APP_SETTINGS,
      ...fetched,
      hostTiers: { ...DEFAULT_APP_SETTINGS.hostTiers, ...(fetched.hostTiers || {}) },
    };
    writeCache(merged);
    return merged;
  } catch (err) {
    console.warn('Failed to fetch settings from API, using cached/default copy:', err.message);
    return readCache() || { ...DEFAULT_APP_SETTINGS };
  }
}

/** Persists settings via the API and updates the local cache. */
export async function saveSettings(settings) {
  await apiPost('saveSettings', { payload: settings });
  writeCache(settings);
  return settings;
}

/**
 * Adapts stored app settings into the shape js/modules/calculations.js
 * expects (percentages as fractions, not whole numbers).
 * @returns {Promise<Object>} settings override object for calculateTripFinancials()
 */
export async function getCalculationSettings() {
  const s = await getSettings();
  return {
    tshirtPrice: s.tshirtPrice,
    socialMediaFundPercent: s.socialMediaFundPercent / 100,
    hostTiers: {
      beginner: { maxTrips: s.hostTiers.beginner.maxTrips, type: 'fixed', amount: s.hostTiers.beginner.amount },
      intermediate: {
        maxTrips: s.hostTiers.intermediate.maxTrips,
        type: 'percent',
        percent: s.hostTiers.intermediate.percent / 100,
        minimum: s.hostTiers.intermediate.minimum,
      },
      advanced: {
        type: 'percent',
        percent: s.hostTiers.advanced.percent / 100,
        minimum: s.hostTiers.advanced.minimum,
      },
    },
  };
}
