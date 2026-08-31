/**
 * Bounded scrollback and truncation disclosure (T056). xterm enforces the
 * 10,000-line cap itself; this module only tracks what to disclose. No
 * terminal bytes are ever stored here.
 */

import { SCROLLBACK_LINES } from '@threadhelm/contracts/limits';

export const scrollbackLimit = SCROLLBACK_LINES;

export type TruncationState = Readonly<Record<string, number>>;

export function recordTruncation(
  state: TruncationState,
  sessionId: string,
  truncationCount: number,
): TruncationState {
  const current = state[sessionId] ?? 0;
  if (truncationCount <= current) return state;
  return { ...state, [sessionId]: truncationCount };
}

export function describeTruncation(truncationCount: number): string {
  if (truncationCount <= 0) return '';
  const times = truncationCount === 1 ? 'once' : `${truncationCount} times`;
  return `Output was discarded ${times} under pressure; the most recent output is complete.`;
}

export function describeScrollback(): string {
  return `Scrollback is limited to ${scrollbackLimit.toLocaleString()} lines per session.`;
}
