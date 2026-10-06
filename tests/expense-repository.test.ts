import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { MIGRATIONS, readSchemaVersion, runMigrations } from '@/database/migrations';
import {
  ExpenseRepository,
  type NewExpense,
} from '@/database/repositories/expense-repository';
import { createTestDatabase, type TestDatabase } from './support/node-sqlite-driver.ts';

/**
 * The `expenses` table and every query that touches it, run against real SQLite.
 *
 * The reference date is Tuesday 6 October 2026, chosen because it sits inside a
 * week that started two days earlier and a month that started five — so a period
 * boundary error shows up as a wrong total rather than being masked.
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

describe('migrations', () => {
  let db: TestDatabase;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
  });

  after(() => {
    db.close();
  });

  it('records the latest version in the database file', async () => {
    assert.equal(await readSchemaVersion(db), MIGRATIONS.at(-1)?.version);
  });

  it('is idempotent, and leaves existing rows alone', async () => {
    const repository = new ExpenseRepository(db);
    const inserted = await repository.insert(expense({ amountPaise: 777 }));

    // Second pass must not drop and recreate the table.
    await runMigrations(db);

    assert.equal(await readSchemaVersion(db), MIGRATIONS.at(-1)?.version);
    assert.equal((await repository.getById(inserted.id))?.amountMinor, 777);
  });

  it('refuses to run against a schema newer than this build understands', async () => {
    const future = createTestDatabase();
    await future.execAsync('PRAGMA user_version = 99');

    await assert.rejects(() => runMigrations(future), /version 99/);

    future.close();
  });

  it('creates the indexes the dashboard and the category views rely on', async () => {
    const rows = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'expenses'",
    );
    const names = rows.map((row) => row.name);

    assert.ok(names.includes('expenses_date_idx'), `missing expenses_date_idx in ${names.join(', ')}`);
    assert.ok(
      names.includes('expenses_category_date_idx'),
      `missing expenses_category_date_idx in ${names.join(', ')}`,
    );
  });
});

describe('ExpenseRepository against an empty database', () => {
  let db: TestDatabase;
  let repository: ExpenseRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    repository = new ExpenseRepository(db);
  });

  after(() => {
    db.close();
  });

  it('reports zeros rather than nulls when nothing has been recorded', async () => {
    assert.deepEqual(await repository.getSummary(TODAY), {
      todayPaise: 0,
      weekPaise: 0,
      monthPaise: 0,
      expenseCount: 0,
    });
  });

  it('returns no expenses for a range', async () => {
    assert.deepEqual(await repository.listInRange({ fromKey: '2026-01-01', toKey: '2026-12-31' }), []);
  });

  it('reports no earliest month when nothing has been recorded', async () => {
    assert.equal(await repository.getEarliestMonthKey(), null);
  });
});

describe('ExpenseRepository.insert', () => {
  let db: TestDatabase;
  let repository: ExpenseRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    repository = new ExpenseRepository(db);
  });

  after(() => {
    db.close();
  });

  it('stores the entry and reads it back with an id', async () => {
    const saved = await repository.insert(
      expense({ amountPaise: 25050, category: 'transport', note: 'Auto fare' }),
    );

    assert.ok(saved.id > 0);
    assert.equal(saved.amountMinor, 25050);
    assert.equal(saved.category, 'transport');
    assert.equal(saved.note, 'Auto fare');
    assert.equal(saved.date, '2026-10-06');

    assert.deepEqual(await repository.getById(saved.id), saved);
  });

  it('records created_at and updated_at as the same ISO instant', async () => {
    const saved = await repository.insert(expense());

    assert.equal(saved.createdAt, saved.updatedAt);
    assert.match(saved.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const parsed = Date.parse(saved.createdAt);
    assert.ok(!Number.isNaN(parsed), 'created_at must be a parseable timestamp');

    // Close to now, so a placeholder such as 'now' or a zeroed epoch fails here.
    assert.ok(
      Math.abs(Date.now() - parsed) < 60_000,
      `created_at should be the moment of the insert, got ${saved.createdAt}`,
    );
  });

  it('stores a blank note as null rather than as whitespace', async () => {
    const saved = await repository.insert(expense({ note: '   ' }));

    assert.equal(saved.note, null);
  });

  it('trims a note that has content', async () => {
    const saved = await repository.insert(expense({ note: '  lunch  ' }));

    assert.equal(saved.note, 'lunch');
  });

  it('assigns a distinct id to each row', async () => {
    const first = await repository.insert(expense());
    const second = await repository.insert(expense());

    assert.notEqual(first.id, second.id);
  });

  it('rejects an amount that is not positive whole paise', async () => {
    await assert.rejects(() => repository.insert(expense({ amountPaise: 0 })), /positive whole/);
    await assert.rejects(() => repository.insert(expense({ amountPaise: -1 })), /positive whole/);
    // 12.50 rupees as a float: exactly the mistake the integer column exists to stop.
    await assert.rejects(() => repository.insert(expense({ amountPaise: 12.5 })), /positive whole/);
  });

  it('rejects a category outside the known set', async () => {
    await assert.rejects(
      () =>
        repository.insert(
          expense({ category: 'crypto' as unknown as NewExpense['category'] }),
        ),
      /Unknown expense category/,
    );
  });

  it('rejects a date that is not a real calendar day', async () => {
    await assert.rejects(() => repository.insert(expense({ dateKey: '2026-02-30' })), /YYYY-MM-DD/);
    await assert.rejects(() => repository.insert(expense({ dateKey: 'yesterday' })), /YYYY-MM-DD/);
    await assert.rejects(() => repository.insert(expense({ dateKey: '2026-1-6' })), /YYYY-MM-DD/);
  });

  it('enforces the same rules at the SQL level, bypassing the guards', async () => {
    // Proves the CHECK constraints, not just the TypeScript above them.
    await assert.rejects(
      () =>
        db.runAsync(
          'INSERT INTO expenses (amount_minor, category, note, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [-1, 'food', null, '2026-10-06', 'now', 'now'],
        ),
      /CHECK constraint failed/,
    );

    await assert.rejects(
      () =>
        db.runAsync(
          'INSERT INTO expenses (amount_minor, category, note, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [1000, 'food', null, '2026-13-45', 'now', 'now'],
        ),
      /CHECK constraint failed/,
    );
  });
});

describe('ExpenseRepository.getSummary', () => {
  let db: TestDatabase;
  let repository: ExpenseRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    repository = new ExpenseRepository(db);

    await repository.insert(expense({ amountPaise: 1000, dateKey: '2026-10-06' })); // Tuesday
    await repository.insert(expense({ amountPaise: 2000, dateKey: '2026-10-04' })); // Sunday, previous week
    await repository.insert(expense({ amountPaise: 3000, dateKey: '2026-09-28' })); // Monday, previous week
    await repository.insert(expense({ amountPaise: 4000, dateKey: '2026-09-30' })); // previous month
    await repository.insert(expense({ amountPaise: 8000, dateKey: '2026-10-12' })); // Monday, next week
    await repository.insert(expense({ amountPaise: 1500, dateKey: '2026-10-14' })); // Wednesday, same week
  });

  after(() => {
    db.close();
  });

  it('adds up today only', async () => {
    assert.equal((await repository.getSummary(TODAY)).todayPaise, 1000);
  });

  it('starts the week on Monday, so Sunday belongs to the week before', async () => {
    const summary = await repository.getSummary(TODAY);

    assert.equal(summary.weekPaise, 1000);
  });

  it('swings the week forward on the next Monday', async () => {
    const summary = await repository.getSummary(new Date(2026, 9, 12));

    // Today is Monday the 12th alone; the week reaches the 14th as well.
    assert.equal(summary.todayPaise, 8000);
    assert.equal(summary.weekPaise, 9500);
  });

  it('adds up the month, excluding the last day of the previous one', async () => {
    const summary = await repository.getSummary(TODAY);

    // 1000 (6th) + 2000 (4th) + 8000 (12th) + 1500 (14th).
    // The 4,000 on 30 September is out.
    assert.equal(summary.monthPaise, 12500);
  });

  it('counts every expense, not just the current month', async () => {
    const summary = await repository.getSummary(TODAY);

    assert.equal(summary.expenseCount, 6);
  });

  it('keeps the three totals consistent with one another', async () => {
    const summary = await repository.getSummary(TODAY);

    assert.ok(summary.todayPaise <= summary.weekPaise);
    assert.ok(summary.weekPaise <= summary.monthPaise);
  });

  it('resolves periods relative to the reading it is given', async () => {
    const october = await repository.getSummary(new Date(2026, 9, 20));
    const september = await repository.getSummary(new Date(2026, 8, 20));

    assert.equal(october.monthPaise, 12500);
    assert.equal(september.monthPaise, 7000);
  });

  it('follows the month across a year boundary', async () => {
    const december = createTestDatabase();
    await runMigrations(december);
    const scoped = new ExpenseRepository(december);

    await scoped.insert(expense({ amountPaise: 500, dateKey: '2026-12-31' }));
    await scoped.insert(expense({ amountPaise: 700, dateKey: '2027-01-01' }));

    assert.equal((await scoped.getSummary(new Date(2026, 11, 31))).monthPaise, 500);
    assert.equal((await scoped.getSummary(new Date(2027, 0, 1))).monthPaise, 700);

    december.close();
  });

  it('counts paise exactly, with no floating point drift', async () => {
    const precise = createTestDatabase();
    await runMigrations(precise);
    const scoped = new ExpenseRepository(precise);

    // 10 x 10paise would be 0.1 rupees, which a float-based total gets wrong.
    for (let index = 0; index < 10; index += 1) {
      await scoped.insert(expense({ amountPaise: 10 }));
    }

    assert.equal((await scoped.getSummary(TODAY)).todayPaise, 100);

    precise.close();
  });

  it('adds up across categories without mixing them up', async () => {
    const mixed = createTestDatabase();
    await runMigrations(mixed);
    const scoped = new ExpenseRepository(mixed);

    await scoped.insert(expense({ amountPaise: 1000, category: 'food' }));
    await scoped.insert(expense({ amountPaise: 2000, category: 'bills' }));

    const saved = await scoped.listInRange({ fromKey: '2026-10-01', toKey: '2026-10-31' });

    assert.deepEqual(
      saved.map((row) => [row.category, row.amountMinor]),
      [
        ['bills', 2000],
        ['food', 1000],
      ],
    );

    mixed.close();
  });
});

describe('ExpenseRepository.getEarliestMonthKey', () => {
  let db: TestDatabase;
  let repository: ExpenseRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    repository = new ExpenseRepository(db);

    // Inserted newest first on purpose: MIN(date) must not depend on row order.
    await repository.insert(expense({ amountPaise: 1000, dateKey: '2026-10-06' }));
    await repository.insert(expense({ amountPaise: 2000, dateKey: '2025-12-31' }));
    await repository.insert(expense({ amountPaise: 3000, dateKey: '2026-09-30' }));
  });

  after(() => {
    db.close();
  });

  it('returns the earliest month that has expenses, not the first inserted', async () => {
    assert.equal(await repository.getEarliestMonthKey(), '2025-12');
  });

  it('re-answers once the earliest month is deleted', async () => {
    const [december] = await repository.listInRange({ fromKey: '2025-12-01', toKey: '2025-12-31' });

    assert.ok(december != null, 'the December expense must exist');

    await repository.remove(december.id);

    assert.equal(await repository.getEarliestMonthKey(), '2026-09');
  });
});

describe('ExpenseRepository.listInRange', () => {
  let db: TestDatabase;
  let repository: ExpenseRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    repository = new ExpenseRepository(db);

    // Inserted out of order, so the result cannot be an artefact of insertion.
    await repository.insert(expense({ amountPaise: 300, dateKey: '2026-10-05' }));
    await repository.insert(expense({ amountPaise: 100, dateKey: '2026-10-06' }));
    await repository.insert(expense({ amountPaise: 200, dateKey: '2026-10-06' }));
  });

  after(() => {
    db.close();
  });

  it('returns the range newest first', async () => {
    const rows = await repository.listInRange({ fromKey: '2026-10-01', toKey: '2026-10-31' });

    assert.deepEqual(
      rows.map((row) => row.amountMinor),
      [200, 100, 300],
    );
  });

  it('treats both bounds as inclusive', async () => {
    const rows = await repository.listInRange({ fromKey: '2026-10-05', toKey: '2026-10-05' });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.date, '2026-10-05');
  });
});

/**
 * Paging, editing and deleting — what the history screen and the detail screen
 * depend on. `listRecent` is built on LIMIT/OFFSET, so the tests that matter most
 * are the ones about what happens *between* pages: a row that repeats or vanishes
 * while scrolling is invisible to any single-page assertion.
 */
