/**
 * One-writer rule (T058): at most one write-capable session per effective
 * workspace, keyed on (volume serial, file id) — never on path text.
 */

import { ThreadHelmError, type WorkspaceIdentity } from '@threadhelm/contracts';
import type { Context } from '../context.js';

export function assertLeaseFree(ctx: Context, identity: WorkspaceIdentity): void {
  assertMissionLeaseFree(ctx, identity);
  const holder = ctx.leases.holderOf(identity);
  if (holder) {
    throw new ThreadHelmError(
      'WRITE_LEASE_HELD',
      'Another write-capable session is already active in this folder. Select a separate folder or worktree for a parallel session.',
      { holderSessionId: holder },
    );
  }
}

/** Atomic acquire; the caller writes `starting` only after this succeeds. */
export function acquireLease(ctx: Context, identity: WorkspaceIdentity, sessionId: string): void {
  assertMissionLeaseFree(ctx, identity, sessionId);
  const result = ctx.leases.acquire(identity, sessionId);
  if (!result.ok) {
    throw new ThreadHelmError(
      'WRITE_LEASE_HELD',
      'Another write-capable session is already active in this folder. Select a separate folder or worktree for a parallel session.',
      { holderSessionId: result.holderSessionId },
    );
  }
}

/** Released only after verified scope termination or launch rollback. */
export function releaseLease(ctx: Context, sessionId: string): void {
  ctx.leases.release(sessionId);
}

/** Durable mission reservations and unknown leases also constrain direct launches. */
function assertMissionLeaseFree(
  ctx: Context,
  identity: WorkspaceIdentity,
  plannedSessionId?: string,
): void {
  const conflict = ctx.storage?.repositories.supervisor
    .leases()
    .find(
      (l) =>
        ['reserved', 'active', 'unknown'].includes(l.state) &&
        l.volumeSerial.toLowerCase() === identity.volumeSerial.toLowerCase() &&
        l.fileId.toLowerCase() === identity.fileId.toLowerCase() &&
        !(l.state === 'reserved' && plannedSessionId && l.plannedSessionId === plannedSessionId),
    );
  if (conflict)
    throw new ThreadHelmError(
      'WORK_LEASE_CONFLICT',
      'A mission reservation or unknown assignment holds this folder.',
    );
}
