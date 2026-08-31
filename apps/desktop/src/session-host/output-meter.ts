import type { HostToMainMessage } from '@threadhelm/contracts';
import type { OutputStream } from './backpressure.js';

type Progress = Extract<HostToMainMessage, { type: 'host.outputProgress' }>;
/** Counts bytes only. PTY content never enters this meter or the main channel. */
export class HostOutputMeter {
  readonly #sessionId: string;
  readonly #send: (event: Progress) => void;
  readonly #pause: () => void;
  #total = 0;
  #sequence = 0;
  #attemptId: string | null = null;
  #used = 0;
  #ceiling = 0;
  #reached = false;
  #timer: ReturnType<typeof setTimeout> | null = null;
  constructor(sessionId: string, send: (event: Progress) => void, pause: () => void) {
    this.#sessionId = sessionId;
    this.#send = send;
    this.#pause = pause;
  }
  get limitReached() {
    return this.#reached;
  }
  record(byteLength: number): number {
    if (!Number.isSafeInteger(byteLength) || byteLength < 0)
      throw new Error('OUTPUT_COUNT_INVALID');
    const allowed = this.#attemptId
      ? Math.max(0, Math.min(byteLength, this.#ceiling - this.#used))
      : byteLength;
    this.#total += byteLength;
    if (this.#attemptId) this.#used += byteLength;
    if (this.#attemptId && this.#used >= this.#ceiling) {
      if (!this.#reached) {
        this.#reached = true;
        this.#pause();
        if (this.#timer) clearTimeout(this.#timer);
        // Let the raw stream send the authorized prefix and its truncation
        // disclosure first. The PTY is already paused synchronously here.
        this.#timer = setTimeout(() => this.flush(), 0);
        this.#timer.unref();
      }
      return allowed;
    }
    if (!this.#timer) {
      this.#timer = setTimeout(() => this.flush(), 100);
      this.#timer.unref();
    }
    return allowed;
  }
  setBudget(attemptId: string, maxOutputBytes: number): void {
    if (this.#attemptId) {
      if (this.#attemptId !== attemptId || this.#ceiling !== maxOutputBytes)
        throw new Error('OUTPUT_BUDGET_CONFLICT');
      this.flush();
      return;
    }
    this.#attemptId = attemptId;
    this.#used = 0;
    this.#ceiling = maxOutputBytes;
    this.#reached = false;
    this.flush();
  }
  clearBudget(attemptId: string): void {
    if (this.#attemptId !== attemptId) return;
    this.flush();
    this.#attemptId = null;
    this.#used = 0;
    this.#ceiling = 0;
    this.#reached = false;
  }
  flush(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#send({
      type: 'host.outputProgress',
      sessionId: this.#sessionId,
      attemptId: this.#attemptId,
      totalOutputBytes: this.#total,
      outputBytes: this.#used,
      sequence: ++this.#sequence,
      limitReached: this.#reached,
    });
  }
  close() {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }
}

/** Raw bytes remain on the host/renderer stream; only counts reach main. */
export function forwardMeteredOutput(
  meter: HostOutputMeter,
  stream: OutputStream,
  bytes: Buffer,
): void {
  const allowed = meter.record(bytes.byteLength);
  if (allowed) stream.push(bytes.subarray(0, allowed));
  if (allowed < bytes.byteLength) stream.discard(bytes.byteLength - allowed);
}
