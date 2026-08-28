/**
 * T091 — measurable budgets from plan.md / quickstart.md on this machine.
 * Numbers are printed so a release run can record them; the idle CPU window
 * is 20 s here (the plan's budget is stated over 60 s) to keep CI fast.
 */

import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupUserData,
  launchApp,
  launchIn,
  listSessions,
  mkWorkspace,
  processesMatching,
  sendInput,
  sleep,
  waitFor,
  waitForPidExit,
  type LaunchedApp,
} from './helpers/harness.js';

const MiB = 1024 * 1024;
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

async function fourEchoSessions(a: LaunchedApp) {
  await a.useFixtureAdapters({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const ids: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    ids.push((await launchIn(a, ws(String(i)), i % 2 ? 'claude-code' : 'codex-cli')).session.id);
  }
  return ids;
}

function appWorkingSetMiB(needle: string): number {
  return processesMatching(needle).reduce((sum, p) => sum + p.workingSet, 0) / MiB;
}

describe('performance budgets', () => {
  it('recovery view for four crashed sessions is usable within 5 s', async () => {
    app = await launchApp();
    userData = app.userData;
    const ids = await fourEchoSessions(app);
    const pids = (await Promise.all(ids.map((id) => app!.jobSnapshot(id)))).flatMap(
      (s) => s?.processIds ?? [],
    );
    await app.crashCoordinator();
    for (const pid of pids) await waitForPidExit(pid, 10_000);

    const t0 = performance.now();
    app = await launchApp({ userData });
    const list = await waitFor(
      () => listSessions(app!),
      (l) => l.recoveryRecords.length === 4,
      5_000,
    );
    const ms = performance.now() - t0;
    console.log(`recovery view ready in ${ms.toFixed(0)} ms`);
    expect(list.recoveryRecords).toHaveLength(4);
    expect(ms).toBeLessThanOrEqual(5_000);
  }, 120_000);

  it('selected-session input is acknowledged within 100 ms (p95)', async () => {
    app = await launchApp();
    userData = app.userData;
    await app.useFixtureAdapters({ 'codex-cli': 'echo' });
    const { session } = await launchIn(app, ws('input'), 'codex-cli');
    await app.call('sessions.select', { sessionId: session.id });
    const samples: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      const t0 = performance.now();
      const result = await sendInput(app, session.id, `line ${i}\r`);
      samples.push(performance.now() - t0);
      expect(result.ok).toBe(true);
    }
    samples.sort((x, y) => x - y);
    const p95 = samples[Math.floor(samples.length * 0.95) - 1]!;
    const median = samples[Math.floor(samples.length / 2)]!;
    console.log(`input ack: median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`);
    expect(p95).toBeLessThanOrEqual(100);
  }, 60_000);

  it.todo(
    '95% of output visible within 1 s — renderer-side measurement (xterm write completion), not observable from main-process hooks',
  );

  it('idle with no sessions: median CPU at or below 1% of one core over 20 s', async () => {
    app = await launchApp();
    userData = app.userData;
    await sleep(3_000); // let startup work settle
    const windows: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const before = processesMatching(userData).reduce((sum, p) => sum + p.cpuMs, 0);
      const t0 = performance.now();
      await sleep(5_000);
      const after = processesMatching(userData).reduce((sum, p) => sum + p.cpuMs, 0);
      windows.push(((after - before) / (performance.now() - t0)) * 100);
    }
    windows.sort((x, y) => x - y);
    const median = (windows[1]! + windows[2]!) / 2;
    console.log(
      `idle CPU windows (% of one core): ${windows.map((w) => w.toFixed(2)).join(', ')}; median ${median.toFixed(2)}`,
    );
    // ponytail: a shared dev box is noisy; soft so the number is recorded, not hidden.
    expect.soft(median).toBeLessThanOrEqual(1);
  }, 60_000);

  it('working set: ≤ 250 MiB with no sessions, ≤ 700 MiB with four idle sessions', async () => {
    app = await launchApp();
    userData = app.userData;
    await sleep(2_000);
    const idle = appWorkingSetMiB(userData);
    console.log(`working set, no sessions: ${idle.toFixed(0)} MiB`);
    expect.soft(idle).toBeLessThanOrEqual(250);

    await fourEchoSessions(app);
    await sleep(3_000);
    const loaded = appWorkingSetMiB(userData);
    console.log(`working set, four idle sessions: ${loaded.toFixed(0)} MiB`);
    expect(loaded).toBeLessThanOrEqual(700);
  }, 90_000);
});
