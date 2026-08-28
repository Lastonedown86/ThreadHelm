/**
 * T076 — crashes during running / stopping / interrupting / heavy output
 * become honest recovery records on restart; nothing is relaunched or
 * replayed (FR-018..FR-020, SC-005, SC-006). Also T083: corrupt storage is
 * preserved and repaired, never silently replaced.
 */

import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanStop,
  cleanupUserData,
  events,
  launchApp,
  launchIn,
  listSessions,
  mkWorkspace,
  pidsOf,
  sendInput,
  sessionOf,
  waitFor,
  waitForPidExit,
  type LaunchedApp,
} from './helpers/harness.js';

let app: LaunchedApp | undefined;
const dirs: string[] = [];
let userData = '';

afterEach(async () => {
  await app?.close();
  app = undefined;
  if (userData) cleanupUserData(userData);
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const ws = (tag: string) => {
  const dir = mkWorkspace(tag);
  dirs.push(dir);
  return dir;
};

describe('restart after an unexpected coordinator exit', () => {
  it('classifies a crash while launch is still starting without relaunching', async () => {
    app = await launchApp();
    userData = app.userData;
    await app.useFixtureAdapters({ 'codex-cli': 'echo' });
    const dir = ws('starting');
    const workspace = await (async () => {
      await app!.setPickerPath(dir);
      const candidate = await app!.call<{ candidateToken: string }>('workspaces.choose');
      return app!.call<{ id: string }>('workspaces.approve', {
        candidateToken: candidate.candidateToken,
      });
    })();
    const preview = await app.call<{ previewToken: string }>('sessions.previewLaunch', {
      workspaceId: workspace.id,
      providerId: 'codex-cli',
      terminal: { columns: 100, rows: 30 },
    });
    await app.delayNextHostReady(5_000);
    const pendingLaunch = app
      .dispatch('sessions.launch', {
        previewToken: preview.previewToken,
        boundaryConfirmation: true,
      })
      .catch(() => undefined);
    const starting = await waitFor(
      () => listSessions(app!),
      (list) => list.sessions.some((session) => session.lifecycleState === 'starting'),
      10_000,
    );
    const startingId = starting.sessions.find(
      (session) => session.lifecycleState === 'starting',
    )!.id;

    await app.crashCoordinator();
    await pendingLaunch;
    app = await launchApp({ userData });
    expect(await app.liveSessions()).toEqual([]);
    const recovered = await listSessions(app);
    const row = recovered.sessions.find((session) => session.id === startingId)!;
    expect(row.lifecycleState).toBe('recovery_required');
    const record = recovered.recoveryRecords.find((item) => item.sessionId === startingId)!;
    expect(record.classification).toBe('interrupted_start');
    expect(record.lastKnownState).toBe('starting');
  }, 90_000);

  it('classifies every unfinished session and relaunches nothing', async () => {
    app = await launchApp();
    userData = app.userData;
    await app.useFixtureAdapters({ 'codex-cli': 'echo', 'claude-code': 'ignore-interrupt' });

    // E: ended cleanly before the crash — must stay exactly `stopped`.
    const clean = await launchIn(app, ws('clean'), 'codex-cli');
    const cleanRow = await cleanStop(app, clean.session.id);
    expect(cleanRow.stopKind).toBe('clean');

    // A: running.  B: stuck in stopping.  C: interrupting.  D: running under a burst.
    const running = await launchIn(app, ws('running'), 'codex-cli');
    const stopping = await launchIn(app, ws('stopping'), 'claude-code');
    const stop = await app.call<{ stopToken: string }>('sessions.requestStop', {
      sessionId: stopping.session.id,
    });
    await app.call('sessions.confirmStop', { stopToken: stop.stopToken });
    await app.useFixtureAdapters({ 'codex-cli': 'burst' }, 300_000);
    const bursting = await launchIn(app, ws('burst'), 'codex-cli');
    const interrupting = await launchIn(app, ws('interrupt'), 'claude-code');
    await app.call('sessions.interrupt', { sessionId: interrupting.session.id });

    const expected: Record<string, { classification: string; lastKnown: string }> = {
      [running.session.id]: { classification: 'unexpected_shutdown', lastKnown: 'running' },
      [stopping.session.id]: { classification: 'incomplete_stop', lastKnown: 'stopping' },
      [interrupting.session.id]: {
        classification: 'unexpected_shutdown',
        lastKnown: 'interrupting',
      },
      [bursting.session.id]: { classification: 'unexpected_shutdown', lastKnown: 'running' },
    };
    for (const [id, e] of Object.entries(expected)) {
      expect((await sessionOf(app, id)).lifecycleState).toBe(e.lastKnown);
    }
    const pids = (await Promise.all(Object.keys(expected).map((id) => pidsOf(app!, id)))).flat();
    expect(pids.length).toBeGreaterThanOrEqual(8);

    // Crash within the interrupt observation window (5 s).
    await app.crashCoordinator();
    for (const pid of pids) expect(await waitForPidExit(pid, 10_000)).toBe(true);

    app = await launchApp({ userData });
    await app.useFixtureAdapters({ 'codex-cli': 'echo', 'claude-code': 'echo' });
    expect(await app.liveSessions()).toEqual([]);
    const list = await listSessions(app);
    for (const [id, e] of Object.entries(expected)) {
      const row = list.sessions.find((s) => s.id === id)!;
      expect(row.lifecycleState).toBe('recovery_required');
      expect(row.endedAt).not.toBeNull();
      const record = list.recoveryRecords.find((r) => r.sessionId === id)!;
      expect(record.classification).toBe(e.classification);
      expect(record.lastKnownState).toBe(e.lastKnown);
      expect(record.resolvedAt).toBeNull();
      const history = await events(app, id);
      const reconciled = history.at(-1)!;
      expect(reconciled.kind).toBe('reconciled');
      expect(reconciled.toState).toBe('recovery_required');
    }
    const cleanAfter = list.sessions.find((s) => s.id === clean.session.id)!;
    expect(cleanAfter.lifecycleState).toBe('stopped');
    expect(cleanAfter.stopKind).toBe('clean');
    expect(list.recoveryRecords.some((r) => r.sessionId === clean.session.id)).toBe(false);
    // No input replay, no relaunch: still nothing live after a moment.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await app.liveSessions()).toEqual([]);
    for (const pid of pids) expect(await waitForPidExit(pid, 100)).toBe(true);

    // Explicit resolution is the only way out.
    const record = list.recoveryRecords.find((r) => r.sessionId === running.session.id)!;
    const resolved = await app.call<{ resolvedAt: string | null; resolution: string }>(
      'recovery.resolve',
      {
        recordId: record.id,
        resolution: 'dismissed',
      },
    );
    expect(resolved.resolution).toBe('dismissed');
    expect((await sessionOf(app, running.session.id)).lifecycleState).toBe('stopped');
    const again = await app.dispatch('recovery.resolve', {
      recordId: record.id,
      resolution: 'dismissed',
    });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('INVALID_RESOLUTION');
    // Input into a recovery-required session is impossible: it is not live.
    const dead = await sendInput(app, bursting.session.id, 'x\r');
    expect(dead.ok).toBe(false);
    if (!dead.ok) expect(dead.error.code).toBe('SESSION_NOT_FOUND');
  }, 180_000);
});

describe('storage repair', () => {
  it('preserves a corrupt database and opens a fresh one instead of inventing history', async () => {
    app = await launchApp();
    userData = app.userData;
    await app.useFixtureAdapters({ 'codex-cli': 'echo' });
    const { session } = await launchIn(app, ws('corrupt'), 'codex-cli');
    await cleanStop(app, session.id);
    const dbPath = await app.app.evaluate(() => {
      const g = globalThis as unknown as { __threadhelmTest: { storagePath(): string } };
      return g.__threadhelmTest.storagePath();
    });
    expect(existsSync(dbPath)).toBe(true);
    await app.close();

    writeFileSync(dbPath, Buffer.alloc(4096, 0x5a));
    app = await launchApp({ userData });
    const info = await app.call<{ storageDegraded: boolean }>('application.getInfo');
    expect(info.storageDegraded).toBe(false);
    const list = await listSessions(app);
    expect(list.sessions).toEqual([]);
    expect(list.recoveryRecords).toEqual([]);
    const preserved = readdirSync(dirname(dbPath)).filter((f) => f.includes('.preserved-'));
    expect(preserved.length).toBeGreaterThanOrEqual(1);
    // The repaired store works: a new workspace approval persists.
    const dir = ws('after-repair');
    await app.setPickerPath(dir);
    const cand = await app.call<{ candidateToken: string }>('workspaces.choose');
    const approved = await app.call<{ id: string }>('workspaces.approve', {
      candidateToken: cand.candidateToken,
    });
    expect(approved.id).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(
      () => app!.call<unknown[]>('workspaces.list'),
      (l) => l.length === 1,
      5_000,
    );
  }, 90_000);

  it.skip('read-only / locked database → degraded mode (needs a file lock the harness cannot hold across Electron startup)', () => {});
});
