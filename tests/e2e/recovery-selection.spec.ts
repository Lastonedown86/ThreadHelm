import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp, approveFolder, launchFixtureSession, waitForPidExit } from './helpers/app.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('recovery dismissal preserves current selection through failure, late completion, neighbors and restart', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = Array.from({ length: 5 }, (_, i) => tempWorkspace(`recovery-selection-${i}`));
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
    await expect(queue.locator(':scope > li')).toHaveCount(5);
    const records = (await app.call<OperationResponse<'sessions.list'>>('sessions.list'))
      .recoveryRecords;
    // Match the actual UI order using workspace paths; independent record IDs identify effects.
    const all = (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).sessions;
    const ordered: typeof records = [];
    for (const row of await queue.locator(':scope > li').all()) {
      const text = (await row.textContent())!;
      const session = all.find((s) => text.includes(s.workspaceDisplayPath))!;
      ordered.push(records.find((r) => r.sessionId === session.id)!);
    }
    const row = (id: string) =>
      queue.locator(':scope > li').filter({
        hasText: all.find((s) => s.id === ordered.find((r) => r.id === id)!.sessionId)!
          .workspaceDisplayPath,
      });
    const choose = async (id: string) => row(id).locator('button').first().click();
    const dismiss = async (id: string) =>
      row(id).getByRole('button', { name: 'Dismiss', exact: true }).click();
    const detail = app.page.locator('.recovery-detail');
    const [first, second, third, fourth, fifth] = ordered;
    await choose(third!.id);
    await dismiss(second!.id);
    await expect(queue.locator(':scope > li')).toHaveCount(4);
    await expect(detail).toContainText(third!.id);
    expect(
      (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).sessions.find(
        (s) => s.id === second!.sessionId,
      )!.lifecycleState,
    ).toBe('stopped');
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
        dismissMode: string;
        releaseDismiss?: () => void;
      };
      g.dismissMode = 'fail';
      ipcMain.removeHandler('op:recovery.resolve');
      ipcMain.handle('op:recovery.resolve', async (_event, p: unknown) => {
        if (g.dismissMode === 'fail')
          return {
            ok: false,
            error: { code: 'STORAGE_DEGRADED', message: 'Fixture dismissal failed', details: {} },
          };
        if (g.dismissMode === 'hold')
          await new Promise<void>((resolve) => {
            g.releaseDismiss = resolve;
          });
        return g.__threadhelmTest.dispatch('recovery.resolve', p);
      });
    });
    await dismiss(first!.id);
    await expect(
      app.page.getByRole('status').filter({ hasText: 'Fixture dismissal failed' }),
    ).toBeVisible();
    await expect(detail).toContainText(third!.id);
    expect(
      (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).recoveryRecords,
    ).toHaveLength(4);
    await app.app.evaluate(
      () => ((globalThis as unknown as { dismissMode: string }).dismissMode = 'hold'),
    );
    await choose(first!.id);
    await dismiss(first!.id);
    await expect
      .poll(() =>
        app.app.evaluate(() =>
          Boolean((globalThis as unknown as { releaseDismiss?: () => void }).releaseDismiss),
        ),
      )
      .toBe(true);
    await choose(third!.id);
    await app.app.evaluate(() => {
      const g = globalThis as unknown as { dismissMode: string; releaseDismiss: () => void };
      g.dismissMode = 'pass';
      g.releaseDismiss();
    });
    await expect(queue.locator(':scope > li')).toHaveCount(3);
    await expect(detail).toContainText(third!.id);
    await dismiss(third!.id);
    await expect(queue.locator(':scope > li')).toHaveCount(2);
    await expect(detail).toContainText(fourth!.id);
    // Last record removal chooses previous; then the final record yields empty state.
    await choose(fifth!.id);
    await dismiss(fifth!.id);
    await expect(queue.locator(':scope > li')).toHaveCount(1);
    await expect(detail).toContainText(fourth!.id);
    await dismiss(fourth!.id);
    await expect(
      app.page.getByRole('heading', { name: 'No recovery records need attention' }),
    ).toBeVisible();
    await expect(detail).toHaveCount(0);
    const saved = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
    expect(saved.recoveryRecords).toHaveLength(0);
    expect(saved.sessions.every((s) => s.lifecycleState === 'stopped')).toBe(true);
    expect(await app.liveSessions()).toEqual([]);
    await app.close();
    app = await launchApp({ userData });
    expect(
      (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).recoveryRecords,
    ).toHaveLength(0);
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, ...dirs);
  }
});
