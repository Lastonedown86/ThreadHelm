/** Bounded autonomous supervisor. The model proposes; this main-owned service decides. */
import { createHash, randomUUID } from 'node:crypto';
import {
  BOUNDARY_WARNING,
  MissionEnvelopeInput,
  MissionPreviewView,
  SupervisorAssignInput,
  SupervisorCompleteInput,
  SupervisorDecomposeInput,
  SupervisorEscalateInput,
  SupervisorInspectInput,
  SupervisorPauseInput,
  SupervisorResultInput,
  ProviderProgressEvent,
  ThreadHelmError,
  type MissionBindingView,
  type MissionDetailView,
  type OperationRequest,
  type SupervisorAttemptView,
  type SupervisorDecisionView,
  type SupervisorEvidenceRef,
  type SupervisorResultDisposition,
  type HostToMainMessage,
  type ProviderLifecycleEvidence,
} from '@threadhelm/contracts';
import {
  sessionRoleCapability,
  SUPERVISOR_ROLE_TOOLS,
  type ProfileLaunchBinding,
  type SessionRoleCapability,
} from '@threadhelm/providers';
import {
  assessMissionBounds,
  assertExactWorkerBinding,
  assertRoutineWorkAuthority,
  authorizeSupervisor,
  hasDecisionLoop,
  normalizeSupervisorDecision,
} from '@threadhelm/domain';
import type { DecisionInsert, SupervisorRepository } from '@threadhelm/persistence';
import type { Context, PreviewPayload } from '../context.js';
import { launchSession, type MissionLaunchAuthorization } from '../sessions/launch.js';
import { failSession } from '../sessions/failure.js';
import { revalidateWorkspace } from '../workspaces/identity.js';
import { TokenStore } from '../tokens.js';
import { MissionDisclosures } from './disclosures.js';
import {
  assertMissionProfile,
  eligibleMissionSessions,
  missionPreviewPayload,
  revalidateMissionBinding,
  resolveMissionEnvelope,
  sameMissionLaunchSnapshot,
} from './mission-bindings.js';

export const SUPERVISOR_TOOL_NAMES = SUPERVISOR_ROLE_TOOLS;
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
};
const digest = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex');
const terminal = new Set(['completed', 'cancelled', 'deleted']);
const activeAttempt = new Set(['reserved', 'assigned', 'running']);
const codeOf = (error: unknown) => (error instanceof ThreadHelmError ? error.code : 'INTERNAL');

