/** Exact user-confirmed mission launch tuples; only main resolves these values. */
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  MissionBindingView,
  MissionEnvelopeInput,
  MissionEnvelopeView,
  ThreadHelmError,
  type MissionEligibleSessionView,
  type ProviderId,
} from '@threadhelm/contracts';
import type { Context, PreviewPayload } from '../context.js';
import { probeProvider } from '../providers/readiness.js';
import { previewLaunch } from '../sessions/preview.js';
import { resolveLaunchPermission, samePermissionCapability } from '../sessions/launch-policy.js';
import { revalidateWorkspace } from '../workspaces/identity.js';

// SQLite/schema round-trips may reorder object properties. Equality still
// compares every resolved value; serialization order carries no authority.
const equal = isDeepStrictEqual;
export function eligibleMissionSessions(ctx: Context): MissionEligibleSessionView[] {
  if (!ctx.storage || ctx.health.degraded) throw new ThreadHelmError('STORAGE_UNAVAILABLE');
  return [...ctx.live.values()]
    .filter(
      (s) =>
        s.state === 'running' &&
        s.launchSnapshot &&
        s.launchSnapshot.permissionResolution.policy !== 'break_glass_bypass',
    )
    .map((s) => ({
      sessionId: s.id,
      workspaceId: s.workspaceId,
      providerId: s.providerId,
      runtimeSelection: s.launchSnapshot!.runtimeSelection,
      permissionSelection: s.launchSnapshot!.permissionSelection,
      permissionResolution: s.launchSnapshot!.permissionResolution,
      executionBounds: s.launchSnapshot!.executionBounds,
    }));
}
export function missionPreviewPayload(binding: MissionBindingView): PreviewPayload {
  return {
    workspaceId: binding.workspaceId,
    identity: binding.identity,
    canonicalPath: binding.canonicalPath,
    providerId: binding.providerId,
    readiness: binding.readiness,
    terminal: binding.terminal,
    runtimeSelection: binding.runtimeSelection,
    runtimeResolution: binding.runtimeResolution,
    permissionSelection: binding.permissionSelection,
    permissionResolution: binding.permissionResolution,
    executionBounds: binding.executionBounds,
  };
}
/** Probe time is observation metadata; all resolved launch and capability values remain exact. */
export function sameMissionLaunchSnapshot(left: PreviewPayload, right: PreviewPayload): boolean {
  const normalize = (value: PreviewPayload) => ({
    ...value,
    readiness: { ...value.readiness, probedAt: '' },
  });
  return equal(normalize(left), normalize(right));
}
export function assertMissionProfile(
  ctx: Context,
  binding: Pick<MissionBindingView, 'profileId' | 'profileRevisionId' | 'profileDigest'>,
): void {
  const profile = ctx.storage?.repositories.agentProfiles.getDetailByRevision(
    binding.profileRevisionId,
  );
  if (
    !profile ||
    profile.profileId !== binding.profileId ||
    profile.currentRevisionId !== binding.profileRevisionId ||
    profile.digest !== binding.profileDigest ||
    profile.state !== 'active' ||
    profile.compatibility !== 'compatible'
  )
    throw new ThreadHelmError(
      'MISSION_ENVELOPE_STALE',
      'The pinned profile is no longer available.',
    );
}
export async function resolveMissionEnvelope(
  ctx: Context,
  raw: MissionEnvelopeInput,
  previous?: MissionEnvelopeView | null,
): Promise<MissionEnvelopeView> {
  const input = MissionEnvelopeInput.parse(raw);
  if (!ctx.storage || ctx.health.degraded) throw new ThreadHelmError('STORAGE_UNAVAILABLE');
  if (
    new Set(input.workspaces.map((w) => w.workspaceId)).size !== input.workspaces.length ||
    new Set(input.permittedRoutineActions).size !== input.permittedRoutineActions.length ||
    new Set(input.escalationRules).size !== 4
  )
    throw new ThreadHelmError('INVALID_REQUEST');
  const workspaceMap = new Map(input.workspaces.map((w) => [w.workspaceId, w]));
  for (const { workspaceId } of input.workspaces) {
    const w = ctx.storage.repositories.workspaces.findById(workspaceId);
    if (!w || w.revokedAt) throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
    revalidateWorkspace(ctx, w);
  }
  const supervisor = ctx.live.get(input.supervisor.sessionId);
  if (
    supervisor?.state !== 'running' ||
    !supervisor.launchSnapshot ||
    !workspaceMap.has(supervisor.workspaceId)
  )
    throw new ThreadHelmError(
      'SUPERVISOR_NOT_BOUND',
      'Select a running session with a recorded launch disclosure.',
    );
  const requests = [
    {
      ...input.supervisor,
      workspaceId: supervisor.workspaceId,
      role: 'supervisor' as const,
      autoStart: false,
      runtimeSelection: supervisor.launchSnapshot.runtimeSelection,
      permissionSelection: supervisor.launchSnapshot.permissionSelection,
      executionBounds: supervisor.launchSnapshot.executionBounds,
      assignment: null,
      requiredReturnEvidence: [],
    },
    ...input.workers,
  ];
  const sessions = requests.flatMap((r) => (r.sessionId ? [r.sessionId] : []));
  if (new Set(sessions).size !== sessions.length)
    throw new ThreadHelmError('SUPERVISOR_NOT_BOUND', 'A session may hold only one mission role.');
  const bindings: MissionBindingView[] = [];
  for (const request of requests) {
    const profile = ctx.storage.repositories.agentProfiles.getDetailByRevision(
      request.profileRevisionId,
    );
    const workspace = ctx.storage.repositories.workspaces.findById(request.workspaceId);
    const mode = workspaceMap.get(request.workspaceId)?.mode;
    if (
      !profile ||
      profile.profileId !== request.profileId ||
      profile.currentRevisionId !== request.profileRevisionId ||
      profile.state !== 'active' ||
      profile.compatibility !== 'compatible' ||
      !workspace ||
      !mode
    )
      throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
    const providerId: ProviderId = ['codex', 'codex-cli'].includes(profile.requestedProvider)
      ? 'codex-cli'
      : 'claude-code';
    let snapshot: PreviewPayload;
    if (request.sessionId) {
      const live = ctx.live.get(request.sessionId);
      if (
        live?.state !== 'running' ||
        !live.launchSnapshot ||
        live.providerId !== providerId ||
        live.workspaceId !== request.workspaceId
      )
        throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
      snapshot = structuredClone(live.launchSnapshot);
      if (
        !equal(snapshot.runtimeSelection, request.runtimeSelection) ||
        !equal(snapshot.permissionSelection, request.permissionSelection) ||
        !equal(snapshot.executionBounds, request.executionBounds)
      )
        throw new ThreadHelmError(
          'MISSION_ENVELOPE_STALE',
          'Active worker settings must match its recorded launch.',
        );
    } else {
      const preview = await previewLaunch(
        ctx,
        request.workspaceId,
        providerId,
        { columns: 100, rows: 30 },
        request.runtimeSelection,
        request.permissionSelection,
        request.executionBounds,
      );
      const payload = ctx.tokens.previews.take(preview.previewToken);
      if (!payload) throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
      snapshot = payload;
    }
    if (snapshot.permissionResolution.policy === 'break_glass_bypass')
      throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
    const reason =
      snapshot.runtimeResolution.disposition !== 'ready'
        ? (snapshot.runtimeResolution.reasonCode ?? 'RUNTIME_POLICY_HELD')
        : snapshot.permissionResolution.disposition !== 'ready'
          ? 'PERMISSION_AUTO_UNAVAILABLE'
          : profile.isolateRequested
            ? 'ISOLATION_UNPROVED'
            : mode === 'read'
              ? 'READ_ONLY_RUNTIME_UNPROVED'
              : null;
    const prior = previous?.bindings.find(
      (b) =>
        b.profileId === request.profileId &&
        b.profileRevisionId === request.profileRevisionId &&
        b.workspaceId === request.workspaceId &&
        b.role === request.role,
    );
    const binding = MissionBindingView.parse({
      ...snapshot,
      bindingId: prior?.bindingId ?? randomUUID(),
      role: request.role,
      profileId: profile.profileId,
      profileRevisionId: profile.currentRevisionId,
      profileDigest: profile.digest,
      sessionId: request.sessionId,
      autoStart: request.autoStart,
      mode,
      displayPath: workspace.displayPath,
      requestedIsolation: profile.isolateRequested,
      effectiveIsolation: false,
      effectiveTokenBudget: Math.min(profile.tokenCapRequested, input.bounds.maxTokenBudget),
      launchDisposition: reason ? 'held' : 'ready',
      reasonCode: reason,
      assignment: request.assignment,
      requiredReturnEvidence: request.requiredReturnEvidence,
    });
    bindings.push(binding);
  }
  if (
    new Set(bindings.map((b) => `${b.profileRevisionId}:${b.workspaceId}:${b.role}`)).size !==
    bindings.length
  )
    throw new ThreadHelmError('INVALID_REQUEST');
  return MissionEnvelopeView.parse({
    objective: input.objective,
    completionEvidence: input.completionEvidence,
    exclusions: input.exclusions,
    workspaces: input.workspaces,
    bindings,
    bounds: input.bounds,
    permittedRoutineActions: input.permittedRoutineActions,
    knownSafeRetryClasses: input.knownSafeRetryClasses,
    escalationRules: input.escalationRules,
  });
}

