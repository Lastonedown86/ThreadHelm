/**
 * Job Object handle registry (T072).
 *
 * Main retains every live Job Object token for the coordinator's lifetime.
 * Because each job is KILL_ON_JOB_CLOSE, an unexpected coordinator exit closes
 * the handles and Windows terminates every supervised tree. Tokens are
 * released only after a session's scope is verified empty (or at shutdown,
 * where closing IS the cleanup).
 */

import type { NativeSupervisor } from '../context.js';
import type { Logger } from '../logging.js';

export class JobRegistry {
  readonly #native: NativeSupervisor;
  readonly #log: Logger;
  readonly #tokens = new Map<string, number>();

  constructor(native: NativeSupervisor, log: Logger) {
    this.#native = native;
    this.#log = log;
  }

  create(sessionId: string): number {
    if (this.#tokens.has(sessionId)) throw new Error('job already exists for session');
    const token = this.#native.createKillOnCloseJob(sessionId);
    this.#tokens.set(sessionId, token);
    this.#log.info('job.created', { sessionId, token });
    return token;
  }

  get(sessionId: string): number | undefined {
    return this.#tokens.get(sessionId);
  }

  get size(): number {
    return this.#tokens.size;
  }

  /** Closes the handle; anything still inside the job dies with it. */
  close(sessionId: string): void {
    const token = this.#tokens.get(sessionId);
    if (token === undefined) return;
    this.#tokens.delete(sessionId);
    try {
      this.#native.closeJob(token);
      this.#log.info('job.closed', { sessionId, token });
    } catch {
      this.#log.warn('job.close_failed', { sessionId, token });
    }
  }

  closeAll(): void {
    for (const sessionId of [...this.#tokens.keys()]) this.close(sessionId);
  }
}
