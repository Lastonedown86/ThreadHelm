/**
 * Deterministic coordination fixtures shared by unit, contract, and Windows
 * tests. These values model identity and content-free evidence only; message
 * bodies deliberately do not appear in this module.
 */

import type { CoordinationEventKind, ProviderId } from '@threadhelm/contracts';

export interface CoordinationParticipantFixture {
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly workspaceDisplayPath: string;
  readonly providerId: ProviderId;
}

export interface CoordinationEventFixture {
  readonly id: string;
  readonly conversationId: string;
  readonly handoffId: string | null;
  readonly sequence: number;
  readonly kind: CoordinationEventKind;
  readonly actor: 'user' | 'threadhelm' | 'provider';
  readonly reasonCode: string | null;
  readonly safeSummary: string;
  readonly occurredAt: string;
}

const uuid = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

/** Stable IDs for the two-participant directed-handoff scenarios. */
export const COORDINATION_FIXTURE_IDS = Object.freeze({
  senderSession: uuid(1),
  recipientSession: uuid(2),
  senderWorkspace: uuid(11),
  recipientWorkspace: uuid(12),
  conversation: uuid(21),
  handoff: uuid(22),
});

export const COORDINATION_PARTICIPANTS: readonly CoordinationParticipantFixture[] = Object.freeze([
  Object.freeze({
    sessionId: COORDINATION_FIXTURE_IDS.senderSession,
    workspaceId: COORDINATION_FIXTURE_IDS.senderWorkspace,
    workspaceDisplayPath: 'C:\\ThreadHelm Fixture\\sender',
    providerId: 'codex-cli' as const,
  }),
  Object.freeze({
    sessionId: COORDINATION_FIXTURE_IDS.recipientSession,
    workspaceId: COORDINATION_FIXTURE_IDS.recipientWorkspace,
    workspaceDisplayPath: 'C:\\ThreadHelm Fixture\\recipient',
    providerId: 'claude-code' as const,
  }),
]);

/** A clock whose output is stable until explicitly advanced by the test. */
export function createCoordinationClock(start = '2026-01-01T00:00:00.000Z') {
  let current = Date.parse(start);
  if (!Number.isFinite(current)) throw new Error('invalid fixture clock start');
  return {
    now: () => new Date(current),
    iso: () => new Date(current).toISOString(),
    advance: (milliseconds: number) => {
      if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
        throw new Error('fixture clock advance must be a non-negative integer');
      }
      current += milliseconds;
      return new Date(current);
    },
  };
}

/** Creates valid, repeatable UUIDs without consulting process randomness. */
export function createCoordinationUuidFactory(start = 100) {
  let next = start;
  return () => {
    if (!Number.isSafeInteger(next) || next < 0 || next > 0xffffffffffff) {
      throw new Error('fixture UUID sequence exhausted');
    }
    return uuid(next++);
  };
}

/** Creates content-free lifecycle evidence for assertions and event fan-out. */
export function coordinationEventFixture(
  overrides: Partial<CoordinationEventFixture> = {},
): CoordinationEventFixture {
  return {
    id: COORDINATION_FIXTURE_IDS.handoff,
    conversationId: COORDINATION_FIXTURE_IDS.conversation,
    handoffId: COORDINATION_FIXTURE_IDS.handoff,
    sequence: 1,
    kind: 'created',
    actor: 'threadhelm',
    reasonCode: null,
    safeSummary: 'Handoff created',
    occurredAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
