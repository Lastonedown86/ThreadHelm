/**
 * Suspend / resume / lock / unlock reconciliation (T081).
 *
 * After any of these, every live session is rechecked against its Job
 * Object: a scope that is gone becomes failed/recovery-required, activity
 * returns to unknown, and nothing is restarted or replayed.
 */

import type { PowerEvent } from '@threadhelm/contracts';
import { isTerminal } from '@threadhelm/domain';
import type { Context } from '../context.js';
import { resetActivity } from '../sessions/activity.js';
import { failSession } from '../sessions/failure.js';
import { inspectScope } from '../sessions/process-scope.js';
import { invalidateAutomaticPresentationEvidence } from '../coordination/recovery.js';

export interface PowerSource {
  on(event: 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen', listener: () => void): unknown;
}

const MAP: Record<'suspend' | 'resume' | 'lock-screen' | 'unlock-screen', PowerEvent> = {
  suspend: 'suspend',
  resume: 'resume',
  'lock-screen': 'lock',
  'unlock-screen': 'unlock',
};

export function reconcileLiveSessions(ctx: Context, event: PowerEvent): void {
  ctx.supervisor?.onPowerBoundary();
  let reconciled = 0;
  let recoveryRequired = 0;
  for (const live of [...ctx.live.values()]) {
    if (isTerminal(live.state)) continue;
    reconciled += 1;
    invalidateAutomaticPresentationEvidence(ctx, live.id);
    resetActivity(ctx, live.id);
    const scope = inspectScope(ctx, live);
    if (!scope.hostAlive) {
      failSession(ctx, live, 'OBSERVATION_LOST_AFTER_POWER_EVENT');
      if (!ctx.live.has(live.id)) recoveryRequired += 1;
    }
  }
  ctx.log.info('power.reconciled', { powerEvent: event, reconciled, recoveryRequired });
  ctx.events.emit('application.powerChanged', { event, reconciled, recoveryRequired });
}

export function attachPowerEvents(ctx: Context, source: PowerSource): void {
  for (const name of Object.keys(MAP) as (keyof typeof MAP)[]) {
    source.on(name, () => reconcileLiveSessions(ctx, MAP[name]));
  }
}
