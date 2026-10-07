import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CategoryAmount } from '@/database/repositories/analytics-repository';
import {
  averagePerDay,
  buildAnalyticsReport,
  buildTrendDays,
  countElapsedDays,
  distributePercentages,
  mergeCategoryAmounts,
  resolveAnalyticsPeriods,
  type AnalyticsInput,
} from '@/utils/analytics';

/**
 * The arithmetic behind the Analytics screen.
 *
 * Pure functions, pinned to a reference date, so every period boundary — Monday,
 * the first of the month, a year rollover — can be asserted directly instead of
 * inferred from whatever a chart happened to draw.
 */

/** 6 October 2026 is a Tuesday: two days into a week, five into a month. */
const TODAY = new Date(2026, 9, 6);

function slice(category: CategoryAmount['category'], totalPaise: number, entryCount = 1) {
  return { category, totalPaise, entryCount } satisfies CategoryAmount;
}

describe('resolveAnalyticsPeriods', () => {
  it('reuses the dashboard week, which starts on Monday', () => {
    assert.deepEqual(resolveAnalyticsPeriods(TODAY).week, {
      fromKey: '2026-10-05',
      toKey: '2026-10-11',
    });
  });

  it('uses the whole calendar month as the reporting period', () => {
    assert.deepEqual(resolveAnalyticsPeriods(TODAY).month, {
      fromKey: '2026-10-01',
      toKey: '2026-10-31',
    });
  });

  it('stops the trend at today, not at the end of the month', () => {
    // Drawing the days that have not happened yet would flatten every column and
    // drag the daily average down with them.
    assert.deepEqual(resolveAnalyticsPeriods(TODAY).trend, {
      fromKey: '2026-10-01',
      toKey: '2026-10-06',
    });
  });

  it('still produces a one-day trend on the first of the month', () => {
    assert.deepEqual(resolveAnalyticsPeriods(new Date(2026, 9, 1)).trend, {
      fromKey: '2026-10-01',
      toKey: '2026-10-01',
    });
  });

  it('covers the whole month once the last day arrives', () => {
    assert.deepEqual(resolveAnalyticsPeriods(new Date(2026, 9, 31)).trend, {
      fromKey: '2026-10-01',
      toKey: '2026-10-31',
    });
  });

  it('never runs the trend past the end of the month', () => {
    // A leap February: the trend stops on the 15th, not on the 29th.
    const periods = resolveAnalyticsPeriods(new Date(2028, 1, 15));

    assert.deepEqual(periods.trend, { fromKey: '2028-02-01', toKey: '2028-02-15' });
  });

  it('handles a leap February, where the month is 29 days long', () => {
    assert.deepEqual(resolveAnalyticsPeriods(new Date(2028, 1, 15)).month, {
      fromKey: '2028-02-01',
      toKey: '2028-02-29',
    });
  });

  it('keeps a week that began in the previous month, and starts the trend in this one', () => {
    // 1 November 2026 is a Sunday, so its week started on 26 October.
    const periods = resolveAnalyticsPeriods(new Date(2026, 10, 1));

    assert.deepEqual(periods.week, { fromKey: '2026-10-26', toKey: '2026-11-01' });
    assert.deepEqual(periods.month, { fromKey: '2026-11-01', toKey: '2026-11-30' });
    assert.deepEqual(periods.trend, { fromKey: '2026-11-01', toKey: '2026-11-01' });
  });

  it('crosses the year boundary without wrapping', () => {
    const december = resolveAnalyticsPeriods(new Date(2026, 11, 31));

    assert.deepEqual(december.month, { fromKey: '2026-12-01', toKey: '2026-12-31' });

    const january = resolveAnalyticsPeriods(new Date(2027, 0, 1));

    assert.deepEqual(january.month, { fromKey: '2027-01-01', toKey: '2027-01-31' });
  });

  it('defaults to now, so a caller cannot forget to pass a clock reading', () => {
    const periods = resolveAnalyticsPeriods();

    assert.equal(periods.month.fromKey, periods.trend.fromKey);
    assert.ok(periods.trend.fromKey <= periods.trend.toKey);
  });
});

