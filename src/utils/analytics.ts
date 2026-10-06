import { categories, type CategoryId } from '@/constants/categories';
import type { CategoryAmount, DailyAmount } from '@/database/repositories/analytics-repository';
import { resolveDashboardPeriods, type DateRange } from '@/utils/calculations';
import { addDays, fromDateKey, toDateKey } from '@/utils/dates';

/**
 * Turning aggregated SQLite rows into the numbers the Home dashboard shows.
 *
 * The split with `analytics-repository.ts` is deliberate: SQL decides *which*
 * rows and sums (cheap, exact, done once per query) and this module decides what
 * the screen means by them. Nothing here touches a database, a React component or
 * a `Date` it was not handed, so every rule below — including the awkward ones,
 * like which days a "daily average" is divided by — is testable on its own
 * (vercel-react-native-skills/rules/state-ground-truth.md: derived values are
 * derived, never stored).
 *
 * Every amount is whole paise. Ratios are the only floating-point values here,
 * and they never feed an amount: `averagePerDayPaise` rounds back to an integer,
 * so no rupee figure in the UI is the result of a float sum
 * (docs/data-model.md, Currency).
 */

/** The periods Analytics reports against, all resolved from one clock reading. */
export type AnalyticsPeriods = {
  /** Monday to Sunday, per docs/data-model.md. */
  week: DateRange;
  /** First to last day of the calendar month containing the reference reading. */
  month: DateRange;
  /**
   * The month up to the reference reading.
   *
   * Deliberately shorter than `month` on every day except the last: the trend
   * answers "how have I been spending this month", and drawing empty columns for
   * days that have not happened yet would flatten the chart and make the average
   * look worse than it is. For a past month the reading is that month's last
   * day, so the window covers all of it.
   */
  trend: DateRange;
};

/** One category's share of a period. */
export type CategorySlice = {
  category: CategoryId;
  totalPaise: number;
  entryCount: number;
  /** Exact share of the period total, 0–1. Rounding is for display only. */
  share: number;
  /** Whole percent, distributed so the displayed values add up to exactly 100. */
  percent: number;
};

/** One column of the daily trend. */
export type TrendDay = {
  dateKey: string;
  totalPaise: number;
  /** Day of the month, 1–31. Used for the axis labels. */
  dayOfMonth: number;
  /** Share of the busiest day, 0–1. Drives the bar's height, nothing else. */
  height: number;
};

export type AnalyticsReport = {
  weekPaise: number;
  monthPaise: number;
  /** Entries recorded in the reported month — the past-month view's "Expenses" tile. */
  monthEntryCount: number;
  expenseCount: number;
  /** Whether anything has ever been recorded. Drives the first-run empty state. */
  hasExpenses: boolean;
  /** Whether anything has been recorded this month. Distinguishes "no data" from "no spending". */
  hasMonthSpending: boolean;
  categories: CategorySlice[];
  highestCategory: CategorySlice | null;
  days: TrendDay[];
  busiestDay: TrendDay | null;
  /** Days in the trend window that have at least one expense on them. */
  daysWithSpending: number;
  /** Days the trend window covers, which is also the divisor of the daily average. */
  elapsedDays: number;
  /** Month total divided by elapsed days, rounded to whole paise. */
  averagePerDayPaise: number;
};

/** What the screen has after its three queries return. */
export type AnalyticsInput = {
  periods: AnalyticsPeriods;
  weekPaise: number;
  monthPaise: number;
  monthEntryCount: number;
  expenseCount: number;
  /** One entry per category the database reported. Duplicates are merged. */
  categoryTotals: readonly CategoryAmount[];
  /** One entry per day with spending. Missing days are filled in. */
  dailyTotals: readonly DailyAmount[];
};

/**
 * Resolve the three ranges Analytics needs from one clock reading.
 *
 * The week and month are the dashboard's own definitions, reused rather than
 * reimplemented: if Analytics and Home disagreed about where a week starts, the
 * same figure would carry two values on two screens.
 *
 * The trend window is the month clipped to the reading. Comparing ISO date keys as
 * text is exact — they are zero-padded and `YYYY-MM-DD` sorts in calendar order —
 * which is the same property the `expenses_date_idx` range predicates rely on.
 */
