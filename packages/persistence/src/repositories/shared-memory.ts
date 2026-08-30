/** Transactional, scope-filtered shared-memory repository. Electron main is its sole caller. */

import { createHash, randomUUID } from 'node:crypto';
import {
  ThreadHelmError,
  type MemoryConfidence,
  type MemoryConflictView,
  type MemoryDetailView,
  type MemoryKind,
  type MemoryRevisionView,
  type MemoryScope,
  type MemorySearchPageView,
  type MemorySourceReference,
  type MemoryStatus,
  type MemorySummaryView,
} from '@threadhelm/contracts';
import {
  advanceMemoryStatus,
  assertMemoryAuthor,
  assertMemoryScope,
  assertMemorySourceReferences,
  resolveMemoryConflict,
} from '@threadhelm/domain';

import type { Db } from '../migrate.js';

export const MAX_ACTIVE_MEMORY_REVISIONS_PER_SCOPE = 10_000;
export const MAX_MEMORY_BODY_BYTES = 16 * 1024;
export const MAX_MEMORY_EXCERPT_CHARS = 4096;

type ScopeKey = { kind: 'workspace' | 'mission'; id: string };

interface EntryRow {
  id: string;
  workspace_id: string | null;
  mission_id: string | null;
  kind: MemoryKind;
  status: MemoryStatus;
  current_revision_id: string | null;
  created_by_session_id: string | null;
  created_by_user: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  expired_at: string | null;
  content_deleted_at: string | null;
}

interface RevisionRow {
  id: string;
  entry_id: string;
  revision: number;
  title: string | null;
  body: string | null;
  source_refs: string;
  author_session_id: string | null;
  author_user: number;
  confidence: MemoryConfidence;
  status: MemoryStatus;
  supersedes_revision_id: string | null;
  content_bytes: number | null;
  created_at: string;
}