describe('countElapsedDays', () => {
  it('counts every day in the trend window, today included', () => {
    assert.equal(countElapsedDays({ fromKey: '2026-10-01', toKey: '2026-10-06' }), 6);
  });

  it('counts a single day as one', () => {
    assert.equal(countElapsedDays({ fromKey: '2026-10-01', toKey: '2026-10-01' }), 1);
  });

  it('counts a full 31-day month', () => {
    assert.equal(countElapsedDays({ fromKey: '2026-10-01', toKey: '2026-10-31' }), 31);
  });

  it('never returns zero, so a daily average cannot divide by nothing', () => {
    assert.equal(countElapsedDays({ fromKey: '2026-10-06', toKey: '2026-10-06' }), 1);
  });
});

describe('mergeCategoryAmounts', () => {
  it('adds two rows of the same category together', () => {
    assert.deepEqual(
      mergeCategoryAmounts([slice('food', 1000, 1), slice('food', 500, 2)]),
      [slice('food', 1500, 3)],
    );
  });

  it('merges rows that both resolve to other, which SQL cannot do', () => {
    assert.deepEqual(
      mergeCategoryAmounts([slice('other', 600, 1), slice('other', 400, 1)]),
      [slice('other', 1000, 2)],
    );
  });

  it('sorts by amount, largest first', () => {
    assert.deepEqual(
      mergeCategoryAmounts([slice('food', 1000), slice('shopping', 8000), slice('bills', 4000)]).map(
        (row) => row.category,
      ),
      ['shopping', 'bills', 'food'],
    );
  });

  it('breaks a tie by entry count, then keeps a stable order for an exact tie', () => {
    const byCount = mergeCategoryAmounts([
      slice('food', 1000, 1),
      slice('bills', 1000, 3),
    ]);

    assert.deepEqual(
      byCount.map((row) => row.category),
      ['bills', 'food'],
    );

    // Same total, same count: the canonical category order decides, so the rows
    // cannot reshuffle between two loads of the same data.
    const exact = mergeCategoryAmounts([slice('health', 1000, 1), slice('food', 1000, 1)]);

    assert.deepEqual(
      exact.map((row) => row.category),
      ['food', 'health'],
    );
  });

  it('returns nothing for no rows', () => {
    assert.deepEqual(mergeCategoryAmounts([]), []);
  });
});

describe('distributePercentages', () => {
  it('gives a single category the whole thing', () => {
    assert.deepEqual(distributePercentages([1000], 1000), [100]);
  });

  it('splits evenly and still totals 100', () => {
    // Rounding each share on its own gives 33 + 33 + 33 = 99.
    assert.deepEqual(distributePercentages([1000, 1000, 1000], 3000), [34, 33, 33]);
  });

  it('always totals 100 across many slices', () => {
    const values = [1, 1, 1, 1, 1, 1, 1];
    const percents = distributePercentages(values, values.reduce((a, b) => a + b, 0));

    assert.equal(
      percents.reduce((sum, value) => sum + value, 0),
      100,
    );
  });

  it('keeps the largest slice from rounding up to 100 on its own', () => {
    const percents = distributePercentages([996, 4], 1000);

    assert.deepEqual(percents, [100, 0]);
    assert.equal(percents.reduce((sum, value) => sum + value, 0), 100);
  });

  it('handles a remainder of more than one point', () => {
    // 1/7 of 100 is 14.28…, so six slices need six points handed out.
    const percents = distributePercentages([1, 1, 1, 1, 1, 1, 1], 7);

    assert.equal(
      percents.reduce((sum, value) => sum + value, 0),
      100,
    );
    assert.deepEqual(percents, [15, 15, 14, 14, 14, 14, 14]);
  });

  it('gives nothing to anything when the total is zero', () => {
    assert.deepEqual(distributePercentages([0, 0], 0), [0, 0]);
  });

  it('returns nothing for no values', () => {
    assert.deepEqual(distributePercentages([], 5000), []);
  });

  it('works in paise without drift', () => {
    // Three amounts that do not divide the total evenly at paise scale.
    const percents = distributePercentages([333, 333, 334], 1000);

    assert.equal(
      percents.reduce((sum, value) => sum + value, 0),
      100,
    );
    assert.deepEqual(percents, [33, 33, 34]);
  });
});

