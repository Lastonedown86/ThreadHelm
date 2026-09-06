import { expect, test } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';
import { prepareFixtureMission } from './helpers/mission.js';

test.setTimeout(120_000);

test('named draft discard preserves neighbors and frees capacity through restart', async () => {
  let app = await launchApp();
  try {
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      const draft = await app.call<OperationResponse<'missionComposer.createDraft'>>(
        'missionComposer.createDraft',
      );
      ids.push(draft.draftId);
      await app.call('missionComposer.updateDraft', {
        draftId: draft.draftId,
        expectedVersion: draft.version,
        fieldValues: { objective: 'Duplicate finish line' },
        currentStage: 'outcome',
      });
    }
    const target = ids[0]!;
    const row = app.page.locator(`#mission-draft-${target}`);
    await expect(row).toContainText('Duplicate finish line');
    await row.getByRole('button', { name: /^Resume draft/ }).click();
    await expect(row.getByRole('button', { name: /^Resume draft/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await app.page.getByLabel('Finish line', { exact: true }).fill('Latest saved finish line');
    await row.getByRole('button', { name: /^Discard draft/ }).click();
    const dialog = app.page.getByRole('dialog', { name: 'Discard mission draft?' });
    await expect(dialog).toContainText('Latest saved finish line');
    await expect(dialog.getByRole('button', { name: 'Discard draft', exact: true })).toBeEnabled();
    await app.page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(
      (
        await app.call<OperationResponse<'missionComposer.listDrafts'>>(
          'missionComposer.listDrafts',
        )
      ).drafts,
    ).toHaveLength(20);
    await row.getByRole('button', { name: /^Discard draft/ }).click();
    await dialog.getByRole('button', { name: 'Discard draft', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toHaveCount(0);
    const remaining = (
      await app.call<OperationResponse<'missionComposer.listDrafts'>>('missionComposer.listDrafts')
    ).drafts
      .map((d) => d.draftId)
      .sort();
    expect(remaining).toEqual(ids.slice(1).sort());
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    expect(
      (
        await app.call<OperationResponse<'missionComposer.listDrafts'>>(
          'missionComposer.listDrafts',
        )
      ).drafts
        .map((d) => d.draftId)
        .sort(),
    ).toEqual(remaining);
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await app.page.getByRole('button', { name: /^Skip/ }).click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue('');
    expect(
      (
        await app.call<OperationResponse<'missionComposer.listDrafts'>>(
          'missionComposer.listDrafts',
        )
      ).drafts,
    ).toHaveLength(20);
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await teardown(app);
  }
});

test('discard rejects stale review, recovers from failure and cannot cancel a submitted write', async () => {
  const app = await launchApp();
  try {
    const draft = await app.call<OperationResponse<'missionComposer.createDraft'>>(
      'missionComposer.createDraft',
    );
    const row = app.page.locator(`#mission-draft-${draft.draftId}`);
    await row.getByRole('button', { name: /^Discard draft/ }).click();
    const dialog = app.page.getByRole('dialog', { name: 'Discard mission draft?' });
    const confirm = dialog.getByRole('button', { name: 'Discard draft', exact: true });
    await expect(confirm).toBeEnabled();
    await app.call('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { objective: 'Changed elsewhere' },
      currentStage: 'outcome',
    });
    await confirm.click();
    await expect(dialog.getByRole('alert')).toContainText('Discard was not confirmed');
    await expect(confirm).toBeDisabled();
    expect(
      (
        await app.call<OperationResponse<'missionComposer.getDraft'>>('missionComposer.getDraft', {
          draftId: draft.draftId,
        })
      ).fieldValues.objective,
    ).toBe('Changed elsewhere');
    await dialog.getByRole('button', { name: 'Review again' }).click();
    await expect(dialog).toContainText('Changed elsewhere');
    await expect(confirm).toBeEnabled();
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(name: string, payload?: unknown): Promise<unknown> };
        releaseDiscard: () => void;
        discardCalls: number;
      };
      g.discardCalls = 0;
      ipcMain.removeHandler('op:missionComposer.confirmDiscard');
      ipcMain.handle('op:missionComposer.confirmDiscard', async (_event, payload) => {
        g.discardCalls++;
        await new Promise<void>((resolve) => {
          g.releaseDiscard = resolve;
        });
        return g.__threadhelmTest.dispatch('missionComposer.confirmDiscard', payload);
      });
    });
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Keep draft' })).toBeDisabled();
    await app.page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await app.app.evaluate(() =>
      (globalThis as unknown as { releaseDiscard: () => void }).releaseDiscard(),
    );
    await expect(dialog).toBeHidden();
    expect(
      await app.app.evaluate(
        () => (globalThis as unknown as { discardCalls: number }).discardCalls,
      ),
    ).toBe(1);
    expect(
      (
        await app.call<OperationResponse<'missionComposer.listDrafts'>>(
          'missionComposer.listDrafts',
        )
      ).drafts,
    ).toHaveLength(0);
  } finally {
    await teardown(app);
  }
});

