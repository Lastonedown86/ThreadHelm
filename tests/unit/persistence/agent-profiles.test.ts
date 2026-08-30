/**
 * T091 (Feature 002, US6) — failing-first persistence tests for reviewed hire
 * manifests. `agent_profiles` / `agent_profile_revisions` tables and the
 * `agentProfiles` repository do not exist yet (T097/T098); every assertion
 * below is expected to fail until then.
 *
 * Contract: specs/002-agent-mailbox-routing/contracts/agent-profiles.md
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createRepositories, migrate, openDatabase, type Db } from '@threadhelm/persistence';

const AT = '2026-01-01T00:00:00.000Z';
const LATER = '2026-01-01T00:05:00.000Z';

const PROFILE_IDS = {
  mission: '00000000-0000-4000-8000-000000000090',
};

let db: Db;
afterEach(() => db?.close());

function openMigrated(): Db {
  db = openDatabase(':memory:');
  migrate(db);
  return db;
}

function tables(database: Db): string[] {
  return (
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]
  ).map(({ name }) => name);
}

function manifestInput(overrides: Record<string, unknown> = {}) {
  return {
    manifestKey: 'roster-curator::tony-stark',
    digest: 'a'.repeat(64),
    displayName: 'Tony Stark',
    description: 'Reviews architecture proposals before they reach a session.',
    requestedProvider: 'claude-code' as const,
    requestedModel: 'claude-sonnet-5',
    capabilities: ['code_review'],
    isolateRequested: true,
    tokenCapRequested: 500_000,
    author: 'Roster Curator',
    goal: 'Flag risky architecture decisions for explicit human review.',
    manifestSpec: 'munder-difflin/hire@1' as const,
    compatibility: 'compatible' as const,
    sourceBasename: 'tony-stark.hire.json',
    createdAt: AT,
    ...overrides,
  };
}

describe('agent-profile migration', () => {
  it('adds the agent-profile tables without bumping the schema version', () => {
    const database = openMigrated();
    expect(tables(database)).toEqual(
      expect.arrayContaining(['agent_profiles', 'agent_profile_revisions']),
    );
  });
});

describe('agent-profile digest idempotency and current revision', () => {
  it('creates one profile and one revision on first import', () => {
    const database = openMigrated();
    const repo = createRepositories(database).agentProfiles;
    const imported = repo.importManifest(manifestInput());

    expect(imported.isNewProfile).toBe(true);
    expect(imported.isNewRevision).toBe(true);
    expect(database.prepare('SELECT COUNT(*) AS n FROM agent_profiles').get()).toEqual({ n: 1 });
    expect(database.prepare('SELECT COUNT(*) AS n FROM agent_profile_revisions').get()).toEqual({
      n: 1,
    });
    expect(repo.getSummary(imported.profileId)).toMatchObject({
      profileId: imported.profileId,
      currentRevisionId: imported.revisionId,
      displayName: 'Tony Stark',
      state: 'active',
    });
  });

  it('returns the existing digest idempotently instead of duplicating a revision', () => {
    const database = openMigrated();
    const repo = createRepositories(database).agentProfiles;
    const first = repo.importManifest(manifestInput());
    const second = repo.importManifest(manifestInput({ createdAt: LATER }));

    expect(second.profileId).toBe(first.profileId);
    expect(second.revisionId).toBe(first.revisionId);
    expect(second.isNewProfile).toBe(false);
    expect(second.isNewRevision).toBe(false);
    expect(database.prepare('SELECT COUNT(*) AS n FROM agent_profile_revisions').get()).toEqual({
      n: 1,
    });
  });

  it('reconciles current compatibility on a same-digest import without silently re-enabling', () => {
    const database = openMigrated();
    const repo = createRepositories(database).agentProfiles;
    const first = repo.importManifest(manifestInput());

    const unavailable = repo.importManifest(
      manifestInput({
        compatibility: 'unavailable',
        compatibilityReasons: ['provider unavailable'],
        createdAt: LATER,
      }),
    );
    expect(unavailable.revisionId).toBe(first.revisionId);
    expect(unavailable.isNewRevision).toBe(false);
    expect(repo.getSummary(first.profileId)).toMatchObject({
      compatibility: 'unavailable',
      state: 'disabled',
    });
    expect(() => repo.setEnabled(first.profileId, first.revisionId, true, LATER)).toThrowError(
      expect.objectContaining({ code: 'PROFILE_INCOMPATIBLE' }),
    );

    repo.importManifest(manifestInput({ createdAt: '2026-01-01T00:10:00.000Z' }));
    expect(repo.getSummary(first.profileId)).toMatchObject({
      compatibility: 'compatible',
      state: 'disabled',
    });
  });

  it('pins a changed manifest under the same profile as a new current revision', () => {
    const database = openMigrated();
    const repo = createRepositories(database).agentProfiles;
    const first = repo.importManifest(manifestInput());
    const revised = repo.importManifest(
      manifestInput({
        digest: 'b'.repeat(64),
        description: 'Revised review scope.',
        createdAt: LATER,
      }),
    );

    expect(revised.profileId).toBe(first.profileId);
    expect(revised.revisionId).not.toBe(first.revisionId);
    expect(revised.isNewProfile).toBe(false);
    expect(revised.isNewRevision).toBe(true);
    expect(repo.getSummary(first.profileId)).toMatchObject({
      currentRevisionId: revised.revisionId,
    });
    expect(repo.getDetail(first.profileId)?.revisionHistory).toHaveLength(2);
    expect(database.prepare('SELECT COUNT(*) AS n FROM agent_profiles').get()).toEqual({ n: 1 });
  });

  it('disables a new incompatible revision and refuses to enable it', () => {
    const database = openMigrated();
    const repo = createRepositories(database).agentProfiles;
    const first = repo.importManifest(manifestInput());
    const incompatible = repo.importManifest(
      manifestInput({
        digest: 'd'.repeat(64),
        compatibility: 'incompatible_model',
        compatibilityReasons: ['requested model unavailable'],
        createdAt: LATER,
      }),
    );

    expect(incompatible.profileId).toBe(first.profileId);
    expect(repo.getSummary(first.profileId)).toMatchObject({
      currentRevisionId: incompatible.revisionId,
      compatibility: 'incompatible_model',
      state: 'disabled',
    });
    expect(() =>
      repo.setEnabled(first.profileId, incompatible.revisionId, true, LATER),
    ).toThrowError(expect.objectContaining({ code: 'PROFILE_INCOMPATIBLE' }));
  });
});

describe('agent-profile enable, disable, and delete', () => {
  it('toggles enabled state only against the exact current revision', () => {
    const database = openMigrated();
    const repo = createRepositories(database).agentProfiles;
    const imported = repo.importManifest(manifestInput());

    expect(repo.setEnabled(imported.profileId, imported.revisionId, false, AT).state).toBe(
      'disabled',
    );
    expect(repo.setEnabled(imported.profileId, imported.revisionId, true, LATER).state).toBe(
      'active',
    );
  });

  it('rejects an enable/disable request against a stale revision id', () => {
    const database = openMigrated();
    const repo = createRepositories(database).agentProfiles;
    const first = repo.importManifest(manifestInput());
    repo.importManifest(manifestInput({ digest: 'c'.repeat(64), createdAt: LATER }));

    expect(() => repo.setEnabled(first.profileId, first.revisionId, false, LATER)).toThrowError(
      expect.objectContaining({ code: 'PROFILE_REVISION_STALE' }),
    );
  });

  it('deletes an inactive profile and rejects a repeated delete as a state change', () => {
    const database = openMigrated();
    const repo = createRepositories(database).agentProfiles;
    const imported = repo.importManifest(manifestInput());
    expect(() => repo.previewDelete(imported.profileId)).toThrowError(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
    repo.setEnabled(imported.profileId, imported.revisionId, false, AT);

    const deleted = repo.confirmDelete(imported.profileId, AT);
    expect(deleted).toEqual({ profileId: imported.profileId, state: 'deleted' });
    expect(repo.getSummary(imported.profileId)?.state).toBe('deleted');
    expect(() => repo.confirmDelete(imported.profileId, LATER)).toThrowError(
      expect.objectContaining({ code: 'PROFILE_NOT_FOUND' }),
    );
  });

  it('refuses to delete a profile pinned by an active mission', () => {
    const database = openMigrated();
    const repo = createRepositories(database).agentProfiles;
    const imported = repo.importManifest(manifestInput());
    database
      .prepare(
        `INSERT INTO mission_profile_pins (mission_id, profile_id, revision_id, pinned_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(PROFILE_IDS.mission, imported.profileId, imported.revisionId, AT);

    expect(() => repo.previewDelete(imported.profileId)).toThrowError(
      expect.objectContaining({ code: 'PROFILE_MISSION_PINNED' }),
    );
  });
});

describe('agent-profile transactional rollback', () => {
  it('rolls back a failed import and leaves no partial profile or revision row', () => {
    const database = openMigrated();
    const repo = createRepositories(database).agentProfiles;
    database.exec(`CREATE TRIGGER fixture_fail_profile BEFORE INSERT ON agent_profiles
      BEGIN SELECT RAISE(ABORT, 'fixture rollback'); END;`);

    expect(() => repo.importManifest(manifestInput())).toThrow();
    expect(database.prepare('SELECT COUNT(*) AS n FROM agent_profiles').get()).toEqual({ n: 0 });
    expect(database.prepare('SELECT COUNT(*) AS n FROM agent_profile_revisions').get()).toEqual({
      n: 0,
    });
  });
});
