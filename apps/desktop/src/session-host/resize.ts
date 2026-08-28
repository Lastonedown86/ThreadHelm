/**
 * Serialized control queue (T063).
 *
 * Input, resize, interrupt, and clean stop share one strictly increasing
 * control sequence and are applied one at a time, in order, never interleaved
 * with each other. Consecutive pending resizes are coalesced to the latest
 * dimensions — every sequence is still acknowledged so main's bookkeeping
 * stays exact.
 */

export type ControlOp =
  | { kind: 'input'; sequence: number; bytes: Uint8Array }
  | { kind: 'resize'; sequence: number; columns: number; rows: number }
  | { kind: 'interrupt'; sequence: number }
  | { kind: 'cleanStop'; sequence: number; writes: readonly string[]; graceMs: number };

export interface ControlSink {
  apply(op: ControlOp): Promise<void> | void;
  applied(sequence: number): void;
  rejected(sequence: number, reason: 'OUT_OF_ORDER'): void;
}

export class ControlQueue {
  readonly #sink: ControlSink;
  readonly #pending: ControlOp[] = [];
  #expected = 1;
  #running = false;

  constructor(sink: ControlSink) {
    this.#sink = sink;
  }

  get pendingCount(): number {
    return this.#pending.length;
  }

  enqueue(op: ControlOp): void {
    if (op.sequence !== this.#expected) {
      this.#sink.rejected(op.sequence, 'OUT_OF_ORDER');
      return;
    }
    this.#expected += 1;

    const tail = this.#pending[this.#pending.length - 1];
    if (op.kind === 'resize' && tail?.kind === 'resize') {
      // Coalesce: the intermediate size will never be observed anyway.
      this.#sink.applied(tail.sequence);
      this.#pending[this.#pending.length - 1] = op;
    } else {
      this.#pending.push(op);
    }
    void this.#drain();
  }

  async #drain(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      while (this.#pending.length > 0) {
        const op = this.#pending.shift()!;
        await this.#sink.apply(op);
        this.#sink.applied(op.sequence);
      }
    } finally {
      this.#running = false;
    }
  }
}
