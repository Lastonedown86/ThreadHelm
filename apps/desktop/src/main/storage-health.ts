/**
 * Storage health (T084).
 *
 * A failed durable write flips the coordinator into a degraded state: new
 * launches are blocked (they require a durable `starting` record before any
 * process exists), while live sessions stay visible and controllable. Safety
 * controls — interrupt, stop, force stop, input, resize — still act on the
 * live process; their durable records are attempted best-effort so the user
 * is never left unable to stop something because a disk write failed.
 */

import { ThreadHelmError } from '@threadhelm/contracts';
import type { RendererEvents } from './ipc/electron-binding.js';
import type { Logger } from './logging.js';

export class StorageHealth {
  #degraded: boolean;
  #reasonCode: string | null;
  readonly #log: Logger;
  #events: RendererEvents | null = null;

  constructor(log: Logger, initiallyDegraded = false, reasonCode: string | null = null) {
    this.#log = log;
    this.#degraded = initiallyDegraded;
    this.#reasonCode = reasonCode;
  }

  attach(events: RendererEvents): void {
    this.#events = events;
  }

  get degraded(): boolean {
    return this.#degraded;
  }

  get reasonCode(): string | null {
    return this.#reasonCode;
  }

  /** Launch and other durable-intent operations call this first. */
  assertWritable(): void {
    if (this.#degraded) {
      throw new ThreadHelmError(
        'STORAGE_DEGRADED',
        'Local storage is unavailable. New launches are blocked until ThreadHelm is restarted; live sessions remain controllable.',
        { reasonCode: this.#reasonCode ?? 'UNKNOWN' },
      );
    }
  }

  /** Required durable write: failure degrades and rethrows as STORAGE_DEGRADED. */
  required<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      this.#degrade(error);
      throw new ThreadHelmError('STORAGE_DEGRADED', 'A required storage write failed.', {
        reasonCode: this.#reasonCode ?? 'WRITE_FAILED',
      });
    }
  }

  /** Best-effort durable write for safety controls: failure degrades, never blocks. */
  bestEffort(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.#degrade(error);
    }
  }

  #degrade(error: unknown): void {
    if (error instanceof ThreadHelmError && error.code !== 'STORAGE_UNAVAILABLE') {
      // Domain/validation errors are not storage failures.
      throw error;
    }
    if (!this.#degraded) {
      this.#degraded = true;
      this.#reasonCode = 'WRITE_FAILED';
      this.#log.error('storage.degraded', {
        errorName: error instanceof Error ? error.name : 'unknown',
      });
      this.#events?.emit('application.storageHealth', {
        degraded: true,
        reasonCode: this.#reasonCode,
      });
    }
  }
}
