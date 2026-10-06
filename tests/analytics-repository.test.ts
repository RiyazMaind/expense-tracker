import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { runMigrations } from '@/database/migrations';
import { AnalyticsRepository } from '@/database/repositories/analytics-repository';
import { ExpenseRepository, type NewExpense } from '@/database/repositories/expense-repository';
import { resolveAnalyticsPeriods } from '@/utils/analytics';
import { createTestDatabase, type TestDatabase } from './support/node-sqlite-driver.ts';

/**
 * The Analytics aggregations, against real SQLite.
 *
 * The reference date is Tuesday 6 October 2026. It sits two days into a week that
 * started on Monday the 5th and five days into a month that started on the 1st,
 * and the fixture deliberately puts expenses on both sides of each boundary — so
 * an off-by-one in a range predicate shows up as a wrong number here rather than
 * as a chart that looks plausible on screen.
 */
const TODAY = new Date(2026, 9, 6);

function expense(overrides: Partial<NewExpense> = {}): NewExpense {
  return {
    amountPaise: 1000,
    category: 'food',
    dateKey: '2026-10-06',
    note: null,
    ...overrides,
  };
}

/** A migrated database with the standard October fixture loaded. */
async function seeded(): Promise<{ db: TestDatabase; analytics: AnalyticsRepository }> {
  const db = createTestDatabase();
  await runMigrations(db);

  const expenses = new ExpenseRepository(db);

  await expenses.insert(expense({ amountPaise: 1000, dateKey: '2026-10-06' })); // Tue, this week
  await expenses.insert(expense({ amountPaise: 2000, category: 'transport', dateKey: '2026-10-04' })); // Sun, last week
  await expenses.insert(expense({ amountPaise: 3000, dateKey: '2026-09-28' })); // Mon, last month
  await expenses.insert(expense({ amountPaise: 4000, category: 'bills', dateKey: '2026-09-30' })); // last month
  await expenses.insert(expense({ amountPaise: 8000, category: 'shopping', dateKey: '2026-10-12' })); // Mon, next week
  await expenses.insert(expense({ amountPaise: 1500, dateKey: '2026-10-14' })); // Wed, next week

  return { db, analytics: new AnalyticsRepository(db) };
}

describe('AnalyticsRepository against an empty database', () => {
  let db: TestDatabase;
  let analytics: AnalyticsRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    analytics = new AnalyticsRepository(db);
  });

  after(() => {
    db.close();
  });

  it('reports zeros rather than nulls, which is what the empty state needs', async () => {
    assert.deepEqual(await analytics.getPeriodTotals(TODAY), {
      weekPaise: 0,
      monthPaise: 0,
      monthEntryCount: 0,
      expenseCount: 0,
    });
  });

  it('has no categories to break down', async () => {
    assert.deepEqual(
      await analytics.getCategoryTotals({ fromKey: '2026-01-01', toKey: '2026-12-31' }),
      [],
    );
  });

  it('has no days to chart', async () => {
    assert.deepEqual(
      await analytics.getDailyTotals({ fromKey: '2026-01-01', toKey: '2026-12-31' }),
      [],
    );
  });
});

