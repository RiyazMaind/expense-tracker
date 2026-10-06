import type { QueryableDatabase } from '@/database/queryable';

/**
 * Schema migrations, versioned through SQLite's own `PRAGMA user_version`.
 *
 * `user_version` is the right tool here because it is stored in the database
 * file itself: it survives app restarts, and it moves with the file if the user
 * ever exports or restores one. A counter in Zustand or AsyncStorage would
 * describe a different lifetime than the data it governs.
 *
 * Migrations are append-only. Never edit a shipped entry — add the next one.
 */

/**
 * The `expenses` table from docs/data-model.md, with `amount` renamed to
 * `amount_minor` to state the unit in the column itself: an integer count of
 * paise, never a rupee float.
 */
const CREATE_EXPENSES = `
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  category TEXT NOT NULL,
  note TEXT,
  date TEXT NOT NULL CHECK (date IS strftime('%Y-%m-%d', date)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
`;

/**
 * Indexes, one per access path the app actually has.
 *
 * `date` carries the dashboard: every period total filters on it, and a
 * chronological expense list is an index scan backwards. Being zero-padded ISO,
 * `YYYY-MM-DD` compares lexicographically in date order, so range predicates on
 * it are correct without any conversion to Julian days.
 *
 * `category` leads the composite index because per-category queries and the
 * eventual category breakdown both want that column first, and putting `date`
 * second lets the same index answer "one category in one period".
 *
 * There is deliberately no index on `created_at` or `updated_at`: nothing reads
 * by those yet, and an index nothing queries only slows writes down.
 */
const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date);`,
  `CREATE INDEX IF NOT EXISTS expenses_category_date_idx ON expenses (category, date);`,
];

/**
 * The `budgets` table from docs/data-model.md, with `amount` renamed to
 * `amount_minor` for the same reason as `expenses`: the column holds whole
 * paise, never a rupee float. `month` is unique because a month has exactly one
 * budget — setting a budget for a month that already has one is an update to
 * that row, not a second row.
 */
const CREATE_BUDGETS = `
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL UNIQUE CHECK (
    length(month) = 7
    AND substr(month, 5, 1) = '-'
    AND substr(month, 1, 4) GLOB '[0-9][0-9][0-9][0-9]'
    AND CAST(substr(month, 6, 2) AS INTEGER) BETWEEN 1 AND 12
  ),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
`;

export type Migration = {
  /** The `user_version` this migration leaves behind. Must be the previous max + 1. */
  readonly version: number;
  readonly statements: readonly string[];
};

/**
 * Ordered, gap-free, starting at 1.
 *
 * The version is the array position, so the two can never disagree.
 */
export const MIGRATIONS: readonly Migration[] = [
  { version: 1, statements: [CREATE_EXPENSES, ...CREATE_INDEXES] },
  { version: 2, statements: [CREATE_BUDGETS] },
];

const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

/** Read the schema version recorded in the database file. */
export async function readSchemaVersion(db: QueryableDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

  // A fresh file has no row at all rather than a zero.
  return row?.user_version ?? 0;
}

/**
 * Bring `db` up to the latest schema version.
 *
 * Each migration runs in its own transaction, so a failure leaves the version
 * where it was and the whole batch is retried on the next launch instead of
 * half-applying.
 *
 * @returns the version the database is on afterwards.
 */
export async function runMigrations(db: QueryableDatabase): Promise<number> {
  let version = await readSchemaVersion(db);

  if (version > LATEST_VERSION) {
    // An older build opening a newer file. Refusing loudly beats writing rows
    // into a schema whose columns mean something else.
    throw new Error(
      `Database schema is at version ${version}, but this build only understands ${LATEST_VERSION}. The app needs updating.`,
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= version) {
      continue;
    }

    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const statement of migration.statements) {
        await txn.execAsync(statement);
      }

      /*
        `PRAGMA` values cannot be bound as parameters, so this one is
        interpolated. It is safe because `version` comes from the literal
        `MIGRATIONS` table above and is typed as a number — no user input reaches
        this string.
      */
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });

    version = migration.version;
  }

  return version;
}