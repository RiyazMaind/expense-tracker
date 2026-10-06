import { isCategoryId, type CategoryId } from '@/constants/categories';
import type { QueryableDatabase, TransactionRunner } from '@/database/queryable';
import { isValidDateKey, isValidMonthKey } from '@/utils/dates';

/**
 * Backup and restore: the one place the database meets the outside world.
 *
 * Design rules (docs/roadmap.md Phase 8):
 *
 * - SQLite stays the source of truth; an export is a rendering of it, never a
 *   parallel copy that drifts.
 * - Monetary values stay whole paise, dates stay `YYYY-MM-DD`, months stay
 *   `YYYY-MM`, and timestamps stay ISO — the export carries no display-formatted
 *   strings that would need parsing back.
 * - Everything in the payload is validated before a single row is written, and
 *   the write happens inside one transaction: a bad file changes nothing.
 */

export const EXPORT_FORMAT = 'expense-tracker-backup';
export const EXPORT_VERSION = 1;

export type ExportExpense = {
  id: number;
  amountMinor: number;
  category: CategoryId;
  note: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type ExportBudget = {
  id: number;
  monthKey: string;
  amountMinor: number;
  createdAt: string;
  updatedAt: string;
};

export type ExportPayload = {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  expenses: ExportExpense[];
  budgets: ExportBudget[];
};

/** What an import did, for the confirmation line in Settings. */
export type ImportResult = {
  expensesInserted: number;
  /** Rows already present with identical content — restoring the same file twice must not duplicate. */
  expensesSkippedDuplicate: number;
  /** Rows whose id exists locally with different content — the local row wins, nothing is silently overwritten. */
  expensesSkippedConflict: number;
  budgetsInserted: number;
  budgetsSkippedDuplicate: number;
  budgetsSkippedConflict: number;
};

type ExpenseRow = {
  id: number;
  amount_minor: number;
  category: string;
  note: string | null;
  date: string;
  created_at: string;
  updated_at: string;
};

type BudgetRow = {
  id: number;
  month: string;
  amount_minor: number;
  created_at: string;
  updated_at: string;
};

/** Read every expense and budget, shaped for the export file. */
export async function buildExport(db: QueryableDatabase): Promise<ExportPayload> {
  const expenses = await db.getAllAsync<ExpenseRow>(
    'SELECT id, amount_minor, category, note, date, created_at, updated_at FROM expenses ORDER BY id',
  );
  const budgets = await db.getAllAsync<BudgetRow>(
    'SELECT id, month, amount_minor, created_at, updated_at FROM budgets ORDER BY id',
  );

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    expenses: expenses.map((row) => ({
      id: row.id,
      amountMinor: row.amount_minor,
      category: row.category as CategoryId,
      note: row.note,
      date: row.date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    budgets: budgets.map((row) => ({
      id: row.id,
      monthKey: row.month,
      amountMinor: row.amount_minor,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export function serializeExport(payload: ExportPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function fail(reason: string): never {
  throw new Error(`Invalid backup file: ${reason}`);
}

function assertInteger(value: unknown, what: string): asserts value is number {
  if (!Number.isSafeInteger(value)) {
    fail(`${what} must be a whole number, got ${String(value)}`);
  }
}

function validateExpenseRow(row: unknown, index: number): asserts row is ExportExpense {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    fail(`expense #${index + 1} is not an object`);
  }

  const candidate = row as Record<string, unknown>;

  assertInteger(candidate.id, `expense #${index + 1} id`);
  if ((candidate.id as number) <= 0) {
    fail(`expense #${index + 1} id must be positive`);
  }

  assertInteger(candidate.amountMinor, `expense ${candidate.id} amountMinor`);
  if ((candidate.amountMinor as number) <= 0) {
    fail(`expense ${candidate.id} amountMinor must be positive`);
  }

  if (typeof candidate.category !== 'string' || !isCategoryId(candidate.category)) {
    fail(`expense ${candidate.id} has unknown category ${String(candidate.category)}`);
  }

  if (candidate.note !== null && typeof candidate.note !== 'string') {
    fail(`expense ${candidate.id} note must be a string or null`);
  }

  if (typeof candidate.date !== 'string' || !isValidDateKey(candidate.date)) {
    fail(`expense ${candidate.id} date must be a YYYY-MM-DD date`);
  }

  if (!isIsoTimestamp(candidate.createdAt)) {
    fail(`expense ${candidate.id} createdAt must be an ISO timestamp`);
  }

  if (!isIsoTimestamp(candidate.updatedAt)) {
    fail(`expense ${candidate.id} updatedAt must be an ISO timestamp`);
  }
}

function validateBudgetRow(row: unknown, index: number): asserts row is ExportBudget {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    fail(`budget #${index + 1} is not an object`);
  }

  const candidate = row as Record<string, unknown>;

  assertInteger(candidate.id, `budget #${index + 1} id`);
  if ((candidate.id as number) <= 0) {
    fail(`budget #${index + 1} id must be positive`);
  }

  assertInteger(candidate.amountMinor, `budget ${candidate.id} amountMinor`);
  if ((candidate.amountMinor as number) <= 0) {
    fail(`budget ${candidate.id} amountMinor must be positive`);
  }

  if (typeof candidate.monthKey !== 'string' || !isValidMonthKey(candidate.monthKey)) {
    fail(`budget ${candidate.id} monthKey must be a YYYY-MM month`);
  }

  if (!isIsoTimestamp(candidate.createdAt)) {
    fail(`budget ${candidate.id} createdAt must be an ISO timestamp`);
  }

  if (!isIsoTimestamp(candidate.updatedAt)) {
    fail(`budget ${candidate.id} updatedAt must be an ISO timestamp`);
  }
}

/**
 * Parse and fully validate backup JSON.
 *
 * Every row is checked before the caller is allowed to write anything, so an
 * import either applies entirely or is rejected as a whole.
 */
export function parseImport(text: string): ExportPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    fail('file is not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    fail('top level must be an object');
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.format !== EXPORT_FORMAT) {
    fail(`format must be "${EXPORT_FORMAT}"`);
  }

  if (candidate.version !== EXPORT_VERSION) {
    fail(`version must be ${EXPORT_VERSION}, got ${String(candidate.version)}`);
  }

  if (!isIsoTimestamp(candidate.exportedAt)) {
    fail('exportedAt must be an ISO timestamp');
  }

  if (!Array.isArray(candidate.expenses)) {
    fail('expenses must be an array');
  }

  if (!Array.isArray(candidate.budgets)) {
    fail('budgets must be an array');
  }

  candidate.expenses.forEach(validateExpenseRow);
  candidate.budgets.forEach(validateBudgetRow);

  const expenseIds = new Set<number>();
  for (const row of candidate.expenses as ExportExpense[]) {
    if (expenseIds.has(row.id)) {
      fail(`duplicate expense id ${row.id} inside the file`);
    }
    expenseIds.add(row.id);
  }

  const budgetIds = new Set<number>();
  const budgetMonths = new Set<string>();
  for (const row of candidate.budgets as ExportBudget[]) {
    if (budgetIds.has(row.id)) {
      fail(`duplicate budget id ${row.id} inside the file`);
    }
    if (budgetMonths.has(row.monthKey)) {
      fail(`duplicate budget month ${row.monthKey} inside the file`);
    }
    budgetIds.add(row.id);
    budgetMonths.add(row.monthKey);
  }

  return candidate as unknown as ExportPayload;
}

function sameExpenseContent(a: ExpenseRow, row: ExportExpense): boolean {
  return (
    a.amount_minor === row.amountMinor &&
    a.category === row.category &&
    (a.note ?? null) === (row.note ?? null) &&
    a.date === row.date &&
    a.created_at === row.createdAt &&
    a.updated_at === row.updatedAt
  );
}

function sameBudgetContent(a: BudgetRow, row: ExportBudget): boolean {
  return (
    a.month === row.monthKey &&
    a.amount_minor === row.amountMinor &&
    a.created_at === row.createdAt &&
    a.updated_at === row.updatedAt
  );
}

/**
 * Apply a validated payload in a single transaction.
 *
 * IDs are preserved so a restore lands on the same rows it was exported from.
 * Conflicts are deterministic: an incoming row with an id that already exists
 * locally is skipped unless it is byte-identical, in which case it is a counted
 * duplicate. The local row always wins — import never overwrites.
 */
export async function importData(
  db: QueryableDatabase,
  payload: ExportPayload,
): Promise<ImportResult> {
  const result: ImportResult = {
    expensesInserted: 0,
    expensesSkippedDuplicate: 0,
    expensesSkippedConflict: 0,
    budgetsInserted: 0,
    budgetsSkippedDuplicate: 0,
    budgetsSkippedConflict: 0,
  };

  await db.withExclusiveTransactionAsync(async (txn) => {
    await importExpenses(txn, payload.expenses, result);
    await importBudgets(txn, payload.budgets, result);
  });

  return result;
}

async function importExpenses(
  txn: TransactionRunner,
  rows: ExportExpense[],
  result: ImportResult,
): Promise<void> {
  for (const row of rows) {
    const existing = await txn.getFirstAsync<ExpenseRow>(
      'SELECT id, amount_minor, category, note, date, created_at, updated_at FROM expenses WHERE id = ?',
      [row.id],
    );

    // A read during import goes through the transaction itself so the check
    // and the insert observe the same snapshot.
    if (existing != null) {
      if (sameExpenseContent(existing, row)) {
        result.expensesSkippedDuplicate += 1;
      } else {
        result.expensesSkippedConflict += 1;
      }
      continue;
    }

    await txn.runAsync(
      `INSERT INTO expenses (id, amount_minor, category, note, date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.amountMinor, row.category, row.note, row.date, row.createdAt, row.updatedAt],
    );
    result.expensesInserted += 1;
  }
}

async function importBudgets(
  txn: TransactionRunner,
  rows: ExportBudget[],
  result: ImportResult,
): Promise<void> {
  for (const row of rows) {
    const existing = await txn.getFirstAsync<BudgetRow>(
      'SELECT id, month, amount_minor, created_at, updated_at FROM budgets WHERE id = ?',
      [row.id],
    );

    if (existing != null) {
      if (sameBudgetContent(existing, row)) {
        result.budgetsSkippedDuplicate += 1;
      } else {
        result.budgetsSkippedConflict += 1;
      }
      continue;
    }

    // A different row already owning this month is also a conflict, keyed on the
    // month — the local budget wins either way.
    const byMonth = await txn.getFirstAsync<BudgetRow>(
      'SELECT id, month, amount_minor, created_at, updated_at FROM budgets WHERE month = ?',
      [row.monthKey],
    );

    if (byMonth != null) {
      result.budgetsSkippedConflict += 1;
      continue;
    }

    await txn.runAsync(
      `INSERT INTO budgets (id, month, amount_minor, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [row.id, row.monthKey, row.amountMinor, row.createdAt, row.updatedAt],
    );
    result.budgetsInserted += 1;
  }
}

/**
 * Remove every expense and budget in one transaction.
 *
 * The two DELETEs commit together or roll back together, so the app can never
 * be left with a half-cleared history. sqlite_sequence is reset so a fresh
 * start afterwards reuses small ids.
 */
export async function deleteAllData(db: QueryableDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync('DELETE FROM expenses;');
    await txn.execAsync('DELETE FROM budgets;');
    await txn.execAsync(
      "DELETE FROM sqlite_sequence WHERE name IN ('expenses', 'budgets');",
    );
  });
}
