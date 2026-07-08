# Vromonkonna Finance Suite

Production web app for managing the finances of a travel organization in Bangladesh.

**Stack:** HTML5, CSS3, Vanilla JS (ES6 modules), Chart.js, Google Apps Script (backend), Google Sheets (database), GitHub Pages (hosting).

## Status: Step 10 of the build plan — live API wired in

The app is no longer running on mock data or localStorage. Every page now
talks to a real Google Apps Script backend (see `apps-script/`), which
reads/writes a Google Sheet.

**Before this works for you**, update `js/modules/config.js` with your own
deployed Apps Script Web App URL (see `apps-script/README.md` for the full
deployment walkthrough).

Delivered so far:
- [x] Step 1–8: Foundation, calculation engine, New Trip, Trip History, Participants, Funds, Reports, Settings — all built against mock/local data first, then verified with widgets/mockups before committing to each design.
- [x] Step 9: Google Sheets schema (7 tabs) + Apps Script REST API (`apps-script/`), deployed as a Web App.
- [x] Step 10: Every page (`js/dashboard.js`, `js/new-trip.js`, `js/trip-history.js`, `js/participants.js`, `js/funds.js`, `js/reports.js`, `js/settings.js`) now fetches from and writes to that real API instead of mock data/localStorage.

**Resilience note:** `js/modules/trips-store.js`, `host-directory.js`, `settings-store.js`, and `expense-category-store.js` each fall back to a cached/bundled copy (with a console warning) if the API is briefly unreachable, so the app degrades gracefully rather than breaking outright. This is NOT a substitute for the Sheet being online — it's just so a flaky connection doesn't produce a blank page.

## Folder structure

```
vromonkonna-finance-suite/
├── index.html                 # Dashboard (landing page)
├── apps-script/                # Backend: Apps Script + Sheets schema + deployment guide
│   ├── Code.gs                 # doGet/doPost routers
│   ├── SheetHelpers.gs          # Generic row<->object helpers
│   ├── TripsApi.gs / HostsApi.gs / SettingsApi.gs / ExpenseCategoriesApi.gs / FundsApi.gs
│   ├── SetupSheets.gs            # One-time tab + header creation
│   └── README.md                  # Deployment steps + API reference
├── css/                        # variables, base, layout, sidebar, components, + one file per page
├── components/                 # Reusable UI: sidebar, topbar, stat-card, participant/expense rows,
│                                #   live-summary-panel, confirm-dialog, form-modal
├── js/
│   ├── app.js                   # initShell(), showToast() — shared by every page
│   ├── dashboard.js / new-trip.js / trip-history.js / participants.js / funds.js / reports.js / settings.js
│   ├── modules/
│   │   ├── calculations.js        # Pure financial calculation engine (unit-tested)
│   │   ├── config.js                # <- your deployed Apps Script Web App URL goes here
│   │   ├── api-client.js             # apiGet()/apiPost() — the only place fetch() is called
│   │   ├── trips-store.js             # Trips: fetch/save/delete (API-backed, mock fallback)
│   │   ├── host-directory.js           # Hosts (API-backed)
│   │   ├── settings-store.js            # Org settings (API-backed)
│   │   ├── expense-category-store.js     # Expense categories (API-backed)
│   │   ├── fund-ledger.js                 # Fund ledgers (API-backed)
│   │   ├── trip-utils.js, report-utils.js, participant-utils.js  # Pure aggregation/search/sort helpers
│   │   └── export-utils.js                 # CSV/PDF/Excel export
│   ├── data/mock-trips.js        # Bundled demo dataset — used only as an offline fallback now
│   └── utils/format.js            # formatBDT(), formatNumber(), formatPercent()
├── pages/                     # new-trip, trip-history, participants, funds, reports, settings
└── assets/icons/
```

## Running locally

Any static file server works, e.g.:

```bash
cd vromonkonna-finance-suite
python3 -m http.server 8080
# then open http://localhost:8080
```

## Next steps

1. Deploy to GitHub Pages so the app has a real public URL (Step 12 of the original plan).
2. Optional polish pass: loading skeletons while API calls are in flight, retry buttons on failed requests, and a "server-side recompute" option for `saveTrip` if you ever want the backend to distrust client-sent financials (see the design note in `apps-script/README.md`).

