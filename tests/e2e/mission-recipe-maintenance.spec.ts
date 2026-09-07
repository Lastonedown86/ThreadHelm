import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { launchApp, cleanupUserData } from './helpers/app.js';
import type {
  MissionRecipeEditor,
  MissionRecipeDetail,
  MissionRecipeReceipt,
  MissionComposerDraftDetailView,
} from '@threadhelm/contracts';

test('revision, availability and deletion preserve two independent drafts across restart', async () => {
  let app = await launchApp();
  const userData = app.userData;
  try {
    let editor = await app.call<MissionRecipeEditor>('missionRecipes.openEditor');
    editor = await app.call<MissionRecipeEditor>('missionRecipes.saveEditor', {
      editorId: editor.editorId,
      expectedVersion: editor.version,
      content: {
        name: 'Maintenance recipe',
        description: 'Generic reusable text',
        outcomeScaffold: 'Review {{item}}',
        acceptanceChecklist: ['Record findings'],
        suggestedRoles: ['Reviewer'],
        variables: [{ key: 'item', label: 'Item', required: true }],
      },
    });
    const savePreview = await app.call<{ previewId: string }>('missionRecipes.previewSave', {
      editorId: editor.editorId,
      expectedVersion: editor.version,
    });
    const receipt = await app.call<MissionRecipeReceipt>('missionRecipes.save', {
      previewId: savePreview.previewId,
      requestId: randomUUID(),
    });
    const original = await app.call<MissionRecipeDetail>('missionRecipes.get', {
      recipeId: receipt.targetId,
    });
    const drafts: MissionComposerDraftDetailView[] = [];
    for (const item of ['First copy', 'Second copy']) {
      const preview = await app.call<{ previewId: string }>('missionRecipes.preview', {
        recipeId: original.recipeId,
        revisionId: original.revisionId,
        expectedVersion: original.version,
        values: { item },
      });
      const draftReceipt = await app.call<MissionRecipeReceipt>('missionRecipes.createDraft', {
        previewId: preview.previewId,
        requestId: randomUUID(),
      });
      drafts.push(
        await app.call<MissionComposerDraftDetailView>('missionComposer.getDraft', {
          draftId: draftReceipt.targetId,
        }),
      );
    }
    await app.page.getByRole('button', { name: 'Start from recipe' }).click();
    await app.page.getByRole('button', { name: 'Maintenance recipe', exact: true }).click();
    await app.page.getByRole('button', { name: 'Edit recipe', exact: true }).click();
    await app.page.getByLabel('Outcome scaffold').fill('Updated {{item}}');
    await app.page.getByRole('button', { name: 'Preview saved recipe' }).click();
    await app.page.getByRole('button', { name: 'Save personal recipe', exact: true }).click();
    await expect(
      app.page.getByRole('heading', { name: 'Maintenance recipe', exact: true }),
    ).toBeVisible();
    const revised = await app.call<MissionRecipeDetail>('missionRecipes.get', {
      recipeId: original.recipeId,
    });
    expect(revised.ordinal).toBe(2);
    expect(revised.revisionId).not.toBe(original.revisionId);
    await app.page.getByLabel('Item (required)').fill('Kept literal value');
    await app.page.getByRole('button', { name: 'Preview draft', exact: true }).click();
    await app.page.getByRole('button', { name: 'Disable recipe', exact: true }).click();
    await expect(
      app.page.getByRole('button', { name: 'Preview draft', exact: true }),
    ).toBeDisabled();
    await app.page.getByRole('button', { name: 'Enable recipe', exact: true }).click();
    await expect(app.page.getByLabel('Item (required)')).toHaveValue('Kept literal value');
    await expect(app.page.getByRole('button', { name: 'Create draft', exact: true })).toHaveCount(
      0,
    );
    await app.page.getByRole('button', { name: 'Delete personal recipe', exact: true }).click();
    await expect(app.page.getByRole('dialog', { name: 'Delete personal recipe' })).toContainText(
      original.recipeId,
    );
    await app.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(
      (await app.call<MissionRecipeDetail>('missionRecipes.get', { recipeId: original.recipeId }))
        .ordinal,
    ).toBe(2);
    await app.page.getByRole('button', { name: 'Delete personal recipe', exact: true }).click();
    await app.page.getByRole('button', { name: 'Delete recipe', exact: true }).click();
    await expect(app.page.getByRole('dialog')).toHaveCount(0);
    expect((await app.dispatch('missionRecipes.get', { recipeId: original.recipeId })).ok).toBe(
      false,
    );
    await app.close();
    app = await launchApp({ userData });
    for (const before of drafts) {
      const after = await app.call<MissionComposerDraftDetailView>('missionComposer.getDraft', {
        draftId: before.draftId,
      });
      expect(after.fieldValues).toEqual(before.fieldValues);
      expect(after.recipeContext).toEqual(before.recipeContext);
    }
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await app.close();
    cleanupUserData(userData);
  }
});
