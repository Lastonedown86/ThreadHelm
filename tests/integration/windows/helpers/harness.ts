/**
 * Small additions on top of tests/e2e/helpers/app.ts for the Windows
 * integration suites: byte input through the hooks, temp workspaces with
 * spaces + Unicode, state polling, and process accounting by userData path.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProviderId } from '@threadhelm/contracts';
import {
  approveFolder,
  launchFixtureSession,
  waitFor,
  type LaunchedApp,
} from '../../../e2e/helpers/app.js';

export {
  approveFolder,
  cleanupUserData,
  launchApp,
  launchFixtureSession,
  waitFor,
  isPidAlive,
  waitForPidExit,
} from '../../../e2e/helpers/app.js';
export type { LaunchedApp } from '../../../e2e/helpers/app.js';

export interface SessionRow {
  id: string;
  lifecycleState: string;
  activityState: string;
  stopKind: string | null;
  truncationCount: number;
  forceStopAvailable: boolean;
  endedAt: string | null;
  workspaceId: string;
}

export interface EventRow {
  kind: string;
  fromState: string | null;
  toState: string | null;
  reasonCode: string | null;
  safeSummary: string;
}

export interface RecoveryRow {
  id: string;
  sessionId: string;
  classification: string;
  lastKnownState: string;
  resolvedAt: string | null;
}

export function mkWorkspace(tag: string): string {
  return mkdtempSync(join(tmpdir(), `thm ws ünï ${tag} `));
}

/** Bytes are built inside the main process: structured clone must not touch them. */
export async function sendInput(app: LaunchedApp, sessionId: string, text: string) {
  return app.app.evaluate(
    (_electron, arg) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(name: string, payload: unknown): Promise<unknown> };
      };
      return g.__threadhelmTest.dispatch('sessions.sendInput', {
        sessionId: arg.sessionId,
        bytes: Uint8Array.from(arg.bytes),
      }) as Promise<
        { ok: true; value: { controlSequence: number } } | { ok: false; error: { code: string } }
      >;
    },
    { sessionId, bytes: [...Buffer.from(text, 'utf8')] },
  );
}

export async function listSessions(app: LaunchedApp) {
  return app.call<{
    sessions: SessionRow[];
    recoveryRecords: RecoveryRow[];
    storageDegraded: boolean;
  }>('sessions.list');
}

export async function sessionOf(app: LaunchedApp, id: string): Promise<SessionRow> {
  const list = await listSessions(app);
  const row = list.sessions.find((s) => s.id === id);
  if (!row) throw new Error(`session ${id} missing`);
  return row;
}

export function waitForState(app: LaunchedApp, id: string, state: string, timeoutMs = 30_000) {
  return waitFor(
    () => sessionOf(app, id),
    (s) => s.lifecycleState === state,
    timeoutMs,
  );
}

export async function events(app: LaunchedApp, sessionId: string): Promise<EventRow[]> {
  return app.call<EventRow[]>('sessions.events', { sessionId });
}

export async function launchIn(app: LaunchedApp, dir: string, providerId: ProviderId) {
  const ws = await approveFolder(app, dir);
  const session = await launchFixtureSession(app, ws.id, providerId);
  return { ws, session };
}

export async function cleanStop(app: LaunchedApp, sessionId: string, timeoutMs = 30_000) {
  const stop = await app.call<{ stopToken: string }>('sessions.requestStop', { sessionId });
  await app.call('sessions.confirmStop', { stopToken: stop.stopToken });
  return waitForState(app, sessionId, 'stopped', timeoutMs);
}

export async function forceStop(app: LaunchedApp, sessionId: string) {
  const d = await app.call<{ forceToken: string; processCount: number; risk: string }>(
    'sessions.requestForceStop',
    { sessionId },
  );
  await app.call('sessions.confirmForceStop', { forceToken: d.forceToken });
  return d;
}

export async function pidsOf(app: LaunchedApp, sessionId: string): Promise<number[]> {
  return (await app.jobSnapshot(sessionId))?.processIds ?? [];
}

export interface ProcInfo {
  pid: number;
  name: string;
  workingSet: number;
  /** Total CPU time in ms (kernel + user). */
  cpuMs: number;
  commandLine: string;
}

/** Every process whose command line mentions `needle` (e.g. the userData path). */
export function processesMatching(needle: string): ProcInfo[] {
  const script = `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like '*${needle.replace(/'/g, "''")}*' } | ForEach-Object { $_.ProcessId.ToString() + '|' + $_.Name + '|' + $_.WorkingSetSize + '|' + (($_.KernelModeTime + $_.UserModeTime) / 10000) + '|' + $_.CommandLine }`;
  const out = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  return out
    .split(/\r?\n/)
    .filter((l) => l.includes('|'))
    .map((l) => {
      const [pid, name, ws, cpu, ...rest] = l.split('|');
      return {
        pid: Number(pid),
        name: name ?? '',
        workingSet: Number(ws),
        cpuMs: Number(cpu),
        commandLine: rest.join('|'),
      };
    });
}

export function nodeFixtureProcesses(): ProcInfo[] {
  return processesMatching('fake-agent.cjs').filter((p) => p.name.toLowerCase() === 'node.exe');
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function killPids(pids: number[]): void {
  for (const pid of pids) {
    try {
      process.kill(pid);
    } catch {
      /* gone */
    }
  }
}
