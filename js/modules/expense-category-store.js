/**
 * js/modules/expense-category-store.js
 *
 * Expense categories: backed by the real Apps Script API
 * (apps-script/ExpenseCategoriesApi.gs). Categories change rarely, so
 * reads are cache-first with a short TTL to skip a network round-trip on
 * every page that needs them (mainly New Trip). Falls back to the last
 * cached list, or hardcoded defaults, if a fetch ever fails.
 */

import { apiGet, apiPost } from './api-client.js';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../components/expense-row.js';

const CACHE_KEY = 'vfs-expense-categories-cache';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function readCache(respectTtl) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return respectTtl ? null : parsed; // old cache shape, no timestamp
    if (respectTtl && Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed.categories;
  } catch {
    return null;
  }
}

function writeCache(categories) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ categories, cachedAt: Date.now() }));
  } catch {
    // Non-fatal.
  }
}

/**
 * Returns the full category list (built-ins + custom). Serves from cache
 * if fresh; otherwise fetches from the API. Falls back to any cached
 * copy, or the hardcoded defaults, if the request fails.
 * @returns {Promise<string[]>}
 */
export async function getAllCategories() {
  const fresh = readCache(true);
  if (fresh) return fresh;

  try {
    const categories = await apiGet('expenseCategories');
    writeCache(categories);
    return categories;
  } catch (err) {
    console.warn('Failed to fetch expense categories from API, using cached copy:', err.message);
    return readCache(false) || DEFAULT_EXPENSE_CATEGORIES;
  }
}

/** Adds a new custom category. Returns the updated full category list. */
export async function addCustomCategory(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    const categories = await apiGet('expenseCategories');
    writeCache(categories);
    return categories;
  }
  await apiPost('addExpenseCategory', { name: trimmed });
  const categories = await apiGet('expenseCategories');
  writeCache(categories);
  return categories;
}

/** Removes a custom category by name (built-ins are protected server-side). */
export async function removeCustomCategory(name) {
  await apiPost('removeExpenseCategory', { name });
  const categories = await apiGet('expenseCategories');
  writeCache(categories);
  return categories;
}
