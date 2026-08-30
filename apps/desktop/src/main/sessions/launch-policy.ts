/**
 * Main-owned provider launch policy.
 *
 * Permission policy intentionally has no profile, persona, template, mission,
 * or display-name input. Those values are untrusted context and therefore
 * cannot participate in resolution.
 */

import {
  BreakGlassIsolationProof,
  LaunchRuntimeResolution,
  LaunchRuntimeSelection,
  LaunchPermissionResolution,
  PermissionCapabilityEvidence,
  ProviderExecutionBounds,
  ProviderCancelRequest,
  ProviderProgressEvent,
  ThreadHelmError,
  type LaunchPermissionSelection,
  type LaunchRuntimeSource,
  type LaunchWorkType,
  type ProviderId,
  type RuntimePermissionPolicy,
  type RuntimePermissionSource,
} from '@threadhelm/contracts';

export interface PersistedRuntimePolicy {
  /** Immutable revision/policy identity loaded by main from durable state. */
  reference: string;
  runtimeSelection: LaunchRuntimeSelection;
}

export interface ResolveLaunchRuntimeInput {
  providerId: ProviderId;
  taskType: LaunchWorkType;
  /** A non-null object includes an explicit one-run CLI-default choice when both fields are null. */
  oneRunOverride: LaunchRuntimeSelection | null;
  profileRevisionRequest: PersistedRuntimePolicy | null;
  taskTypePolicy: PersistedRuntimePolicy | null;
  projectPolicy: PersistedRuntimePolicy | null;
  escalationReason: string | null;
}

interface RuntimeCandidate {
  source: LaunchRuntimeSource;
  runtimeSelection: LaunchRuntimeSelection;
}

const source = (
  kind: LaunchRuntimeSource['kind'],
  reference: string | null,
): LaunchRuntimeSource => ({
  kind,
  reference,
});

function persistedCandidate(
  kind: 'profile_revision' | 'task_type_policy' | 'project_policy',
  policy: PersistedRuntimePolicy | null,
): RuntimeCandidate | null {
  if (!policy) return null;
  return {
    source: source(kind, policy.reference),
    runtimeSelection: LaunchRuntimeSelection.parse(policy.runtimeSelection),
  };
}

function resolveRuntimeField<K extends keyof LaunchRuntimeSelection>(
  field: K,
  candidates: readonly RuntimeCandidate[],
): { value: LaunchRuntimeSelection[K]; source: LaunchRuntimeSource } {
  for (const candidate of candidates) {
    const value = candidate.runtimeSelection[field];
    if (candidate.source.kind === 'one_run' || value !== null) {
      return { value, source: candidate.source };
    }
  }
  return { value: null, source: source('cli_default', null) } as {
    value: LaunchRuntimeSelection[K];
    source: LaunchRuntimeSource;
  };
}

function testWorkRecommendation(providerId: ProviderId, workType: LaunchWorkType) {
  if (workType !== 'test_authoring' && workType !== 'failure_analysis') return null;
  return {
    model: providerId === 'codex-cli' ? 'gpt-5.6-luna' : 'sonnet',
    effort: 'low' as const,
    reason:
      workType === 'test_authoring'
        ? 'Lowest-cost capable approved option for routine test authoring.'
        : 'Lowest-cost capable approved option for routine test failure analysis.',
  };
}

function isHighCostModel(providerId: ProviderId, model: string | null): boolean {
  if (!model) return false;
  const normalized = model.toLowerCase();
  return providerId === 'codex-cli'
    ? normalized === 'gpt-5.6-sol' || normalized === 'gpt-5.5'
    : normalized === 'opus' || normalized.includes('opus-');
}

export function resolveLaunchRuntime(input: ResolveLaunchRuntimeInput): LaunchRuntimeResolution {
  const candidates: RuntimeCandidate[] = [];
  if (input.oneRunOverride) {
    candidates.push({
      source: source('one_run', null),
      runtimeSelection: LaunchRuntimeSelection.parse(input.oneRunOverride),
    });
  }
  const profile = persistedCandidate('profile_revision', input.profileRevisionRequest);
  const task = persistedCandidate('task_type_policy', input.taskTypePolicy);
  const project = persistedCandidate('project_policy', input.projectPolicy);
  if (profile) candidates.push(profile);
  if (task) candidates.push(task);
  if (project) candidates.push(project);

  const model = resolveRuntimeField('model', candidates);
  const effort = resolveRuntimeField('effort', candidates);
  const requiresEscalationReason =
    isHighCostModel(input.providerId, model.value) ||
    effort.value === 'high' ||
    effort.value === 'xhigh' ||
    effort.value === 'max';
  const suppliedReason = input.escalationReason?.trim() ?? '';
  const escalationReason =
    requiresEscalationReason && suppliedReason.length >= 20 && suppliedReason.length <= 500
      ? suppliedReason
      : null;
  const heldForReason = requiresEscalationReason && escalationReason === null;

  return LaunchRuntimeResolution.parse({
    runtimeSelection: { model: model.value, effort: effort.value },
    modelSource: model.source,
    effortSource: effort.source,
    workType: input.taskType,
    recommendation: testWorkRecommendation(input.providerId, input.taskType),
    requiresEscalationReason,
    escalationReason,
    disposition: heldForReason ? 'held' : 'ready',
    reasonCode: heldForReason ? 'RUNTIME_ESCALATION_REASON_REQUIRED' : null,
  });
}

