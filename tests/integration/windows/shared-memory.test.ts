import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createRepositories,
  migrate,
  openDatabase,
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

describe('shared memory on Windows', () => {
  let dbPath: string;
  let db: Db;
  let memory: SharedMemoryRepository;

  beforeEach(() => {
    dbPath = join(tmpdir(), `threadhelm-memory-${randomUUID()}.sqlite`);
    db = openDatabase(dbPath);
    migrate(db);
    seedWorkspace(db, WORKSPACE_ID, 'one');
    seedWorkspace(db, OTHER_WORKSPACE_ID, 'two');
    memory = createRepositories(db).memory;
  });

  afterEach(() => {
    if (db.open) db.close();
    rmSync(dbPath, { force: true });
  });

  const publish = (
    body: string,
    overrides: Partial<Parameters<SharedMemoryRepository['publish']>[0]> = {},
  ) =>
    memory.publish({
      scope: { workspaceId: WORKSPACE_ID },
      kind: 'fact',
      title: null,
      body,
      sourceRefs: [],
      authorSessionId: null,
      authorUser: true,
      confidence: 'unknown',
      submission: 'deliberate',
      createdAt: AT,
      ...overrides,
    });

  it('keeps the p95 of bounded FTS searches below 500 ms with 10,000 active revisions', () => {
    db.transaction(() => {
      for (let index = 0; index < 10_000; index += 1) {
        publish(`indexed memory ${index} needle-${index}`, {
          createdAt: new Date(Date.parse(AT) + index).toISOString(),
        });
      }
    })();

    const durations: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now();
      const result = memory.search({
        scope: { workspaceId: WORKSPACE_ID },
        query: `needle-${9999 - index}`,
        limit: 20,
      });
      durations.push(performance.now() - started);
      expect(result.items).toHaveLength(1);
    }
    durations.sort((left, right) => left - right);
    expect(durations[Math.ceil(durations.length * 0.95) - 1]).toBeLessThan(500);
  }, 60_000);

  it('recovers committed revisions, citations, scope, and conflict state after restart', () => {
    const left = publish('Restart claim alpha', {
      sourceRefs: [{ kind: 'artifact', id: 'alpha.md' }],
    });
    const right = publish('Restart claim beta', {
      sourceRefs: [{ kind: 'artifact', id: 'beta.md' }],
      createdAt: '2026-01-01T00:00:01.000Z',
    });
    const conflict = memory.reportConflict({
      leftRevisionId: left.revision.id,
      rightRevisionId: right.revision.id,
      reasonCode: 'EXPLICIT_REPORT',
      createdAt: '2026-01-01T00:00:02.000Z',
    });

    db.close();
    db = openDatabase(dbPath);
    migrate(db);
    memory = createRepositories(db).memory;

    const detail = memory.get(left.entry.id, { workspaceId: WORKSPACE_ID });
    expect(detail.summary).toMatchObject({ status: 'contested', conflictCount: 1 });
    expect(detail.lineage[0]!.sourceRefs).toEqual([{ kind: 'artifact', id: 'alpha.md' }]);
    expect(detail.conflicts).toEqual([expect.objectContaining({ id: conflict.id, state: 'open' })]);
  });

  it('isolates unrelated workspace scopes for both search and direct detail', () => {
    const visible = publish('workspace one isolated fact');
    const hidden = publish('workspace two isolated fact', {
      scope: { workspaceId: OTHER_WORKSPACE_ID },
      createdAt: '2026-01-01T00:00:01.000Z',
    });
    expect(
      memory.search({ scope: { workspaceId: WORKSPACE_ID }, query: 'isolated fact' }).items,
    ).toEqual([expect.objectContaining({ entryId: visible.entry.id })]);
    expect(() => memory.get(hidden.entry.id, { workspaceId: WORKSPACE_ID })).toThrowError(
      expect.objectContaining({ code: 'MEMORY_SCOPE_UNAUTHORIZED' }),
    );
  });

  it('rejects every non-deliberate terminal, transcript, reasoning, credential, or file ingestion path', () => {
    const origins = [
      'terminal_output',
      'provider_transcript',
      'reasoning_trace',
      'environment_value',
      'credential_scan',
      'workspace_file_crawl',
    ];
    for (const submission of origins) {
      expect(() => publish(`forbidden ${submission}`, { submission } as never)).toThrowError(
        expect.objectContaining({ code: 'MEMORY_CONTENT_INVALID' }),
      );
    }
    expect(db.prepare('SELECT COUNT(*) AS count FROM shared_memory_entries').get()).toEqual({
      count: 0,
    });
  });

  it('removes deleted content and every matching FTS row in the same transaction', () => {
    const item = publish('permanently remove windows fts marker');
    memory.retract({
      entryId: item.entry.id,
      revisionId: item.revision.id,
      reasonCode: 'OWNER_WITHDREW',
      retractedAt: '2026-01-01T00:00:01.000Z',
    });
    memory.deleteContent({
      entryId: item.entry.id,
      deletedAt: '2026-01-01T00:00:02.000Z',
    });
    expect(
      memory.search({
        scope: { workspaceId: WORKSPACE_ID },
        query: 'windows fts marker',
        includeContested: true,
      }).items,
    ).toHaveLength(0);
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM shared_memory_fts WHERE shared_memory_fts MATCH 'marker'",
        )
        .get(),
    ).toEqual({ count: 0 });
  });
});
