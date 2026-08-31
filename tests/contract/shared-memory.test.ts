import { describe, expect, it } from 'vitest';
import {
  MemoryConflictView,
  MemoryDetailView,
  MemorySearchPageView,
  MemorySummaryView,
  ProviderMemoryGetInput,
  ProviderMemoryProposeRevisionInput,
  ProviderMemorySearchInput,
  operations,
} from '@threadhelm/contracts';
import { BridgeSessionManager } from '../../apps/desktop/src/main/coordination/bridge.js';
import { createWorld, identity } from './helpers/fake-context.js';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const ENTRY_ID = '00000000-0000-4000-8000-000000000010';
const REVISION_ID = '00000000-0000-4000-8000-000000000011';
const OTHER_ENTRY_ID = '00000000-0000-4000-8000-000000000012';
const OTHER_REVISION_ID = '00000000-0000-4000-8000-000000000013';
const AT = '2026-01-01T00:00:00.000Z';

const summary = {
  entryId: ENTRY_ID,
  revisionId: REVISION_ID,
  scope: { workspaceId: WORKSPACE_ID },
  kind: 'fact',
  status: 'active',
  title: 'Bounded title',
  author: { kind: 'user' },
  sourceRefs: [{ kind: 'artifact', id: 'spec.md' }],
  confidence: 'medium',
  conflictCount: 0,
  expiresAt: null,
  expiredAt: null,
  createdAt: AT,
  updatedAt: AT,
};

