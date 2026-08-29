/**
 * Routes validated host → main messages to the owning session's handlers.
 * A message for another session, or one that fails the schema, terminates
 * that host only.
 */

import { HostToMainMessage } from '@threadhelm/contracts';
import type { Context, LiveSession } from '../context.js';
import { failSession, onHostProcessExit } from './failure.js';
import { onCleanStopTimeout, onProviderExit } from './stop.js';
import { onOutputTruncated } from './stream.js';

export interface LaunchWaiters {
  ready: (message: Extract<HostToMainMessage, { type: 'host.ready' }>) => void;
  launched: (message: Extract<HostToMainMessage, { type: 'host.launched' }>) => void;
  failure: (message: Extract<HostToMainMessage, { type: 'host.failure' }>) => void;
}

export function attachHost(ctx: Context, live: LiveSession, waiters: LaunchWaiters): void {
  live.host.onMessage((raw) => {
    const parsed = HostToMainMessage.safeParse(raw);
    if (!parsed.success) {
      ctx.log.warn('host.invalid_message', { sessionId: live.id });
      failSession(ctx, live, 'HOST_PROTOCOL_VIOLATION');
      return;
    }
    const message = parsed.data;
    if (message.sessionId !== live.id) {
      ctx.log.warn('host.session_mismatch', { sessionId: live.id });
      failSession(ctx, live, 'HOST_IDENTITY_MISMATCH');
      return;
    }
    switch (message.type) {
      case 'host.ready':
        waiters.ready(message);
        return;
      case 'host.launched':
        waiters.launched(message);
        return;
      case 'host.controlApplied': {
        const resolve = live.pendingControls.get(message.controlSequence);
        live.pendingControls.delete(message.controlSequence);
        resolve?.(true);
        return;
      }
      case 'host.outputTruncated':
        onOutputTruncated(ctx, live, message.truncationCount);
        return;
      case 'host.cleanStopTimeout':
        onCleanStopTimeout(ctx, live);
        return;
      case 'host.exit':
        void onProviderExit(ctx, live, message.exitCode);
        return;
      case 'host.failure':
        ctx.log.warn('host.failure', { sessionId: live.id, code: message.code });
        if (message.code === 'INPUT_REJECTED') return; // non-fatal: input after stop
        if (live.state === 'starting') {
          waiters.failure(message);
          return;
        }
        failSession(ctx, live, message.code);
        return;
    }
  });
  live.host.onExit((code) => onHostProcessExit(ctx, live, code));
}
