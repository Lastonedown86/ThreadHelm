/**
 * Launch preview and pre-launch revalidation (T043).
 *
 * A preview shows the user the exact effective path, provider executable,
 * version, and authentication state, plus the boundary disclosure. Launch
 * repeats every check and fails closed on any drift (FR-033, SC-019).
 */

import {
  BOUNDARY_WARNING,
  ProviderExecutionBounds,
  ThreadHelmError,
  type LaunchPermissionSelection,
  type LaunchPreviewView,
  type LaunchRuntimeSelection,
  type LaunchWorkType,
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
import {
  DEFAULT_PROVIDER_EXECUTION_BOUNDS,
  type PersistedRuntimePolicy,
  resolveLaunchPermission,
  resolveLaunchRuntime,
  samePermissionCapability,
} from './launch-policy.js';

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
  runtimeSelection: LaunchRuntimeSelection | null,
  permissionSelection: LaunchPermissionSelection = { policy: null, boundedAllowlist: [] },
  executionBounds: ProviderExecutionBounds = DEFAULT_PROVIDER_EXECUTION_BOUNDS,
  workType: LaunchWorkType = 'general',
  runtimeEscalationReason: string | null = null,
  persistedRuntimePolicies: {
    profileRevisionRequest: PersistedRuntimePolicy | null;
    taskTypePolicy: PersistedRuntimePolicy | null;
    projectPolicy: PersistedRuntimePolicy | null;
  } = { profileRevisionRequest: null, taskTypePolicy: null, projectPolicy: null },
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
  const adapter = ctx.adapters.find((candidate) => candidate.id === providerId);
  if (!adapter || !readiness.version) {
    throw new ThreadHelmError('PROVIDER_UNAVAILABLE', 'The provider is not ready to launch.');
  }
  const runtimeResolution = resolveLaunchRuntime({
    providerId,
    taskType: workType,
    oneRunOverride: runtimeSelection,
    ...persistedRuntimePolicies,
    escalationReason: runtimeEscalationReason,
  });
  const effectiveRuntimeSelection = runtimeResolution.runtimeSelection;
  const observedAt = ctx.clock().toISOString();
  const capabilityEvidence =
    adapter.permissionCapabilityEvidence?.({
      providerVersion: readiness.version,
      model: effectiveRuntimeSelection.model,
      observedAt,
    }) ?? null;
  const permissionResolution = resolveLaunchPermission({
    providerId,
    providerVersion: readiness.version,
    model: effectiveRuntimeSelection.model,
    invocation: 'direct',
    oneRunSelection: permissionSelection,
    taskPolicy: null,
    projectPolicy: null,
    providerDefault: 'manual',
    capabilityEvidence,
    breakGlassProof: null,
    now: observedAt,
  });
  const boundedExecution = ProviderExecutionBounds.parse(executionBounds);

  const payload: PreviewPayload = {
    workspaceId,
    identity: resolved.identity,
    canonicalPath: resolved.canonicalPath,
    providerId,
    readiness,
    terminal,
    runtimeSelection: effectiveRuntimeSelection,
    runtimeResolution,
    permissionSelection,
    permissionResolution,
    executionBounds: boundedExecution,
  };
  const { token, expiresAt } = ctx.tokens.previews.issue(payload);
  const coordinationBridge: LaunchPreviewView['coordinationBridge'] =
    adapter?.capabilities.bridgeConfiguration === 'session_scoped_stdio_mcp'
      ? {
          enabled: true as const,
          tools: ['list pending', 'acknowledge', 'reply', 'report outcome'],
          durableContent: true as const,
          failureBehavior: 'manual_only' as const,
        }
      : null;
  ctx.log.info('session.preview_issued', { workspaceId, providerId });
  return {
    previewToken: token,
    workspace: { ...workspace, lastValidatedAt: readiness.probedAt },
    readiness,
    boundaryWarning: BOUNDARY_WARNING,
    terminal,
    runtimeSelection: effectiveRuntimeSelection,
    runtimeResolution,
    permissionResolution,
    executionBounds: boundedExecution,
    coordinationBridge,
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
  if (preview.runtimeResolution.disposition !== 'ready') {
    throw new ThreadHelmError(
      'INVALID_REQUEST',
      'A recorded reason is required for this model or effort escalation.',
      { reason: preview.runtimeResolution.reasonCode ?? 'RUNTIME_POLICY_HELD' },
    );
  }
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
  const adapter = ctx.adapters.find((candidate) => candidate.id === preview.providerId);
  if (!adapter || !readiness.version) {
    throw new ThreadHelmError('PROVIDER_UNAVAILABLE', 'The provider is not ready to launch.');
  }
  const observedAt = ctx.clock().toISOString();
  const currentPermission = resolveLaunchPermission({
    providerId: preview.providerId,
    providerVersion: readiness.version,
    model: preview.runtimeSelection.model,
    invocation: 'direct',
    oneRunSelection: preview.permissionSelection,
    taskPolicy: null,
    projectPolicy: null,
    providerDefault: 'manual',
    capabilityEvidence:
      adapter.permissionCapabilityEvidence?.({
        providerVersion: readiness.version,
        model: preview.runtimeSelection.model,
        observedAt,
      }) ?? null,
    breakGlassProof: null,
    now: observedAt,
  });
  if (!samePermissionCapability(currentPermission, preview.permissionResolution)) {
    throw new ThreadHelmError(
      'PROVIDER_UNAVAILABLE',
      'The runtime permission capability changed since preview. Review the updated policy.',
      { providerId: preview.providerId, reason: 'PERMISSION_CAPABILITY_CHANGED' },
    );
  }
  if (currentPermission.disposition !== 'ready') {
    throw new ThreadHelmError(
      'PROVIDER_UNAVAILABLE',
      'The selected runtime permission policy is held for a safer action.',
      {
        providerId: preview.providerId,
        reason: currentPermission.reasonCode ?? 'PERMISSION_POLICY_HELD',
      },
    );
  }
  return { workspace, readiness, result };
}
