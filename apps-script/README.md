# Vromonkonna Finance Suite — Backend (Google Apps Script + Google Sheets)

This folder is the entire backend: a REST-style API written in Google Apps
Script, backed by a Google Sheet acting as the database. No servers, no
paid services — everything runs on Google's infrastructure for free.

## 1. Create the spreadsheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it something like "Vromonkonna Finance Suite — Database".

## 2. Add the Apps Script project

1. In the spreadsheet, go to **Extensions → Apps Script**. This opens a script editor bound to the sheet.
2. Delete the default empty `Code.gs` content.
3. For each file in this folder (`Code.gs`, `SheetHelpers.gs`, `TripsApi.gs`, `HostsApi.gs`, `SettingsApi.gs`, `ExpenseCategoriesApi.gs`, `FundsApi.gs`, `SetupSheets.gs`):
   - Click the **+** next to "Files" → **Script**.
   - Name it exactly as the filename (without `.gs` — Apps Script adds that automatically).
   - Paste in the matching file's contents.
4. Save the project (`Ctrl+S` / `Cmd+S`).

## 3. Set the API key (do this before deploying)

The API rejects any request that doesn't include a matching secret key —
this stops the API from being casually discoverable by anyone who finds
your public deployment URL.

1. Add one more script file: **+ → Script**, name it `Security`, paste in `Security.gs`'s contents.
2. In `js/modules/config.js` on the frontend, note the `API_KEY` value — `Security.gs` already has that exact same key pre-filled, so they match by default. (If you ever want to rotate the key, generate a new random string, update it in **both** places, and redeploy.)
3. Select `setApiKey` from the function dropdown and click **Run**. Authorize if prompted.
4. This stores the key as a script property (not visible in the source code itself).

## 4. Run the one-time sheet setup

1. In the script editor toolbar, select `setupSheets` from the function dropdown (next to the Run button).
2. Click **Run**.
3. The first time, Google will ask you to authorize the script — click through the consent screens (you'll see an "unverified app" warning since this is your own script; click **Advanced → Go to (project name)** to proceed).
4. Check the spreadsheet — you should now see 7 tabs: `Trips`, `Participants`, `Expenses`, `Funds`, `Hosts`, `Settings`, `ExpenseCategories`, each with header rows, and `ExpenseCategories` pre-filled with the 12 built-in categories.

## 5. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Settings:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**, authorize again if prompted.
5. Copy the **Web app URL** — this is your API base URL, something like:
   `https://script.google.com/macros/s/AKfycb.../exec`

Keep this URL — it's what the frontend's `js/modules/api-client.js` (built in the next step) will call.

## 6. Redeploying after changes

Every time you edit any `.gs` file, you must create a **new version** for the live URL to reflect it:
- **Deploy → Manage deployments** → pencil icon on the existing deployment → **Version: New version** → **Deploy**.
- Editing files and saving alone does NOT update the live web app URL.

## API reference

All responses are JSON: `{ "success": true, "data": ... }` or `{ "success": false, "error": "message" }`.

### Reads (GET)

| Request | Returns |
|---|---|
| `?resource=trips` | Array of all trips, each with nested `participants[]` and `expenses[]` — same shape as `js/data/mock-trips.js` |
| `?resource=trips&id=<tripId>` | A single trip object |
| `?resource=hosts` | Array of `{ id, name, lifetimeTripCount }` |
| `?resource=settings` | Settings object (org info, pricing, host tiers) |
| `?resource=expenseCategories` | Array of category name strings |
| `?resource=funds&fundType=<SocialMediaFund\|TshirtFund\|OrganizationProfit>` | `{ entries: [...], currentBalance }` |

### Writes (POST)

**Important**: send with `Content-Type: text/plain;charset=utf-8`, not `application/json` — see the CORS note at the top of `Code.gs` for why. The body is still JSON text; the server parses it manually.

| `action` | Body | Effect |
|---|---|---|
| `saveTrip` | `{ action, payload }` | Creates a trip (omit `payload.tripId`) or updates one (include it). `payload` matches New Trip's save payload, plus a `financials` object (the calculated results) so fund contributions can be recorded. Creating a trip also increments the host's lifetime trip count. |
| `deleteTrip` | `{ action, tripId }` | Deletes a trip and all its participants/expenses/fund contributions. |
| `addHost` | `{ action, payload: { name, lifetimeTripCount } }` | Adds a host. |
| `updateHost` | `{ action, hostId, updates }` | Updates a host's name/count. |
| `deleteHost` | `{ action, hostId }` | Removes a host. |
| `saveSettings` | `{ action, payload }` | Overwrites all settings. |
| `addExpenseCategory` | `{ action, name }` | Adds a custom category. |
| `removeExpenseCategory` | `{ action, name }` | Removes a custom category (built-ins are protected). |
| `addFundEntry` | `{ action, fundType, entry: { date, description, amount, type } }` | Adds a manual withdrawal/adjustment. |
| `deleteFundEntry` | `{ action, entryId }` | Removes a manual entry. |

## Design notes

- **Why no separate "Reports" sheet**: every report (by month/year/destination/host) is fully derivable from Trips + Participants + Expenses. Storing a separate copy would risk it drifting out of sync with the source data.
- **Why `saveTrip` trusts the client's `financials`**: the calculation formulas (host tiers, T-shirt fund, etc.) already live in exactly one place — `js/modules/calculations.js` on the frontend. Re-implementing them here would create a second copy of the same business logic that could drift. If stronger guarantees against a tampered client are ever needed, port `calculations.js`'s logic into `TripsApi.gs` and recompute server-side instead of trusting the payload.
- **Why Settings is Key/Value rows instead of one wide row**: adding a new setting later is just a new row, not a schema migration.
