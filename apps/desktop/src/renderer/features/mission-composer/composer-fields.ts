import {
  MissionEnvelopeInput,
  type MissionBounds,
  type MissionComposerFields,
  type MissionComposerStage,
} from '@threadhelm/contracts';

export type Stage = MissionComposerStage;
export type WorkerFields = NonNullable<MissionComposerFields['workers']>[number];
export type SupervisorFields = NonNullable<MissionComposerFields['supervisor']>;

export const STAGES: readonly Stage[] = ['outcome', 'crew', 'access', 'review'];
export const STAGE_LABEL: Record<Stage, string> = {
  outcome: 'Outcome',
  crew: 'Crew',
  access: 'Access & limits',
  review: 'Review',
};
export const STAGE_HEADING: Record<Stage, string> = {
  outcome: 'Define one finish line.',
  crew: 'Choose who does the work.',
  access: 'Set where the mission may work and when it must stop.',
  review: 'Review the exact mission before anything starts.',
};
export const CONTINUE_LABEL: Record<Exclude<Stage, 'review'>, string> = {
  outcome: 'Continue to crew',
  crew: 'Continue to access and limits',
  access: 'Continue to review',
};

export const DEFAULT_WORKER_EXECUTION_BOUNDS = {
  maxElapsedMs: 1_800_000,
  maxTurns: 64,
  maxNoProgressMs: 300_000,
  maxOutputBytes: 8_388_608,
  maxConcurrentProcesses: 8,
};
export const DEFAULT_BOUNDS: MissionBounds = {
  ...DEFAULT_WORKER_EXECUTION_BOUNDS,
  maxConcurrentProcesses: 16,
  maxWorkers: 4,
  maxWorkItems: 64,
  maxDepth: 8,
  maxAttempts: 3,
  maxTokenBudget: 250_000,
};
export const BOUND_LABELS: Record<keyof MissionBounds, string> = {
  maxElapsedMs: 'Elapsed limit (ms)',
  maxTurns: 'Turn limit',
  maxNoProgressMs: 'No-progress limit (ms)',
  maxOutputBytes: 'Output limit (bytes)',
  maxConcurrentProcesses: 'Process limit',
  maxWorkers: 'Concurrent worker limit',
  maxWorkItems: 'Work item limit',
  maxDepth: 'Decomposition depth limit',
  maxAttempts: 'Attempt limit',
  maxTokenBudget: 'Token budget',
};
const ROUTINE_ACTIONS = ['decompose', 'assign', 'retry', 'reassign', 'pause', 'complete'] as const;

export function newWorker(): WorkerFields {
  return {
    profileId: null,
    profileRevisionId: null,
    workspaceId: null,
    sessionId: null,
    role: 'worker',
    autoStart: false,
    runtimeSelection: { model: null, effort: null },
    permissionSelection: { policy: null, boundedAllowlist: [] },
    executionBounds: DEFAULT_WORKER_EXECUTION_BOUNDS,
    assignment: '',
    requiredReturnEvidence: [],
  };
}

export interface ReadinessContext {
  hasProfiles: boolean;
  hasEligibleSessions: boolean;
}
export interface Readiness {
  ready: boolean;
  message: string;
  firstInvalid: string | null;
}
const ready = (message: string): Readiness => ({ ready: true, message, firstInvalid: null });
const blocked = (message: string, firstInvalid: string | null): Readiness => ({
  ready: false,
  message,
  firstInvalid,
});
const filled = (value: string | undefined) => Boolean(value && value.trim());

