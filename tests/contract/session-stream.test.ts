/** T050 — sessions.sendInput / sessions.resize, MessagePort frame ordering, backpressure, control queue. */

import { MAX_FRAME_BYTES, type MainToHostMessage } from '@threadhelm/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutputStream, type FramePort } from '../../apps/desktop/src/session-host/backpressure.js';
import { ControlQueue, type ControlOp } from '../../apps/desktop/src/session-host/resize.js';
import { createWorld, errorCode, identity, type FakeWorld } from './helpers/fake-context.js';

const DIR = 'C:\\projects\\alpha';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';

describe('input routing (sessions.sendInput / sessions.resize)', () => {
  let world: FakeWorld;
  let sessionId: string;

  beforeEach(async () => {
    world = createWorld();
    world.addDir(DIR, identity(1));
    const workspace = await world.approve(DIR);
    sessionId = (await world.launch(workspace.id)).id;
  });

  const bytes = (text: string) => new TextEncoder().encode(text);

  it('NOT_SELECTED until the session is selected; then input reaches the host in order', async () => {
    expect(
      errorCode(await world.call('sessions.sendInput', { sessionId, bytes: bytes('a') })),
    ).toBe('NOT_SELECTED');
    await world.ok('sessions.select', { sessionId });
    const first = await world.ok<{ controlSequence: number }>('sessions.sendInput', {
      sessionId,
      bytes: bytes('one'),
    });
    const second = await world.ok<{ controlSequence: number }>('sessions.sendInput', {
      sessionId,
      bytes: bytes('two'),
    });
    expect(second.controlSequence).toBe(first.controlSequence + 1);
    const inputs = world.hosts[0]!.received.filter(
      (m): m is Extract<MainToHostMessage, { type: 'host.input' }> => m.type === 'host.input',
    );
    expect(inputs.map((m) => new TextDecoder().decode(m.bytes))).toEqual(['one', 'two']);
    expect(inputs.map((m) => m.controlSequence)).toEqual([
      first.controlSequence,
      second.controlSequence,
    ]);
  });

  it('selecting another session moves the input target', async () => {
    world.addDir('C:\\projects\\beta', identity(2));
    const other = await world.launch((await world.approve('C:\\projects\\beta')).id, 'claude-code');
    await world.ok('sessions.select', { sessionId: other.id });
    expect(
      errorCode(await world.call('sessions.sendInput', { sessionId, bytes: bytes('x') })),
    ).toBe('NOT_SELECTED');
    expect(
      (await world.call('sessions.sendInput', { sessionId: other.id, bytes: bytes('x') })).ok,
    ).toBe(true);
    expect(world.hosts[0]!.received.some((m) => m.type === 'host.input')).toBe(false);
    expect(world.hosts[1]!.received.some((m) => m.type === 'host.input')).toBe(true);
  });

  it('INPUT_BLOCKED once a stop is confirmed', async () => {
    await world.ok('sessions.select', { sessionId });
    world.hosts[0]!.cleanStop = 'silent';
    const stop = await world.ok<{ stopToken: string }>('sessions.requestStop', { sessionId });
    await world.ok('sessions.confirmStop', { stopToken: stop.stopToken });
    expect(
      errorCode(await world.call('sessions.sendInput', { sessionId, bytes: bytes('x') })),
    ).toBe('INPUT_BLOCKED');
  });

  it('rejects empty and oversized payloads at the contract', async () => {
    await world.ok('sessions.select', { sessionId });
    expect(
      errorCode(await world.call('sessions.sendInput', { sessionId, bytes: new Uint8Array(0) })),
    ).toBe('INVALID_REQUEST');
    expect(
      errorCode(
        await world.call('sessions.sendInput', { sessionId, bytes: new Uint8Array(65 * 1024) }),
      ),
    ).toBe('INVALID_REQUEST');
  });

  it('BACKPRESSURE only after more than 64 unacknowledged controls', async () => {
    await world.ok('sessions.select', { sessionId });
    const live = world.ctx.live.get(sessionId)!;
    for (let i = 0; i < 65; i += 1) live.pendingControls.set(10_000 + i, () => undefined);
    expect(
      errorCode(await world.call('sessions.sendInput', { sessionId, bytes: bytes('x') })),
    ).toBe('BACKPRESSURE');
    live.pendingControls.clear();
    expect((await world.call('sessions.sendInput', { sessionId, bytes: bytes('x') })).ok).toBe(
      true,
    );
  });

  it('resize validates dimensions and lifecycle, and updates the durable size', async () => {
    expect(
      errorCode(await world.call('sessions.resize', { sessionId, columns: 0, rows: 10 })),
    ).toBe('INVALID_REQUEST');
    expect(
      errorCode(await world.call('sessions.resize', { sessionId, columns: 1001, rows: 10 })),
    ).toBe('INVALID_REQUEST');
    const accepted = await world.ok<{ controlSequence: number }>('sessions.resize', {
      sessionId,
      columns: 132,
      rows: 50,
    });
    expect(accepted.controlSequence).toBeGreaterThan(0);
    const record = world.ctx.storage!.repositories.sessions.findById(sessionId)!;
    expect([record.columns, record.rows]).toEqual([132, 50]);

    const stop = await world.ok<{ stopToken: string }>('sessions.requestStop', { sessionId });
    await world.ok('sessions.confirmStop', { stopToken: stop.stopToken });
    await world.until(() => !world.ctx.live.has(sessionId));
    expect(
      errorCode(await world.call('sessions.resize', { sessionId, columns: 80, rows: 24 })),
    ).toBe('SESSION_NOT_FOUND');
  });

  it('subscribeOutput transfers the port exactly once', async () => {
    expect(await world.ok('sessions.subscribeOutput', { sessionId })).toBe(true);
    expect(world.ports.map((p) => p.sessionId)).toEqual([sessionId]);
    expect(errorCode(await world.call('sessions.subscribeOutput', { sessionId }))).toBe(
      'INVALID_STATE',
    );
  });
});

