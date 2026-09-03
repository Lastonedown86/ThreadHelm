import { expect, test } from '@playwright/test';
import { launchApp } from './helpers/app.js';
import { teardown } from './helpers/ui.js';

test.setTimeout(90_000);

test('new mission opens the guided composer in the workspace and autosaves the outcome', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    await expect(page.getByRole('button', { name: 'Create mission', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'New mission…', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const heading = page.getByRole('heading', { name: 'Define one finish line.' });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText('Step 1 of 4 · Outcome')).toBeVisible();
    await expect(page.getByRole('listbox', { name: 'Missions' })).toBeVisible();
    const next = page.getByRole('button', { name: 'Continue to crew', exact: true });
    await expect(next).toBeDisabled();
    await expect(
      page.getByText('Add a finish line so the coordinator knows what done means.', {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel('Finish line', { exact: true }).fill('Fix the flaky terminal test.');
    await page
      .getByLabel('Proof of completion', { exact: true })
      .fill('Three green runs in a row.');
    await page.getByLabel('Outside this mission', { exact: true }).fill('Rewriting xterm');
    await page.getByRole('button', { name: 'Add to outside this mission', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Rewriting xterm' })).toBeVisible();
    await expect(next).toBeEnabled();
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByText('Your mission draft is saved locally.')).toBeVisible();
    await expect(page.getByText('Still off: access, permissions, launch')).toBeVisible();
    await page.getByRole('button', { name: 'Close composer', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Start a mission' })).toBeVisible();
    await page.getByRole('button', { name: /^Resume draft · Outcome/ }).click();
    await expect(page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Fix the flaky terminal test.',
    );
  } finally {
    await teardown(app);
  }
});
