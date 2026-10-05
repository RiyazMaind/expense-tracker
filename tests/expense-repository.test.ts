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