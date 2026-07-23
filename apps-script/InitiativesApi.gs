/**
 * InitiativesApi.gs
 *
 * Tracks credit/debit entries for activities OUTSIDE the trip system —
 * e.g. Shikkhon (training, dorm, etc.) or any other side initiative the
 * organization runs. Deliberately simple: one flat list of entries, each
 * tagged with an Initiative name so multiple activities can be tracked
 * side by side and filtered independently on the frontend.
 */

const INITIATIVES_SHEET = 'Initiatives';

function listInitiativeEntries() {
  const rows = sheetToObjects_(getSheet_(INITIATIVES_SHEET));
  return rows
    .map((r) => ({
      id: r.EntryID,
      date: formatDate_(r.Date),
      initiativeName: r.InitiativeName,
      entryType: r.EntryType, // 'Credit' | 'Debit'
      amount: r.Amount,
      description: r.Description,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function addInitiativeEntry(payload) {
  const sheet = getSheet_(INITIATIVES_SHEET);
  appendObjectRow_(sheet, {
    EntryID: Utilities.getUuid(),
    Date: payload.date,
    InitiativeName: payload.initiativeName,
    EntryType: payload.entryType,
    Amount: payload.amount,
    Description: payload.description || '',
  });
  return { saved: true };
}

function deleteInitiativeEntry(entryId) {
  deleteRowsWhere_(getSheet_(INITIATIVES_SHEET), 'EntryID', entryId);
  return { deleted: true };
}
