import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { posix, win32 } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import desktopConfig from '../../apps/desktop/electron.vite.config.js';

const nodeRequire = createRequire(import.meta.url);
const executable = 'C:\\Users\\Fixture\\AppData\\Local\\ThreadHelm\\app-0.1.0\\ThreadHelm.exe';
let entryFile: string;
let chunks: { fileName: string; code: string; modules: Record<string, unknown> }[];

beforeAll(async () => {
  const config = await desktopConfig;
  const main = config.main;
  if (!main?.build?.rollupOptions || !main.resolve)
    throw new Error('Missing production main build options');
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: main.resolve,
    build: {
      ssr: true,
      write: false,
      minify: false,
      // Use real production input/output/alias policy, without copy or package
      // plugins: this regression must neither write artifacts nor launch apps.
      rollupOptions: main.build.rollupOptions,
    },
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  if (!bundle || !('output' in bundle)) throw new Error('Expected an in-memory main bundle');
  chunks = bundle.output.filter((item) => item.type === 'chunk');
  const entry = bundle.output.find((item) => item.type === 'chunk' && item.name === 'index');
  if (!entry || entry.type !== 'chunk') throw new Error('Missing main entry');
  entryFile = entry.fileName;
}, 30_000);

function runEntry(args: string[], updateFails = false, diagnosticFails = false) {
  const app = { exit: vi.fn(), whenReady: vi.fn(async () => undefined) };
  const processExit = vi.fn();
  const write = vi.fn();
  const nativeLoads = vi.fn(() => {
    throw new Error('PRIVATE_NATIVE_LOAD_DETAIL');
  });
  const execFile = vi.fn(
    (
      _file: string,
      _args: string[],
      _options: { windowsHide: boolean; timeout: number },
      callback: (error: Error | null) => void,
    ) => callback(updateFails ? new Error('PRIVATE_UPDATE_DETAIL') : null),
  );
  const processStub = Object.assign(new EventEmitter(), {
    platform: 'win32',
    arch: 'x64',
    argv: [executable, ...args],
    execPath: executable,
    env: {},
    versions: { electron: '44.0.0' },
    stdout: { write },
    exit: processExit,
  });
  const cache = new Map<string, { exports: unknown }>();
  function load(fileName: string): unknown {
    const cached = cache.get(fileName);
    if (cached) return cached.exports;
    const chunk = chunks.find((item) => item.fileName === fileName);
    if (!chunk) throw new Error(`Missing bundled chunk: ${fileName}`);
    const module = { exports: {} as unknown };
    cache.set(fileName, module);
    runInNewContext(chunk.code, {
      exports: module.exports,
      module,
      __filename: win32.join(
        win32.dirname(executable),
        'resources',
        'app.asar',
        'out',
        'main',
        fileName,
      ),
      __dirname: win32.join(
        win32.dirname(executable),
        'resources',
        'app.asar',
        'out',
        'main',
        posix.dirname(fileName),
      ),
      process: processStub,
      Buffer,
      TextEncoder,
      URL,
      queueMicrotask: (callback: () => void) =>
        queueMicrotask(() => {
          try {
            callback();
          } catch (error) {
            processStub.emit('uncaughtException', error);
          }
        }),
      require: (name: string) => {
        if (name === 'electron') return { app };
        if (name === '@threadhelm/windows-supervisor') return nativeLoads();
        if (name === 'node:child_process') return { execFile };
        if (name === 'node:fs') {
          return {
            ...nodeRequire(name),
            writeSync: (fd: number, text: string) => {
              if (diagnosticFails) throw new Error('PRIVATE_SINK_DETAIL');
              write(fd, text);
            },
          };
        }
        if (name.startsWith('.'))
          return load(posix.normalize(posix.join(posix.dirname(fileName), name)));
        return nodeRequire(name);
      },
    });
    return module.exports;
  }
  return { start: () => load(entryFile), app, processExit, write, nativeLoads, execFile };
}

