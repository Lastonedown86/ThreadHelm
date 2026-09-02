/**
 * Fake world for the desktop IPC contract tests: in-memory native supervisor,
 * scripted hosts, scripted picker, mutable provider readiness, in-memory
 * SQLite, recorded renderer events, and a controllable clock. Everything the
 * coordinator touches, nothing real spawned.
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel } from 'node:worker_threads';
// eslint-disable-next-line no-restricted-imports -- type-only; the fake stands in for Electron ports
import type { MessagePortMain } from 'electron';
import {
  HostToMainMessage,
  type Availability,
  type HostFailureCode,
  type PermissionCapabilityEvidence,
  type Authentication,
  type MainToHostMessage,
} from '@threadhelm/contracts';
import { ControllerLeases } from '@threadhelm/domain';
import { openStorage } from '@threadhelm/persistence';
import {
  profileLaunchDisclosure,
  type ProbeContext,
  type ProviderAdapter,
  type ReadinessResult,
} from '@threadhelm/providers';
import { vi } from 'vitest';
import type {
  Context,
  DirectoryIdentity,
  HostHandle,
  JobSnapshot,
  NativeSupervisor,
} from '../../../apps/desktop/src/main/context.js';
import { createHandlers } from '../../../apps/desktop/src/main/coordinator.js';
import type { RendererEvents } from '../../../apps/desktop/src/main/ipc/electron-binding.js';
import {
  createRouter,
  type Envelope,
  type Router,
} from '../../../apps/desktop/src/main/ipc/router.js';
import { createLogger } from '../../../apps/desktop/src/main/logging.js';
import { JobRegistry } from '../../../apps/desktop/src/main/native/job-registry.js';
import { StorageHealth } from '../../../apps/desktop/src/main/storage-health.js';
import { TokenStore } from '../../../apps/desktop/src/main/tokens.js';

export const FRAME_URL = 'file:///C:/app/index.html';
export const SENDER = { frameUrl: FRAME_URL, isMainFrame: true };

// --- native --------------------------------------------------------------------

export interface FakeDir {
  volumeSerial: string;
  fileId: string;
  canonicalPath?: string;
  isReparsePoint?: boolean;
  /** Throw this native code instead of resolving. */
  error?: string;
}

export function identity(n: number): { volumeSerial: string; fileId: string } {
  return {
    volumeSerial: 'a1b2c3d4e5f60000'.slice(0, 12) + n.toString(16).padStart(4, '0'),
    fileId: n.toString(16).padStart(32, '0'),
  };
}

export class FakeNative implements NativeSupervisor {
  readonly dirs = new Map<string, FakeDir>();
  readonly jobs = new Map<number, Set<number>>();
  readonly sessionJobTokens = new Map<string, number>();
  readonly calls: { op: string; args: unknown[] }[] = [];
  stubbornJobs = new Set<number>();
  verifyResult: boolean | null = null;
  assignThrows: string | null = null;
  #next = 1;

