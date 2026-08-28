import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  migrate,
  openDatabase,
  openStorage,
  readSchemaVersion,
  SCHEMA_VERSION,
  type Storage,
} from '@threadhelm/persistence';

let dir: string;
let path: string;
const open: Storage[] = [];
const now = () => new Date('2026-08-28T12:00:00.000Z');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'threadhelm-recovery-'));
  path = join(dir, 'state.sqlite');
});

afterEach(() => {
  for (const storage of open.splice(0)) storage.db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('openStorage', () => {
  it('opens and migrates a fresh database with no repair', () => {
    const storage = openStorage(path, { now });
    open.push(storage);
    expect(storage.repaired).toBeNull();
    expect(storage.health.degraded).toBe(false);
    expect(readSchemaVersion(storage.db)).toBe(SCHEMA_VERSION);
    expect(storage.repositories.workspaces.listAll()).toEqual([]);
  });

  it('preserves a corrupt file and opens a fresh one', () => {
    writeFileSync(path, Buffer.from('this is definitely not a sqlite database'.repeat(20)));
    const storage = openStorage(path, { now });
    open.push(storage);
    expect(storage.repaired?.reason).toBe('CORRUPT');
    expect(storage.repaired?.preservedPath).toBe(`${path}.preserved-2026-08-28T12-00-00.000Z`);
    expect(existsSync(storage.repaired!.preservedPath)).toBe(true);
    expect(readdirSync(dir).filter((f) => f.startsWith('state.sqlite'))).toContain(
      'state.sqlite.preserved-2026-08-28T12-00-00.000Z',
    );
    expect(readSchemaVersion(storage.db)).toBe(SCHEMA_VERSION);
  });

  it('preserves a too-new database as INCOMPATIBLE', () => {
    const db = openDatabase(path);
    migrate(db);
    db.exec(`UPDATE schema_meta SET version = ${SCHEMA_VERSION + 1}`);
    db.close();

    const storage = openStorage(path, { now });
    open.push(storage);
    expect(storage.repaired?.reason).toBe('INCOMPATIBLE');
    expect(existsSync(storage.repaired!.preservedPath)).toBe(true);
    const preserved = openDatabase(storage.repaired!.preservedPath);
    expect(readSchemaVersion(preserved)).toBe(SCHEMA_VERSION + 1);
    preserved.close();
    expect(readSchemaVersion(storage.db)).toBe(SCHEMA_VERSION);
  });
});
