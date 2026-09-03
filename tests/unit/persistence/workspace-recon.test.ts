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
import { describe, expect, it } from 'vitest';
import {
  createRepositories,
  migrate,
  MIGRATIONS,
  openDatabase,
  readSchemaVersion,
  SCHEMA_VERSION,
  type Db,
  type ImportProfileManifestInput,
} from '@threadhelm/persistence';

const AT = '2026-01-01T00:00:00.000Z';

// Every test opens and closes its own `db` locally — no shared module-level
// handle, no afterEach — since openTestStorage() already hands the db back
// for the caller to close.
function openTestStorage(): { db: Db; repositories: ReturnType<typeof createRepositories> } {
  const db = openDatabase(':memory:');
  migrate(db);
  return { db, repositories: createRepositories(db) };
}

function importInput(
  overrides: Partial<ImportProfileManifestInput> = {},
): ImportProfileManifestInput {
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

/** Replays only the migrations a real version-3 database would already have applied. */
function replayThroughV3(db: Db): void {
  for (const migration of MIGRATIONS) if (migration.version <= 3) db.exec(migration.sql);
  db.prepare('INSERT INTO schema_meta (version) VALUES (3)').run();
}

describe('recon provenance columns', () => {
  it('migrates a fresh database (version 0) to the current version with both recon columns present', () => {
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

  it('migrates an existing v3 database forward without losing an existing profile row', () => {
    const db = openDatabase(':memory:');
    replayThroughV3(db);
    const PRE_AT = '2025-06-01T00:00:00.000Z';
    db.prepare(
      `INSERT INTO agent_profiles (id, manifest_key, current_revision_id, state, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?)`,
    ).run('profile-pre-v4', 'existing::manifest', 'active', PRE_AT, PRE_AT);

    migrate(db);

    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
    const row = db.prepare('SELECT * FROM agent_profiles WHERE id = ?').get('profile-pre-v4');
    expect(row).toMatchObject({
      id: 'profile-pre-v4',
      manifest_key: 'existing::manifest',
      current_revision_id: null,
      state: 'active',
      created_at: PRE_AT,
      updated_at: PRE_AT,
      recon_run_id: null,
      derived_from_commit: null,
    });
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

  it('restamps provenance when a later run revises the same manifest key', () => {
    // The recon prompt mandates supervisor.agent.json, so a second run's
    // supervisor lands on the same manifest key and takes the existing-profile
    // branch. The columns describe the run the current revision came from, or
    // they permanently describe the wrong commit — and provenance is
    // write-only, so nothing would ever surface the error.
    const { repositories, db } = openTestStorage();
    const first = repositories.agentProfiles.importManifest({
      ...importInput(),
      reconRunId: '11111111-1111-4111-8111-111111111111',
      derivedFromCommit: 'a'.repeat(40),
    });
    const second = repositories.agentProfiles.importManifest({
      ...importInput(),
      digest: 'b'.repeat(64),
      goal: 'A different goal, so this is a new revision of the same role.',
      createdAt: '2026-02-02T00:00:00.000Z',
      reconRunId: '22222222-2222-4222-8222-222222222222',
      derivedFromCommit: 'c'.repeat(40),
    });

    expect(second.profileId).toBe(first.profileId);
    expect(second.isNewRevision).toBe(true);
    expect(second.revisionId).not.toBe(first.revisionId);
    const row = db
      .prepare(
        'SELECT current_revision_id, recon_run_id, derived_from_commit FROM agent_profiles WHERE id = ?',
      )
      .get(second.profileId) as {
      current_revision_id: string;
      recon_run_id: string | null;
      derived_from_commit: string | null;
    };
    expect(row.current_revision_id).toBe(second.revisionId);
    expect(row.recon_run_id).toBe('22222222-2222-4222-8222-222222222222');
    expect(row.derived_from_commit).toBe('c'.repeat(40));
    db.close();
  });

  it('clears provenance when a hand-picked file revises a profile a recon run created', () => {
    // The mirror of the case above: the current revision came from a file the
    // owner picked, so there is no run and no commit to report.
    const { repositories, db } = openTestStorage();
    repositories.agentProfiles.importManifest({
      ...importInput(),
      reconRunId: '11111111-1111-4111-8111-111111111111',
      derivedFromCommit: 'a'.repeat(40),
    });
    const second = repositories.agentProfiles.importManifest({
      ...importInput(),
      digest: 'b'.repeat(64),
      goal: 'A different goal, so this is a new revision of the same role.',
      createdAt: '2026-02-02T00:00:00.000Z',
    });

    const row = db
      .prepare('SELECT recon_run_id, derived_from_commit FROM agent_profiles WHERE id = ?')
      .get(second.profileId) as {
      recon_run_id: string | null;
      derived_from_commit: string | null;
    };
    expect(row.recon_run_id).toBeNull();
    expect(row.derived_from_commit).toBeNull();
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

  it('fails to migrate a v3 database that is missing agent_profiles (known limitation)', () => {
    // Pins a real limitation rather than hiding it: migrate() applies pending
    // migrations before it repairs missing CURRENT_SCHEMA_EXTENSIONS tables,
    // so a v3 database missing agent_profiles hits v4's ALTER TABLE against a
    // table that doesn't exist and throws, instead of self-healing the way
    // the "repair a current-version database" case above does. See the
    // comment on V4_RECON_PROVENANCE in schema.ts. Not fixed here: reordering
    // the migration runner is a change to a mechanism every future migration
    // depends on, and is out of scope for this task.
    const db = openDatabase(':memory:');
    replayThroughV3(db);
    db.exec(`
      DROP TABLE mission_profile_pins;
      DROP TABLE agent_profile_revisions;
      DROP TABLE agent_profiles;
    `);

    expect(() => migrate(db)).toThrow();
    db.close();
  });
});
