import { LifecycleState, ThreadHelmError } from '@threadhelm/contracts';
import {
  acceptsForceStop,
  acceptsInput,
  acceptsInterrupt,
  acceptsStop,
  assertTransition,
  canTransition,
  isTerminal,
  isUnfinished,
  LEGAL_TRANSITIONS,
} from '@threadhelm/domain';
import { describe, expect, it } from 'vitest';

const ALL = LifecycleState.options;

// Independent copy of the documented table (data-model.md) so a typo in the
// implementation cannot silently agree with itself.
const EXPECTED: Record<LifecycleState, LifecycleState[]> = {
  starting: ['running', 'failed', 'recovery_required'],
  running: ['interrupting', 'stopping', 'stopped', 'failed', 'recovery_required'],
  interrupting: ['running', 'stopped', 'failed', 'recovery_required'],
  stopping: ['stopped', 'failed', 'recovery_required'],
  stopped: [],
  failed: [],
  recovery_required: ['stopped'],
};

describe('session lifecycle', () => {
  it('matches the documented table for every (from, to) pair', () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(EXPECTED[from].includes(to));
      }
    }
  });

  it('exports the same table it enforces', () => {
    for (const from of ALL) {
      expect([...LEGAL_TRANSITIONS[from]].sort()).toEqual([...EXPECTED[from]].sort());
    }
  });

  it('never allows a self-transition or entering starting', () => {
    for (const s of ALL) {
      expect(canTransition(s, s)).toBe(false);
      expect(canTransition(s, 'starting')).toBe(false);
    }
  });

  it('terminal states have no exits', () => {
    for (const s of ALL) {
      expect(isTerminal(s)).toBe(s === 'stopped' || s === 'failed');
      if (isTerminal(s)) expect(LEGAL_TRANSITIONS[s]).toHaveLength(0);
    }
  });

  it('unfinished states are exactly those that reconcile to recovery_required', () => {
    const unfinished = ALL.filter(isUnfinished);
    expect(unfinished.sort()).toEqual(['interrupting', 'running', 'starting', 'stopping']);
  });

  it('control predicates', () => {
    expect(ALL.filter(acceptsInput)).toEqual(['running']);
    expect(ALL.filter(acceptsInterrupt)).toEqual(['running']);
    expect(ALL.filter(acceptsStop)).toEqual(['running', 'interrupting']);
    expect(ALL.filter(acceptsForceStop)).toEqual(['running', 'interrupting', 'stopping']);
  });

  it('assertTransition throws INVALID_STATE with from/to details', () => {
    expect(() => assertTransition('running', 'interrupting')).not.toThrow();
    let caught: unknown;
    try {
      assertTransition('stopped', 'running');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ThreadHelmError);
    expect((caught as ThreadHelmError).code).toBe('INVALID_STATE');
    expect((caught as ThreadHelmError).details).toEqual({ from: 'stopped', to: 'running' });
  });
});
