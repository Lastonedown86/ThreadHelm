/**
 * Renderer end of the per-session output stream. Pure: no DOM, no xterm —
 * the writer is injected so this is testable and the ack rule is auditable:
 * an ack is posted only from the writer's completion callback, never before.
 */

import { StreamFrame, type OutputAck } from '@threadhelm/contracts/stream';

/** The slice of a DOM MessagePort the client touches; tests fake exactly this. */
export type StreamPort = Pick<MessagePort, 'postMessage' | 'onmessage' | 'close' | 'start'>;

export interface StreamWriter {
  write(bytes: Uint8Array, done: () => void): void;
}

export type StreamFailure = 'SEQUENCE_GAP' | 'WRONG_SESSION' | 'MALFORMED';

export interface StreamHooks {
  onTruncated(truncationCount: number): void;
  onFailure(reason: StreamFailure): void;
  /** Fires per delivered output frame; used for "new output" attention. */
  onOutput?(): void;
}

export class StreamClient {
  readonly #sessionId: string;
  readonly #port: StreamPort;
  readonly #writer: StreamWriter;
  readonly #hooks: StreamHooks;
  #expected = 1;
  /** Highest sequence whose write has completed. */
  #completed = 0;
  #acked = 0;
  #closed = false;

  constructor(sessionId: string, port: StreamPort, writer: StreamWriter, hooks: StreamHooks) {
    this.#sessionId = sessionId;
    this.#port = port;
    this.#writer = writer;
    this.#hooks = hooks;
    port.onmessage = (event) => this.#onFrame(event.data);
    port.start();
  }

  get closed(): boolean {
    return this.#closed;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#port.onmessage = null;
    this.#port.close();
  }

  #onFrame(data: unknown): void {
    if (this.#closed) return;
    const parsed = StreamFrame.safeParse(data);
    if (!parsed.success) return this.#fail('MALFORMED');
    const frame = parsed.data;
    if (frame.sessionId !== this.#sessionId) return this.#fail('WRONG_SESSION');

    if (frame.kind === 'truncated') {
      this.#hooks.onTruncated(frame.truncationCount);
      return;
    }
    if (frame.kind === 'ack') return this.#fail('MALFORMED');

    if (frame.sequence !== this.#expected) return this.#fail('SEQUENCE_GAP');
    this.#expected += 1;
    const sequence = frame.sequence;
    this.#writer.write(frame.bytes, () => {
      // Writes complete in order, so this sequence is the new high-water mark.
      if (sequence > this.#completed) this.#completed = sequence;
      this.#ack();
    });
    this.#hooks.onOutput?.();
  }

  #ack(): void {
    if (this.#closed || this.#completed <= this.#acked) return;
    this.#acked = this.#completed;
    const ack: OutputAck = {
      kind: 'ack',
      sessionId: this.#sessionId,
      throughSequence: this.#acked,
    };
    this.#port.postMessage(ack);
  }

  #fail(reason: StreamFailure): void {
    this.close();
    this.#hooks.onFailure(reason);
  }
}