interface ConflictRow {
  id: string;
  left_revision_id: string;
  right_revision_id: string;
  state: 'open' | 'resolved';
  reason_code: string;
  resolved_by_revision_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface PublishMemoryInput {
  id?: string;
  revisionId?: string;
  scope: MemoryScope;
  kind: MemoryKind;
  title?: string | null;
  body: string;
  sourceRefs: readonly MemorySourceReference[];
  authorSessionId: string | null;
  authorUser: boolean;
  confidence: MemoryConfidence;
  submission: 'deliberate';
  createdAt: string;
  expiresAt?: string | null;
}

export interface PublishedMemory {
  entry: {
    id: string;
    scope: MemoryScope;
    kind: MemoryKind;
    status: MemoryStatus;
    currentRevisionId: string | null;
  };
  revision: MemoryRevisionView;
}

interface SearchCursor {
  queryHash: string;
  rank: number;
  createdAt: string;
  revisionId: string;
}

function scopeKey(scope: MemoryScope): ScopeKey {
  assertMemoryScope(scope);
  return 'workspaceId' in scope && scope.workspaceId
    ? { kind: 'workspace', id: scope.workspaceId }
    : { kind: 'mission', id: scope.missionId! };
}

function rowScope(row: EntryRow): MemoryScope {
  return row.workspace_id ? { workspaceId: row.workspace_id } : { missionId: row.mission_id! };
}

function sameScope(left: MemoryScope, right: MemoryScope): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function authorView(authorSessionId: string | null, authorUser: number | boolean) {
  return authorUser
    ? ({ kind: 'user' } as const)
    : ({ kind: 'session', sessionId: authorSessionId! } as const);
}

function parseSources(value: string): MemorySourceReference[] {
  return JSON.parse(value) as MemorySourceReference[];
}

function toRevision(row: RevisionRow): MemoryRevisionView {
  return {
    id: row.id,
    entryId: row.entry_id,
    revision: row.revision,
    title: row.title,
    body: row.body,
    sourceRefs: parseSources(row.source_refs),
    author: authorView(row.author_session_id, row.author_user),
    confidence: row.confidence,
    status: row.status,
    supersedesRevisionId: row.supersedes_revision_id,
    contentBytes: row.content_bytes,
    createdAt: row.created_at,
  };
}

function toConflict(row: ConflictRow): MemoryConflictView {
  return {
    id: row.id,
    leftRevisionId: row.left_revision_id,
    rightRevisionId: row.right_revision_id,
    state: row.state,
    reasonCode: row.reason_code,
    resolvedByRevisionId: row.resolved_by_revision_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function contentBytes(title: string | null, body: string): number {
  return Buffer.byteLength(title ?? '', 'utf8') + Buffer.byteLength(body, 'utf8');
}

function normalizePublication(input: PublishMemoryInput) {
  if (input.submission !== 'deliberate') {
    throw new ThreadHelmError(
      'MEMORY_CONTENT_INVALID',
      'Shared memory accepts only deliberate authorized publication.',
    );
  }
  assertMemoryScope(input.scope);
  assertMemoryAuthor({
    authorSessionId: input.authorSessionId,
    authorUser: input.authorUser,
  });
  assertMemorySourceReferences(input.sourceRefs);
  const title = input.title?.trim() || null;
  const body = input.body.trim();
  if (
    body.length === 0 ||
    Buffer.byteLength(body, 'utf8') > MAX_MEMORY_BODY_BYTES ||
    (title !== null && [...title].length > 160)
  ) {
    throw new ThreadHelmError('MEMORY_CONTENT_INVALID', 'Shared-memory content is out of bounds.');
  }
  return { title, body, bytes: contentBytes(title, body) };
}

function encodeCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string, queryHash: string): SearchCursor {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as SearchCursor;
    if (
      decoded.queryHash !== queryHash ||
      !Number.isFinite(decoded.rank) ||
      typeof decoded.createdAt !== 'string' ||
      typeof decoded.revisionId !== 'string'
    ) {
      throw new Error('invalid cursor');
    }
    return decoded;
  } catch {
    throw new ThreadHelmError('INVALID_REQUEST', 'The shared-memory cursor is invalid.');
  }
}

function ftsQuery(query: string): string {
  const terms = query
    .normalize('NFKC')
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((term) => `"${term.replaceAll('"', '""')}"`);
  if (terms.length === 0) {
    throw new ThreadHelmError('MEMORY_CONTENT_INVALID', 'A non-empty memory query is required.');
  }
  return terms.join(' AND ');
}

export class SharedMemoryRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  private entry(id: string): EntryRow | null {
    return (
      (this.db.prepare('SELECT * FROM shared_memory_entries WHERE id = ?').get(id) as
        EntryRow | undefined) ?? null
    );
  }

  private revision(id: string): RevisionRow | null {
    return (
      (this.db.prepare('SELECT * FROM shared_memory_revisions WHERE id = ?').get(id) as
        RevisionRow | undefined) ?? null
    );
  }

  scopeForEntry(entryId: string): MemoryScope {
    const entry = this.entry(entryId);
    if (!entry) throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Shared-memory entry was not found.');
    return rowScope(entry);
  }

  entryIdForRevision(revisionId: string): string {
    const revision = this.revision(revisionId);
    if (!revision) {
      throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Shared-memory revision was not found.');
    }
    return revision.entry_id;
  }

  private assertWorkspaceExists(scope: MemoryScope): void {
    const key = scopeKey(scope);
    if (key.kind === 'workspace') {
      const found = this.db
        .prepare('SELECT 1 FROM approved_workspaces WHERE id = ? AND revoked_at IS NULL')
        .get(key.id);
      if (!found) {
        throw new ThreadHelmError(
          'MEMORY_SCOPE_UNAUTHORIZED',
          'Shared-memory workspace scope is not approved.',
        );
      }
    }
  }

