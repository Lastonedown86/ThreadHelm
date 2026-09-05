import { describe, expect, it } from 'vitest';
import {
  ErrorCode,
  MissionBindingView,
  MissionComposerFields,
  MissionEnvelopeInput,
  MissionEnvelopeView,
  operationNames,
  eventNames,
} from '@threadhelm/contracts';

const uuid = '11111111-1111-4111-8111-111111111111';
const worker = {
  profileId: uuid,
  profileRevisionId: uuid,
  workspaceId: uuid,
  sessionId: null,
  role: 'worker',
  autoStart: false,
  runtimeSelection: { model: null, effort: null },
  permissionSelection: { policy: null, boundedAllowlist: [] },
  executionBounds: {
    maxElapsedMs: 1_800_000,
    maxTurns: 64,
    maxNoProgressMs: 300_000,
    maxOutputBytes: 8_388_608,
    maxConcurrentProcesses: 8,
  },
};
const envelope = {
  objective: 'Review a bounded local change.',
  completionEvidence: 'A cited report.',
  workspaces: [{ workspaceId: uuid, mode: 'write' }],
  supervisor: { profileId: uuid, profileRevisionId: uuid, sessionId: uuid },
  workers: [{ ...worker, assignment: 'Inspect the change.', requiredReturnEvidence: ['A report'] }],
  bounds: {
    maxElapsedMs: 1_800_000,
    maxTurns: 64,
    maxNoProgressMs: 300_000,
    maxOutputBytes: 8_388_608,
    maxConcurrentProcesses: 16,
    maxWorkers: 4,
    maxWorkItems: 64,
    maxDepth: 8,
    maxAttempts: 3,
    maxTokenBudget: 250_000,
  },
  permittedRoutineActions: ['decompose'],
  knownSafeRetryClasses: [],
  escalationRules: ['consequential', 'unknown', 'bounds', 'supervisor_loss'],
};

describe('mission composer contract additions', () => {
  it('requires assignment and return evidence on workers and defaults exclusions', () => {
    const parsed = MissionEnvelopeInput.parse(envelope);
    expect(parsed.exclusions).toEqual([]);
    expect(parsed.workers[0]!.requiredReturnEvidence).toEqual(['A report']);
    expect(MissionEnvelopeInput.safeParse({ ...envelope, workers: [worker] }).success).toBe(false);
    expect(
      MissionEnvelopeInput.safeParse({
        ...envelope,
        workers: [{ ...envelope.workers[0], requiredReturnEvidence: [] }],
      }).success,
    ).toBe(false);
    expect(
      MissionEnvelopeInput.safeParse({ ...envelope, exclusions: Array(9).fill('x') }).success,
    ).toBe(false);
  });

  it('view schemas default the new fields so pre-change envelopes still parse', () => {
    expect(MissionEnvelopeView.shape.exclusions.parse(undefined)).toEqual([]);
    expect(MissionBindingView.shape.assignment.parse(undefined)).toBeNull();
    expect(MissionBindingView.shape.requiredReturnEvidence.parse(undefined)).toEqual([]);
  });

  it('accepts a partial composer draft', () => {
    expect(MissionComposerFields.parse({})).toEqual({});
    expect(MissionComposerFields.parse({ objective: 'x' })).toEqual({ objective: 'x' });
    expect(MissionComposerFields.safeParse({ objective: 1 }).success).toBe(false);
  });

  it('names the composer operations, event and failure codes', () => {
    for (const name of [
      'missionComposer.createDraft',
      'missionComposer.listDrafts',
      'missionComposer.getDraft',
      'missionComposer.updateDraft',
      'missionComposer.preview',
      'missionComposer.confirm',
      'missionComposer.previewDiscard',
      'missionComposer.confirmDiscard',
    ])
      expect(operationNames).toContain(name);
    expect(eventNames).toContain('missionComposer.changed');
    for (const code of [
      'MISSION_DRAFT_NOT_FOUND',
      'MISSION_DRAFT_STALE',
      'MISSION_DRAFT_LIMIT',
      'MISSION_DRAFT_SAVE_FAILED',
      'MISSION_DRAFT_DISCARD_STALE',
      'MISSION_CONFIRMATION_EXPIRED',
    ])
      expect(ErrorCode.safeParse(code).success).toBe(true);
  });
});
