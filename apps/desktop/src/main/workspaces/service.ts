/**
 * Approve, list, and revoke workspaces (T039).
 */

import {
  ThreadHelmError,
  workspaceIdentityKey,
  type ApprovedWorkspaceView,
} from '@threadhelm/contracts';
import { safeTemplate } from '@threadhelm/persistence';
import { now, type Context } from '../context.js';
import { resolveWorkspace, sameIdentity } from './identity.js';
import { assertRevocable, onWorkspaceRevoked } from './revocation.js';

function storageOf(ctx: Context) {
  if (!ctx.storage) {
    throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Local storage is unavailable.');
  }
  return ctx.storage;
}

export function approveWorkspace(ctx: Context, candidateToken: string): ApprovedWorkspaceView {
  const candidate = ctx.tokens.candidates.take(candidateToken);
  if (!candidate) {
    throw new ThreadHelmError('CANDIDATE_EXPIRED', 'Choose the folder again to approve it.');
  }
  // Approval is a fresh handle-based check, independent of the picker's.
  const fresh = resolveWorkspace(ctx, candidate.selectedPath);
  if (!sameIdentity(fresh.identity, candidate.identity)) {
    throw new ThreadHelmError(
      'WORKSPACE_CHANGED',
      'The folder changed between selection and approval. Choose it again.',
      { reason: 'IDENTITY_MISMATCH' },
    );
  }
  const storage = storageOf(ctx);
  ctx.health.assertWritable();
  const existing = storage.repositories.workspaces.findActiveByIdentity(
    fresh.identity.volumeSerial,
    fresh.identity.fileId,
  );
  if (existing) {
    ctx.health.bestEffort(() =>
      storage.repositories.workspaces.markValidated(existing.id, now(ctx)),
    );
    return storage.repositories.workspaces.findById(existing.id) ?? existing;
  }
  const at = now(ctx);
  const view = ctx.health.required(() =>
    storage.repositories.workspaces.insertApproval({
      selectedPath: fresh.selectedPath,
      displayPath: fresh.displayPath,
      canonicalPath: fresh.canonicalPath,
      volumeSerial: fresh.identity.volumeSerial,
      fileId: fresh.identity.fileId,
      approvedAt: at,
    }),
  );
  ctx.log.info('workspace.approved', {
    workspaceId: view.id,
    summary: safeTemplate('workspace_approved'),
  });
  ctx.events.emit('workspace.changed', view);
  return view;
}

export function listWorkspaces(ctx: Context): ApprovedWorkspaceView[] {
  return storageOf(ctx).repositories.workspaces.listAll();
}

export function findWorkspace(ctx: Context, workspaceId: string): ApprovedWorkspaceView {
  const workspace = storageOf(ctx).repositories.workspaces.findById(workspaceId);
  if (!workspace) {
    throw new ThreadHelmError('WORKSPACE_NOT_FOUND', 'That workspace is not approved.');
  }
  return workspace;
}

export function revokeWorkspace(ctx: Context, workspaceId: string): ApprovedWorkspaceView {
  const workspace = findWorkspace(ctx, workspaceId);
  if (workspace.revokedAt) return workspace;
  assertRevocable(ctx, workspaceId);
  ctx.health.assertWritable();
  const storage = storageOf(ctx);
  const view = ctx.health.required(() =>
    storage.repositories.workspaces.revoke(workspaceId, now(ctx)),
  );
  if (!view) throw new ThreadHelmError('WORKSPACE_NOT_FOUND', 'That workspace is not approved.');
  onWorkspaceRevoked(ctx, workspaceId, workspaceIdentityKey(view));
  ctx.events.emit('workspace.changed', view);
  return view;
}
