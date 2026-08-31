import { MessageChannel } from 'node:worker_threads';
import { describe, expect, it, vi } from 'vitest';
import {
  TerminalController,
  type TerminalHooks,
  type TerminalRuntime,
} from '../../../apps/desktop/src/renderer/features/session/terminal-controller.js';
import {
  StreamClient,
  type StreamPort,
} from '../../../apps/desktop/src/renderer/features/session/stream.js';

const SESSION = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function harness() {
  const loading = deferred<TerminalRuntime>();
  const load = vi.fn(() => loading.promise);
  const request = vi.fn(async (_sessionId: string) => undefined);
  const failures: string[] = [];
  const hooks: TerminalHooks = {
    isSelected: () => true,
    onOutput: () => undefined,
    onTruncated: () => undefined,
    onInputRejected: () => undefined,
    onStreamFailure: (_sessionId, reason) => failures.push(reason),
  };
  const writes: number[][] = [];
  const done: (() => void)[] = [];
  const clients = new Map<string, StreamClient>();
  let activeHooks: TerminalHooks | null = null;
  const disposed: string[] = [];
  // Only the DOM/xterm writer is substituted. Port delivery, validation,
  // sequence checks and ACK timing use the real StreamClient and MessagePorts.
  const runtime: TerminalRuntime = {
    setTerminalHooks: (next) => {
      activeHooks = next;
    },
    attachStream: (sessionId, port) => {
      clients.get(sessionId)?.close();
      clients.set(
        sessionId,
        new StreamClient(
          sessionId,
          port,
          {
            write: (bytes, complete) => {
              writes.push([...bytes]);
              done.push(complete);
            },
          },
          {
            onTruncated: (count) => activeHooks?.onTruncated(sessionId, count),
            onFailure: (reason) => activeHooks?.onStreamFailure(sessionId, reason),
          },
        ),
      );
    },
    terminalSize: () => undefined,
    closeStream: (sessionId) => {
      clients.get(sessionId)?.close();
      clients.delete(sessionId);
    },
    disposeTerminal: (sessionId) => {
      disposed.push(sessionId);
      clients.get(sessionId)?.close();
      clients.delete(sessionId);
    },
    disposeTerminals: () => {
      for (const sessionId of clients.keys()) runtime.disposeTerminal(sessionId);
    },
  };
  const controller = new TerminalController(load, request);
  return { controller, loading, load, request, hooks, runtime, writes, done, failures, disposed };
}

function portPair() {
  const { port1, port2 } = new MessageChannel();
  const start = vi.spyOn(port2, 'start');
  const close = vi.spyOn(port2, 'close');
  const acks: unknown[] = [];
  port1.on('message', (value) => acks.push(value));
  return {
    port: port2 as unknown as StreamPort,
    start,
    close,
    acks,
    send: (sequence: number, byte = 65) =>
      port1.postMessage({
        kind: 'output',
        sessionId: SESSION,
        sequence,
        bytes: new Uint8Array([byte]),
      }),
    cleanup: () => {
      port1.close();
      port2.close();
    },
  };
}

