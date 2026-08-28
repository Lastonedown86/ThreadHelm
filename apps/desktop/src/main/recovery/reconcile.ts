/**
 * Startup reconciliation (T079) and recovery resolution.
 *
 * Every session left unfinished by a previous run becomes `recovery_required`
 * with a RecoveryRecord, transactionally. No PID reattachment, no relaunch,
 * no input replay — Windows reuses PIDs and the previous scope died with its
 * Job Object handle anyway.
 */

import {
  ThreadHelmError,
  type LifecycleState,
  type RecoveryClassification,
  type RecoveryRecordView,
  type RecoveryResolution,
} from '@threadhelm/contracts';
import { safeTemplate } from '@threadhelm/persistence';
import { now, type Context } from '../context.js';
import { emitChanged, requireRecord, storageOf, transition } from '../sessions/registry.js';

export function classify(state: LifecycleState): RecoveryClassification {
  switch (state) {
    case 'starting':
      return 'interrupted_start';
    case 'stopping':
      return 'incomplete_stop';
    default:
      return 'unexpected_shutdown';
  }
}

export function createRecoveryRecord(
  ctx: Context,
  sessionId: string,
  lastKnownState: LifecycleState,
  classification: RecoveryClassification,
  reasonCode: string,
): RecoveryRecordView | null {
  let record: RecoveryRecordView | null = null;
  ctx.health.bestEffort(() => {
    const storage = storageOf(ctx);
    if (storage.repositories.recovery.findUnresolvedBySession(sessionId)) return;
    record = storage.repositories.recovery.create({
      sessionId,
      lastKnownState,
      classification,
      reasonCode,
      safeSummary: safeTemplate('reconciled', { from: lastKnownState, to: 'recovery_required' }),
      createdAt: now(ctx),
    });
  });
  if (record) ctx.events.emit('recovery.changed', record);
  return record;
}

/** Runs once after migrations, before any supervision starts. */
export function reconcileAtStartup(ctx: Context): { reconciled: number } {
  const storage = storageOf(ctx);
  const unfinished = storage.repositories.sessions.listUnfinished();
  const at = now(ctx);
  storage.repositories.transaction(() => {
    for (const session of unfinished) {
      storage.repositories.sessions.update(
        session.id,
        { lifecycleState: 'recovery_required', endedAt: at },
        at,
      );
      storage.repositories.events.append(session.id, {
        kind: 'reconciled',
        fromState: session.lifecycleState,
        toState: 'recovery_required',
        actor: 'threadhelm',
        reasonCode: 'STARTUP_RECONCILIATION',
        safeSummary: safeTemplate('reconciled', {
          from: session.lifecycleState,
          to: 'recovery_required',
        }),
        occurredAt: at,
      });
      if (!storage.repositories.recovery.findUnresolvedBySession(session.id)) {
        storage.repositories.recovery.create({
          sessionId: session.id,
          lastKnownState: session.lifecycleState,
          classification: classify(session.lifecycleState),
          reasonCode: 'STARTUP_RECONCILIATION',
          safeSummary: safeTemplate('reconciled', {
            from: session.lifecycleState,
            to: 'recovery_required',
          }),
          createdAt: at,
        });
      }
    }
  });
  ctx.log.info('recovery.reconciled', { count: unfinished.length });
  return { reconciled: unfinished.length };
}

export function resolveRecovery(
  ctx: Context,
  recordId: string,
  resolution: RecoveryResolution,
): RecoveryRecordView {
  const storage = storageOf(ctx);
  const record = storage.repositories.recovery.findById(recordId);
  if (!record) throw new ThreadHelmError('RECORD_NOT_FOUND', 'Recovery record not found.');
  const session = requireRecord(ctx, record.sessionId);
  ctx.health.assertWritable();
  const resolved = ctx.health.required(() =>
    storage.repositories.transaction(() => {
      const updated = storage.repositories.recovery.resolve(recordId, resolution, now(ctx));
      if (session.lifecycleState === 'recovery_required') {
        transition(ctx, session.id, {
          to: 'stopped',
          actor: 'user',
          kind: 'recovery_resolved',
          reasonCode: resolution === 'dismissed' ? 'RECOVERY_DISMISSED' : 'RECOVERY_SUPERSEDED',
          summary: safeTemplate('recovery_resolved', { resolution }),
          patch: { endedAt: session.endedAt ?? now(ctx) },
          required: true,
        });
      }
      return updated;
    }),
  );
  ctx.events.emit('recovery.changed', resolved);
  emitChanged(ctx, session.id, 'RECOVERY_RESOLVED');
  return resolved;
}
