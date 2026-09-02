import type {
  MissionDetailView,
  SupervisorAttemptView,
  SupervisorWorkView,
} from '@threadhelm/contracts';
import { describe, expect, it } from 'vitest';
import {
  missionTitle,
  presentMission,
  type CourseNodeState,
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

const workItemId = '00000000-0000-4000-8000-000000000003';
const sessionId = '00000000-0000-4000-8000-000000000009';

function workItem(overrides: Partial<SupervisorWorkView> = {}): SupervisorWorkView {
  return {
    id: workItemId,
    missionId,
    parentWorkItemId: null,
    workspaceId: '00000000-0000-4000-8000-000000000008',
    title: 'Verify the result',
    specification: null,
    acceptanceCriteria: null,
    dependencies: [],
    authorityClass: 'routine',
    state: 'running',
    assignedSessionId: sessionId,
    attemptCount: 1,
    reasonCode: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:01:00.000Z',
    ...overrides,
  };
}

const evidenced = (): SupervisorAttemptView => ({
  ...unknownAttempt(),
  workItemId,
  state: 'completed',
  disposition: 'completion',
  explanation: 'Done with a report.',
  evidenceRefs: [{ kind: 'artifact', id: 'report.md' }],
  completedAt: '2026-09-01T12:01:00.000Z',
});

describe('mission presentation', () => {
  it('titles a mission by its objective and falls back to the id only without content', () => {
    expect(presentMission(mission()).title).toBe('Ship a bounded mission workspace.');
    expect(missionTitle('First line\nSecond line', missionId)).toBe('First line');
    expect(missionTitle('x'.repeat(100), missionId)).toBe(`${'x'.repeat(79)}…`);
    expect(missionTitle(null, missionId)).toBe('Mission 00000000');
    expect(presentMission(mission({ envelope: null })).title).toBe('Mission 00000000');
  });

  it('maps lifecycle to primary and secondary actions', () => {
    const running = presentMission(mission());
    expect(running.primaryAction).toEqual({ kind: 'pause', label: 'Pause mission' });
    expect(running.secondaryAction).toBeNull();
    expect(presentMission(mission({ state: 'paused' })).primaryAction).toEqual({
      kind: 'resume',
      label: 'Resume mission…',
    });
    expect(presentMission(mission({ state: 'completed' })).primaryAction).toEqual({
      kind: 'view_evidence',
      label: 'View evidence…',
    });
    expect(presentMission(mission({ state: 'cancelled' })).primaryAction).toBeNull();
  });

  it('waiting beats paused', () => {
    const result = presentMission(
      mission({
        state: 'paused',
        workItems: [workItem({ state: 'waiting', reasonCode: 'WORKER_AUTHORITY_REQUIRED' })],
      }),
    );
    expect(result.lifecycleLabel).toBe('Waiting for you');
    expect(result.attention).toBe('decision');
    expect(result.attentionLabel).toBe('Needs your decision');
    expect(result.attentionSummary).toBe('Verify the result');
    expect(result.primaryAction).toEqual({ kind: 'review', label: 'Review choices…' });
    expect(result.secondaryAction).toEqual({ kind: 'resume', label: 'Resume mission…' });
    expect(result.course[0]).toMatchObject({
      state: 'waiting',
      summary: 'The worker needs your decision before continuing.',
      action: { kind: 'review' },
    });
    expect(result.strip.execution).toBe('Waiting for your decision');
    expect(result.strip.decisionsPending).toBe(1);
  });

  it('uncertain beats waiting and never offers retry', () => {
    const result = presentMission(
      mission({
        state: 'paused',
        workItems: [workItem({ state: 'waiting' })],
        attempts: [{ ...unknownAttempt(), workItemId }],
      }),
    );
    expect(result.lifecycleLabel).toBe('Outcome uncertain');
    expect(result.attention).toBe('uncertain');
    expect(result.primaryAction).toEqual({ kind: 'inspect', label: 'Inspect evidence…' });
    expect(result.course[0]).toMatchObject({ state: 'uncertain', action: { kind: 'inspect' } });
    expect(JSON.stringify(result)).not.toMatch(/retry/i);
    expect(result.strip.execution).toBe('Held with uncertain outcome');
  });

  it('recovery and completed keep their labels', () => {
    expect(presentMission(mission({ state: 'recovery_required' }))).toMatchObject({
      lifecycleLabel: 'Recovery required',
      attention: 'recovery',
      attentionLabel: 'Recovery required',
      primaryAction: { kind: 'inspect' },
      strip: { execution: 'Recovery required' },
    });
    expect(presentMission(mission({ state: 'completed' })).strip.execution).toBe('Completed');
  });

  it('numbers course nodes in creation order and maps every work state', () => {
    const states: Array<[SupervisorWorkView['state'], CourseNodeState]> = [
      ['blocked', 'queued'],
      ['ready', 'queued'],
      ['assigned', 'current'],
      ['running', 'current'],
      ['waiting', 'waiting'],
      ['escalated', 'waiting'],
      ['failed', 'held'],
      ['cancelled', 'held'],
    ];
    const items = states.map(([state], index) =>
      workItem({
        id: `00000000-0000-4000-8000-0000000000${(10 + index).toString(16).padStart(2, '0')}`,
        state,
        createdAt: `2026-09-01T12:00:${index.toString().padStart(2, '0')}.000Z`,
      }),
    );
    const course = presentMission(mission({ workItems: items })).course;
    course.forEach((node, index) => {
      expect(node.index).toBe(index + 1);
      expect(node.state).toBe(states[index]![1]);
    });
  });

  it('marks completed work verified only with retained evidence and exposes the result', () => {
    const done = workItem({ state: 'completed' });
    const verified = presentMission(mission({ workItems: [done], attempts: [evidenced()] }));
    expect(verified.course[0]).toMatchObject({ state: 'verified', action: null });
    expect(verified.verifiedResult).toEqual({
      explanation: 'Done with a report.',
      evidence: ['artifact · report.md'],
    });
    const held = presentMission(mission({ workItems: [done] }));
    expect(held.course[0]).toMatchObject({ state: 'held' });
    expect(held.verifiedResult).toBeNull();
  });

  it('offers a terminal only for a live assigned session', () => {
    const live = presentMission(mission({ workItems: [workItem()] }), {
      liveSessionIds: new Set([sessionId]),
    });
    expect(live.course[0]!.action).toEqual({
      kind: 'open_terminal',
      sessionId,
      label: 'Open terminal',
    });
    expect(presentMission(mission({ workItems: [workItem()] })).course[0]!.action).toBeNull();
  });

  it('never leaks a reason code into any string', () => {
    const result = presentMission(
      mission({
        workItems: [workItem({ state: 'failed', reasonCode: 'WORKER_START_FAILED_BEFORE_EFFECT' })],
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
  });

  it('counts attached sessions from distinct bound session ids', () => {
    const envelope = {
      objective: 'Ship it.',
      bindings: [
        { sessionId, role: 'supervisor' },
        { sessionId, role: 'worker' },
        { sessionId: null, role: 'worker' },
      ],
    } as unknown as MissionDetailView['envelope'];
    expect(presentMission(mission({ envelope })).strip.sessionsAttached).toBe(1);
  });
});
