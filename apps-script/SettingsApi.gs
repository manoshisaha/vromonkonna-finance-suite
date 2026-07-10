/**
 * SettingsApi.gs
 *
 * Settings resource: a simple Key/Value sheet (one row per setting)
 * rather than a single wide row, so adding a new setting later is just
 * a new row, not a schema change. hostTiers and roleWeights are nested
 * objects, each stored as a JSON string in their own row.
 *
 * Shape matches js/modules/settings-store.js's getSettings()/saveSettings()
 * exactly, so the frontend swap is a drop-in replacement.
 */

const SETTINGS_SHEET = 'Settings';

const DEFAULT_HOST_TIERS_ = {
  beginner: { maxTrips: 8, amount: 500 },
  intermediate: { maxTrips: 20, percent: 15, minimum: 1000, maximum: null },
  advanced: { percent: 30, minimum: 2000, maximum: null },
};

const DEFAULT_ROLE_WEIGHTS_ = { lead: 5, coHost: 3, support: 2 };

function getSettings() {
  const rows = sheetToObjects_(getSheet_(SETTINGS_SHEET));
  const map = {};
  rows.forEach((r) => { map[r.Key] = r.Value; });

  return {
    orgName: map.orgName || 'Vromonkonna',
    logoUrl: map.logoUrl || '',
    currency: map.currency || 'BDT',
    contactPhone: map.contactPhone || '',
    contactEmail: map.contactEmail || '',
    address: map.address || '',
    fiscalYearStartMonth: Number(map.fiscalYearStartMonth) || 1,
    tshirtPrice: Number(map.tshirtPrice) || 250,
    socialMediaFundPercent: Number(map.socialMediaFundPercent) || 10,
    hostTiers: map.hostTiers ? JSON.parse(map.hostTiers) : DEFAULT_HOST_TIERS_,
    roleWeights: map.roleWeights ? JSON.parse(map.roleWeights) : DEFAULT_ROLE_WEIGHTS_,
  };
}

function saveSettings(payload) {
  const sheet = getSheet_(SETTINGS_SHEET);

  const entries = {
    orgName: payload.orgName,
    logoUrl: payload.logoUrl || '',
    currency: payload.currency,
    contactPhone: payload.contactPhone,
    contactEmail: payload.contactEmail,
    address: payload.address,
    fiscalYearStartMonth: payload.fiscalYearStartMonth,
    tshirtPrice: payload.tshirtPrice,
    socialMediaFundPercent: payload.socialMediaFundPercent,
    hostTiers: JSON.stringify(payload.hostTiers),
    roleWeights: JSON.stringify(payload.roleWeights || DEFAULT_ROLE_WEIGHTS_),
  };

  Object.keys(entries).forEach((key) => setSettingValue_(sheet, key, entries[key]));
  return { saved: true };
}

function setSettingValue_(sheet, key, value) {
  const rowNum = findRowNumberById_(sheet, 'Key', key);
  if (rowNum === -1) {
    appendObjectRow_(sheet, { Key: key, Value: value });
  } else {
    updateRowFromObject_(sheet, rowNum, { Key: key, Value: value });
  }
}
