import { expect, test } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp, type LaunchedApp } from './helpers/app.js';
import { prepareFixtureMission } from './helpers/mission.js';
import { launchWithFixtures, newMissionViaUi, teardown, tempWorkspace } from './helpers/ui.js';

test.setTimeout(90_000);
const destinations = ['Missions', 'Sessions', 'Agents', 'Memory', 'Attention', 'Settings'];
const list = (app: LaunchedApp) =>
  app.call<OperationResponse<'missionComposer.listDrafts'>>('missionComposer.listDrafts');
const read = (app: LaunchedApp, draftId: string) =>
  app.call<OperationResponse<'missionComposer.getDraft'>>('missionComposer.getDraft', { draftId });

async function openDraft(app: LaunchedApp) {
  await newMissionViaUi(app.page, true);
  await expect(app.page.getByLabel('Finish line', { exact: true })).toBeVisible();
  const result = await list(app);
  return result.drafts[0]!.draftId;
}

test('global entry and resume open Missions from every destination', async () => {
  const app = await launchApp();
  try {
    const id = await openDraft(app);
    await app.page.getByLabel('Finish line', { exact: true }).fill('Stable draft identity');
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    for (const name of destinations) {
      await app.page.getByRole('button', { name, exact: true }).click();
      await app.page.getByRole('button', { name: /^Resume draft/ }).click();
      await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue(
        'Stable draft identity',
      );
      await expect(app.page.getByRole('button', { name: 'Missions', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await app.page.getByRole('button', { name, exact: true }).click();
      await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
      await expect(app.page.getByRole('button', { name: /^Skip/ })).toBeVisible();
      await expect(app.page.getByRole('button', { name: 'Missions', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
    expect((await read(app, id)).fieldValues.objective).toBe('Stable draft identity');
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await teardown(app);
  }
});

test('immediate New mission preserves edits through replacement and restart', async () => {
  let app = await launchApp();
  try {
    const id = await openDraft(app);
    await app.page.getByLabel('Finish line', { exact: true }).fill('Last edit before New mission');
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await expect(app.page.getByRole('button', { name: /^Skip/ })).toBeVisible();
    expect((await read(app, id)).fieldValues.objective).toBe('Last edit before New mission');
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    expect((await read(app, id)).fieldValues.objective).toBe('Last edit before New mission');
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await teardown(app);
  }
});

test('failed navigation retains edits, Escape returns focus, retry stays blocked and leaving is explicit', async () => {
  let app = await launchApp();
  try {
    const id = await openDraft(app);
    await app.page.getByLabel('Finish line', { exact: true }).fill('Durable baseline');
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    await app.page.getByRole('button', { name: 'Missions', exact: true }).click();
    await app.page.getByRole('button', { name: /^Resume draft/ }).click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Durable baseline',
    );
    await app.breakStorage();
    await app.page.getByLabel('Finish line', { exact: true }).fill('Unsaved text stays available');
    const target = app.page.getByRole('button', { name: 'Agents', exact: true });
    await target.click();
    const dialog = app.page.getByRole('dialog', { name: 'Unsaved mission changes' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
    if (process.env.SLICE1_EVIDENCE === '1')
      await app.page.screenshot({
        path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-1-save-failure.png',
      });
    await app.page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(target).toBeFocused();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Unsaved text stays available',
    );
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Unsaved text stays available',
    );
    await target.click();
    await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(
      app.page.getByRole('heading', { name: 'Choose or create the right worker' }),
    ).toBeVisible();
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    expect((await read(app, id)).fieldValues.objective).toBe('Durable baseline');
  } finally {
    await teardown(app);
  }
});

test('switching drafts isolates values and persists the exact outgoing draft', async () => {
  const app = await launchApp();
  try {
    const a = await openDraft(app);
    await app.page.getByLabel('Finish line', { exact: true }).fill('Draft A');
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await app.page.getByRole('button', { name: /^Skip/ }).click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue('');
    await app.page.getByLabel('Finish line', { exact: true }).fill('Draft B');
    const b = (await list(app)).drafts.find((d) => d.draftId !== a)!.draftId;
    // Updated drafts sort by recency; A is older than the newly created B.
    await app.page
      .getByRole('button', { name: /^Resume draft/ })
      .last()
      .click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue('Draft A');
    expect((await read(app, a)).fieldValues.objective).toBe('Draft A');
    expect((await read(app, b)).fieldValues.objective).toBe('Draft B');
  } finally {
    await teardown(app);
  }
});

test('selecting a mission replaces its composer and preserves the draft', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('navigation-leader'), tempWorkspace('navigation-worker')];
  try {
    const envelope = await prepareFixtureMission(app, dirs);
    const preview = await app.call<OperationResponse<'missions.preview'>>('missions.preview', {
      envelope,
    });
    const mission = await app.call<OperationResponse<'missions.confirm'>>('missions.confirm', {
      previewToken: preview.previewToken,
      boundaryConfirmation: true,
    });
    await app.page.reload();
    const id = await openDraft(app);
    await app.page
      .getByLabel('Finish line', { exact: true })
      .fill('Preserve outgoing mission draft');
    await app.page.getByRole('option').filter({ hasText: envelope.objective }).click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveCount(0);
    await expect(app.page.locator('#mission-workspace h1')).toHaveText(envelope.objective);
    await expect(app.page.locator(`#mission-rail-${mission.id}`)).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect((await read(app, id)).fieldValues.objective).toBe('Preserve outgoing mission draft');
    expect(
      (
        await app.call<OperationResponse<'missions.detail'>>('missions.detail', {
          missionId: mission.id,
        })
      ).state,
    ).toBe('running');
    expect(await app.liveSessions()).toHaveLength(2);
  } finally {
    await teardown(app, ...dirs);
  }
});

test('a stale save keeps edits until conflict resolution and then permits navigation', async () => {
  const app = await launchApp();
  try {
    const id = await openDraft(app);
    const loaded = await read(app, id);
    await app.call('missionComposer.updateDraft', {
      draftId: id,
      expectedVersion: loaded.version,
      fieldValues: { objective: 'Saved elsewhere' },
      currentStage: 'outcome',
    });
    await app.page.getByLabel('Finish line', { exact: true }).fill('My retained edit');
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    const dialog = app.page.getByRole('dialog', { name: 'Unsaved mission changes' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'My retained edit',
    );
    expect((await read(app, id)).fieldValues.objective).toBe('Saved elsewhere');
    await app.page.getByRole('button', { name: 'Keep my edits', exact: true }).click();
    await expect
      .poll(async () => (await read(app, id)).fieldValues.objective)
      .toBe('My retained edit');
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await expect(app.page.getByRole('button', { name: /^Skip/ })).toBeVisible();
    await app.page.getByRole('button', { name: /^Resume draft/ }).click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'My retained edit',
    );
    const current = await read(app, id);
    await app.call('missionComposer.updateDraft', {
      draftId: id,
      expectedVersion: current.version,
      fieldValues: { objective: 'Chosen saved version' },
      currentStage: 'outcome',
    });
    await app.page.getByLabel('Finish line', { exact: true }).fill('Abandoned local conflict');
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await app.page.getByRole('button', { name: 'Use saved version', exact: true }).click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Chosen saved version',
    );
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    await expect(
      app.page.getByRole('heading', { name: 'Choose or create the right worker' }),
    ).toBeVisible();
    expect((await read(app, id)).fieldValues.objective).toBe('Chosen saved version');
  } finally {
    await teardown(app);
  }
});