export const DEFAULT_PROVIDER_EXECUTION_BOUNDS = ProviderExecutionBounds.parse({
  maxElapsedMs: 30 * 60_000,
  maxTurns: 64,
  maxNoProgressMs: 5 * 60_000,
  maxOutputBytes: 8 * 1024 * 1024,
  maxConcurrentProcesses: 1,
});

export interface ResolveLaunchPermissionInput {
  providerId: ProviderId;
  providerVersion: string;
  model: string | null;
  invocation: 'direct' | 'supervisor';
  oneRunSelection: LaunchPermissionSelection | null;
  taskPolicy: RuntimePermissionPolicy | null;
  projectPolicy: RuntimePermissionPolicy | null;
  providerDefault: RuntimePermissionPolicy;
  capabilityEvidence: PermissionCapabilityEvidence | null;
  breakGlassProof: BreakGlassIsolationProof | null;
  now: string;
}

function assertPersistablePolicy(
  policy: RuntimePermissionPolicy | null,
  source: 'task_policy' | 'project_policy' | 'provider_default',
): void {
  if (policy === 'break_glass_bypass') {
    throw new ThreadHelmError(
      'INVALID_REQUEST',
      'Break-glass permission cannot be stored or inherited.',
      { source },
    );
  }
}

function selectedPolicy(input: ResolveLaunchPermissionInput): {
  policy: RuntimePermissionPolicy;
  source: RuntimePermissionSource;
  boundedAllowlist: readonly string[];
} {
  assertPersistablePolicy(input.taskPolicy, 'task_policy');
  assertPersistablePolicy(input.projectPolicy, 'project_policy');
  assertPersistablePolicy(input.providerDefault, 'provider_default');

  if (input.oneRunSelection?.policy) {
    return {
      policy: input.oneRunSelection.policy,
      source: 'one_run',
      boundedAllowlist: input.oneRunSelection.boundedAllowlist,
    };
  }
  if (input.taskPolicy)
    return { policy: input.taskPolicy, source: 'task_policy', boundedAllowlist: [] };
  if (input.projectPolicy) {
    return { policy: input.projectPolicy, source: 'project_policy', boundedAllowlist: [] };
  }
  return { policy: input.providerDefault, source: 'provider_default', boundedAllowlist: [] };
}

function exactCapability(
  input: ResolveLaunchPermissionInput,
  policy: RuntimePermissionPolicy,
): PermissionCapabilityEvidence | null {
  const parsed = PermissionCapabilityEvidence.safeParse(input.capabilityEvidence);
  if (!parsed.success) return null;
  const evidence = parsed.data;
  const observed = Date.parse(evidence.observedAt);
  const expires = Date.parse(evidence.expiresAt);
  const now = Date.parse(input.now);
  if (
    evidence.providerId !== input.providerId ||
    evidence.providerVersion !== input.providerVersion ||
    evidence.model !== input.model ||
    evidence.providerSurface !== input.providerId ||
    (policy !== 'bounded_allowlist' && evidence.organizationPolicy !== 'allowed') ||
    !evidence.supportedPolicies.includes(policy) ||
    !Number.isFinite(now) ||
    observed > now ||
    expires <= now
  ) {
    return null;
  }
  return evidence;
}

function held(
  policy: RuntimePermissionPolicy,
  source: RuntimePermissionSource,
  reasonCode: string,
  boundedAllowlist: readonly string[],
): LaunchPermissionResolution {
  return LaunchPermissionResolution.parse({
    policy,
    source,
    disposition: 'held',
    providerMapping: null,
    reasonCode,
    fallbackActions: policy === 'auto' ? ['manual', 'bounded_allowlist'] : ['manual'],
    capabilityEvidence: null,
    boundedAllowlist,
  });
}

function breakGlassIsProved(proof: BreakGlassIsolationProof | null): boolean {
  const parsed = BreakGlassIsolationProof.safeParse(proof);
  if (!parsed.success) return false;
  const value = parsed.data;
  return (
    value.freshRuntime &&
    value.childProcessContainment &&
    value.disposableWorkspaceOnlyWrites &&
    value.unrelatedCredentialsExcluded &&
    value.unrelatedEnvironmentExcluded &&
    value.networkDestinations.length > 0 &&
    value.processCleanupVerified &&
    value.workspaceCleanupVerified &&
    value.configCleanupVerified
  );
}

