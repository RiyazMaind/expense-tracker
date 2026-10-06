import { isCategoryId, type CategoryId } from '@/constants/categories';
import type { QueryableDatabase } from '@/database/queryable';
import { resolveDashboardPeriods, type DateRange } from '@/utils/calculations';

/**
 * The read side of Analytics.
 *
 * Every figure on that screen is a `SUM` or a `COUNT` answered by SQLite, so the
 * screen never pulls expense rows into JavaScript just to add them up
 * (docs/architecture.md: "query only required data" and "avoid recalculating
 * expensive analytics on every render").
 *
 * Three queries rather than one, because they answer three different questions
 * and return three different shapes:
 *
 * - `getPeriodTotals`  — one row: this week, this month, and how much has ever
 *   been recorded. Aggregated in a single statement for the same reason
 *   `ExpenseRepository.getSummary` does it that way: two statements could each
 *   observe a different snapshot, and the screen would briefly show totals that
 *   never coexisted.
 * - `getCategoryTotals` — one row per category that was actually used.
 * - `getDailyTotals`   — one row per day that was actually used. Days with no
 *   spending are absent, and the pure layer fills them in, so the gap between
 *   here and there is "how dense is the series", not "which days are which".
 *
 * Nothing here is cached or stored. Analytics is derived state and stays derived
 * (docs/architecture.md, Database Rule).
 */

/** The two period totals Analytics leads with. Whole paise, like every other amount. */
export type AnalyticsPeriodTotals = {
  weekPaise: number;
  monthPaise: number;
  /** Expenses recorded in the current month. Not the all-time count. */
  monthEntryCount: number;
  /** Every expense ever recorded — this, not the monthly total, drives the empty state. */
  expenseCount: number;
};

/** What one category added up to over a period. */
export type CategoryAmount = {
  category: CategoryId;
  totalPaise: number;
  entryCount: number;
};

/** What one day added up to over a period. */
export type DailyAmount = {
  dateKey: string;
  totalPaise: number;
};

type PeriodTotalsRow = {
  week_minor: number | null;
  month_minor: number | null;
  month_count: number | null;
  expense_count: number;
};

type CategoryAmountRow = {
  category: string;
  total_minor: number;
  entry_count: number;
};

type DailyAmountRow = {
  date: string;
  total_minor: number;
};

export class AnalyticsRepository {
  private readonly db: QueryableDatabase;

  constructor(db: QueryableDatabase) {
    this.db = db;
  }

  /**
   * This week's total, this month's total, and the all-time expense count.
   *
   * Aggregated in one statement over the whole table. At the scale a personal
   * tracker works at — hundreds of rows — that is cheaper than seeking three
   * ranges separately, and it cannot disagree with itself.
   *
   * Named parameters for the same reason as the dashboard's summary: five `?`
   * marks in a row would mean counting to tell the ranges apart.
   */
  async getPeriodTotals(reference: Date = new Date()): Promise<AnalyticsPeriodTotals> {
    const periods = resolveDashboardPeriods(reference);

    const row = await this.db.getFirstAsync<PeriodTotalsRow>(
      `SELECT
         COALESCE(SUM(CASE WHEN date BETWEEN $weekFrom AND $weekTo THEN amount_minor END), 0) AS week_minor,
         COALESCE(SUM(CASE WHEN date BETWEEN $monthFrom AND $monthTo THEN amount_minor END), 0) AS month_minor,
         COUNT(CASE WHEN date BETWEEN $monthFrom AND $monthTo THEN 1 END) AS month_count,
         COUNT(*) AS expense_count
       FROM expenses`,
      {
        $weekFrom: periods.week.fromKey,
        $weekTo: periods.week.toKey,
        $monthFrom: periods.month.fromKey,
        $monthTo: periods.month.toKey,
      },
    );

    return {
      weekPaise: row?.week_minor ?? 0,
      monthPaise: row?.month_minor ?? 0,
      monthEntryCount: row?.month_count ?? 0,
      expenseCount: row?.expense_count ?? 0,
    };
  }

  /**
   * One row per category used in `range`, largest first.
   *
   * `GROUP BY category` lets SQLite do the accumulation, which is the whole
   * point: 400 expenses come back as at most nine rows rather than as 400. The
   * `expenses_category_date_idx` composite serves the grouping, so this stays a
   * scan of the period rather than of the table.
   *
   * `ORDER BY total_minor DESC` puts the biggest category first, which is the
   * order the breakdown is displayed in. The secondary key keeps the order
   * stable when two categories tie — a chart whose rows reshuffle between loads
   * is unreadable.
   */
  async getCategoryTotals(range: DateRange): Promise<CategoryAmount[]> {
    const rows = await this.db.getAllAsync<CategoryAmountRow>(
      `SELECT category, SUM(amount_minor) AS total_minor, COUNT(*) AS entry_count
       FROM expenses
       WHERE date BETWEEN ? AND ?
       GROUP BY category
       ORDER BY total_minor DESC, category ASC`,
      [range.fromKey, range.toKey],
    );

    /*
      An unrecognised category is reported as `other` rather than dropped, so a
      row written by a future version of the app still shows up in the breakdown
      instead of silently shrinking the total. Several such rows can collapse
      into one `other` group here; the arithmetic layer merges any duplicates
      that reach it.
    */
    return rows.map((row) => ({
      category: isCategoryId(row.category) ? row.category : 'other',
      totalPaise: row.total_minor,
      entryCount: row.entry_count,
    }));
  }

  /**
   * One row per day with spending in `range`, oldest first.
   *
   * Only days that have spending come back: a month of daily bars is 31 rows at
   * most, but usually fewer, and a personal tracker spends most days at zero. The
   * missing days are real information, and the pure layer restores them so the
   * chart has no gaps to explain.
   */
  async getDailyTotals(range: DateRange): Promise<DailyAmount[]> {
    const rows = await this.db.getAllAsync<DailyAmountRow>(
      `SELECT date, SUM(amount_minor) AS total_minor
       FROM expenses
       WHERE date BETWEEN ? AND ?
       GROUP BY date
       ORDER BY date ASC`,
      [range.fromKey, range.toKey],
    );

    return rows.map((row) => ({ dateKey: row.date, totalPaise: row.total_minor }));
  }
}