/** Deterministic shared-memory state policy. No model output is authority here. */

import {
  MemorySourceReference,
  ThreadHelmError,
  type MemoryConflictState,
  type MemoryStatus,
} from '@threadhelm/contracts';

export const MEMORY_STATUS_TRANSITIONS: Readonly<Record<MemoryStatus, readonly MemoryStatus[]>> = {
  active: ['contested', 'superseded', 'retracted', 'expired', 'deleted'],
  contested: ['superseded', 'retracted', 'expired', 'deleted'],
  superseded: ['deleted'],
  retracted: ['deleted'],
  expired: ['deleted'],
  deleted: [],
};

export function advanceMemoryStatus(from: MemoryStatus, to: MemoryStatus): MemoryStatus {
  if (from === to) return to;
  if (!MEMORY_STATUS_TRANSITIONS[from].includes(to)) {
    throw new ThreadHelmError('INVALID_STATE', `Illegal memory transition ${from} -> ${to}`, {
      from,
      to,
    });
  }
  return to;
}

export function assertMemoryScope(scope: {
  workspaceId?: string | null | undefined;
  missionId?: string | null | undefined;
}): void {
  const count = Number(Boolean(scope.workspaceId)) + Number(Boolean(scope.missionId));
  if (count !== 1) {
    throw new ThreadHelmError(
      'MEMORY_SCOPE_UNAUTHORIZED',
      'Shared memory requires exactly one approved workspace or mission scope.',
    );
  }
}

export function assertMemoryAuthor(author: {
  authorSessionId: string | null;
  authorUser: boolean;
}): void {
  if (Number(author.authorUser) + Number(Boolean(author.authorSessionId)) !== 1) {
    throw new ThreadHelmError(
      'MEMORY_SOURCE_INVALID',
      'Shared memory requires exactly one authenticated session or user author.',
    );
  }
}

export function assertMemorySourceReferences(references: readonly unknown[]): void {
  if (references.length > 32) {
    throw new ThreadHelmError('MEMORY_SOURCE_INVALID', 'Too many shared-memory source references.');
  }
  for (const reference of references) {
    if (!MemorySourceReference.safeParse(reference).success) {
      throw new ThreadHelmError(
        'MEMORY_SOURCE_INVALID',
        'Shared-memory sources must be stable bounded references.',
      );
    }
  }
}

interface RevisionShape {
  id: string;
  entryId: string;
  revision: number;
  title: string | null;
  body: string | null;
  sourceRefs: readonly unknown[];
  authorSessionId: string | null;
  authorUser: boolean;
  confidence: string;
  status: MemoryStatus;
  supersedesRevisionId: string | null;
  contentBytes: number | null;
  createdAt: string;
}

/** Revision content is append-only; only status or confirmed content deletion may mutate a row. */
export function assertMemoryRevisionMutation(before: RevisionShape, after: RevisionShape): void {
  advanceMemoryStatus(before.status, after.status);
  const immutableKeys = [
    'id',
    'entryId',
    'revision',
    'authorSessionId',
    'authorUser',
    'confidence',
    'supersedesRevisionId',
    'createdAt',
  ] as const;
  const changedImmutable = immutableKeys.some((key) => before[key] !== after[key]);
  const deletion =
    after.status === 'deleted' &&
    after.title === null &&
    after.body === null &&
    after.contentBytes === null &&
    after.sourceRefs.length === 0;
  const contentUnchanged =
    before.title === after.title &&
    before.body === after.body &&
    before.contentBytes === after.contentBytes &&
    JSON.stringify(before.sourceRefs) === JSON.stringify(after.sourceRefs);
  if (changedImmutable || (!contentUnchanged && !deletion)) {
    throw new ThreadHelmError(
      'MEMORY_REVISION_STALE',
      'Shared-memory revision content is immutable; publish a newer revision instead.',
    );
  }
}

export interface MemoryConflictPolicyRecord {
  id: string;
  leftRevisionId: string;
  rightRevisionId: string;
  state: MemoryConflictState;
  reasonCode: string;
  resolvedByRevisionId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export function resolveMemoryConflict(
  conflict: MemoryConflictPolicyRecord,
  resolution: { resolutionRevisionId: string; resolvedAt: string },
): MemoryConflictPolicyRecord {
  if (
    conflict.state !== 'open' ||
    !resolution.resolutionRevisionId ||
    resolution.resolutionRevisionId === conflict.leftRevisionId ||
    resolution.resolutionRevisionId === conflict.rightRevisionId
  ) {
    throw new ThreadHelmError(
      'MEMORY_CONFLICT_OPEN',
      'Conflict resolution requires a separate attributable cited revision.',
    );
  }
  return {
    ...conflict,
    state: 'resolved',
    resolvedByRevisionId: resolution.resolutionRevisionId,
    resolvedAt: resolution.resolvedAt,
  };
}
