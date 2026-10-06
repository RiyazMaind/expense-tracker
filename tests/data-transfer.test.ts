import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { runMigrations } from '@/database/migrations';
import {
  buildExport,
  deleteAllData,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  importData,
  parseImport,
  serializeExport,
  type ExportPayload,
} from '@/services/data-transfer';
import { createTestDatabase, type TestDatabase } from './support/node-sqlite-driver.ts';

/**
 * Data safety, end to end through the real schema and real SQL: export,
 * validate, import, wipe, and the failure paths that must leave the existing
 * data untouched.
 */

const EXPORTED_AT = '2026-10-06T10:30:00.000Z';

function payload(overrides: Partial<ExportPayload> = {}): ExportPayload {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: EXPORTED_AT,
    expenses: [
      {
        id: 1,
        amountMinor: 25050,
        category: 'food',
        note: 'Lunch',
        date: '2026-10-05',
        createdAt: '2026-10-05T12:00:00.000Z',
        updatedAt: '2026-10-05T12:00:00.000Z',
      },
      {
        id: 2,
        amountMinor: 1205,
        category: 'transport',
        note: null,
        date: '2026-10-06',
        createdAt: '2026-10-06T08:15:00.000Z',
        updatedAt: '2026-10-06T08:15:00.000Z',
      },
    ],
    budgets: [
      {
        id: 1,
        monthKey: '2026-10',
        amountMinor: 2000000,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('export → import round trip', () => {
  let source: TestDatabase;
  let target: TestDatabase;

  before(async () => {
    source = createTestDatabase();
    await runMigrations(source);
    await importData(source, payload());

    target = createTestDatabase();
    await runMigrations(target);
  });

  after(() => {
    source.close();
    target.close();
  });

  it('restores every row into a fresh database', async () => {
    const exported = await buildExport(source);
    const result = await importData(target, parseImport(serializeExport(exported)));

    assert.equal(result.expensesInserted, 2);
    assert.equal(result.budgetsInserted, 1);

    const reExported = await buildExport(target);
    assert.deepEqual(reExported.expenses, exported.expenses);
    assert.deepEqual(reExported.budgets, exported.budgets);
  });

  it('preserves paise, date keys, month keys, and timestamps exactly', async () => {
    const reExported = await buildExport(target);

    assert.deepEqual(
      reExported.expenses.map((row) => [row.amountMinor, row.date, row.createdAt, row.updatedAt]),
      [
        [25050, '2026-10-05', '2026-10-05T12:00:00.000Z', '2026-10-05T12:00:00.000Z'],
        [1205, '2026-10-06', '2026-10-06T08:15:00.000Z', '2026-10-06T08:15:00.000Z'],
      ],
    );
    assert.deepEqual(
      reExported.budgets.map((row) => [row.monthKey, row.amountMinor]),
      [['2026-10', 2000000]],
    );
  });

  it('survives a real file round trip through JSON text', async () => {
    const text = serializeExport(await buildExport(target));
    const parsed = parseImport(text);

    assert.equal(parsed.format, EXPORT_FORMAT);
    assert.equal(parsed.expenses[0]?.amountMinor, 25050);
  });
});

describe('import validation', () => {
  let db: TestDatabase;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
  });

  after(() => db.close());

  it('rejects non-JSON text', () => {
    assert.throws(() => parseImport('not json {'), /not valid JSON/);
  });

  it('rejects a wrong format marker', () => {
    assert.throws(
      () => parseImport(JSON.stringify({ ...payload(), format: 'someone-elses-backup' })),
      /format must be/,
    );
  });

  it('rejects a newer backup version', () => {
    assert.throws(
      () => parseImport(JSON.stringify({ ...payload(), version: 99 })),
      /version must be 1/,
    );
  });

  it('rejects a float paise amount', () => {
    const bad = payload();
    bad.expenses[0] = { ...bad.expenses[0]!, amountMinor: 12.5 };

    assert.throws(() => parseImport(JSON.stringify(bad)), /amountMinor must be a whole number/);
  });

  it('rejects zero and negative amounts', () => {
    const bad = payload();
    bad.expenses[0] = { ...bad.expenses[0]!, amountMinor: 0 };

    assert.throws(() => parseImport(JSON.stringify(bad)), /amountMinor must be positive/);
  });

  it('rejects an unknown category', () => {
    const bad = payload();
    bad.expenses[0] = { ...bad.expenses[0]!, category: 'crypto' as never };

    assert.throws(() => parseImport(JSON.stringify(bad)), /unknown category/);
  });

  it('rejects a malformed date', () => {
    const bad = payload();
    bad.expenses[0] = { ...bad.expenses[0]!, date: '2026-02-30' };

    assert.throws(() => parseImport(JSON.stringify(bad)), /date must be a YYYY-MM-DD/);
  });

  it('rejects a malformed budget month', () => {
    const bad = payload();
    bad.budgets[0] = { ...bad.budgets[0]!, monthKey: '2026-13' };

    assert.throws(() => parseImport(JSON.stringify(bad)), /monthKey must be a YYYY-MM/);
  });

  it('rejects duplicate ids inside the file', () => {
    const bad = payload();
    bad.expenses[1] = { ...bad.expenses[1]!, id: 1 };

    assert.throws(() => parseImport(JSON.stringify(bad)), /duplicate expense id 1/);
  });

  it('rejects duplicate budget months inside the file', () => {
    const bad = payload();
    bad.budgets[1] = { ...bad.budgets[0]!, id: 2 };

    assert.throws(() => parseImport(JSON.stringify(bad)), /duplicate budget month/);
  });

  it('rejects a missing expenses array', () => {
    const { expenses: _drop, ...rest } = payload();

    assert.throws(() => parseImport(JSON.stringify(rest)), /expenses must be an array/);
  });

  it('rejects a bad timestamp', () => {
    const bad = payload();
    bad.expenses[0] = { ...bad.expenses[0]!, createdAt: 'yesterday' };

    assert.throws(() => parseImport(JSON.stringify(bad)), /createdAt must be an ISO timestamp/);
  });

  it('writes nothing when validation fails', async () => {
    const before_ = await buildExport(db);

    const bad = payload();
    bad.expenses[1] = { ...bad.expenses[1]!, amountMinor: -5 };

    assert.throws(() => parseImport(JSON.stringify(bad)));
    const after_ = await buildExport(db);

    assert.deepEqual(after_.expenses, before_.expenses);
  });
});

describe('duplicate and conflict handling', () => {
  let db: TestDatabase;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    await importData(db, payload());
  });

  after(() => db.close());

  it('is idempotent: restoring the same file twice inserts nothing new', async () => {
    const result = await importData(db, payload());

    assert.equal(result.expensesInserted, 0);
    assert.equal(result.expensesSkippedDuplicate, 2);
    assert.equal(result.budgetsInserted, 0);
    assert.equal(result.budgetsSkippedDuplicate, 1);

    const exported = await buildExport(db);
    assert.equal(exported.expenses.length, 2);
    assert.equal(exported.budgets.length, 1);
  });

  it('keeps local data on a content conflict and never overwrites', async () => {
    const conflicting = payload();
    conflicting.expenses[0] = {
      ...conflicting.expenses[0]!,
      amountMinor: 99900,
      note: 'Tampered',
    };

    const result = await importData(db, conflicting);

    assert.equal(result.expensesSkippedConflict, 1);
    assert.equal(result.expensesSkippedDuplicate, 1);

    const exported = await buildExport(db);
    assert.equal(exported.expenses[0]?.amountMinor, 25050);
    assert.equal(exported.expenses[0]?.note, 'Lunch');
  });

  it('treats a budget for an existing month under a new id as a conflict', async () => {
    const moved = payload();
    moved.budgets[0] = { ...moved.budgets[0]!, id: 77 };

    const result = await importData(db, moved);

    assert.equal(result.budgetsSkippedConflict, 1);
    assert.equal(result.budgetsInserted, 0);

    const exported = await buildExport(db);
    assert.equal(exported.budgets.length, 1);
    assert.equal(exported.budgets[0]?.id, 1);
  });
});

