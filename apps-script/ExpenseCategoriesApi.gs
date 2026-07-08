/**
 * ExpenseCategoriesApi.gs
 *
 * Expense categories resource. The 12 built-in categories are seeded by
 * SetupSheets.gs with IsBuiltIn=true and are never deleted through the
 * API — matching components/expense-row.js's DEFAULT_EXPENSE_CATEGORIES.
 */

const EXPENSE_CATEGORIES_SHEET = 'ExpenseCategories';

function listExpenseCategories() {
  return sheetToObjects_(getSheet_(EXPENSE_CATEGORIES_SHEET)).map((r) => r.CategoryName);
}

function addExpenseCategory(name) {
  const existing = listExpenseCategories();
  if (existing.some((c) => c.toLowerCase() === String(name).toLowerCase())) {
    return { added: false, reason: 'Category already exists' };
  }
  appendObjectRow_(getSheet_(EXPENSE_CATEGORIES_SHEET), { CategoryName: name, IsBuiltIn: false });
  return { added: true };
}

function removeExpenseCategory(name) {
  const sheet = getSheet_(EXPENSE_CATEGORIES_SHEET);
  const rows = sheetToObjects_(sheet);
  const target = rows.find((r) => r.CategoryName === name);

  if (target && target.IsBuiltIn === true) {
    return { removed: false, reason: 'Built-in categories cannot be removed' };
  }

  deleteRowsWhere_(sheet, 'CategoryName', name);
  return { removed: true };
}