describe('lazy terminal ownership', () => {
  it('installs idle hooks and reads default geometry without loading xterm or subscribing', () => {
    const h = harness();
    const uninstall = h.controller.install(h.hooks);
    expect(h.controller.terminalSize(SESSION)).toBeUndefined();
    expect(h.load).not.toHaveBeenCalled();
    expect(h.request).not.toHaveBeenCalled();
    uninstall();
  });

  it('preserves the first bytes when the transferred port beats import and IPC completion', async () => {
    const h = harness();
    const reply = deferred<undefined>();
    h.request.mockReturnValue(reply.promise);
    const uninstall = h.controller.install(h.hooks);
    const p = portPair();
    try {
      h.controller.subscribe(SESSION);
      h.controller.subscribe(SESSION);
      h.controller.receivePort(SESSION, p.port);
      p.send(1);
      p.send(2, 66);
      await turn();
      expect(h.request).toHaveBeenCalledExactlyOnceWith(SESSION);
      expect(h.load).toHaveBeenCalledTimes(1);
      expect(p.start).not.toHaveBeenCalled();
      expect(h.writes).toEqual([]);
      expect(p.acks).toEqual([]);
      h.loading.resolve(h.runtime);
      await h.controller.load();
      await turn();
      expect(h.writes).toEqual([[65], [66]]);
      expect(p.acks).toEqual([]);
      h.done[0]!();
      await turn();
      expect(p.acks).toEqual([{ kind: 'ack', sessionId: SESSION, throughSequence: 1 }]);
      uninstall();
      h.done[1]!();
      await turn();
      expect(p.acks).toHaveLength(1);
      reply.resolve(undefined);
    } finally {
      uninstall();
      p.cleanup();
    }
  });

  it('closes replaced and unsolicited ports without starting or retaining extra queues', async () => {
    const h = harness();
    const uninstall = h.controller.install(h.hooks);
    const old = portPair();
    const next = portPair();
    const unsolicited = portPair();
    try {
      h.controller.subscribe(SESSION);
      h.controller.receivePort(OTHER, unsolicited.port);
      h.controller.receivePort(SESSION, old.port);
      h.controller.receivePort(SESSION, next.port);
      expect(unsolicited.close).toHaveBeenCalledOnce();
      expect(old.close).toHaveBeenCalledOnce();
      expect(old.start).not.toHaveBeenCalled();
      next.send(1, 67);
      h.loading.resolve(h.runtime);
      await h.controller.load();
      await turn();
      expect(h.writes).toEqual([[67]]);
    } finally {
      uninstall();
      old.cleanup();
      next.cleanup();
      unsolicited.cleanup();
    }
  });

  it('never resurrects a port or input hooks after teardown during a pending import', async () => {
    const h = harness();
    const uninstall = h.controller.install(h.hooks);
    const p = portPair();
    try {
      h.controller.subscribe(SESSION);
      h.controller.receivePort(SESSION, p.port);
      p.send(1);
      uninstall();
      h.loading.resolve(h.runtime);
      await h.controller.load();
      await turn();
      h.controller.subscribe(SESSION);
      expect(p.close).toHaveBeenCalledOnce();
      expect(p.start).not.toHaveBeenCalled();
      expect(h.writes).toEqual([]);
      expect(h.request).toHaveBeenCalledOnce();
    } finally {
      p.cleanup();
    }
  });

  it('closes pending ports on import failure and reports only a fixed failure code', async () => {
    const h = harness();
    const uninstall = h.controller.install(h.hooks);
    const p = portPair();
    try {
      h.controller.subscribe(SESSION);
      h.controller.receivePort(SESSION, p.port);
      const result = expect(h.controller.load()).rejects.toThrow(/^TERMINAL_LOAD_FAILED$/);
      h.loading.reject(new Error('private path and imported content'));
      await result;
      expect(p.close).toHaveBeenCalledOnce();
      expect(p.start).not.toHaveBeenCalled();
      expect(h.failures).toEqual(['TERMINAL_LOAD_FAILED']);
      h.load.mockResolvedValue(h.runtime);
      h.controller.subscribe(SESSION);
      await h.controller.load();
      expect(h.request).toHaveBeenCalledTimes(2);
    } finally {
      uninstall();
      p.cleanup();
    }
  });

  it('ignores an old subscription rejection after a new mount owns the same session', async () => {
    const h = harness();
    const oldReply = deferred<undefined>();
    h.request.mockReturnValueOnce(oldReply.promise);
    const uninstallOld = h.controller.install(h.hooks);
    h.controller.subscribe(SESSION);
    uninstallOld();
    const uninstallNew = h.controller.install({ ...h.hooks });
    const p = portPair();
    try {
      h.controller.subscribe(SESSION);
      h.controller.receivePort(SESSION, p.port);
      oldReply.reject(new Error('old lifecycle'));
      await turn();
      expect(h.failures).toEqual([]);
      expect(p.close).not.toHaveBeenCalled();
      h.loading.resolve(h.runtime);
      await h.controller.load();
      p.send(1);
      await turn();
      expect(h.writes).toEqual([[65]]);
    } finally {
      uninstallNew();
      p.cleanup();
    }
  });

  it('closes a failed subscription without destroying an already mounted terminal', async () => {
    const h = harness();
    const reply = deferred<undefined>();
    h.request.mockReturnValue(reply.promise);
    const uninstall = h.controller.install(h.hooks);
    const p = portPair();
    try {
      h.controller.subscribe(SESSION);
      h.loading.resolve(h.runtime);
      await h.controller.load();
      h.controller.receivePort(SESSION, p.port);
      p.send(1);
      await turn();
      reply.reject(new Error('subscription failed after port delivery'));
      await turn();
      expect(p.close).toHaveBeenCalledOnce();
      expect(h.failures).toEqual(['SUBSCRIPTION_FAILED']);
      expect(h.disposed).toEqual([]);
      h.done[0]!();
      await turn();
      expect(p.acks).toEqual([]);
    } finally {
      uninstall();
      p.cleanup();
    }
  });
});
