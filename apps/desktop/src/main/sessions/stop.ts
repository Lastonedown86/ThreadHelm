/**
 * Clean stop (T069) and provider-exit handling.
 *
 * Stop: block new input, ask the adapter's graceful exit, drain output, wait a
 * bounded grace period. If the scope does not empty, the session stays in
 * `stopping` with force stop offered — it is never reported stopped on hope.
 */

import {
  STOP_GRACE_MS,
  ThreadHelmError,
  type ControlAcceptedView,
  type StopDisclosureView,
} from '@threadhelm/contracts';
import { acceptsStop } from '@threadhelm/domain';
import { safeTemplate } from '@threadhelm/persistence';
import type { Context, LiveSession } from '../context.js';
import { finalizeSession, failSession } from './failure.js';
import { reportResidual, waitForScopeEmpty } from './process-scope.js';
import { emitChanged, requireLive, sendControl, sessionView, transition } from './registry.js';

export function requestStop(ctx: Context, sessionId: string): StopDisclosureView {
  const live = requireLive(ctx, sessionId);
  if (!acceptsStop(live.state)) {
    throw new ThreadHelmError(
      'INVALID_STATE',
      'This session cannot be stopped from its current state.',
      {
        lifecycleState: live.state,
      },
    );
  }
  const view = sessionView(ctx, sessionId);
  const { token, expiresAt } = ctx.tokens.stops.issue({ sessionId, lifecycleState: live.state });
  return {
    action: 'stop',
    stopToken: token,
    sessionId,
    providerDisplayName: view.providerDisplayName,
    workspaceDisplayPath: view.workspaceDisplayPath,
    graceMs: STOP_GRACE_MS,
    expiresAt,
  };
}

export function confirmStop(ctx: Context, stopToken: string): ControlAcceptedView {
  const bound = ctx.tokens.stops.take(stopToken);
  if (!bound) throw new ThreadHelmError('CONFIRMATION_EXPIRED', 'The stop confirmation expired.');
  const live = ctx.live.get(bound.sessionId);
  if (!live || live.state !== bound.lifecycleState || !acceptsStop(live.state)) {
    throw new ThreadHelmError(
      'TARGET_CHANGED',
      'The session changed before the stop was confirmed.',
      {
        sessionId: bound.sessionId,
      },
    );
  }
  const action = live.adapter.buildCleanStop({ sessionId: live.id });
  const graceMs = Math.min(action.graceMs, STOP_GRACE_MS);
  transition(ctx, live.id, {
    to: 'stopping',
    actor: 'user',
    kind: 'stop_requested',
    reasonCode: 'USER_STOP',
    summary: safeTemplate('stop_requested', { provider: live.adapter.displayName }),
  });
  const { controlSequence } = sendControl(ctx, live, (seq) => ({
    type: 'host.cleanStop',
    sessionId: live.id,
    protocolVersion: 1,
    controlSequence: seq,
    action: { ...action, graceMs },
  }));
  live.stop = { controlSequence, timedOut: false };
  return { sessionId: live.id, lifecycleState: live.state, controlSequence };
}

/** Host reports the grace period elapsed without provider exit. */
export function onCleanStopTimeout(ctx: Context, live: LiveSession): void {
  if (live.state !== 'stopping') return;
  live.forceStopAvailable = true;
  if (live.stop) live.stop.timedOut = true;
  ctx.log.info('session.clean_stop_timeout', { sessionId: live.id });
  emitChanged(ctx, live.id, 'CLEAN_STOP_TIMEOUT');
}

/** The provider process exited (any reason). */
export async function onProviderExit(
  ctx: Context,
  live: LiveSession,
  exitCode: number | null,
): Promise<void> {
  live.exit = { exitCode };
  const stateAtExit = live.state;
  ctx.log.info('provider.exited', { sessionId: live.id, exitCode, state: stateAtExit });

  if (stateAtExit === 'starting') {
    failSession(ctx, live, 'PROVIDER_EXITED_DURING_START');
    return;
  }
  if (
    stateAtExit === 'stopped' ||
    stateAtExit === 'failed' ||
    stateAtExit === 'recovery_required'
  ) {
    return;
  }

  // The host has nothing left to do; its exit also closes the pseudoconsole,
  // whose conhost helper lives inside the job. Then the whole scope must be
  // empty — descendants may outlive the root briefly, so wait a bounded moment.
  try {
    live.host.postMessage({ type: 'host.shutdown', sessionId: live.id, protocolVersion: 1 });
  } catch {
    /* host already gone */
  }
  const scope = await waitForScopeEmpty(ctx, live, 5_000, true);
  if (!ctx.live.has(live.id)) return;
  if (scope.residual > 0) {
    reportResidual(ctx, live, scope);
    if (live.state !== 'stopping') {
      transition(ctx, live.id, {
        to: 'stopping',
        actor: 'threadhelm',
        kind: 'state_changed',
        reasonCode: 'RESIDUAL_PROCESSES',
        summary: safeTemplate('provider_exited', {
          provider: live.adapter.displayName,
          exitCode: exitCode ?? 'unknown',
        }),
      });
    }
    live.forceStopAvailable = true;
    emitChanged(ctx, live.id, 'RESIDUAL_PROCESSES');
    return;
  }

  const summary = safeTemplate('provider_exited', {
    provider: live.adapter.displayName,
    exitCode: exitCode ?? 'unknown',
  });
  if (stateAtExit === 'stopping') {
    finalizeSession(ctx, live, {
      to: 'stopped',
      stopKind: 'clean',
      exitCode,
      reasonCode: 'CLEAN_STOP',
      summary,
      actor: 'provider',
    });
  } else if (stateAtExit === 'interrupting') {
    finalizeSession(ctx, live, {
      to: 'stopped',
      stopKind: 'interrupted_exit',
      exitCode,
      reasonCode: 'INTERRUPT_EXIT',
      summary,
      actor: 'provider',
    });
    ctx.events.emit('session.interruptResult', { sessionId: live.id, outcome: 'exited' });
  } else if (exitCode === 0) {
    finalizeSession(ctx, live, {
      to: 'stopped',
      stopKind: 'clean',
      exitCode,
      reasonCode: 'PROVIDER_EXIT',
      summary,
      actor: 'provider',
    });
  } else {
    finalizeSession(ctx, live, {
      to: 'failed',
      stopKind: null,
      exitCode,
      reasonCode: 'PROVIDER_EXIT_NONZERO',
      summary,
      actor: 'provider',
    });
  }
}
