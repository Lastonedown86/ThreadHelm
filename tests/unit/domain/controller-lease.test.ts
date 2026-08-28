import { ThreadHelmError } from '@threadhelm/contracts';
import { ControllerLeases } from '@threadhelm/domain';
import { describe, expect, it } from 'vitest';

const A = { volumeSerial: '0123456789abcdef', fileId: '0123456789abcdef0123456789abcdef' };
const B = { volumeSerial: '0123456789abcdef', fileId: 'ffffffffffffffffffffffffffffffff' };
const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';

describe('ControllerLeases', () => {
  it('acquires, conflicts, releases, re-acquires', () => {
    const leases = new ControllerLeases();
    expect(leases.isHeld(A)).toBe(false);
    expect(leases.acquire(A, S1)).toEqual({ ok: true });
    expect(leases.holderOf(A)).toBe(S1);
    expect(leases.acquire(A, S2)).toEqual({ ok: false, holderSessionId: S1 });
    // Same session re-acquiring is idempotent.
    expect(leases.acquire(A, S1)).toEqual({ ok: true });
    // A different workspace is independent.
    expect(leases.acquire(B, S2)).toEqual({ ok: true });
    leases.release(S1);
    expect(leases.holderOf(A)).toBeNull();
    expect(leases.acquire(A, S2)).toEqual({ ok: true });
    expect(leases.holderOf(B)).toBe(S2);
  });

  it('keys on identity, not path spelling', () => {
    const leases = new ControllerLeases();
    // Two "different paths" that resolved to the same volume serial + file id.
    const viaJunction = { ...A };
    leases.acquireOrThrow(A, S1);
    expect(leases.acquire(viaJunction, S2)).toEqual({ ok: false, holderSessionId: S1 });
  });

  it('acquireOrThrow throws WRITE_LEASE_HELD naming the holder', () => {
    const leases = new ControllerLeases();
    leases.acquireOrThrow(A, S1);
    let caught: unknown;
    try {
      leases.acquireOrThrow(A, S2);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ThreadHelmError);
    expect((caught as ThreadHelmError).code).toBe('WRITE_LEASE_HELD');
    expect((caught as ThreadHelmError).details).toEqual({ holderSessionId: S1 });
  });
});