describe('ExpenseRepository.listRecent', () => {
  let db: TestDatabase;
  let repository: ExpenseRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    repository = new ExpenseRepository(db);

    // Two on the same day, so the id tiebreak is exercised too: without it, the
    // order of same-day rows is not defined and paging can skip one.
    await repository.insert(expense({ amountPaise: 100, dateKey: '2026-10-06' }));
    await repository.insert(expense({ amountPaise: 200, dateKey: '2026-10-06' }));
    await repository.insert(expense({ amountPaise: 300, dateKey: '2026-10-05' }));
    await repository.insert(expense({ amountPaise: 400, dateKey: '2026-10-04' }));
    await repository.insert(expense({ amountPaise: 500, dateKey: '2026-10-03' }));
  });

  after(() => {
    db.close();
  });

  it('returns the newest first', async () => {
    const page = await repository.listRecent();

    assert.deepEqual(
      page.expenses.map((row) => row.amountMinor),
      [200, 100, 300, 400, 500],
    );
  });

  it('says there is more when there is more', async () => {
    const page = await repository.listRecent({ limit: 2 });

    assert.equal(page.expenses.length, 2);
    assert.equal(page.hasMore, true);
  });

  it('says there is no more on the page that reaches the end', async () => {
    const page = await repository.listRecent({ limit: 2, offset: 4 });

    assert.deepEqual(
      page.expenses.map((row) => row.amountMinor),
      [500],
    );
    assert.equal(page.hasMore, false);
  });

  it('does not leak the extra row it reads to detect the end', async () => {
    // The page past the end is read with one row more than asked for, so a full
    // page must still return exactly what was requested.
    const page = await repository.listRecent({ limit: 5 });

    assert.equal(page.expenses.length, 5);
    assert.equal(page.hasMore, false);
  });

  it('pages through every row exactly once', async () => {
    const seen: number[] = [];

    for (let offset = 0; offset < 10; offset += 2) {
      const page: Awaited<ReturnType<ExpenseRepository['listRecent']>> =
        await repository.listRecent({ limit: 2, offset });

      seen.push(...page.expenses.map((row) => row.amountMinor));

      if (!page.hasMore) {
        break;
      }
    }

    assert.deepEqual(seen, [200, 100, 300, 400, 500]);
    assert.equal(new Set(seen).size, seen.length);
  });

  it('returns an empty page past the end rather than failing', async () => {
    const page = await repository.listRecent({ offset: 99 });

    assert.deepEqual(page.expenses, []);
    assert.equal(page.hasMore, false);
  });

  it('reports an empty history as empty, not as more to load', async () => {
    const empty = createTestDatabase();
    await runMigrations(empty);
    const scoped = new ExpenseRepository(empty);

    const page = await scoped.listRecent();

    assert.deepEqual(page, { expenses: [], hasMore: false });

    empty.close();
  });

  it('clamps a nonsense page size instead of asking for everything', async () => {
    // 0 would read nothing at all; negative would be a SQL error.
    const one = await repository.listRecent({ limit: 0 });
    assert.equal(one.expenses.length, 1);

    const negative = await repository.listRecent({ limit: -5 });
    assert.equal(negative.expenses.length, 1);

    // A negative offset is a read from before the start, so it clamps to the top.
    const fromTop = await repository.listRecent({ limit: 1, offset: -10 });
    assert.equal(fromTop.expenses[0]?.amountMinor, 200);
  });

  it('agrees with listInRange about what exists', async () => {
    const paged = await repository.listRecent();
    const ranged = await repository.listInRange({
      fromKey: '2026-01-01',
      toKey: '2026-12-31',
    });

    assert.deepEqual(paged.expenses, ranged);
  });
});

