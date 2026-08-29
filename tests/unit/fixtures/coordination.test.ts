import { describe, expect, it } from 'vitest';
import {
  COORDINATION_PARTICIPANTS,
  coordinationEventFixture,
  createCoordinationClock,
  createCoordinationUuidFactory,
} from '@threadhelm/test-fixtures';
import {
  bridgeReplyRequest,
  contentFreeBridgeEventFixture,
  providerLifecycleFixture,
} from '@threadhelm/test-fixtures';

describe('coordination fixtures', () => {
  it('repeats participant, clock, UUID, and content-free event values deterministically', () => {
    expect(
      COORDINATION_PARTICIPANTS.map(({ sessionId, providerId }) => [sessionId, providerId]),
    ).toEqual([
      ['00000000-0000-4000-8000-000000000001', 'codex-cli'],
      ['00000000-0000-4000-8000-000000000002', 'claude-code'],
    ]);

    const clock = createCoordinationClock();
    expect(clock.iso()).toBe('2026-01-01T00:00:00.000Z');
    clock.advance(2_000);
    expect(clock.iso()).toBe('2026-01-01T00:00:02.000Z');

    const ids = createCoordinationUuidFactory(7);
    expect([ids(), ids()]).toEqual([
      '00000000-0000-4000-8000-000000000007',
      '00000000-0000-4000-8000-000000000008',
    ]);
    expect(coordinationEventFixture()).not.toHaveProperty('body');
    expect(bridgeReplyRequest()).toEqual(bridgeReplyRequest());
    expect(providerLifecycleFixture().safePoint).toBe(true);
    expect(contentFreeBridgeEventFixture()).not.toHaveProperty('body');
  });
});
