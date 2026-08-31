/**
 * Per-session failure isolation and terminal cleanup (T062).
 *
 * A PTY/native/host failure ends exactly one session. Cleanup order: make sure
 * the scope is dead (terminate job), record the terminal state atomically with
 * its event, release the one-writer lease, close the Job Object handle, and
 * drop the live record. Nothing here touches another session.
 */

import { ThreadHelmError, type LifecycleState, type StopKind } from '@threadhelm/contracts';
import { isTerminal } from '@threadhelm/domain';
import { safeTemplate } from '@threadhelm/persistence';
import { now, type Context, type LiveSession } from '../context.js';
import { maybeQuit } from '../lifecycle/close.js';
import { createRecoveryRecord } from '../recovery/reconcile.js';
import { releaseLease } from './lease.js';
import { inspectScope } from './process-scope.js';
import { transition } from './registry.js';

export interface FinalizeInput {
  to: 'stopped' | 'failed';
  stopKind: StopKind | null;
  exitCode: number | null;
  reasonCode: string | null;
  summary: string;
  actor: 'user' | 'threadhelm' | 'provider' | 'windows';
}

function teardown(ctx: Context, live: LiveSession): void {
  const cleanup = (action: () => void) => {
    try {
      action();
    } catch {
      // A disconnected event sink or another cleanup callback cannot strand
      // the remaining native handles, local lease, or live-session mirror.
      try {
        ctx.log.warn('session.cleanup_failed', {
          sessionId: live.id,
          reasonCode: 'SESSION_CLEANUP_FAILED',
        });
      } catch {
        /* Logging is also best effort during teardown. */
      }
    }
  };
  cleanup(() => ctx.coordinationBridge?.revoke(live.id));
  try {
    live.host.postMessage({ type: 'host.shutdown', sessionId: live.id, protocolVersion: 1 });
  } catch {
    /* host already gone */
  }
  if (live.rendererPort) {
    try {
      live.rendererPort.close();
    } catch {
      /* never transferred; nothing to close */
    }
    live.rendererPort = null;
  }
  // Ending the session abandons outstanding controls. Only a matching
  // host.controlApplied message may resolve a waiter as applied.
  for (const resolve of live.pendingControls.values()) cleanup(() => resolve(false));
  live.pendingControls.clear();
  cleanup(() => ctx.jobs.close(live.id));
  cleanup(() => releaseLease(ctx, live.id));
  ctx.live.delete(live.id);
  cleanup(() => ctx.supervisor?.onSessionEnded(live.id, 'WORKER_SESSION_ENDED'));
  if (ctx.selection.selectedSessionId === live.id) ctx.selection.selectedSessionId = null;
  cleanup(() => maybeQuit(ctx));
}

/** Terminal state requires an observed-empty scope (invariant 6). */
export function finalizeSession(ctx: Context, live: LiveSession, input: FinalizeInput): void {
  if (isTerminal(live.state)) return;
  try {
    transition(ctx, live.id, {
      to: input.to,
      actor: input.actor,
      kind: 'state_changed',
      reasonCode: input.reasonCode,
      summary: input.summary,
      patch: { endedAt: now(ctx), exitCode: input.exitCode, stopKind: input.stopKind },
    });
  } finally {
    // Native cleanup must not depend on renderer event delivery succeeding.
    teardown(ctx, live);
  }
}

/** Kills the scope and records a failed session; other sessions are untouched. */
export function failSession(ctx: Context, live: LiveSession, reasonCode: string): void {
  if (isTerminal(live.state)) return;
  ctx.log.warn('session.failed', { sessionId: live.id, reasonCode });
  let empty = true;
  try {
    ctx.native.terminateJob(live.jobToken, 1);
  } catch (error) {
    empty = !(error instanceof Error && error.message.startsWith('JOB_NOT_EMPTY'));
  }
  if (!empty) {
    markObservationLost(ctx, live, reasonCode);
    return;
  }
  finalizeSession(ctx, live, {
    to: 'failed',
    stopKind: 'crash_cleanup',
    exitCode: live.exit?.exitCode ?? null,
    reasonCode,
    summary: safeTemplate('session_failed', { reason: reasonCode }),
    actor: 'threadhelm',
  });
}

/**
 * Evidence conflicts (a scope that would not die): be honest, require
 * recovery, and surface survivors instead of claiming a clean end.
 */
export function markObservationLost(ctx: Context, live: LiveSession, reasonCode: string): void {
  const lastKnown: LifecycleState = live.state;
  const scope = inspectScope(ctx, live);
  transition(ctx, live.id, {
    to: 'recovery_required',
    actor: 'threadhelm',
    kind: 'state_changed',
    reasonCode,
    summary: `Processes still alive after stop: ${scope.residual}`,
    patch: { endedAt: now(ctx), exitCode: live.exit?.exitCode ?? null },
  });
  createRecoveryRecord(ctx, live.id, lastKnown, 'incomplete_stop', reasonCode);
  teardown(ctx, live);
}

/** The utility process itself exited. */
export function onHostProcessExit(ctx: Context, live: LiveSession, code: number): void {
  if (!ctx.live.has(live.id) || isTerminal(live.state)) return;
  // Expected: the provider already exited and main asked the host to shut down.
  if (live.exit) return;
  ctx.log.warn('host.exited', { sessionId: live.id, code });
  failSession(ctx, live, 'HOST_EXITED');
}

export function assertLive(ctx: Context, sessionId: string): LiveSession {
  const live = ctx.live.get(sessionId);
  if (!live) throw new ThreadHelmError('SESSION_NOT_FOUND', 'That session is not running.');
  return live;
}