describe('ExpenseRepository.update', () => {
  let db: TestDatabase;
  let repository: ExpenseRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    repository = new ExpenseRepository(db);
  });

  after(() => {
    db.close();
  });

  it('rewrites every editable field and returns the row as stored', async () => {
    const original = await repository.insert(
      expense({ amountPaise: 1000, category: 'food', note: 'Lunch', dateKey: '2026-10-06' }),
    );

    const updated = await repository.update(original.id, {
      amountPaise: 4550,
      category: 'transport',
      note: 'Taxi',
      dateKey: '2026-10-01',
    });

    assert.equal(updated.id, original.id);
    assert.equal(updated.amountMinor, 4550);
    assert.equal(updated.category, 'transport');
    assert.equal(updated.note, 'Taxi');
    assert.equal(updated.date, '2026-10-01');
    assert.deepEqual(await repository.getById(original.id), updated);
  });

  it('moves the row to another day, and the totals follow it', async () => {
    const original = await repository.insert(expense({ amountPaise: 7000, dateKey: '2026-10-06' }));

    await repository.update(original.id, {
      amountPaise: 7000,
      category: 'food',
      note: null,
      dateKey: '2026-10-05',
    });

    const summary = await repository.getSummary(TODAY);

    assert.equal(summary.todayPaise, 0);
    // The 5th is inside the same week, so the week total is unchanged.
    assert.equal(summary.weekPaise, 7000);
  });

  it('leaves created_at alone and moves updated_at forward', async () => {
    const original = await repository.insert(expense({ amountPaise: 1000 }));

    // Timestamps are milliseconds, so the update has to land in a later one.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await repository.update(original.id, {
      amountPaise: 2000,
      category: 'food',
      note: null,
      dateKey: '2026-10-06',
    });

    assert.equal(updated.createdAt, original.createdAt);
    assert.notEqual(updated.updatedAt, original.updatedAt);
    assert.ok(
      Date.parse(updated.updatedAt) > Date.parse(original.updatedAt),
      `${updated.updatedAt} should be after ${original.updatedAt}`,
    );
  });

  it('stores a cleared note as null, exactly as an insert does', async () => {
    const original = await repository.insert(expense({ note: 'Something' }));

    const updated = await repository.update(original.id, {
      amountPaise: 1000,
      category: 'food',
      note: '   ',
      dateKey: '2026-10-06',
    });

    assert.equal(updated.note, null);
  });

  it('applies the same validation an insert does', async () => {
    const original = await repository.insert(expense());
    const valid = {
      amountPaise: 1000,
      category: 'food' as const,
      dateKey: '2026-10-06',
      note: null,
    };

    await assert.rejects(
      () => repository.update(original.id, { ...valid, amountPaise: 0 }),
      /positive whole/,
    );
    await assert.rejects(
      () => repository.update(original.id, { ...valid, category: 'crypto' as never }),
      /Unknown expense category/,
    );
    await assert.rejects(
      () => repository.update(original.id, { ...valid, dateKey: '2026-02-30' }),
      /YYYY-MM-DD/,
    );
  });

  it('leaves the row untouched when the update is rejected', async () => {
    const original = await repository.insert(expense({ amountPaise: 1000, note: 'Keep me' }));

    await assert.rejects(() =>
      repository.update(original.id, {
        amountPaise: -5,
        category: 'food',
        note: 'Lost',
        dateKey: '2026-10-06',
      }),
    );

    assert.deepEqual(await repository.getById(original.id), original);
  });

  it('rejects an id that is not a row, rather than reporting a silent success', async () => {
    await assert.rejects(
      () =>
        repository.update(4242, {
          amountPaise: 1000,
          category: 'food',
          note: null,
          dateKey: '2026-10-06',
        }),
      /no such expense/,
    );
  });

  it('rejects an unusable id before it reaches SQL', async () => {
    for (const id of [0, -1, 1.5]) {
      await assert.rejects(
        () =>
          repository.update(id, {
            amountPaise: 1000,
            category: 'food',
            note: null,
            dateKey: '2026-10-06',
          }),
        /positive whole number/,
      );
    }
  });
});

