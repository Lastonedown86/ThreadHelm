import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchWithFixtures, approveViaUi, teardown, tempWorkspace } from './helpers/ui.js';

test('rejected launch refresh preserves choices and requires renewed confirmation', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('review-recovery');
  try {
    const path = await approveViaUi(app, dir);
    const page = app.page;
    await page.setViewportSize({ width: 1400, height: 1400 });
    await page.getByRole('button', { name: `Launch Codex CLI in ${path}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Review this launch' });
    await dialog.getByRole('combobox', { name: 'Model', exact: true }).selectOption('gpt-5.6-luna');
    await dialog.getByRole('combobox', { name: 'Effort', exact: true }).selectOption('low');
    await dialog
      .getByRole('spinbutton', { name: 'Contained process limit', exact: true })
      .fill('8');
    const launch = dialog.getByRole('button', { name: 'Launch session', exact: true });
    await dialog.getByRole('checkbox').check();
    await expect(launch).toBeEnabled();
    await app.app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('op:sessions.launch');
      ipcMain.handle('op:sessions.launch', () => ({
        ok: false,
        error: { code: 'PREVIEW_EXPIRED', message: 'Injected stale token', details: {} },
      }));
    });
    await launch.click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(launch).toBeDisabled();
    await dialog
      .getByRole('button', { name: 'Refresh review', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-19-expired-review.png',
    });
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    expect(
      (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).sessions,
    ).toHaveLength(0);
    expect(await app.liveSessions()).toEqual([]);
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
      };
      ipcMain.removeHandler('op:sessions.launch');
      ipcMain.handle('op:sessions.launch', (_e, p: unknown) =>
        g.__threadhelmTest.dispatch('sessions.launch', p),
      );
    });
    await dialog.getByRole('button', { name: 'Refresh review', exact: true }).click();
    await expect(dialog.getByRole('checkbox')).toBeEnabled();
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await expect(launch).toBeDisabled();
    await expect(dialog.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue(
      'gpt-5.6-luna',
    );
    await expect(dialog.getByRole('combobox', { name: 'Effort', exact: true })).toHaveValue('low');
    await expect(
      dialog.getByRole('spinbutton', { name: 'Contained process limit', exact: true }),
    ).toHaveValue('8');
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
        launchCount: number;
        releaseLaunch?: () => void;
      };
      g.launchCount = 0;
      ipcMain.removeHandler('op:sessions.launch');
      ipcMain.handle('op:sessions.launch', async (_e, p: unknown) => {
        g.launchCount++;
        await new Promise<void>((resolve) => {
          g.releaseLaunch = resolve;
        });
        return g.__threadhelmTest.dispatch('sessions.launch', p);
      });
    });
    await dialog.getByRole('checkbox').check();
    await launch.evaluate((el: HTMLButtonElement) => {
      el.click();
      el.click();
    });
    await expect
      .poll(() =>
        app.app.evaluate(() => (globalThis as unknown as { launchCount: number }).launchCount),
      )
      .toBe(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Model', exact: true })).toBeDisabled();
    await app.app.evaluate(() =>
      (globalThis as unknown as { releaseLaunch: () => void }).releaseLaunch(),
    );
    await expect(dialog).toBeHidden();
    const saved = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
    expect(saved.sessions).toHaveLength(1);
    expect(saved.sessions[0]!.workspaceDisplayPath).toBe(path);
    const eligible = await app.call<OperationResponse<'missions.eligibleSessions'>>(
      'missions.eligibleSessions',
    );
    expect(eligible[0]!.runtimeSelection).toEqual({ model: 'gpt-5.6-luna', effort: 'low' });
    expect(eligible[0]!.executionBounds.maxConcurrentProcesses).toBe(8);
    expect((await app.liveSessions()).map((s) => s.id)).toEqual([saved.sessions[0]!.id]);
  } finally {
    await teardown(app, dir);
  }
});

test('real launch token expiry offers fresh review without creating a session', async () => {
  test.setTimeout(180000);
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('real-review-expiry');
  try {
    const path = await approveViaUi(app, dir);
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
        lastToken?: string;
      };
      ipcMain.removeHandler('op:sessions.previewLaunch');
      ipcMain.handle('op:sessions.previewLaunch', async (_e, p: unknown) => {
        const result = (await g.__threadhelmTest.dispatch('sessions.previewLaunch', p)) as {
          ok: boolean;
          value?: { previewToken: string };
        };
        if (result.ok) g.lastToken = result.value!.previewToken;
        return result;
      });
    });
    const page = app.page;
    await page.setViewportSize({ width: 1400, height: 1400 });
    await page.getByRole('button', { name: `Launch Codex CLI in ${path}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Review this launch' });
    await dialog.getByRole('checkbox').check();
    await expect(dialog.getByRole('button', { name: 'Launch session', exact: true })).toBeEnabled();
    const token = await app.app.evaluate(
      () => (globalThis as unknown as { lastToken: string }).lastToken,
    );
    // Real main-process wall time; no clock injection or shortened token lifetime.
    for (let i = 0; i < 3; i++) await page.waitForTimeout(41000);
    await expect(
      dialog.getByRole('button', { name: 'Launch session', exact: true }),
    ).toBeDisabled();
    await expect(dialog.getByRole('alert')).toContainText('expired');
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await expect(
      app.call('sessions.launch', { previewToken: token, boundaryConfirmation: true }),
    ).rejects.toThrow(/expired/i);
    await dialog
      .getByRole('button', { name: 'Refresh review', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-19-expired-review.png',
    });
    await dialog.getByRole('button', { name: 'Refresh review', exact: true }).click();
    await expect(dialog.getByRole('checkbox')).toBeEnabled();
    expect(
      await app.app.evaluate(() => (globalThis as unknown as { lastToken: string }).lastToken),
    ).not.toBe(token);
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(
      (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).sessions,
    ).toHaveLength(0);
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, dir);
  }
});