describe('shared-memory desktop and provider contracts', () => {
  it('rejects adversarial content and scope/role extensions before publication', async () => {
    const world = createWorld();
    const path = 'C:\\projects\\memory-fuzz';
    world.addDir(path, identity(901));
    const workspace = await world.approve(path);
    const base = {
      scope: { workspaceId: workspace.id },
      kind: 'fact',
      title: 'Bounded fact',
      body: 'Deliberate text',
      sourceRefs: [],
      confidence: 'unknown',
    };
    for (const body of [
      '\ud800',
      '\udfff',
      '\u001b]52;c;synthetic\u0007',
      '\u009b31m',
      'ghp_' + 'synthetic'.repeat(4),
      '界'.repeat(16_384),
    ]) {
      const result = await world.call('memory.previewPublish', { ...base, body });
      expect(result.ok, JSON.stringify(body).slice(0, 80)).toBe(false);
      expect(JSON.stringify(result)).not.toContain(body);
    }
    for (const extra of [
      { role: 'supervisor' },
      { authorSessionId: ENTRY_ID },
      { scope: { workspaceId: workspace.id, missionId: ENTRY_ID } },
      { transcript: 'not allowed' },
    ]) {
      expect((await world.call('memory.previewPublish', { ...base, ...extra })).ok).toBe(false);
    }
    expect(
      world.ctx.storage!.db.prepare('SELECT count(*) AS count FROM shared_memory_revisions').get(),
    ).toEqual({ count: 0 });
  });

  it('accepts exactly one strict scope and rejects arbitrary fields', () => {
    const search = operations['memory.search'].request;
    expect(
      search.parse({ scope: { workspaceId: WORKSPACE_ID }, query: 'authority', limit: 20 }),
    ).toEqual({ scope: { workspaceId: WORKSPACE_ID }, query: 'authority', limit: 20 });
    expect(() =>
      search.parse({
        scope: { workspaceId: WORKSPACE_ID, missionId: WORKSPACE_ID },
        query: 'authority',
      }),
    ).toThrow();
    expect(() =>
      search.parse({ scope: { workspaceId: WORKSPACE_ID }, query: 'authority', rawSql: true }),
    ).toThrow();
  });

  it('rejects terminal controls and credentials hidden in citation identifiers', () => {
    for (const id of [
      '\ud800',
      '\u001b]52;c;synthetic\u0007',
      'API_TOKEN=synthetic',
      'password: syntheticexample',
    ]) {
      expect(
        ProviderMemoryProposeRevisionInput.safeParse({
          kind: 'fact',
          title: 'Cited fact',
          body: 'Deliberate text',
          sourceRefs: [{ kind: 'artifact', id }],
          confidence: 'unknown',
        }).success,
      ).toBe(false);
    }
  });

  it('bounds queries, results, excerpts, and strict cursors', () => {
    const search = operations['memory.search'].request;
    expect(() =>
      search.parse({ scope: { workspaceId: WORKSPACE_ID }, query: '', limit: 1 }),
    ).toThrow();
    expect(() =>
      search.parse({ scope: { workspaceId: WORKSPACE_ID }, query: 'x', limit: 21 }),
    ).toThrow();
    expect(() =>
      MemorySearchPageView.parse({
        items: [{ ...summary, excerpt: 'x'.repeat(4097), rank: 0.5 }],
        nextCursor: null,
      }),
    ).toThrow();
    expect(
      MemorySearchPageView.parse({
        items: [{ ...summary, excerpt: 'x'.repeat(4096), rank: 0.5 }],
        nextCursor: null,
      }).items,
    ).toHaveLength(1);
  });

  it('keeps summary events content-free and loads body only through detail', () => {
    expect(MemorySummaryView.parse(summary)).toEqual(summary);
    expect(() =>
      MemorySummaryView.parse({ ...summary, body: 'must not cross broad events' }),
    ).toThrow();
    expect(
      MemoryDetailView.parse({
        summary,
        body: 'Loaded only for one explicit detail request.',
        lineage: [
          {
            id: REVISION_ID,
            entryId: ENTRY_ID,
            revision: 1,
            title: 'Bounded title',
            body: 'Loaded only for one explicit detail request.',
            sourceRefs: summary.sourceRefs,
            author: summary.author,
            confidence: 'medium',
            status: 'active',
            supersedesRevisionId: null,
            contentBytes: 45,
            createdAt: AT,
          },
        ],
        conflicts: [],
        availableActions: ['supersede', 'retract', 'delete'],
      }).body,
    ).toContain('explicit detail');
  });

  it('defines every named desktop operation with preview/confirmation boundaries', () => {
    const publish = {
      scope: { workspaceId: WORKSPACE_ID },
      kind: 'decision',
      title: 'Use FTS5',
      body: 'Use deterministic local text retrieval first.',
      sourceRefs: [{ kind: 'artifact', id: 'research.md' }],
      confidence: 'high',
      memoryExpiresAt: '2026-02-01T00:00:00.000Z',
    };
    expect(operations['memory.previewPublish'].request.parse(publish)).toEqual(publish);
    expect(
      operations['memory.confirmPublish'].request.parse({
        publishToken: 'opaque-token-1234',
        durableContentConfirmation: true,
      }),
    ).toBeTruthy();
    expect(
      operations['memory.previewSupersede'].request.parse({
        entryId: ENTRY_ID,
        targetRevisionId: REVISION_ID,
        title: 'Use FTS5',
        body: 'Keep deterministic FTS5 and stable keyset pagination.',
        sourceRefs: [{ kind: 'memory', id: ENTRY_ID }],
        confidence: 'high',
      }),
    ).toBeTruthy();
    expect(() =>
      operations['memory.previewSupersede'].request.parse({
        entryId: ENTRY_ID,
        targetRevisionId: REVISION_ID,
        title: 'Use FTS5',
        body: 'Expiry belongs to publication, not supersession.',
        sourceRefs: [{ kind: 'memory', id: ENTRY_ID }],
        confidence: 'high',
        memoryExpiresAt: '2026-02-01T00:00:00.000Z',
      }),
    ).toThrow();
    expect(
      operations['memory.retract'].request.parse({
        entryId: ENTRY_ID,
        revisionId: REVISION_ID,
        reasonCode: 'OWNER_WITHDREW',
      }),
    ).toBeTruthy();
    expect(
      operations['memory.resolveConflict'].request.parse({
        conflictId: ENTRY_ID,
        resolutionRevisionId: REVISION_ID,
      }),
    ).toBeTruthy();
    expect(operations['memory.requestDeletion'].request.parse({ entryId: ENTRY_ID })).toBeTruthy();
    expect(
      operations['memory.confirmDeletion'].request.parse({
        deletionToken: 'opaque-token-1234',
        permanentDeletionConfirmation: true,
      }),
    ).toBeTruthy();
  });

  it('identifies both competing entries and carries explicit expiry through disclosure contracts', () => {
    expect(
      MemoryConflictView.parse({
        id: '00000000-0000-4000-8000-000000000014',
        leftRevisionId: REVISION_ID,
        leftEntryId: ENTRY_ID,
        rightRevisionId: OTHER_REVISION_ID,
        rightEntryId: OTHER_ENTRY_ID,
        state: 'open',
        reasonCode: 'EXACT_SUBJECT_CONFLICT',
        resolvedByRevisionId: null,
        createdAt: AT,
        resolvedAt: null,
      }),
    ).toMatchObject({ leftEntryId: ENTRY_ID, rightEntryId: OTHER_ENTRY_ID });
    expect(
      operations['memory.previewPublish'].response.parse({
        publishToken: 'opaque-token-1234',
        scope: { workspaceId: WORKSPACE_ID },
        kind: 'fact',
        title: 'Expiring fact',
        body: 'This deliberate memory has an explicit lifetime.',
        sourceRefs: [],
        confidence: 'medium',
        memoryExpiresAt: '2026-02-01T00:00:00.000Z',
        expiresAt: '2026-01-01T00:02:00.000Z',
        safeSummary: 'Review expiry.',
      }).memoryExpiresAt,
    ).toBe('2026-02-01T00:00:00.000Z');
  });

  it('keeps provider tools scope- and author-free while bounding deliberate content', () => {
    expect(ProviderMemorySearchInput.parse({ query: 'authority', limit: 5 })).toEqual({
      query: 'authority',
      limit: 5,
    });
    expect(ProviderMemoryGetInput.parse({ entryId: ENTRY_ID })).toEqual({ entryId: ENTRY_ID });
    expect(
      ProviderMemoryProposeRevisionInput.parse({
        kind: 'fact',
        title: 'Fixture fact',
        body: 'Deliberately submitted provider content.',
        sourceRefs: [{ kind: 'handoff', id: ENTRY_ID }],
        confidence: 'low',
      }),
    ).toBeTruthy();
    expect(() =>
      ProviderMemorySearchInput.parse({ query: 'authority', workspaceId: WORKSPACE_ID }),
    ).toThrow();
    expect(() =>
      ProviderMemoryProposeRevisionInput.parse({
        kind: 'fact',
        body: 'x',
        authorSessionId: ENTRY_ID,
        missionId: WORKSPACE_ID,
      }),
    ).toThrow();
  });

  it('derives provider scope from the authenticated bridge session and rejects impersonation', async () => {
    const manager = new BridgeSessionManager();
    const seen: { sessionId: string | null } = { sessionId: null };
    manager.setMemoryAuthority({
      searchForSession(sessionId) {
        seen.sessionId = sessionId;
        return { items: [], nextCursor: null };
      },
      getForSession() {
        throw new Error('not used');
      },
      proposeForSession() {
        throw new Error('not used');
      },
    });
    const sessionId = '00000000-0000-4000-8000-000000000099';
    const credential = manager.issueCredential(sessionId, 'codex-cli', 'fixture');

    const response = await manager.dispatch(sessionId, credential.token, {
      jsonrpc: '2.0',
      id: 1,
      method: 'threadhelm_memory_search',
      params: { query: 'authority', limit: 5 },
    });
    expect(response.result).toEqual({ items: [], nextCursor: null });
    expect(seen.sessionId).toBe(sessionId);

    await expect(
      manager.dispatch(sessionId, credential.token, {
        jsonrpc: '2.0',
        id: 2,
        method: 'threadhelm_memory_search',
        params: { query: 'authority', workspaceId: WORKSPACE_ID },
      }),
    ).rejects.toThrow();
    await expect(
      manager.dispatch(sessionId, credential.token, {
        jsonrpc: '2.0',
        id: 3,
        method: 'threadhelm_memory_propose_revision',
        params: { kind: 'fact', body: 'claim', authorSessionId: ENTRY_ID },
      }),
    ).rejects.toThrow();
  });
});
