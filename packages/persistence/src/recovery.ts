/**
 * Bounded storage recovery (T083). Corrupt, unreadable, or too-new databases
 * are preserved next to the original for diagnosis; ThreadHelm then opens a
 * fresh database rather than silently discarding history.
 */

import { existsSync, renameSync } from 'node:fs';
import { ThreadHelmError } from '@threadhelm/contracts';

import { migrate, openDatabase, type Db } from './migrate.js';
import { createRepositories, type Repositories } from './repositories/index.js';

export type RepairReason = 'CORRUPT' | 'INCOMPATIBLE' | 'UNREADABLE';

export interface Storage {
  db: Db;
  repositories: Repositories;
  health: { degraded: false };
  repaired: null | { preservedPath: string; reason: RepairReason };
}

function openChecked(path: string): Db {
  const db = openDatabase(path);
  try {
    const rows = db.pragma('quick_check') as { quick_check: string }[];
    if (rows[0]?.quick_check !== 'ok') {
      throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Storage failed integrity check.', {
        reason: 'CORRUPT',
      });
    }
    migrate(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function classify(error: unknown): RepairReason {
  if (error instanceof ThreadHelmError) {
    const reason = error.details.reason;
    if (reason === 'SCHEMA_TOO_NEW') return 'INCOMPATIBLE';
    if (reason === 'CORRUPT') return 'CORRUPT';
    return 'UNREADABLE';
  }
  const code = (error as { code?: string })?.code ?? '';
  return code.startsWith('SQLITE_NOTADB') || code.startsWith('SQLITE_CORRUPT')
    ? 'CORRUPT'
    : 'UNREADABLE';
}

function preserve(path: string, now: Date): string {
  const stamp = now.toISOString().replaceAll(':', '-');
  const preservedPath = `${path}.preserved-${stamp}`;
  try {
    renameSync(path, preservedPath);
    if (existsSync(`${path}-journal`)) renameSync(`${path}-journal`, `${preservedPath}-journal`);
  } catch {
    throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Could not preserve damaged storage.', {
      reason: 'PRESERVE_FAILED',
    });
  }
  return preservedPath;
}

export function openStorage(path: string, opts: { now?: () => Date } = {}): Storage {
  const now = opts.now ?? (() => new Date());
  let repaired: Storage['repaired'] = null;
  let db: Db;
  try {
    db = openChecked(path);
  } catch (error) {
    if (path === ':memory:') throw error;
    const reason = classify(error);
    repaired = { preservedPath: preserve(path, now()), reason };
    try {
      db = openChecked(path);
    } catch {
      throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Storage could not be opened.', {
        reason: 'REPAIR_FAILED',
        preservedPath: repaired.preservedPath,
      });
    }
  }
  return { db, repositories: createRepositories(db), health: { degraded: false }, repaired };
}
