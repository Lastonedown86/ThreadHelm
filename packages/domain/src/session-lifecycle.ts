/**
 * Session lifecycle state machine (T015), data-model.md "Lifecycle state".
 *
 * Nothing transitions INTO `starting`: that state exists only for a brand-new
 * session persisted before any OS process is created. `stopped` and `failed`
 * are terminal; a retry is a new session identity.
 */

import { ThreadHelmError, type LifecycleState } from '@threadhelm/contracts';

export const LEGAL_TRANSITIONS: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = {
  starting: ['running', 'failed', 'recovery_required'],
  running: ['interrupting', 'stopping', 'stopped', 'failed', 'recovery_required'],
  interrupting: ['running', 'stopped', 'failed', 'recovery_required'],
  stopping: ['stopped', 'failed', 'recovery_required'],
  stopped: [],
  failed: [],
  recovery_required: ['stopped'],
};

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: LifecycleState, to: LifecycleState): void {
  if (!canTransition(from, to)) {
    throw new ThreadHelmError('INVALID_STATE', `Illegal transition ${from} -> ${to}`, { from, to });
  }
}

export function isTerminal(state: LifecycleState): boolean {
  return state === 'stopped' || state === 'failed';
}

/** States that become `recovery_required` on startup reconciliation. */
export function isUnfinished(state: LifecycleState): boolean {
  return canTransition(state, 'recovery_required');
}

export function acceptsInput(state: LifecycleState): boolean {
  return state === 'running';
}

export function acceptsInterrupt(state: LifecycleState): boolean {
  return state === 'running';
}

export function acceptsStop(state: LifecycleState): boolean {
  return state === 'running' || state === 'interrupting';
}

export function acceptsForceStop(state: LifecycleState): boolean {
  return state === 'running' || state === 'interrupting' || state === 'stopping';
}