describe('AnalyticsRepository.getPeriodTotals', () => {
  let db: TestDatabase;
  let analytics: AnalyticsRepository;

  before(async () => {
    const seededDb = await seeded();
    db = seededDb.db;
    analytics = seededDb.analytics;
  });

  after(() => {
    db.close();
  });

  it('sums the week from Monday, so Sunday belongs to the week before', async () => {
    assert.equal((await analytics.getPeriodTotals(TODAY)).weekPaise, 1000);
  });

  it('swings the whole week forward on the next Monday', async () => {
    assert.equal((await analytics.getPeriodTotals(new Date(2026, 9, 12))).weekPaise, 9500);
  });

  it('sums the calendar month, leaving the last day of the previous one out', async () => {
    assert.equal((await analytics.getPeriodTotals(TODAY)).monthPaise, 12500);
  });

  it('counts the entries in the month and every entry ever recorded', async () => {
    const totals = await analytics.getPeriodTotals(TODAY);

    assert.equal(totals.monthEntryCount, 4);
    assert.equal(totals.expenseCount, 6);
  });

  it('keeps its own three totals consistent with the dashboard summary', async () => {
    // Same periods, same definitions, one source of truth for the arithmetic:
    // docs/architecture.md says derived totals are calculated, and two screens
    // showing different numbers for the same week would be a bug in one of them.
    const analyticsTotals = await analytics.getPeriodTotals(TODAY);
    const dashboard = await new ExpenseRepository(db).getSummary(TODAY);

    assert.equal(analyticsTotals.weekPaise, dashboard.weekPaise);
    assert.equal(analyticsTotals.monthPaise, dashboard.monthPaise);
    assert.equal(analyticsTotals.expenseCount, dashboard.expenseCount);
  });

  it('follows the month across a year boundary', async () => {
    const scoped = createTestDatabase();
    await runMigrations(scoped);
    const expenses = new ExpenseRepository(scoped);

    await expenses.insert(expense({ amountPaise: 500, dateKey: '2026-12-31' }));
    await expenses.insert(expense({ amountPaise: 700, dateKey: '2027-01-01' }));

    const analytics = new AnalyticsRepository(scoped);

    assert.equal((await analytics.getPeriodTotals(new Date(2026, 11, 31))).monthPaise, 500);
    assert.equal((await analytics.getPeriodTotals(new Date(2027, 0, 1))).monthPaise, 700);

    scoped.close();
  });

  it('lets the week legitimately exceed the month when the week starts in the previous one', async () => {
    // 1 November 2026 is a Sunday, so its week began on 26 October. An expense on
    // the 28th is in the week and not in the month, and the week total being the
    // larger of the two is correct rather than a leak from the range predicate.
    const scoped = createTestDatabase();
    await runMigrations(scoped);

    await new ExpenseRepository(scoped).insert(
      expense({ amountPaise: 900, dateKey: '2026-10-28' }),
    );

    const analytics = new AnalyticsRepository(scoped);
    const totals = await analytics.getPeriodTotals(new Date(2026, 10, 1));

    assert.equal(totals.weekPaise, 900);
    assert.equal(totals.monthPaise, 0);
    assert.equal(totals.expenseCount, 1);

    scoped.close();
  });

  it('counts paise exactly, with no floating point drift', async () => {
    const scoped = createTestDatabase();
    await runMigrations(scoped);
    const expenses = new ExpenseRepository(scoped);

    // Ten 10-paise entries would be a fraction of a rupee a float total loses.
    for (let index = 0; index < 10; index += 1) {
      await expenses.insert(expense({ amountPaise: 10 }));
    }

    const analytics = new AnalyticsRepository(scoped);
    const totals = await analytics.getPeriodTotals(TODAY);

    assert.equal(totals.monthPaise, 100);
    assert.equal(totals.monthEntryCount, 10);

    const categories = await analytics.getCategoryTotals({
      fromKey: '2026-10-01',
      toKey: '2026-10-31',
    });

    assert.equal(categories[0]?.totalPaise, 100);
    assert.equal(categories[0]?.entryCount, 10);

    const days = await analytics.getDailyTotals({ fromKey: '2026-10-01', toKey: '2026-10-31' });

    assert.equal(days[0]?.totalPaise, 100);

    scoped.close();
  });
});

describe('AnalyticsRepository.getCategoryTotals', () => {
  let db: TestDatabase;
  let analytics: AnalyticsRepository;

  before(async () => {
    const seededDb = await seeded();
    db = seededDb.db;
    analytics = seededDb.analytics;
  });

  after(() => {
    db.close();
  });

  it('adds a category up across days, largest first', async () => {
    const categories = await analytics.getCategoryTotals({
      fromKey: '2026-10-01',
      toKey: '2026-10-31',
    });

    assert.deepEqual(
      categories.map((row) => [row.category, row.totalPaise, row.entryCount]),
      [
        ['shopping', 8000, 1],
        ['food', 2500, 2], // 1,000 on the 6th + 1,500 on the 14th
        ['transport', 2000, 1],
      ],
    );
  });

  it('excludes the whole category outside the range', async () => {
    const categories = await analytics.getCategoryTotals({
      fromKey: '2026-10-06',
      toKey: '2026-10-06',
    });

    assert.deepEqual(categories, [{ category: 'food', totalPaise: 1000, entryCount: 1 }]);
  });

  it('treats both bounds as inclusive', async () => {
    const firstDay = await analytics.getCategoryTotals({
      fromKey: '2026-10-04',
      toKey: '2026-10-04',
    });
    const lastDay = await analytics.getCategoryTotals({
      fromKey: '2026-10-14',
      toKey: '2026-10-14',
    });

    assert.deepEqual(firstDay, [{ category: 'transport', totalPaise: 2000, entryCount: 1 }]);
    assert.deepEqual(lastDay, [{ category: 'food', totalPaise: 1500, entryCount: 1 }]);
  });

  it('reports an unknown category as other rather than dropping the row', async () => {
    const scoped = createTestDatabase();
    await runMigrations(scoped);

    // Written past the repository's guard, the way a future version of the app
    // or a corrupted write would.
    await scoped.runAsync(
      'INSERT INTO expenses (amount_minor, category, note, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [600, 'crypto', null, '2026-10-02', '2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z'],
    );

    const analytics = new AnalyticsRepository(scoped);
    const categories = await analytics.getCategoryTotals({
      fromKey: '2026-10-01',
      toKey: '2026-10-31',
    });

    assert.deepEqual(categories, [{ category: 'other', totalPaise: 600, entryCount: 1 }]);

    scoped.close();
  });

  it('can return two rows that both mean other, for the arithmetic layer to merge', async () => {
    const scoped = createTestDatabase();
    await runMigrations(scoped);

    const insert = (category: string, paise: number) =>
      scoped.runAsync(
        'INSERT INTO expenses (amount_minor, category, note, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [paise, category, null, '2026-10-02', '2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z'],
      );

    await insert('crypto', 600);
    await insert('other', 400);

    const categories = await new AnalyticsRepository(scoped).getCategoryTotals({
      fromKey: '2026-10-01',
      toKey: '2026-10-31',
    });

    // Both resolve to `other`, and SQL cannot merge them because the column
    // holds free text. The merge happens above this layer, where it can see the
    // resolved ids.
    assert.deepEqual(
      categories.map((row) => row.totalPaise).reduce((sum, value) => sum + value, 0),
      1000,
    );

    scoped.close();
  });
});