export function resolveLaunchPermission(
  input: ResolveLaunchPermissionInput,
): LaunchPermissionResolution {
  const { policy, source, boundedAllowlist } = selectedPolicy(input);

  if (policy === 'manual') {
    return LaunchPermissionResolution.parse({
      policy,
      source,
      disposition: 'ready',
      providerMapping: input.providerId === 'claude-code' ? 'claude_manual' : 'codex_manual',
      reasonCode: null,
      fallbackActions: [],
      capabilityEvidence: null,
      boundedAllowlist: [],
    });
  }

  const evidence = exactCapability(input, policy);
  if (policy === 'auto') {
    if (!evidence) return held(policy, source, 'PERMISSION_AUTO_UNAVAILABLE', []);
    return LaunchPermissionResolution.parse({
      policy,
      source,
      disposition: 'ready',
      providerMapping: input.providerId === 'claude-code' ? 'claude_auto' : 'codex_full_auto',
      reasonCode: null,
      fallbackActions: [],
      capabilityEvidence: evidence,
      boundedAllowlist: [],
    });
  }

  if (policy === 'bounded_allowlist') {
    if (!evidence || boundedAllowlist.length === 0 || input.providerId !== 'claude-code') {
      return held(policy, source, 'PERMISSION_ALLOWLIST_UNAVAILABLE', boundedAllowlist);
    }
    return LaunchPermissionResolution.parse({
      policy,
      source,
      disposition: 'ready',
      providerMapping: 'claude_bounded_allowlist',
      reasonCode: null,
      fallbackActions: [],
      capabilityEvidence: evidence,
      boundedAllowlist,
    });
  }

  if (
    source !== 'one_run' ||
    input.invocation !== 'direct' ||
    !evidence ||
    !breakGlassIsProved(input.breakGlassProof)
  ) {
    return held(policy, source, 'BREAK_GLASS_ISOLATION_UNPROVED', []);
  }
  return LaunchPermissionResolution.parse({
    policy,
    source,
    disposition: 'ready',
    providerMapping: input.providerId === 'claude-code' ? 'claude_bypass' : 'codex_bypass',
    reasonCode: null,
    fallbackActions: [],
    capabilityEvidence: evidence,
    boundedAllowlist: [],
  });
}

export function samePermissionCapability(
  left: LaunchPermissionResolution,
  right: LaunchPermissionResolution,
): boolean {
  const stable = (value: LaunchPermissionResolution) => ({
    policy: value.policy,
    source: value.source,
    disposition: value.disposition,
    providerMapping: value.providerMapping,
    reasonCode: value.reasonCode,
    fallbackActions: value.fallbackActions,
    boundedAllowlist: value.boundedAllowlist,
    capabilityEvidence: value.capabilityEvidence
      ? {
          providerId: value.capabilityEvidence.providerId,
          providerVersion: value.capabilityEvidence.providerVersion,
          model: value.capabilityEvidence.model,
          providerSurface: value.capabilityEvidence.providerSurface,
          organizationPolicy: value.capabilityEvidence.organizationPolicy,
          supportedPolicies: value.capabilityEvidence.supportedPolicies,
        }
      : null,
  });
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

/** Deterministic bound evaluation; provider permission/classifier state is irrelevant here. */
export function cancellationForProgress(input: {
  progress: ProviderProgressEvent;
  bounds: ProviderExecutionBounds;
  lastMeaningfulProgressAt: string;
}): ProviderCancelRequest | null {
  const progress = ProviderProgressEvent.parse(input.progress);
  const bounds = ProviderExecutionBounds.parse(input.bounds);
  const observedAt = Date.parse(progress.observedAt);
  const lastProgressAt = Date.parse(input.lastMeaningfulProgressAt);
  const reason =
    progress.elapsedMs >= bounds.maxElapsedMs
      ? 'elapsed_bound'
      : progress.turnCount >= bounds.maxTurns
        ? 'turn_bound'
        : progress.outputBytes >= bounds.maxOutputBytes ||
            progress.activeProcessCount > bounds.maxConcurrentProcesses
          ? 'resource_bound'
          : Number.isFinite(observedAt) &&
              Number.isFinite(lastProgressAt) &&
              observedAt - lastProgressAt >= bounds.maxNoProgressMs
            ? 'no_progress'
            : null;
  return reason
    ? ProviderCancelRequest.parse({
        attemptId: progress.attemptId,
        sessionId: progress.sessionId,
        reason,
      })
    : null;
}
