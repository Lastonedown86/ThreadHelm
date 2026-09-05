import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp, approveFolder, launchFixtureSession, waitForPidExit } from './helpers/app.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('each destination has one primary workspace landmark', async () => {
  const app = await launchApp();
  try {
    for (const name of ['Missions', 'Sessions', 'Agents', 'Memory', 'Attention', 'Settings']) {
      await app.page.getByRole('button', { name, exact: true }).click();
      await expect(app.page.getByRole('main')).toHaveCount(1);
      await expect(app.page.getByRole('main')).toHaveAttribute('id', 'mission-workspace');
    }
  } finally {
    await teardown(app);
  }
});

test('keyboard recovery selection and dismissal preserve meaningful focus', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = Array.from({ length: 4 }, (_, i) => tempWorkspace(`attention-keyboard-${i}`));
  try {
    for (const dir of dirs) {
      const w = await approveFolder(app, dir);
      await launchFixtureSession(app, w.id, 'codex-cli');
    }
    const userData = app.userData;
    const pid = await app.app.evaluate(() => process.pid);
    process.kill(pid, 'SIGKILL');
    expect(await waitForPidExit(pid, 20000)).toBe(true);
    app = await launchApp({ userData });
    await app.page.getByRole('button', { name: 'Attention', exact: true }).click();
    const queue = app.page.getByRole('list', { name: 'Unresolved recovery records' });
    const rows = queue.locator(':scope > li');
    await expect(rows).toHaveCount(4);
    const detail = app.page.locator('.recovery-detail');
    const saved = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
    // Hold one dismissal, then move outside the queue before its completion.
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
        releaseDismiss?: () => void;
      };
      ipcMain.removeHandler('op:recovery.resolve');
      ipcMain.handle('op:recovery.resolve', async (_event, p: unknown) => {
        await new Promise<void>((resolve) => {
          g.releaseDismiss = resolve;
        });
        return g.__threadhelmTest.dispatch('recovery.resolve', p);
      });
    });
    await rows.nth(3).getByRole('button', { name: 'Dismiss', exact: true }).focus();
    await app.page.keyboard.press('Enter');
    await expect
      .poll(() =>
        app.app.evaluate(() =>
          Boolean((globalThis as unknown as { releaseDismiss?: () => void }).releaseDismiss),
        ),
      )
      .toBe(true);
    const missions = app.page.getByRole('button', { name: 'Open Missions', exact: true });
    await missions.focus();
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
        releaseDismiss: () => void;
      };
      g.releaseDismiss();
      ipcMain.removeHandler('op:recovery.resolve');
      ipcMain.handle('op:recovery.resolve', (_event, p: unknown) =>
        g.__threadhelmTest.dispatch('recovery.resolve', p),
      );
    });
    await expect(rows).toHaveCount(3);
    await expect(missions).toBeFocused();
    const text = (await rows.nth(1).textContent())!;
    const session = saved.sessions.find((s) => text.includes(s.workspaceDisplayPath))!;
    const target = saved.recoveryRecords.find((r) => r.sessionId === session.id)!;
    const second = rows.nth(1).locator('button').first();
    await second.focus();
    await app.page.keyboard.press('Space');
    await expect(second).toHaveAttribute('aria-current', 'true');
    await expect(queue.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(second).toHaveAttribute(
      'aria-controls',
      (await detail.getAttribute('id')) ?? 'missing',
    );
    await expect(detail).toContainText(target.id);
    await app.page.keyboard.press('Tab');
    await expect(rows.nth(1).getByRole('button', { name: 'Dismiss', exact: true })).toBeFocused();
    await app.page.keyboard.press('Enter');
    await expect(rows).toHaveCount(2);
    await expect(queue.locator('[aria-current="true"]')).toBeFocused();
    const after = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
    expect(after.recoveryRecords.some((r) => r.id === target.id)).toBe(false);
    expect(after.sessions.find((s) => s.id === target.sessionId)?.lifecycleState).toBe('stopped');
    const detailDismiss = detail.getByRole('button', { name: 'Dismiss', exact: true });
    await detailDismiss.focus();
    await app.page.keyboard.press('Enter');
    await expect(rows).toHaveCount(1);
    await expect(queue.locator('[aria-current="true"]')).toBeFocused();
    await detailDismiss.focus();
    await app.page.keyboard.press('Enter');
    await expect(
      app.page.getByRole('heading', { name: 'No recovery records need attention' }),
    ).toBeFocused();
    expect(
      (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).recoveryRecords,
    ).toHaveLength(0);
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, ...dirs);
  }
});
