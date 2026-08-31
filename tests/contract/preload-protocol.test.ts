import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { events, operations, STREAM_PORT_CHANNEL } from '@threadhelm/contracts';

let code: string;
let moduleIds: string[];

beforeAll(async () => {
  const root = resolve(import.meta.dirname, '../..');
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: {
        '@threadhelm/contracts/protocol': resolve(root, 'packages/contracts/src/protocol.ts'),
        '@threadhelm/contracts': resolve(root, 'packages/contracts/src/index.ts'),
      },
    },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: resolve(root, 'apps/desktop/src/preload/index.ts'),
        external: ['electron'],
        output: { format: 'cjs' },
      },
    },
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  if (!bundle || !('output' in bundle)) throw new Error('Expected an in-memory preload bundle');
  const chunk = bundle.output.find((entry) => entry.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Missing preload entry chunk');
  code = chunk.code;
  moduleIds = Object.keys(chunk.modules);
}, 20_000);

type Api = {
  on(name: string, listener: (payload: unknown) => void): () => void;
  streamPortChannel: string;
  [key: string]: unknown;
};

function loadPreload() {
  let api: Api | undefined;
  const invoke = vi.fn().mockResolvedValue({ ok: true, value: null });
  const handlers = new Map<string, (event: unknown, payload: unknown) => void>();
  const postMessage = vi.fn();
  const electron = {
    contextBridge: {
      exposeInMainWorld: (name: string, value: Api) => {
        expect(name).toBe('threadhelm');
        api = value;
      },
    },
    ipcRenderer: {
      invoke,
      on: (channel: string, callback: (event: unknown, payload: unknown) => void) =>
        handlers.set(channel, callback),
    },
  };
  runInNewContext(code, {
    require: (name: string) => {
      expect(name).toBe('electron');
      return electron;
    },
    exports: {},
    window: { postMessage },
  });
  if (!api) throw new Error('Preload did not expose its API');
  return { api, invoke, handlers, postMessage };
}

describe('built preload protocol boundary', () => {
  it('does not load validation schemas or their runtime dependencies', () => {
    expect(
      moduleIds.filter((id) =>
        /[/\\](?:zod[/\\]|contracts[/\\]src[/\\](?:index|content-text)\.)/.test(id),
      ),
    ).toEqual([]);
  });

  it('exposes exactly the schema-backed methods and pins every invocation channel', async () => {
    const { api, invoke } = loadPreload();
    const names = Object.entries(api).flatMap(([namespace, value]) =>
      namespace === 'on' || namespace === 'streamPortChannel'
        ? []
        : Object.keys(value as object).map((method) => `${namespace}.${method}`),
    );
    expect(names.sort()).toEqual(Object.keys(operations).sort());
    for (const name of names) {
      const [namespace, method] = name.split('.') as [string, string];
      const request = { channel: 'op:unlisted', method: 'override' };
      const methods = api[namespace] as Record<string, (value: unknown) => Promise<unknown>>;
      await methods[method]!(request);
      expect(invoke).toHaveBeenLastCalledWith(`op:${name}`, request);
    }
    expect(api).not.toHaveProperty('invoke');
    expect(api).not.toHaveProperty('ipcRenderer');
  });

  it('subscribes only to approved events and preserves removal and stream transfer', () => {
    const { api, handlers, postMessage } = loadPreload();
    expect([...handlers.keys()].sort()).toEqual(
      [...Object.keys(events).map((name) => `event:${name}`), STREAM_PORT_CHANNEL].sort(),
    );
    expect(() => api.on('unlisted.event', vi.fn())).toThrow('unknown event');
    const listener = vi.fn();
    const unsubscribe = api.on('mission.changed', listener);
    const payload = { missionId: 'test-mission' };
    handlers.get('event:mission.changed')!({}, payload);
    expect(listener).toHaveBeenCalledExactlyOnceWith(payload);
    unsubscribe();
    handlers.get('event:mission.changed')!({}, payload);
    expect(listener).toHaveBeenCalledTimes(1);
    const ports = [{}];
    handlers.get(STREAM_PORT_CHANNEL)!({ ports }, { sessionId: 'test-session' });
    expect(postMessage).toHaveBeenCalledWith(
      { type: STREAM_PORT_CHANNEL, sessionId: 'test-session' },
      '*',
      ports,
    );
    expect(api.streamPortChannel).toBe(STREAM_PORT_CHANNEL);
  });
});
