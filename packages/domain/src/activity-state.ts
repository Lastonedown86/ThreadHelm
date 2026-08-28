/**
 * Activity state (T016), data-model.md "Activity state".
 *
 * Activity is orthogonal to lifecycle and honest by default: `unknown` unless
 * a version-compatible adapter supplied fresh structured evidence. Terminal
 * text, quiet timers, CPU, and process existence are never evidence.
 */

import type { ActivityEvidence, ActivityState } from '@threadhelm/contracts';

export interface ActivityContext {
  adapterSupportsStructuredActivity: boolean;
  now: Date;
  maxEvidenceAgeMs: number;
}

export interface DerivedActivity {
  activityState: ActivityState;
  activityEvidenceKind: string;
  activityObservedAt: string | null;
}

const UNKNOWN: DerivedActivity = {
  activityState: 'unknown',
  activityEvidenceKind: 'none',
  activityObservedAt: null,
};

export function deriveActivity(
  evidence: ActivityEvidence | null,
  ctx: ActivityContext,
): DerivedActivity {
  if (!ctx.adapterSupportsStructuredActivity || !evidence || !evidence.evidenceKind) {
    return UNKNOWN;
  }
  const observed = Date.parse(evidence.observedAt);
  if (Number.isNaN(observed) || ctx.now.getTime() - observed > ctx.maxEvidenceAgeMs) {
    return UNKNOWN;
  }
  return {
    activityState: evidence.state,
    activityEvidenceKind: evidence.evidenceKind,
    activityObservedAt: evidence.observedAt,
  };
}
