/**
 * js/modules/expense-category-store.js
 *
 * Expense categories: now backed by the real Apps Script API
 * (apps-script/ExpenseCategoriesApi.gs). The API already returns the
 * full list (built-ins + custom) in one call, seeded by SetupSheets.gs —
 * so there's no separate "built-in vs custom" split on the frontend
 * anymore; that distinction now lives server-side (the IsBuiltIn column).
 */

import { apiGet, apiPost } from './api-client.js';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../components/expense-row.js';

const CACHE_KEY = 'vfs-expense-categories-cache';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_EXPENSE_CATEGORIES;
  } catch {
    return DEFAULT_EXPENSE_CATEGORIES;
  }
}

function writeCache(categories) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(categories));
  } catch {
    // Non-fatal.
  }
}

/**
 * Returns the full category list from the API (built-ins + custom).
 * Falls back to the last cached list, or the hardcoded defaults, if the
 * request fails.
 * @returns {Promise<string[]>}
 */
export async function getAllCategories() {
  try {
    const categories = await apiGet('expenseCategories');
    writeCache(categories);
    return categories;
  } catch (err) {
    console.warn('Failed to fetch expense categories from API, using cached copy:', err.message);
    return readCache();
  }
}

/** Adds a new custom category. Returns the updated full category list. */
export async function addCustomCategory(name) {
  const trimmed = name.trim();
  if (!trimmed) return getAllCategories();
  await apiPost('addExpenseCategory', { name: trimmed });
  return getAllCategories();
}

/** Removes a custom category by name (built-ins are protected server-side). */
export async function removeCustomCategory(name) {
  await apiPost('removeExpenseCategory', { name });
  return getAllCategories();
}
