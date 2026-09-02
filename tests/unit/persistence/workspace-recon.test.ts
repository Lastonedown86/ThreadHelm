/**
 * Recon provenance survives import and defaults to null for a hand-picked file.
 *
 * Note: `tests/unit/persistence/agent-profiles.test.ts` does not export an
 * `openTestStorage()` / `importInput()` helper pair (its `openMigrated()` and
 * `manifestInput()` are module-local and `openMigrated()` returns only a `Db`,
 * not `{ repositories, db }`). This file copies the same three-line setup and
 * fixture shape under the names the task brief specifies.
 *
 * Also: the brief's read-back queries filter `agent_profiles` on
 * `WHERE profile_id = ?`, but that table's primary key column is `id`
 * (`profile_id` is the foreign key column on `agent_profile_revisions` and
 * `mission_profile_pins`). Queries below use `WHERE id = ?` to match the
 * real schema.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  createRepositories,
  migrate,
  openDatabase,
  readSchemaVersion,
  type Db,
  type ImportProfileManifestInput,
} from '@threadhelm/persistence';

const AT = '2026-01-01T00:00:00.000Z';

let db: Db;
afterEach(() => db?.close());

function openTestStorage() {
  db = openDatabase(':memory:');
  migrate(db);
  return { db, repositories: createRepositories(db) };
}

function importInput(overrides: Partial<ImportProfileManifestInput> = {}): ImportProfileManifestInput {
  return {
    manifestKey: 'roster-curator::tony-stark',
    digest: 'a'.repeat(64),
    displayName: 'Tony Stark',
    description: 'Reviews architecture proposals before they reach a session.',
    requestedProvider: 'claude-code',
    requestedModel: 'claude-sonnet-5',
    capabilities: ['code_review'],
    isolateRequested: true,
    tokenCapRequested: 500_000,
    author: 'Roster Curator',
    goal: 'Flag risky architecture decisions for explicit human review.',
    manifestSpec: 'munder-difflin/hire@1',
    compatibility: 'compatible',
    sourceBasename: 'tony-stark.agent.json',
    createdAt: AT,
    ...overrides,
  };
}

describe('recon provenance columns', () => {
  it('migrates a version 3 database forward without loss', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    expect(readSchemaVersion(db)).toBeGreaterThanOrEqual(4);
    const columns = db
      .prepare(`SELECT name FROM pragma_table_info('agent_profiles')`)
      .all()
      .map((row) => (row as { name: string }).name);
    expect(columns).toContain('recon_run_id');
    expect(columns).toContain('derived_from_commit');
    db.close();
  });

  it('reads both columns back as null for an import with no recon provenance', () => {
    const { repositories, db } = openTestStorage();
    const imported = repositories.agentProfiles.importManifest(importInput());
    const row = db
      .prepare('SELECT recon_run_id, derived_from_commit FROM agent_profiles WHERE id = ?')
      .get(imported.profileId) as {
      recon_run_id: string | null;
      derived_from_commit: string | null;
    };
    expect(row.recon_run_id).toBeNull();
    expect(row.derived_from_commit).toBeNull();
    db.close();
  });

  it('round-trips provenance supplied by a recon import', () => {
    const { repositories, db } = openTestStorage();
    const imported = repositories.agentProfiles.importManifest({
      ...importInput(),
      reconRunId: '44444444-4444-4444-8444-444444444444',
      derivedFromCommit: 'a'.repeat(40),
    });
    const row = db
      .prepare('SELECT recon_run_id, derived_from_commit FROM agent_profiles WHERE id = ?')
      .get(imported.profileId) as {
      recon_run_id: string | null;
      derived_from_commit: string | null;
    };
    expect(row.recon_run_id).toBe('44444444-4444-4444-8444-444444444444');
    expect(row.derived_from_commit).toBe('a'.repeat(40));
    db.close();
  });

  it('repairs a current-version database missing agent_profiles with the current shape, columns included', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    // mission_profile_pins and agent_profile_revisions both carry FK references
    // to agent_profiles, so they have to go first — CURRENT_AGENT_PROFILES
    // recreates all three tables together (see schema.ts), and it errors on
    // "table already exists" if any of them survive the drop.
    db.exec(`
      DROP TABLE mission_profile_pins;
      DROP TABLE agent_profile_revisions;
      DROP TABLE agent_profiles;
    `);

    migrate(db);

    const columns = db
      .prepare(`SELECT name FROM pragma_table_info('agent_profiles')`)
      .all()
      .map((row) => (row as { name: string }).name);
    expect(columns).toContain('recon_run_id');
    expect(columns).toContain('derived_from_commit');
    db.close();
  });
});
