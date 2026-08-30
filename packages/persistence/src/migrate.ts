/**
 * Database open + transactional migration runner (T019). Main is the sole
 * SQLite owner; rollback journal, foreign keys on, synchronous FULL.
 */

import Database from 'better-sqlite3';
import { ThreadHelmError } from '@threadhelm/contracts';

import { CURRENT_SCHEMA_EXTENSIONS, MIGRATIONS, SCHEMA_VERSION } from './schema.js';

export type Db = Database.Database;

export function openDatabase(path: string): Db {
  const db = new Database(path);
  try {
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = DELETE');
    db.pragma('synchronous = FULL');
  } catch (error) {
    // A garbage file fails here; never leak the handle (it would lock the file).
    db.close();
    throw error;
  }
  return db;
}

export function readSchemaVersion(db: Db): number {
  const table = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'`)
    .get();
  if (!table) return 0;
  const row = db.prepare('SELECT version FROM schema_meta').get() as
    { version: number } | undefined;
  return row?.version ?? 0;
}

/** Applies pending migrations in one transaction. A newer schema is refused untouched. */
export function migrate(db: Db): void {
  const current = readSchemaVersion(db);
  if (current > SCHEMA_VERSION) {
    throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Storage was written by a newer ThreadHelm.', {
      reason: 'SCHEMA_TOO_NEW',
      found: current,
      supported: SCHEMA_VERSION,
    });
  }
  const applyCurrentExtensions = () => {
    for (const extension of CURRENT_SCHEMA_EXTENSIONS) {
      const exists = db
        .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
        .get(extension.table);
      if (!exists) db.exec(extension.sql);
    }
  };
  if (current === SCHEMA_VERSION) {
    db.transaction(applyCurrentExtensions)();
    return;
  }
  db.transaction(() => {
    for (const migration of MIGRATIONS) {
      if (migration.version > current) db.exec(migration.sql);
    }
    db.exec('DELETE FROM schema_meta');
    db.prepare('INSERT INTO schema_meta (version) VALUES (?)').run(SCHEMA_VERSION);
    applyCurrentExtensions();
  })();
}