  #record(op: string, ...args: unknown[]) {
    this.calls.push({ op, args });
  }

  resolveDirectory(selectedPath: string): DirectoryIdentity {
    this.#record('resolveDirectory', selectedPath);
    const dir = this.dirs.get(selectedPath);
    if (!dir) throw new Error('DIRECTORY_NOT_FOUND (win32=3)');
    if (dir.error) throw new Error(`${dir.error} (win32=0)`);
    const canonical = dir.canonicalPath ?? `\\\\?\\${selectedPath.replace(/[\\/.]+$/, '')}`;
    return {
      selectedPath,
      canonicalPath: canonical,
      displayPath: canonical.replace(/^\\\\\?\\/, ''),
      volumeSerial: dir.volumeSerial,
      fileId: dir.fileId,
      driveType: 'fixed',
      isReparsePoint: dir.isReparsePoint ?? false,
    };
  }

  createKillOnCloseJob(sessionId?: string): number {
    const token = this.#next++;
    this.jobs.set(token, new Set());
    if (sessionId) this.sessionJobTokens.set(sessionId, token);
    this.#record('createKillOnCloseJob', token);
    return token;
  }

  #job(token: number): Set<number> {
    const job = this.jobs.get(token);
    if (!job) throw new Error('INVALID_NATIVE_TOKEN');
    return job;
  }

  assignProcess(token: number, pid: number): void {
    this.#record('assignProcess', token, pid);
    if (this.assignThrows) throw new Error(this.assignThrows);
    this.#job(token).add(pid);
  }

  verifyProcessInJob(token: number, pid: number): boolean {
    this.#record('verifyProcessInJob', token, pid);
    if (this.verifyResult !== null) return this.verifyResult;
    return this.#job(token).has(pid);
  }

  inspectJob(token: number): JobSnapshot {
    this.#record('inspectJob', token);
    const job = this.#job(token);
    return { activeProcessCount: job.size, processIds: [...job], truncated: false };
  }
  inspectSessionScope(sessionId: string): JobSnapshot {
    const token = this.sessionJobTokens.get(sessionId);
    return token && this.jobs.has(token)
      ? this.inspectJob(token)
      : { activeProcessCount: 0, processIds: [], truncated: false };
  }

  terminateJob(token: number, exitCode: number): JobSnapshot {
    this.#record('terminateJob', token, exitCode);
    if (this.stubbornJobs.has(token)) throw new Error('JOB_NOT_EMPTY');
    this.#job(token).clear();
    return { activeProcessCount: 0, processIds: [], truncated: false };
  }

  closeJob(token: number): void {
    this.#record('closeJob', token);
    if (!this.jobs.delete(token)) throw new Error('INVALID_NATIVE_TOKEN');
  }

  /** Which job (if any) holds this pid. */
  jobOf(pid: number): number | undefined {
    for (const [token, job] of this.jobs) if (job.has(pid)) return token;
    return undefined;
  }
}

// --- hosts ---------------------------------------------------------------------

export type CleanStopBehaviour = 'exit' | 'timeout' | 'silent';

export class FakeHost implements HostHandle {
  readonly pid: number;
  readonly rootPid: number;
  readonly received: MainToHostMessage[] = [];
  readonly sent: HostToMainMessage[] = [];
  port: MessagePortMain | undefined;
  sessionId = '';
  cleanStop: CleanStopBehaviour = 'exit';
  /** When set, `host.launch` is answered with this failure instead of launched. */
  failOnLaunch: HostFailureCode | null = null;
  #secret = '';
  #outputSequence = 0;
  #listeners: ((message: unknown) => void)[] = [];
  #exitListeners: ((code: number) => void)[] = [];
  #native: FakeNative;
  alive = true;

  constructor(pid: number, native: FakeNative) {
    this.pid = pid;
    this.rootPid = pid + 1000;
    this.#native = native;
  }

