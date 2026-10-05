import { DatabaseSync, type StatementSync } from 'node:sqlite';

import type { QueryableDatabase, TransactionRunner } from '@/database/queryable';

/**
 * A `QueryableDatabase` backed by Node's built-in SQLite instead of expo-sqlite.
 *
 * expo-sqlite is a native module: importing it under Node fails before it can
 * open anything, so a real database connection is unavailable to `node --test`.
 * This adapter stands in for the *driver* only — the schema, the migrations and
 * every query in `expense-repository.ts` are the ones that ship, running against
 * real SQLite.
 *
 * What it does not cover, and why that is acceptable: WAL journaling, statement
 * caching, and the native connection's thread affinity. Those belong to the
 * driver, and are exercised by the on-device check instead.
 */

/**
 * The parameter values this adapter can bind.
 *
 * expo-sqlite additionally accepts a `boolean` and a blob handle; node:sqlite
 * accepts a bigint and a `Uint8Array`. Neither library is asked for those here —
 * every bind in this data layer is a string, a number or null — so the two
 * vocabularies are reconciled to their common subset rather than papered over.
 */
type BindValue = string | number | null;

type TestBindParams = BindValue[] | Record<string, BindValue>;

type RunResult = { changes: number | bigint; lastInsertRowid: number | bigint };

type ReadResult = Record<string, unknown>[];

/**
 * node:sqlite and expo-sqlite both take parameters as an object, an array, or
 * nothing. They differ only in how those reach the statement: named parameters
 * go in as a single object, positional ones spread out.
 */
function runStatement(statement: StatementSync, params: TestBindParams | undefined): RunResult {
  if (params === undefined) {
    return statement.run();
  }

  if (Array.isArray(params)) {
    return statement.run(...params);
  }

  return statement.run(params);
}

function readStatement(statement: StatementSync, params: TestBindParams | undefined): ReadResult {
  if (params === undefined) {
    return statement.all();
  }

  if (Array.isArray(params)) {
    return statement.all(...params);
  }

  return statement.all(params);
}

/**
 * node:sqlite hands back rows with a null prototype. Copied into ordinary objects
 * so `assert.deepStrictEqual` can compare them against plain literals — it checks
 * prototypes, and would fail every comparison otherwise.
 */
function toPlainRow(row: unknown): Record<string, unknown> {
  return { ...(row as Record<string, unknown>) };
}

export type TestDatabase = QueryableDatabase & {
  /** Release the in-memory database. */
  close: () => void;
};

/** A migrated, empty, in-memory database — one per suite. */
export function createTestDatabase(): TestDatabase {
  const db = new DatabaseSync(':memory:');

  const runner: QueryableDatabase = {
    async execAsync(source: string) {
      db.exec(source);
    },

    async runAsync(source: string, params?: TestBindParams) {
      const result = runStatement(db.prepare(source), params);

      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },

    async getFirstAsync<T>(source: string, params?: TestBindParams) {
      const [row] = readStatement(db.prepare(source), params);

      return row == null ? null : (toPlainRow(row) as T);
    },

    async getAllAsync<T>(source: string, params?: TestBindParams) {
      return readStatement(db.prepare(source), params).map((row) => toPlainRow(row) as T);
    },

    async withExclusiveTransactionAsync(task: (txn: TransactionRunner) => Promise<void>) {
      // Mirrors expo-sqlite's exclusive transaction: one connection, explicit
      // BEGIN/COMMIT, and ROLLBACK on any throw so a failed migration cannot
      // leave the schema half-applied.
      db.exec('BEGIN');

      try {
        await task(runner);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return { ...runner, close: () => db.close() };
}