test('dense inventory keeps narrow workspace and all destinations reachable at enlarged text', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('draft-density-leader'), tempWorkspace('draft-density-worker')];
  try {
    const envelope = await prepareFixtureMission(app, dirs);
    const missionIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const preview = await app.call<OperationResponse<'missions.preview'>>('missions.preview', {
        envelope: { ...envelope, objective: `Inventory mission ${i}` },
      });
      const mission = await app.call<OperationResponse<'missions.confirm'>>('missions.confirm', {
        previewToken: preview.previewToken,
        boundaryConfirmation: true,
      });
      missionIds.push(mission.id);
      await app.call('missions.cancel', { missionId: mission.id });
    }
    const draftIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const draft = await app.call<OperationResponse<'missionComposer.createDraft'>>(
        'missionComposer.createDraft',
      );
      draftIds.push(draft.draftId);
      await app.call('missionComposer.updateDraft', {
        draftId: draft.draftId,
        expectedVersion: draft.version,
        currentStage: 'outcome',
        fieldValues: { objective: 'Long saved mission objective '.repeat(16) },
      });
    }
    await app.page.reload();
    await expect(app.page.locator('.mission-rail-list [role=option]')).toHaveCount(50);
    await expect(app.page.locator('.mission-rail-drafts li')).toHaveCount(20);
    await app.page.setViewportSize({ width: 680, height: 860 });
    await app.page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const geometry = await app.page.locator('.mission-shell-workspace').boundingBox();
    expect(geometry!.y).toBeLessThan(500);
    expect(geometry!.height).toBeGreaterThan(250);
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const name of ['Settings', 'Sessions', 'Agents', 'Memory', 'Attention', 'Missions']) {
      const button = app.page.getByRole('button', { name, exact: true });
      await button.focus();
      await app.page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-current', 'page');
    }
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await app.page.getByRole('button', { name: /^Skip/ }).click();
    await expect(app.page.locator('.mission-rail-drafts summary')).toBeFocused();
    await expect(
      app.page.getByText('All 20 draft slots are in use.', { exact: false }),
    ).toBeVisible();
    await app.page
      .locator(`#mission-draft-${draftIds[19]!}`)
      .getByRole('button', { name: /^Resume draft/ })
      .click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Long saved mission objective '.repeat(16),
    );
    await app.page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-23-draft-inventory.png',
    });
    expect(
      (
        await app.call<OperationResponse<'missionComposer.listDrafts'>>(
          'missionComposer.listDrafts',
        )
      ).drafts
        .map((d) => d.draftId)
        .sort(),
    ).toEqual(draftIds.sort());
    expect(
      (await app.call<OperationResponse<'missions.list'>>('missions.list', { limit: 100 }))
        .map((m) => m.id)
        .sort(),
    ).toEqual(missionIds.sort());
  } finally {
    await teardown(app, ...dirs);
  }
});

test('failed inventory retains rows and retry restores current drafts', async () => {
  const app = await launchApp();
  try {
    const draft = await app.call<OperationResponse<'missionComposer.createDraft'>>(
      'missionComposer.createDraft',
    );
    const row = app.page.locator(`#mission-draft-${draft.draftId}`);
    await expect(row).toBeVisible();
    await app.app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('op:missionComposer.listDrafts');
      ipcMain.handle('op:missionComposer.listDrafts', () => ({
        ok: false,
        error: { code: 'STORAGE_DEGRADED', message: 'Injected read failure', details: {} },
      }));
    });
    await app.call('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: 1,
      currentStage: 'outcome',
      fieldValues: { objective: 'Updated saved name' },
    });
    await expect(
      app.page.getByText('Drafts could not be refreshed.', { exact: false }),
    ).toBeVisible();
    await expect(row).toBeVisible();
    await app.app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('op:missionComposer.listDrafts');
      ipcMain.handle('op:missionComposer.listDrafts', (_event, payload) =>
        (
          globalThis as unknown as {
            __threadhelmTest: { dispatch(name: string, payload?: unknown): unknown };
          }
        ).__threadhelmTest.dispatch('missionComposer.listDrafts', payload),
      );
    });
    await app.page.getByRole('button', { name: 'Retry drafts' }).click();
    await expect(row).toContainText('Updated saved name');
    await expect(app.page.getByRole('button', { name: 'Retry drafts' })).toHaveCount(0);
  } finally {
    await teardown(app);
  }
});
