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
  const workerDir = tempWorkspace('composer-crew-worker');
  try {
    const page = app.page;
    const leader = await missionProfile(app, 'Crew coordinator');
    const worker = await missionProfile(app, 'Crew worker');
    const session = await missionSession(app, dir);
    const workerSession = await missionSession(app, workerDir);
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
    // The blocked-continue focus target for this exact readiness message
    // (workers.0.requiredReturnEvidence) must resolve to a real, focusable
    // control — not nothing, as it did before ListEditor accepted data-field.
    const evidenceInput = page.locator('[data-field="workers.0.requiredReturnEvidence"]');
    await evidenceInput.focus();
    await expect(evidenceInput).toBeFocused();
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
    await page
      .getByRole('combobox', { name: 'Worker 1 session', exact: true })
      .selectOption(workerSession.id);
    await next.click();
    await expect(
      page.getByRole('heading', { name: 'Set where the mission may work and when it must stop.' }),
    ).toBeFocused();
    // A worker bound to a live session already has its folder: CrewStage
    // copies the session's workspaceId, so Access shouldn't ask again.
    await expect(
      page.getByRole('combobox', { name: 'Worker 1 folder', exact: true }),
    ).toHaveValue(workerSession.workspaceId);
  } finally {
    await teardown(app, dir, workerDir);
  }
});

async function fillCrew(app: Awaited<ReturnType<typeof launchWithFixtures>>, dir: string) {
  const page = app.page;
  const leader = await missionProfile(app, 'Access coordinator');
  const worker = await missionProfile(app, 'Access worker');
  const session = await missionSession(app, dir);
  await page.reload();
  await fillOutcome(app);
  await page
    .getByRole('combobox', { name: 'Supervisor profile', exact: true })
    .selectOption(leader.profileId);
  await page
    .getByRole('combobox', { name: 'Supervisor session', exact: true })
    .selectOption(session.id);
  await page.getByRole('button', { name: 'Add worker', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Worker 1 profile', exact: true })
    .selectOption(worker.profileId);
  await page
    .getByLabel('What worker 1 contributes', { exact: true })
    .fill('Reproduce and fix the test.');
  await page.getByLabel('What worker 1 must bring back', { exact: true }).fill('A passing run log');
  await page
    .getByRole('button', { name: 'Add to what worker 1 must bring back', exact: true })
    .click();
  await page.getByRole('button', { name: 'Continue to access and limits', exact: true }).click();
  return { leader, worker, session };
}

test('access stage explains read or write, shows readiness, and keeps limits collapsed in words', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-access');
  try {
    const page = app.page;
    await fillCrew(app, dir);
    const next = page.getByRole('button', { name: 'Continue to review', exact: true });
    await expect(next).toBeDisabled();
    await expect(page.getByText('Choose an approved folder for worker 1.')).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
      .selectOption({ index: 1 });
    await expect(
      page.getByText('Write: this worker changes files inside this folder only.'),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Read', exact: true }).check();
    await expect(page.getByText('Read: this worker inspects files and reports.')).toBeVisible();
    await expect(page.getByText('Codex CLI').first()).toBeVisible();
    await expect(page.getByText('Available').first()).toBeVisible();
    const limits = page.locator('details', { hasText: 'Customize limits' });
    await expect(limits.locator('summary')).toContainText('Stops after 30 minutes, 64 turns');
    await expect(page.getByLabel('Elapsed limit (ms)', { exact: true })).toBeHidden();
    const withheld = page.locator('section', { has: page.getByText('What stays off') });
    await expect(withheld.getByText('What stays off')).toBeVisible();
    await expect(withheld.getByText('Break-glass bypass')).toBeVisible();
    await expect(next).toBeEnabled();
    await next.click();
    await expect(
      page.getByRole('heading', { name: 'Review the exact mission before anything starts.' }),
    ).toBeFocused();
  } finally {
    await teardown(app, dir);
  }
});

async function fillAccess(app: Awaited<ReturnType<typeof launchWithFixtures>>, dir: string) {
  const crew = await fillCrew(app, dir);
  const page = app.page;
  await page
    .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
    .selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Review the exact mission before anything starts.' }),
  ).toBeFocused();
  return crew;
}

test('review shows a launch brief, requires confirmation, and starts the mission', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-review');
  try {
    const page = app.page;
    await fillAccess(app, dir);
    await expect(page.locator('.composer-state.ready')).toBeVisible();
    // The shared, single live region announces the real preview outcome, not
    // just a constant per-stage message.
    await expect(page.getByRole('status').filter({ hasText: 'Ready to start' })).toBeVisible();
    const brief = page.getByRole('region', { name: 'Launch brief' });
    await expect(brief).toContainText('Fix the flaky terminal test.');
    await expect(brief).toContainText('Reproduce and fix the test.');
    await expect(brief).toContainText('A passing run log');
    await expect(brief).toContainText('Stops after 30 minutes');
    await expect(page.getByRole('heading', { name: 'Review mission authority' })).toBeVisible();
    const start = page.getByRole('button', { name: 'Start mission', exact: true });
    await expect(start).toBeDisabled();
    await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
    await start.click();
    const detail = page.getByRole('dialog', { name: 'Mission detail', exact: true });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Assignment: Reproduce and fix the test.');
    await expect(detail).toContainText('Must bring back: A passing run log');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: /Fix the flaky terminal test/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Resume draft/ })).toHaveCount(0);
  } finally {
    await teardown(app, dir);
  }
});

