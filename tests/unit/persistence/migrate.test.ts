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
      'agent_profile_drafts',
      'agent_profile_export_intents',
      'agent_profile_revisions',
      'agent_profile_template_revisions',
      'agent_profile_templates',
      'agent_profiles',
      'agent_readiness_snapshots',
      'agent_sessions',
      'agent_template_storage_v1',
      'approved_workspaces',
      'coordination_conversations',
      'coordination_delivery_attempts',
      'coordination_escalations',
      'coordination_events',
      'coordination_handoffs',
      'memory_conflicts',
      'mission_profile_pins',
      'recovery_records',
      'schema_meta',
      'session_events',
      'shared_memory_entries',
      'shared_memory_fts',
      'shared_memory_fts_config',
      'shared_memory_fts_content',
      'shared_memory_fts_data',
      'shared_memory_fts_docsize',
      'shared_memory_fts_idx',
      'shared_memory_revisions',
      'shared_memory_scope_quotas',
      'supervisor_decisions',
      'supervisor_dependencies',
      'supervisor_envelopes',
      'supervisor_events',
      'supervisor_missions',
      'supervisor_session_roles',
      'supervisor_work_attempts',
      'supervisor_work_items',
      'supervisor_worker_leases',
    ]);
  });

  it('adds later v3 profile tables to an existing v3 database', () => {
    const db = fresh();
    migrate(db);
    db.exec(`
      DROP TABLE mission_profile_pins;
      DROP TABLE agent_profile_revisions;
      DROP TABLE agent_profiles;
    `);
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);

    migrate(db);

    const restored = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('agent_profiles', 'agent_profile_revisions', 'mission_profile_pins')
         ORDER BY name`,
      )
      .all() as { name: string }[];
    expect(restored.map(({ name }) => name)).toEqual([
      'agent_profile_revisions',
      'agent_profiles',
      'mission_profile_pins',
    ]);
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
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
