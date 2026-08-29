/**
 * Provider-neutral coordination state policy (Feature 002, US1).
 *
 * This module decides only stable addressing and legal durable state changes.
 * Persistence, terminal dispatch, provider evidence, and user disclosures stay
 * in their owning layers.
 */

import {
  ThreadHelmError,
  type ConversationState,
  type DeliveryAttemptState,
  type DeliveryState,
  type EscalationKind,
  type EscalationState,
  type HandoffKind,
  type WorkOutcome,
} from '@threadhelm/contracts';

export interface AutomaticContinuationInput {
  autoContinueEnabled: boolean;
  conversationState: ConversationState;
  kind: HandoffKind;
  replyDepth: number;
  candidateFingerprint: string;
  recentEquivalentFingerprints: readonly string[];
  consecutiveDeliveryFailures: number;
  conflictingInstruction: boolean;
  authorityRequired: boolean;
}

export interface AutomaticContinuationDecision {
  action: 'present' | 'hold';
  reasonCode: string | null;
  escalationKind: EscalationKind | null;
  pauseConversation: boolean;
}

const PRESENT: AutomaticContinuationDecision = {
  action: 'present',
  reasonCode: null,
  escalationKind: null,
  pauseConversation: false,
};

function hold(
  reasonCode: string,
  escalationKind: EscalationKind | null = null,
  pauseConversation = false,
): AutomaticContinuationDecision {
  return { action: 'hold', reasonCode, escalationKind, pauseConversation };
}

/**
 * Deterministic US4 policy. Inputs are durable facts already derived by main
 * and persistence; no provider prose, timing, or model judgment is consulted.
 */
export function evaluateAutomaticContinuation(
  input: AutomaticContinuationInput,
): AutomaticContinuationDecision {
  if (input.conversationState === 'paused') return hold('CONVERSATION_PAUSED');
  if (input.conversationState === 'closed') return hold('CONVERSATION_CLOSED');
  if (input.conversationState === 'resolved') return hold('CONVERSATION_RESOLVED');
  if (input.authorityRequired) return hold('AUTHORITY_REQUIRED', 'authority_required', true);
  if (input.conflictingInstruction) {
    return hold('CONFLICTING_INSTRUCTION', 'conflicting_instruction', true);
  }
  if (input.replyDepth > 8) return hold('REPLY_DEPTH_LIMIT', 'reply_depth', true);
  if (input.consecutiveDeliveryFailures >= 3) {
    return hold('REPEATED_DELIVERY_FAILURE', 'repeated_delivery_failure', true);
  }

  // Persistence supplies newest-first prior fingerprints; the candidate is
  // the eighth item in the bounded window, so only the first seven are prior.
  const priorMatches = input.recentEquivalentFingerprints
    .slice(0, 7)
    .filter((fingerprint) => fingerprint === input.candidateFingerprint).length;
  if (priorMatches + 1 >= 3) {
    return hold('EQUIVALENT_MESSAGE_LOOP', 'equivalent_message_loop', true);
  }
  if (!input.autoContinueEnabled) return hold('AUTO_CONTINUE_DISABLED');
  if (input.kind === 'request' || input.kind === 'query' || input.kind === 'proposal') {
    return hold('KIND_HELD');
  }
  return PRESENT;
}

export const CONVERSATION_TRANSITIONS: Readonly<
  Record<ConversationState, readonly ConversationState[]>
