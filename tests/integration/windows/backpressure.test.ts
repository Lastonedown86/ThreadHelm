/**
 * T052 — a large output burst must not stall the coordinator, must keep
 * controls flowing in order, and any discarded output must be disclosed
 * (FR-032, SC-018).
 */

import { rmSync } from 'node:fs';
import { afterEach, beforeEach, expect, it } from 'vitest';
import {
  cleanupUserData,
  events,
  launchApp,
  launchIn,
  mkWorkspace,
  sendInput,
  sessionOf,
  waitForState,
  type LaunchedApp,
} from './helpers/harness.js';

let app: LaunchedApp;
const dirs: string[] = [];

beforeEach(async () => {
  app = await launchApp();
  // ~26 MB of output: well past the 8 MiB unacknowledged budget.
  await app.useFixtureAdapters({ 'codex-cli': 'burst', 'claude-code': 'echo' }, 300_000);
});

afterEach(async () => {
  await app.close();
  cleanupUserData(app.userData);
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const timed = async <T>(fn: () => Promise<T>) => {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - t0 };
};

it('keeps the app responsive, controls ordered, and discloses discards under a burst', async () => {
  const quiet = mkWorkspace('quiet');
  const loud = mkWorkspace('loud');
  dirs.push(quiet, loud);
  const other = await launchIn(app, quiet, 'claude-code');
  const burst = await launchIn(app, loud, 'codex-cli');
  expect(burst.session.lifecycleState).toBe('running');

  // Responsiveness while the burst is in flight.
  const list = await timed(() => sessionOf(app, burst.session.id));
  expect(list.ms).toBeLessThan(2_000);
  expect(list.value.lifecycleState).toBe('running');
  const info = await timed(() => app.call('application.getInfo'));
  expect(info.ms).toBeLessThan(500);
  expect((await sessionOf(app, other.session.id)).lifecycleState).toBe('running');

  // Resize during the burst: accepted, strictly increasing control sequence.
  const r1 = await app.call<{ controlSequence: number }>('sessions.resize', {
    sessionId: burst.session.id,
    columns: 80,
    rows: 24,
  });
  const r2 = await app.call<{ controlSequence: number }>('sessions.resize', {
    sessionId: burst.session.id,
    columns: 120,
    rows: 40,
  });
  expect(r2.controlSequence).toBeGreaterThan(r1.controlSequence);

  // Input is still processed mid-burst: 'exit' ends the fixture cleanly.
  await app.call('sessions.select', { sessionId: burst.session.id });
  const input = await sendInput(app, burst.session.id, 'exit\r');
  expect(input.ok).toBe(true);
  if (input.ok) expect(input.value.controlSequence).toBeGreaterThan(r2.controlSequence);
  const ended = await waitForState(app, burst.session.id, 'stopped', 90_000);
  expect(ended.stopKind).toBe('clean');

  // Disclosure: whatever was discarded is counted and explained, never hidden.
  expect(Number.isInteger(ended.truncationCount)).toBe(true);
  expect(ended.truncationCount).toBeGreaterThanOrEqual(0);
  const history = await events(app, burst.session.id);
  const truncated = history.filter((e) => e.kind === 'output_truncated');
  if (ended.truncationCount > 0) {
    expect(truncated.length).toBeGreaterThan(0);
    expect(truncated.at(-1)!.safeSummary).toContain(String(ended.truncationCount));
  } else {
    expect(truncated).toHaveLength(0);
  }
  console.log(
    `burst: truncationCount=${ended.truncationCount}, list=${list.ms.toFixed(0)}ms, info=${info.ms.toFixed(0)}ms`,
  );

  // The quiet neighbour never noticed.
  expect((await sessionOf(app, other.session.id)).lifecycleState).toBe('running');
  expect((await events(app, other.session.id)).map((e) => e.kind)).toEqual([
    'launch_requested',
    'launched',
  ]);
}, 180_000);
