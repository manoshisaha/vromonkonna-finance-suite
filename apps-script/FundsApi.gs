/**
 * FundsApi.gs
 *
 * Funds resource: reads the Funds sheet (populated automatically by
 * saveTrip()'s contribution rows, plus manual withdrawal/adjustment rows
 * added here), and computes a running balance per fund — matching
 * js/modules/fund-ledger.js's buildLedger() output shape exactly.
 */

const FUNDS_SHEET = 'Funds';

/**
 * Returns the full ledger for one fund (contributions + manual entries),
 * sorted chronologically with a running balance per row.
 * @param {string} fundType - 'SocialMediaFund' | 'TshirtFund' | 'OrganizationProfit'
 */
function getFundLedger(fundType) {
  const entries = sheetToObjects_(getSheet_(FUNDS_SHEET))
    .filter((e) => e.FundType === fundType)
    .sort((a, b) => new Date(a.Date) - new Date(b.Date));

  let balance = 0;
  const withBalance = entries.map((e) => {
    const signedAmount = e.EntryType === 'Withdrawal' ? -Math.abs(e.Amount) : Number(e.Amount);
    balance += signedAmount;
    return {
      id: e.EntryID,
      tripId: e.TripID,
      date: formatDate_(e.Date),
      description: e.Description,
      type: String(e.EntryType).toLowerCase(),
      amount: signedAmount,
      balance: balance,
    };
  });

  return { entries: withBalance, currentBalance: balance };
}

/**
 * Adds a manual withdrawal/adjustment entry for a fund. `entry.amount`
 * should be a positive number — it is stored/negated the same way
 * js/modules/fund-ledger.js's addManualEntry() does.
 */
function addFundEntry(fundType, entry) {
  const sheet = getSheet_(FUNDS_SHEET);
  const entryId = Utilities.getUuid();

  appendObjectRow_(sheet, {
    EntryID: entryId,
    TripID: '',
    FundType: fundType,
    Date: entry.date,
    Description: entry.description,
    EntryType: entry.type || 'Withdrawal',
    Amount: Math.abs(entry.amount),
  });

  return { id: entryId };
}

/** Deletes a manual entry by id. Contribution rows can be deleted the same way if ever needed. */
function deleteFundEntry(entryId) {
  deleteRowsWhere_(getSheet_(FUNDS_SHEET), 'EntryID', entryId);
  return { deleted: true };
}
