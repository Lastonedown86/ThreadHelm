/**
 * Per-session MessagePort transport (T054).
 *
 * Main creates the channel at launch: one end goes to the host with the
 * launch descriptor, the other is held until the renderer subscribes and is
 * then transferred once. Frames never pass through main; only the sanitized
 * truncation count does, so it can be persisted and disclosed.
 */

import { ThreadHelmError } from '@threadhelm/contracts';
import { safeTemplate } from '@threadhelm/persistence';
import { now, type Context, type LiveSession } from '../context.js';
import { recordEvent, requireLive } from './registry.js';

export function subscribeOutput(ctx: Context, sessionId: string): boolean {
  const live = requireLive(ctx, sessionId);
  if (!live.rendererPort) {
    // Already transferred (or torn down): the renderer keeps the port it has.
    throw new ThreadHelmError('INVALID_STATE', 'This session output stream was already delivered.');
  }
  const port = live.rendererPort;
  live.rendererPort = null;
  ctx.events.transferStreamPort(sessionId, port);
  ctx.log.info('stream.port_transferred', { sessionId });
  return true;
}

export function onOutputTruncated(ctx: Context, live: LiveSession, truncationCount: number): void {
  ctx.health.bestEffort(() => {
    ctx.storage?.repositories.sessions.update(live.id, { truncationCount }, now(ctx));
  });
  recordEvent(ctx, live.id, {
    kind: 'output_truncated',
    actor: 'threadhelm',
    reasonCode: 'BACKPRESSURE_DISCARD',
    summary: safeTemplate('output_truncated', { count: truncationCount }),
  });
  ctx.events.emit('session.outputTruncated', { sessionId: live.id, truncationCount });
}