test('failed refresh can retry and cancelled late preview cannot replace a newer dialog', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('late-review');
  try {
    const path = await approveViaUi(app, dir);
    await app.app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('op:sessions.previewLaunch');
      ipcMain.handle('op:sessions.previewLaunch', () => ({
        ok: false,
        error: { code: 'PROBE_FAILED', message: 'Injected read failure', details: {} },
      }));
    });
    const page = app.page;
    const opener = page.getByRole('button', { name: `Launch Codex CLI in ${path}`, exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Review this launch' });
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByRole('button', { name: 'Refresh review', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Refresh review', exact: true })).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Launch session', exact: true }),
    ).toBeDisabled();
    await dialog.getByRole('combobox', { name: 'Model', exact: true }).selectOption('gpt-5.6-luna');
    await expect(dialog.getByRole('alert')).toBeVisible();
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
        refreshCount: number;
        releasePreview?: () => void;
      };
      g.refreshCount = 0;
      ipcMain.removeHandler('op:sessions.previewLaunch');
      ipcMain.handle('op:sessions.previewLaunch', async (_e, p: unknown) => {
        g.refreshCount++;
        const result = await g.__threadhelmTest.dispatch('sessions.previewLaunch', p);
        await new Promise<void>((resolve) => {
          g.releasePreview = resolve;
        });
        return result;
      });
    });
    await dialog
      .getByRole('button', { name: 'Refresh review', exact: true })
      .evaluate((el: HTMLButtonElement) => {
        el.click();
        el.click();
      });
    await expect
      .poll(() =>
        app.app.evaluate(() =>
          Boolean((globalThis as unknown as { releasePreview?: () => void }).releasePreview),
        ),
      )
      .toBe(true);
    expect(
      await app.app.evaluate(
        () => (globalThis as unknown as { refreshCount: number }).refreshCount,
      ),
    ).toBe(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
      };
      ipcMain.removeHandler('op:sessions.previewLaunch');
      ipcMain.handle('op:sessions.previewLaunch', (_e, p: unknown) =>
        g.__threadhelmTest.dispatch('sessions.previewLaunch', p),
      );
    });
    await opener.click();
    await expect(dialog.getByRole('checkbox')).toBeEnabled();
    await app.app.evaluate(() =>
      (globalThis as unknown as { releasePreview: () => void }).releasePreview(),
    );
    await expect(dialog.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue('');
    await expect(dialog.locator('.facts')).not.toContainText('gpt-5.6-luna');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(
      (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).sessions,
    ).toHaveLength(0);
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, dir);
  }
});