export function stageReadiness(
  stage: Stage,
  fields: MissionComposerFields,
  context: ReadinessContext,
): Readiness {
  const workers = fields.workers ?? [];
  switch (stage) {
    case 'outcome':
      if (!filled(fields.objective))
        return blocked('Add a finish line so the coordinator knows what done means.', 'objective');
      if (!filled(fields.completionEvidence))
        return blocked('Say what proof shows the mission is complete.', 'completionEvidence');
      return ready(
        'Ready to choose the crew. The coordinator can recognize completion without interpreting a task list.',
      );
    case 'crew': {
      if (!context.hasProfiles)
        return blocked('No reviewed profile yet. Create an agent first.', null);
      if (!context.hasEligibleSessions)
        return blocked('No live session can supervise yet. Launch a session first.', null);
      if (!fields.supervisor?.profileId)
        return blocked('Choose a supervisor profile.', 'supervisor.profileId');
      if (!fields.supervisor.sessionId)
        return blocked('Choose the live session that supervises.', 'supervisor.sessionId');
      if (workers.length === 0) return blocked('Add at least one worker.', 'workers');
      for (const [index, worker] of workers.entries()) {
        if (!worker.profileId)
          return blocked(`Choose a profile for worker ${index + 1}.`, `workers.${index}.profileId`);
        if (!filled(worker.assignment))
          return blocked(
            `Say what worker ${index + 1} contributes.`,
            `workers.${index}.assignment`,
          );
        if (worker.requiredReturnEvidence.length === 0)
          return blocked(
            `Add one thing worker ${index + 1} must bring back.`,
            `workers.${index}.requiredReturnEvidence`,
          );
      }
      return ready(
        'Crew is covered. Every worker has one contribution and at least one piece of return evidence.',
      );
    }
    case 'access': {
      for (const [index, worker] of workers.entries())
        if (!worker.workspaceId)
          return blocked(
            `Choose an approved folder for worker ${index + 1}.`,
            `workers.${index}.workspaceId`,
          );
      const ids = new Set(workers.map((w) => w.workspaceId));
      for (const id of ids)
        if (!(fields.workspaces ?? []).some((w) => w.workspaceId === id))
          return blocked('Choose read or write for every folder.', 'workspaces');
      return ready('Workspace and runtimes are ready. Continue to review the exact mission.');
    }
    case 'review':
      return ready('Review the exact mission, then start it.');
  }
}

const minutes = (ms: number) => `${Math.round(ms / 60_000)} minutes`;
const mib = (bytes: number) => `${Math.round(bytes / 1_048_576)} MiB`;
export function limitsSummary(bounds: MissionBounds): string {
  return `Stops after ${minutes(bounds.maxElapsedMs)}, ${bounds.maxTurns} turns, ${minutes(
    bounds.maxNoProgressMs,
  )} without progress or ${mib(bounds.maxOutputBytes)} of output; at most ${bounds.maxWorkers} workers, ${
    bounds.maxWorkItems
  } work items, depth ${bounds.maxDepth}, ${bounds.maxAttempts} attempts, ${bounds.maxTokenBudget.toLocaleString(
    'en-US',
  )} tokens.`;
}
export function runtimeSummary(worker: WorkerFields): string {
  const model = worker.runtimeSelection.model ?? 'Provider default model';
  const effort = worker.runtimeSelection.effort ?? 'provider default effort';
  const permission =
    worker.permissionSelection.policy === 'bounded_allowlist'
      ? 'allow-listed tools'
      : worker.permissionSelection.policy
        ? worker.permissionSelection.policy.replaceAll('_', ' ')
        : 'manual permission';
  const start = worker.autoStart
    ? 'starts automatically inside the mission'
    : 'starts only when you launch it';
  return `${model} · ${effort} · ${permission} · ${start}`;
}
export function accessReason(mode: 'read' | 'write'): string {
  return mode === 'read'
    ? 'Read: this worker inspects files and reports.'
    : 'Write: this worker changes files inside this folder only.';
}

export class IncompleteDraft extends Error {
  paths: string[];
  constructor(paths: string[]) {
    super(`Draft incomplete: ${paths.join(', ')}`);
    this.paths = paths;
  }
}
/** Same parse main runs; the renderer uses it only to explain, never to authorize. */
export function envelopeFrom(fields: MissionComposerFields): MissionEnvelopeInput {
  const candidate = {
    ...fields,
    exclusions: fields.exclusions ?? [],
    bounds: fields.bounds ?? DEFAULT_BOUNDS,
    permittedRoutineActions: fields.permittedRoutineActions ?? [...ROUTINE_ACTIONS],
    knownSafeRetryClasses: ['failed_before_effect'],
    escalationRules: ['consequential', 'unknown', 'bounds', 'supervisor_loss'],
  };
  const parsed = MissionEnvelopeInput.safeParse(candidate);
  if (!parsed.success)
    throw new IncompleteDraft([...new Set(parsed.error.issues.map((i) => i.path.join('.')))]);
  return parsed.data;
}
/** Fields the main service will parse; strips nothing, adds the fixed policy arrays. */
export function fieldsForSave(fields: MissionComposerFields): MissionComposerFields {
  return {
    ...fields,
    exclusions: fields.exclusions ?? [],
    bounds: fields.bounds ?? DEFAULT_BOUNDS,
    permittedRoutineActions: fields.permittedRoutineActions ?? [...ROUTINE_ACTIONS],
    knownSafeRetryClasses: ['failed_before_effect'],
    escalationRules: ['consequential', 'unknown', 'bounds', 'supervisor_loss'],
  };
}
