import type { QueryableDatabase, TransactionRunner } from '@/database/queryable';

/**
 * Serialise every call on one connection.
 *
 * Why this exists: in expo-sqlite on Android (SDK 53–57, including the ~57.0.4
 * this app builds with), each async method prepares and finalises its own
 * native statement, and the native side runs its coroutines on a thread pool.
 * Several of those statements on one handle at the same time can have the
 * shared npm object released mid-call — which surfaces as an intermittent
 * "Call to function 'NativeDatabase.prepareAsync' has been rejected" with a
 * bare `java.lang.NullPointerException`, or worse, a native crash
 * (expo/expo#28176, #48995, #48999). Keeping only one statement lifecycle open
 * on the handle at a time is the documented workaround.
 *
 * The app genuinely does fire queries concurrently: startup loads the summary,
 * the category store and the first history page in the same frame, and the
 * budget screen pairs two repository reads in one `Promise.all`.
 *
 * Every database method that can reach SQL is queued behind a single promise
 * chain. A failed call does not jam the queue — the chain is repaired with a
 * swallowed catch, so the next call still runs. The transaction method is a
 * single unit on the queue; queries inside it run on the transaction handle
 * expo-sqlite hands out, not on this connection.
 *
 * Could this one day be deleted? Yes. The moment expo-sqlite guarantees a
 * serial/dispatch-safe statement lifecycle on Android, this wrapper is
 * dead weight to remove.
 */
export function serializeDatabase(db: QueryableDatabase): QueryableDatabase {
  let tail: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task, task);

    tail = next.catch(() => undefined);

    return next;
  };

  return {
    execAsync: (source) => enqueue(() => db.execAsync(source)),
    runAsync: (source, params) => enqueue(() => db.runAsync(source, params)),
    getFirstAsync: (source, params) => enqueue(() => db.getFirstAsync(source, params)),
    getAllAsync: (source, params) => enqueue(() => db.getAllAsync(source, params)),
    withExclusiveTransactionAsync: (task: (txn: TransactionRunner) => Promise<void>) =>
      enqueue(() => db.withExclusiveTransactionAsync(task)),
  };
}