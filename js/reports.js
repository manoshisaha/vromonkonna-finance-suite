/**
 * js/reports.js
 *
 * Page controller for pages/reports.html.
 *
 * Defaults to the current month's summary on load. Switching "Report by"
 * (Month/Year/Destination/Host) swaps the second filter control to match,
 * and re-populates its options from the actual trip data.
 */

import { initShell, showToast } from './app.js';
import { fetchTrips } from './modules/trips-store.js';
import { getCalculationSettings } from './modules/settings-store.js';
import { enrichTripWithFinancials, uniqueValues, uniqueHostNames } from './modules/trip-utils.js';
import { filterTripsByReport, summarizeTrips, calculateHostEarnings, getAvailableYears, getCurrentMonthValue } from './modules/report-utils.js';
import { exportTripsCSV, exportTripsExcel, exportTripsPDF } from './modules/export-utils.js';
import { renderStatCards } from '../components/stat-card.js';
import { formatBDT, formatNumber } from './utils/format.js';

initShell({
  activeNavId: 'reports',
  title: 'Reports',
  basePath: '../',
});

const reportTypeSelect = document.getElementById('report-type');
const reportValueField = document.getElementById('report-value-field');
const summaryGrid = document.getElementById('report-summary-grid');
const tableBody = document.getElementById('report-table-body');
const emptyState = document.getElementById('report-empty');

let trips = [];
let currentReport = { type: 'month', value: getCurrentMonthValue() };