test('editing after preview shows Mission changed, and an expired review returns to access', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-states');
  try {
    const page = app.page;
    await fillAccess(app, dir);
    await expect(page.locator('.composer-state.ready')).toBeVisible();
    await page.getByRole('button', { name: 'Outcome', exact: true }).click();
    await page
      .getByLabel('Finish line', { exact: true })
      .fill('Fix the flaky terminal test, quickly.');
    await page.getByRole('button', { name: 'Continue to crew', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to access and limits', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
    await expect(page.locator('.composer-state.ready')).toBeVisible();
    await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
    await app.advanceClock(121_000);
    await page.getByRole('button', { name: 'Start mission', exact: true }).click();
    await expect(page.getByText('Approval expired')).toBeVisible();
    await expect(
      page.getByText('The review expired. Return to access and limits for a fresh approval.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Return to access and limits', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Set where the mission may work and when it must stop.' }),
    ).toBeFocused();
    await expect(page.getByText('approval stale')).toBeVisible();
    expect(await app.liveSessions()).toHaveLength(1);
  } finally {
    await teardown(app, dir);
  }
});

test('revision reuses the composer and applies through the revision path', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-revise');
  try {
    const page = app.page;
    await fillAccess(app, dir);
    await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
    await page.getByRole('button', { name: 'Start mission', exact: true }).click();
    const detail = page.getByRole('dialog', { name: 'Mission detail', exact: true });
    await detail.getByRole('button', { name: 'Pause mission', exact: true }).click();
    await expect(detail.getByRole('status')).toContainText('paused');
    await detail.getByRole('button', { name: 'Revise envelope…', exact: true }).click();
    await expect(detail).toBeHidden();
    await expect(page.getByText('Step 4 of 4 · Review · Revise mission')).toBeVisible();
    await page.getByRole('button', { name: 'Outcome', exact: true }).click();
    await page.getByLabel('Finish line', { exact: true }).fill('Revised finish line.');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
    await page.getByRole('button', { name: 'Apply revision', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Mission detail', exact: true })).toContainText(
      'Revised finish line.',
    );
  } finally {
    await teardown(app, dir);
  }
});

test('drafts appear in the rail and the context rail explains the draft', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await page.getByLabel('Finish line', { exact: true }).fill('Draft one.');
    const context = page.getByRole('complementary', { name: 'Mission context' });
    await expect(context.getByText('Mission draft')).toBeVisible();
    await expect(context.getByText('Outcome')).toBeVisible();
    await expect(context.getByText('No crew chosen')).toBeVisible();
    await expect(context.getByText('Break-glass bypass')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Close composer', exact: true }).click();
    const rail = page.getByRole('navigation', { name: 'Mission workspace' });
    await expect(rail.getByText('Drafts (1)')).toBeVisible();
    await rail.getByRole('button', { name: /^Resume draft · Outcome/ }).click();
    await expect(page.getByLabel('Finish line', { exact: true })).toHaveValue('Draft one.');
  } finally {
    await teardown(app);
  }
});

test('a save failure keeps the composer open and offers retry, keep editing, discard', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await page.getByLabel('Finish line', { exact: true }).fill('Before the failure.');
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
    await app.breakStorage();
    await page.getByLabel('Finish line', { exact: true }).fill('Before the failure. And after.');
    const banner = page.getByRole('alert').filter({ hasText: 'Nothing has been discarded' });
    await expect(banner).toBeVisible();
    await expect(page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Before the failure. And after.',
    );
    await expect(
      page.getByRole('button', { name: 'Continue to crew', exact: true }),
    ).toBeDisabled();
    await expect(banner.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Keep editing', exact: true })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Discard draft…', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await teardown(app);
  }
});
