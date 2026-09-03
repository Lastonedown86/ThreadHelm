import { expect, test } from '@playwright/test';
import { launchApp } from './helpers/app.js';
import { missionProfile, missionSession } from './helpers/mission.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

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

async function fillOutcome(app: Awaited<ReturnType<typeof launchApp>>) {
  const page = app.page;
  await page.getByRole('button', { name: 'New mission…', exact: true }).click();
  await page.getByLabel('Finish line', { exact: true }).fill('Fix the flaky terminal test.');
  await page.getByLabel('Proof of completion', { exact: true }).fill('Three green runs.');
  await page.getByRole('button', { name: 'Continue to crew', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose who does the work.' })).toBeFocused();
}

test('crew stage explains prerequisites and routes to the fix', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    await fillOutcome(app);
    await expect(page.getByRole('combobox')).toHaveCount(0);
    // Scoped to the stage's own notice: the readiness bar restates the same
    // prerequisite with different wording and would otherwise ambiguously match.
    const notice = page.locator('.composer-notice');
    await expect(notice.getByText('No reviewed profile yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Create agent', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Choose or create the right worker' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Missions', exact: true }).click();
    await page.getByRole('button', { name: /^Resume draft · Crew/ }).click();
    await expect(notice.getByText('No reviewed profile yet.')).toBeVisible();
  } finally {
    await teardown(app);
  }
});

test('crew stage names every missing worker field and collapses runtime under a summary', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-crew');
  try {
    const page = app.page;
    const leader = await missionProfile(app, 'Crew coordinator');
    const worker = await missionProfile(app, 'Crew worker');
    const session = await missionSession(app, dir);
    await page.reload();
    await fillOutcome(app);
    await page
      .getByRole('combobox', { name: 'Supervisor profile', exact: true })
      .selectOption(leader.profileId);
    await page
      .getByRole('combobox', { name: 'Supervisor session', exact: true })
      .selectOption(session.id);
    const next = page.getByRole('button', { name: 'Continue to access and limits', exact: true });
    await expect(next).toBeDisabled();
    // exact: true targets the visible readiness bar; the hidden live region's
    // text carries the same message with a "Step N of 4" prefix and would
    // otherwise ambiguously match a substring search.
    await expect(page.getByText('Add at least one worker.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add worker', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Worker 1 profile', exact: true })
      .selectOption(worker.profileId);
    await expect(page.getByText('Say what worker 1 contributes.', { exact: true })).toBeVisible();
    await page
      .getByLabel('What worker 1 contributes', { exact: true })
      .fill('Reproduce and fix the test.');
    await expect(
      page.getByText('Add one thing worker 1 must bring back.', { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('What worker 1 must bring back', { exact: true })
      .fill('A passing run log');
    await page
      .getByRole('button', { name: 'Add to what worker 1 must bring back', exact: true })
      .click();
    await expect(next).toBeEnabled();
    const runtime = page.getByRole('group', { name: 'Worker 1' }).locator('details');
    await expect(runtime.locator('summary')).toContainText('Provider default model');
    await expect(runtime.locator('summary')).toContainText('starts only when you launch it');
    await expect(page.getByLabel('Worker 1 model', { exact: true })).toBeHidden();
    await runtime.locator('summary').click();
    await expect(page.getByLabel('Worker 1 model', { exact: true })).toBeVisible();
    await next.click();
    await expect(
      page.getByRole('heading', { name: 'Set where the mission may work and when it must stop.' }),
    ).toBeFocused();
  } finally {
    await teardown(app, dir);
  }
});
