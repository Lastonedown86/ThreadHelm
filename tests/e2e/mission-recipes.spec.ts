import { test, expect } from '@playwright/test';
import { launchApp, cleanupUserData } from './helpers/app.js';
import type { MissionComposerDraftDetailView } from '@threadhelm/contracts';

test('draft capacity failure retains values and exposes the existing inventory', async () => {
  const app = await launchApp();
  try {
    for (let i = 0; i < 20; i++) await app.call('missionComposer.createDraft');
    await app.page.getByRole('button', { name: 'Start from recipe' }).click();
    await app.page.getByRole('button', { name: 'Investigate a bug', exact: true }).click();
    await app.page.getByLabel('Symptom (required)').fill('Retained capacity input');
    await app.page.getByRole('button', { name: 'Preview draft', exact: true }).click();
    await app.page.getByRole('button', { name: 'Create draft', exact: true }).click();
    await expect(app.page.getByRole('alert')).toContainText('20 open drafts');
    await expect(app.page.getByLabel('Symptom (required)')).toHaveValue('Retained capacity input');
    await expect(app.page.locator('.mission-rail-drafts')).toHaveAttribute('open', '');
    expect(
      (await app.call<{ drafts: unknown[] }>('missionComposer.listDrafts')).drafts,
    ).toHaveLength(20);
  } finally {
    await app.close();
    cleanupUserData(app.userData);
  }
});

for (const [name, field, value] of [
  ['Review a PR', 'PR reference (literal text) (required)', 'https://example.invalid/pull/6'],
  ['Prepare a release', 'Release name (required)', 'Release six'],
] as const) {
  test(`${name} previews literal content and opens an independent draft`, async () => {
    const app = await launchApp();
    try {
      await app.page.getByRole('button', { name: 'Start from recipe' }).click();
      await app.page.getByRole('button', { name, exact: true }).click();
      await app.page.getByLabel(field).fill(value);
      await app.page.getByRole('button', { name: 'Preview draft', exact: true }).click();
      await expect(app.page.getByRole('region', { name: 'Draft preview' })).toContainText(value);
      await app.page.getByRole('button', { name: 'Create draft', exact: true }).click();
      await expect(
        app.page.getByRole('heading', { name: 'Define one finish line.' }),
      ).toBeVisible();
      const list = await app.call<{ drafts: { draftId: string }[] }>('missionComposer.listDrafts');
      expect(list.drafts).toHaveLength(1);
      const draft = await app.call<MissionComposerDraftDetailView>('missionComposer.getDraft', {
        draftId: list.drafts[0]!.draftId,
      });
      expect(draft.fieldValues.objective).toContain(value);
      expect(draft.recipeContext?.name).toBe(name);
      expect(draft.sourceMissionId).toBeNull();
      expect(await app.liveSessions()).toEqual([]);
    } finally {
      await app.close();
      cleanupUserData(app.userData);
    }
  });
}

test('starter preview creates a separate editable draft without starting a session', async () => {
  const app = await launchApp();
  try {
    await app.page.getByRole('button', { name: 'Start from recipe', exact: true }).click();
    await app.page.getByRole('button', { name: 'Investigate a bug', exact: true }).click();
    await app.page.getByLabel('Symptom (required)').fill('Repeated timeout');
    await app.page.getByRole('button', { name: 'Preview draft', exact: true }).click();
    await expect(
      app.page.getByRole('heading', { name: 'Draft preview', exact: true }),
    ).toBeVisible();
    await app.page.getByRole('button', { name: 'Create draft', exact: true }).click();
    await expect(app.page.getByRole('heading', { name: 'Define one finish line.' })).toBeVisible();
    const list = await app.call<{ drafts: { draftId: string }[] }>('missionComposer.listDrafts');
    expect(list.drafts).toHaveLength(1);
    const draft = await app.call<MissionComposerDraftDetailView>('missionComposer.getDraft', {
      draftId: list.drafts[0]!.draftId,
    });
    expect(draft.sourceMissionId).toBeNull();
    expect(draft.fieldValues.objective).toContain('Repeated timeout');
    expect(draft.recipeContext?.name).toBe('Investigate a bug');
    await app.page.getByLabel('Suggested role 1').fill('Independent investigation');
    await app.page.getByRole('button', { name: 'Close', exact: true }).click();
    const saved = await app.call<MissionComposerDraftDetailView>('missionComposer.getDraft', {
      draftId: draft.draftId,
    });
    expect(saved.recipeContext?.suggestedRoles[0]).toBe('Independent investigation');
    expect(saved.recipeContext?.expanded.suggestedRoles[0]).not.toBe('Independent investigation');
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await app.close();
    cleanupUserData(app.userData);
  }
});
