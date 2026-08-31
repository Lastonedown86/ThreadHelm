import { describe, expect, it } from 'vitest';
import {
  assertWorkGraph,
  authorizeSupervisor,
  assessMissionBounds,
  assertSafeRetry,
  hasDecisionLoop,
  normalizeSupervisorDecision,
  workerLeaseConflicts,
  assertExactWorkerBinding,
} from '../../../packages/domain/src/supervisor.js';

const limits = {
  maxWorkers: 3,
  maxWorkItems: 64,
  maxDepth: 8,
  maxAttempts: 3,
  maxElapsedMs: 60_000,
  maxTurns: 8,
  maxNoProgressMs: 10_000,
  maxOutputBytes: 4096,
  maxConcurrentProcesses: 4,
  maxTokenBudget: 1000,
};
const item = (id: string, dependencies: string[] = [], parentWorkItemId: string | null = null) => ({
  id,
  workspaceId: 'workspace',
  parentWorkItemId,
  dependencies,
  state: 'ready',
});
const usage = {
  startedAt: 0,
  lastProgressAt: 0,
  turnCount: 0,
  outputBytes: 0,
  activeProcessCount: 1,
  tokensUsed: 0,
  activeWorkers: 0,
};

describe('bounded supervisor domain policy', () => {
  it('accepts an acyclic graph and rejects a dependency cycle without inserting partial children', () => {
    expect(() =>
      assertWorkGraph([], [item('a'), item('b', ['a'])], limits, ['workspace']),
    ).not.toThrow();
    expect(() =>
      assertWorkGraph([], [item('a', ['b']), item('b', ['a'])], limits, ['workspace']),
    ).toThrowError(expect.objectContaining({ code: 'WORK_DAG_INVALID' }));
  });
  it('bounds graph count, parent and dependency depth, and same-mission workspace scope', () => {
    expect(() =>
      assertWorkGraph(
        [],
        Array.from({ length: 65 }, (_, n) => item(`w${n}`)),
        limits,
        ['workspace'],
      ),
    ).toThrowError(expect.objectContaining({ code: 'MISSION_BOUND_REACHED' }));
    expect(() =>
      assertWorkGraph(
        [],
        Array.from({ length: 9 }, (_, n) => item(`w${n}`, n ? [`w${n - 1}`] : [])),
        limits,
        ['workspace'],
      ),
    ).toThrowError(expect.objectContaining({ code: 'MISSION_BOUND_REACHED' }));
    expect(() => assertWorkGraph([], [item('a', ['absent'])], limits, ['workspace'])).toThrowError(
      expect.objectContaining({ code: 'WORK_DAG_INVALID' }),
    );
    expect(() => assertWorkGraph([], [item('a')], limits, ['other'])).toThrowError(
      expect.objectContaining({ code: 'MISSION_AUTHORITY_REQUIRED' }),
    );
  });
  it('requires the exact bound supervisor session and running mission, not persona claims', () => {
    expect(() =>
      authorizeSupervisor(
        { missionId: 'm', sessionId: 's', role: 'supervisor', state: 'running' },
        'm',
        's',
      ),
    ).not.toThrow();
    for (const change of [
      { role: 'worker' },
      { missionId: 'other' },
      { sessionId: 'worker' },
      { state: 'paused' },
    ]) {
      expect(() =>
        authorizeSupervisor(
          { missionId: 'm', sessionId: 's', role: 'supervisor', state: 'running', ...change },
          'm',
          's',
        ),
      ).toThrow();
    }
  });
  it('allows only three proved failed-before-effect attempts and never replays unknown work', () => {
    expect(() =>
      assertSafeRetry(
        2,
        { state: 'failed', effect: 'none', retryClass: 'failed_before_effect' },
        3,
        ['failed_before_effect'],
      ),
    ).not.toThrow();
    for (const prior of [
      { state: 'unknown', effect: 'possible', retryClass: null },
      { state: 'failed', effect: 'possible', retryClass: 'failed_before_effect' },
    ]) {
      expect(() => assertSafeRetry(1, prior, 3, ['failed_before_effect'])).toThrowError(
        expect.objectContaining({ code: 'WORK_ATTEMPT_UNKNOWN' }),
      );
    }
    expect(() =>
      assertSafeRetry(
        3,
        { state: 'failed', effect: 'none', retryClass: 'failed_before_effect' },
        3,
        ['failed_before_effect'],
      ),
    ).toThrowError(expect.objectContaining({ code: 'MISSION_BOUND_REACHED' }));
  });
  it('stops the third equivalent choice in eight decisions despite fresh IDs, whitespace, or rationale', () => {
    const one = normalizeSupervisorDecision('decompose', {
      items: [
        {
          id: 'a',
          title: ' Check  output ',
          specification: 'Read result',
          acceptanceCriteria: 'Evidence',
          workspaceId: 'w',
          dependencies: [],
        },
      ],
      rationale: 'one',
    });
    const two = normalizeSupervisorDecision('decompose', {
      items: [
        {
          id: 'b',
          title: 'check output',
          specification: 'Read result',
          acceptanceCriteria: 'Evidence',
          workspaceId: 'w',
          dependencies: [],
        },
      ],
      rationale: 'two',
    });
    expect(two).toBe(one);
    expect(hasDecisionLoop(one, [one, 'x', one])).toBe(true);
    expect(hasDecisionLoop(one, [one, '1', '2', '3', '4', '5', '6', one])).toBe(false);
  });
  it('normalizes local dependency identities and ordering for equivalent decomposition', () => {
    const first = {
      items: [
        { id: 'a', title: 'Read', workspaceId: 'w', dependencies: [] },
        { id: 'b', title: 'Check', workspaceId: 'w', dependencies: ['a'] },
      ],
    };
    const reordered = {
      items: [
        { id: 'd', title: 'check', workspaceId: 'w', dependencies: ['c'] },
        { id: 'c', title: 'read', workspaceId: 'w', dependencies: [] },
      ],
    };
    expect(normalizeSupervisorDecision('decompose', first)).toBe(
      normalizeSupervisorDecision('decompose', reordered),
    );
  });
  it.each([
    [60_000, {}, 'elapsed_bound'],
    [10_000, {}, 'no_progress'],
    [1, { turnCount: 8 }, 'turn_bound'],
    [1, { outputBytes: 4096 }, 'resource_bound'],
    [1, { activeProcessCount: 5 }, 'resource_bound'],
    [1, { tokensUsed: 1000 }, 'budget_exhausted'],
  ])(
    'enforces elapsed, turn, no-progress, process, output and token budgets (%s %j)',
    (now, patch, expected) => {
      expect(assessMissionBounds(limits, { ...usage, ...patch }, now as number)).toBe(expected);
    },
  );
  it('treats reserved and unknown native-identity leases as conflicting until safe release', () => {
    const scope = {
      workspaceId: 'a',
      volumeSerial: 'A',
      fileId: 'B',
      mode: 'write',
      state: 'reserved',
    };
    expect(workerLeaseConflicts(scope, { ...scope, workspaceId: 'alias', mode: 'read' })).toBe(
      true,
    );
    expect(workerLeaseConflicts({ ...scope, state: 'unknown' }, { ...scope, mode: 'read' })).toBe(
      true,
    );
    expect(workerLeaseConflicts({ ...scope, state: 'released' }, scope)).toBe(false);
    expect(workerLeaseConflicts({ ...scope, mode: 'read' }, { ...scope, mode: 'read' })).toBe(
      false,
    );
  });
  it('pins every launch field and refuses permission bypass, unproved auto, and expired evidence', () => {
    const binding = {
      profileId: 'p',
      profileRevisionId: 'r',
      workspaceId: 'w',
      autoStart: true,
      permissionResolution: {
        policy: 'auto',
        disposition: 'ready',
        providerMapping: 'claude_auto',
        capabilityEvidence: {
          expiresAt: '2026-08-30T01:00:00.000Z',
          organizationPolicy: 'allowed',
        },
      },
      identity: { volumeSerial: 'v', fileId: 'f' },
      runtimeSelection: { model: 'model', effort: 'high' },
      providerId: 'claude-code',
      executionBounds: limits,
    };
    expect(() =>
      assertExactWorkerBinding(
        binding,
        structuredClone(binding),
        Date.parse('2026-08-30T00:00:00.000Z'),
      ),
    ).not.toThrow();
    for (const change of [
      { profileRevisionId: 'r2' },
      { runtimeSelection: { model: 'other', effort: 'high' } },
      { permissionResolution: { ...binding.permissionResolution, policy: 'break_glass_bypass' } },
      { identity: { volumeSerial: 'v', fileId: 'changed' } },
    ]) {
      expect(() => assertExactWorkerBinding(binding, { ...binding, ...change }, 0)).toThrow();
    }
    expect(() =>
      assertExactWorkerBinding(binding, binding, Date.parse('2026-08-30T02:00:00.000Z')),
    ).toThrow();
  });
});
