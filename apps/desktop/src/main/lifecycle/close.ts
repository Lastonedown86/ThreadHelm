/**
 * Application close (T073, FR-026).
 *
 * With active sessions, close is blocked: the user sees every affected session
 * and chooses either to cancel or to stop all through the safe-stop flow.
 * Unresponsive sessions are never force-stopped here — force stop stays an
 * explicit, separately confirmed action.
 */

import type { CloseResultView, SessionView } from '@threadhelm/contracts';
import { acceptsStop, isTerminal } from '@threadhelm/domain';
import { safeTemplate } from '@threadhelm/persistence';
import type { Context } from '../context.js';
import { sendControl, sessionView, transition } from '../sessions/registry.js';

export function activeSessions(ctx: Context): SessionView[] {
  return [...ctx.live.values()]
    .filter((live) => !isTerminal(live.state))
    .map((live) => sessionView(ctx, live.id));
}

export function requestClose(ctx: Context): CloseResultView {
  const active = activeSessions(ctx);
  if (active.length === 0) {
    ctx.quit();
    return { closing: true, activeSessions: [] };
  }
  const result = { closing: false, activeSessions: active };
  ctx.events.emit('application.closeBlocked', result);
  return result;
}

let closing = false;

/** Clean-stops every active session, then quits once all have ended. */
export function stopAllAndClose(ctx: Context): CloseResultView {
  closing = true;
  for (const live of ctx.live.values()) {
    if (!acceptsStop(live.state)) continue;
    const action = live.adapter.buildCleanStop({ sessionId: live.id });
    transition(ctx, live.id, {
      to: 'stopping',
      actor: 'user',
      kind: 'stop_requested',
      reasonCode: 'USER_STOP_ALL',
      summary: safeTemplate('stop_requested', { provider: live.adapter.displayName }),
    });
    const { controlSequence } = sendControl(ctx, live, (seq) => ({
      type: 'host.cleanStop',
      sessionId: live.id,
      protocolVersion: 1,
      controlSequence: seq,
      action,
    }));
    live.stop = { controlSequence, timedOut: false };
  }
  maybeQuit(ctx);
  return { closing: true, activeSessions: activeSessions(ctx) };
}

/** Called whenever a session ends; quits if a stop-all is pending. */
export function maybeQuit(ctx: Context): void {
  if (!closing) return;
  if (activeSessions(ctx).length === 0) {
    closing = false;
    ctx.quit();
  }
}

export function cancelClose(): void {
  closing = false;
}
