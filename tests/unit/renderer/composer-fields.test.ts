import { describe, expect, it } from 'vitest';
import {
  CONTINUE_LABEL,
  DEFAULT_BOUNDS,
  deriveWorkspaces,
  limitsSummary,
  newWorker,
  runtimeSummary,
  stageReadiness,
} from '../../../apps/desktop/src/renderer/features/mission-composer/composer-fields.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const supervisorWs = '22222222-2222-4222-8222-222222222222';
const oldFolder = '33333333-3333-4333-8333-333333333333';
const newFolder = '44444444-4444-4444-8444-444444444444';
const context = { hasProfiles: true, hasEligibleSessions: true };

describe('composer fields', () => {
  it('names continue buttons by destination', () => {
    expect(CONTINUE_LABEL.outcome).toBe('Continue to crew');
    expect(CONTINUE_LABEL.crew).toBe('Continue to access and limits');
    expect(CONTINUE_LABEL.access).toBe('Continue to review');
  });

  it('outcome readiness names the missing field and focuses it', () => {
    expect(stageReadiness('outcome', {}, context)).toEqual({
      ready: false,
      message: 'Add a finish line so the coordinator knows what done means.',
      firstInvalid: 'objective',
    });
    expect(stageReadiness('outcome', { objective: 'Fix the flaky test.' }, context)).toMatchObject({
      ready: false,
      firstInvalid: 'completionEvidence',
    });
    expect(
      stageReadiness(
        'outcome',
        { objective: 'Fix the flaky test.', completionEvidence: 'Green run, three times.' },
        context,
      ),
    ).toMatchObject({ ready: true, firstInvalid: null });
  });

  it('crew readiness explains prerequisites before fields', () => {
    expect(
      stageReadiness('crew', {}, { hasProfiles: false, hasEligibleSessions: true }),
    ).toMatchObject({
      ready: false,
      message: 'No reviewed profile yet. Create an agent first.',
    });
    const worker = { ...newWorker(), profileId: uuid, profileRevisionId: uuid };
    expect(
      stageReadiness(
        'crew',
        {
          supervisor: { profileId: uuid, profileRevisionId: uuid, sessionId: uuid },
          workers: [worker],
        },
        context,
      ),
    ).toMatchObject({ ready: false, firstInvalid: 'workers.0.assignment' });
    expect(
      stageReadiness(
        'crew',
        {
          supervisor: { profileId: uuid, profileRevisionId: uuid, sessionId: uuid },
          workers: [{ ...worker, assignment: 'Inspect.', requiredReturnEvidence: ['A report'] }],
        },
        context,
      ),
    ).toMatchObject({ ready: true });
  });

  it('access readiness needs one workspace per worker', () => {
    const worker = {
      ...newWorker(),
      profileId: uuid,
      profileRevisionId: uuid,
      assignment: 'Inspect.',
      requiredReturnEvidence: ['A report'],
    };
    expect(stageReadiness('access', { workers: [worker] }, context)).toMatchObject({
      ready: false,
      firstInvalid: 'workers.0.workspaceId',
    });
    expect(
      stageReadiness(
        'access',
        {
          workers: [{ ...worker, workspaceId: uuid }],
          workspaces: [{ workspaceId: uuid, mode: 'read' }],
        },
        context,
      ),
    ).toMatchObject({ ready: true });
  });

  it('derives workspaces from the currently-bound set, dropping stale entries', () => {
    const worker = { ...newWorker(), workspaceId: oldFolder };
    const fields = {
      workers: [worker],
      workspaces: [
        { workspaceId: supervisorWs, mode: 'write' as const },
        { workspaceId: oldFolder, mode: 'read' as const },
      ],
    };
    // Changing the worker's folder away from oldFolder drops it, since nothing
    // else references it, while preserving the supervisor's own entry.
    const movedWorker = { ...worker, workspaceId: newFolder };
    expect(deriveWorkspaces({ ...fields, workers: [movedWorker] }, supervisorWs)).toEqual(
      expect.arrayContaining([
        { workspaceId: supervisorWs, mode: 'write' },
        { workspaceId: newFolder, mode: 'write' },
      ]),
    );
    expect(deriveWorkspaces({ ...fields, workers: [movedWorker] }, supervisorWs)).toHaveLength(2);
  });

  it('never drops the supervisor entry, and keeps a still-bound workspace mode', () => {
    const worker = { ...newWorker(), workspaceId: oldFolder };
    const fields = {
      workers: [worker],
      workspaces: [{ workspaceId: oldFolder, mode: 'read' as const }],
    };
    // Supervisor's own workspace has no representation yet (no session chosen
    // before) but must appear once one is: added, not silently missing.
    expect(deriveWorkspaces(fields, supervisorWs)).toEqual(
      expect.arrayContaining([
        { workspaceId: supervisorWs, mode: 'write' },
        { workspaceId: oldFolder, mode: 'read' },
      ]),
    );
  });

  it('access readiness rejects an out-of-range bound before it reaches the server', () => {
    const worker = {
      ...newWorker(),
      profileId: uuid,
      profileRevisionId: uuid,
      assignment: 'Inspect.',
      requiredReturnEvidence: ['A report'],
      workspaceId: uuid,
    };
    // An emptied number input becomes 0, which fails MissionBounds' server-side
    // minimum (>= 1000 for maxElapsedMs) — this must be caught here, not there.
    expect(
      stageReadiness(
        'access',
        {
          workers: [worker],
          workspaces: [{ workspaceId: uuid, mode: 'read' }],
          bounds: { ...DEFAULT_BOUNDS, maxElapsedMs: 0 },
        },
        context,
      ),
    ).toMatchObject({ ready: false, firstInvalid: 'bounds.maxElapsedMs' });
    expect(
      stageReadiness(
        'access',
        {
          workers: [worker],
          workspaces: [{ workspaceId: uuid, mode: 'read' }],
          bounds: DEFAULT_BOUNDS,
        },
        context,
      ),
    ).toMatchObject({ ready: true });
  });

  it('summarizes defaults in words', () => {
    expect(limitsSummary(DEFAULT_BOUNDS)).toBe(
      'Stops after 30 minutes, 64 turns, 5 minutes without progress or 8 MiB of output; at most 4 workers, 64 work items, depth 8, 3 attempts, 250,000 tokens.',
    );
    expect(runtimeSummary(newWorker())).toBe(
      'Provider default model · provider default effort · manual permission · starts only when you launch it',
    );
  });
});
