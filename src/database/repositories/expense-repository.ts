import { isCategoryId, type CategoryId } from '@/constants/categories';
import type { QueryableDatabase } from '@/database/queryable';
import { resolveDashboardPeriods } from '@/utils/calculations';
import { isValidDateKey } from '@/utils/dates';

/**
 * All reads and writes of the `expenses` table.
 *
 * Screens never see SQL or a database handle — they call these methods against
 * whatever `QueryableDatabase` they were handed, which is the real connection in
 * the app and a `node:sqlite`-backed stand-in under `node --test`.
 */

/** A row as the rest of the app wants it: camelCase, paise, and a real `CategoryId`. */
export type Expense = {
  id: number;
  amountMinor: number;
  category: CategoryId;
  note: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * A new expense, in the vocabulary of the entry screen rather than of the table:
 * `amountPaise` and `dateKey` are what the UI already holds.
 */
export type NewExpense = {
  amountPaise: number;
  category: CategoryId;
  dateKey: string;
  note: string | null;
};

/** What the dashboard shows. Every figure is paise. */
export type ExpenseSummary = {
  todayPaise: number;
  weekPaise: number;
  monthPaise: number;
  /** Every expense ever recorded — this, not the monthly total, drives the empty state. */
  expenseCount: number;
};

/** The column list, named explicitly rather than `SELECT *` so row shape is explicit. */
const EXPENSE_COLUMNS = 'id, amount_minor, category, note, date, created_at, updated_at';

/** The shape SQLite hands back: snake_case columns, category as a bare string. */
type ExpenseRow = {
  id: number;
  amount_minor: number;
  category: string;
  note: string | null;
  date: string;
  created_at: string;
  updated_at: string;
};

type SummaryRow = {
  today_minor: number;
  week_minor: number;
  month_minor: number;
  expense_count: number;
};

/** One page of history, plus whether a further page exists behind it. */
export type ExpensePage = {
  expenses: Expense[];
  /**
   * Whether more rows may follow this page.
   *
   * Computed by reading one row past the page rather than by comparing the page
   * size to the limit, so "the end of the list" is a fact about the database
   * instead of an assumption about how full the last page happened to be.
   */
  hasMore: boolean;
};

/** Rows per page in the expense history. Roughly two screens of history. */
export const EXPENSE_PAGE_SIZE = 30;

/** Ceiling on a caller-supplied page size, so a bad limit cannot pull the whole table. */
const MAX_PAGE_SIZE = 200;

export class ExpenseRepository {
  private readonly db: QueryableDatabase;

  constructor(db: QueryableDatabase) {
    this.db = db;
  }

  /**
   * Insert one expense and return it as stored.
   *
   * The row is read back rather than assembled from the input, so the caller gets
   * the `id` SQLite actually assigned and the `created_at` the column really
   * holds, instead of a copy that could drift from the table.
   */
  async insert(input: NewExpense): Promise<Expense> {
    assertValidExpense(input);

    /*
      `created_at` and `updated_at` are instants, not calendar days, so UTC is the
      correct representation here — unlike `date`, which must stay local so that
      a 00:30 entry lands on the day the user remembers. Both are written from the
      same reading because nothing has modified this row in between.
    */
    const timestamp = new Date().toISOString();

    const result = await this.db.runAsync(
      `INSERT INTO expenses (amount_minor, category, note, date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.amountPaise,
        input.category,
        normalizeNote(input.note),
        input.dateKey,
        timestamp,
        timestamp,
      ],
    );

    const inserted = await this.getById(result.lastInsertRowId);

    if (inserted == null) {
      // Only reachable if something deleted the row between the two statements.
      throw new Error('Expense was inserted but could not be read back.');
    }

    return inserted;
  }

  /** One expense by id, or `null` when there is no such row. */
  async getById(id: number): Promise<Expense | null> {
    const row = await this.db.getFirstAsync<ExpenseRow>(
      `SELECT ${EXPENSE_COLUMNS} FROM expenses WHERE id = ?`,
      [id],
    );

    return row == null ? null : toExpense(row);
  }

  /**
   * Today, this week, this month, and the total number of expenses.
   *
   * Aggregated in a single statement on purpose. Three separate range queries
   * could each observe a different snapshot if an insert landed between them, and
   * the dashboard would briefly show a set of totals that never existed at any
   * one moment. One statement cannot disagree with itself.
   *
   * This reads the whole table rather than seeking three times, which is the
   * cheaper shape at the scale this app works at — a personal tracker holds
   * hundreds of rows, not millions.
   */
  async getSummary(reference: Date = new Date()): Promise<ExpenseSummary> {
    const periods = resolveDashboardPeriods(reference);

    /*
      Named parameters ($today, …) rather than positional ones: seven `?` marks in
      a row would make it impossible to tell which range a bound value belongs to
      without counting, which is exactly the kind of bug that survives review.
    */
    const row = await this.db.getFirstAsync<SummaryRow>(
      `SELECT
         COALESCE(SUM(CASE WHEN date = $today THEN amount_minor END), 0) AS today_minor,
         COALESCE(SUM(CASE WHEN date BETWEEN $weekFrom AND $weekTo THEN amount_minor END), 0) AS week_minor,
         COALESCE(SUM(CASE WHEN date BETWEEN $monthFrom AND $monthTo THEN amount_minor END), 0) AS month_minor,
         COUNT(*) AS expense_count
       FROM expenses`,
      {
        $today: periods.today.fromKey,
        $weekFrom: periods.week.fromKey,
        $weekTo: periods.week.toKey,
        $monthFrom: periods.month.fromKey,
        $monthTo: periods.month.toKey,
      },
    );

    // An empty table still returns one row — of zeros and a NULL — hence the
    // fallbacks. They cost nothing and keep the caller from handling null.
    return {
      todayPaise: row?.today_minor ?? 0,
      weekPaise: row?.week_minor ?? 0,
      monthPaise: row?.month_minor ?? 0,
      expenseCount: row?.expense_count ?? 0,
    };
  }

  /** Every expense in one local period, newest first. */
  async listInRange(range: { fromKey: string; toKey: string }): Promise<Expense[]> {
    const rows = await this.db.getAllAsync<ExpenseRow>(
      `SELECT ${EXPENSE_COLUMNS}
       FROM expenses
       WHERE date BETWEEN ? AND ?
       ORDER BY date DESC, id DESC`,
      [range.fromKey, range.toKey],
    );

    return rows.map(toExpense);
  }

  /**
   * One page of history, newest first.
   *
   * Paged rather than returned whole, because docs/architecture.md asks for
   * "query only required data" on large histories and an unbounded read would
   * grow without limit however long the app is used. The history screen walks
   * pages as it scrolls, so a user with a thousand expenses pays for the first
   * screenful rather than for all of it.
   *
   * Ordering is `date DESC, id DESC`: the index on `date` serves the sort, and
   * `id` breaks ties between expenses filed on the same day so paging cannot
   * repeat or skip a row when two entries share a date.
   */
  async listRecent(options: { limit?: number; offset?: number } = {}): Promise<ExpensePage> {
    const limit = clampPageSize(options.limit);
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));

    // One row beyond the page is requested purely to answer "is there more?".
    const rows = await this.db.getAllAsync<ExpenseRow>(
      `SELECT ${EXPENSE_COLUMNS}
       FROM expenses
       ORDER BY date DESC, id DESC
       LIMIT ? OFFSET ?`,
      [limit + 1, offset],
    );

    const hasMore = rows.length > limit;

    return {
      expenses: hasMore ? rows.slice(0, limit).map(toExpense) : rows.map(toExpense),
      hasMore,
    };
  }

  /**
   * Overwrite every editable field of one expense and return it as stored.
   *
   * Takes the same `NewExpense` shape as `insert` rather than a partial patch:
   * the edit screen edits all four fields at once, so a partial update would
   * only add a way to leave a field unintentionally unset.
   *
   * `created_at` is not in the statement. It records when the expense was first
   * recorded, which editing must not rewrite.
   */
  async update(id: number, input: NewExpense): Promise<Expense> {
    assertValidExpense(input);
    assertValidId(id);

    const timestamp = new Date().toISOString();

    const result = await this.db.runAsync(
      `UPDATE expenses
       SET amount_minor = ?, category = ?, note = ?, date = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.amountPaise,
        input.category,
        normalizeNote(input.note),
        input.dateKey,
        timestamp,
        id,
      ],
    );

    if (result.changes === 0) {
      // The row is gone — deleted on another screen, or never existed. Silently
      // succeeding would leave the screen claiming to have saved an edit to
      // nothing.
      throw new Error(`Cannot update expense ${id}: no such expense.`);
    }

    const updated = await this.getById(id);

    if (updated == null) {
      throw new Error(`Expense ${id} was updated but could not be read back.`);
    }

    return updated;
  }

  /**
   * Delete one expense.
   *
   * Returns whether a row was actually removed, so a caller can tell "deleted"
   * from "it was already gone" and avoid telling the user their deletion
   * succeeded when nothing was there.
   */
  async remove(id: number): Promise<boolean> {
    assertValidId(id);

    const result = await this.db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);

    return result.changes > 0;
  }
}

