/**
 * T066 — an unexpected coordinator exit closes every Job Object handle and
 * Windows terminates every supervised tree, grandchildren included (FR-029,
 * SC-015).
 */

import { rmSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import {
  cleanupUserData,
  isPidAlive,
  launchApp,
  launchIn,
  mkWorkspace,
  nodeFixtureProcesses,
  pidsOf,
  waitFor,
  waitForPidExit,
  type LaunchedApp,
} from './helpers/harness.js';

let app: LaunchedApp;
const dirs: string[] = [];

afterEach(async () => {
  await app.close();
  cleanupUserData(app.userData);
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it('leaves no session-started process alive after the coordinator dies', async () => {
  app = await launchApp();
  await app.useFixtureAdapters({ 'codex-cli': 'spawn-children', 'claude-code': 'spawn-children' });
  const pids: number[] = [];
  for (const providerId of ['codex-cli', 'claude-code'] as const) {
    const dir = mkWorkspace(providerId);
    dirs.push(dir);
    const { session } = await launchIn(app, dir, providerId);
    pids.push(
      ...(await waitFor(
        () => pidsOf(app, session.id),
        (p) => p.length >= 4,
        10_000,
      )),
    );
  }
  expect(pids.length).toBeGreaterThanOrEqual(8);
  for (const pid of pids) expect(isPidAlive(pid)).toBe(true);

  await app.crashCoordinator();

  for (const pid of pids) expect(await waitForPidExit(pid, 10_000)).toBe(true);
  // Other suites may run fixtures concurrently, so only our pids are checked
  // in the global list — but none of ours may still be a fake agent.
  const survivors = nodeFixtureProcesses().filter((p) => pids.includes(p.pid));
  expect(survivors).toEqual([]);
}, 90_000);
