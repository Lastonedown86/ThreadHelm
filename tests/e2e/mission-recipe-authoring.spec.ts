import { test, expect } from '@playwright/test';
import { launchApp, cleanupUserData } from './helpers/app.js';
import type {
  MissionComposerDraftDetailView,
  MissionRecipeEditor,
  MissionRecipeDetail,
} from '@threadhelm/contracts';

test('stale authoring preserves local edits as a deliberate independent copy', async () => {
  const app = await launchApp();
  try {
    let initial = await app.call<MissionRecipeEditor>('missionRecipes.openEditor');
    initial = await app.call<MissionRecipeEditor>('missionRecipes.saveEditor', {
      editorId: initial.editorId,
      expectedVersion: initial.version,
      content: {
        ...initial.content,
        name: 'Shared editor',
        outcomeScaffold: 'Review the selected subject',
      },
    });
    await app.page.getByRole('button', { name: 'Start from recipe' }).click();
    await app.page.getByText('Resume recipe editors', { exact: true }).click();
    await app.page.getByRole('button', { name: /Shared editor ·/ }).click();
    await expect(app.page.getByLabel('Recipe name')).toHaveValue('Shared editor');
    await app.call('missionRecipes.saveEditor', {
      editorId: initial.editorId,
      expectedVersion: initial.version,
      content: { ...initial.content, name: 'Saved elsewhere' },
    });
    await app.page.getByLabel('Recipe name').fill('My independent edits');
    await app.page.getByRole('button', { name: 'Preview saved recipe' }).click();
    await expect(app.page.getByRole('alert')).toContainText('saved elsewhere');
    await app.page.getByRole('button', { name: 'Copy my edits to a new editor' }).click();
    await expect(app.page.getByText('Saved locally', { exact: true })).toBeVisible();
    await expect(app.page.getByLabel('Recipe name')).toHaveValue('My independent edits');
    const original = await app.call<MissionRecipeEditor>('missionRecipes.getEditor', {
      editorId: initial.editorId,
    });
    expect(original.content.name).toBe('Saved elsewhere');
    const buffers = await app.call<{ items: { editorId: string; name: string }[] }>(
      'missionRecipes.listEditors',
    );
    expect(buffers.items).toHaveLength(2);
    expect(buffers.items.find((item) => item.editorId !== initial.editorId)?.name).toBe(
      'My independent edits',
    );
  } finally {
    await app.close();
    cleanupUserData(app.userData);
  }
});

test('edits during an acknowledged save drain before navigation with one writer', async () => {
  const app = await launchApp();
  try {
    await app.app.evaluate(({ ipcMain }) => {
      const probe = { active: 0, maximum: 0, calls: 0 };
      const globals = globalThis as unknown as {
        __threadhelmTest: { dispatch(name: string, payload: unknown): unknown };
        recipeQueueProbe: typeof probe;
      };
      globals.recipeQueueProbe = probe;
      ipcMain.removeHandler('op:missionRecipes.saveEditor');
      ipcMain.handle('op:missionRecipes.saveEditor', async (_event, payload: unknown) => {
        probe.active++;
        probe.calls++;
        probe.maximum = Math.max(probe.maximum, probe.active);
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return await globals.__threadhelmTest.dispatch('missionRecipes.saveEditor', payload);
        } finally {
          probe.active--;
        }
      });
    });
    await app.page.getByRole('button', { name: 'Start from recipe' }).click();
    await app.page.getByRole('button', { name: 'New personal recipe' }).click();
    await app.page.getByLabel('Recipe name').fill('First snapshot');
    await expect(app.page.getByText('Saving locally', { exact: true })).toBeVisible();
    await app.page.getByLabel('Recipe name').fill('Latest snapshot');
    await app.page.getByRole('button', { name: 'Close recipes', exact: true }).click();
    await expect(
      app.page.getByRole('heading', { name: 'Mission recipes', exact: true }),
    ).toHaveCount(0);
    const buffers = await app.call<{ items: { editorId: string }[] }>('missionRecipes.listEditors');
    const saved = await app.call<MissionRecipeEditor>('missionRecipes.getEditor', {
      editorId: buffers.items[0]!.editorId,
    });
    expect(saved.content.name).toBe('Latest snapshot');
    const probe = await app.app.evaluate(
      () =>
        (globalThis as unknown as { recipeQueueProbe: { maximum: number; calls: number } })
          .recipeQueueProbe,
    );
    expect(probe.maximum).toBe(1);
    expect(probe.calls).toBe(2);
  } finally {
    await app.close();
    cleanupUserData(app.userData);
  }
});