  /** Deliver a host→main message asynchronously, validated like the real thing. */
  emit(message: HostToMainMessage): void {
    const parsed = HostToMainMessage.parse(message);
    this.sent.push(parsed);
    queueMicrotask(() => {
      for (const listener of this.#listeners) listener(parsed);
    });
  }

  /** Simulate the provider exiting on its own. */
  providerExits(exitCode: number): void {
    const token = this.#native.jobOf(this.rootPid);
    if (token !== undefined) this.#native.jobs.get(token)!.delete(this.rootPid);
    this.emit({ type: 'host.exit', sessionId: this.sessionId, exitCode, drained: true });
  }

  postMessage(message: MainToHostMessage, ports?: MessagePortMain[]): void {
    if (!this.alive) throw new Error('host gone');
    this.received.push(message);
    switch (message.type) {
      case 'host.bootstrap':
        this.sessionId = message.sessionId;
        this.#secret = message.bootstrapSecret;
        this.emit({
          type: 'host.ready',
          sessionId: message.sessionId,
          hostPid: this.pid,
          protocolVersion: 1,
        });
        return;
      case 'host.launch': {
        if (message.bootstrapSecret !== this.#secret) {
          this.emit({ type: 'host.failure', sessionId: this.sessionId, code: 'HOST_BAD_SECRET' });
          return;
        }
        if (this.failOnLaunch) {
          this.emit({ type: 'host.failure', sessionId: this.sessionId, code: this.failOnLaunch });
          return;
        }
        this.port = ports?.[0];
        // A child inherits its parent's job — mimic that.
        const token = this.#native.jobOf(this.pid);
        if (token !== undefined) this.#native.jobs.get(token)!.add(this.rootPid);
        this.emit({ type: 'host.launched', sessionId: this.sessionId, rootPid: this.rootPid });
        if (message.outputBudget)
          this.emit({
            type: 'host.outputProgress',
            sessionId: this.sessionId,
            attemptId: message.outputBudget.attemptId,
            outputBytes: 0,
            totalOutputBytes: 0,
            sequence: ++this.#outputSequence,
            limitReached: false,
          });
        return;
      }
      case 'host.setOutputBudget':
        this.emit({
          type: 'host.outputProgress',
          sessionId: this.sessionId,
          attemptId: message.attemptId,
          outputBytes: 0,
          totalOutputBytes: 0,
          sequence: ++this.#outputSequence,
          limitReached: false,
        });
        return;
      case 'host.input':
      case 'host.resize':
      case 'host.interrupt':
        this.emit({
          type: 'host.controlApplied',
          sessionId: this.sessionId,
          controlSequence: message.controlSequence,
        });
        return;
      case 'host.cleanStop':
        this.emit({
          type: 'host.controlApplied',
          sessionId: this.sessionId,
          controlSequence: message.controlSequence,
        });
        if (this.cleanStop === 'exit') this.providerExits(0);
        else if (this.cleanStop === 'timeout') {
          this.emit({
            type: 'host.cleanStopTimeout',
            sessionId: this.sessionId,
            controlSequence: message.controlSequence,
          });
        }
        return;
      case 'host.shutdown': {
        const token = this.#native.jobOf(this.pid);
        if (token !== undefined) this.#native.jobs.get(token)!.delete(this.pid);
        this.alive = false;
        queueMicrotask(() => {
          for (const listener of this.#exitListeners) listener(0);
        });
        return;
      }
      default:
        return;
    }
  }

  onMessage(listener: (message: unknown) => void): void {
    this.#listeners.push(listener);
  }

  onExit(listener: (code: number) => void): void {
    this.#exitListeners.push(listener);
  }

  kill(): void {
    this.alive = false;
  }
}

// --- adapters ------------------------------------------------------------------

export interface FakeReadiness {
  resolvedExecutable: string | null;
  version: string | null;
  availability: Availability;
  authentication: Authentication;
}

export function fakeAdapter(
  id: ProviderAdapter['id'],
  readiness: FakeReadiness,
): ProviderAdapter & {
  readiness: FakeReadiness;
  permissionEvidence: PermissionCapabilityEvidence | null;
} {
  const adapter = {
    id,
    displayName: id === 'codex-cli' ? 'Codex CLI' : 'Claude Code',
    testedVersionRange: { min: '0.0.0', maxExclusive: '999.0.0' },
    capabilities: {
      interactivePty: true as const,
      structuredActivity: false as const,
      cleanStopStrategy: 'slash_exit' as const,
      bridgeConfiguration: 'session_scoped_stdio_mcp' as const,
      configurationFailureBehavior: 'manual_only' as const,
      supervisorConfigurationFailureBehavior: 'held' as const,
      permissionPolicies: ['manual', 'auto', 'bounded_allowlist', 'break_glass_bypass'] as const,
    },
    executableCandidates: [],
    readiness,
    permissionEvidence: null as PermissionCapabilityEvidence | null,
    async probe(_ctx: ProbeContext): Promise<ReadinessResult> {
      const r = readiness;
      return {
        providerId: id,
        resolvedExecutable: r.resolvedExecutable,
        executableKind: r.resolvedExecutable ? ('native' as const) : null,
        version: r.version,
        availability: r.availability,
        authentication: r.authentication,
        reasonCode: r.availability === 'available' ? null : 'FAKE_REASON',
        safeSummary: `${id === 'codex-cli' ? 'Codex CLI' : 'Claude Code'} is ${r.availability}`,
      };
    },
    buildLaunch(ctx) {
      return {
        executable: ctx.resolvedExecutable,
        args: [
          '--fake',
          ...(ctx.runtimeSelection.model ? ['--model', ctx.runtimeSelection.model] : []),
          ...(ctx.runtimeSelection.effort ? ['--effort', ctx.runtimeSelection.effort] : []),
          ...(ctx.bridgeConfig?.providerConfigPath
            ? ['--mcp-config', ctx.bridgeConfig.providerConfigPath]
            : []),
          ...(ctx.bridgeConfig?.codexConfigOverrides?.flatMap((value) => ['--config', value]) ??
            []),
        ],
        cwd: ctx.canonicalWorkspacePath,
        environmentPolicy: 'inherit-sanitized' as const,
        terminal: ctx.terminal,
      };
    },
    buildLaunchDisclosure(ctx) {
      return profileLaunchDisclosure(id, ctx);
    },
    buildCleanStop() {
      return { writes: ['/exit\r'], graceMs: 3000 };
    },
    permissionCapabilityEvidence() {
      return this.permissionEvidence;
    },
  } satisfies ProviderAdapter & {
    readiness: FakeReadiness;
    permissionEvidence: PermissionCapabilityEvidence | null;
  };
  return adapter;
}

export const READY: FakeReadiness = {
  resolvedExecutable: 'C:\\tools\\agent.exe',
  version: '1.2.3',
  availability: 'available',
  authentication: 'authenticated',
};

// --- world ---------------------------------------------------------------------

export interface FakeWorld {
  ctx: Context;
  router: Router;
  native: FakeNative;
  hosts: FakeHost[];
  events: { name: string; payload: unknown }[];
  ports: { sessionId: string; port: MessagePortMain }[];
  pickerPath: string | null;
  clock: { now: number };
  adapters: Record<'codex-cli' | 'claude-code', ReturnType<typeof fakeAdapter>>;
  call<T = unknown>(name: string, payload?: unknown): Promise<Envelope<T>>;
  /** Unwraps or throws with the code in the message. */
  ok<T = unknown>(name: string, payload?: unknown): Promise<T>;
  /** Registers a folder so the picker + native module know it. */
  addDir(path: string, dir: FakeDir): void;
  approve(path: string): Promise<{ id: string }>;
  launch(workspaceId: string, providerId?: 'codex-cli' | 'claude-code'): Promise<{ id: string }>;
  until(predicate: () => boolean, timeoutMs?: number): Promise<void>;
}

export function createWorld(
  options: { degraded?: boolean; noStorage?: boolean; reconRoot?: string } = {},
): FakeWorld {
  const log = createLogger({ write() {} });
  const native = new FakeNative();
  const hosts: FakeHost[] = [];
  const events: FakeWorld['events'] = [];
  const ports: FakeWorld['ports'] = [];
  const clock = { now: Date.parse('2026-08-28T12:00:00.000Z') };
  const rendererEvents: RendererEvents = {
    emit: (name, payload) => events.push({ name, payload }),
    transferStreamPort: (sessionId, port) => ports.push({ sessionId, port }),
  };
  const health = new StorageHealth(
    log,
    options.degraded ?? false,
    options.degraded ? 'TEST' : null,
  );
  health.attach(rendererEvents);

  const adapters = {
    'codex-cli': fakeAdapter('codex-cli', { ...READY }),
    'claude-code': fakeAdapter('claude-code', {
      ...READY,
      resolvedExecutable: 'C:\\tools\\claude.exe',
    }),
  };

  const storage = options.noStorage ? null : openStorage(':memory:');
  if (storage) {
    for (const adapter of Object.values(adapters)) {
      storage.repositories.definitions.upsertBuiltIn({
        id: adapter.id,
        displayName: adapter.displayName,
        providerKind: adapter.id,
        executableCandidates: [],
        testedVersionRange: '0.0.0 <999.0.0',
        capabilities: adapter.capabilities,
      });
    }
  }

  let nextPid = 5000;
  const world: FakeWorld = {
    native,
    hosts,
    events,
    ports,
    pickerPath: null,
    clock,
    adapters,
    router: undefined as unknown as Router,
    ctx: {
      log,
      clock: () => new Date(clock.now),
      native,
      hosts: {
        spawn: () => {
          const host = new FakeHost((nextPid += 10), native);
          hosts.push(host);
          return host;
        },
      },
      channels: {
        create: () => {
          const channel = new MessageChannel();
          return {
            hostPort: channel.port1 as unknown as MessagePortMain,
            rendererPort: channel.port2 as unknown as MessagePortMain,
          };
        },
      },
      picker: { pickDirectory: async () => world.pickerPath },
      profilePicker: { pickFile: async () => null },
      agentExportPicker: { pickTarget: async () => null },
      events: rendererEvents,
      storage,
      health,
      leases: new ControllerLeases(),
      jobs: new JobRegistry(native, log),
      live: new Map(),
      tokens: {
        candidates: new TokenStore(60_000, () => clock.now),
        previews: new TokenStore(60_000, () => clock.now),
        stops: new TokenStore(60_000, () => clock.now),
        forces: new TokenStore(60_000, () => clock.now),
      },
      selection: { selectedSessionId: null },
      adapters: [adapters['codex-cli'], adapters['claude-code']],
      probes: {
        context: () => ({
          roots: { LOCALAPPDATA: null, APPDATA: null, PROGRAMFILES: null, USERPROFILE: null },
          pathEntries: [],
          excludedDirectories: [],
          timeoutMs: 1000,
          fs: { isFile: async () => false },
          exec: async () => ({ stdout: '', stderr: '', exitCode: 1, timedOut: false }),
        }),
      },
      // Lazy by design: no directory exists until a recon run creates one.
      reconRoot: () => options.reconRoot ?? join(tmpdir(), 'threadhelm-test-recon'),
      appInfo: { version: '0.0.0-test', electronVersion: '44.0.0', arch: 'x64' },
      quit: vi.fn(),
    },
    call: (name, payload) => world.router.dispatch(name, payload, SENDER) as never,
    async ok(name, payload) {
      const result = await world.call(name, payload);
      if (!result.ok) throw new Error(`${name} → ${result.error.code}: ${result.error.message}`);
      return result.value as never;
    },
    addDir: (path, dir) => native.dirs.set(path, dir),
    async approve(path) {
      world.pickerPath = path;
      const candidate = await world.ok<{ candidateToken: string }>('workspaces.choose');
      return world.ok('workspaces.approve', { candidateToken: candidate.candidateToken });
    },
    async launch(workspaceId, providerId = 'codex-cli') {
      const preview = await world.ok<{ previewToken: string }>('sessions.previewLaunch', {
        workspaceId,
        providerId,
        terminal: { columns: 100, rows: 30 },
      });
      return world.ok('sessions.launch', {
        previewToken: preview.previewToken,
        boundaryConfirmation: true,
      });
    },
    async until(predicate, timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs;
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error('until: timed out');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
  };
  world.router = createRouter(createHandlers(world.ctx), {
    isAllowedOrigin: (url) => url === FRAME_URL,
    log,
  });
  return world;
}

export function errorCode<T>(envelope: Envelope<T>): string {
  return envelope.ok ? 'OK' : envelope.error.code;
}

export function eventsNamed(world: FakeWorld, name: string): unknown[] {
  return world.events.filter((e) => e.name === name).map((e) => e.payload);
}
