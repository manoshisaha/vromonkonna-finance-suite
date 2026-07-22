/**
 * SetupSheets.gs
 *
 * Run setupSheets() ONCE, manually, from the Apps Script editor (select
 * the function from the dropdown next to "Run", then click Run) right
 * after creating a new Google Sheet and pasting these scripts into it.
 * It creates every tab with the correct header row and seeds the 12
 * built-in expense categories. Safe to re-run — it won't duplicate
 * existing sheets or duplicate the seeded categories.
 */

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheetWithHeaders_(ss, 'Trips', [
    'TripID', 'TripName', 'Destination', 'TripDate', 'TripEndDate', 'TripType', 'TripDuration',
    'PackagePrice', 'MaxParticipants', 'OtherIncome', 'Status', 'Notes',
    'HostBudget', 'LeadHostName', 'LeadHostTierSnapshot',
    'ForeignHostBaseAmount', 'ForeignHostRatePerParticipant',
    // Snapshot of every settings-dependent result, frozen at the moment
    // the trip is saved. Income/Expenses/GrossProfit aren't included here
    // because they only depend on the trip's own numbers (participants,
    // package price, expenses) — never on Settings — so they're always
    // safe to recompute fresh. These five ARE settings-dependent (T-shirt
    // price, host tiers, Social Fund %), so without freezing them, editing
    // Settings later would silently change how old trips display. See
    // trip-utils.js's enrichTripWithFinancials() for how this is used.
    'TshirtFundSnapshot', 'AdjustedProfitSnapshot', 'RemainingSnapshot',
    'SocialMediaFundSnapshot', 'OrganizationProfitSnapshot',
    // Legacy columns kept for backward compatibility with trips saved before
    // multi-host support existed — new saves leave these blank and use
    // TripHosts instead. See TripsApi.gs's listTrips() fallback logic.
    'HostName', 'HostLifetimeTripCountAtBooking',
  ]);

  createSheetWithHeaders_(ss, 'TripHosts', [
    'TripHostID', 'TripID', 'HostName', 'Role', 'RoleWeightSnapshot',
    'LifetimeTripCountSnapshot', 'Amount',
  ]);

  createSheetWithHeaders_(ss, 'Participants', [
    'ParticipantID', 'TripID', 'Name', 'Phone', 'PaymentMode',
    'PaidAmount', 'DueAmount', 'PaymentStatus',
  ]);

  createSheetWithHeaders_(ss, 'Expenses', [
    'ExpenseID', 'TripID', 'Category', 'Amount', 'Note',
  ]);

  createSheetWithHeaders_(ss, 'Funds', [
    'EntryID', 'TripID', 'FundType', 'Date', 'Description', 'EntryType', 'Amount',
  ]);

  createSheetWithHeaders_(ss, 'Hosts', [
    'HostID', 'Name', 'LifetimeTripCount',
  ]);

  createSheetWithHeaders_(ss, 'Settings', [
    'Key', 'Value',
  ]);

  createSheetWithHeaders_(ss, 'ExpenseCategories', [
    'CategoryName', 'IsBuiltIn',
  ]);

  seedDefaultExpenseCategories_(ss);
  removeDefaultBlankSheet_(ss);

  Logger.log('Sheets setup complete: Trips, Participants, Expenses, Funds, Hosts, Settings, ExpenseCategories.');
}

function createSheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function seedDefaultExpenseCategories_(ss) {
  const defaults = [
    'Going Transport', 'Return Transport', 'Breakfast', 'Lunch', 'Dinner',
    'Hotel', 'Guide', 'Tips', 'Snacks', 'Tickets', 'Emergency', 'Miscellaneous',
  ];
  const sheet = ss.getSheetByName('ExpenseCategories');
  if (sheet.getLastRow() > 1) return; // already seeded

  defaults.forEach((category) => sheet.appendRow([category, true]));
}

function removeDefaultBlankSheet_(ss) {
  const blankSheet = ss.getSheetByName('Sheet1');
  if (blankSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(blankSheet);
  }
}