export function resolveAnalyticsPeriods(reference: Date = new Date()): AnalyticsPeriods {
  const dashboard = resolveDashboardPeriods(reference);
  const todayKey = toDateKey(reference);

  // Never empty, even if a caller passes a reading from before the month starts.
  const trendToKey =
    todayKey <= dashboard.month.fromKey
      ? dashboard.month.fromKey
      : todayKey < dashboard.month.toKey
        ? todayKey
        : dashboard.month.toKey;

  return {
    week: dashboard.week,
    month: dashboard.month,
    trend: { fromKey: dashboard.month.fromKey, toKey: trendToKey },
  };
}

/**
 * Add up what a period costs per category.
 *
 * Merging here rather than in SQL because it cannot be done in SQL: the column
 * holds free text (docs/data-model.md, "category: category identifier"), so two
 * different spellings the app does not recognise both resolve to `other` and
 * have to end up as one row. Ordering is total then entry count then the
 * canonical category order, so a tie between two equally small categories always
 * renders in the same sequence.
 */
export function mergeCategoryAmounts(
  rows: readonly CategoryAmount[],
): CategoryAmount[] {
  const byCategory = new Map<CategoryId, { totalPaise: number; entryCount: number }>();

  for (const row of rows) {
    const existing = byCategory.get(row.category);

    if (existing == null) {
      byCategory.set(row.category, { totalPaise: row.totalPaise, entryCount: row.entryCount });
    } else {
      existing.totalPaise += row.totalPaise;
      existing.entryCount += row.entryCount;
    }
  }

  const rank = new Map(categories.map((category, index) => [category.id, index]));

  return [...byCategory.entries()]
    .map(([category, totals]) => ({ category, ...totals }))
    .sort(
      (a, b) =>
        b.totalPaise - a.totalPaise ||
        b.entryCount - a.entryCount ||
        (rank.get(a.category) ?? 0) - (rank.get(b.category) ?? 0),
    );
}

/**
 * Turn amounts into whole percents that add up to exactly 100.
 *
 * Rounding each share on its own is the obvious approach and it is wrong on
 * screen: three equal categories come out as 33 + 33 + 33 = 99, and one at
 * 99.6% prints as 100% while the 0.4% beside it prints as 0%. The leftover
 * points are therefore handed out one at a time to the largest fractional parts
 * (largest-remainder apportionment), so the column of percentages always sums to
 * 100 while staying as close to the true shares as whole numbers allow.
 *
 * Ties are broken by position, so the result is deterministic for a given input
 * rather than depending on the sort's stability.
 */
export function distributePercentages(values: readonly number[], total: number): number[] {
  if (total <= 0 || values.length === 0) {
    return values.map(() => 0);
  }

  const exact = values.map((value) => (value / total) * 100);
  const result = exact.map((value) => Math.floor(value));

  const byRemainder = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  // Never more leftover points than there are entries: Σfloor(exact) >= Σexact - n.
  let leftover = 100 - result.reduce((sum, value) => sum + value, 0);

  for (const entry of byRemainder) {
    if (leftover <= 0) {
      break;
    }

    result[entry.index] += 1;
    leftover -= 1;
  }

  return result;
}

/**
 * Turn the days that have spending into a dense series covering the whole range.
 *
 * Every day in `range` gets a column, in order, including the ones with nothing
 * on them. A chart whose columns are the days that happened to have expenses
 * would hide a streak of zero-spending days — precisely the thing a spending
 * trend exists to show — and would also make the busiest day look busier than it
 * is. Heights are relative to the busiest day in the same series, so the chart
 * always uses its full height without any axis to misread.
 */