export interface SupervisorBridgeAuthority {
  registryForSession(sessionId: string): readonly string[];
  missionForSession(sessionId: string): string | null;
  dispatchForSession(
    sessionId: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown>;
  invalidStructuredOutput(sessionId: string): void;
  onSafePoint(sessionId: string): void;
  onProviderLifecycle(evidence: ProviderLifecycleEvidence): void;
  roleCapabilityForSession(sessionId: string): SessionRoleCapability | null;
}
export class SupervisorService implements SupervisorBridgeAuthority {
  readonly #ctx: Context;
  readonly #disclosures: MissionDisclosures;
  readonly #deletions: TokenStore<{ missionId: string; version: number; state: string }>;
  readonly #lastEmitted = new Map<string, number>();
  readonly #ending = new Set<string>();
  readonly #hostOutput = new Map<
    string,
    Extract<HostToMainMessage, { type: 'host.outputProgress' }>
  >();
  readonly #outputWaiters = new Map<string, () => void>();
  readonly #missionWaiters = new Map<string, () => void>();
  #timer: ReturnType<typeof setTimeout> | null = null;
  #stopped = false;
  constructor(ctx: Context) {
    this.#ctx = ctx;
    this.#disclosures = new MissionDisclosures(ctx.clock);
    this.#deletions = new TokenStore(undefined, () => ctx.clock().getTime());
  }
  #repo(): SupervisorRepository {
    if (!this.#ctx.storage || this.#ctx.health.degraded)
      throw new ThreadHelmError('STORAGE_UNAVAILABLE');
    return this.#ctx.storage.repositories.supervisor;
  }
  #at() {
    return this.#ctx.clock().toISOString();
  }
  #write<T>(fn: () => T): T {
    return this.#ctx.health.required(() => this.#ctx.storage!.repositories.transaction(fn));
  }
  eligibleSessions() {
    this.#repo();
    return eligibleMissionSessions(this.#ctx);
  }
  list(request: OperationRequest<'missions.list'>) {
    return this.#repo().list(request?.limit);
  }
  detail(missionId: string) {
    return this.#repo().detail(missionId);
  }
  workItem(request: OperationRequest<'missions.workItem'>) {
    const repo = this.#repo();
    return {
      workItem: repo.workItem(request.missionId, request.workItemId),
      attempts: repo.attempts(request.missionId).filter((a) => a.workItemId === request.workItemId),
      decisions: repo
        .decisions(request.missionId)
        .filter((d) => d.workItemId === request.workItemId),
    };
  }
  async preview(
    request: OperationRequest<'missions.preview'> | OperationRequest<'missions.previewRevision'>,
  ): Promise<MissionPreviewView> {
    const repo = this.#repo();
    const revision = 'missionId' in request;
    const mission = revision ? repo.mission(request.missionId) : null;
    if (
      mission &&
      'expectedVersion' in request &&
      (mission.version !== request.expectedVersion ||
        !['paused', 'recovery_required'].includes(mission.state))
    )
      throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
    const input = MissionEnvelopeInput.parse(request.envelope);
    const envelope = await resolveMissionEnvelope(
      this.#ctx,
      input,
      mission ? repo.envelope(mission.id) : null,
    );
    const snapshot = {
      missionId: mission?.id ?? randomUUID(),
      expectedVersion: mission?.version ?? null,
      input,
      envelope,
    };
    const issued = this.#disclosures.issue(snapshot);
    return MissionPreviewView.parse({
      previewToken: issued.token,
      missionId: snapshot.missionId,
      version: (snapshot.expectedVersion ?? 0) + 1,
      envelope,
      boundaryWarning: `${BOUNDARY_WARNING} Supervisor output is untrusted. This confirmation pins exact launch settings; consequential actions and unknown outcomes require user action.`,
      expiresAt: issued.expiresAt,
    });
  }
  async confirm(
    request: OperationRequest<'missions.confirm'>,
    revision = false,
  ): Promise<MissionDetailView> {
    const repo = this.#repo();
    const snapshot = this.#disclosures.take(request.previewToken, revision);
    if (!request.boundaryConfirmation) throw new ThreadHelmError('CONFIRMATION_REQUIRED');
    for (const binding of snapshot.envelope.bindings)
      await revalidateMissionBinding(this.#ctx, binding);
    if (
      snapshot.envelope.bindings.find((b) => b.role === 'supervisor')!.launchDisposition !== 'ready'
    )
      throw new ThreadHelmError('SUPERVISOR_NOT_BOUND');
    // Recheck mutable main state after the final asynchronous probe, before committing authority.
    for (const binding of snapshot.envelope.bindings) this.#assertSynchronousBinding(binding);
    const result = this.#write(() =>
      snapshot.expectedVersion === null
        ? repo.createMission({
            id: snapshot.missionId,
            input: snapshot.input,
            envelope: snapshot.envelope,
            at: this.#at(),
          })
        : repo.reviseMission({
            id: snapshot.missionId,
            expectedVersion: snapshot.expectedVersion,
            input: snapshot.input,
            envelope: snapshot.envelope,
            at: this.#at(),
          }),
    );
    this.#emit(result.id);
    this.#schedule();
    return result;
  }
  pause(missionId: string): MissionDetailView {
    const result = this.#write(() =>
      this.#repo().setState(missionId, 'paused', 'USER_PAUSED', this.#at()),
    );
    this.#emit(missionId);
    this.#schedule();
    return result;
  }
  async resume(request: OperationRequest<'missions.resume'>): Promise<MissionDetailView> {
    const repo = this.#repo();
    const mission = repo.mission(request.missionId);
    const envelope = repo.envelope(mission.id);
    if (!envelope || !['paused', 'recovery_required'].includes(mission.state))
      throw new ThreadHelmError('INVALID_STATE');
    if (repo.leases(mission.id).some((l) => l.state === 'unknown'))
      throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
    const original = envelope.bindings.find((b) => b.role === 'supervisor')!;
    const live = this.#ctx.live.get(request.supervisorSessionId);
    if (
      live?.state !== 'running' ||
      !live.launchSnapshot ||
      live.workspaceId !== original.workspaceId ||
      digest(live.launchSnapshot.runtimeSelection) !== digest(original.runtimeSelection) ||
      digest(live.launchSnapshot.permissionResolution) !== digest(original.permissionResolution) ||
      digest(live.launchSnapshot.executionBounds) !== digest(original.executionBounds) ||
      live.providerId !== original.providerId
    )
      throw new ThreadHelmError('SUPERVISOR_NOT_BOUND');
    const binding = { ...original, sessionId: request.supervisorSessionId, ...live.launchSnapshot };
    await revalidateMissionBinding(this.#ctx, binding);
    const result = this.#write(() => {
      const current = repo.mission(mission.id);
      if (
        current.version !== mission.version ||
        current.state !== mission.state ||
        current.supervisor_session_id !== mission.supervisor_session_id
      )
        throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
      if (repo.leases(mission.id).some((lease) => lease.state === 'unknown'))
        throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
      this.#assertSynchronousBinding(binding);
      if (this.#boundReason(mission.id))
        throw new ThreadHelmError(
          'MISSION_BOUND_REACHED',
          'Revise the envelope to authorize new limits.',
        );
      repo.bindSession(
        mission.id,
        original.bindingId,
        request.supervisorSessionId,
        'supervisor',
        this.#at(),
      );
      return repo.setState(
        mission.id,
        'running',
        'USER_RESUMED',
        this.#at(),
        request.supervisorSessionId,
      );
    });
    this.#emit(mission.id);
    this.#schedule();
    return result;
  }
  cancel(missionId: string): MissionDetailView {
    const repo = this.#repo();
    this.#write(() => repo.setState(missionId, 'paused', 'CANCELLATION_REQUESTED', this.#at()));
    for (const attempt of repo.attempts(missionId))
      if (activeAttempt.has(attempt.state))
        this.#endAttempt(attempt, 'cancelled', 'USER_CANCELLED');
    const result = this.#write(() =>
      repo.setState(missionId, 'cancelled', 'USER_CANCELLED', this.#at()),
    );
    this.#emit(missionId);
    this.#schedule();
    return result;
  }
  resolveEscalation(request: OperationRequest<'missions.resolveEscalation'>): MissionDetailView {
    const repo = this.#repo();
    const mission = repo.mission(request.missionId);
    if (
      terminal.has(mission.state) &&
      !(mission.state === 'cancelled' && request.disposition === 'acknowledge_unknown')
    )
      throw new ThreadHelmError('INVALID_STATE');
    if (request.disposition === 'acknowledge_unknown') {
      if (!request.workItemId) throw new ThreadHelmError('WORK_ITEM_NOT_FOUND');
      const attempts = repo
        .attempts(mission.id)
        .filter(
          (a) =>
            a.id === request.expectedAttemptId &&
            a.leaseId === request.expectedLeaseId &&
            a.workItemId === request.workItemId &&
            a.state === 'unknown' &&
            repo
              .leases(mission.id)
              .some((lease) => lease.id === a.leaseId && lease.state === 'unknown'),
        );
      if (!attempts.length) throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
      for (const attempt of attempts) {
        const sessionId =
          attempt.sessionId ??
          repo.leases(mission.id).find((lease) => lease.id === attempt.leaseId)!.plannedSessionId;
        if (this.#ctx.live.has(sessionId))
          throw new ThreadHelmError(
            'WORK_ATTEMPT_UNKNOWN',
            'Stop the exact worker before disposing of its unknown outcome.',
          );
        try {
          const scope = this.#ctx.native.inspectSessionScope(sessionId);
          if (scope.truncated || scope.activeProcessCount !== 0 || scope.processIds.length)
            throw new Error('SCOPE_NOT_EMPTY');
        } catch {
          throw new ThreadHelmError(
            'WORK_ATTEMPT_UNKNOWN',
            'The exact native worker scope is not proved empty.',
          );
        }
        this.#write(() => repo.acknowledgeUnknown(attempt.id, this.#at()));
      }
    } else if (request.disposition === 'cancel_work') {
      if (!request.workItemId) throw new ThreadHelmError('WORK_ITEM_NOT_FOUND');
      for (const attempt of repo
        .attempts(mission.id)
        .filter((a) => a.workItemId === request.workItemId && activeAttempt.has(a.state)))
        this.#endAttempt(attempt, 'cancelled', 'USER_CANCELLED');
      this.#write(() => repo.cancelWork(mission.id, request.workItemId!, this.#at()));
    }
    const result = terminal.has(mission.state)
      ? repo.detail(mission.id)
      : this.#write(() =>
          repo.setState(mission.id, 'paused', 'USER_ESCALATION_DISPOSITION', this.#at()),
        );
    this.#emit(mission.id);
    return result;
  }
  previewDelete(missionId: string) {
    const repo = this.#repo();
    const m = repo.mission(missionId);
    if (
      !['completed', 'cancelled'].includes(m.state) ||
      repo.leases(missionId).some((l) => ['reserved', 'active', 'unknown'].includes(l.state))
    )
      throw new ThreadHelmError('INVALID_STATE');
    const issued = this.#deletions.issue({ missionId, version: m.version, state: m.state });
    return { previewToken: issued.token, missionId, expiresAt: issued.expiresAt };
  }
  confirmDelete(token: string) {
    const snapshot = this.#deletions.take(token);
    if (!snapshot) throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
    const repo = this.#repo();
    const m = repo.mission(snapshot.missionId);
    if (m.version !== snapshot.version || m.state !== snapshot.state)
      throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
    const result = this.#write(() => {
      const storage = this.#ctx.storage!;
      const conversations = new Set<string>();
      for (const attempt of repo.attempts(m.id))
        for (const id of [attempt.handoffId, attempt.resultHandoffId]) {
          if (!id) continue;
          const handoff = storage.repositories.coordination.findHandoffById(id);
          if (handoff) conversations.add(handoff.conversationId);
        }
      for (const id of conversations) {
        storage.repositories.coordination.updateConversationState(
          id,
          'closed',
          'MISSION_CONTENT_DELETED',
          this.#at(),
        );
        storage.repositories.coordination.deleteConversationContent(id, this.#at());
      }
      const entries = storage.db
        .prepare("SELECT id FROM shared_memory_entries WHERE mission_id=? AND status<>'deleted'")
        .all(m.id) as { id: string }[];
      for (const entry of entries)
        storage.repositories.memory.deleteContent({ entryId: entry.id, deletedAt: this.#at() });
      return repo.deleteContent(m.id, this.#at());
    });
    this.#emit(m.id);
    return result;
  }
  missionForSession(sessionId: string) {
    const role = this.#repo().roleForSession(sessionId);
    return role?.missionId ?? null;
  }
  roleCapabilityForSession(sessionId: string): SessionRoleCapability | null {
    const role = this.#repo().roleForSession(sessionId);
    if (!role || !this.registryForSession(sessionId).length) return null;
    return sessionRoleCapability(role.missionId, role.role as SessionRoleCapability['role']);
  }
  profileLaunchBinding(auth: MissionLaunchAuthorization): ProfileLaunchBinding {
    const repo = this.#repo();
    const attempt = repo.attempts(auth.missionId).find((item) => item.leaseId === auth.leaseId)!;
    const binding = repo
      .envelope(auth.missionId)!
      .bindings.find((item) => item.bindingId === repo.attemptMetadata(attempt.id).bindingId)!;
    const profile = this.#ctx.storage!.repositories.agentProfiles.getDetailByRevision(
      binding.profileRevisionId,
    )!;
    return {
      profileId: binding.profileId,
      profileRevisionId: binding.profileRevisionId,
      workspaceId: binding.workspaceId,
      requestedIsolation: binding.requestedIsolation,
      effectiveIsolation: binding.effectiveIsolation,
      requestedTokenCap: profile.tokenCapRequested,
      effectiveTokenBudget: binding.effectiveTokenBudget,
      effectiveResourceBudget: {
        maxElapsedMs: binding.executionBounds.maxElapsedMs,
        maxConcurrentProcesses: binding.executionBounds.maxConcurrentProcesses,
      },
      toolRegistry: sessionRoleCapability(auth.missionId, binding.role).tools,
    };
  }
  registryForSession(sessionId: string): readonly string[] {
    if (!this.#ctx.storage || this.#ctx.health.degraded) return [];
    const role = this.#repo().roleForSession(sessionId);
    if (!role) return [];
    const mission = this.#repo().mission(role.missionId);
    if (
      role.role === 'supervisor' &&
      (mission.state !== 'running' || mission.supervisor_session_id !== sessionId)
    )
      return [];
    return role.role === 'supervisor' ? SUPERVISOR_TOOL_NAMES : ['threadhelm_work_result'];
  }
  #authority(sessionId: string, missionId: string) {
    const repo = this.#repo();
    const role = repo.roleForSession(sessionId);
    if (role?.role !== 'supervisor') throw new ThreadHelmError('SUPERVISOR_ROLE_REQUIRED');
    const mission = repo.mission(role.missionId);
    authorizeSupervisor(
      {
        missionId: role.missionId,
        sessionId: mission.supervisor_session_id,
        role: role.role,
        state: mission.state,
      },
      missionId,
      sessionId,
    );
    if (this.#ctx.live.get(sessionId)?.state !== 'running')
      throw new ThreadHelmError('SUPERVISOR_NOT_BOUND');
    const binding = repo.envelope(missionId)!.bindings.find((b) => b.bindingId === role.bindingId)!;
    this.#assertSynchronousBinding({ ...binding, sessionId });
    return mission;
  }
  #assertSynchronousBinding(binding: MissionBindingView) {
    assertMissionProfile(this.#ctx, binding);
    const workspace = this.#ctx.storage!.repositories.workspaces.findById(binding.workspaceId);
    if (!workspace || workspace.revokedAt) throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
    const current = revalidateWorkspace(this.#ctx, workspace);
    if (
      digest(current.identity) !== digest(binding.identity) ||
      current.canonicalPath !== binding.canonicalPath
    )
      throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
    if (binding.sessionId) {
      const live = this.#ctx.live.get(binding.sessionId);
      if (
        live?.state !== 'running' ||
        !live.launchSnapshot ||
        !sameMissionLaunchSnapshot(live.launchSnapshot, missionPreviewPayload(binding))
      )
        throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
    }
  }
  #decision(
    sessionId: string,
    kind: SupervisorDecisionView['kind'],
    request: {
      missionId: string;
      idempotencyKey: string;
      rationale: string;
      inputRefs: SupervisorEvidenceRef[];
      expectedEvidence: string;
    },
    payload: unknown,
  ): DecisionInsert {
    this.#authority(sessionId, request.missionId);
    return {
      ...request,
      supervisorSessionId: sessionId,
      fingerprint: digest(normalizeSupervisorDecision(kind, payload)),
      requestDigest: digest([kind, payload]),
      at: this.#at(),
    };
  }
  #checkDecisionBounds(input: DecisionInsert, kind: SupervisorDecisionView['kind']) {
    const repo = this.#repo();
    const reason = this.#boundReason(input.missionId);
    if (reason) throw new ThreadHelmError('MISSION_BOUND_REACHED');
    if (hasDecisionLoop(input.fingerprint, repo.fingerprints(input.missionId)))
      throw new ThreadHelmError('SUPERVISOR_DECISION_LOOP');
    const action = kind === 'reassign' ? 'reassign' : kind;
    if (
      action !== 'escalate' &&
      !repo.envelope(input.missionId)!.permittedRoutineActions.includes(action)
    )
      throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
  }
  async dispatchForSession(
    sessionId: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    if (method === 'threadhelm_work_result')
      return this.resultForSession(sessionId, SupervisorResultInput.parse(params));
    if (!SUPERVISOR_TOOL_NAMES.includes(method as (typeof SUPERVISOR_TOOL_NAMES)[number]))
      throw new ThreadHelmError('INVALID_REQUEST');
    if (this.#repo().roleForSession(sessionId)?.role !== 'supervisor')
      throw new ThreadHelmError('SUPERVISOR_ROLE_REQUIRED');
    const schema =
      method === 'threadhelm_mission_inspect'
        ? SupervisorInspectInput
        : method === 'threadhelm_work_decompose'
          ? SupervisorDecomposeInput
          : method === 'threadhelm_work_assign' || method === 'threadhelm_work_reassign'
            ? SupervisorAssignInput
            : method === 'threadhelm_work_pause'
              ? SupervisorPauseInput
              : method === 'threadhelm_mission_complete'
                ? SupervisorCompleteInput
                : SupervisorEscalateInput;
    const parsed = schema.safeParse(params);
    if (!parsed.success) {
      this.invalidStructuredOutput(sessionId);
      throw new ThreadHelmError('INVALID_REQUEST', 'Invalid structured supervisor output.');
    }
    const request = parsed.data;
    this.#authority(sessionId, request.missionId);
    if (method === 'threadhelm_mission_inspect')
      return this.#inspect(sessionId, SupervisorInspectInput.parse(request));
    const kind: SupervisorDecisionView['kind'] =
      method === 'threadhelm_work_decompose'
        ? 'decompose'
        : method === 'threadhelm_work_assign'
          ? 'assign'
          : method === 'threadhelm_work_reassign'
            ? 'reassign'
            : method === 'threadhelm_work_pause'
              ? 'pause'
              : method === 'threadhelm_mission_complete'
                ? 'complete'
                : 'escalate';
    const input = this.#decision(
      sessionId,
      kind,
      request as Pick<
        DecisionInsert,
        'missionId' | 'idempotencyKey' | 'rationale' | 'inputRefs' | 'expectedEvidence'
      >,
      request,
    );
    const repo = this.#repo();
    const prior = repo.decisionForKey(input.missionId, input.idempotencyKey, input.requestDigest);
    if (prior) return { decision: prior, duplicate: true };
    try {
      this.#checkDecisionBounds(input, kind);
      if (kind === 'decompose') {
        const value = SupervisorDecomposeInput.parse(request);
        this.#validateReferences(input.missionId, value.inputRefs);
        const decision = this.#write(() => repo.decompose({ ...input, items: value.items }));
        this.#emit(input.missionId);
        this.#schedule();
        return { decision };
      }
      if (kind === 'assign' || kind === 'reassign')
        return await this.#assign(input, kind, SupervisorAssignInput.parse(request));
      const result = this.#write(() => {
        const workItemId =
          'workItemId' in request && typeof request.workItemId === 'string'
            ? request.workItemId
            : null;
        if (workItemId) repo.workItem(input.missionId, workItemId);
        if (kind === 'complete') {
          const complete = SupervisorCompleteInput.parse(request);
          this.#validateReferences(input.missionId, complete.evidenceRefs);
          if (
            !repo.workItems(input.missionId).length ||
            repo.workItems(input.missionId).some((w) => w.state !== 'completed') ||
            repo
              .leases(input.missionId)
              .some((l) => ['reserved', 'active', 'unknown'].includes(l.state))
          )
            throw new ThreadHelmError(
              'INVALID_STATE',
              'Complete every work item with evidence before completing the mission.',
            );
        }
        const decision = repo.recordDecision({
          ...input,
          kind,
          workItemId,
          policyResult: kind === 'escalate' ? 'held' : 'accepted',
          reasonCode: kind === 'escalate' ? 'MISSION_AUTHORITY_REQUIRED' : null,
        });
        if (kind === 'complete')
          repo.setState(input.missionId, 'completed', 'MISSION_COMPLETED', this.#at());
        else if (workItemId)
          repo.pauseWork(
            input.missionId,
            workItemId,
            kind === 'escalate' ? 'MISSION_AUTHORITY_REQUIRED' : 'SUPERVISOR_PAUSED',
            this.#at(),
          );
        else
          repo.setState(
            input.missionId,
            'paused',
            kind === 'escalate' ? 'MISSION_AUTHORITY_REQUIRED' : 'SUPERVISOR_PAUSED',
            this.#at(),
          );
        return { decision };
      });
      this.#emit(input.missionId);
      this.#schedule();
      return result;
    } catch (error) {
      const existing = repo.decisionForKey(
        input.missionId,
        input.idempotencyKey,
        input.requestDigest,
      );
      if (!existing) {
        const workId =
          'workItemId' in request && typeof request.workItemId === 'string'
            ? request.workItemId
            : null;
        this.#write(() => {
          const knownWork =
            workId && repo.workItems(input.missionId).some((w) => w.id === workId) ? workId : null;
          repo.recordDecision({
            ...input,
            kind,
            workItemId: knownWork,
            policyResult: 'held',
            reasonCode: codeOf(error),
          });
          if (
            knownWork &&
            !['completed', 'cancelled'].includes(repo.workItem(input.missionId, knownWork).state)
          )
            repo.pauseWork(input.missionId, knownWork, codeOf(error), this.#at());
          else if (!terminal.has(repo.mission(input.missionId).state))
            repo.setState(input.missionId, 'paused', codeOf(error), this.#at());
        });
      }
      this.#emit(input.missionId);
      this.#schedule();
      throw error;
    }
  }
  async #assign(
    input: DecisionInsert,
    kind: 'assign' | 'reassign',
    request: { workItemId: string; bindingId: string },
  ) {
    const repo = this.#repo();
    const envelope = repo.envelope(input.missionId)!;
    const version = repo.mission(input.missionId).version;
    const binding = envelope.bindings.find(
      (b) => b.bindingId === request.bindingId && b.role !== 'supervisor',
    );
    if (!binding) throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
    this.#validateReferences(input.missionId, input.inputRefs);
    if (kind === 'reassign' && !envelope.permittedRoutineActions.includes('retry'))
      throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
    if (binding.launchDisposition !== 'ready')
      throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
    let sessionId =
      binding.sessionId && this.#ctx.live.get(binding.sessionId)?.state === 'running'
        ? binding.sessionId
        : null;
    if (!sessionId) {
      sessionId =
        [...this.#ctx.live.keys()].find((id) => {
          const role = repo.roleForSession(id);
          return (
            this.#ctx.live.get(id)?.state === 'running' &&
            role?.missionId === input.missionId &&
            role.bindingId === binding.bindingId
          );
        }) ?? null;
    }
    const startedNew = sessionId === null;
    if (!sessionId) {
      assertExactWorkerBinding(binding, binding, this.#ctx.clock().getTime());
      if (!this.#ctx.coordinationBridge)
        throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
    }
    await revalidateMissionBinding(this.#ctx, { ...binding, sessionId });
    this.#authority(input.supervisorSessionId, input.missionId);
    this.#checkDecisionBounds(input, kind);
    if (repo.mission(input.missionId).version !== version)
      throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
    if (sessionId) {
      const live = this.#ctx.live.get(sessionId);
      if (
        !live?.launchSnapshot ||
        !sameMissionLaunchSnapshot(live.launchSnapshot, missionPreviewPayload(binding))
      )
        throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
    }
    if (
      repo.tokenCommitment(input.missionId) + binding.effectiveTokenBudget >
      envelope.bounds.maxTokenBudget
    )
      throw new ThreadHelmError('MISSION_BOUND_REACHED');
    const plannedSessionId = sessionId ?? randomUUID();
    const attempt = this.#write(() =>
      repo.reserveAssignment({
        ...input,
        kind,
        workItemId: request.workItemId,
        binding,
        plannedSessionId,
      }),
    );
    this.#emit(input.missionId);
    try {
      if (!sessionId) {
        const issued = this.#ctx.tokens.previews.issue(missionPreviewPayload(binding));
        const session = await launchSession(this.#ctx, issued.token, true, {
          missionId: input.missionId,
          leaseId: attempt.leaseId,
          sessionId: plannedSessionId,
        });
        sessionId = session.id;
      }
      this.#authority(input.supervisorSessionId, input.missionId);
      if (
        repo.mission(input.missionId).version !== version ||
        repo.attempt(attempt.id).state !== 'reserved'
      )
        throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
      this.#assertSynchronousBinding({ ...binding, sessionId });
      if (!this.#ctx.coordinationBridge?.hasValidCredential(sessionId))
        throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
      // Active workers already have a host. Bind its exact reserved session
      // before the host acknowledges the output budget, just as autostart does
      // before launching. Telemetry must never precede its durable identity.
      this.#write(() => repo.attachReservedSession(attempt.leaseId, sessionId!, this.#at()));
      await this.#configureOutputBudget(
        attempt.id,
        sessionId,
        binding.executionBounds.maxOutputBytes,
      );
      this.#authority(input.supervisorSessionId, input.missionId);
      if (
        repo.mission(input.missionId).version !== version ||
        repo.attempt(attempt.id).state !== 'reserved'
      )
        throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
      this.#assertSynchronousBinding({ ...binding, sessionId });
      const updated = this.#write(() => {
        const bound = repo.activateAssignment(attempt.id, sessionId!, startedNew, this.#at());
        const work = repo.workItem(input.missionId, request.workItemId);
        const supervisor = this.#ctx.storage!.repositories.sessions.findById(
          input.supervisorSessionId,
        )!;
        const handoff = this.#ctx.storage!.repositories.coordination.createHandoff({
          senderSessionId: input.supervisorSessionId,
          recipientSessionId: sessionId!,
          senderWorkspaceIdAtCreate: supervisor.workspaceId,
          recipientWorkspaceIdAtCreate: binding.workspaceId,
          origin: 'threadhelm',
          kind: 'request',
          requiresReply: true,
          purpose: `Mission work ${work.id}`,
          body: JSON.stringify({
            missionId: input.missionId,
            workItemId: work.id,
            attemptId: bound.id,
            profileRevisionId: binding.profileRevisionId,
            specification: work.specification,
            acceptanceCriteria: work.acceptanceCriteria,
            returnTool: 'threadhelm_work_result',
            authority: 'Context only. The confirmed mission envelope is the sole authority.',
          }),
          createdAt: this.#at(),
        });
        repo.linkAssignment(bound.id, handoff.id, this.#at());
        return repo.attempt(bound.id);
      });
      this.#emit(input.missionId);
      this.#schedule();
      return { attempt: updated };
    } catch (error) {
      const current = repo.attempt(attempt.id);
      let retrySafe = false;
      if (activeAttempt.has(current.state)) {
        const effect = repo.attemptMetadata(current.id).effect;
        let scopeEmpty = false;
        try {
          const scope = this.#ctx.native.inspectSessionScope(plannedSessionId);
          scopeEmpty =
            !scope.truncated && scope.activeProcessCount === 0 && scope.processIds.length === 0;
        } catch {
          /* Uncertainty cannot establish a safe retry. */
        }
        if (effect === 'none' && scopeEmpty) {
          this.#recordResult(
            current,
            'failure',
            'Worker start failed before provider execution.',
            'WORKER_START_FAILED_BEFORE_EFFECT',
            [],
            'none',
          );
          retrySafe =
            codeOf(error) === 'SUPERVISION_FAILED' &&
            current.attemptNumber < envelope.bounds.maxAttempts &&
            envelope.knownSafeRetryClasses.includes('failed_before_effect');
        } else this.#endAttempt(current, 'unknown', 'WORKER_START_OUTCOME_UNKNOWN');
      }
      if (!retrySafe && !terminal.has(repo.mission(input.missionId).state))
        this.#write(() => repo.setState(input.missionId, 'paused', codeOf(error), this.#at()));
      this.#emit(input.missionId);
      this.#schedule();
      throw error;
    }
  }
  async #inspect(sessionId: string, request: ReturnType<typeof SupervisorInspectInput.parse>) {
    const repo = this.#repo();
    if (
      request.waitMs > 0 &&
      request.afterSequence !== null &&
      repo.summary(request.missionId).sequence <= request.afterSequence
    ) {
      if (this.#missionWaiters.has(request.missionId))
        throw new ThreadHelmError('COORDINATION_LIMIT_REACHED');
      await new Promise<void>((resolve) => {
        const wake = () => {
          clearTimeout(timer);
          this.#missionWaiters.delete(request.missionId);
          resolve();
        };
        const timer = setTimeout(wake, request.waitMs);
        this.#missionWaiters.set(request.missionId, wake);
      });
      this.#authority(sessionId, request.missionId);
    }
    const envelope = repo.envelope(request.missionId)!;
    if (request.view === 'mission') {
      const policy = Object.fromEntries(
        Object.entries(envelope).filter(([key]) => key !== 'bindings'),
      );
      return {
        mission: repo.summary(request.missionId),
        policy,
        views: ['bindings', 'work_items', 'decisions', 'attempts'],
      };
    }
    const source: unknown[] =
      request.view === 'work_items'
        ? repo.workItems(request.missionId)
        : request.view === 'decisions'
          ? repo.decisions(request.missionId)
          : request.view === 'attempts'
            ? repo.attempts(request.missionId)
            : envelope.bindings.map((binding) => ({
                bindingId: binding.bindingId,
                role: binding.role,
                profileId: binding.profileId,
                profileRevisionId: binding.profileRevisionId,
                workspaceId: binding.workspaceId,
                sessionId: binding.sessionId,
                autoStart: binding.autoStart,
                providerId: binding.providerId,
                mode: binding.mode,
                runtimeSelection: binding.runtimeSelection,
                permissionResolution: binding.permissionResolution,
                executionBounds: binding.executionBounds,
                effectiveTokenBudget: binding.effectiveTokenBudget,
                launchDisposition: binding.launchDisposition,
                reasonCode: binding.reasonCode,
              }));
    const items: unknown[] = [];
    let index = request.cursor;
    for (; index < source.length && items.length < request.limit; index++) {
      if (Buffer.byteLength(JSON.stringify([...items, source[index]])) > 26_000) break;
      items.push(source[index]);
    }
    if (!items.length && index < source.length)
      throw new ThreadHelmError('COORDINATION_LIMIT_REACHED');
    return {
      missionId: request.missionId,
      view: request.view,
      items,
      nextCursor: index < source.length ? index : null,
    };
  }
  /** The launcher consults the committed reservation again after every async preflight. */
  assertLaunchAuthorized(auth: MissionLaunchAuthorization, preview: PreviewPayload): void {
    const repo = this.#repo();
    const mission = repo.mission(auth.missionId);
    const lease = repo.leases(auth.missionId).find((l) => l.id === auth.leaseId);
    if (
      mission.state !== 'running' ||
      !lease ||
      lease.state !== 'reserved' ||
      lease.plannedSessionId !== auth.sessionId ||
      Date.parse(lease.expiresAt) <= this.#ctx.clock().getTime()
    )
      throw new ThreadHelmError('WORKER_AUTOSTART_NOT_AUTHORIZED');
    const attempt = repo.attempts(auth.missionId).find((a) => a.leaseId === lease.id)!;
    assertRoutineWorkAuthority(repo.workItems(auth.missionId), attempt.workItemId);
    if (repo.workItem(auth.missionId, attempt.workItemId).state !== 'assigned')
      throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
    const binding = repo
      .envelope(auth.missionId)!
      .bindings.find((b) => b.bindingId === repo.attemptMetadata(attempt.id).bindingId)!;
    assertExactWorkerBinding(binding, binding, this.#ctx.clock().getTime());
    this.#assertSynchronousBinding({ ...binding, sessionId: null });
    if (
      digest(preview) !== digest(missionPreviewPayload(binding)) ||
      this.#boundReason(auth.missionId)
    )
      throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
  }
  bindStartingSession(auth: MissionLaunchAuthorization): void {
    this.#repo().attachReservedSession(auth.leaseId, auth.sessionId, this.#at());
  }
  outputLaunchBudget(auth: MissionLaunchAuthorization) {
    const repo = this.#repo();
    const attempt = repo.attempts(auth.missionId).find((a) => a.leaseId === auth.leaseId)!;
    const binding = repo
      .envelope(auth.missionId)!
      .bindings.find((b) => b.bindingId === repo.attemptMetadata(attempt.id).bindingId)!;
    return { attemptId: attempt.id, maxOutputBytes: binding.executionBounds.maxOutputBytes };
  }
  async #configureOutputBudget(
    attemptId: string,
    sessionId: string,
    maxOutputBytes: number,
  ): Promise<void> {
    if (this.#hostOutput.get(sessionId)?.attemptId === attemptId) return;
    const live = this.#ctx.live.get(sessionId);
    if (live?.state !== 'running') throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
    const key = `${sessionId}:${attemptId}`;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#outputWaiters.delete(key);
        reject(new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED'));
      }, 3000);
      this.#outputWaiters.set(key, () => {
        clearTimeout(timer);
        this.#outputWaiters.delete(key);
        resolve();
      });
      try {
        live.host.postMessage({
          type: 'host.setOutputBudget',
          sessionId,
          protocolVersion: 1,
          attemptId,
          maxOutputBytes,
        });
      } catch {
        clearTimeout(timer);
        this.#outputWaiters.delete(key);
        reject(new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED'));
      }
    });
  }
  markLaunchDispatched(auth: MissionLaunchAuthorization): void {
    const repo = this.#repo();
    this.#write(() => {
      const attempt = repo.attempts(auth.missionId).find((a) => a.leaseId === auth.leaseId);
      if (!attempt || attempt.state !== 'reserved')
        throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
      repo.markExternalStart(attempt.id, this.#at());
    });
  }
  async resultForSession(sessionId: string, request: SupervisorResultInput) {
    const repo = this.#repo();
    const role = repo.roleForSession(sessionId);
    const attempt = repo.attempt(request.attemptId);
    if (
      !role ||
      role.role === 'supervisor' ||
      role.missionId !== request.missionId ||
      attempt.missionId !== request.missionId ||
      attempt.workItemId !== request.workItemId ||
      attempt.sessionId !== sessionId ||
      repo.attemptMetadata(attempt.id).bindingId !== role.bindingId
    )
      throw new ThreadHelmError('SUPERVISOR_ROLE_REQUIRED');
    this.#validateReferences(request.missionId, request.evidenceRefs);
    const prior = repo.attemptMetadata(attempt.id);
    if (prior.resultKey) {
      if (prior.resultKey === request.idempotencyKey && prior.resultDigest === digest(request))
        return { attempt, duplicate: true };
      throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
    }
    let disposition = request.disposition;
    const boundedStop = [
      'timed_out',
      'cancelled',
      'no_progress',
      'budget_exhausted',
      'permission_blocked',
      'classifier_failed',
    ].includes(disposition);
    if (boundedStop) {
      const live = this.#ctx.live.get(sessionId);
      if (live) {
        this.#ending.add(sessionId);
        try {
          failSession(this.#ctx, live, `WORKER_${disposition.toUpperCase()}`);
        } finally {
          this.#ending.delete(sessionId);
        }
      }
      try {
        const scope = this.#ctx.native.inspectSessionScope(sessionId);
        if (scope.truncated || scope.activeProcessCount || scope.processIds.length)
          disposition = 'unknown';
      } catch {
        disposition = 'unknown';
      }
    }
    const result = this.#recordResult(
      attempt,
      disposition,
      request.explanation,
      disposition === 'completion' ? null : `WORKER_${disposition.toUpperCase()}`,
      request.evidenceRefs,
      'possible',
      request.idempotencyKey,
      digest(request),
    );
    if (
      (boundedStop || ['unknown', 'authority_required', 'proposal'].includes(disposition)) &&
      !terminal.has(repo.mission(request.missionId).state)
    )
      this.#write(() =>
        repo.setState(
          request.missionId,
          'paused',
          disposition === 'unknown'
            ? 'WORK_ATTEMPT_UNKNOWN'
            : boundedStop
              ? `WORKER_${disposition.toUpperCase()}`
              : 'MISSION_AUTHORITY_REQUIRED',
          this.#at(),
        ),
      );
    this.#emit(request.missionId);
    this.#schedule();
    return { attempt: result };
  }
  #recordResult(
    attempt: SupervisorAttemptView,
    disposition: SupervisorResultDisposition,
    explanation: string,
    reasonCode: string | null,
    evidenceRefs: SupervisorEvidenceRef[],
    effect: 'none' | 'possible',
    key = `main-${randomUUID()}`,
    requestDigest = digest([attempt.id, disposition, reasonCode]),
  ): SupervisorAttemptView {
    const repo = this.#repo();
    const committed = this.#write(() => {
      let result = repo.finishAttempt({
        attemptId: attempt.id,
        disposition,
        explanation,
        evidenceRefs,
        reasonCode,
        effect,
        resultKey: key,
        resultDigest: requestDigest,
        at: this.#at(),
      });
      // A pre-provider failure has no worker identity to impersonate. It remains in the
      // bound mission inbox returned by mission_inspect, with a null handoff link.
      if (result.sessionId && result.handoffId && !result.resultHandoffId) {
        const coordination = this.#ctx.storage!.repositories.coordination;
        const assignment = coordination.findHandoffById(result.handoffId);
        if (!assignment) throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
        const handoff = coordination.createHandoff({
          conversationId: assignment.conversationId,
          inReplyToId: assignment.id,
          senderSessionId: result.sessionId,
          recipientSessionId: result.supervisorSessionId,
          senderWorkspaceIdAtCreate: assignment.recipientWorkspaceIdAtCreate,
          recipientWorkspaceIdAtCreate: assignment.senderWorkspaceIdAtCreate,
          origin: 'threadhelm',
          kind:
            disposition === 'completion'
              ? 'completion'
              : disposition === 'refusal'
                ? 'refusal'
                : disposition === 'proposal' || disposition === 'authority_required'
                  ? 'proposal'
                  : 'failure',
          requiresReply: false,
          purpose: `Mission result ${result.workItemId}`,
          body: JSON.stringify({
            missionId: result.missionId,
            workItemId: result.workItemId,
            attemptId: result.id,
            profileRevisionId: result.profileRevisionId,
            disposition,
            explanation,
            evidenceRefs,
          }),
          createdAt: this.#at(),
        });
        result = repo.linkResult(result.id, handoff.id, this.#at());
      }
      return result;
    });
    if (committed.sessionId) {
      const live = this.#ctx.live.get(committed.sessionId);
      try {
        live?.host.postMessage({
          type: 'host.clearOutputBudget',
          sessionId: committed.sessionId,
          protocolVersion: 1,
          attemptId: committed.id,
        });
      } catch {
        /* A failed clear keeps the stricter budget in the host. */
      }
    }
    return committed;
  }
  #validateReferences(missionId: string, refs: SupervisorEvidenceRef[]): void {
    const repo = this.#repo();
    for (const ref of refs) {
      if (ref.kind === 'work_item') repo.workItem(missionId, ref.id);
      if (
        ref.kind === 'handoff' &&
        !repo
          .attempts(missionId)
          .some((a) => a.handoffId === ref.id || a.resultHandoffId === ref.id)
      )
        throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
      if (ref.kind === 'memory_revision') {
        const scope = this.#ctx
          .storage!.db.prepare(
            'SELECT e.mission_id FROM shared_memory_revisions r JOIN shared_memory_entries e ON e.id=r.entry_id WHERE r.id=?',
          )
          .get(ref.id) as { mission_id: string | null } | undefined;
        if (scope?.mission_id !== missionId)
          throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
      }
      if (
        ref.kind === 'artifact' &&
        (!/^[\p{L}\p{N}_. /-]{1,256}$/u.test(ref.id) ||
          ref.id.startsWith('/') ||
          ref.id.split('/').includes('..'))
      )
        throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
    }
  }
  #endAttempt(
    attempt: SupervisorAttemptView,
    disposition: SupervisorResultDisposition,
    reasonCode: string,
  ): void {
    if (!activeAttempt.has(this.#repo().attempt(attempt.id).state)) return;
    const lease = this.#repo()
      .leases(attempt.missionId)
      .find((l) => l.id === attempt.leaseId)!;
    const id = attempt.sessionId ?? lease.plannedSessionId;
    const live = this.#ctx.live.get(id);
    if (live) {
      this.#ending.add(id);
      try {
        failSession(this.#ctx, live, reasonCode);
      } finally {
        this.#ending.delete(id);
      }
    }
    const session = this.#ctx.storage!.repositories.sessions.findById(id);
    let scopeEmpty = false;
    try {
      const scope = this.#ctx.native.inspectSessionScope(id);
      scopeEmpty =
        !scope.truncated && scope.activeProcessCount === 0 && scope.processIds.length === 0;
    } catch {
      /* Closing a handle initiates cleanup; it does not prove completion. */
    }
    const uncertain =
      !scopeEmpty ||
      session?.lifecycleState === 'recovery_required' ||
      (live && this.#ctx.live.has(id));
    this.#recordResult(
      this.#repo().attempt(attempt.id),
      uncertain ? 'unknown' : disposition,
      'Main stopped the bounded worker attempt.',
      uncertain ? 'WORK_ATTEMPT_UNKNOWN' : reasonCode,
      [],
      this.#repo().attemptMetadata(attempt.id).effect,
    );
  }
  onSessionEnded(sessionId: string, reasonCode: string): void {
    this.#hostOutput.delete(sessionId);
    if (
      this.#stopped ||
      this.#ending.has(sessionId) ||
      !this.#ctx.storage ||
      this.#ctx.health.degraded
    )
      return;
    const repo = this.#repo();
    const role = repo.roleForSession(sessionId);
    if (!role) return;
    if (role.role === 'supervisor') {
      if (!terminal.has(repo.mission(role.missionId).state))
        this.#write(() =>
          repo.setState(role.missionId, 'recovery_required', 'SUPERVISOR_LOST', this.#at()),
        );
    } else {
      for (const attempt of repo
        .attempts(role.missionId)
        .filter((a) => a.sessionId === sessionId && activeAttempt.has(a.state))) {
        if (attempt.state === 'reserved') continue; // the launcher owns start-failure classification
        this.#recordResult(
          attempt,
          'unknown',
          'The worker ended without a structured final outcome.',
          reasonCode,
          [],
          'possible',
        );
        if (!terminal.has(repo.mission(role.missionId).state))
          this.#write(() =>
            repo.setState(role.missionId, 'paused', 'WORK_ATTEMPT_UNKNOWN', this.#at()),
          );
      }
    }
    this.#emit(role.missionId);
    this.#schedule();
  }
  invalidStructuredOutput(sessionId: string): void {
    const role = this.#repo().roleForSession(sessionId);
    if (role?.role === 'supervisor' && !terminal.has(this.#repo().mission(role.missionId).state)) {
      this.#write(() =>
        this.#repo().setState(role.missionId, 'paused', 'SUPERVISOR_OUTPUT_INVALID', this.#at()),
      );
      this.#emit(role.missionId);
    }
  }
  onPowerBoundary(): void {
    if (!this.#ctx.storage || this.#ctx.health.degraded) return;
    const repo = this.#repo();
    const workers = repo
      .monitoredIds()
      .flatMap((id) => repo.attempts(id))
      .filter((attempt) => activeAttempt.has(attempt.state))
      .map(
        (attempt) =>
          attempt.sessionId ??
          repo.leases(attempt.missionId).find((lease) => lease.id === attempt.leaseId)!
            .plannedSessionId,
      );
    this.#write(() => repo.recover(this.#at()));
    for (const id of new Set(workers)) {
      const live = this.#ctx.live.get(id);
      if (live) {
        this.#ending.add(id);
        try {
          failSession(this.#ctx, live, 'MISSION_POWER_BOUNDARY');
        } finally {
          this.#ending.delete(id);
        }
      }
    }
    for (const m of repo.list()) this.#emit(m.id);
    this.#schedule();
  }
  /** Called only after the bridge authenticated, version-checked and deduplicated evidence. */
  onProviderLifecycle(evidence: ProviderLifecycleEvidence): void {
    if (
      this.#stopped ||
      !this.#ctx.storage ||
      this.#ctx.health.degraded ||
      evidence.eventKind !== 'turn_completed' ||
      !evidence.turnId ||
      this.#ctx.live.get(evidence.sessionId)?.state !== 'running'
    )
      return;
    const repo = this.#repo();
    const role = repo.roleForSession(evidence.sessionId);
    if (!role || terminal.has(repo.mission(role.missionId).state)) return;
    if (role.role === 'supervisor')
      this.#write(() =>
        this.#ctx
          .storage!.db.prepare(
            'UPDATE supervisor_missions SET turn_count=turn_count+1,last_progress_at=? WHERE id=?',
          )
          .run(this.#at(), role.missionId),
      );
    else
      for (const attempt of repo
        .attempts(role.missionId)
        .filter(
          (item) =>
            item.sessionId === evidence.sessionId && ['assigned', 'running'].includes(item.state),
        )) {
        const meta = repo.attemptMetadata(attempt.id);
        this.#write(() =>
          repo.recordProgress(attempt.id, {
            turnCount: meta.turnCount + 1,
            outputBytes: meta.outputBytes,
            tokensUsed: meta.tokensUsed,
            madeProgress: true,
            at: this.#at(),
          }),
        );
      }
    this.enforceBounds(role.missionId);
  }
  onSafePoint(sessionId: string): void {
    const role = this.#repo().roleForSession(sessionId);
    if (role) this.enforceBounds(role.missionId);
  }
  onHostOutput(
    sessionId: string,
    event: Extract<HostToMainMessage, { type: 'host.outputProgress' }>,
  ): void {
    const prior = this.#hostOutput.get(sessionId);
    const live = this.#ctx.live.get(sessionId);
    if (!live || this.#stopped) return;
    if (
      event.sessionId !== sessionId ||
      (prior &&
        (event.sequence <= prior.sequence || event.totalOutputBytes < prior.totalOutputBytes))
    ) {
      failSession(this.#ctx, live, 'HOST_PROTOCOL_VIOLATION');
      return;
    }
    if (!this.#ctx.storage || this.#ctx.health.degraded) {
      if (event.attemptId) failSession(this.#ctx, live, 'STORAGE_UNAVAILABLE');
      else this.#hostOutput.set(sessionId, event);
      return;
    }
    const repo = this.#repo();
    const role = repo.roleForSession(sessionId);
    if (!role) {
      if (event.attemptId) failSession(this.#ctx, live, 'HOST_PROTOCOL_VIOLATION');
      else this.#hostOutput.set(sessionId, event);
      return;
    }
    if (role.role === 'supervisor') {
      if (event.attemptId) {
        failSession(this.#ctx, live, 'HOST_PROTOCOL_VIOLATION');
        return;
      }
      this.#hostOutput.set(sessionId, event);
      const delta = event.totalOutputBytes - (prior?.totalOutputBytes ?? 0);
      if (delta > 0)
        this.#write(() =>
          this.#ctx
            .storage!.db.prepare(
              'UPDATE supervisor_missions SET output_bytes=output_bytes+? WHERE id=?',
            )
            .run(delta, role.missionId),
        );
      this.enforceBounds(role.missionId);
      return;
    }
    if (!event.attemptId) {
      this.#hostOutput.set(sessionId, event);
      return;
    }
    const attempt = repo.attempts(role.missionId).find((item) => item.id === event.attemptId);
    if (!attempt || attempt.sessionId !== sessionId || attempt.missionId !== role.missionId) {
      failSession(this.#ctx, live, 'HOST_PROTOCOL_VIOLATION');
      return;
    }
    if (!activeAttempt.has(attempt.state)) return;
    const meta = repo.attemptMetadata(attempt.id);
    if (meta.bindingId !== role.bindingId || event.outputBytes < meta.outputBytes) {
      failSession(this.#ctx, live, 'HOST_PROTOCOL_VIOLATION');
      return;
    }
    this.#write(() =>
      repo.recordProgress(attempt.id, {
        turnCount: meta.turnCount,
        outputBytes: event.outputBytes,
        tokensUsed: meta.tokensUsed,
        madeProgress: false,
        at: this.#at(),
      }),
    );
    this.#hostOutput.set(sessionId, event);
    this.#outputWaiters.get(`${sessionId}:${attempt.id}`)?.();
    this.enforceBounds(attempt.missionId, event.limitReached ? 'resource_bound' : null);
  }
  ingestProgress(sessionId: string, raw: unknown, tokensUsed = 0): void {
    const event = ProviderProgressEvent.parse(raw);
    if (event.sessionId !== sessionId) throw new ThreadHelmError('UNAUTHORIZED_SENDER');
    const repo = this.#repo();
    const attempt = repo.attempt(event.attemptId);
    if (attempt.sessionId !== sessionId) throw new ThreadHelmError('UNAUTHORIZED_SENDER');
    if (!Number.isSafeInteger(tokensUsed) || tokensUsed < 0)
      throw new ThreadHelmError('INVALID_REQUEST');
    const previous = repo.attemptMetadata(attempt.id);
    this.#write(() =>
      repo.recordProgress(attempt.id, {
        turnCount: event.turnCount,
        outputBytes: event.outputBytes,
        tokensUsed,
        madeProgress: event.kind === 'turn_completed' && event.turnCount > previous.turnCount,
        at: this.#at(),
      }),
    );
    this.enforceBounds(attempt.missionId);
  }
  #boundReason(missionId: string): ReturnType<typeof assessMissionBounds> {
    const repo = this.#repo();
    const mission = repo.mission(missionId);
    const envelope = repo.envelope(missionId);
    if (!envelope) return null;
    const attempts = repo.attempts(missionId).filter((a) => activeAttempt.has(a.state));
    let activeProcessCount = 0;
    for (const a of attempts) {
      const live = a.sessionId ? this.#ctx.live.get(a.sessionId) : null;
      if (live) {
        try {
          const scope = this.#ctx.native.inspectJob(live.jobToken);
          if (scope.truncated) return 'resource_bound';
          activeProcessCount += Math.max(0, scope.activeProcessCount - 1);
        } catch {
          return 'resource_bound';
        }
      }
    }
    return assessMissionBounds(
      envelope.bounds,
      {
        startedAt: Date.parse(mission.started_at),
        lastProgressAt: Date.parse(mission.last_progress_at),
        turnCount: mission.turn_count,
        outputBytes: mission.output_bytes,
        tokensUsed: mission.tokens_used,
        activeWorkers: repo
          .leases(missionId)
          .filter((l) => ['reserved', 'active', 'unknown'].includes(l.state)).length,
        activeProcessCount,
      },
      this.#ctx.clock().getTime(),
    );
  }
  enforceBounds(
    missionId: string,
    forcedReason: ReturnType<typeof assessMissionBounds> = null,
  ): void {
    if (this.#stopped || !this.#ctx.storage || this.#ctx.health.degraded) return;
    const repo = this.#repo();
    const mission = repo.mission(missionId);
    if (terminal.has(mission.state)) return;
    let reason = forcedReason ?? this.#boundReason(missionId);
    for (const attempt of repo.attempts(missionId).filter((a) => activeAttempt.has(a.state))) {
      const binding = repo
        .envelope(missionId)!
        .bindings.find((b) => b.bindingId === repo.attemptMetadata(attempt.id).bindingId)!;
      const meta = repo.attemptMetadata(attempt.id);
      const time = this.#ctx.clock().getTime();
      let processes = 0;
      const live = attempt.sessionId ? this.#ctx.live.get(attempt.sessionId) : null;
      if (live) {
        try {
          const scope = this.#ctx.native.inspectJob(live.jobToken);
          processes = scope.truncated ? Infinity : Math.max(0, scope.activeProcessCount - 1);
        } catch {
          processes = Infinity;
        }
      }
      const local =
        time - Date.parse(attempt.createdAt) >= binding.executionBounds.maxElapsedMs
          ? 'elapsed_bound'
          : meta.turnCount >= binding.executionBounds.maxTurns
            ? 'turn_bound'
            : meta.outputBytes >= binding.executionBounds.maxOutputBytes ||
                processes > binding.executionBounds.maxConcurrentProcesses
              ? 'resource_bound'
              : time - Date.parse(meta.lastProgressAt) >= binding.executionBounds.maxNoProgressMs
                ? 'no_progress'
                : null;
      reason ??= local;
    }
    if (reason) {
      this.#write(() => repo.setState(missionId, 'paused', reason.toUpperCase(), this.#at()));
      const disposition: SupervisorResultDisposition =
        reason === 'no_progress'
          ? 'no_progress'
          : reason === 'elapsed_bound'
            ? 'timed_out'
            : 'budget_exhausted';
      for (const attempt of repo.attempts(missionId).filter((a) => activeAttempt.has(a.state)))
        this.#endAttempt(attempt, disposition, reason.toUpperCase());
      this.#emit(missionId);
    }
    this.#schedule();
  }
  #schedule(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    if (this.#stopped || !this.#ctx.storage || this.#ctx.health.degraded) return;
    const missions = this.#repo().monitoredIds();
    if (!missions.length) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      try {
        for (const id of this.#repo().monitoredIds()) this.enforceBounds(id);
      } catch {
        this.#ctx.log.error('mission.bound_check_failed', { reasonCode: 'STORAGE_UNAVAILABLE' });
      }
    }, 1000);
    this.#timer.unref();
  }
  #emit(missionId: string) {
    this.#missionWaiters.get(missionId)?.();
    this.#ctx.coordinationBridge?.notifyMissionRolesChanged();
    for (const event of this.#repo().events(missionId)) {
      if (event.sequence > (this.#lastEmitted.get(missionId) ?? 0)) {
        this.#ctx.events.emit('mission.changed', event);
        this.#lastEmitted.set(missionId, event.sequence);
      }
    }
  }
  stop() {
    this.#stopped = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    for (const wake of [...this.#missionWaiters.values()]) wake();
  }
}
export function createSupervisorService(ctx: Context): SupervisorService {
  return new SupervisorService(ctx);
}
