import { describe, expect, it } from 'vitest';
import type { MemoryStatus } from '@threadhelm/contracts';
import {
  MEMORY_STATUS_TRANSITIONS,
  advanceMemoryStatus,
  assertMemoryAuthor,
  assertMemoryRevisionMutation,
  assertMemoryScope,
  assertMemorySourceReferences,
  resolveMemoryConflict,
} from '@threadhelm/domain';

const REVISION = {
  id: '00000000-0000-4000-8000-000000000101',
  entryId: '00000000-0000-4000-8000-000000000100',
  revision: 1,
  title: 'Build authority',
  body: 'Only the owner can approve deployment.',
  sourceRefs: [{ kind: 'artifact' as const, id: 'specs/authority.md' }],
  authorSessionId: null,
  authorUser: true,
  confidence: 'high' as const,
  status: 'active' as const,
  supersedesRevisionId: null,
  contentBytes: 36,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('shared-memory domain policy', () => {
  it('permits only the documented lifecycle transitions', () => {
    const expected: Readonly<Record<MemoryStatus, readonly MemoryStatus[]>> = {
      active: ['contested', 'superseded', 'retracted', 'expired', 'deleted'],
      contested: ['superseded', 'retracted', 'expired', 'deleted'],
      superseded: ['deleted'],
      retracted: ['deleted'],
      expired: ['deleted'],
      deleted: [],
    };
    const statuses = Object.keys(expected) as MemoryStatus[];

    expect(MEMORY_STATUS_TRANSITIONS).toEqual(expected);
    for (const from of statuses) {
      for (const to of statuses) {
        if (from === to || expected[from].includes(to)) {
          expect(advanceMemoryStatus(from, to)).toBe(to);
        } else {
          expect(() => advanceMemoryStatus(from, to)).toThrowError(
            expect.objectContaining({ code: 'INVALID_STATE' }),
          );
        }
      }
    }
  });

  it('requires exactly one workspace or mission scope', () => {
    expect(() =>
      assertMemoryScope({ workspaceId: '00000000-0000-4000-8000-000000000001' }),
    ).not.toThrow();
    expect(() =>
      assertMemoryScope({ missionId: '00000000-0000-4000-8000-000000000002' }),
    ).not.toThrow();
    expect(() => assertMemoryScope({})).toThrowError(
      expect.objectContaining({ code: 'MEMORY_SCOPE_UNAUTHORIZED' }),
    );
    expect(() =>
      assertMemoryScope({
        workspaceId: '00000000-0000-4000-8000-000000000001',
        missionId: '00000000-0000-4000-8000-000000000002',
      }),
    ).toThrowError(expect.objectContaining({ code: 'MEMORY_SCOPE_UNAUTHORIZED' }));
  });

  it('requires exactly one authenticated session or explicit user author', () => {
    expect(() => assertMemoryAuthor({ authorSessionId: null, authorUser: true })).not.toThrow();
    expect(() =>
      assertMemoryAuthor({
        authorSessionId: '00000000-0000-4000-8000-000000000003',
        authorUser: false,
      }),
    ).not.toThrow();
    expect(() => assertMemoryAuthor({ authorSessionId: null, authorUser: false })).toThrowError(
      expect.objectContaining({ code: 'MEMORY_SOURCE_INVALID' }),
    );
    expect(() =>
      assertMemoryAuthor({
        authorSessionId: '00000000-0000-4000-8000-000000000003',
        authorUser: true,
      }),
    ).toThrowError(expect.objectContaining({ code: 'MEMORY_SOURCE_INVALID' }));
  });

  it('accepts only bounded stable source references, never raw provider payloads', () => {
    expect(() =>
      assertMemorySourceReferences([
        { kind: 'handoff', id: '00000000-0000-4000-8000-000000000004' },
        { kind: 'artifact', id: 'specs/002-agent-mailbox-routing/spec.md' },
      ]),
    ).not.toThrow();
    expect(() =>
      assertMemorySourceReferences([
        { kind: 'provider_transcript', id: 'raw-turn', payload: 'hidden reasoning' },
      ] as never),
    ).toThrowError(expect.objectContaining({ code: 'MEMORY_SOURCE_INVALID' }));
  });

  it('keeps revision content immutable while allowing explicit lifecycle disposition', () => {
    expect(() =>
      assertMemoryRevisionMutation(REVISION, { ...REVISION, status: 'contested' }),
    ).not.toThrow();
    expect(() =>
      assertMemoryRevisionMutation(REVISION, { ...REVISION, body: 'Silently rewritten' }),
    ).toThrowError(expect.objectContaining({ code: 'MEMORY_REVISION_STALE' }));
    expect(() =>
      assertMemoryRevisionMutation(REVISION, {
        ...REVISION,
        title: null,
        body: null,
        sourceRefs: [],
        contentBytes: null,
        status: 'deleted',
      }),
    ).not.toThrow();
  });

  it('cannot resolve a conflict from confidence or rank without a cited revision', () => {
    const conflict = {
      id: '00000000-0000-4000-8000-000000000201',
      leftRevisionId: '00000000-0000-4000-8000-000000000101',
      rightRevisionId: '00000000-0000-4000-8000-000000000102',
      state: 'open' as const,
      reasonCode: 'EXPLICIT_REPORT',
      resolvedByRevisionId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      resolvedAt: null,
    };

    expect(() =>
      resolveMemoryConflict(conflict, {
        resolutionRevisionId: null,
        resolvedAt: '2026-01-01T00:01:00.000Z',
        confidence: 'high',
        rank: 1,
      } as never),
    ).toThrowError(expect.objectContaining({ code: 'MEMORY_CONFLICT_OPEN' }));

    expect(
      resolveMemoryConflict(conflict, {
        resolutionRevisionId: '00000000-0000-4000-8000-000000000103',
        resolvedAt: '2026-01-01T00:01:00.000Z',
      }),
    ).toMatchObject({
      state: 'resolved',
      resolvedByRevisionId: '00000000-0000-4000-8000-000000000103',
    });
  });
});