/**
 * An empty or whitespace-only note is stored as `NULL`.
 *
 * Not a cosmetic choice: `note IS NULL` is what "has no note" should mean, so
 * that clearing the field actually clears it instead of leaving a run of spaces
 * that renders as nothing but sorts and searches as present.
 */
function normalizeNote(note: string | null): string | null {
  const trimmed = note?.trim() ?? '';

  return trimmed === '' ? null : trimmed;
}

/**
 * Reject an expense that would violate the table's own invariants.
 *
 * The schema already enforces the positive amount and the date format with CHECK
 * constraints. Checking here as well is not duplication for its own sake — SQLite
 * reports a constraint failure as a generic error, while these messages name the
 * field that was wrong, which is the difference between a debuggable failure and
 * a mystery one.
 *
 * Shared by `insert` and `update`: an edit that could produce a row the insert
 * path would have rejected is not an edit, it is a corruption.
 */
function assertValidExpense(input: NewExpense): void {
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new Error(
      `Expense amount must be a positive whole number of paise, received ${input.amountPaise}`,
    );
  }

  if (!isCategoryId(input.category)) {
    throw new Error(`Unknown expense category: ${input.category}`);
  }

  if (!isValidDateKey(input.dateKey)) {
    throw new Error(`Expense date must be a local YYYY-MM-DD date, received ${input.dateKey}`);
  }
}

/** `id` comes from a route parameter, so it is checked before it reaches SQL. */
function assertValidId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`Expense id must be a positive whole number, received ${id}`);
  }
}

/** Keep a requested page size inside the bounds the screen actually wants. */
function clampPageSize(limit: number | undefined): number {
  if (limit == null) {
    return EXPENSE_PAGE_SIZE;
  }

  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(limit)));
}

/**
 * Map a raw row to an `Expense`.
 *
 * The category falls back to `other` rather than throwing: a row written by a
 * future version of the app, or by a corrupted write, should still render in a
 * list — just under the category that means "unrecognised". Failing the whole
 * query instead would take the dashboard down over one unreadable row.
 */
function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    amountMinor: row.amount_minor,
    category: isCategoryId(row.category) ? row.category : 'other',
    note: row.note,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}