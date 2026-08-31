/** Startup-only fail-closed reconciliation for externally uncertain delivery attempts. */

import { ThreadHelmError } from '@threadhelm/contracts';
import type { Context } from '../context.js';

export interface CoordinationRecoveryResult {
  recoveredUnknown: number;
}

/**
 * A runtime boundary invalidates only the named session's volatile lifecycle
 * proof. It never launches, resumes, replays, resends, or mutates another
 * session or durable handoff.
 */
export function invalidateAutomaticPresentationEvidence(ctx: Context, sessionId: string): void {
  ctx.coordinationBridge?.invalidateLifecycleEvidence(sessionId);
}

export function reconcileCoordinationAtStartup(ctx: Context): CoordinationRecoveryResult {
  if (!ctx.storage || ctx.health.degraded) return { recoveredUnknown: 0 };
  ctx.storage.repositories.supervisor.recover(ctx.clock().toISOString());
  const repository = ctx.storage.repositories.coordination;
  let recoveredUnknown = 0;
  for (const attempt of repository.listInFlightAttempts()) {
    try {
      repository.markAttemptUnknown(
        attempt.id,
        'STARTUP_DELIVERY_UNCERTAIN',
        ctx.clock().toISOString(),
      );
      recoveredUnknown += 1;
    } catch (error) {
      ctx.log.error('coordination.recovery_failed', {
        attemptId: attempt.id,
        code: error instanceof ThreadHelmError ? error.code : 'INTERNAL',
      });
      throw error;
    }
  }
  if (recoveredUnknown > 0) {
    ctx.log.warn('coordination.recovered_unknown', { count: recoveredUnknown });
  }
  return { recoveredUnknown };
}
