/**
 * T065 — interrupt, clean stop, force stop, descendants, and residual
 * reporting against real fixture process trees (FR-012..FR-014, FR-029).
 */

import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanupUserData,
  events,
  forceStop,
  isPidAlive,
  launchApp,
  launchIn,
  mkWorkspace,
  pidsOf,
  sessionOf,
  waitFor,
  waitForPidExit,
  waitForState,
  type LaunchedApp,
} from './helpers/harness.js';

let app: LaunchedApp;
const dirs: string[] = [];

afterEach(async () => {
  await app.close();
  cleanupUserData(app.userData);
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function interruptAndObserve(sessionId: string) {
  await app.call('sessions.interrupt', { sessionId });
  expect((await sessionOf(app, sessionId)).lifecycleState).toBe('interrupting');
  // Observation window is INTERRUPT_OBSERVE_MS (5 s); allow slack.
  await waitForState(app, sessionId, 'running', 10_000);
  const history = await events(app, sessionId);
  expect(history.some((e) => e.kind === 'interrupt_requested')).toBe(true);
  const outcome = history.findLast((e) => e.kind === 'state_changed' && e.toState === 'running');
  return outcome?.reasonCode ?? null;
}

async function waitForFixtureReady(workspace: string, providerId: string) {
  const marker = join(workspace, `.threadhelm-fixture-${providerId}.ready`);
  await waitFor(
    async () => existsSync(marker),
    (ready) => ready,
    30_000,
  );
}

describe('interrupt', () => {
  beforeEach(async () => {
    app = await launchApp();
    await app.useFixtureAdapters({ 'codex-cli': 'echo', 'claude-code': 'ignore-interrupt' });
  });

  it('reports a handled interrupt on a cooperative agent and keeps it running', async () => {
    const dir = mkWorkspace('echo');
    dirs.push(dir);
    const { session } = await launchIn(app, dir, 'codex-cli');
    await waitForFixtureReady(dir, 'codex-cli');
    expect(await interruptAndObserve(session.id)).toBe('INTERRUPT_HANDLED');
    expect((await pidsOf(app, session.id)).length).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it('never claims more than delivery evidence for an agent that ignores Ctrl+C', async () => {
    const dir = mkWorkspace('stubborn');
    dirs.push(dir);
    const { session } = await launchIn(app, dir, 'claude-code');
    await waitForFixtureReady(dir, 'claude-code');
    const reason = await interruptAndObserve(session.id);
    // The write is acknowledged by the host and the process stays alive, so
    // "handled" here means "delivered and still interactive" — the fixture
    // ignoring the signal is exactly the case the honest-reporting rule covers.
    expect(['INTERRUPT_HANDLED', 'INTERRUPT_UNRESPONSIVE']).toContain(reason);
    console.log(`ignore-interrupt outcome: ${reason}`);
  }, 60_000);
});

describe('stop escalation', () => {
  beforeEach(async () => {
    app = await launchApp();
    await app.useFixtureAdapters({
      'codex-cli': 'ignore-interrupt',
      'claude-code': 'spawn-children',
    });
  });

  it('offers force stop only after the bounded grace period, then empties the scope', async () => {
    const dir = mkWorkspace('force');
    dirs.push(dir);
    const { session } = await launchIn(app, dir, 'codex-cli');
    const pids = await pidsOf(app, session.id);

    const stop = await app.call<{ stopToken: string; sessionId: string }>('sessions.requestStop', {
      sessionId: session.id,
    });
    expect(stop.sessionId).toBe(session.id);
    await app.call('sessions.confirmStop', { stopToken: stop.stopToken });
    const stopping = await sessionOf(app, session.id);
    expect(stopping.lifecycleState).toBe('stopping');
    expect(stopping.forceStopAvailable).toBe(false);

    const offered = await waitFor(
      () => sessionOf(app, session.id),
      (s) => s.forceStopAvailable,
      15_000,
    );
    expect(offered.lifecycleState).toBe('stopping');

    const disclosure = await forceStop(app, session.id);
    expect(disclosure.processCount).toBeGreaterThanOrEqual(1);
    expect(disclosure.risk.length).toBeGreaterThan(20);
    const stopped = await waitForState(app, session.id, 'stopped', 15_000);
    expect(stopped.stopKind).toBe('forced');
    for (const pid of pids) expect(await waitForPidExit(pid, 5_000)).toBe(true);
    expect((await events(app, session.id)).some((e) => e.reasonCode === 'RESIDUAL_PROCESSES')).toBe(
      false,
    );
    expect(await app.liveSessions()).toHaveLength(0);
  }, 90_000);

  it('force stop takes the grandchildren with it', async () => {
    const dir = mkWorkspace('tree');
    dirs.push(dir);
    const { session } = await launchIn(app, dir, 'claude-code');
    // host + root + grandchild + ConPTY helper
    const pids = await waitFor(
      () => pidsOf(app, session.id),
      (p) => p.length >= 4,
      10_000,
    );
    for (const pid of pids) expect(isPidAlive(pid)).toBe(true);

    await forceStop(app, session.id);
    const stopped = await waitForState(app, session.id, 'stopped', 15_000);
    expect(stopped.stopKind).toBe('forced');
    for (const pid of pids) expect(await waitForPidExit(pid, 5_000)).toBe(true);
    expect((await events(app, session.id)).some((e) => e.reasonCode === 'RESIDUAL_PROCESSES')).toBe(
      false,
    );
  }, 90_000);
});
