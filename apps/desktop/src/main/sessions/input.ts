/**
 * Input routing (T057): only the renderer's currently selected session may
 * receive bytes, and main rechecks that selection itself. Input, resize, and
 * the other controls share one serialized per-session sequence.
 */

import {
  ThreadHelmError,
  type ControlAcceptedView,
  type SelectionView,
} from '@threadhelm/contracts';
import { acceptsInput, isTerminal } from '@threadhelm/domain';
import type { Context } from '../context.js';
import { requireLive, sendControl } from './registry.js';

export function selectSession(ctx: Context, sessionId: string | null): SelectionView {
  if (sessionId !== null) requireLive(ctx, sessionId);
  ctx.selection.selectedSessionId = sessionId;
  return { selectedSessionId: sessionId };
}

export function sendInput(ctx: Context, sessionId: string, bytes: Uint8Array): ControlAcceptedView {
  const live = requireLive(ctx, sessionId);
  if (ctx.selection.selectedSessionId !== sessionId) {
    throw new ThreadHelmError('NOT_SELECTED', 'Input goes only to the selected session.', {
      sessionId,
    });
  }
  if (!acceptsInput(live.state)) {
    throw new ThreadHelmError('INPUT_BLOCKED', 'This session is not accepting input right now.', {
      lifecycleState: live.state,
    });
  }
  if (live.pendingControls.size > 64) {
    throw new ThreadHelmError('BACKPRESSURE', 'The session is still catching up on earlier input.');
  }
  const { controlSequence } = sendControl(ctx, live, (seq) => ({
    type: 'host.input',
    sessionId,
    protocolVersion: 1,
    controlSequence: seq,
    bytes,
  }));
  return { sessionId, lifecycleState: live.state, controlSequence };
}

export function resizeSession(
  ctx: Context,
  sessionId: string,
  columns: number,
  rows: number,
): ControlAcceptedView {
  const live = requireLive(ctx, sessionId);
  if (isTerminal(live.state) || live.state === 'starting') {
    throw new ThreadHelmError('INVALID_STATE', 'This session cannot be resized right now.', {
      lifecycleState: live.state,
    });
  }
  live.terminal = { columns, rows };
  ctx.health.bestEffort(() => {
    ctx.storage?.repositories.sessions.update(
      sessionId,
      { columns, rows },
      ctx.clock().toISOString(),
    );
  });
  const { controlSequence } = sendControl(ctx, live, (seq) => ({
    type: 'host.resize',
    sessionId,
    protocolVersion: 1,
    controlSequence: seq,
    columns,
    rows,
  }));
  return { sessionId, lifecycleState: live.state, controlSequence };
}
