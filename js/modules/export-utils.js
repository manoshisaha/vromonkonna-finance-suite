/**
 * js/modules/export-utils.js
 *
 * Client-side export helpers for the Reports page. No server, no paid
 * services — CSV is hand-built, PDF uses jsPDF, Excel uses SheetJS, both
 * loaded via CDN <script> tags in reports.html (window.jspdf / window.XLSX).
 */

/**
 * Triggers a browser download for a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Builds a CSV string from trip rows and triggers a download.
 * @param {Object[]} trips - enriched trips (with `.financials`)
 * @param {string} filename
 */
export function exportTripsCSV(trips, filename = 'vromonkonna-report.csv') {
  const headers = [
    'Trip Name', 'Destination', 'Host', 'Date', 'Status', 'Participants',
    'Income', 'Expenses', 'Gross Profit', 'T-shirt Fund', 'Host Payment',
    'Social Media Fund', 'Organization Profit',
  ];

  const rows = trips.map((t) => [
    t.tripName, t.destination, t.hostName, t.tripDate, t.status, t.participantCount,
    t.financials.income, t.financials.totalExpenses, t.financials.grossProfit,
    t.financials.tshirtFund, t.financials.hostPayment, t.financials.socialMediaFund,
    t.financials.organizationProfit,
  ]);

  const csvLines = [headers, ...rows].map((row) =>
    row.map((cell) => csvEscape(cell)).join(',')
  );

  const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds an .xlsx workbook from trip rows using SheetJS and triggers a download.
 * Requires the SheetJS UMD bundle to be loaded as the global `XLSX`.
 * @param {Object[]} trips
 * @param {string} filename
 */
export function exportTripsExcel(trips, filename = 'vromonkonna-report.xlsx') {
  if (typeof XLSX === 'undefined') {
    throw new Error('SheetJS (XLSX) failed to load.');
  }

  const rows = trips.map((t) => ({
    'Trip Name': t.tripName,
    'Destination': t.destination,
    'Host': t.hostName,
    'Date': t.tripDate,
    'Status': t.status,
    'Participants': t.participantCount,
    'Income': t.financials.income,
    'Expenses': t.financials.totalExpenses,
    'Gross Profit': t.financials.grossProfit,
    'T-shirt Fund': t.financials.tshirtFund,
    'Host Payment': t.financials.hostPayment,
    'Social Media Fund': t.financials.socialMediaFund,
    'Organization Profit': t.financials.organizationProfit,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, filename);
}

/**
 * Builds a simple PDF report (summary + trip table) using jsPDF and
 * triggers a download. Requires the jsPDF UMD bundle to be loaded as the
 * global `window.jspdf.jsPDF`.
 * @param {{ title: string, summary: Object, trips: Object[] }} config
 * @param {string} filename
 */
export function exportTripsPDF({ title, summary, trips }, filename = 'vromonkonna-report.pdf') {
  if (typeof window.jspdf === 'undefined') {
    throw new Error('jsPDF failed to load.');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 50;

  doc.setFontSize(16);
  doc.text(title, marginX, y);
  y += 24;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, marginX, y);
  y += 24;

  doc.setTextColor(20);
  doc.setFontSize(12);
  doc.text('Summary', marginX, y);
  y += 16;

  doc.setFontSize(10);
  const summaryLines = [
    ['Total trips', String(summary.totalTrips)],
    ['Income', formatMoney(summary.income)],
    ['Expenses', formatMoney(summary.totalExpenses)],
    ['Gross profit', formatMoney(summary.grossProfit)],
    ['T-shirt fund', formatMoney(summary.tshirtFund)],
    ['Host payments', formatMoney(summary.hostPayment)],
    ['Social media fund', formatMoney(summary.socialMediaFund)],
    ['Organization profit', formatMoney(summary.organizationProfit)],
  ];
  summaryLines.forEach(([label, value]) => {
    doc.text(label, marginX, y);
    doc.text(value, marginX + 180, y);
    y += 15;
  });

  y += 15;
  doc.setFontSize(12);
  doc.text('Trips', marginX, y);
  y += 16;

  doc.setFontSize(9);
  const colX = [marginX, marginX + 140, marginX + 260, marginX + 330, marginX + 420];
  const headers = ['Trip', 'Destination', 'Date', 'Participants', 'Org profit'];
  headers.forEach((h, i) => doc.text(h, colX[i], y));
  y += 12;
  doc.setLineWidth(0.5);
  doc.line(marginX, y - 8, marginX + 500, y - 8);

  trips.forEach((t) => {
    if (y > 780) {
      doc.addPage();
      y = 50;
    }
    doc.text(truncate(t.tripName, 22), colX[0], y);
    doc.text(truncate(t.destination, 18), colX[1], y);
    doc.text(t.tripDate, colX[2], y);
    doc.text(String(t.participantCount), colX[3], y);
    doc.text(formatMoney(t.financials.organizationProfit), colX[4], y);
    y += 14;
  });

  doc.save(filename);
}

function truncate(str, max) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function formatMoney(value) {
  return `BDT ${Math.round(value).toLocaleString('en-US')}`;
}
