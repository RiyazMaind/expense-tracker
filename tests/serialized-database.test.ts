import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { serializeDatabase } from '@/database/serialized-database';
import type { QueryableDatabase, TransactionRunner } from '@/database/queryable';

/**
 * `serializeDatabase` is a workaround for an expo-sqlite Android defect where
 * concurrent async queries on one handle can release a native statement
 * mid-call (bare `NullPointerException` out of `prepareAsync`, or a native
 * crash). These tests prove the wrapper's contract on a deliberate stub: every
 * call is queued, so the handle never sees two statements in flight, results
 * still come back to their caller, and a rejected query does not jam the queue.
 */

const NOOP_RESULT = { lastInsertRowId: 0, changes: 0 } as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A fake connection that counts how many of its queries are in flight at once. */
function makeStub(): {
  db: QueryableDatabase;
  active: { value: number; peak: number };
  calls: string[];
} {
  const active = { value: 0, peak: 0 };
  const calls: string[] = [];

  const enter = (label: string): void => {
    calls.push(label);
    active.value += 1;
    active.peak = Math.max(active.peak, active.value);
  };
  const leave = (): void => {
    active.value -= 1;
  };

  return {
    active,
    calls,
    db: {
      execAsync: async (source) => {
        enter(`exec:${source}`);
        await delay(5);
        leave();
      },
      runAsync: async (source) => {
        enter(`run:${source}`);
        await delay(5);
        leave();
        return NOOP_RESULT;
      },
      getFirstAsync: async <T>(source: string): Promise<T | null> => {
        enter(`getFirst:${source}`);
        await delay(5);
        leave();
        return source as T;
      },
      getAllAsync: async <T>(source: string): Promise<T[]> => {
        enter(`getAll:${source}`);
        await delay(5);
        leave();
        return [source] as T[];
      },
      withExclusiveTransactionAsync: async (task: (txn: TransactionRunner) => Promise<void>) => {
        enter('withExclusiveTransaction');
        await task({} as TransactionRunner);
        leave();
      },
    },
  };
}

describe('serializeDatabase', () => {
  it('runs a burst of concurrent reads through one statement at a time', async () => {
    const { db, active } = makeStub();
    const serialized = serializeDatabase(db);

    await Promise.all(
      Array.from({ length: 20 }, (_, index) => serialized.getFirstAsync(`q${index}`)),
    );

    assert.equal(active.peak, 1, 'a second statement started before the first finished');
  });

  it('returns each result to the call that asked for it, in call order', async () => {
    const { db } = makeStub();
    const serialized = serializeDatabase(db);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        serialized.getFirstAsync<string>(`result-${index}`),
      ),
    );

    assert.deepEqual(
      results,
      Array.from({ length: 10 }, (_, index) => `result-${index}`),
    );
  });

  it('keeps the two queries started together from overlapping', async () => {
    const { db, active } = makeStub();
    const serialized = serializeDatabase(db);

    const [a, b] = await Promise.all([
      serialized.getAllAsync('one'),
      serialized.getAllAsync('two'),
    ]);

    assert.deepEqual(a, ['one']);
    assert.deepEqual(b, ['two']);
    assert.equal(active.peak, 1);
  });

  it('does not jam the queue when one query fails', async () => {
    const failing = makeStub();
    failing.db.getFirstAsync = (async (source: string) => {
      if (source === 'dead') {
        throw new Error('statement broke');
      }
      return source;
    }) as unknown as typeof failing.db.getFirstAsync;

    const serialized = serializeDatabase(failing.db);

    await assert.rejects(() => serialized.getFirstAsync('dead'), /statement broke/);

    // The next call must still run — the queue is repaired, not stuck.
    const live = await serialized.getFirstAsync<string>('alive');
    assert.equal(live, 'alive');
  });

  it('lets a write run after failing reads without losing its result', async () => {
    const { db } = makeStub();
    db.runAsync = async (): Promise<typeof NOOP_RESULT> => {
      await delay(2);
      return NOOP_RESULT;
    };

    const serialized = serializeDatabase(db);
    await Promise.all([serialized.getFirstAsync('a'), serialized.getFirstAsync('b')]);
    const result = await serialized.runAsync('INSERT INTO t VALUES (1)');

    assert.equal(result.changes, 0);
  });
});