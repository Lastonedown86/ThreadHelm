import { describe, expect, it } from 'vitest';
import {
  MemoryDetailView,
  MemorySearchPageView,
  MemorySummaryView,
  ProviderMemoryGetInput,
  ProviderMemoryProposeRevisionInput,
  ProviderMemorySearchInput,
  operations,
} from '@threadhelm/contracts';
import { BridgeSessionManager } from '../../apps/desktop/src/main/coordination/bridge.js';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const ENTRY_ID = '00000000-0000-4000-8000-000000000010';
const REVISION_ID = '00000000-0000-4000-8000-000000000011';
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
  createdAt: AT,
  updatedAt: AT,
};

describe('shared-memory desktop and provider contracts', () => {
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