describe('AnalyticsRepository.getDailyTotals', () => {
  let db: TestDatabase;
  let analytics: AnalyticsRepository;

  before(async () => {
    const seededDb = await seeded();
    db = seededDb.db;
    analytics = seededDb.analytics;
  });

  after(() => {
    db.close();
  });

  it('returns one row per day with spending, oldest first', async () => {
    const days = await analytics.getDailyTotals({ fromKey: '2026-10-01', toKey: '2026-10-31' });

    assert.deepEqual(days, [
      { dateKey: '2026-10-04', totalPaise: 2000 },
      { dateKey: '2026-10-06', totalPaise: 1000 },
      { dateKey: '2026-10-12', totalPaise: 8000 },
      { dateKey: '2026-10-14', totalPaise: 1500 },
    ]);
  });

  it('adds up several entries filed on the same day', async () => {
    const scoped = createTestDatabase();
    await runMigrations(scoped);
    const expenses = new ExpenseRepository(scoped);

    await expenses.insert(expense({ amountPaise: 250, dateKey: '2026-10-06' }));
    await expenses.insert(expense({ amountPaise: 300, dateKey: '2026-10-06', category: 'transport' }));
    await expenses.insert(expense({ amountPaise: 450, dateKey: '2026-10-07' }));

    const days = await new AnalyticsRepository(scoped).getDailyTotals({
      fromKey: '2026-10-06',
      toKey: '2026-10-07',
    });

    assert.deepEqual(days, [
      { dateKey: '2026-10-06', totalPaise: 550 },
      { dateKey: '2026-10-07', totalPaise: 450 },
    ]);

    scoped.close();
  });

  it('leaves days without spending out, so the trend is the layer that fills the gaps', async () => {
    const days = await analytics.getDailyTotals({ fromKey: '2026-10-01', toKey: '2026-10-06' });

    assert.deepEqual(
      days.map((day) => day.dateKey),
      ['2026-10-04', '2026-10-06'],
    );
  });

  it('agrees with the monthly total it is drawn from', async () => {
    const periods = resolveAnalyticsPeriods(new Date(2026, 9, 20));

    const days = await analytics.getDailyTotals(periods.month);
    const totals = await analytics.getPeriodTotals(new Date(2026, 9, 20));

    const summed = days.reduce((sum, day) => sum + day.totalPaise, 0);

    assert.equal(summed, totals.monthPaise);
  });

  it('answers only the range it was asked about', async () => {
    const days = await analytics.getDailyTotals({ fromKey: '2026-10-05', toKey: '2026-10-12' });

    assert.deepEqual(
      days.map((day) => day.dateKey),
      ['2026-10-06', '2026-10-12'],
    );
  });

  it('is not changed by an edit or a delete elsewhere', async () => {
    const scoped = createTestDatabase();
    await runMigrations(scoped);
    const expenses = new ExpenseRepository(scoped);
    const analytics = new AnalyticsRepository(scoped);

    const entry = await expenses.insert(expense({ amountPaise: 1000 }));
    await expenses.insert(expense({ amountPaise: 2000 }));

    const range = { fromKey: '2026-10-01', toKey: '2026-10-31' };

    assert.equal((await analytics.getDailyTotals(range))[0]?.totalPaise, 3000);

    await expenses.update(entry.id, { ...expense({ amountPaise: 500 }) });

    assert.equal((await analytics.getDailyTotals(range))[0]?.totalPaise, 2500);

    await expenses.remove(entry.id);

    const afterDelete = await analytics.getDailyTotals(range);

    assert.equal(afterDelete.length, 1);
    assert.equal(afterDelete[0]?.totalPaise, 2000);

    scoped.close();
  });
});