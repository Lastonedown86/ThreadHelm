/**
 * Shared harness: launches the built desktop app under Playwright's Electron
 * driver with an isolated userData directory and the test hooks switch, and
 * exposes typed access to the main-process hooks and the renderer page.
 *
 * Used by e2e specs (tests/e2e) and by Windows integration tests
 * (tests/integration/windows) that need the real coordinator.
 */

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PowerEvent, ProviderId } from '@threadhelm/contracts';
import type { FakeAgentMode } from '@threadhelm/test-fixtures';

export const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
export const desktopDir = resolve(repoRoot, 'apps/desktop');
export const mainEntry = resolve(desktopDir, 'out/main/index.cjs');

type Envelope<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: Record<string, unknown> } };

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  userData: string;
  /** Calls a contract operation through the same router the renderer uses. */
  dispatch<T = unknown>(name: string, payload?: unknown): Promise<Envelope<T>>;
  /** Like dispatch but unwraps, throwing on a contract error. */
  call<T = unknown>(name: string, payload?: unknown): Promise<T>;
  setPickerPath(path: string | null): Promise<void>;
  useFixtureAdapters(
    modes: Partial<Record<ProviderId, FakeAgentMode>>,
    lines?: number,
  ): Promise<void>;
  liveSessions(): Promise<{ id: string; state: string; hostPid: number; rootPid: number | null }[]>;
  jobSnapshot(
    sessionId: string,
  ): Promise<{ activeProcessCount: number; processIds: number[] } | null>;
  simulatePower(event: PowerEvent): Promise<void>;
  /** Test-only: hold the next host-ready message so `starting` is observable. */
  delayNextHostReady(ms: number): Promise<void>;
  /** Hard-kills the coordinator with no cleanup; resolves once the process is gone. */
  crashCoordinator(): Promise<void>;
  close(): Promise<void>;
}

export interface LaunchOptions {
  userData?: string;
  args?: string[];
  /** Absolute path to a packaged executable instead of electron + out/main. */
  executablePath?: string;
}

export function makeUserData(): string {
  return mkdtempSync(join(tmpdir(), 'threadhelm-e2e-'));
}

export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const userData = options.userData ?? makeUserData();
  const args = [
    ...(options.executablePath ? [] : [mainEntry]),
    '--threadhelm-test-hooks',
    `--user-data-dir=${userData}`,
    ...(options.args ?? []),
  ];
  const app = await electron.launch({
    args,
    ...(options.executablePath ? { executablePath: options.executablePath } : {}),
    cwd: desktopDir,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' },
    timeout: 60_000,
  });
  const page = await app.firstWindow({ timeout: 60_000 });
  await page.waitForLoadState('domcontentloaded');

  const hooks = <T>(script: string, arg?: unknown) =>
    app.evaluate(
      (_electron, { script, arg }) => {
        const fn = new Function('hooks', 'arg', `return (${script})`) as (
          hooks: unknown,
          arg: unknown,
        ) => unknown;
        const g = globalThis as unknown as { __threadhelmTest: unknown };
        // Inspector evaluation may interrupt Electron main while a synchronous
        // SQLite statement is active. Queue test authority on the ordinary
        // event loop so repository calls cannot re-enter better-sqlite3.
        return new Promise<T>((resolve, reject) => {
          setImmediate(() => {
            try {
              Promise.resolve(fn(g.__threadhelmTest, arg) as T).then(resolve, reject);
            } catch (error) {
              reject(error as Error);
            }
          });
        });
      },
      { script, arg },
    ) as Promise<T>;

  const dispatch = <T>(name: string, payload?: unknown) =>
    hooks<Envelope<T>>('hooks.dispatch(arg.name, arg.payload)', { name, payload });

  const launched: LaunchedApp = {
    app,
    page,
    userData,
    dispatch,
    async call(name, payload) {
      const result = await dispatch<unknown>(name, payload);
      if (!result.ok) {
        throw new Error(`${name} failed: ${result.error.code} ${result.error.message}`);
      }
      return result.value as never;
    },
    setPickerPath: (path) => hooks('hooks.setPickerPath(arg)', path),
    useFixtureAdapters: (modes, lines) =>
      hooks('hooks.useFixtureAdapters(arg.modes, arg.lines)', { modes, lines }),
    liveSessions: () => hooks('hooks.liveSessions()'),
    jobSnapshot: (sessionId) => hooks('hooks.jobSnapshot(arg)', sessionId),
    simulatePower: (event) => hooks('hooks.simulatePower(arg)', event),
    delayNextHostReady: (ms) => hooks('hooks.delayNextHostReady(arg)', ms),
    async crashCoordinator() {
      // app.process() is Playwright's cli wrapper; the coordinator is the browser process.
      const pid = await app.evaluate(() => process.pid);
      // Kill from the runner rather than asking Electron to terminate itself.
      // On Windows the in-process SIGKILL path can surface an exception-breakpoint
      // dialog under Playwright, preventing the crash-recovery test from cleaning up.
      process.kill(pid, 'SIGKILL');
      await waitForPidExit(pid, 20_000);
    },
    async close() {
      try {
        await app.close();
      } catch {
        /* already gone */
      }
    },
  };
  return launched;
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function waitForPidExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return !isPidAlive(pid);
}

export async function waitFor<T>(
  probe: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 20_000,
  intervalMs = 200,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await probe();
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await probe();
  }
  if (!predicate(last)) throw new Error(`condition not met within ${timeoutMs}ms`);
  return last;
}

export function cleanupUserData(userData: string): void {
  try {
    rmSync(userData, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

/** Approves `dir` through the picker path and returns the workspace view. */
export async function approveFolder(
  app: LaunchedApp,
  dir: string,
): Promise<{ id: string; displayPath: string; canonicalPath: string }> {
  await app.setPickerPath(dir);
  const candidate = await app.call<{ candidateToken: string }>('workspaces.choose');
  return app.call('workspaces.approve', { candidateToken: candidate.candidateToken });
}

/** Full preview + confirmed launch for a provider in an approved workspace. */
export async function launchFixtureSession(
  app: LaunchedApp,
  workspaceId: string,
  providerId: ProviderId,
): Promise<{ id: string; lifecycleState: string }> {
  const preview = await app.call<{ previewToken: string }>('sessions.previewLaunch', {
    workspaceId,
    providerId,
    terminal: { columns: 100, rows: 30 },
  });
  return app.call('sessions.launch', {
    previewToken: preview.previewToken,
    boundaryConfirmation: true,
  });
}
