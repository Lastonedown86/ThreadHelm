import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ThreadHelmError } from '@threadhelm/contracts';
import {
  migrate,
  openDatabase,
  readSchemaVersion,
  SCHEMA_VERSION,
  type Db,
} from '@threadhelm/persistence';

let dir: string;
const open: Db[] = [];

afterEach(() => {
  for (const db of open.splice(0)) db.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const fresh = () => {
  dir = mkdtempSync(join(tmpdir(), 'threadhelm-migrate-'));
  const db = openDatabase(join(dir, 'state.sqlite'));
  open.push(db);
  return db;
};

describe('openDatabase', () => {
  it('sets the required pragmas', () => {
    const db = fresh();
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('journal_mode', { simple: true })).toBe('delete');
    // FULL = 2
    expect(db.pragma('synchronous', { simple: true })).toBe(2);
  });
});

describe('migrate', () => {
  it('creates the schema once and is idempotent', () => {
    const db = fresh();
    expect(readSchemaVersion(db)).toBe(0);
    migrate(db);
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
    migrate(db);
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
    const tables = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all() as {
        name: string;
      }[]
    ).map((t) => t.name);
    expect(tables).toEqual([
      'agent_definitions',
      'agent_readiness_snapshots',
      'agent_sessions',
      'approved_workspaces',
      'coordination_conversations',
      'coordination_delivery_attempts',
      'coordination_escalations',
      'coordination_events',
      'coordination_handoffs',
      'recovery_records',
      'schema_meta',
      'session_events',
    ]);
  });

  it('refuses a newer schema without touching it', () => {
    const db = fresh();
    migrate(db);
    db.exec(`UPDATE schema_meta SET version = ${SCHEMA_VERSION + 5}`);
    db.exec('CREATE TABLE future_only (x)');
    let caught: unknown;
    try {
      migrate(db);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ThreadHelmError);
    expect((caught as ThreadHelmError).code).toBe('STORAGE_UNAVAILABLE');
    expect((caught as ThreadHelmError).details.reason).toBe('SCHEMA_TOO_NEW');
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION + 5);
    expect(
      db.prepare(`SELECT name FROM sqlite_master WHERE name = 'future_only'`).get(),
    ).toBeTruthy();
  });
});