test('explicit source selection, safe editor restart and reviewed personal save preserve source', async () => {
  let app = await launchApp();
  const userData = app.userData;
  try {
    const source = await app.call<MissionComposerDraftDetailView>('missionComposer.createDraft');
    await app.call('missionComposer.updateDraft', {
      draftId: source.draftId,
      expectedVersion: source.version,
      currentStage: 'outcome',
      fieldValues: {
        objective: 'Investigate the reported timeout',
        completionEvidence: 'Do not copy this checklist',
      },
    });
    await app.page
      .getByRole('button', { name: /Resume draft.*Investigate the reported timeout/ })
      .click();
    await expect(app.page.getByRole('heading', { name: 'Define one finish line.' })).toBeVisible();
    await app.page.getByRole('button', { name: 'Save as recipe', exact: true }).click();
    await expect(app.page.getByLabel('Outcome', { exact: true })).not.toBeChecked();
    await expect(app.page.getByLabel('Acceptance checklist', { exact: true })).not.toBeChecked();
    await app.page.getByLabel('Outcome', { exact: true }).check();
    await app.page.getByRole('button', { name: 'Preview selected content' }).click();
    await expect(app.page.getByLabel('Selected outcome')).toHaveValue(
      'Investigate the reported timeout',
    );
    await expect(app.page.getByText('Do not copy this checklist', { exact: true })).toHaveCount(0);
    await app.page.getByRole('button', { name: 'Use selected content' }).click();
    await app.page.getByLabel('Recipe name', { exact: false }).fill('Timeout review');
    await expect(app.page.getByText('Saved locally', { exact: true })).toBeVisible();
    const buffers = await app.call<{ items: { editorId: string }[] }>('missionRecipes.listEditors');
    const editor = await app.call<MissionRecipeEditor>('missionRecipes.getEditor', {
      editorId: buffers.items[0]!.editorId,
    });
    expect(editor.content.acceptanceChecklist).toEqual([]);
    await app.close();
    app = await launchApp({ userData });
    await app.page.getByRole('button', { name: 'Start from recipe' }).click();
    await app.page.getByText('Resume recipe editors', { exact: true }).click();
    await app.page.getByRole('button', { name: /Timeout review ·/ }).click();
    await expect(app.page.getByLabel('Recipe name')).toHaveValue('Timeout review');
    await app.page.getByRole('button', { name: 'Preview saved recipe' }).click();
    await app.page.getByRole('button', { name: 'Save personal recipe', exact: true }).click();
    await expect(
      app.page.getByRole('heading', { name: 'Timeout review', exact: true }),
    ).toBeVisible();
    const list = await app.call<{ items: MissionRecipeDetail[] }>('missionRecipes.list', {
      origin: 'personal',
    });
    expect(list.items).toHaveLength(1);
    const saved = await app.call<MissionRecipeDetail>('missionRecipes.get', {
      recipeId: list.items[0]!.recipeId,
    });
    expect(saved.content?.outcomeScaffold).toBe('Investigate the reported timeout');
    expect(saved.content?.acceptanceChecklist).toEqual([]);
    const unchanged = await app.call<MissionComposerDraftDetailView>('missionComposer.getDraft', {
      draftId: source.draftId,
    });
    expect(unchanged.fieldValues.completionEvidence).toBe('Do not copy this checklist');
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await app.close();
    cleanupUserData(userData);
  }
});

test('invalid edits block navigation and remain visible until explicit discard', async () => {
  const app = await launchApp();
  try {
    await app.page.getByRole('button', { name: 'Start from recipe' }).click();
    await app.page.getByRole('button', { name: 'New personal recipe' }).click();
    await app.page.getByLabel('Recipe name').fill('x'.repeat(121));
    await app.page.getByRole('button', { name: 'Close recipes', exact: true }).click();
    await expect(app.page.getByRole('dialog', { name: 'Unsaved changes' })).toBeVisible();
    await app.page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(app.page.getByLabel('Recipe name')).toHaveValue('x'.repeat(121));
    const buffers = await app.call<{ items: { editorId: string }[] }>('missionRecipes.listEditors');
    const saved = await app.call<MissionRecipeEditor>('missionRecipes.getEditor', {
      editorId: buffers.items[0]!.editorId,
    });
    expect(saved.content.name).not.toBe('x'.repeat(121));
    await app.page.getByRole('button', { name: 'Discard editor', exact: true }).click();
    await app.page.getByRole('button', { name: 'Discard permanently' }).click();
    await expect(app.page.getByRole('heading', { name: 'Personal recipe editor' })).toHaveCount(0);
    expect((await app.call<{ items: unknown[] }>('missionRecipes.listEditors')).items).toHaveLength(
      0,
    );
  } finally {
    await app.close();
    cleanupUserData(app.userData);
  }
});
