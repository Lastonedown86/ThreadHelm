/**
 * Short-lived, single-use opaque tokens for candidate, preview, stop, and
 * force-stop flows. A token binds a renderer intent to the exact target main
 * showed it; it is consumed on use so it cannot authorize a second action.
 */

import { randomBytes } from 'node:crypto';
import { TOKEN_TTL_MS } from '@threadhelm/contracts';

interface Entry<T> {
  payload: T;
  expiresAt: number;
}

export class TokenStore<T> {
  readonly #entries = new Map<string, Entry<T>>();
  readonly #ttlMs: number;
  readonly #now: () => number;

  constructor(ttlMs = TOKEN_TTL_MS, now: () => number = Date.now) {
    this.#ttlMs = ttlMs;
    this.#now = now;
  }

  issue(payload: T): { token: string; expiresAt: string } {
    this.#sweep();
    const token = randomBytes(24).toString('base64url');
    const expiresAt = this.#now() + this.#ttlMs;
    this.#entries.set(token, { payload, expiresAt });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** Consumes the token. Returns null when unknown or expired. */
  take(token: string): T | null {
    const entry = this.#entries.get(token);
    this.#entries.delete(token);
    if (!entry || entry.expiresAt <= this.#now()) return null;
    return entry.payload;
  }

  /** Drop every token whose payload matches, e.g. when its target changed. */
  revokeWhere(predicate: (payload: T) => boolean): void {
    for (const [token, entry] of this.#entries) {
      if (predicate(entry.payload)) this.#entries.delete(token);
    }
  }

  #sweep(): void {
    const now = this.#now();
    for (const [token, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.#entries.delete(token);
    }
  }
}