  private ensureQuota(scope: MemoryScope): void {
    const key = scopeKey(scope);
    this.db
      .prepare(
        `INSERT INTO shared_memory_scope_quotas
          (scope_kind, scope_id, active_revision_count, retained_content_bytes)
         VALUES (?, ?, 0, 0) ON CONFLICT(scope_kind, scope_id) DO NOTHING`,
      )
      .run(key.kind, key.id);
    const quota = this.db
      .prepare(
        `SELECT active_revision_count FROM shared_memory_scope_quotas
         WHERE scope_kind = ? AND scope_id = ?`,
      )
      .get(key.kind, key.id) as { active_revision_count: number };
    if (quota.active_revision_count >= MAX_ACTIVE_MEMORY_REVISIONS_PER_SCOPE) {
      throw new ThreadHelmError(
        'MEMORY_QUOTA_REACHED',
        'The shared-memory scope reached its active revision quota.',
      );
    }
  }

  private adjustQuota(scope: MemoryScope, activeDelta: number, bytesDelta: number): void {
    const key = scopeKey(scope);
    this.db
      .prepare(
        `UPDATE shared_memory_scope_quotas
         SET active_revision_count = active_revision_count + ?,
             retained_content_bytes = retained_content_bytes + ?
         WHERE scope_kind = ? AND scope_id = ?`,
      )
      .run(activeDelta, bytesDelta, key.kind, key.id);
  }

