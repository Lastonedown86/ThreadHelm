import { describe, expect, it } from 'vitest';
import {
  CONTINUE_LABEL,
  DEFAULT_BOUNDS,
  limitsSummary,
  newWorker,
  runtimeSummary,
  stageReadiness,
} from '../../../apps/desktop/src/renderer/features/mission-composer/composer-fields.js';

const uuid = '11111111-1111-4111-8111-111111111111';
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

  it('summarizes defaults in words', () => {
    expect(limitsSummary(DEFAULT_BOUNDS)).toBe(
      'Stops after 30 minutes, 64 turns, 5 minutes without progress or 8 MiB of output; at most 4 workers, 64 work items, depth 8, 3 attempts, 250,000 tokens.',
    );
    expect(runtimeSummary(newWorker())).toBe(
      'Provider default model · provider default effort · manual permission · starts only when you launch it',
    );
  });
});
