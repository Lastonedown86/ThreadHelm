import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_ACTIVE_MEMORY_REVISIONS_PER_SCOPE,
  MAX_RETAINED_MEMORY_BYTES_PER_SCOPE,
  createRepositories,
  migrate,
  openDatabase,
  readSchemaVersion,
  type Db,
  type SharedMemoryRepository,
} from '@threadhelm/persistence';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_WORKSPACE_ID = '00000000-0000-4000-8000-000000000002';
const AT = '2026-01-01T00:00:00.000Z';

function seedWorkspace(db: Db, id: string, suffix: string): void {
  db.prepare(
    `INSERT INTO approved_workspaces
      (id, selected_path, display_path, canonical_path, volume_serial, file_id, drive_type,
       approved_at, last_validated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'fixed_local', ?, ?)`,
  ).run(
    id,
    `C:\\memory-${suffix}`,
    `C:\\memory-${suffix}`,
    `\\\\?\\C:\\memory-${suffix}`,
    `volume-${suffix}`,
    `file-${suffix}`,
    AT,
    AT,
  );
}

describe('shared-memory persistence', () => {
  let db: Db;
  let memory: SharedMemoryRepository;

  beforeEach(() => {
    db = openDatabase(':memory:');
    migrate(db);
    seedWorkspace(db, WORKSPACE_ID, 'one');
    seedWorkspace(db, OTHER_WORKSPACE_ID, 'two');
    memory = createRepositories(db).memory;
  });

  afterEach(() => db.close());

  const publish = (
    body: string,
    overrides: Partial<Parameters<SharedMemoryRepository['publish']>[0]> = {},
  ) =>
    memory.publish({
      scope: { workspaceId: WORKSPACE_ID },
      kind: 'fact',
      title: body,
      body,
      sourceRefs: [{ kind: 'artifact', id: 'fixture.md' }],
      authorSessionId: null,
      authorUser: true,
      confidence: 'medium',
      submission: 'deliberate',
      createdAt: AT,
      ...overrides,
    });

  it('migrates v2 to v3 transactionally with memory tables, FTS, triggers, and indexes', () => {
    expect(readSchemaVersion(db)).toBe(3);
    const names = db
      .prepare(
        "SELECT type, name FROM sqlite_master WHERE name LIKE 'shared_memory_%' OR name LIKE 'memory_%'",
      )
      .all() as { type: string; name: string }[];
    expect(names).toEqual(
      expect.arrayContaining([
        { type: 'table', name: 'shared_memory_entries' },
        { type: 'table', name: 'shared_memory_revisions' },
        { type: 'table', name: 'shared_memory_fts' },
        { type: 'table', name: 'memory_conflicts' },
        expect.objectContaining({ type: 'trigger', name: 'shared_memory_revisions_fts_insert' }),
        expect.objectContaining({ type: 'trigger', name: 'shared_memory_revisions_fts_update' }),
        expect.objectContaining({ type: 'index', name: 'shared_memory_entries_scope_status' }),
      ]),
    );
  });

  it('publishes attributed revisions and returns bounded scope-filtered FTS results', () => {
    const first = publish('The deployment authority belongs to the owner.');
    publish('Other workspace authority.', {
      scope: { workspaceId: OTHER_WORKSPACE_ID },
      createdAt: '2026-01-01T00:00:01.000Z',
    });

    const result = memory.search({
      scope: { workspaceId: WORKSPACE_ID },
      query: 'authority',
      limit: 20,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      entryId: first.entry.id,
      revisionId: first.revision.id,
      scope: { workspaceId: WORKSPACE_ID },
      kind: 'fact',
      status: 'active',
      author: { kind: 'user' },
      excerpt: expect.stringContaining('authority'),
    });
    expect(result.items[0]!.excerpt.length).toBeLessThanOrEqual(4096);
    expect(Number.isFinite(result.items[0]!.rank)).toBe(true);
  });

  it('uses immutable append-only supersession and stable keyset pagination', () => {
    const first = publish('Shared retrieval item one', { createdAt: '2026-01-01T00:00:01.000Z' });
    const second = publish('Shared retrieval item two', { createdAt: '2026-01-01T00:00:02.000Z' });
    const page1 = memory.search({
      scope: { workspaceId: WORKSPACE_ID },
      query: 'shared retrieval item',
      limit: 1,
    });
    publish('Shared retrieval item newer', { createdAt: '2026-01-01T00:00:03.000Z' });
    const page2 = memory.search({
      scope: { workspaceId: WORKSPACE_ID },
      query: 'shared retrieval item',
      limit: 1,
      ...(page1.nextCursor ? { cursor: page1.nextCursor } : {}),
    });
    expect(page1.items).toHaveLength(1);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]!.entryId).not.toBe(page1.items[0]!.entryId);
    expect([first.entry.id, second.entry.id]).toContain(page2.items[0]!.entryId);

    const superseded = memory.supersede({
      entryId: first.entry.id,
      targetRevisionId: first.revision.id,
      title: 'Shared retrieval item one corrected',
      body: 'Shared retrieval item one corrected with a citation.',
      sourceRefs: [{ kind: 'memory', id: first.entry.id }],
      authorSessionId: null,
      authorUser: true,
      confidence: 'high',
      submission: 'deliberate',
      createdAt: '2026-01-01T00:00:04.000Z',
    });
    expect(superseded.revision.revision).toBe(2);
    expect(superseded.revision.supersedesRevisionId).toBe(first.revision.id);
    expect(memory.get(first.entry.id, { workspaceId: WORKSPACE_ID }).lineage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.revision.id, status: 'superseded' }),
        expect.objectContaining({ id: superseded.revision.id, status: 'active' }),
      ]),
    );
  });

  it('preserves competing claims and resolves only through an attributable cited revision', () => {
    const left = publish('The release window is Friday.', { confidence: 'high' });
    const right = publish('The release window is Monday.', {
      confidence: 'low',
      createdAt: '2026-01-01T00:00:01.000Z',
    });
    const conflict = memory.reportConflict({
      leftRevisionId: left.revision.id,
      rightRevisionId: right.revision.id,
      reasonCode: 'EXPLICIT_REPORT',
      createdAt: '2026-01-01T00:00:02.000Z',
    });
    expect(conflict.state).toBe('open');
    expect(
      memory.search({ scope: { workspaceId: WORKSPACE_ID }, query: 'release window' }).items,
    ).toHaveLength(0);
    expect(
      memory.search({
        scope: { workspaceId: WORKSPACE_ID },
        query: 'release window',
        includeContested: true,
      }).items,
    ).toHaveLength(2);

    const resolution = memory.supersede({
      entryId: left.entry.id,
      targetRevisionId: left.revision.id,
      title: 'Resolved release window',
      body: 'The cited release record sets the window to Tuesday.',
      sourceRefs: [
        { kind: 'memory', id: left.entry.id },
        { kind: 'memory', id: right.entry.id },
      ],
      authorSessionId: null,
      authorUser: true,
      confidence: 'medium',
      submission: 'deliberate',
      createdAt: '2026-01-01T00:00:03.000Z',
    });
    expect(resolution).toMatchObject({
      entry: { status: 'contested' },
      revision: { status: 'contested' },
    });
    expect(
      memory.search({
        scope: { workspaceId: WORKSPACE_ID },
        query: 'cited release record',
        includeContested: true,
      }).items,
    ).toEqual([
      expect.objectContaining({
        entryId: left.entry.id,
        status: 'contested',
        conflictCount: 1,
      }),
    ]);
    const resolved = memory.resolveConflict({
      conflictId: conflict.id,
      resolutionRevisionId: resolution.revision.id,
      resolvedAt: '2026-01-01T00:00:04.000Z',
    });
    expect(resolved).toMatchObject({
      state: 'resolved',
      leftRevisionId: left.revision.id,
      rightRevisionId: right.revision.id,
      resolvedByRevisionId: resolution.revision.id,
    });
    expect(memory.get(left.entry.id, { workspaceId: WORKSPACE_ID }).summary.status).toBe('active');
    expect(memory.get(right.entry.id, { workspaceId: WORKSPACE_ID }).summary.status).toBe(
      'superseded',
    );
  });

  it('rejects supersession after workspace approval is revoked', () => {
    const published = publish('Revocation-bound memory');
    db.prepare('UPDATE approved_workspaces SET revoked_at = ? WHERE id = ?').run(
      '2026-01-01T00:00:01.000Z',
      WORKSPACE_ID,
    );
    expect(() =>
      memory.supersede({
        entryId: published.entry.id,
        targetRevisionId: published.revision.id,
        title: 'Must not persist',
        body: 'This scope is no longer approved.',
        sourceRefs: [{ kind: 'memory', id: published.entry.id }],
        authorSessionId: null,
        authorUser: true,
        confidence: 'high',
        submission: 'deliberate',
        createdAt: '2026-01-01T00:00:02.000Z',
      }),
    ).toThrowError(expect.objectContaining({ code: 'MEMORY_SCOPE_UNAUTHORIZED' }));
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM shared_memory_revisions WHERE entry_id = ?')
        .get(published.entry.id),
    ).toEqual({ count: 1 });
  });

  it('canonicalizes contract-valid null scope fields for authorization comparisons', () => {
    const published = publish('Canonical workspace scope');
    expect(
      memory.get(published.entry.id, { workspaceId: WORKSPACE_ID, missionId: null }).summary.scope,
    ).toEqual({ workspaceId: WORKSPACE_ID });
  });

  it('expires and retracts content out of default search without deleting lineage', () => {
    const expired = publish('Ephemeral deployment note', {
      expiresAt: '2026-01-01T00:00:10.000Z',
    });
    const retracted = publish('Withdrawn deployment note', {
      createdAt: '2026-01-01T00:00:01.000Z',
    });
    memory.retract({
      entryId: retracted.entry.id,
      revisionId: retracted.revision.id,
      reasonCode: 'OWNER_WITHDREW',
      retractedAt: '2026-01-01T00:00:02.000Z',
    });
    expect(memory.expireDue('2026-01-01T00:00:11.000Z')).toEqual([expired.entry.id]);
    expect(
      memory.search({ scope: { workspaceId: WORKSPACE_ID }, query: 'deployment note' }).items,
    ).toHaveLength(0);
    expect(memory.get(expired.entry.id, { workspaceId: WORKSPACE_ID }).summary.status).toBe(
      'expired',
    );
    expect(memory.get(retracted.entry.id, { workspaceId: WORKSPACE_ID }).summary.status).toBe(
      'retracted',
    );
  });

  it('enforces content and per-scope active revision quotas inside the write transaction', () => {
    expect(() => publish('x'.repeat(16 * 1024 + 1))).toThrowError(
      expect.objectContaining({ code: 'MEMORY_CONTENT_INVALID' }),
    );
    db.prepare(
      `INSERT INTO shared_memory_scope_quotas
        (scope_kind, scope_id, active_revision_count, retained_content_bytes)
       VALUES ('workspace', ?, ?, 0)
       ON CONFLICT(scope_kind, scope_id) DO UPDATE SET active_revision_count = excluded.active_revision_count`,
    ).run(WORKSPACE_ID, MAX_ACTIVE_MEMORY_REVISIONS_PER_SCOPE);
    expect(() => publish('One claim too many')).toThrowError(
      expect.objectContaining({ code: 'MEMORY_QUOTA_REACHED' }),
    );
    expect(db.prepare('SELECT COUNT(*) AS count FROM shared_memory_entries').get()).toEqual({
      count: 0,
    });
  });

  it('enforces retained-content byte quota for both publish and supersede transactions', () => {
    const existing = publish('Retained quota baseline');
    db.prepare(
      `UPDATE shared_memory_scope_quotas SET retained_content_bytes = ?
       WHERE scope_kind = 'workspace' AND scope_id = ?`,
    ).run(MAX_RETAINED_MEMORY_BYTES_PER_SCOPE, WORKSPACE_ID);

    expect(() => publish('Retained quota publish overflow')).toThrowError(
      expect.objectContaining({ code: 'MEMORY_QUOTA_REACHED' }),
    );
    expect(() =>
      memory.supersede({
        entryId: existing.entry.id,
        targetRevisionId: existing.revision.id,
        title: 'Retained quota supersede overflow',
        body: 'This revision must roll back at the byte bound.',
        sourceRefs: [{ kind: 'memory', id: existing.entry.id }],
        authorSessionId: null,
        authorUser: true,
        confidence: 'medium',
        submission: 'deliberate',
        createdAt: '2026-01-01T00:00:01.000Z',
      }),
    ).toThrowError(expect.objectContaining({ code: 'MEMORY_QUOTA_REACHED' }));
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM shared_memory_revisions WHERE entry_id = ?')
        .get(existing.entry.id),
    ).toEqual({ count: 1 });
  });

  it('rolls back entry, revision, quota, and FTS state when a revision insert fails', () => {
    db.exec(`CREATE TRIGGER fixture_memory_revision_failure
      BEFORE INSERT ON shared_memory_revisions
      BEGIN SELECT RAISE(ABORT, 'fixture memory rollback'); END;`);
    expect(() => publish('Rollback this memory')).toThrow(/fixture memory rollback/i);
    expect(db.prepare('SELECT COUNT(*) AS count FROM shared_memory_entries').get()).toEqual({
      count: 0,
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM shared_memory_revisions').get()).toEqual({
      count: 0,
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM shared_memory_fts').get()).toEqual({
      count: 0,
    });
  });

  it('deletes content and FTS rows atomically while retaining content-free lineage', () => {
    const published = publish('Delete this indexed secret');
    memory.retract({
      entryId: published.entry.id,
      revisionId: published.revision.id,
      reasonCode: 'OWNER_WITHDREW',
      retractedAt: '2026-01-01T00:00:01.000Z',
    });
    const deleted = memory.deleteContent({
      entryId: published.entry.id,
      deletedAt: '2026-01-01T00:00:02.000Z',
    });
    expect(deleted.summary).toMatchObject({
      entryId: published.entry.id,
      revisionId: published.revision.id,
      status: 'deleted',
      title: null,
    });
    expect(deleted.body).toBeNull();
    expect(deleted.lineage[0]).toMatchObject({
      id: published.revision.id,
      title: null,
      body: null,
      sourceRefs: [],
      contentBytes: null,
      status: 'deleted',
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM shared_memory_fts').get()).toEqual({
      count: 0,
    });
  });
});