export function buildTrendDays(
  dailyTotals: readonly DailyAmount[],
  range: DateRange,
): TrendDay[] {
  const totalsByDate = new Map<string, number>();

  for (const entry of dailyTotals) {
    totalsByDate.set(entry.dateKey, (totalsByDate.get(entry.dateKey) ?? 0) + entry.totalPaise);
  }

  const days: TrendDay[] = [];
  let highest = 0;

  // Walk the calendar rather than counting the rows, so the series length is a
  // property of the range and not of how much happened to be recorded.
  for (let date = fromDateKey(range.fromKey); toDateKey(date) <= range.toKey; date = addDays(date, 1)) {
    const dateKey = toDateKey(date);
    const totalPaise = totalsByDate.get(dateKey) ?? 0;

    if (totalPaise > highest) {
      highest = totalPaise;
    }

    days.push({ dateKey, totalPaise, dayOfMonth: date.getDate(), height: 0 });
  }

  return days.map((day) => ({
    ...day,
    // A window with no spending at all leaves every column at zero rather than
    // dividing by zero.
    height: highest > 0 ? day.totalPaise / highest : 0,
  }));
}

/**
 * How many days the trend window covers.
 *
 * Counted by walking the calendar rather than by dividing a millisecond gap: a
 * month containing a daylight-saving change is 23 or 25 hours longer in one
 * direction than the other, and the count of *days* is what the average needs.
 *
 * At least one: a daily average over a zero-day month would divide by nothing,
 * and every window this app can build contains today.
 */
export function countElapsedDays(range: DateRange): number {
  const start = fromDateKey(range.fromKey);
  const end = fromDateKey(range.toKey);

  /*
    Two local midnights are whole days apart unless a daylight-saving change sits
    between them, which makes the gap 23 or 25 hours. Rounding absorbs that: the
    true answer is the nearest whole number either way. Dividing without rounding
    would turn a 31-day month that contains one into "30 days" on the day of the
    change, and quietly move every daily average.
  */
  const elapsedMs = end.getTime() - start.getTime();
  const days = Math.round(elapsedMs / MS_PER_DAY) + 1;

  return Math.max(1, days);
}

/** One calendar day. A DST day is 23 or 25 hours; see `countElapsedDays`. */
const MS_PER_DAY = 86_400_000;

/** Whole paise, so the average never shows a fraction of a rupee. */
export function averagePerDay(totalPaise: number, elapsedDays: number): number {
  if (elapsedDays <= 0) {
    return 0;
  }

  return Math.round(totalPaise / elapsedDays);
}

/**
 * The whole report, from the three query results.
 *
 * Nothing here reads the clock or the database, so a test can pin any date and
 * assert any period boundary.
 */
export function buildAnalyticsReport(input: AnalyticsInput): AnalyticsReport {
  const { periods } = input;

  const merged = mergeCategoryAmounts(input.categoryTotals);
  const percents = distributePercentages(
    merged.map((row) => row.totalPaise),
    input.monthPaise,
  );

  const categories: CategorySlice[] = merged.map((row, index) => ({
    ...row,
    share: input.monthPaise > 0 ? row.totalPaise / input.monthPaise : 0,
    percent: percents[index] ?? 0,
  }));

  const days = buildTrendDays(input.dailyTotals, periods.trend);

  // `buildTrendDays` returns the columns in date order, so the first maximum is
  // the earliest of any ties — a stable choice for "busiest day".
  const busiestDay = days.reduce<TrendDay | null>(
    (best, day) => (best == null || day.totalPaise > best.totalPaise ? day : best),
    null,
  );

  const elapsedDays = countElapsedDays(periods.trend);

  return {
    weekPaise: input.weekPaise,
    monthPaise: input.monthPaise,
    monthEntryCount: input.monthEntryCount,
    expenseCount: input.expenseCount,
    hasExpenses: input.expenseCount > 0,
    hasMonthSpending: input.monthPaise > 0,
    categories,
    highestCategory: categories[0] ?? null,
    days,
    busiestDay: busiestDay != null && busiestDay.totalPaise > 0 ? busiestDay : null,
    daysWithSpending: days.filter((day) => day.totalPaise > 0).length,
    elapsedDays,
    averagePerDayPaise: averagePerDay(input.monthPaise, elapsedDays),
  };
}