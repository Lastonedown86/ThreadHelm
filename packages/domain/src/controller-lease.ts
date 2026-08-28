/**
 * One-writer controller lease (T017), data-model.md "ControllerLease".
 *
 * Keyed by effective workspace identity (volume serial + file id), never by
 * path text, so an alias, junction, or different spelling of an active
 * workspace is the same lease.
 */

import {
  ThreadHelmError,
  workspaceIdentityKey,
  type WorkspaceIdentity,
} from '@threadhelm/contracts';

export type LeaseResult = { ok: true } | { ok: false; holderSessionId: string };

export class ControllerLeases {
  // ponytail: in-memory map only. Leases are volatile by design — never
  // sufficient for restart reattachment (data-model.md).
  readonly #holders = new Map<string, string>();

  acquire(identity: WorkspaceIdentity, sessionId: string): LeaseResult {
    const key = workspaceIdentityKey(identity);
    const holder = this.#holders.get(key);
    if (holder !== undefined && holder !== sessionId) {
      return { ok: false, holderSessionId: holder };
    }
    this.#holders.set(key, sessionId);
    return { ok: true };
  }

  acquireOrThrow(identity: WorkspaceIdentity, sessionId: string): void {
    const result = this.acquire(identity, sessionId);
    if (!result.ok) {
      throw new ThreadHelmError(
        'WRITE_LEASE_HELD',
        'Another write-capable session is active in this workspace.',
        { holderSessionId: result.holderSessionId },
      );
    }
  }

  release(sessionId: string): void {
    for (const [key, holder] of this.#holders) {
      if (holder === sessionId) this.#holders.delete(key);
    }
  }

  holderOf(identity: WorkspaceIdentity): string | null {
    return this.#holders.get(workspaceIdentityKey(identity)) ?? null;
  }

  isHeld(identity: WorkspaceIdentity): boolean {
    return this.#holders.has(workspaceIdentityKey(identity));
  }
}