describe('buildTrendDays', () => {
  it('gives every day in the range a column, in order', () => {
    const days = buildTrendDays(
      [{ dateKey: '2026-10-01', totalPaise: 500 }],
      { fromKey: '2026-10-01', toKey: '2026-10-03' },
    );

    assert.deepEqual(
      days.map((day) => day.dateKey),
      ['2026-10-01', '2026-10-02', '2026-10-03'],
    );
    assert.deepEqual(
      days.map((day) => day.totalPaise),
      [500, 0, 0],
    );
  });

  it('scales bar heights to the busiest day in the same series', () => {
    const days = buildTrendDays(
      [
        { dateKey: '2026-10-01', totalPaise: 250 },
        { dateKey: '2026-10-02', totalPaise: 1000 },
      ],
      { fromKey: '2026-10-01', toKey: '2026-10-02' },
    );

    assert.equal(days[1]?.height, 1);
    assert.equal(days[0]?.height, 0.25);
  });

  it('leaves every column at zero when nothing was spent', () => {
    const days = buildTrendDays([], { fromKey: '2026-10-01', toKey: '2026-10-05' });

    assert.equal(days.length, 5);
    assert.deepEqual(
      days.map((day) => day.height),
      [0, 0, 0, 0, 0],
    );
  });

  it('numbers columns by day of the month, and restarts at 1 in the next one', () => {
    // The trend period itself never crosses a month — `resolveAnalyticsPeriods`
    // clamps it — but `dayOfMonth` is a formatting value, not a range, so it has
    // to be right on either side of a boundary if that range ever grows.
    const days = buildTrendDays([], { fromKey: '2026-10-30', toKey: '2026-11-02' });

    assert.deepEqual(
      days.map((day) => day.dayOfMonth),
      [30, 31, 1, 2],
    );
  });

  it('ignores days outside the range it was given', () => {
    const days = buildTrendDays(
      [
        { dateKey: '2026-09-30', totalPaise: 9000 },
        { dateKey: '2026-10-02', totalPaise: 100 },
      ],
      { fromKey: '2026-10-01', toKey: '2026-10-03' },
    );

    // The 30th must not set the scale, or every real column would be invisible.
    assert.equal(days[1]?.height, 1);
    assert.equal(
      days.reduce((sum, day) => sum + day.totalPaise, 0),
      100,
    );
  });

  it('adds up rows that arrive twice for one day', () => {
    const days = buildTrendDays(
      [
        { dateKey: '2026-10-01', totalPaise: 300 },
        { dateKey: '2026-10-01', totalPaise: 200 },
      ],
      { fromKey: '2026-10-01', toKey: '2026-10-01' },
    );

    assert.equal(days[0]?.totalPaise, 500);
  });

  it('covers a 31-day month without a gap', () => {
    const days = buildTrendDays([], { fromKey: '2026-10-01', toKey: '2026-10-31' });

    assert.equal(days.length, 31);
    assert.equal(days.at(-1)?.dateKey, '2026-10-31');
  });
});

describe('averagePerDay', () => {
  it('rounds to whole paise', () => {
    assert.equal(averagePerDay(1000, 3), 333);
  });

  it('divides exactly when the total divides evenly', () => {
    assert.equal(averagePerDay(1200, 3), 400);
  });

  it('keeps rupees and paise intact', () => {
    // ₹10 over three days is ₹3.33…
    assert.equal(averagePerDay(1000, 3), 333);
  });

  it('is zero for an empty month rather than undefined', () => {
    assert.equal(averagePerDay(0, 6), 0);
  });
});

