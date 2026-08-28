/**
 * T051 — four concurrent fixture sessions with isolation assertions
 * (FR-008, FR-009, FR-015, FR-025, SC-007, SC-011).
 */

import { rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanStop,
  cleanupUserData,
  events,
  isPidAlive,
  launchApp,
  launchIn,
  mkWorkspace,
  pidsOf,
  sendInput,
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

describe('four concurrent sessions', () => {
  it('stay isolated in identity, input routing, jobs, and control', async () => {
    const providers = ['codex-cli', 'claude-code', 'codex-cli', 'claude-code'] as const;
    const launched = [];
    for (const [i, providerId] of providers.entries()) {
      const dir = mkWorkspace(String(i));
      dirs.push(dir);
      launched.push({ dir, ...(await launchIn(app, dir, providerId)) });
    }
    const [a, b, c, d] = launched as [
      (typeof launched)[number],
      (typeof launched)[number],
      (typeof launched)[number],
      (typeof launched)[number],
    ];
    for (const s of launched) expect(s.session.lifecycleState).toBe('running');

    // Distinct jobs, no pid overlap.
    const pidSets = await Promise.all(launched.map((s) => pidsOf(app, s.session.id)));
    const all = pidSets.flat();
    expect(new Set(all).size).toBe(all.length);
    for (const pids of pidSets) expect(pids.length).toBeGreaterThanOrEqual(2);

    // Input goes only to the selected session.
    await app.call('sessions.select', { sessionId: a.session.id });
    const ok = await sendInput(app, a.session.id, 'alpha\r');
    expect(ok.ok).toBe(true);
    const wrong = await sendInput(app, b.session.id, 'bravo\r');
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe('NOT_SELECTED');
    await app.call('sessions.select', { sessionId: b.session.id });
    expect((await sendInput(app, b.session.id, 'bravo\r')).ok).toBe(true);

    // Each history only knows its own launch.
    for (const s of launched) {
      const history = await events(app, s.session.id);
      expect(history.map((e) => e.kind)).toEqual(['launch_requested', 'launched']);
    }

    // One-writer rule keys on identity: a path alias of A is blocked.
    const aliasWs = await (async () => {
      await app.setPickerPath(`${a.dir}\\.\\`);
      const cand = await app.call<{ candidateToken: string; existingWorkspaceId: string | null }>(
        'workspaces.choose',
      );
      expect(cand.existingWorkspaceId).toBe(a.ws.id);
      return app.call<{ id: string }>('workspaces.approve', {
        candidateToken: cand.candidateToken,
      });
    })();
    expect(aliasWs.id).toBe(a.ws.id);
    const blocked = await app.dispatch('sessions.previewLaunch', {
      workspaceId: a.ws.id,
      providerId: 'codex-cli',
      terminal: { columns: 100, rows: 30 },
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('WRITE_LEASE_HELD');

    // Stopping C leaves A, B, D untouched (same pids, same state).
    const before = await Promise.all([a, b, d].map((s) => pidsOf(app, s.session.id)));
    await cleanStop(app, c.session.id);
    for (const [i, s] of [a, b, d].entries()) {
      expect((await sessionOf(app, s.session.id)).lifecycleState).toBe('running');
      expect(await pidsOf(app, s.session.id)).toEqual(before[i]);
    }
    for (const pid of pidSets[2]!) expect(isPidAlive(pid)).toBe(false);

    // A fifth session still launches (>= 4 concurrent with C gone, 4 live again).
    const e = mkWorkspace('5');
    dirs.push(e);
    const fifth = await launchIn(app, e, 'codex-cli');
    expect(fifth.session.lifecycleState).toBe('running');
    expect((await app.liveSessions()).length).toBe(4);

    for (const s of [a, b, d, fifth]) await cleanStop(app, s.session.id);
    await waitFor(
      () => app.liveSessions(),
      (l) => l.length === 0,
      10_000,
    );
    for (const pid of all) expect(isPidAlive(pid)).toBe(false);
  }, 180_000);
});
