/**
 * Test hooks — installed ONLY when the app is started with
 * `--threadhelm-test-hooks`. They give Playwright/vitest harnesses the same
 * router the renderer uses, a way to answer the native folder picker without
 * a dialog, fixture-backed provider adapters, and crash/power simulation.
 *
 * Nothing here weakens a boundary the renderer is held to: every operation
 * still goes through schema validation, identity checks, leases, and Job
 * Object containment. The only extra authority is choosing a picker path,
 * which replaces the OS dialog, not the approval flow.
 */

import { app } from 'electron';
import type { PowerEvent, ProviderId } from '@threadhelm/contracts';
import {
  fixtureAdapter,
  resolveFixtureRuntime,
  type FakeAgentMode,
} from '@threadhelm/test-fixtures';
import type { Context, HostHandle } from './context.js';
import type { Envelope, Router } from './ipc/router.js';
import { reconcileLiveSessions } from './recovery/power-events.js';

export const TEST_HOOKS_SWITCH = 'threadhelm-test-hooks';

export interface TestHooks {
  dispatch(name: string, payload?: unknown): Promise<Envelope<unknown>>;
  setPickerPath(path: string | null): void;
  useFixtureAdapters(modes: Partial<Record<ProviderId, FakeAgentMode>>, lines?: number): void;
  liveSessions(): { id: string; state: string; hostPid: number; rootPid: number | null }[];
  jobSnapshot(sessionId: string): { activeProcessCount: number; processIds: number[] } | null;
  simulatePower(event: PowerEvent): void;
  delayNextHostReady(ms: number): void;
  storagePath(): string;
  breakStorage(): void;
  version(): string;
}

export function testHooksEnabled(): boolean {
  return app.commandLine.hasSwitch(TEST_HOOKS_SWITCH);
}

export function installTestHooks(ctx: Context, router: Router, allowedOrigin: () => string): void {
  let pickerPath: string | null = null;
  let nextHostReadyDelayMs = 0;
  const productionHosts = ctx.hosts;
  ctx.hosts = {
    spawn(sessionId) {
      const host = productionHosts.spawn(sessionId);
      const delayMs = nextHostReadyDelayMs;
      nextHostReadyDelayMs = 0;
      if (delayMs === 0) return host;
      const delayed: HostHandle = {
        get pid() {
          return host.pid;
        },
        postMessage: (message, ports) => host.postMessage(message, ports),
        onMessage(listener) {
          host.onMessage((message) => {
            const type =
              message && typeof message === 'object'
                ? (message as { type?: unknown }).type
                : undefined;
            if (type === 'host.ready') setTimeout(() => listener(message), delayMs);
            else listener(message);
          });
        },
        onExit: (listener) => host.onExit(listener),
        kill: () => host.kill(),
      };
      return delayed;
    },
  };
  ctx.picker = { pickDirectory: async () => pickerPath };

  const hooks: TestHooks = {
    dispatch: (name, payload) =>
      router.dispatch(name, payload, { frameUrl: allowedOrigin(), isMainFrame: true }),
    setPickerPath: (path) => {
      pickerPath = path;
    },
    useFixtureAdapters: (modes, lines) => {
      ctx.adapters = ctx.adapters.map((adapter) => {
        const mode = modes[adapter.id];
        if (!mode) return adapter;
        return fixtureAdapter({
          id: adapter.id,
          mode,
          executable: resolveFixtureRuntime() ?? process.execPath,
          ...(lines !== undefined ? { lines } : {}),
        });
      });
    },
    liveSessions: () =>
      [...ctx.live.values()].map((live) => ({
        id: live.id,
        state: live.state,
        hostPid: live.hostPid,
        rootPid: live.rootPid,
      })),
    jobSnapshot: (sessionId) => {
      const live = ctx.live.get(sessionId);
      if (!live) return null;
      try {
        const snapshot = ctx.native.inspectJob(live.jobToken);
        return { activeProcessCount: snapshot.activeProcessCount, processIds: snapshot.processIds };
      } catch {
        return null;
      }
    },
    simulatePower: (event) => reconcileLiveSessions(ctx, event),
    delayNextHostReady: (ms) => {
      nextHostReadyDelayMs = Math.max(0, Math.min(ms, 30_000));
    },
    storagePath: () => ctx.storage?.db.name ?? '',
    breakStorage: () => {
      ctx.storage?.db.close();
    },
    version: () => app.getVersion(),
  };
  (globalThis as unknown as { __threadhelmTest: TestHooks }).__threadhelmTest = hooks;
  ctx.log.warn('test_hooks.installed', { enabled: true });
}
