import type { ActivityEvidence } from '@threadhelm/contracts';
import { deriveActivity } from '@threadhelm/domain';
import { describe, expect, it } from 'vitest';

const now = new Date('2026-08-28T12:00:00.000Z');
const ctx = { adapterSupportsStructuredActivity: true, now, maxEvidenceAgeMs: 60_000 };
const fresh: ActivityEvidence = {
  state: 'working',
  evidenceKind: 'codex.app-server.turn',
  observedAt: '2026-08-28T11:59:30.000Z',
};
const UNKNOWN = {
  activityState: 'unknown',
  activityEvidenceKind: 'none',
  activityObservedAt: null,
};

describe('deriveActivity', () => {
  it('is unknown by default', () => {
    expect(deriveActivity(null, ctx)).toEqual(UNKNOWN);
  });

  it('is unknown when the adapter has no structured activity support', () => {
    expect(deriveActivity(fresh, { ...ctx, adapterSupportsStructuredActivity: false })).toEqual(
      UNKNOWN,
    );
  });

  it('is unknown when evidence is stale', () => {
    expect(deriveActivity({ ...fresh, observedAt: '2026-08-28T11:00:00.000Z' }, ctx)).toEqual(
      UNKNOWN,
    );
  });

  it('is unknown when evidence has an unparseable timestamp', () => {
    expect(deriveActivity({ ...fresh, observedAt: 'not-a-date' }, ctx)).toEqual(UNKNOWN);
  });

  it('is unknown for an empty evidence kind', () => {
    expect(deriveActivity({ ...fresh, evidenceKind: '' }, ctx)).toEqual(UNKNOWN);
  });

  it('passes through fresh structured evidence', () => {
    expect(deriveActivity(fresh, ctx)).toEqual({
      activityState: 'working',
      activityEvidenceKind: 'codex.app-server.turn',
      activityObservedAt: '2026-08-28T11:59:30.000Z',
    });
  });
});
