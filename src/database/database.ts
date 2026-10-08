import * as SQLite from 'expo-sqlite';

import { runMigrations } from '@/database/migrations';
import type { QueryableDatabase } from '@/database/queryable';
import { serializeDatabase } from '@/database/serialized-database';

/**
 * Opening the app's database.
 *
 * SQLite is the source of truth for expenses (docs/architecture.md). This module
 * owns exactly one connection and is the only place `openDatabaseAsync` is
 * called, so "is the database open and migrated?" has a single answer.
 */

/**
 * File name inside the app's database directory.
 *
 * A `.db` suffix rather than the bare name used in Expo's examples: `expenses.db`
 * is what shows up in the expo-sqlite DevTools inspector and in a file listing,
 * so the extension is worth having.
 */
export const DATABASE_NAME = 'expenses.db';

/**
 * The in-flight connection, or `null` before the first request.
 *
 * Held as a *promise* rather than a resolved database on purpose: opening and
 * migrating is async, and two screens mounting in the same frame would otherwise
 * both start a migration. Memoising the promise collapses them into one, and the
 * `.catch` below makes sure a failed attempt is forgotten so the next caller
 * retries rather than inheriting a dead connection forever.
 */
let connection: Promise<QueryableDatabase> | null = null;

/**
 * Open a database and bring it to the latest schema version.
 *
 * @param name file name, or `':memory:'` for a throwaway database.
 */
export async function openDatabase(name: string = DATABASE_NAME): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(name);

  /*
    WAL before anything else, and outside any transaction: journal mode cannot be
    changed from inside one. It lets a reader (the dashboard's aggregate) run
    while a writer (an insert) is in flight, which matters because both now share
    this single connection.

    `foreign_keys` is off by default in SQLite. There are no foreign keys yet, so
    this is not doing work today — it is here so the first migration that adds
    one does not silently no-op.
  */
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await runMigrations(db);

  return db;
}

/**
 * The app's single database connection, opened and migrated on first use.
 *
 * What the app actually gets is the connection filtered through
 * `serializeDatabase`. Every query on the one shared handle is queued so no two
 * native statements are ever open at once — expo-sqlite on Android intermittently
 * crashes or throws when concurrent async queries share a handle, and screens
 * legitimately fire several queries at once (startup, the budget screen's paired
 * reads). Repositories and services already accept `QueryableDatabase`, so the
 * wrapper changes nothing about how they call SQL.
 */
export function getDatabase(): Promise<QueryableDatabase> {
  connection ??= openDatabase()
    .then((db) => serializeDatabase(db))
    .catch((error: unknown) => {
      // Drop the memo so the next call retries from scratch.
      connection = null;
      throw error;
    });

  return connection;
}