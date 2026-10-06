import type { SQLiteBindParams, SQLiteRunResult } from 'expo-sqlite';

/**
 * The exact slice of the expo-sqlite API this data layer touches.
 *
 * Declared structurally rather than as `Pick<SQLiteDatabase, ...>` for one
 * reason: `withExclusiveTransactionAsync` hands its callback a `Transaction`,
 * which is declared inside expo-sqlite but never exported. Anything picking that
 * method off the class would demand the whole unexported class in its signature,
 * which nothing outside expo-sqlite — including the test double in `tests/` —
 * can satisfy.
 *
 * Narrowing to a declared contract is also what keeps SQL out of the screens:
 * they depend on `ExpenseRepository`, not on a database driver.
 */
export type QueryableDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: SQLiteBindParams): Promise<SQLiteRunResult>;
  getFirstAsync<T>(source: string, params?: SQLiteBindParams): Promise<T | null>;
  getAllAsync<T>(source: string, params?: SQLiteBindParams): Promise<T[]>;
  withExclusiveTransactionAsync(task: (txn: TransactionRunner) => Promise<void>): Promise<void>;
};

/** What a migration or import may run against — DDL plus reads on the same connection. */
export type TransactionRunner = Pick<QueryableDatabase, 'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync'>;