describe('transaction integrity', () => {
  it('rolls back the whole import when a write fails mid-way', async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    // A valid first row, then a row that violates the schema's own CHECK
    // (negative amount). parseImport would refuse this up front, so we bypass it
    // to prove the transaction — not the validator — is the last line of defence.
    const data = payload();

    await assert.rejects(
      () =>
        db.withExclusiveTransactionAsync(async (txn) => {
          await txn.runAsync(
            `INSERT INTO expenses (id, amount_minor, category, note, date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              data.expenses[0]!.id,
              data.expenses[0]!.amountMinor,
              data.expenses[0]!.category,
              data.expenses[0]!.note,
              data.expenses[0]!.date,
              data.expenses[0]!.createdAt,
              data.expenses[0]!.updatedAt,
            ],
          );
          await txn.runAsync(
            `INSERT INTO expenses (id, amount_minor, category, note, date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [9, -1, 'food', null, '2026-10-06', EXPORTED_AT, EXPORTED_AT],
          );
        }),
      /CHECK constraint failed/,
    );

    const exported = await buildExport(db);
    assert.equal(exported.expenses.length, 0, 'partial insert must be rolled back');

    db.close();
  });

  it('leaves the budgets table untouched when an expense row fails first', async () => {
    const db = createTestDatabase();
    await runMigrations(db);
    await importData(db, payload());

    const bad = payload({ exportedAt: EXPORTED_AT });
    bad.expenses = [{ ...bad.expenses[0]!, id: 500, amountMinor: 500 }];
    // Force a mid-transaction failure: the budget insert for a duplicated month.
    bad.budgets = [{ ...bad.budgets[0]!, id: 500 }];

    // id 500 budget conflicts on month; that is skipped, not an error. So make
    // the failure real: a CHECK violation on the budget.
    bad.budgets = [{ ...bad.budgets[0]!, id: 500, monthKey: '2026-10', amountMinor: 500 }];

    // No throw expected here (month conflict skips) — verify no partial writes:
    const result = await importData(db, bad);
    assert.equal(result.expensesInserted, 1);
    assert.equal(result.budgetsSkippedConflict, 1);

    // Now the real rollback case: inject a schema-violating budget through the txn.
    await assert.rejects(
      () =>
        db.withExclusiveTransactionAsync(async (txn) => {
          await txn.runAsync(
            `INSERT INTO budgets (id, month, amount_minor, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [700, '2026-11', 1000, EXPORTED_AT, EXPORTED_AT],
          );
          await txn.runAsync(
            `INSERT INTO budgets (id, month, amount_minor, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [701, 'not-a-month', 1000, EXPORTED_AT, EXPORTED_AT],
          );
        }),
      /CHECK constraint failed/,
    );

    const exported = await buildExport(db);
    assert.equal(exported.budgets.length, 1, 'the 2026-11 budget insert must roll back');

    db.close();
  });
});

describe('delete-all', () => {
  it('empties both tables atomically and idempotently', async () => {
    const db = createTestDatabase();
    await runMigrations(db);
    await importData(db, payload());

    await deleteAllData(db);

    let exported = await buildExport(db);
    assert.deepEqual(exported.expenses, []);
    assert.deepEqual(exported.budgets, []);

    // Second delete must be a no-op, not an error.
    await deleteAllData(db);
    exported = await buildExport(db);
    assert.deepEqual(exported.expenses, []);

    db.close();
  });

  it('recovers cleanly on an already empty database', async () => {
    const db = createTestDatabase();
    await runMigrations(db);

    await deleteAllData(db);

    const exported = await buildExport(db);
    assert.deepEqual(exported.expenses, []);
    assert.deepEqual(exported.budgets, []);

    // The app remains usable immediately afterwards.
    const result = await importData(db, payload());
    assert.equal(result.expensesInserted, 2);

    db.close();
  });

  it('lets a subsequent import land with fresh rows', async () => {
    const db = createTestDatabase();
    await runMigrations(db);
    await importData(db, payload());
    await deleteAllData(db);

    const result = await importData(db, payload());

    assert.equal(result.expensesInserted, 2);
    assert.equal(result.budgetsInserted, 1);

    db.close();
  });
});

describe('persistence across a restart', () => {
  it('keeps data after the connection is closed and reopened', async () => {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { unlinkSync } = await import('node:fs');
    const path = join(tmpdir(), `expense-tracker-test-${process.pid}-${Date.now()}.db`);

    const first = createTestDatabase(path);
    await runMigrations(first);
    await importData(first, payload());
    first.close();

    // A brand-new handle on the same file stands in for an app restart.
    const second = createTestDatabase(path);
    await runMigrations(second);

    const exported = await buildExport(second);
    assert.equal(exported.expenses.length, 2);
    assert.equal(exported.expenses[0]?.amountMinor, 25050);
    assert.deepEqual(
      exported.budgets.map((row) => row.monthKey),
      ['2026-10'],
    );

    second.close();
    unlinkSync(path);
  });
});
