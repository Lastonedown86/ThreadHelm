/**
 * Revocation policy (T085).
 *
 * An approval cannot be revoked while any live (non-terminal) session uses the
 * workspace — invariant 8. Sessions that already ended, or that are waiting in
 * `recovery_required`, keep their historical workspace reference; the
 * workspace simply shows as revoked and cannot host a new launch. Revoking
 * also invalidates any candidate or preview token pointing at it.
 */

import { ThreadHelmError } from '@threadhelm/contracts';
import { isTerminal } from '@threadhelm/domain';
import type { Context } from '../context.js';

export function assertRevocable(ctx: Context, workspaceId: string): void {
  const active = [...ctx.live.values()].filter(
    (session) => session.workspaceId === workspaceId && !isTerminal(session.state),
  );
  if (active.length > 0) {
    throw new ThreadHelmError(
      'WORKSPACE_ACTIVE',
      'Stop the sessions running in this folder before revoking its approval.',
      { activeSessions: active.length, sessionId: active[0]!.id },
    );
  }
}

export function onWorkspaceRevoked(ctx: Context, workspaceId: string, identityKey: string): void {
  ctx.tokens.previews.revokeWhere((preview) => preview.workspaceId === workspaceId);
  ctx.tokens.candidates.revokeWhere(
    (candidate) =>
      `${candidate.identity.volumeSerial}:${candidate.identity.fileId}` === identityKey,
  );
  ctx.log.info('workspace.revoked', { workspaceId });
}
