/**
 * Activity state (T059): derived only from structured adapter evidence and
 * reported as `unknown` whenever that evidence is absent, stale, or the
 * adapter does not support it. Terminal text, silence, timers, and CPU are
 * never consulted.
 */

import type { ActivityEvidence } from '@threadhelm/contracts';
import { deriveActivity } from '@threadhelm/domain';
import { now, type Context } from '../context.js';

const MAX_EVIDENCE_AGE_MS = 60_000;

export function applyActivity(
  ctx: Context,
  sessionId: string,
  evidence: ActivityEvidence | null,
): void {
  const live = ctx.live.get(sessionId);
  if (!live) return;
  const derived = deriveActivity(evidence, {
    adapterSupportsStructuredActivity: live.adapter.capabilities.structuredActivity,
    now: ctx.clock(),
    maxEvidenceAgeMs: MAX_EVIDENCE_AGE_MS,
  });
  ctx.health.bestEffort(() => {
    ctx.storage?.repositories.sessions.update(
      sessionId,
      {
        activityState: derived.activityState,
        activityEvidenceKind: derived.activityEvidenceKind,
        activityObservedAt: derived.activityObservedAt,
      },
      now(ctx),
    );
  });
  ctx.events.emit('session.activityChanged', {
    sessionId,
    activityState: derived.activityState,
    evidenceKind: derived.activityEvidenceKind,
    observedAt: derived.activityObservedAt,
  });
}

/** Any doubt resets to unknown — e.g. after suspend/resume. */
export function resetActivity(ctx: Context, sessionId: string): void {
  applyActivity(ctx, sessionId, null);
}
