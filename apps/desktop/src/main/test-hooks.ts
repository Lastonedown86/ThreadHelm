/**
 * Test hooks — installed ONLY when the app is started with
 * `--threadhelm-test-hooks`. They give Playwright/vitest harnesses the same
 * router the renderer uses, a way to answer the native folder picker without
 * a dialog, fixture-backed provider adapters, and crash/power simulation.
 *
 * Production operations still go through their normal boundaries. Extra test
 * authority is explicit: picker substitution and authenticated-provider
 * outcome simulation for deterministic bridge-independent E2E coverage.
 */

import { app } from 'electron';
import type { PowerEvent, ProviderId, WorkOutcome } from '@threadhelm/contracts';
import {
  fixtureAdapter,
  resolveFixtureRuntime,
  type FakeAgentMode,
} from '@threadhelm/test-fixtures';
import type { Context, HostHandle } from './context.js';
import type { Envelope, Router } from './ipc/router.js';
import { reconcileLiveSessions } from './recovery/power-events.js';
import { failSession } from './sessions/failure.js';

export const TEST_HOOKS_SWITCH = 'threadhelm-test-hooks';

export interface TestHooks {
  dispatch(name: string, payload?: unknown): Promise<Envelope<unknown>>;
  setPickerPath(path: string | null): void;
  useFixtureAdapters(modes: Partial<Record<ProviderId, FakeAgentMode>>, lines?: number): void;
  liveSessions(): { id: string; state: string; hostPid: number; rootPid: number | null }[];
  jobSnapshot(sessionId: string): { activeProcessCount: number; processIds: number[] } | null;
  simulatePower(event: PowerEvent): void;
  delayNextHostReady(ms: number): void;
  delayNextControlApplied(ms: number): void;
  failNextHostInput(): void;
  failSession(sessionId: string): void;
  reportProviderOutcome(
    sessionId: string,
    handoffId: string,
    outcome: WorkOutcome,
  ): { handoffId: string; workOutcome: WorkOutcome };
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
  let nextControlAppliedDelayMs = 0;
  let rejectNextHostInput = false;
  const productionHosts = ctx.hosts;
  ctx.hosts = {
    spawn(sessionId) {
      const host = productionHosts.spawn(sessionId);
      const delayMs = nextHostReadyDelayMs;
      nextHostReadyDelayMs = 0;
      const delayed: HostHandle = {
        get pid() {
          return host.pid;
        },
        postMessage(message, ports) {
          if (message.type === 'host.input' && rejectNextHostInput) {
            rejectNextHostInput = false;
            throw new Error('TEST_INPUT_REJECTED_BEFORE_WRITE');
          }
          host.postMessage(message, ports);
        },
        onMessage(listener) {
          host.onMessage((message) => {
            const type =
              message && typeof message === 'object'
                ? (message as { type?: unknown }).type
                : undefined;
            if (type === 'host.ready' && delayMs > 0) {
              setTimeout(() => listener(message), delayMs);
            } else if (type === 'host.controlApplied' && nextControlAppliedDelayMs > 0) {
              const controlDelayMs = nextControlAppliedDelayMs;
              nextControlAppliedDelayMs = 0;
              setTimeout(() => listener(message), controlDelayMs);
            } else listener(message);
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
    delayNextControlApplied: (ms) => {
      nextControlAppliedDelayMs = Math.max(0, Math.min(ms, 30_000));
    },
    failNextHostInput: () => {
      rejectNextHostInput = true;
    },
    failSession: (sessionId) => {
      const live = ctx.live.get(sessionId);
      if (!live) throw new Error('TEST_SESSION_NOT_LIVE');
      failSession(ctx, live, 'TEST_HOST_EXITED_DURING_DISPATCH');
    },
    reportProviderOutcome: (sessionId, handoffId, outcome) => {
      if (!ctx.live.has(sessionId)) throw new Error('TEST_SESSION_NOT_LIVE');
      const repository = ctx.storage?.repositories.coordination;
      if (!repository) throw new Error('TEST_STORAGE_UNAVAILABLE');
      const handoff = repository.reportWorkOutcome(
        handoffId,
        sessionId,
        outcome,
        null,
        ctx.clock().toISOString(),
      );
      return { handoffId: handoff.id, workOutcome: handoff.workOutcome };
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