  publish(input: PublishMemoryInput): PublishedMemory {
    const normalized = normalizePublication(input);
    this.assertWorkspaceExists(input.scope);
    return this.db.transaction(() => {
      this.ensureQuota(input.scope);
      const entryId = input.id ?? randomUUID();
      const revisionId = input.revisionId ?? randomUUID();
      const workspaceId = 'workspaceId' in input.scope ? (input.scope.workspaceId ?? null) : null;
      const missionId = 'missionId' in input.scope ? (input.scope.missionId ?? null) : null;
      this.db
        .prepare(
          `INSERT INTO shared_memory_entries
            (id, workspace_id, mission_id, kind, status, current_revision_id,
             created_by_session_id, created_by_user, created_at, updated_at, expires_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          entryId,
          workspaceId,
          missionId,
          input.kind,
          revisionId,
          input.authorSessionId,
          Number(input.authorUser),
          input.createdAt,
          input.createdAt,
          input.expiresAt ?? null,
        );
      this.db
        .prepare(
          `INSERT INTO shared_memory_revisions
            (id, entry_id, revision, title, body, source_refs, author_session_id, author_user,
             confidence, status, supersedes_revision_id, content_bytes, created_at)
           VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`,
        )
        .run(
          revisionId,
          entryId,
          normalized.title,
          normalized.body,
          JSON.stringify(input.sourceRefs),
          input.authorSessionId,
          Number(input.authorUser),
          input.confidence,
          normalized.bytes,
          input.createdAt,
        );
      this.adjustQuota(input.scope, 1, normalized.bytes);
      return {
        entry: {
          id: entryId,
          scope: input.scope,
          kind: input.kind,
          status: 'active' as const,
          currentRevisionId: revisionId,
        },
        revision: toRevision(this.revision(revisionId)!),
      };
    })();
  }

  search(input: {
    scope: MemoryScope;
    query: string;
    kind?: MemoryKind;
    includeContested?: boolean;
    cursor?: string;
    limit?: number;
  }): MemorySearchPageView {
    this.assertWorkspaceExists(input.scope);
    const query = ftsQuery(input.query);
    const queryHash = createHash('sha256')
      .update(
        JSON.stringify([input.scope, query, input.kind ?? null, input.includeContested ?? false]),
      )
      .digest('hex');
    const cursor = input.cursor ? decodeCursor(input.cursor, queryHash) : null;
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 20);
    const key = scopeKey(input.scope);
    const scopeColumn = key.kind === 'workspace' ? 'workspace_id' : 'mission_id';
    const statuses = input.includeContested ? ['active', 'contested'] : ['active'];
    const cursorSql = cursor
      ? `AND (rank > @cursorRank
          OR (rank = @cursorRank AND created_at < @cursorCreatedAt)
          OR (rank = @cursorRank AND created_at = @cursorCreatedAt AND revision_id < @cursorRevisionId))`
      : '';
    const rows = this.db
      .prepare(
        `WITH matches AS (
           SELECT e.id AS entry_id, e.workspace_id, e.mission_id, e.kind, e.status AS entry_status,
                  e.created_at AS entry_created_at, e.updated_at, r.id AS revision_id,
                  r.title, r.body, r.source_refs, r.author_session_id, r.author_user,
                  r.confidence, r.status, r.created_at,
                  bm25(shared_memory_fts) AS rank,
                  substr(snippet(shared_memory_fts, 3, '', '', ' … ', 48), 1, 4096) AS excerpt,
                  (SELECT COUNT(*) FROM memory_conflicts c
                    WHERE c.state = 'open'
                      AND (c.left_revision_id = r.id OR c.right_revision_id = r.id)) AS conflict_count
           FROM shared_memory_fts
           JOIN shared_memory_revisions r ON r.id = shared_memory_fts.revision_id
           JOIN shared_memory_entries e ON e.id = r.entry_id
           WHERE shared_memory_fts MATCH @query
             AND e.${scopeColumn} = @scopeId
             AND r.status IN (${statuses.map((_, index) => `@status${index}`).join(', ')})
             ${input.kind ? 'AND e.kind = @kind' : ''}
         )
         SELECT * FROM matches WHERE 1 = 1 ${cursorSql}
         ORDER BY rank ASC, created_at DESC, revision_id DESC
         LIMIT @rowLimit`,
      )
      .all({
        query,
        scopeId: key.id,
        kind: input.kind,
        cursorRank: cursor?.rank,
        cursorCreatedAt: cursor?.createdAt,
        cursorRevisionId: cursor?.revisionId,
        rowLimit: limit + 1,
        status0: statuses[0],
        ...(statuses[1] ? { status1: statuses[1] } : {}),
      }) as Array<{
      entry_id: string;
      workspace_id: string | null;
      mission_id: string | null;
      kind: MemoryKind;
      entry_status: MemoryStatus;
      entry_created_at: string;
      updated_at: string;
      revision_id: string;
      title: string | null;
      source_refs: string;
      author_session_id: string | null;
      author_user: number;
      confidence: MemoryConfidence;
      status: MemoryStatus;
      created_at: string;
      rank: number;
      excerpt: string;
      conflict_count: number;
    }>;
    const hasNext = rows.length > limit;
    const selected = rows.slice(0, limit);
    const items = selected.map((row) => ({
      entryId: row.entry_id,
      revisionId: row.revision_id,
      scope: row.workspace_id
        ? ({ workspaceId: row.workspace_id } as MemoryScope)
        : ({ missionId: row.mission_id! } as MemoryScope),
      kind: row.kind,
      status: row.status,
      title: row.title,
      author: authorView(row.author_session_id, row.author_user),
      sourceRefs: parseSources(row.source_refs),
      confidence: row.confidence,
      conflictCount: row.conflict_count,
      createdAt: row.entry_created_at,
      updatedAt: row.updated_at,
      excerpt: row.excerpt,
      rank: row.rank,
    }));
    const last = selected.at(-1);
    return {
      items,
      nextCursor:
        hasNext && last
          ? encodeCursor({
              queryHash,
              rank: last.rank,
              createdAt: last.created_at,
              revisionId: last.revision_id,
            })
          : null,
    };
  }

  get(entryId: string, scope: MemoryScope, revisionId?: string): MemoryDetailView {
    const entry = this.entry(entryId);
    if (!entry) throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Shared-memory entry was not found.');
    if (!sameScope(rowScope(entry), scope)) {
      throw new ThreadHelmError(
        'MEMORY_SCOPE_UNAUTHORIZED',
        'Shared-memory entry is outside the requested scope.',
      );
    }
    const selected = revisionId
      ? this.revision(revisionId)
      : entry.current_revision_id
        ? this.revision(entry.current_revision_id)
        : (this.db
            .prepare(
              'SELECT * FROM shared_memory_revisions WHERE entry_id = ? ORDER BY revision DESC LIMIT 1',
            )
            .get(entryId) as RevisionRow | undefined);
    if (!selected || selected.entry_id !== entryId) {
      throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Shared-memory revision was not found.');
    }
    const lineage = (
      this.db
        .prepare('SELECT * FROM shared_memory_revisions WHERE entry_id = ? ORDER BY revision ASC')
        .all(entryId) as RevisionRow[]
    ).map(toRevision);
    const conflicts = (
      this.db
        .prepare(
          `SELECT DISTINCT c.* FROM memory_conflicts c
           JOIN shared_memory_revisions r
             ON r.id IN (c.left_revision_id, c.right_revision_id)
           WHERE r.entry_id = ? ORDER BY c.created_at, c.id`,
        )
        .all(entryId) as ConflictRow[]
    ).map(toConflict);
    const conflictCount = conflicts.filter((conflict) => conflict.state === 'open').length;
    const summary: MemorySummaryView = {
      entryId: entry.id,
      revisionId: selected.id,
      scope: rowScope(entry),
      kind: entry.kind,
      status: entry.status,
      title: selected.title,
      author: authorView(selected.author_session_id, selected.author_user),
      sourceRefs: parseSources(selected.source_refs),
      confidence: selected.confidence,
      conflictCount,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    };
    const availableActions: MemoryDetailView['availableActions'] = [];
    if (entry.status === 'active' || entry.status === 'contested') {
      availableActions.push('supersede', 'retract');
    }
    if (conflictCount > 0) availableActions.push('resolve_conflict');
    if (entry.status !== 'deleted') availableActions.push('delete');
    return { summary, body: selected.body, lineage, conflicts, availableActions };
  }

  supersede(
    input: Omit<PublishMemoryInput, 'id' | 'revisionId' | 'scope' | 'kind' | 'expiresAt'> & {
      entryId: string;
      targetRevisionId: string;
    },
  ): PublishedMemory {
    const entry = this.entry(input.entryId);
    if (!entry) throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Shared-memory entry was not found.');
    if (entry.current_revision_id !== input.targetRevisionId) {
      throw new ThreadHelmError('MEMORY_REVISION_STALE', 'The target revision changed.');
    }
    const prior = this.revision(input.targetRevisionId)!;
    if (!['active', 'contested'].includes(prior.status)) {
      throw new ThreadHelmError(
        'MEMORY_REVISION_STALE',
        'Only a current revision can be superseded.',
      );
    }
    const scope = rowScope(entry);
    const normalized = normalizePublication({ ...input, scope, kind: entry.kind });
    return this.db.transaction(() => {
      const revisionId = randomUUID();
      this.db
        .prepare("UPDATE shared_memory_revisions SET status = 'superseded' WHERE id = ?")
        .run(prior.id);
      this.db
        .prepare(
          `INSERT INTO shared_memory_revisions
            (id, entry_id, revision, title, body, source_refs, author_session_id, author_user,
             confidence, status, supersedes_revision_id, content_bytes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        )
        .run(
          revisionId,
          entry.id,
          prior.revision + 1,
          normalized.title,
          normalized.body,
          JSON.stringify(input.sourceRefs),
          input.authorSessionId,
          Number(input.authorUser),
          input.confidence,
          prior.id,
          normalized.bytes,
          input.createdAt,
        );
      this.db
        .prepare(
          `UPDATE shared_memory_entries
           SET status = 'active', current_revision_id = ?, updated_at = ? WHERE id = ?`,
        )
        .run(revisionId, input.createdAt, entry.id);
      this.adjustQuota(scope, 0, normalized.bytes);
      return {
        entry: {
          id: entry.id,
          scope,
          kind: entry.kind,
          status: 'active' as const,
          currentRevisionId: revisionId,
        },
        revision: toRevision(this.revision(revisionId)!),
      };
    })();
  }

  reportConflict(input: {
    leftRevisionId: string;
    rightRevisionId: string;
    reasonCode: string;
    createdAt: string;
  }): MemoryConflictView {
    const left = this.revision(input.leftRevisionId);
    const right = this.revision(input.rightRevisionId);
    if (!left || !right)
      throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Conflict revision missing.');
    const leftEntry = this.entry(left.entry_id)!;
    const rightEntry = this.entry(right.entry_id)!;
    if (!sameScope(rowScope(leftEntry), rowScope(rightEntry))) {
      throw new ThreadHelmError(
        'MEMORY_SCOPE_UNAUTHORIZED',
        'Conflicts cannot cross memory scopes.',
      );
    }
    if (
      !['active', 'contested'].includes(left.status) ||
      !['active', 'contested'].includes(right.status)
    ) {
      throw new ThreadHelmError('MEMORY_REVISION_STALE', 'Conflict claims must still be current.');
    }
    return this.db.transaction(() => {
      const id = randomUUID();
      this.db
        .prepare(
          `INSERT INTO memory_conflicts
            (id, left_revision_id, right_revision_id, state, reason_code, created_at)
           VALUES (?, ?, ?, 'open', ?, ?)`,
        )
        .run(id, left.id, right.id, input.reasonCode, input.createdAt);
      for (const revision of [left, right]) {
        if (revision.status === 'active') {
          advanceMemoryStatus('active', 'contested');
          this.db
            .prepare("UPDATE shared_memory_revisions SET status = 'contested' WHERE id = ?")
            .run(revision.id);
          this.db
            .prepare(
              "UPDATE shared_memory_entries SET status = 'contested', updated_at = ? WHERE id = ?",
            )
            .run(input.createdAt, revision.entry_id);
        }
      }
      return toConflict(
        this.db.prepare('SELECT * FROM memory_conflicts WHERE id = ?').get(id) as ConflictRow,
      );
    })();
  }

  resolveConflict(input: {
    conflictId: string;
    resolutionRevisionId: string;
    resolvedAt: string;
  }): MemoryConflictView {
    const row = this.db
      .prepare('SELECT * FROM memory_conflicts WHERE id = ?')
      .get(input.conflictId) as ConflictRow | undefined;
    if (!row) throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Memory conflict was not found.');
    const resolution = this.revision(input.resolutionRevisionId);
    if (!resolution)
      throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Resolution revision was not found.');
    const left = this.revision(row.left_revision_id)!;
    const right = this.revision(row.right_revision_id)!;
    const leftEntry = this.entry(left.entry_id)!;
    const rightEntry = this.entry(right.entry_id)!;
    const resolutionEntry = this.entry(resolution.entry_id)!;
    if (!sameScope(rowScope(leftEntry), rowScope(resolutionEntry))) {
      throw new ThreadHelmError('MEMORY_SCOPE_UNAUTHORIZED', 'Resolution must stay in scope.');
    }
    const sourceIds = new Set(parseSources(resolution.source_refs).map((source) => source.id));
    if (!sourceIds.has(leftEntry.id) || !sourceIds.has(rightEntry.id)) {
      throw new ThreadHelmError(
        'MEMORY_SOURCE_INVALID',
        'Conflict resolution must cite both competing memory entries.',
      );
    }
    const resolved = resolveMemoryConflict(
      {
        id: row.id,
        leftRevisionId: row.left_revision_id,
        rightRevisionId: row.right_revision_id,
        state: row.state,
        reasonCode: row.reason_code,
        resolvedByRevisionId: row.resolved_by_revision_id,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
      },
      input,
    );
    return this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE memory_conflicts
           SET state = 'resolved', resolved_by_revision_id = ?, resolved_at = ? WHERE id = ?`,
        )
        .run(resolved.resolvedByRevisionId, resolved.resolvedAt, row.id);
      for (const competing of [left, right]) {
        if (competing.status === 'contested' && competing.id !== resolution.id) {
          this.db
            .prepare("UPDATE shared_memory_revisions SET status = 'superseded' WHERE id = ?")
            .run(competing.id);
          if (competing.entry_id !== resolution.entry_id) {
            this.db
              .prepare(
                "UPDATE shared_memory_entries SET status = 'superseded', updated_at = ? WHERE id = ?",
              )
              .run(input.resolvedAt, competing.entry_id);
            this.adjustQuota(rowScope(this.entry(competing.entry_id)!), -1, 0);
          }
        }
      }
      return toConflict(
        this.db.prepare('SELECT * FROM memory_conflicts WHERE id = ?').get(row.id) as ConflictRow,
      );
    })();
  }

  retract(input: {
    entryId: string;
    revisionId: string;
    reasonCode: string;
    retractedAt: string;
  }): MemoryDetailView {
    const entry = this.entry(input.entryId);
    const revision = this.revision(input.revisionId);
    if (!entry || !revision || revision.entry_id !== entry.id) {
      throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Shared-memory revision was not found.');
    }
    if (entry.current_revision_id !== revision.id) {
      throw new ThreadHelmError('MEMORY_REVISION_STALE', 'The target revision changed.');
    }
    advanceMemoryStatus(revision.status, 'retracted');
    this.db.transaction(() => {
      this.db
        .prepare("UPDATE shared_memory_revisions SET status = 'retracted' WHERE id = ?")
        .run(revision.id);
      this.db
        .prepare(
          "UPDATE shared_memory_entries SET status = 'retracted', updated_at = ? WHERE id = ?",
        )
        .run(input.retractedAt, entry.id);
      this.adjustQuota(rowScope(entry), -1, 0);
    })();
    return this.get(entry.id, rowScope(entry));
  }

  expireDue(now: string): number {
    const entries = this.db
      .prepare(
        `SELECT * FROM shared_memory_entries
         WHERE status IN ('active', 'contested') AND expires_at IS NOT NULL AND expires_at <= ?`,
      )
      .all(now) as EntryRow[];
    this.db.transaction(() => {
      for (const entry of entries) {
        this.db
          .prepare("UPDATE shared_memory_revisions SET status = 'expired' WHERE id = ?")
          .run(entry.current_revision_id);
        this.db
          .prepare(
            "UPDATE shared_memory_entries SET status = 'expired', expired_at = ?, updated_at = ? WHERE id = ?",
          )
          .run(now, now, entry.id);
        this.adjustQuota(rowScope(entry), -1, 0);
      }
    })();
    return entries.length;
  }

  deleteContent(input: { entryId: string; deletedAt: string }): MemoryDetailView {
    const entry = this.entry(input.entryId);
    if (!entry) throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Shared-memory entry was not found.');
    if (entry.status === 'deleted') {
      throw new ThreadHelmError(
        'MEMORY_CONTENT_DELETED',
        'Shared-memory content is already deleted.',
      );
    }
    const retained = this.db
      .prepare(
        'SELECT COALESCE(SUM(content_bytes), 0) AS bytes FROM shared_memory_revisions WHERE entry_id = ?',
      )
      .get(entry.id) as { bytes: number };
    this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE shared_memory_revisions
           SET title = NULL, body = NULL, source_refs = '[]', content_bytes = NULL, status = 'deleted'
           WHERE entry_id = ?`,
        )
        .run(entry.id);
      this.db
        .prepare(
          `UPDATE shared_memory_entries SET status = 'deleted', current_revision_id = NULL,
             updated_at = ?, content_deleted_at = ? WHERE id = ?`,
        )
        .run(input.deletedAt, input.deletedAt, entry.id);
      this.adjustQuota(
        rowScope(entry),
        ['active', 'contested'].includes(entry.status) ? -1 : 0,
        -retained.bytes,
      );
    })();
    return this.get(entry.id, rowScope(entry));
  }
}
