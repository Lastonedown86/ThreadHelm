import { test, expect } from '@playwright/test';
import type { TestHooks } from '../../apps/desktop/src/main/test-hooks.js';
import type { OperationResponse } from '@threadhelm/contracts';
import { prepareFixtureMission } from './helpers/mission.js';
import { launchWithFixtures, newMissionViaUi, teardown, tempWorkspace } from './helpers/ui.js';

test('keyboard repair reaches missing fields and hidden limits at 200 percent text', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('keyboard-leader'), tempWorkspace('keyboard-worker')];
  try {
    const envelope = await prepareFixtureMission(app, dirs);
    const page = app.page;
    await page.setViewportSize({ width: 960, height: 800 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await newMissionViaUi(page);
    // Natural Tab from the stage heading used to place the field under the sticky footer.
    await page.keyboard.press('Tab');
    const finish = page.getByLabel('Finish line', { exact: true });
    await expect(finish).toBeFocused();
    expect(
      await finish.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
      }),
    ).toBe(true);
    const fix = page.getByRole('button', { name: 'Fix missing field', exact: true });
    await expect(fix).toBeEnabled();
    await fix.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Finish line', { exact: true })).toBeFocused();
    await page.keyboard.type('Keyboard exact mission');
    await expect(fix).toBeEnabled();
    await fix.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Proof of completion', { exact: true })).toBeFocused();
    await page.keyboard.type('A recorded result');
    await page.getByRole('button', { name: 'Continue to crew', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(fix).toBeEnabled();
    await fix.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('combobox', { name: 'Supervisor profile', exact: true }),
    ).toBeFocused();
    const saved = (
      await app.call<OperationResponse<'missionComposer.listDrafts'>>('missionComposer.listDrafts')
    ).drafts[0]!;
    const detail = await app.call<OperationResponse<'missionComposer.getDraft'>>(
      'missionComposer.getDraft',
      { draftId: saved.draftId },
    );
    await app.call('missionComposer.updateDraft', {
      draftId: detail.draftId,
      expectedVersion: detail.version,
      currentStage: 'access',
      fieldValues: envelope,
    });
    await page.reload();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.getByRole('button', { name: /^Resume draft/ }).click();
    const limits = page
      .locator('details')
      .filter({ has: page.locator('[data-field="bounds.maxElapsedMs"]') });
    await limits.locator('summary').click();
    await page.locator('[data-field="bounds.maxElapsedMs"]').fill('0');
    await limits.locator('summary').click();
    await expect(fix).toBeEnabled();
    await fix.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-field="bounds.maxElapsedMs"]')).toBeFocused();
    expect(
      await page.locator('[data-field="bounds.maxElapsedMs"]').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
      }),
    ).toBe(true);
  } finally {
    await teardown(app, ...dirs);
  }
});

test('composer discard uses a native modal, Escape restores focus and confirmation deletes only its draft', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  try {
    const page = app.page;
    await newMissionViaUi(page);
    await page.getByLabel('Finish line', { exact: true }).fill('Saved before failure');
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
    const saved = (
      await app.call<OperationResponse<'missionComposer.listDrafts'>>('missionComposer.listDrafts')
    ).drafts[0]!;
    await app.app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('op:missionComposer.updateDraft');
      ipcMain.handle('op:missionComposer.updateDraft', () => ({
        ok: false,
        error: { code: 'MISSION_DRAFT_SAVE_FAILED', message: 'Fixture save failure', details: {} },
      }));
    });
    await page.getByLabel('Finish line', { exact: true }).fill('Unsaved edits');
    const opener = page.getByRole('button', { name: 'Discard draft…', exact: true });
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Discard this draft?', exact: true });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => el.tagName)).toBe('DIALOG');
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    expect(
      (
        await app.call<OperationResponse<'missionComposer.listDrafts'>>(
          'missionComposer.listDrafts',
        )
      ).drafts.map((d) => d.draftId),
    ).toContain(saved.draftId);
    await page.keyboard.press('Enter');
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: TestHooks;
        releaseDiscard: () => void;
        discardCalls: number;
      };
      g.discardCalls = 0;
      ipcMain.removeHandler('op:missionComposer.confirmDiscard');
      ipcMain.handle('op:missionComposer.confirmDiscard', async (_e, p: unknown) => {
        g.discardCalls++;
        await new Promise<void>((resolve) => {
          g.releaseDiscard = resolve;
        });
        return g.__threadhelmTest.dispatch('missionComposer.confirmDiscard', p);
      });
    });
    await dialog.getByRole('button', { name: 'Discard draft', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('button', { name: 'Discard draft', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Enter');
    expect(
      await app.app.evaluate(
        () => (globalThis as unknown as { discardCalls: number }).discardCalls,
      ),
    ).toBe(1);
    await app.app.evaluate(() =>
      (globalThis as unknown as { releaseDiscard: () => void }).releaseDiscard(),
    );
    await expect(dialog).toBeHidden();
    expect(
      (
        await app.call<OperationResponse<'missionComposer.listDrafts'>>(
          'missionComposer.listDrafts',
        )
      ).drafts,
    ).toHaveLength(0);
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await teardown(app);
  }
});
