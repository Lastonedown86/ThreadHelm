/**
 * T077 — lock/suspend/resume/unlock reconciliation never restarts or replays
 * (FR-030, SC-016), and a second launch never becomes a second controller
 * (FR-028, SC-014).
 */

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { PowerEvent } from '@threadhelm/contracts';
import {
  cleanupUserData,
  events,
  isPidAlive,
  launchApp,
  launchIn,
  mkWorkspace,
  pidsOf,
  sessionOf,
  waitFor,
  type LaunchedApp,
} from './helpers/harness.js';

let app: LaunchedApp;
const dirs: string[] = [];

beforeEach(async () => {
  app = await launchApp();
  await app.useFixtureAdapters({ 'codex-cli': 'echo', 'claude-code': 'echo' });
});

afterEach(async () => {
  await app.close();
  cleanupUserData(app.userData);
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it('rechecks every session on power transitions without restarting anything', async () => {
  const a = mkWorkspace('a');
  const b = mkWorkspace('b');
  dirs.push(a, b);
  const one = await launchIn(app, a, 'codex-cli');
  const two = await launchIn(app, b, 'claude-code');
  const pidsBefore = [await pidsOf(app, one.session.id), await pidsOf(app, two.session.id)];
  const eventsBefore = [
    (await events(app, one.session.id)).length,
    (await events(app, two.session.id)).length,
  ];

  for (const event of ['lock', 'suspend', 'resume', 'unlock'] as PowerEvent[]) {
    await app.simulatePower(event);
    for (const [i, s] of [one, two].entries()) {
      const row = await sessionOf(app, s.session.id);
      expect(row.lifecycleState, event).toBe('running');
      expect(row.activityState, event).toBe('unknown');
      expect(await pidsOf(app, s.session.id)).toEqual(pidsBefore[i]);
      expect((await events(app, s.session.id)).length).toBe(eventsBefore[i]);
    }
  }

  // A provider that died while the machine was asleep is reported, not revived.
  const rootPid = (await app.liveSessions()).find((l) => l.id === one.session.id)!.rootPid!;
  process.kill(rootPid);
  await app.simulatePower('resume');
  const ended = await waitFor(
    () => sessionOf(app, one.session.id),
    (s) => s.lifecycleState === 'stopped' || s.lifecycleState === 'failed',
    15_000,
  );
  expect(ended.endedAt).not.toBeNull();
  expect((await sessionOf(app, two.session.id)).lifecycleState).toBe('running');
  expect(await pidsOf(app, two.session.id)).toEqual(pidsBefore[1]);
  expect((await app.liveSessions()).map((l) => l.id)).toEqual([two.session.id]);
  for (const pid of pidsBefore[0]!) expect(isPidAlive(pid)).toBe(false);
}, 90_000);

it('a second launch with the same user data exits without becoming a controller', async () => {
  const dir = mkWorkspace('single');
  dirs.push(dir);
  const { session } = await launchIn(app, dir, 'codex-cli');
  const pids = await pidsOf(app, session.id);

  const desktop = resolve(process.cwd(), 'apps/desktop');
  const second = spawn(
    resolve(desktop, 'node_modules/electron/dist/electron.exe'),
    [resolve(desktop, 'out/main/index.cjs'), `--user-data-dir=${app.userData}`],
    { cwd: desktop, stdio: 'ignore', windowsHide: true },
  );
  const code = await new Promise<number | null>((resolveCode) => {
    const timer = setTimeout(() => {
      second.kill();
      resolveCode(-1);
    }, 15_000);
    second.on('exit', (c) => {
      clearTimeout(timer);
      resolveCode(c);
    });
  });
  expect(code).toBe(0);

  expect((await app.call<{ version: string }>('application.getInfo')).version).toBeTruthy();
  expect((await sessionOf(app, session.id)).lifecycleState).toBe('running');
  expect(await pidsOf(app, session.id)).toEqual(pids);
  expect(await app.liveSessions()).toHaveLength(1);
}, 60_000);
