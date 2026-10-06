import type { QueryableDatabase } from '@/database/queryable';
import { isValidMonthKey } from '@/utils/dates';

/**
 * All reads and writes of the `budgets` table.
 *
 * One row per calendar month (docs/data-model.md): `setMonthlyBudget` upserts
 * on the month, so a repeated set replaces the budget rather than stacking a
 * second one behind it. The amount never becomes a derived field — it is a
 * deliberate plan the user entered, unlike spending totals, which always stay
 * derived from `expenses`.
 */

/** A row as the rest of the app wants it. `amountMinor` is whole paise. */
export type Budget = {
  id: number;
  /** `YYYY-MM` key of the calendar month this budget applies to. */
  monthKey: string;
  amountMinor: number;
  createdAt: string;
  updatedAt: string;
};

/** What a budget is set to: a month and a whole-paise amount. */
export type NewBudget = {
  monthKey: string;
  amountPaise: number;
};

/** The column list, named explicitly rather than `SELECT *` so the shape is documented. */
const BUDGET_COLUMNS = 'id, month, amount_minor, created_at, updated_at';

/** The shape SQLite hands back. */
type BudgetRow = {
  id: number;
  month: string;
  amount_minor: number;
  created_at: string;
  updated_at: string;
};

export class BudgetRepository {
  private readonly db: QueryableDatabase;

  constructor(db: QueryableDatabase) {
    this.db = db;
  }

  /**
   * Set the budget for a month, creating or replacing it.
   *
   * An upsert on the unique `month` column is the single-writer version of
   * "save the budget": the screen never has to know whether a budget already
   * existed, and there is no path by which two rows describe the same month.
   *
   * `created_at` is preserved on update — it records when the budget was first
   * set, while `updated_at` moves to the edit.
   */
  async setMonthlyBudget(input: NewBudget): Promise<Budget> {
    assertValidBudget(input);

    const timestamp = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO budgets (month, amount_minor, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(month) DO UPDATE SET amount_minor = excluded.amount_minor, updated_at = excluded.updated_at`,
      [input.monthKey, input.amountPaise, timestamp, timestamp],
    );

    const saved = await this.getBudget(input.monthKey);

    if (saved == null) {
      // Only reachable if something deleted the row between the two statements.
      throw new Error('Budget was saved but could not be read back.');
    }

    return saved;
  }

  /** The budget for one calendar month, or `null` when none was set. */
  async getBudget(monthKey: string): Promise<Budget | null> {
    if (!isValidMonthKey(monthKey)) {
      throw new Error(`Budget month must be a YYYY-MM key, received ${monthKey}`);
    }

    const row = await this.db.getFirstAsync<BudgetRow>(
      `SELECT ${BUDGET_COLUMNS} FROM budgets WHERE month = ?`,
      [monthKey],
    );

    return row == null ? null : toBudget(row);
  }
}

/** A budget must describe a real month and a positive whole-paise amount. */
function assertValidBudget(input: NewBudget): void {
  if (!isValidMonthKey(input.monthKey)) {
    throw new Error(`Budget month must be a YYYY-MM key, received ${input.monthKey}`);
  }

  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new Error(
      `Budget amount must be a positive whole number of paise, received ${input.amountPaise}`,
    );
  }
}

function toBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    monthKey: row.month,
    amountMinor: row.amount_minor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