describe('bundled main lifecycle boundary', () => {
  it.each([
    ['--squirrel-install', '--createShortcut'],
    ['--squirrel-updated', '--createShortcut'],
    ['--squirrel-uninstall', '--removeShortcut'],
    ['--squirrel-obsolete', null],
  ])(
    'handles %s without loading unavailable native dependencies or waiting for readiness',
    async (event, operation) => {
      const h = runEntry([event!]);
      expect(h.start).not.toThrow();
      await new Promise((done) => setImmediate(done));
      expect(h.nativeLoads).not.toHaveBeenCalled();
      expect(h.app.whenReady).not.toHaveBeenCalled();
      expect(h.app.exit).toHaveBeenCalledExactlyOnceWith(0);
      expect(h.write).not.toHaveBeenCalled();
      if (operation) {
        expect(h.execFile).toHaveBeenCalledExactlyOnceWith(
          'C:\\Users\\Fixture\\AppData\\Local\\ThreadHelm\\Update.exe',
          [operation, 'ThreadHelm.exe'],
          { windowsHide: true, timeout: 10_000 },
          expect.any(Function),
        );
      } else expect(h.execFile).not.toHaveBeenCalled();
    },
  );

  it('exits nonzero without printing an updater failure', async () => {
    const h = runEntry(['--squirrel-install'], true);
    h.start();
    await new Promise((done) => setImmediate(done));
    expect(h.app.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(h.write).not.toHaveBeenCalled();
  });

  it.each([{ args: [] }, { args: ['--threadhelm-proof'] }])(
    'terminates failed non-installer imports with the fixed fatal diagnostic: $args',
    async ({ args }) => {
      const h = runEntry(args);
      expect(h.start).not.toThrow();
      await new Promise((done) => setImmediate(done));
      expect(h.nativeLoads).toHaveBeenCalledOnce();
      expect(h.processExit).toHaveBeenCalledExactlyOnceWith(1);
      expect(h.write).toHaveBeenCalledExactlyOnceWith(2, '\nTHREADHELM_FATAL UNCAUGHT_EXCEPTION\n');
      expect(h.app.exit).not.toHaveBeenCalled();
    },
  );

  it('still terminates a rejected import when the fixed diagnostic sink fails', async () => {
    const h = runEntry([], false, true);
    h.start();
    await new Promise((done) => setImmediate(done));
    expect(h.processExit).toHaveBeenCalledExactlyOnceWith(1);
    expect(h.write).not.toHaveBeenCalled();
  });

  it('keeps module-relative fixture runtime lookup beside the copied fake-agent file', () => {
    const owners = chunks.filter((chunk) =>
      Object.keys(chunk.modules).some((id) =>
        /[/\\]test-fixtures[/\\]src[/\\]runtime\.ts$/.test(id),
      ),
    );
    expect(owners).toHaveLength(1);
    expect(posix.dirname(owners[0]!.fileName)).toBe(posix.dirname(entryFile));
  });

  it.each([
    { args: ['--threadhelm-proof-node'] },
    { args: ['--threadhelm-proof-node', 'relative\\node.exe', 'fixture.js'] },
    { args: ['--threadhelm-proof', '--threadhelm-proof-node'] },
  ])(
    'rejects malformed diagnostic selection before native loading, readiness, or bootstrap: $args',
    async ({ args }) => {
      const h = runEntry(args);
      h.start();
      await new Promise((done) => setImmediate(done));
      expect(h.nativeLoads).not.toHaveBeenCalled();
      expect(h.app.whenReady).not.toHaveBeenCalled();
      expect(h.app.exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(h.write).toHaveBeenCalledExactlyOnceWith(
        '\nTHREADHELM_PROOF {"passed":false,"steps":{},"failure":"INVALID_PROOF_INVOCATION"}\n',
      );
    },
  );
});
