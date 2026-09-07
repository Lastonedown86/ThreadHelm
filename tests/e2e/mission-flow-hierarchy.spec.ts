import { expect, test } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { newMissionViaUi, teardown } from './helpers/ui.js';

test('one Close saves exact edits and leaves the composer without a second receipt action', async () => {
  const app = await launchApp();
  try {
    await newMissionViaUi(app.page);
    await app.page.getByLabel('Finish line', { exact: true }).fill('Latest one-click close');
    await app.page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(
      app.page.getByRole('heading', { name: 'Start a mission', exact: true }),
    ).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Close composer', exact: true })).toHaveCount(
      0,
    );
    const saved = (
      await app.call<OperationResponse<'missionComposer.listDrafts'>>('missionComposer.listDrafts')
    ).drafts[0]!;
    expect(
      (
        await app.call<OperationResponse<'missionComposer.getDraft'>>('missionComposer.getDraft', {
          draftId: saved.draftId,
        })
      ).fieldValues.objective,
    ).toBe('Latest one-click close');
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await teardown(app);
  }
});

test('failed Close preserves unsaved edits until an explicit discard choice', async () => {
  const app = await launchApp();
  try {
    await newMissionViaUi(app.page);
    await app.page.getByLabel('Finish line', { exact: true }).fill('Saved first');
    await expect(app.page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
    await app.breakStorage();
    await app.page.getByLabel('Finish line', { exact: true }).fill('Unsaved latest');
    await app.page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(
      app.page.getByRole('heading', { name: 'Your latest edits could not be saved.' }),
    ).toBeVisible();
    await app.page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue('Unsaved latest');
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await teardown(app);
  }
});
