import { expect, test } from '@playwright/test';
import { approveViaUi, launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('startup snapshot preserves a workspace approved while loading', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('startup-approval');
  try {
    await app.app.evaluate(({ ipcMain }) => {
      const hooks = (
        globalThis as unknown as {
          __threadhelmTest: { dispatch(name: string, payload?: unknown): Promise<unknown> };
        }
      ).__threadhelmTest;
      const gate = globalThis as unknown as {
        releaseStartup: () => void;
        workspaceSnapshotRead: boolean;
      };
      gate.workspaceSnapshotRead = false;
      const held = new Promise<void>((resolve) => {
        gate.releaseStartup = resolve;
      });
      ipcMain.removeHandler('op:application.getInfo');
      ipcMain.handle('op:application.getInfo', async (_event, payload) => {
        await held;
        return hooks.dispatch('application.getInfo', payload);
      });
      ipcMain.removeHandler('op:workspaces.list');
      ipcMain.handle('op:workspaces.list', async (_event, payload) => {
        const result = await hooks.dispatch('workspaces.list', payload);
        gate.workspaceSnapshotRead = true;
        return result;
      });
    });
    await app.page.reload();
    await expect
      .poll(() =>
        app.app.evaluate(
          () => (globalThis as unknown as { workspaceSnapshotRead: boolean }).workspaceSnapshotRead,
        ),
      )
      .toBe(true);
    const displayPath = await approveViaUi(app, dir);
    const saved = await app.call('workspaces.list');
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    const repo = app.page.getByRole('combobox', { name: 'Repo', exact: true });
    await repo.selectOption({ label: displayPath });
    const selected = await repo.inputValue();
    await app.app.evaluate(() =>
      (globalThis as unknown as { releaseStartup: () => void }).releaseStartup(),
    );
    await expect(app.page.locator('.status-bar')).toContainText('ThreadHelm v');
    await expect(repo).toHaveValue(selected);
    expect(await app.call('workspaces.list')).toEqual(saved);
  } finally {
    await teardown(app, dir);
  }
});
