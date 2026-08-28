/**
 * Launch preview and pre-launch revalidation (T043).
 *
 * A preview shows the user the exact effective path, provider executable,
 * version, and authentication state, plus the boundary disclosure. Launch
 * repeats every check and fails closed on any drift (FR-033, SC-019).
 */

import {
  BOUNDARY_WARNING,
  ThreadHelmError,
  type LaunchPreviewView,
  type ProviderId,
  type ReadinessView,
  type TerminalSize,
} from '@threadhelm/contracts';
import type { ReadinessResult } from '@threadhelm/providers';
import type { Context, PreviewPayload } from '../context.js';
import { probeProvider } from '../providers/readiness.js';
import { findWorkspace } from '../workspaces/service.js';
import { revalidateWorkspace, type ResolvedWorkspace } from '../workspaces/identity.js';
import { assertLeaseFree } from './lease.js';

export function assertReady(view: ReadinessView): void {
  if (view.availability !== 'available' || view.authentication === 'unauthenticated') {
    throw new ThreadHelmError('PROVIDER_UNAVAILABLE', view.safeSummary, {
      providerId: view.providerId,
      availability: view.availability,
      authentication: view.authentication,
      reasonCode: view.reasonCode ?? '',
    });
  }
}

export async function previewLaunch(
  ctx: Context,
  workspaceId: string,
  providerId: ProviderId,
  terminal: TerminalSize,
): Promise<LaunchPreviewView> {
  const workspace = findWorkspace(ctx, workspaceId);
  if (workspace.revokedAt) {
    throw new ThreadHelmError('WORKSPACE_CHANGED', 'This workspace approval was revoked.', {
      workspaceId,
      reason: 'REVOKED',
    });
  }
  const resolved = revalidateWorkspace(ctx, workspace);
  assertLeaseFree(ctx, resolved.identity);
  const { view: readiness } = await probeProvider(ctx, providerId, [resolved.canonicalPath]);
  assertReady(readiness);
  ctx.health.bestEffort(() =>
    ctx.storage?.repositories.workspaces.markValidated(workspaceId, readiness.probedAt),
  );

  const payload: PreviewPayload = {
    workspaceId,
    identity: resolved.identity,
    canonicalPath: resolved.canonicalPath,
    providerId,
    readiness,
    terminal,
  };
  const { token, expiresAt } = ctx.tokens.previews.issue(payload);
  ctx.log.info('session.preview_issued', { workspaceId, providerId });
  return {
    previewToken: token,
    workspace: { ...workspace, lastValidatedAt: readiness.probedAt },
    readiness,
    boundaryWarning: BOUNDARY_WARNING,
    terminal,
    expiresAt,
  };
}

export interface RevalidatedLaunch {
  workspace: ResolvedWorkspace;
  readiness: ReadinessView;
  result: ReadinessResult;
}

/**
 * Immediately before process creation: same folder identity, same executable,
 * same version, still authenticated. Anything else is stale and blocked.
 */
export async function revalidatePreview(
  ctx: Context,
  preview: PreviewPayload,
): Promise<RevalidatedLaunch> {
  const workspaceRecord = findWorkspace(ctx, preview.workspaceId);
  if (workspaceRecord.revokedAt) {
    throw new ThreadHelmError('WORKSPACE_CHANGED', 'This workspace approval was revoked.', {
      workspaceId: preview.workspaceId,
      reason: 'REVOKED',
    });
  }
  const workspace = revalidateWorkspace(ctx, workspaceRecord);
  if (
    workspace.identity.volumeSerial !== preview.identity.volumeSerial ||
    workspace.identity.fileId !== preview.identity.fileId
  ) {
    throw new ThreadHelmError('WORKSPACE_CHANGED', 'The folder changed since the preview.', {
      workspaceId: preview.workspaceId,
      reason: 'IDENTITY_MISMATCH',
    });
  }
  const { view: readiness, result } = await probeProvider(ctx, preview.providerId, [
    workspace.canonicalPath,
  ]);
  assertReady(readiness);
  const drift =
    readiness.resolvedExecutable !== preview.readiness.resolvedExecutable
      ? 'EXECUTABLE_CHANGED'
      : readiness.version !== preview.readiness.version
        ? 'VERSION_CHANGED'
        : readiness.authentication !== preview.readiness.authentication
          ? 'AUTHENTICATION_CHANGED'
          : null;
  if (drift) {
    throw new ThreadHelmError(
      'PROVIDER_UNAVAILABLE',
      'The provider changed since the preview. Review the updated readiness and try again.',
      { providerId: preview.providerId, reason: 'STALE_PREFLIGHT', drift },
    );
  }
  return { workspace, readiness, result };
}