/** Read-only revalidation. Held workers can be disclosed, but never started. */
export async function revalidateMissionBinding(
  ctx: Context,
  binding: MissionBindingView,
): Promise<void> {
  assertMissionProfile(ctx, binding);
  const workspace = ctx.storage?.repositories.workspaces.findById(binding.workspaceId);
  if (!workspace || workspace.revokedAt) throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
  const resolved = revalidateWorkspace(ctx, workspace);
  if (
    !equal(resolved.identity, binding.identity) ||
    resolved.canonicalPath !== binding.canonicalPath ||
    resolved.displayPath !== binding.displayPath
  )
    throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
  if (binding.sessionId) {
    const live = ctx.live.get(binding.sessionId);
    if (
      live?.state !== 'running' ||
      !live.launchSnapshot ||
      !sameMissionLaunchSnapshot(live.launchSnapshot, missionPreviewPayload(binding))
    )
      throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
  }
  const { view } = await probeProvider(ctx, binding.providerId, [binding.canonicalPath]);
  if (
    view.resolvedExecutable !== binding.readiness.resolvedExecutable ||
    view.version !== binding.readiness.version ||
    view.authentication !== binding.readiness.authentication ||
    view.availability !== binding.readiness.availability
  )
    throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
  const adapter = ctx.adapters.find((a) => a.id === binding.providerId);
  const observedAt = ctx.clock().toISOString();
  const permission = resolveLaunchPermission({
    providerId: binding.providerId,
    providerVersion: view.version!,
    model: binding.runtimeSelection.model,
    invocation: 'supervisor',
    oneRunSelection: binding.permissionSelection,
    taskPolicy: null,
    projectPolicy: null,
    providerDefault: 'manual',
    capabilityEvidence:
      adapter?.permissionCapabilityEvidence?.({
        providerVersion: view.version!,
        model: binding.runtimeSelection.model,
        observedAt,
      }) ?? null,
    breakGlassProof: null,
    now: observedAt,
  });
  if (!samePermissionCapability(permission, binding.permissionResolution))
    throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
  assertMissionProfile(ctx, binding);
}
