import {
  ConversationState,
  DeliveryAttemptState,
  DeliveryState,
  EscalationState,
  ThreadHelmError,
  WorkOutcome,
} from '@threadhelm/contracts';
import {
  advanceConversationState,
  advanceDeliveryAttemptState,
  advanceDeliveryState,
  advanceEscalationState,
  advanceWorkOutcome,
  assertConversationParticipants,
  assertDeliveryRecipient,
  canPrepareDeliveryAttempt,
  canTransitionConversation,
  canTransitionDelivery,
  canTransitionDeliveryAttempt,
  canTransitionEscalation,
  canTransitionWorkOutcome,
  CONVERSATION_TRANSITIONS,
  DELIVERY_ATTEMPT_TRANSITIONS,
  DELIVERY_TRANSITIONS,
  ESCALATION_TRANSITIONS,
  selectExactRecipient,
  WORK_OUTCOME_TRANSITIONS,
} from '@threadhelm/domain';
import { describe, expect, it } from 'vitest';

const EXPECTED_CONVERSATION_TRANSITIONS: Readonly<
  Record<ConversationState, readonly ConversationState[]>
> = {
  open: ['paused', 'resolved', 'closed'],
  paused: ['open', 'resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

const EXPECTED_DELIVERY_TRANSITIONS: Readonly<Record<DeliveryState, readonly DeliveryState[]>> = {
  queued: ['held', 'manual_actionable', 'presenting', 'failed', 'cancelled'],
  held: ['queued', 'manual_actionable', 'cancelled'],
  manual_actionable: ['queued', 'presenting', 'cancelled'],
  presenting: ['delivered', 'manual_actionable'],
  delivered: ['acknowledged'],
  acknowledged: [],
  failed: ['queued'],
  cancelled: [],
};

const EXPECTED_ATTEMPT_TRANSITIONS: Readonly<
  Record<DeliveryAttemptState, readonly DeliveryAttemptState[]>
> = {
  prepared: ['dispatching', 'failed_before_write', 'unknown'],
  dispatching: ['applied', 'failed_before_write', 'unknown'],
  applied: [],
  failed_before_write: [],
  unknown: [],
};

const EXPECTED_WORK_OUTCOME_TRANSITIONS: Readonly<Record<WorkOutcome, readonly WorkOutcome[]>> = {
  pending: ['completed', 'refused', 'failed', 'cancelled', 'escalated'],
  completed: [],
  refused: [],
  failed: [],
  cancelled: [],
  escalated: [],
};

const EXPECTED_ESCALATION_TRANSITIONS: Readonly<
  Record<EscalationState, readonly EscalationState[]>
> = {
  open: ['continued', 'redirected', 'closed'],
  continued: [],
  redirected: [],
  closed: [],
};

function expectTransitionMatrix<State extends string>(
  states: readonly State[],
  expected: Readonly<Record<State, readonly State[]>>,
  actual: Readonly<Record<State, readonly State[]>>,
  canTransition: (from: State, to: State) => boolean,
): void {
  for (const from of states) {
    expect(actual[from], `exported transitions from ${from}`).toEqual(expected[from]);
    for (const to of states) {
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected[from].includes(to));
    }
  }
}

describe('coordination conversation and handoff policy', () => {
  it('enforces every documented conversation transition', () => {
    expectTransitionMatrix(
      ConversationState.options,
      EXPECTED_CONVERSATION_TRANSITIONS,
      CONVERSATION_TRANSITIONS,
      canTransitionConversation,
    );
  });

  it('requires exactly one stable recipient and rejects self-addressed handoffs', () => {
    expect(selectExactRecipient('session-a', ['session-b'])).toBe('session-b');

    for (const recipients of [[], ['session-b', 'session-c']]) {
      expect(() => selectExactRecipient('session-a', recipients)).toThrowError(ThreadHelmError);
    }
    expect(() => selectExactRecipient('session-a', ['session-a'])).toThrowError(ThreadHelmError);
  });

  it('keeps every handoff within the original two conversation participants', () => {
    const participants = ['session-a', 'session-b'] as const;

    expect(() =>
      assertConversationParticipants(participants, 'session-a', 'session-b'),
    ).not.toThrow();
    expect(() =>
      assertConversationParticipants(participants, 'session-b', 'session-a'),
    ).not.toThrow();
    expect(() =>
      assertConversationParticipants(participants, 'session-a', 'session-c'),
    ).toThrowError(ThreadHelmError);
  });

  it('fails closed when delivery targets a session other than the reviewed recipient', () => {
    expect(() => assertDeliveryRecipient('session-b', 'session-b')).not.toThrow();

    let caught: unknown;
    try {
      assertDeliveryRecipient('session-b', 'session-c');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ThreadHelmError);
    expect((caught as ThreadHelmError).code).toBe('COORDINATION_TARGET_CHANGED');
  });
});

describe('coordination delivery policy', () => {
  it('enforces every documented handoff delivery transition', () => {
    expectTransitionMatrix(
      DeliveryState.options,
      EXPECTED_DELIVERY_TRANSITIONS,
      DELIVERY_TRANSITIONS,
      canTransitionDelivery,
    );
  });

  it('enforces every documented delivery-attempt transition, including fail-closed recovery', () => {
    expectTransitionMatrix(
      DeliveryAttemptState.options,
      EXPECTED_ATTEMPT_TRANSITIONS,
      DELIVERY_ATTEMPT_TRANSITIONS,
      canTransitionDeliveryAttempt,
    );
  });

  it('admits a new attempt only when no active, applied, or unknown attempt exists', () => {
    expect(canPrepareDeliveryAttempt([])).toBe(true);
    expect(canPrepareDeliveryAttempt(['failed_before_write'])).toBe(true);
    expect(canPrepareDeliveryAttempt(['prepared'])).toBe(false);
    expect(canPrepareDeliveryAttempt(['dispatching'])).toBe(false);
    expect(canPrepareDeliveryAttempt(['applied'])).toBe(false);
    expect(canPrepareDeliveryAttempt(['unknown'])).toBe(false);
  });

  it('keeps work outcome independent from delivery state', () => {
    expectTransitionMatrix(
      WorkOutcome.options,
      EXPECTED_WORK_OUTCOME_TRANSITIONS,
      WORK_OUTCOME_TRANSITIONS,
      canTransitionWorkOutcome,
    );
    expect(advanceDeliveryState('presenting', 'delivered')).toBe('delivered');
    expect(advanceWorkOutcome('pending', 'pending')).toBe('pending');
  });

  it('handles duplicate transition events idempotently without allowing illegal transitions', () => {
    expect(advanceConversationState('paused', 'paused')).toBe('paused');
    expect(advanceDeliveryState('delivered', 'delivered')).toBe('delivered');
    expect(advanceDeliveryAttemptState('applied', 'applied')).toBe('applied');
    expect(advanceWorkOutcome('completed', 'completed')).toBe('completed');

    expect(() => advanceConversationState('closed', 'open')).toThrowError(ThreadHelmError);
    expect(() => advanceDeliveryState('acknowledged', 'presenting')).toThrowError(ThreadHelmError);
    expect(() => advanceDeliveryAttemptState('unknown', 'dispatching')).toThrowError(
      ThreadHelmError,
    );
    expect(() => advanceWorkOutcome('completed', 'pending')).toThrowError(ThreadHelmError);
  });

  it('resolves an escalation once and handles duplicate resolution idempotently', () => {
    expectTransitionMatrix(
      EscalationState.options,
      EXPECTED_ESCALATION_TRANSITIONS,
      ESCALATION_TRANSITIONS,
      canTransitionEscalation,
    );
    expect(advanceEscalationState('continued', 'continued')).toBe('continued');
    expect(() => advanceEscalationState('closed', 'open')).toThrowError(ThreadHelmError);
  });
});
