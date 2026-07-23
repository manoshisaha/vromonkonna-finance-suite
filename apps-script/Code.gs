/**
 * Code.gs
 *
 * Entry points for the Vromonkonna Finance Suite backend, deployed as a
 * Google Apps Script Web App bound to the Google Sheet that stores all
 * data (see SetupSheets.gs for the schema).
 *
 * Routing convention (kept deliberately simple — Apps Script web apps
 * only support GET/POST, not PUT/DELETE):
 *   GET  ?resource=<name>[&id=...][&fundType=...]   -> reads
 *   POST { action: '<name>', ...payload }            -> writes
 *
 * IMPORTANT — CORS note: the frontend must POST with
 * Content-Type: text/plain;charset=utf-8 (NOT application/json). Apps
 * Script does not implement a doOptions() CORS preflight handler, so a
 * JSON content-type would trigger a browser preflight request that Apps
 * Script can't answer. Sending as text/plain keeps the request "simple"
 * (no preflight) while the body itself is still JSON text, parsed below
 * via JSON.parse(e.postData.contents).
 *
 * SECURITY NOTE: every request must include a matching API key (GET:
 * ?key=..., POST: { apiKey: ... }), checked in isAuthorized_() below
 * against the API_KEY script property. Set that property once by running
 * Security.gs's setApiKey(). This is a shared-secret check, not real
 * per-user authentication — anyone with the key has full access — but it
 * stops the API from being casually discoverable/callable by anyone who
 * finds the public deployment URL.
 */

function doGet(e) {
  try {
    if (!isAuthorized_(e.parameter.key)) {
      return jsonResponse_({ success: false, error: 'Unauthorized' });
    }

    const resource = e.parameter.resource;
    let data;

    switch (resource) {
      case 'trips':
        data = e.parameter.id ? getTrip(e.parameter.id) : listTrips();
        break;
      case 'hosts':
        data = listHosts();
        break;
      case 'settings':
        data = getSettings();
        break;
      case 'expenseCategories':
        data = listExpenseCategories();
        break;
      case 'funds':
        if (!e.parameter.fundType) throw new Error('fundType query parameter is required');
        data = getFundLedger(e.parameter.fundType);
        break;
      case 'initiatives':
        data = listInitiativeEntries();
        break;
      default:
        throw new Error('Unknown resource: ' + resource);
    }

    return jsonResponse_({ success: true, data: data });
  } catch (err) {
    return jsonResponse_({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (!isAuthorized_(body.apiKey)) {
      return jsonResponse_({ success: false, error: 'Unauthorized' });
    }

    const action = body.action;
    let data;

    switch (action) {
      case 'saveTrip':
        data = saveTrip(body.payload);
        break;
      case 'deleteTrip':
        data = deleteTrip(body.tripId);
        break;
      case 'addHost':
        data = addHost(body.payload);
        break;
      case 'updateHost':
        data = updateHost(body.hostId, body.updates);
        break;
      case 'deleteHost':
        data = deleteHost(body.hostId);
        break;
      case 'saveSettings':
        data = saveSettings(body.payload);
        break;
      case 'addExpenseCategory':
        data = addExpenseCategory(body.name);
        break;
      case 'removeExpenseCategory':
        data = removeExpenseCategory(body.name);
        break;
      case 'addFundEntry':
        data = addFundEntry(body.fundType, body.entry);
        break;
      case 'deleteFundEntry':
        data = deleteFundEntry(body.entryId);
        break;
      case 'addInitiativeEntry':
        data = addInitiativeEntry(body.payload);
        break;
      case 'deleteInitiativeEntry':
        data = deleteInitiativeEntry(body.entryId);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }

    return jsonResponse_({ success: true, data: data });
  } catch (err) {
    return jsonResponse_({ success: false, error: err.message });
  }
}

/**
 * Checks a request-supplied key against the API_KEY script property (set
 * once via Security.gs's setApiKey()). Requests without a matching key
 * are rejected before touching any sheet data.
 */
function isAuthorized_(providedKey) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_KEY');
  return !!expected && providedKey === expected;
}

/** Wraps a plain object as a JSON web app response. */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
