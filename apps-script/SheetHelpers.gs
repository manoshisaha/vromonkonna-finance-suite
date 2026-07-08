/**
 * SheetHelpers.gs
 *
 * Generic, resource-agnostic helpers for reading/writing rows as plain
 * objects keyed by header name. Every *Api.gs file builds on these
 * instead of touching Range/getValues directly, so the row <-> object
 * mapping logic exists in exactly one place.
 */

/** Returns the sheet by name, bound to the script's parent spreadsheet. */
function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

/**
 * Reads every data row (skipping the header) as an array of plain
 * objects keyed by column header. Blank trailing rows are skipped.
 */
function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  return values.slice(1)
    .filter((row) => row.some((cell) => cell !== '' && cell !== null))
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

/** Appends a new row built from an object, in header-column order. */
function appendObjectRow_(sheet, obj) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ''));
  sheet.appendRow(row);
}

/**
 * Finds the 1-indexed sheet row number for a given id value in idColumn.
 * Returns -1 if not found.
 */
function findRowNumberById_(sheet, idColumn, idValue) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf(idColumn);
  if (idIndex === -1) throw new Error('Column not found: ' + idColumn);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(idValue)) return i + 1;
  }
  return -1;
}

/** Overwrites an existing row (by 1-indexed row number) from an object. */
function updateRowFromObject_(sheet, rowNumber, obj) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ''));
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
}

/** Deletes every row where matchColumn equals matchValue (bottom-up, safe while iterating). */
function deleteRowsWhere_(sheet, matchColumn, matchValue) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const colIndex = headers.indexOf(matchColumn);
  if (colIndex === -1) return;

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][colIndex]) === String(matchValue)) {
      sheet.deleteRow(i + 1);
    }
  }
}

/** Formats a Sheets Date cell (or passes through a string) as 'yyyy-MM-dd'. */
function formatDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}
