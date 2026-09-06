import { realpathSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { teardown, tempWorkspace } from './helpers/ui.js';

test('folder approval is single-flight and cancellation is truthful through failure and restart', async () => {
  let app = await launchApp();
  const dir = tempWorkspace('approval-pending');
  try {
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    const choose = app.page.getByRole('button', { name: 'Choose folder…' });
    const dialog = app.page.getByRole('dialog', { name: 'Approve this folder?' });
    await app.setPickerPath(dir);
    await choose.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
    await app.page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(choose).toBeFocused();
    expect(await app.call('workspaces.list')).toEqual([]);
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
        approvalCalls: number;
        releaseApproval?: () => void;
        approvalFail: boolean;
      };
      g.approvalCalls = 0;
      g.approvalFail = true;
      ipcMain.removeHandler('op:workspaces.approve');
      ipcMain.handle('op:workspaces.approve', async (_event, p: unknown) => {
        g.approvalCalls++;
        await new Promise<void>((resolve) => {
          g.releaseApproval = resolve;
        });
        delete g.releaseApproval;
        if (g.approvalFail)
          return {
            ok: false,
            error: { code: 'CANDIDATE_EXPIRED', message: 'Choose the folder again.', details: {} },
          };
        return g.__threadhelmTest.dispatch('workspaces.approve', p);
      });
    });
    for (const fail of [true, false]) {
      await choose.click();
      await expect(dialog).toContainText(dir);
      const approve = dialog.getByRole('button', { name: 'Approve folder', exact: true });
      // Two activations in the same renderer task exercise the synchronous guard.
      await approve.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
      await expect(dialog.getByRole('button', { name: 'Approving', exact: false })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
      await expect(dialog.getByRole('status')).toContainText('Saving approval');
      await app.page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(dir);
      expect(await app.call('workspaces.list')).toEqual([]);
      await expect
        .poll(() =>
          app.app.evaluate(() =>
            Boolean((globalThis as unknown as { releaseApproval?: () => void }).releaseApproval),
          ),
        )
        .toBe(true);
      expect(
        await app.app.evaluate(
          () => (globalThis as unknown as { approvalCalls: number }).approvalCalls,
        ),
      ).toBe(fail ? 1 : 2);
      await app.app.evaluate(() =>
        (globalThis as unknown as { releaseApproval: () => void }).releaseApproval(),
      );
      await expect(dialog).toBeHidden();
      await expect(choose).toBeFocused();
      if (fail) {
        await expect(app.page.getByRole('alert')).toContainText('Choose the folder again');
        expect(await app.call('workspaces.list')).toEqual([]);
        await app.app.evaluate(() => {
          (globalThis as unknown as { approvalFail: boolean }).approvalFail = false;
        });
      }
    }
    const saved = await app.call<OperationResponse<'workspaces.list'>>('workspaces.list');
    expect(saved).toHaveLength(1);
    expect(saved[0]!.displayPath).toBe(realpathSync.native(dir));
    expect(saved[0]!.revokedAt).toBeNull();
    await expect(app.page.getByRole('alert')).toHaveCount(0);
    expect(await app.liveSessions()).toEqual([]);
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    expect(await app.call('workspaces.list')).toEqual(saved);
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, dir);
  }
});