// --- host-side stream (OutputStream) --------------------------------------------

class TestPort implements FramePort {
  readonly posted: unknown[] = [];
  closed = false;
  #listener: ((event: { data: unknown }) => void) | undefined;
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  on(_event: 'message', listener: (event: { data: unknown }) => void) {
    this.#listener = listener;
  }
  start() {}
  close() {
    this.closed = true;
  }
  /** Renderer → host. */
  ack(throughSequence: number, sessionId = SESSION_ID) {
    this.#listener?.({ data: { kind: 'ack', sessionId, throughSequence } });
  }
  raw(data: unknown) {
    this.#listener?.({ data });
  }
  frames() {
    return this.posted.filter((m) => (m as { kind: string }).kind === 'output') as {
      sequence: number;
      bytes: Uint8Array;
    }[];
  }
}

function stream(marks: { high: number; low: number; max: number; frame?: number }) {
  const port = new TestPort();
  const hooks = { pause: vi.fn(), resume: vi.fn(), onTruncated: vi.fn(), onViolation: vi.fn() };
  const out = new OutputStream(SESSION_ID, port, hooks, marks);
  return { port, hooks, out };
}

describe('OutputStream (session-host/backpressure)', () => {
  it('chunks to MAX_FRAME_BYTES with contiguous sequences', () => {
    const { port, out } = stream({ high: 10e6, low: 1e6, max: 20e6 });
    out.push(Buffer.alloc(MAX_FRAME_BYTES * 2 + 5, 1));
    const frames = port.frames();
    expect(frames.map((f) => f.sequence)).toEqual([1, 2, 3]);
    expect(frames.map((f) => f.bytes.byteLength)).toEqual([MAX_FRAME_BYTES, MAX_FRAME_BYTES, 5]);
    expect(out.unackedBytes).toBe(MAX_FRAME_BYTES * 2 + 5);
  });

  it('pauses at the high watermark and resumes once acks reach the low watermark', () => {
    const { port, hooks, out } = stream({ high: 300, low: 100, max: 1000, frame: 100 });
    out.push(Buffer.alloc(300));
    expect(hooks.pause).toHaveBeenCalledTimes(1);
    expect(out.paused).toBe(true);
    port.ack(1);
    expect(hooks.resume).not.toHaveBeenCalled();
    port.ack(2);
    expect(hooks.resume).toHaveBeenCalledTimes(1);
    expect(out.paused).toBe(false);
    expect(out.unackedBytes).toBe(100);
  });

  it('discards beyond the budget and discloses once per burst', async () => {
    vi.useFakeTimers();
    try {
      const { port, hooks, out } = stream({ high: 150, low: 50, max: 200, frame: 100 });
      out.push(Buffer.alloc(500)); // 2 frames fit, 3 discarded
      expect(port.frames()).toHaveLength(2);
      expect(out.truncationCount).toBe(3);
      await vi.advanceTimersByTimeAsync(300);
      const notices = port.posted.filter((m) => (m as { kind: string }).kind === 'truncated');
      expect(notices).toEqual([{ kind: 'truncated', sessionId: SESSION_ID, truncationCount: 3 }]);
      expect(hooks.onTruncated).toHaveBeenCalledWith(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['ack beyond what was sent', (p: TestPort) => p.ack(5)],
    ['duplicate ack', (p: TestPort) => (p.ack(1), p.ack(1))],
    ['ack for another session', (p: TestPort) => p.ack(1, '22222222-2222-4222-8222-222222222222')],
    ['malformed frame', (p: TestPort) => p.raw({ kind: 'nonsense' })],
  ])('%s closes the stream as a violation', (_label, act) => {
    const { port, hooks, out } = stream({ high: 1000, low: 100, max: 2000, frame: 100 });
    out.push(Buffer.alloc(200));
    act(port);
    expect(hooks.onViolation).toHaveBeenCalledWith('STREAM_VIOLATION', expect.any(String));
    expect(port.closed).toBe(true);
    out.push(Buffer.alloc(100));
    expect(port.frames()).toHaveLength(2); // nothing after close
  });
});

// --- host-side control queue ----------------------------------------------------

describe('ControlQueue (session-host/resize)', () => {
  it('rejects out-of-order sequences and applies in order', async () => {
    const applied: number[] = [];
    const rejected: number[] = [];
    const queue = new ControlQueue({
      apply: (op: ControlOp) => {
        applied.push(op.sequence);
      },
      applied: () => undefined,
      rejected: (sequence) => rejected.push(sequence),
    });
    queue.enqueue({ kind: 'interrupt', sequence: 2 });
    queue.enqueue({ kind: 'interrupt', sequence: 1 });
    queue.enqueue({ kind: 'interrupt', sequence: 2 });
    await Promise.resolve();
    expect(rejected).toEqual([2]);
    expect(applied).toEqual([1, 2]);
  });

  it('coalesces consecutive resizes yet acknowledges every sequence', async () => {
    const appliedOps: ControlOp[] = [];
    const acked: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const queue = new ControlQueue({
      apply: async (op) => {
        appliedOps.push(op);
        if (op.kind === 'input') await gate; // hold the queue so resizes pile up
      },
      applied: (sequence) => acked.push(sequence),
      rejected: () => undefined,
    });
    queue.enqueue({ kind: 'input', sequence: 1, bytes: new Uint8Array([1]) });
    queue.enqueue({ kind: 'resize', sequence: 2, columns: 80, rows: 24 });
    queue.enqueue({ kind: 'resize', sequence: 3, columns: 100, rows: 30 });
    queue.enqueue({ kind: 'resize', sequence: 4, columns: 120, rows: 40 });
    queue.enqueue({ kind: 'input', sequence: 5, bytes: new Uint8Array([2]) });
    expect(queue.pendingCount).toBe(2); // one coalesced resize + one input
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(appliedOps.map((op) => op.kind)).toEqual(['input', 'resize', 'input']);
    expect(appliedOps[1]).toMatchObject({ sequence: 4, columns: 120, rows: 40 });
    expect([...acked].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    // the input never interleaved with the in-flight apply
    expect(acked.indexOf(1)).toBeLessThan(acked.indexOf(5));
  });
});
