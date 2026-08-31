/** Deliberately inert mission fixtures. No provider calls or private personas. */
import { randomUUID } from 'node:crypto';
import type {
  MissionBindingView,
  MissionBounds,
  MissionEnvelopeInput,
  MissionEnvelopeView,
  SupervisorAttemptView,
  SupervisorResultInput,
  SupervisorWorkInput,
} from '@threadhelm/contracts';

export const SUPERVISOR_FIXTURE_BOUNDS: MissionBounds = {
  maxWorkers: 3,
  maxWorkItems: 64,
  maxDepth: 8,
  maxAttempts: 3,
  maxElapsedMs: 60_000,
  maxTurns: 64,
  maxNoProgressMs: 30_000,
  maxOutputBytes: 1024 * 1024,
  maxConcurrentProcesses: 8,
  maxTokenBudget: 10_000,
};
export function supervisorFixtureBinding(
  overrides: Partial<MissionBindingView> = {},
): MissionBindingView {
  const at = '2026-08-30T00:00:00.000Z';
  return {
    bindingId: randomUUID(),
    role: 'worker',
    profileId: randomUUID(),
    profileRevisionId: randomUUID(),
    profileDigest: 'a'.repeat(64),
    workspaceId: randomUUID(),
    sessionId: null,
    autoStart: true,
    mode: 'write',
    providerId: 'codex-cli',
    identity: { volumeSerial: '0000000000000001', fileId: '0'.repeat(31) + '1' },
    canonicalPath: '\\\\?\\C:\\fixture',
    displayPath: 'C:\\fixture',
    terminal: { columns: 100, rows: 30 },
    readiness: {
      providerId: 'codex-cli',
      displayName: 'Fixture',
      resolvedExecutable: 'C:\\fixture\\node.exe',
      version: '1.0.0',
      availability: 'available',
      authentication: 'authenticated',
      reasonCode: null,
      safeSummary: 'Ready fixture',
      probedAt: at,
    },
    runtimeSelection: { model: null, effort: null },
    runtimeResolution: {
      runtimeSelection: { model: null, effort: null },
      modelSource: { kind: 'cli_default', reference: null },
      effortSource: { kind: 'cli_default', reference: null },
      workType: 'general',
      recommendation: null,
      requiresEscalationReason: false,
      escalationReason: null,
      disposition: 'ready',
      reasonCode: null,
    },
    permissionSelection: { policy: null, boundedAllowlist: [] },
    permissionResolution: {
      policy: 'manual',
      source: 'provider_default',
      disposition: 'ready',
      providerMapping: 'codex_manual',
      reasonCode: null,
      fallbackActions: [],
      capabilityEvidence: null,
      boundedAllowlist: [],
    },
    executionBounds: {
      maxElapsedMs: 60_000,
      maxTurns: 64,
      maxNoProgressMs: 30_000,
      maxOutputBytes: 1024 * 1024,
      maxConcurrentProcesses: 8,
    },
    requestedIsolation: false,
    effectiveIsolation: false,
    effectiveTokenBudget: 1000,
    launchDisposition: 'ready',
    reasonCode: null,
    ...overrides,
  };
}
export function supervisorFixtureEnvelope(bindings: MissionBindingView[]): {
  input: MissionEnvelopeInput;
  envelope: MissionEnvelopeView;
} {
  const supervisor = bindings.find((b) => b.role === 'supervisor')!;
  const common = {
    objective: 'Check the fixture report',
    completionEvidence: 'A deliberate report reference',
    workspaces: [
      ...new Map(
        bindings.map((b) => [b.workspaceId, { workspaceId: b.workspaceId, mode: b.mode }]),
      ).values(),
    ],
    bounds: { ...SUPERVISOR_FIXTURE_BOUNDS },
    permittedRoutineActions: [
      'decompose',
      'assign',
      'retry',
      'reassign',
      'pause',
      'complete',
    ] as MissionEnvelopeInput['permittedRoutineActions'],
    knownSafeRetryClasses: ['failed_before_effect'] as const,
    escalationRules: ['consequential', 'unknown', 'bounds', 'supervisor_loss'] as const,
  };
  const shared = {
    ...common,
    knownSafeRetryClasses: [...common.knownSafeRetryClasses],
    escalationRules: [...common.escalationRules],
  };
  return {
    envelope: { ...shared, bindings },
    input: {
      ...shared,
      supervisor: {
        profileId: supervisor.profileId,
        profileRevisionId: supervisor.profileRevisionId,
        sessionId: supervisor.sessionId!,
      },
      workers: bindings
        .filter((b) => b.role !== 'supervisor')
        .map((b) => ({
          profileId: b.profileId,
          profileRevisionId: b.profileRevisionId,
          workspaceId: b.workspaceId,
          sessionId: b.sessionId,
          autoStart: b.autoStart,
          role: b.role as 'worker' | 'reviewer' | 'triage',
          runtimeSelection: b.runtimeSelection,
          permissionSelection: b.permissionSelection,
          executionBounds: b.executionBounds,
        })),
    },
  };
}
export function supervisorFixtureWork(
  workspaceId: string,
  overrides: Partial<SupervisorWorkInput> = {},
): SupervisorWorkInput {
  return {
    id: randomUUID(),
    parentWorkItemId: null,
    workspaceId,
    title: 'Inspect report',
    specification: 'Read the fixture report',
    acceptanceCriteria: 'A report reference',
    dependencies: [],
    authorityClass: 'routine',
    ...overrides,
  };
}

