import { describe, expect, it } from 'vitest';
import { SCROLLBACK_LINES } from '@threadhelm/contracts';
import {
  describeTruncation,
  recordTruncation,
  scrollbackLimit,
} from '../../../apps/desktop/src/renderer/features/session/buffer.js';

describe('session buffer disclosure', () => {
  it('caps scrollback at the contract constant', () => {
    expect(scrollbackLimit).toBe(SCROLLBACK_LINES);
    expect(scrollbackLimit).toBe(10_000);
  });

  it('records only increasing truncation counts per session', () => {
    let state = recordTruncation({}, 'a', 2);
    expect(state).toEqual({ a: 2 });
    const same = recordTruncation(state, 'a', 1);
    expect(same).toBe(state);
    state = recordTruncation(state, 'b', 5);
    expect(state).toEqual({ a: 2, b: 5 });
  });

  it('describes truncation in accessible text', () => {
    expect(describeTruncation(0)).toBe('');
    expect(describeTruncation(1)).toMatch(/discarded once/);
    expect(describeTruncation(3)).toMatch(/discarded 3 times/);
  });
});
