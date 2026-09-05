import { expect, test } from '@playwright/test';
import { launchApp } from './helpers/app.js';
import { approveViaUi, teardown, tempWorkspace } from './helpers/ui.js';

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

test('generating ideas and picking one pre-fills Outcome', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('repo-ideas');
  try {
    const page = app.page;
    const displayPath = await approveViaUi(app, dir);
    await app.fakeRepoIdeas([
      {
        title: 'Fix the flaky CI job',
        rationale: 'Recent commits mention retries.',
        proposedObjective: 'Make CI deterministic.',
        proposedCompletionEvidence: 'Ten green runs.',
      },
      {
        title: 'Add tests for the auth module',
        rationale: 'No test file matches auth.ts.',
        proposedObjective: 'Cover the auth module with tests.',
        proposedCompletionEvidence: 'A passing test file exists.',
      },
      {
        title: 'Update the stale README section',
        rationale: 'README still describes the old CLI flags.',
        proposedObjective: 'Bring the README in line with the CLI.',
        proposedCompletionEvidence: 'README examples run as written.',
      },
    ]);
    await page.getByRole('button', { name: 'Missions', exact: true }).click();
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    const generate = page.getByRole('button', { name: 'Generate ideas', exact: true });
    await expect(generate).toBeDisabled();
    await expect(page.getByText('Choose a repo to enable Generate ideas.')).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Repo', exact: true })
      .selectOption({ label: displayPath });
    await expect(
      page.getByRole('combobox', { name: 'Provider and model', exact: true }),
    ).toHaveValue('');
    await expect(generate).toBeEnabled();
    await generate.click();
    await expect(page.getByRole('heading', { name: 'Fix the flaky CI job' })).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Mission ideas' }).getByRole('listitem'),
    ).toHaveCount(3);
    await expect(
      page.getByRole('button', { name: 'Try different ideas', exact: true }),
    ).toBeVisible();
    // Nothing was confirmed: still no composer, still no draft in the rail.
    await expect(page.locator('.composer')).toHaveCount(0);
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Fix the flaky CI job' })
      .getByRole('button', { name: 'Use this idea', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Define one finish line.' })).toBeVisible();
    await expect(page.getByText('Step 1 of 4 · Outcome')).toBeVisible();
    await expect(page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Make CI deterministic.',
    );
    await expect(page.getByLabel('Proof of completion', { exact: true })).toHaveValue(
      'Ten green runs.',
    );
    // Still ordinary, editable Outcome fields.
    await page.getByLabel('Finish line', { exact: true }).fill('Make CI deterministic, please.');
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  } finally {
    await teardown(app, dir);
  }
});

test('a failed generation shows a sentence and leaves Skip available', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('repo-ideas-fail');
  try {
    const page = app.page;
    const displayPath = await approveViaUi(app, dir);
    await app.fakeRepoIdeas(null);
    await page.getByRole('button', { name: 'Missions', exact: true }).click();
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Repo', exact: true })
      .selectOption({ label: displayPath });
    await page.getByRole('button', { name: 'Generate ideas', exact: true }).click();
    // The visible notice (the hidden live region repeats the same sentence).
    await expect(
      page.locator('.notice', { hasText: "Couldn't generate ideas right now." }),
    ).toBeVisible();
    await expect(page.getByText(/[A-Z]{3,}_[A-Z_]+/)).toHaveCount(0);
    await page.getByRole('button', { name: /^Skip/ }).click();
    await expect(page.getByRole('heading', { name: 'Define one finish line.' })).toBeVisible();
  } finally {
    await teardown(app, dir);
  }
});
