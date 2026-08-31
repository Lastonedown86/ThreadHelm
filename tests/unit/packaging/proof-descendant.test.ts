import { describe, expect, it, vi } from 'vitest';
import { isProofDescendant } from '../../../apps/desktop/src/main/proof-descendant.js';

describe('diagnostic descendant identity across scopes', () => {
  const newScope = { hostPid: 4100, rootPid: 4101 };
  it.each([4100, 4101])(
    'rejects a stale descendant PID reused as the current host/root: %i',
    (stalePid) => {
      // Both current processes are legitimately in this Job; membership alone is insufficient.
      const verify = vi.fn(() => true);
      expect(isProofDescendant(Number(String(stalePid)), newScope, verify)).toBe(false);
      expect(verify).not.toHaveBeenCalled();
    },
  );
  it('requires membership for a distinct descendant instead of trusting the PID record', () => {
    expect(isProofDescendant(4102, newScope, () => false)).toBe(false);
    const verify = vi.fn(() => true);
    expect(isProofDescendant(4102, newScope, verify)).toBe(true);
    expect(verify).toHaveBeenCalledExactlyOnceWith(4102);
  });
  it.each([0, -1, 1.5, NaN])('rejects invalid PID %s without a native query', (pid) => {
    const verify = vi.fn(() => true);
    expect(isProofDescendant(pid, newScope, verify)).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });
});