describe('buildAnalyticsReport', () => {
  const periods = resolveAnalyticsPeriods(TODAY);

  function report(overrides: Partial<AnalyticsInput> = {}) {
    return buildAnalyticsReport({
      periods,
      weekPaise: 1000,
      monthPaise: 3000,
      monthEntryCount: 3,
      expenseCount: 3,
      categoryTotals: [slice('food', 2000, 2), slice('transport', 1000, 1)],
      dailyTotals: [
        { dateKey: '2026-10-02', totalPaise: 500 },
        { dateKey: '2026-10-05', totalPaise: 2500 },
      ],
      ...overrides,
    });
  }

  it('finds the highest-spending category', () => {
    assert.equal(report().highestCategory?.category, 'food');
    assert.equal(report().highestCategory?.totalPaise, 2000);
    assert.equal(report().highestCategory?.percent, 67);
  });

  it('states each category as a share and a whole percent', () => {
    const categories = report().categories;

    assert.equal(categories[0]?.share, 2000 / 3000);
    assert.equal(categories[0]?.percent, 67);
    assert.equal(categories[1]?.percent, 33);
  });

  it('has no highest category when there is nothing to rank', () => {
    const empty = report({ monthPaise: 0, expenseCount: 0, categoryTotals: [], dailyTotals: [] });

    assert.equal(empty.highestCategory, null);
    assert.deepEqual(empty.categories, []);
  });

  it('reports the busiest day and its amount', () => {
    const busiestDay = report().busiestDay;

    assert.equal(busiestDay?.dateKey, '2026-10-05');
    assert.equal(busiestDay?.totalPaise, 2500);
  });

  it('picks the earliest day when two tie for the busiest', () => {
    const tied = report({
      dailyTotals: [
        { dateKey: '2026-10-01', totalPaise: 1000 },
        { dateKey: '2026-10-03', totalPaise: 1000 },
      ],
    });

    assert.equal(tied.busiestDay?.dateKey, '2026-10-01');
  });

  it('has no busiest day when nothing was spent', () => {
    const empty = report({ monthPaise: 0, dailyTotals: [], categoryTotals: [] });

    assert.equal(empty.busiestDay, null);
  });

  it('counts the days that have spending and the days elapsed', () => {
    const built = report();

    assert.equal(built.daysWithSpending, 2);
    // The trend runs 1–6 October for this reference date.
    assert.equal(built.elapsedDays, 6);
    assert.equal(built.days.length, 6);
  });

  it('divides the month total by the days elapsed', () => {
    assert.equal(report().averagePerDayPaise, 500);
  });

  it('carries the month entry count through untouched', () => {
    // The past-month "Expenses" tile reads this; nothing about it is derived.
    assert.equal(report().monthEntryCount, 3);
    assert.equal(report({ monthEntryCount: 7 }).monthEntryCount, 7);
  });

  it('distinguishes "no expenses at all" from "nothing spent this month"', () => {
    const firstRun = report({ expenseCount: 0, monthPaise: 0, categoryTotals: [], dailyTotals: [] });

    assert.equal(firstRun.hasExpenses, false);
    assert.equal(firstRun.hasMonthSpending, false);

    const lastMonths = report({ monthPaise: 0, categoryTotals: [], dailyTotals: [] });

    assert.equal(lastMonths.hasExpenses, true);
    assert.equal(lastMonths.hasMonthSpending, false);
  });

  it('returns a safe report for an empty dataset', () => {
    const empty = report({ expenseCount: 0, monthPaise: 0, categoryTotals: [], dailyTotals: [] });

    assert.equal(empty.weekPaise, 1000);
    assert.deepEqual(empty.categories, []);
    assert.equal(empty.busiestDay, null);
    assert.equal(empty.daysWithSpending, 0);
    assert.equal(empty.averagePerDayPaise, 0);
    assert.equal(empty.days.length, 6);
  });

  it('adds up paise without losing a rupee to rounding', () => {
    // Ten 10-paise entries in one month, spread over six days.
    const dailyTotals = Array.from({ length: 10 }, (_, index) => ({
      dateKey: `2026-10-0${(index % 6) + 1}`,
      totalPaise: 10,
    }));

    const built = report({
      monthPaise: 100,
      expenseCount: 10,
      categoryTotals: [slice('food', 100, 10)],
      dailyTotals,
    });

    assert.equal(
      built.days.reduce((sum, day) => sum + day.totalPaise, 0),
      100,
    );
    assert.equal(built.categories.reduce((sum, entry) => sum + entry.totalPaise, 0), 100);
    assert.equal(built.categories[0]?.percent, 100);
  });

  it('keeps the daily average consistent with the days it divides by', () => {
    const built = report({
      monthPaise: 1000,
      expenseCount: 1,
      categoryTotals: [slice('food', 1000, 1)],
      dailyTotals: [{ dateKey: '2026-10-06', totalPaise: 1000 }],
    });

    assert.equal(built.elapsedDays, 6);
    assert.equal(built.averagePerDayPaise, 167);
    assert.equal(built.busiestDay?.totalPaise, 1000);
  });
});