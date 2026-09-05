import { expect, test } from '@playwright/test';
import { launchApp } from './helpers/app.js';
import { teardown } from './helpers/ui.js';

test.setTimeout(90_000);

test('skipping the repo-idea screen opens a blank Outcome stage', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    const heading = page.getByRole('heading', { name: /Pick a repo/ });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    // Exactly one polite live region on this screen; it is not a composer stage.
    await expect(page.locator('.repo-idea-entry [aria-live]')).toHaveCount(1);
    await expect(page.locator('.composer')).toHaveCount(0);
    await page.getByRole('button', { name: /^Skip/ }).click();
    await expect(page.getByRole('heading', { name: 'Define one finish line.' })).toBeVisible();
    await expect(page.getByText('Step 1 of 4 · Outcome')).toBeVisible();
    await expect(page.getByLabel('Finish line', { exact: true })).toHaveValue('');
  } finally {
    await teardown(app);
  }
});

test('no approved workspace shows a sentence and a Settings button, no dropdown', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Pick a repo/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Repo', exact: true })).toHaveCount(0);
    await expect(page.getByText(/No approved folder yet/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Skip/ })).toBeVisible();
    await page.getByRole('button', { name: 'Go to Settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Choose folder…' })).toBeVisible();
  } finally {
    await teardown(app);
  }
});

// Needs an approved workspace and a faked structured-draft reply; Task 5 adds
// the fakeRepoIdeas test hook and completes this journey.
test.fixme('generating ideas and picking one pre-fills Outcome', async () => {});
