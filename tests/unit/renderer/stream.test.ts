import { describe, expect, it } from 'vitest';
import {
  StreamClient,
  type StreamPort,
} from '../../../apps/desktop/src/renderer/features/session/stream.js';

const SESSION = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function harness() {
  const posted: unknown[] = [];
  let closed = false;
  const port: StreamPort = {
    postMessage: (m: unknown) => {
      posted.push(m);
    },
    onmessage: null,
    close: () => {
      closed = true;
    },
    start: () => undefined,
  };
  const pending: (() => void)[] = [];
  const truncations: number[] = [];
  const failures: string[] = [];
  let outputs = 0;
  const client = new StreamClient(
    SESSION,
    port,
    { write: (_bytes, done) => pending.push(done) },
    {
      onTruncated: (n) => truncations.push(n),
      onFailure: (r) => failures.push(r),
      onOutput: () => outputs++,
    },
  );
  const deliver = (data: unknown) =>
    port.onmessage?.call(port as MessagePort, { data } as MessageEvent);
  const frame = (sequence: number, sessionId = SESSION) => ({
    kind: 'output',
    sessionId,
    sequence,
    bytes: new Uint8Array([65]),
  });
  return {
    client,
    posted,
    pending,
    truncations,
    failures,
    deliver,
    frame,
    isClosed: () => closed,
    outputs: () => outputs,
  };
}

describe('StreamClient', () => {
  it('acks only after the write callback completes', () => {
    const h = harness();
    h.deliver(h.frame(1));
    h.deliver(h.frame(2));
    expect(h.posted).toHaveLength(0);
    h.pending[0]!();
    expect(h.posted).toEqual([{ kind: 'ack', sessionId: SESSION, throughSequence: 1 }]);
    h.pending[1]!();
    expect(h.posted[1]).toEqual({ kind: 'ack', sessionId: SESSION, throughSequence: 2 });
    expect(h.outputs()).toBe(2);
  });

  it('closes on a sequence gap', () => {
    const h = harness();
    h.deliver(h.frame(1));
    h.deliver(h.frame(3));
    expect(h.failures).toEqual(['SEQUENCE_GAP']);
    expect(h.isClosed()).toBe(true);
    expect(h.client.closed).toBe(true);
  });

  it('closes on a frame for another session', () => {
    const h = harness();
    h.deliver(h.frame(1, OTHER));
    expect(h.failures).toEqual(['WRONG_SESSION']);
    expect(h.isClosed()).toBe(true);
  });

  it('closes on malformed frames', () => {
    const h = harness();
    h.deliver({ kind: 'output', sessionId: SESSION });
    expect(h.failures).toEqual(['MALFORMED']);
  });

  it('reports truncation notices without acking them', () => {
    const h = harness();
    h.deliver({ kind: 'truncated', sessionId: SESSION, truncationCount: 3 });
    expect(h.truncations).toEqual([3]);
    expect(h.posted).toHaveLength(0);
    expect(h.failures).toHaveLength(0);
  });

  it('never acks after close', () => {
    const h = harness();
    h.deliver(h.frame(1));
    h.client.close();
    h.pending[0]!();
    expect(h.posted).toHaveLength(0);
  });
});
