import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { approveViaUi, launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('readiness recheck preserves workspace, handles failure and rejects old evidence without launching', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const dirs = [tempWorkspace('readiness-a'), tempWorkspace('readiness-b')];
  try {
    for (const dir of dirs) await approveViaUi(app, dir);
    const saved = await app.call<OperationResponse<'workspaces.list'>>('workspaces.list');
    const panel = app.page.locator('[aria-labelledby="providers-heading"]');
    const scope = panel.getByRole('combobox', { name: 'Launch in', exact: true });
    await scope.selectOption(saved[1]!.id);
    await expect(
      panel.getByRole('heading', { name: 'Provider readiness', exact: true }),
    ).toBeVisible();
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        mode: string;
        rechecks: number;
        releaseCheck?: () => void;
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
      };
      g.mode = 'fail';
      g.rechecks = 0;
      ipcMain.removeHandler('op:providers.listReadiness');
      ipcMain.handle('op:providers.listReadiness', async () => {
        g.rechecks++;
        const mode = g.mode;
        if (mode === 'hold')
          await new Promise<void>((resolve) => {
            g.releaseCheck = resolve;
          });
        if (mode === 'fail' || mode === 'hold')
          return {
            ok: false,
            error: { code: 'STORAGE_UNAVAILABLE', message: 'Fixture recheck failed', details: {} },
          };
        return g.__threadhelmTest.dispatch('providers.listReadiness', undefined);
      });
    });
    const check = panel.getByRole('button', { name: 'Check again', exact: true });
    await check.focus();
    await app.page.keyboard.press('Enter');
    await expect(panel.getByRole('alert')).toContainText('Could not check provider readiness');
    await expect(scope).toHaveValue(saved[1]!.id);
    for (const button of await panel.getByRole('button', { name: /^Launch / }).all())
      await expect(button).toBeDisabled();
    await app.app.evaluate(() => {
      (globalThis as unknown as { mode: string }).mode = 'hold';
    });
    await check.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(panel.getByRole('button', { name: 'Checking', exact: false })).toBeDisabled();
    await expect
      .poll(() =>
        app.app.evaluate(() =>
          Boolean((globalThis as unknown as { releaseCheck?: () => void }).releaseCheck),
        ),
      )
      .toBe(true);
    expect(
      await app.app.evaluate(() => (globalThis as unknown as { rechecks: number }).rechecks),
    ).toBe(2);
    await app.page.getByRole('button', { name: 'Missions', exact: true }).click();
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    await app.app.evaluate(() => {
      (globalThis as unknown as { mode: string }).mode = 'pass';
    });
    await scope.selectOption(saved[1]!.id);
    await check.click();
    await expect(panel.getByRole('status')).toContainText('Provider check complete');
    await app.app.evaluate(() =>
      (globalThis as unknown as { releaseCheck: () => void }).releaseCheck(),
    );
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(scope).toHaveValue(saved[1]!.id);
    const ready =
      await app.call<OperationResponse<'providers.listReadiness'>>('providers.listReadiness');
    for (const r of ready)
      await expect(
        panel.locator('time').filter({ hasText: new Date(r.probedAt).toLocaleString() }),
      ).not.toHaveCount(0);
    const stamp = new Date(Date.now() + 60000).toISOString();
    await app.app.evaluate(
      ({ BrowserWindow }, data) => {
        const window = BrowserWindow.getAllWindows()[0]!;
        window.webContents.send('event:provider.readinessChanged', {
          ...data.ready[0],
          safeSummary: 'Newest verified provider evidence',
          probedAt: data.stamp,
        });
        window.webContents.send('event:provider.readinessChanged', {
          ...data.ready[0],
          availability: 'missing',
          safeSummary: 'Obsolete provider evidence',
          probedAt: '2020-01-01T00:00:00.000Z',
        });
        window.webContents.send('event:provider.readinessChanged', {
          ...data.ready[1],
          availability: 'error',
          safeSummary: 'Other provider check failed',
          probedAt: data.stamp,
        });
      },
      { ready, stamp },
    );
    await expect(panel).toContainText('Newest verified provider evidence');
    await expect(panel).not.toContainText('Obsolete provider evidence');
    await expect(panel).toContainText('Other provider check failed');
    await expect(
      panel.getByRole('button', { name: `Launch Codex CLI in ${saved[1]!.displayPath}` }),
    ).toBeEnabled();
    await expect(panel.getByRole('button', { name: /^Launch Claude/ })).toHaveCount(0);
    expect(await app.call('workspaces.list')).toEqual(saved);
    expect((await app.call<OperationResponse<'sessions.list'>>('sessions.list')).sessions).toEqual(
      [],
    );
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, ...dirs);
  }
});
