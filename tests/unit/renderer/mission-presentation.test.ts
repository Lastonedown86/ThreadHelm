import type { MissionDetailView, SupervisorAttemptView } from '@threadhelm/contracts';
import { describe, expect, it } from 'vitest';
import {
  missionTitle,
  presentMission,
} from '../../../apps/desktop/src/renderer/features/mission-focus/mission-presentation.js';

const missionId = '00000000-0000-4000-8000-000000000001';

function mission(overrides: Partial<MissionDetailView> = {}): MissionDetailView {
  return {
    id: missionId,
    version: 1,
    state: 'running',
    supervisorSessionId: null,
    workItemCount: 0,
    completedWorkItemCount: 0,
    activeWorkerCount: 0,
    sequence: 0,
    reasonCode: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    envelope: { objective: 'Ship a bounded mission workspace.' } as MissionDetailView['envelope'],
    input: null,
    workItems: [],
    decisions: [],
    leases: [],
    attempts: [],
    ...overrides,
  };
}

function unknownAttempt(): SupervisorAttemptView {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    missionId,
    workItemId: '00000000-0000-4000-8000-000000000003',
    decisionId: '00000000-0000-4000-8000-000000000004',
    leaseId: '00000000-0000-4000-8000-000000000005',
    profileRevisionId: '00000000-0000-4000-8000-000000000006',
    sessionId: null,
    envelopeVersion: 1,
    reservedTokenBudget: 1000,
    attemptNumber: 1,
    state: 'unknown',
    workerStartDisposition: 'started',
    handoffId: null,
    resultHandoffId: null,
    supervisorSessionId: '00000000-0000-4000-8000-000000000007',
    disposition: 'unknown',
    explanation: null,
    evidenceRefs: [],
    reasonCode: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    completedAt: null,
  };
}

describe('mission presentation', () => {
  it('titles a mission by its objective and falls back to the id only without content', () => {
    expect(presentMission(mission()).title).toBe('Ship a bounded mission workspace.');
    expect(missionTitle('First line\nSecond line', missionId)).toBe('First line');
    expect(missionTitle('x'.repeat(100), missionId)).toBe(`${'x'.repeat(79)}…`);
    expect(missionTitle(null, missionId)).toBe('Mission 00000000');
    expect(presentMission(mission({ envelope: null })).title).toBe('Mission 00000000');
  });

  it('maps lifecycle state to one bounded primary action', () => {
    expect(presentMission(mission()).primaryAction).toBe('pause');
    expect(presentMission(mission({ state: 'paused' })).primaryAction).toBe('resume');
    expect(presentMission(mission({ state: 'recovery_required' })).attention).toBe('recovery');
    expect(presentMission(mission({ attempts: [unknownAttempt()] })).primaryAction).toBe('inspect');
    expect(presentMission(mission({ state: 'completed' })).primaryAction).toBe('view_evidence');
    expect(presentMission(mission({ state: 'cancelled' })).primaryAction).toBeNull();
  });

  it('keeps an unknown attempt uncertain and never turns it into retry work', () => {
    const result = presentMission(mission({ state: 'paused', attempts: [unknownAttempt()] }));

    expect(result.attention).toBe('uncertain');
    expect(result.primaryAction).toBe('inspect');
  });

  it('uses the fixed deleted-content sentence when the envelope is absent', () => {
    expect(presentMission(mission({ envelope: null })).objective).toBe(
      'Mission content was deleted.',
    );
  });

  it('marks completed work verified only when retained evidence exists', () => {
    const workItemId = '00000000-0000-4000-8000-000000000003';
    const completed = {
      id: workItemId,
      missionId,
      parentWorkItemId: null,
      workspaceId: '00000000-0000-4000-8000-000000000008',
      title: 'Verify the result',
      specification: null,
      acceptanceCriteria: null,
      dependencies: [],
      authorityClass: 'routine' as const,
      state: 'completed' as const,
      assignedSessionId: null,
      attemptCount: 1,
      reasonCode: null,
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:01:00.000Z',
    };
    const evidencedAttempt = {
      ...unknownAttempt(),
      workItemId,
      state: 'completed' as const,
      disposition: 'completion' as const,
      evidenceRefs: [{ kind: 'artifact' as const, id: 'report.md' }],
      completedAt: '2026-09-01T12:01:00.000Z',
    };

    expect(
      presentMission(mission({ workItems: [completed], attempts: [evidencedAttempt] })).course,
    ).toContainEqual(
      expect.objectContaining({ id: workItemId, state: 'verified', title: 'Verify the result' }),
    );
    expect(presentMission(mission({ workItems: [completed] })).course).toContainEqual(
      expect.objectContaining({ id: workItemId, state: 'held' }),
    );
  });
});