function renderValueControl() {
  const type = reportTypeSelect.value;

  if (type === 'month') {
    reportValueField.innerHTML = `
      <label class="field__label" for="report-value">Month</label>
      <input class="field__control" type="month" id="report-value" value="${currentReport.value}" />
    `;
  } else if (type === 'year') {
    const years = getAvailableYears(trips);
    reportValueField.innerHTML = `
      <label class="field__label" for="report-value">Year</label>
      <select class="field__control" id="report-value">
        ${years.map((y) => `<option value="${y}" ${String(y) === currentReport.value ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
    `;
  } else if (type === 'destination') {
    const destinations = uniqueValues(trips, 'destination');
    reportValueField.innerHTML = `
      <label class="field__label" for="report-value">Destination</label>
      <select class="field__control" id="report-value">
        ${destinations.map((d) => `<option value="${d}" ${d === currentReport.value ? 'selected' : ''}>${d}</option>`).join('')}
      </select>
    `;
  } else if (type === 'host') {
    const hosts = uniqueHostNames(trips);
    reportValueField.innerHTML = `
      <label class="field__label" for="report-value">Host</label>
      <select class="field__control" id="report-value">
        ${hosts.map((h) => `<option value="${h}" ${h === currentReport.value ? 'selected' : ''}>${h}</option>`).join('')}
      </select>
    `;
  }

  document.getElementById('report-value').addEventListener('change', (e) => {
    currentReport = { type, value: e.target.value };
    render();
  });
  document.getElementById('report-value').addEventListener('input', (e) => {
    currentReport = { type, value: e.target.value };
    render();
  });
}

function getFilteredTrips() {
  return filterTripsByReport(trips, currentReport);
}

function renderSummary(filtered) {
  const summary = summarizeTrips(filtered);
  const cards = [
    { label: 'Total trips', value: formatNumber(summary.totalTrips), iconKey: 'trips', tint: 'accent' },
    { label: 'Income', value: formatBDT(summary.income), iconKey: 'revenue', tint: 'success' },
    { label: 'Expenses', value: formatBDT(summary.totalExpenses), iconKey: 'expense', tint: 'danger' },
    { label: 'Gross profit', value: formatBDT(summary.grossProfit), iconKey: 'profit', tint: 'info' },
    { label: 'T-shirt fund', value: formatBDT(summary.tshirtFund), iconKey: 'shirt', tint: 'warning' },
  ];

  if (currentReport.type === 'host' && currentReport.value) {
    const earnings = calculateHostEarnings(filtered, currentReport.value);
    cards.push({ label: `${currentReport.value}'s earnings`, value: formatBDT(earnings.totalEarned), iconKey: 'host', tint: 'success' });
  } else {
    cards.push({ label: 'Host budget (total)', value: formatBDT(summary.hostPayment), iconKey: 'host', tint: 'success' });
  }

  cards.push(
    { label: 'Social media fund', value: formatBDT(summary.socialMediaFund), iconKey: 'megaphone', tint: 'info' },
    { label: 'Organization profit', value: formatBDT(summary.organizationProfit), iconKey: 'wallet', tint: 'accent' },
  );

  renderStatCards(summaryGrid, cards);
}

function statusBadgeClass(status) {
  if (status === 'Completed') return 'badge-success';
  if (status === 'Upcoming') return 'badge-info';
  return 'badge-danger';
}

function renderTable(filtered) {
  tableBody.innerHTML = filtered.map((t) => `
    <tr>
      <td>${escapeHtml(t.tripName)}</td>
      <td>${escapeHtml(t.destination)}</td>
      <td>${escapeHtml(t.hostDisplay)}</td>
      <td>${formatDate(t.tripDate)}</td>
      <td>${formatNumber(t.participantCount)}</td>
      <td><span class="badge ${statusBadgeClass(t.status)}">${t.status}</span></td>
      <td>${formatBDT(t.financials.income)}</td>
      <td>${formatBDT(t.financials.organizationProfit)}</td>
    </tr>
  `).join('');

  emptyState.hidden = filtered.length > 0;
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function reportTitle() {
  const labels = { month: 'Month', year: 'Year', destination: 'Destination', host: 'Host' };
  return `Report by ${labels[currentReport.type]}: ${currentReport.value}`;
}

function render() {
  const filtered = getFilteredTrips();
  renderSummary(filtered);
  renderTable(filtered);
}

reportTypeSelect.addEventListener('change', () => {
  const type = reportTypeSelect.value;
  let defaultValue = '';
  if (type === 'month') defaultValue = getCurrentMonthValue();
  else if (type === 'year') defaultValue = String(getAvailableYears(trips)[0] || '');
  else if (type === 'destination') defaultValue = uniqueValues(trips, 'destination')[0] || '';
  else if (type === 'host') defaultValue = uniqueHostNames(trips)[0] || '';

  currentReport = { type, value: defaultValue };
  renderValueControl();
  render();
});

/** ---------- Exports ---------- */

document.getElementById('export-csv-btn').addEventListener('click', () => {
  const filtered = getFilteredTrips();
  if (!filtered.length) return showToast('No trips to export', 'warning');
  exportTripsCSV(filtered, `vromonkonna-report-${currentReport.type}-${currentReport.value}.csv`);
  showToast('CSV exported', 'success');
});

document.getElementById('export-excel-btn').addEventListener('click', () => {
  const filtered = getFilteredTrips();
  if (!filtered.length) return showToast('No trips to export', 'warning');
  try {
    exportTripsExcel(filtered, `vromonkonna-report-${currentReport.type}-${currentReport.value}.xlsx`);
    showToast('Excel file exported', 'success');
  } catch (err) {
    console.error(err);
    showToast('Excel export failed to load — check your connection', 'danger');
  }
});

document.getElementById('export-pdf-btn').addEventListener('click', () => {
  const filtered = getFilteredTrips();
  if (!filtered.length) return showToast('No trips to export', 'warning');
  try {
    exportTripsPDF(
      { title: reportTitle(), summary: summarizeTrips(filtered), trips: filtered },
      `vromonkonna-report-${currentReport.type}-${currentReport.value}.pdf`
    );
    showToast('PDF exported', 'success');
  } catch (err) {
    console.error(err);
    showToast('PDF export failed to load — check your connection', 'danger');
  }
});

/** ---------- Init ---------- */

async function init() {
  try {
    const [rawTrips, calcSettings] = await Promise.all([fetchTrips(), getCalculationSettings()]);
    trips = rawTrips.map((trip) => enrichTripWithFinancials(trip, calcSettings));
    renderValueControl();
    render();
  } catch (err) {
    console.error(err);
    showToast('Failed to load reports', 'danger');
  }
}

init();
