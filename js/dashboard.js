/**
 * js/dashboard.js
 *
 * Page controller for index.html (Dashboard).
 *
 * Loads real trips from the API (js/modules/trips-store.js) and computes
 * every KPI card and chart from that data, using the same calculation
 * engine and aggregation helpers as Trip History, Reports, and Funds —
 * no hardcoded numbers.
 */

import { initShell, showToast } from './app.js';
import { renderStatCards } from '../components/stat-card.js';
import { formatBDT, formatNumber } from './utils/format.js';
import { fetchTrips } from './modules/trips-store.js';
import { getCalculationSettings } from './modules/settings-store.js';
import { enrichTripWithFinancials } from './modules/trip-utils.js';
import { summarizeTrips, groupTripsByMonth, groupExpensesByCategory, topDestinationsByProfit } from './modules/report-utils.js';

initShell({
  activeNavId: 'dashboard',
  title: 'Dashboard',
});

async function loadDashboardData() {
  const [rawTrips, calcSettings] = await Promise.all([fetchTrips(), getCalculationSettings()]);
  const trips = rawTrips.map((trip) => enrichTripWithFinancials(trip, calcSettings));

  return {
    totals: summarizeTrips(trips),
    revenueByMonth: groupTripsByMonth(trips, 'income'),
    profitByMonth: groupTripsByMonth(trips, 'organizationProfit'),
    expenseCategories: groupExpensesByCategory(trips),
    topDestinations: topDestinationsByProfit(trips, 5),
  };
}

function buildStatCards(totals) {
  return [
    { label: 'Total Trips', value: formatNumber(totals.totalTrips), iconKey: 'trips', tint: 'accent' },
    { label: 'Total Revenue', value: formatBDT(totals.income), iconKey: 'revenue', tint: 'success' },
    { label: 'Total Expenses', value: formatBDT(totals.totalExpenses), iconKey: 'expense', tint: 'danger' },
    { label: 'Gross Profit', value: formatBDT(totals.grossProfit), iconKey: 'profit', tint: 'info' },
    { label: 'Organization Profit', value: formatBDT(totals.organizationProfit), iconKey: 'wallet', tint: 'accent' },
    { label: 'Social Media Fund', value: formatBDT(totals.socialMediaFund), iconKey: 'megaphone', tint: 'info' },
    { label: 'T-shirt Fund', value: formatBDT(totals.tshirtFund), iconKey: 'shirt', tint: 'warning' },
    { label: 'Host Payments', value: formatBDT(totals.hostPayment), iconKey: 'host', tint: 'success' },
  ];
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderCharts(data) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js failed to load; skipping chart rendering.');
    return;
  }

  const accent = cssVar('--color-accent') || '#5b5bf6';
  const success = cssVar('--color-success') || '#12a454';
  const info = cssVar('--color-info') || '#2f7de1';
  const warning = cssVar('--color-warning') || '#d78c1f';
  const gridColor = cssVar('--color-border') || '#e5e7eb';
  const textColor = cssVar('--color-text-secondary') || '#565a66';

  const sharedScales = {
    x: { grid: { display: false }, ticks: { color: textColor } },
    y: { grid: { color: gridColor }, ticks: { color: textColor } },
  };

  new Chart(document.getElementById('chart-revenue-by-month'), {
    type: 'line',
    data: {
      labels: data.revenueByMonth.labels,
      datasets: [{
        label: 'Revenue',
        data: data.revenueByMonth.values,
        borderColor: accent,
        backgroundColor: hexToRgba(accent, 0.12),
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: sharedScales,
    },
  });

  new Chart(document.getElementById('chart-profit-by-month'), {
    type: 'bar',
    data: {
      labels: data.profitByMonth.labels,
      datasets: [{
        label: 'Profit',
        data: data.profitByMonth.values,
        backgroundColor: success,
        borderRadius: 6,
        maxBarThickness: 36,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: sharedScales,
    },
  });

  new Chart(document.getElementById('chart-expense-categories'), {
    type: 'doughnut',
    data: {
      labels: data.expenseCategories.labels,
      datasets: [{
        data: data.expenseCategories.values,
        backgroundColor: [accent, success, info, warning, '#8a8f9c', '#e0463f', '#7c7cf9', '#2fd57e'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, padding: 12 } } },
    },
  });

  new Chart(document.getElementById('chart-top-destinations'), {
    type: 'bar',
    data: {
      labels: data.topDestinations.labels,
      datasets: [{
        label: 'Organization Profit',
        data: data.topDestinations.values,
        backgroundColor: info,
        borderRadius: 6,
        maxBarThickness: 28,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { display: false }, ticks: { color: textColor } },
      },
    },
  });
}

async function init() {
  try {
    const data = await loadDashboardData();
    renderStatCards(document.getElementById('stat-grid'), buildStatCards(data.totals));

    if (typeof Chart === 'undefined') {
      window.addEventListener('load', () => renderCharts(data));
    } else {
      renderCharts(data);
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to load dashboard data', 'danger');
  }
}

init();