> = {
  open: ['paused', 'resolved', 'closed'],
  paused: ['open', 'resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

export const DELIVERY_TRANSITIONS: Readonly<Record<DeliveryState, readonly DeliveryState[]>> = {
  queued: ['held', 'manual_actionable', 'presenting', 'failed', 'cancelled'],
  held: ['queued', 'manual_actionable', 'cancelled'],
  // A fresh exact-target retarget disclosure may requeue an uncertain/manual
  // item for a different eligible recipient; it never replays the old attempt.
  manual_actionable: ['queued', 'held', 'presenting', 'cancelled'],
  presenting: ['delivered', 'manual_actionable'],
  delivered: ['acknowledged'],
  acknowledged: [],
  failed: ['queued'],
  cancelled: [],
};

export const DELIVERY_ATTEMPT_TRANSITIONS: Readonly<
  Record<DeliveryAttemptState, readonly DeliveryAttemptState[]>
> = {
  prepared: ['dispatching', 'failed_before_write', 'unknown'],
  dispatching: ['applied', 'failed_before_write', 'unknown'],
  applied: [],
  failed_before_write: [],
  unknown: [],
};

export const WORK_OUTCOME_TRANSITIONS: Readonly<Record<WorkOutcome, readonly WorkOutcome[]>> = {
  pending: ['completed', 'refused', 'failed', 'cancelled', 'escalated'],
  completed: [],
  refused: [],
  failed: [],
  cancelled: [],
  escalated: [],
};

export const ESCALATION_TRANSITIONS: Readonly<Record<EscalationState, readonly EscalationState[]>> =
  {
    open: ['continued', 'redirected', 'closed'],
    continued: [],
    redirected: [],
    closed: [],
  };

function tableAllows<State extends string>(
  transitions: Readonly<Record<State, readonly State[]>>,
  from: State,
  to: State,
): boolean {
  return transitions[from].includes(to);
}

function advanceState<State extends string>(
  policy: string,
  transitions: Readonly<Record<State, readonly State[]>>,
  from: State,
  to: State,
): State {
  // Replaying the same durable event is a no-op, not a second transition.
  if (from === to) return from;
  if (!tableAllows(transitions, from, to)) {
    throw new ThreadHelmError('INVALID_STATE', `Illegal ${policy} transition ${from} -> ${to}`, {
      policy,
      from,
      to,
    });
  }
  return to;
}

export function canTransitionConversation(from: ConversationState, to: ConversationState): boolean {
  return tableAllows(CONVERSATION_TRANSITIONS, from, to);
}

export function advanceConversationState(
  from: ConversationState,
  to: ConversationState,
): ConversationState {
  return advanceState('conversation', CONVERSATION_TRANSITIONS, from, to);
}

export function canTransitionDelivery(from: DeliveryState, to: DeliveryState): boolean {
  return tableAllows(DELIVERY_TRANSITIONS, from, to);
}

export function advanceDeliveryState(from: DeliveryState, to: DeliveryState): DeliveryState {
  return advanceState('delivery', DELIVERY_TRANSITIONS, from, to);
}

export function canTransitionDeliveryAttempt(
  from: DeliveryAttemptState,
  to: DeliveryAttemptState,
): boolean {
  return tableAllows(DELIVERY_ATTEMPT_TRANSITIONS, from, to);
}

export function advanceDeliveryAttemptState(
  from: DeliveryAttemptState,
  to: DeliveryAttemptState,
): DeliveryAttemptState {
  return advanceState('delivery attempt', DELIVERY_ATTEMPT_TRANSITIONS, from, to);
}

export function canTransitionWorkOutcome(from: WorkOutcome, to: WorkOutcome): boolean {
  return tableAllows(WORK_OUTCOME_TRANSITIONS, from, to);
}

export function advanceWorkOutcome(from: WorkOutcome, to: WorkOutcome): WorkOutcome {
  return advanceState('work outcome', WORK_OUTCOME_TRANSITIONS, from, to);
}

export function canTransitionEscalation(from: EscalationState, to: EscalationState): boolean {
  return tableAllows(ESCALATION_TRANSITIONS, from, to);
}

export function advanceEscalationState(
  from: EscalationState,
  to: EscalationState,
): EscalationState {
  return advanceState('escalation', ESCALATION_TRANSITIONS, from, to);
}

/** Selects the one addressed session. A handoff is never a broadcast. */
export function selectExactRecipient(
  senderSessionId: string,
  recipientSessionIds: readonly string[],
): string {
  if (recipientSessionIds.length !== 1 || !recipientSessionIds[0]) {
    throw new ThreadHelmError(
      'INVALID_REQUEST',
      'A coordination handoff requires exactly one recipient session.',
      { recipientCount: recipientSessionIds.length },
    );
  }

  const recipientSessionId = recipientSessionIds[0];
  if (recipientSessionId === senderSessionId) {
    throw new ThreadHelmError(
      'COORDINATION_NOT_ELIGIBLE',
      'A coordination handoff cannot target its sender session.',
    );
  }
  return recipientSessionId;
}

/** Ensures replies never introduce a third participant into a conversation. */
export function assertConversationParticipants(
  participants: readonly [string, string],
  senderSessionId: string,
  recipientSessionId: string,
): void {
  const [first, second] = participants;
  if (
    first === second ||
    senderSessionId === recipientSessionId ||
    !participants.includes(senderSessionId) ||
    !participants.includes(recipientSessionId)
  ) {
    throw new ThreadHelmError(
      'COORDINATION_CAUSALITY_INVALID',
      'A handoff must stay between the original conversation participants.',
    );
  }
}

/** Revalidates the exact stable session identity immediately before delivery. */
export function assertDeliveryRecipient(
  reviewedRecipientSessionId: string,
  actualRecipientSessionId: string,
): void {
  if (reviewedRecipientSessionId !== actualRecipientSessionId) {
    throw new ThreadHelmError(
      'COORDINATION_TARGET_CHANGED',
      'The coordination recipient changed after review.',
    );
  }
}

/**
 * A known pre-write failure is the only attempt history that permits another
 * attempt. Active, applied, and unknown attempts all fail closed.
 */
export function canPrepareDeliveryAttempt(
  existingAttemptStates: readonly DeliveryAttemptState[],
): boolean {
  return existingAttemptStates.every((state) => state === 'failed_before_write');
}