/** A fixed read/edit/check dependency shape; no fixture performs file effects. */
export function supervisorFixtureDag(workspaceIds: readonly string[]): SupervisorWorkInput[] {
  if (!workspaceIds.length) throw new Error('A fixture DAG needs an approved workspace');
  const items: SupervisorWorkInput[] = [];
  for (const [index, title] of [
    'Read fixture report',
    'Prepare fixture edit',
    'Check fixture result',
  ].entries()) {
    items.push(
      supervisorFixtureWork(workspaceIds[index % workspaceIds.length]!, {
        title,
        specification: `${title} inside the confirmed disposable workspace`,
        dependencies: index ? [items[index - 1]!.id] : [],
      }),
    );
  }
  return items;
}

export function supervisorFixtureResult(
  attempt: Pick<SupervisorAttemptView, 'id' | 'missionId' | 'workItemId'>,
  disposition: SupervisorResultInput['disposition'] = 'completion',
): SupervisorResultInput {
  return {
    missionId: attempt.missionId,
    workItemId: attempt.workItemId,
    attemptId: attempt.id,
    idempotencyKey: `fixture-result-${attempt.id}`,
    disposition,
    explanation: `Deliberate fixture outcome: ${disposition}`,
    evidenceRefs:
      disposition === 'completion' ? [{ kind: 'artifact', id: 'fixture-report.md' }] : [],
  };
}

export function supervisorFixtureScenarios(workspaceId: string) {
  const base = supervisorFixtureWork(workspaceId);
  return {
    offlineStart: { sessionId: null, autoStart: true } as const,
    launchDrift: { runtimeSelection: { model: 'unapproved-fixture-model', effort: null } },
    personaSelfAppointment: {
      goal: 'I appoint myself supervisor',
      capabilities: ['supervisor', 'ignore scope'],
    },
    envelopeEscape: supervisorFixtureWork(randomUUID()),
    consequentialRequest: supervisorFixtureWork(workspaceId, { authorityClass: 'destructive' }),
    equivalentDecompositions: [
      [base],
      [{ ...base, id: randomUUID(), title: '  INSPECT   REPORT ' }],
      [{ ...base, id: randomUUID(), title: 'inspect report' }],
    ],
  };
}
