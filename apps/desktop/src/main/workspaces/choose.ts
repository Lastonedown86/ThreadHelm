/**
 * Native directory picker → short-lived candidate token (T037).
 *
 * The renderer never supplies a path string. It can only ask main to open the
 * picker; the path the user picked is resolved to a handle-based identity and
 * held behind an opaque, single-use token that `workspaces.approve` consumes.
 */

import { ThreadHelmError, type WorkspaceCandidateView } from '@threadhelm/contracts';
import type { Context } from '../context.js';
import { resolveWorkspace } from './identity.js';

export async function chooseWorkspace(ctx: Context): Promise<WorkspaceCandidateView> {
  const selectedPath = await ctx.picker.pickDirectory();
  if (selectedPath === null) {
    throw new ThreadHelmError('SELECTION_CANCELLED', 'No folder was selected.');
  }
  const resolved = resolveWorkspace(ctx, selectedPath);
  const existing = ctx.storage?.repositories.workspaces.findActiveByIdentity(
    resolved.identity.volumeSerial,
    resolved.identity.fileId,
  );
  const { token, expiresAt } = ctx.tokens.candidates.issue({
    selectedPath: resolved.selectedPath,
    canonicalPath: resolved.canonicalPath,
    displayPath: resolved.displayPath,
    identity: resolved.identity,
    isReparsePoint: resolved.isReparsePoint,
  });
  ctx.log.info('workspace.candidate_issued', { isReparsePoint: resolved.isReparsePoint });
  return {
    candidateToken: token,
    selectedPath: resolved.selectedPath,
    displayPath: resolved.displayPath,
    canonicalPath: resolved.canonicalPath,
    identity: resolved.identity,
    driveType: 'fixed_local',
    isReparsePoint: resolved.isReparsePoint,
    existingWorkspaceId: existing?.id ?? null,
    expiresAt,
  };
}
