import { expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  approveFolder,
  cleanupUserData,
  launchApp,
  launchFixtureSession,
  waitFor,
} from './helpers/app.js';

test('app starts, exposes version, and closes with no sessions', async () => {
  const app = await launchApp();
  try {
    const info = await app.call<{ version: string; electronVersion: string }>(
      'application.getInfo',
    );
    expect(info.electronVersion).toMatch(/^\d+\./);
    await expect(app.page.getByText('ThreadHelm', { exact: false }).first()).toBeVisible();
  } finally {
    await app.close();
    cleanupUserData(app.userData);
  }
});

test('fixture session launches contained and stops cleanly', async () => {
  const app = await launchApp();
  const dir = mkdtempSync(join(tmpdir(), 'threadhelm ws ünï-'));
  try {
    await app.useFixtureAdapters({ 'codex-cli': 'echo' });
    const workspace = await approveFolder(app, dir);
    const session = await launchFixtureSession(app, workspace.id, 'codex-cli');
    expect(session.lifecycleState).toBe('running');
    const snapshot = await app.jobSnapshot(session.id);
    expect(snapshot?.activeProcessCount).toBeGreaterThanOrEqual(2);
    const stop = await app.call<{ stopToken: string }>('sessions.requestStop', {
      sessionId: session.id,
    });
    await app.call('sessions.confirmStop', { stopToken: stop.stopToken });
    const list = await waitFor(
      () =>
        app.call<{ sessions: { id: string; lifecycleState: string; stopKind: string | null }[] }>(
          'sessions.list',
        ),
      (l) => l.sessions.find((s) => s.id === session.id)?.lifecycleState === 'stopped',
      30_000,
    );
    expect(list.sessions.find((s) => s.id === session.id)?.stopKind).toBe('clean');
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await app.close();
    cleanupUserData(app.userData);
    cleanupUserData(dir);
  }
});
