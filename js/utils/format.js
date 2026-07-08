/**
 * js/utils/format.js
 * Shared formatting helpers used across pages/components.
 */

/**
 * Formats a number as Bangladeshi Taka currency, e.g. 124500 -> "৳1,24,500".
 * Uses the Indian/Bangladeshi digit-grouping convention (lakh/crore).
 * @param {number} amount
 * @returns {string}
 */
export function formatBDT(amount) {
  const value = Number(amount) || 0;
  const rounded = Math.round(value);
  const isNegative = rounded < 0;
  const digits = Math.abs(rounded).toString();

  let grouped;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const lastThree = digits.slice(-3);
    const rest = digits.slice(0, -3);
    const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${restGrouped},${lastThree}`;
  }

  return `${isNegative ? '-' : ''}৳${grouped}`;
}

/**
 * Formats a plain integer with thousands separators (locale-agnostic, groups of 3).
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

/**
 * Formats a decimal 0-1 as a percentage string, e.g. 0.15 -> "15%".
 * @param {number} fraction
 * @returns {string}
 */
export function formatPercent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}
