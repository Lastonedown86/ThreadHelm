/**
 * Force stop (T070): separately confirmed, `TerminateJobObject`, then verify
 * the scope is empty. Conflicting evidence yields `recovery_required`, not
 * `stopped`.
 */

import {
  FORCE_STOP_RISK,
  ThreadHelmError,
  type ControlAcceptedView,
  type ForceStopDisclosureView,
} from '@threadhelm/contracts';
import { acceptsForceStop } from '@threadhelm/domain';
import { safeTemplate } from '@threadhelm/persistence';
import type { Context } from '../context.js';
import { finalizeSession, markObservationLost } from './failure.js';
import { inspectScope } from './process-scope.js';
import { recordEvent, requireLive, sessionView } from './registry.js';

export function requestForceStop(ctx: Context, sessionId: string): ForceStopDisclosureView {
  const live = requireLive(ctx, sessionId);
  if (!acceptsForceStop(live.state)) {
    throw new ThreadHelmError(
      'FORCE_NOT_AVAILABLE',
      'Force stop is not available for this session.',
      {
        lifecycleState: live.state,
      },
    );
  }
  const view = sessionView(ctx, sessionId);
  const scope = inspectScope(ctx, live);
  const { token, expiresAt } = ctx.tokens.forces.issue({ sessionId, lifecycleState: live.state });
  return {
    action: 'force_stop',
    forceToken: token,
    sessionId,
    providerDisplayName: view.providerDisplayName,
    workspaceDisplayPath: view.workspaceDisplayPath,
    risk: FORCE_STOP_RISK,
    processCount: scope.residual,
    expiresAt,
  };
}

export function confirmForceStop(ctx: Context, forceToken: string): ControlAcceptedView {
  const bound = ctx.tokens.forces.take(forceToken);
  if (!bound) {
    throw new ThreadHelmError('CONFIRMATION_EXPIRED', 'The force-stop confirmation expired.');
  }
  const live = ctx.live.get(bound.sessionId);
  if (!live || live.state !== bound.lifecycleState || !acceptsForceStop(live.state)) {
    throw new ThreadHelmError(
      'TARGET_CHANGED',
      'The session changed before force stop was confirmed.',
      {
        sessionId: bound.sessionId,
      },
    );
  }
  recordEvent(ctx, live.id, {
    kind: 'force_stop_requested',
    actor: 'user',
    reasonCode: 'USER_FORCE_STOP',
    summary: safeTemplate('force_stop_requested', { provider: live.adapter.displayName }),
  });
  const controlSequence = ++live.controlSequence;

  let empty = true;
  try {
    ctx.native.terminateJob(live.jobToken, 1);
  } catch (error) {
    empty = !(error instanceof Error && error.message.startsWith('JOB_NOT_EMPTY'));
    if (empty) ctx.log.warn('force_stop.terminate_error', { sessionId: live.id });
  }
  if (!empty) {
    markObservationLost(ctx, live, 'FORCE_STOP_INCOMPLETE');
    return { sessionId: live.id, lifecycleState: 'recovery_required', controlSequence };
  }
  finalizeSession(ctx, live, {
    to: 'stopped',
    stopKind: 'forced',
    exitCode: live.exit?.exitCode ?? null,
    reasonCode: 'USER_FORCE_STOP',
    summary: safeTemplate('state_changed', { from: bound.lifecycleState, to: 'stopped' }),
    actor: 'user',
  });
  return { sessionId: live.id, lifecycleState: 'stopped', controlSequence };
}
