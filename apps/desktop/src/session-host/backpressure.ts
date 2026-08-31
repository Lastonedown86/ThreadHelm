/**
 * Ordered, acknowledged output stream with high/low watermarks (T055).
 *
 * Frames go host → renderer over the session MessagePort. The renderer
 * acknowledges only after xterm finishes `write`, so "unacknowledged bytes" is
 * a true measure of what the user has not yet seen. Above HIGH the PTY is
 * paused; below LOW it resumes. If the budget is exceeded anyway (a burst that
 * lands before pause takes effect), bytes are discarded and the discard is
 * disclosed — never silently dropped, never allowed to grow without bound.
 */

import type { MessagePortMain } from 'electron';
import {
  HIGH_WATERMARK_BYTES,
  LOW_WATERMARK_BYTES,
  MAX_FRAME_BYTES,
  MAX_UNACKED_BYTES,
  OutputAck,
  type HostFailureCode,
  type OutputFrame,
  type OutputTruncated,
} from '@threadhelm/contracts';

export interface StreamHooks {
  pause(): void;
  resume(): void;
  onTruncated(truncationCount: number): void;
  onViolation(code: HostFailureCode, detail: string): void;
}

interface Watermarks {
  high: number;
  low: number;
  max: number;
  frame: number;
}

const DEFAULT_WATERMARKS: Watermarks = {
  high: HIGH_WATERMARK_BYTES,
  low: LOW_WATERMARK_BYTES,
  max: MAX_UNACKED_BYTES,
  frame: MAX_FRAME_BYTES,
};

/** Minimal port surface so the class is testable without Electron. */
export interface FramePort {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (event: { data: unknown }) => void): unknown;
  start(): void;
  close(): void;
}

export class OutputStream {
  readonly #sessionId: string;
  readonly #port: FramePort;
  readonly #hooks: StreamHooks;
  readonly #marks: Watermarks;
  /** Frames sent and not yet acknowledged, in sequence order. */
  readonly #inFlight: { sequence: number; length: number }[] = [];
  #nextSequence = 1;
  #lastAcked = 0;
  #unacked = 0;
  #paused = false;
  #closed = false;
  #truncationCount = 0;
  #truncationAnnounced = 0;
  #truncationTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    sessionId: string,
    port: FramePort | MessagePortMain,
    hooks: StreamHooks,
    marks: Partial<Watermarks> = {},
  ) {
    this.#sessionId = sessionId;
    this.#port = port as FramePort;
    this.#hooks = hooks;
    this.#marks = { ...DEFAULT_WATERMARKS, ...marks };
    this.#port.on('message', (event) => this.#onMessage(event.data));
    this.#port.start();
  }

  get unackedBytes(): number {
    return this.#unacked;
  }

  get paused(): boolean {
    return this.#paused;
  }

  get truncationCount(): number {
    return this.#truncationCount;
  }

  get lastSentSequence(): number {
    return this.#nextSequence - 1;
  }

  push(bytes: Buffer): void {
    if (this.#closed || bytes.byteLength === 0) return;
    for (let offset = 0; offset < bytes.byteLength; offset += this.#marks.frame) {
      const chunk = bytes.subarray(offset, Math.min(offset + this.#marks.frame, bytes.byteLength));
      this.#sendFrame(chunk);
    }
  }

  /** Disclose bytes withheld by a separately enforced host resource budget. */
  discard(byteLength: number): void {
    if (this.#closed || byteLength <= 0) return;
    this.#truncationCount += Math.ceil(byteLength / this.#marks.frame);
    // A budget hold can close the host before the coalescing timer fires. Send
    // the first disclosure now, then coalesce any bytes already in flight.
    if (this.#truncationAnnounced === 0) this.#announceTruncation();
    else this.#scheduleTruncationNotice();
  }

  close(): void {
    if (this.#closed) return;
    this.#announceTruncation();
    this.#closed = true;
    if (this.#truncationTimer) clearTimeout(this.#truncationTimer);
    try {
      this.#port.close();
    } catch {
      /* already closed */
    }
  }

  #sendFrame(chunk: Buffer): void {
    if (this.#unacked + chunk.byteLength > this.#marks.max) {
      // Budget exhausted: disclose, do not grow.
      this.#truncationCount += 1;
      this.#scheduleTruncationNotice();
      return;
    }
    const sequence = this.#nextSequence++;
    const frame: OutputFrame = {
      kind: 'output',
      sessionId: this.#sessionId,
      sequence,
      // Copy: the PTY buffer may be reused by node-pty after this call.
      bytes: new Uint8Array(chunk),
    };
    this.#inFlight.push({ sequence, length: chunk.byteLength });
    this.#unacked += chunk.byteLength;
    this.#port.postMessage(frame);
    if (!this.#paused && this.#unacked >= this.#marks.high) {
      this.#paused = true;
      this.#hooks.pause();
    }
  }

  #scheduleTruncationNotice(): void {
    if (this.#truncationTimer) return;
    // Coalesce: a 100 MB burst must not become 1,500 notices.
    this.#truncationTimer = setTimeout(() => {
      this.#truncationTimer = undefined;
      this.#announceTruncation();
    }, 250);
  }

  #announceTruncation(): void {
    if (this.#truncationCount === this.#truncationAnnounced || this.#closed) return;
    this.#truncationAnnounced = this.#truncationCount;
    const notice: OutputTruncated = {
      kind: 'truncated',
      sessionId: this.#sessionId,
      truncationCount: this.#truncationCount,
    };
    this.#port.postMessage(notice);
    this.#hooks.onTruncated(this.#truncationCount);
  }

  #onMessage(data: unknown): void {
    if (this.#closed) return;
    const parsed = OutputAck.safeParse(data);
    if (!parsed.success) {
      this.#fail('STREAM_VIOLATION', 'malformed ack');
      return;
    }
    const ack = parsed.data;
    if (ack.sessionId !== this.#sessionId) {
      this.#fail('STREAM_VIOLATION', 'ack for another session');
      return;
    }
    if (ack.throughSequence <= this.#lastAcked || ack.throughSequence > this.lastSentSequence) {
      this.#fail('STREAM_VIOLATION', 'ack out of range');
      return;
    }
    while (this.#inFlight.length > 0 && this.#inFlight[0]!.sequence <= ack.throughSequence) {
      const done = this.#inFlight.shift()!;
      this.#unacked -= done.length;
    }
    this.#lastAcked = ack.throughSequence;
    if (this.#paused && this.#unacked <= this.#marks.low) {
      this.#paused = false;
      this.#hooks.resume();
    }
  }

  #fail(code: HostFailureCode, detail: string): void {
    this.close();
    this.#hooks.onViolation(code, detail);
  }
}
