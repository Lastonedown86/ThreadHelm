/**
 * Interrupt (T068): Ctrl+C to the selected ConPTY, then an honest report.
 *
 * Outcome evidence: `exited` = the provider process ended inside the
 * observation window; `returned_to_interactive` = the host acknowledged the
 * write and the process is still alive; `unresponsive` = the host never
 * acknowledged delivery. Nothing is inferred from terminal text.
 */

import {
  INTERRUPT_OBSERVE_MS,
  ThreadHelmError,
  type ControlAcceptedView,
} from '@threadhelm/contracts';
import { acceptsInterrupt } from '@threadhelm/domain';
import { safeTemplate } from '@threadhelm/persistence';
import type { Context } from '../context.js';
import { requireLive, sendControl, transition } from './registry.js';

export function interruptSession(ctx: Context, sessionId: string): ControlAcceptedView {
  const live = requireLive(ctx, sessionId);
  if (!acceptsInterrupt(live.state)) {
    throw new ThreadHelmError('INVALID_STATE', 'Only a running session can be interrupted.', {
      lifecycleState: live.state,
    });
  }
  transition(ctx, live.id, {
    to: 'interrupting',
    actor: 'user',
    kind: 'interrupt_requested',
    reasonCode: 'USER_INTERRUPT',
    summary: safeTemplate('interrupt_requested', { provider: live.adapter.displayName }),
  });
  const { controlSequence, applied } = sendControl(
    ctx,
    live,
    (seq) => ({
      type: 'host.interrupt',
      sessionId: live.id,
      protocolVersion: 1,
      controlSequence: seq,
    }),
    INTERRUPT_OBSERVE_MS,
  );
  live.interrupt = { controlSequence, applied: false };

  void applied.then((ok) => {
    if (live.interrupt) live.interrupt.applied = ok;
  });
  setTimeout(() => observe(ctx, sessionId), INTERRUPT_OBSERVE_MS);

  return { sessionId: live.id, lifecycleState: live.state, controlSequence };
}

function observe(ctx: Context, sessionId: string): void {
  const live = ctx.live.get(sessionId);
  if (!live || live.state !== 'interrupting') return; // exited or otherwise resolved already
  const outcome = live.interrupt?.applied ? 'returned_to_interactive' : 'unresponsive';
  live.interrupt = null;
  transition(ctx, live.id, {
    to: 'running',
    actor: 'threadhelm',
    kind: 'state_changed',
    reasonCode: outcome === 'unresponsive' ? 'INTERRUPT_UNRESPONSIVE' : 'INTERRUPT_HANDLED',
    summary: `Interrupt observed: ${outcome}`,
  });
  ctx.events.emit('session.interruptResult', { sessionId: live.id, outcome });
}