describe('ExpenseRepository.remove', () => {
  let db: TestDatabase;
  let repository: ExpenseRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    repository = new ExpenseRepository(db);
  });

  after(() => {
    db.close();
  });

  it('deletes the row and says it did', async () => {
    const saved = await repository.insert(expense({ amountPaise: 3000 }));

    assert.equal(await repository.remove(saved.id), true);
    assert.equal(await repository.getById(saved.id), null);
  });

  it('takes the row out of the totals', async () => {
    const first = await repository.insert(expense({ amountPaise: 1000 }));
    await repository.insert(expense({ amountPaise: 2000 }));

    assert.equal((await repository.getSummary(TODAY)).todayPaise, 3000);

    await repository.remove(first.id);

    const summary = await repository.getSummary(TODAY);

    assert.equal(summary.todayPaise, 2000);
    assert.equal(summary.expenseCount, 1);
  });

  it('leaves the other rows alone', async () => {
    const first = await repository.insert(expense({ amountPaise: 100 }));
    const second = await repository.insert(expense({ amountPaise: 200 }));

    await repository.remove(first.id);

    assert.equal((await repository.getById(second.id))?.amountMinor, 200);
  });

  it('reports an absent row as "nothing was removed" instead of throwing', async () => {
    // The detail screen has to be able to tell a delete from a double-delete
    // without treating the second one as a failure.
    assert.equal(await repository.remove(9999), false);
  });

  it('is not repeatable', async () => {
    const saved = await repository.insert(expense());

    assert.equal(await repository.remove(saved.id), true);
    assert.equal(await repository.remove(saved.id), false);
  });

  it('rejects an unusable id before it reaches SQL', async () => {
    for (const id of [0, -3, 2.25]) {
      await assert.rejects(() => repository.remove(id), /positive whole number/);
    }
  });
});