/**
 * One-writer rule (T058): at most one write-capable session per effective
 * workspace, keyed on (volume serial, file id) — never on path text.
 */

import { ThreadHelmError, type WorkspaceIdentity } from '@threadhelm/contracts';
import type { Context } from '../context.js';

export function assertLeaseFree(ctx: Context, identity: WorkspaceIdentity): void {
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
