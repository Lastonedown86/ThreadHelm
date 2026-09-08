import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type {
  MissionRecipeEditor,
  MissionRecipeDetail,
  MissionRecipeReceipt,
} from '@threadhelm/contracts';
import { createWorld } from './helpers/fake-context.js';

describe('recipe lifecycle authority and exact previews', () => {
  it('denies bundled mutation, invalidates lifecycle previews, retains copied drafts and retries deletion', async () => {
    const w = createWorld();
    const list = await w.ok<{ items: MissionRecipeDetail[] }>('missionRecipes.list');
    const starter = list.items[0]!;
    const target = {
      recipeId: starter.recipeId,
      revisionId: starter.revisionId,
      expectedVersion: starter.version,
    };
    expect((await w.call('missionRecipes.edit', target)).ok).toBe(false);
    expect(
      (
        await w.call('missionRecipes.previewDelete', {
          recipeId: starter.recipeId,
          expectedVersion: 1,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await w.call('missionRecipes.setEnabled', {
          recipeId: starter.recipeId,
          expectedVersion: 1,
          enabled: false,
          requestId: randomUUID(),
        })
      ).ok,
    ).toBe(false);
    const editor = await w.ok<MissionRecipeEditor>('missionRecipes.duplicate', target);
    const savePreview = await w.ok<{ previewId: string }>('missionRecipes.previewSave', {
      editorId: editor.editorId,
      expectedVersion: 1,
    });
    const receipt = await w.ok<MissionRecipeReceipt>('missionRecipes.save', {
      previewId: savePreview.previewId,
      requestId: randomUUID(),
    });
    const personal = await w.ok<MissionRecipeDetail>('missionRecipes.get', {
      recipeId: receipt.targetId,
    });
    expect(personal.recipeId).not.toBe(starter.recipeId);
    const values = Object.fromEntries(
      personal.content!.variables.map((v) => [v.key, 'Review item']),
    );
    const preview = await w.ok<{ previewId: string }>('missionRecipes.preview', {
      recipeId: personal.recipeId,
      revisionId: personal.revisionId,
      expectedVersion: 1,
      values,
    });
    const created = await w.ok<MissionRecipeReceipt>('missionRecipes.createDraft', {
      previewId: preview.previewId,
      requestId: randomUUID(),
    });
    const draft = await w.ok('missionComposer.getDraft', { draftId: created.targetId });
    const stale = await w.ok<{ previewId: string }>('missionRecipes.preview', {
      recipeId: personal.recipeId,
      revisionId: personal.revisionId,
      expectedVersion: 1,
      values,
    });
    await w.ok('missionRecipes.setEnabled', {
      recipeId: personal.recipeId,
      expectedVersion: 1,
      enabled: false,
      requestId: randomUUID(),
    });
    await w.ok('missionRecipes.setEnabled', {
      recipeId: personal.recipeId,
      expectedVersion: 2,
      enabled: true,
      requestId: randomUUID(),
    });
    expect(
      (
        await w.call('missionRecipes.createDraft', {
          previewId: stale.previewId,
          requestId: randomUUID(),
        })
      ).ok,
    ).toBe(false);
    const deletion = await w.ok<{ previewId: string }>('missionRecipes.previewDelete', {
      recipeId: personal.recipeId,
      expectedVersion: 3,
    });
    // An operation token cannot authorize a different mutation.
    expect(
      (
        await w.call('missionRecipes.save', {
          previewId: deletion.previewId,
          requestId: randomUUID(),
        })
      ).ok,
    ).toBe(false);
    const command = { previewId: deletion.previewId, requestId: randomUUID() };
    const deleted = await w.ok('missionRecipes.delete', command);
    expect(await w.ok('missionRecipes.delete', command)).toEqual(deleted);
    expect(await w.ok('missionComposer.getDraft', { draftId: created.targetId })).toEqual(draft);
    expect((await w.call('missionRecipes.get', { recipeId: personal.recipeId })).ok).toBe(false);
    expect(w.hosts).toEqual([]);
    for (const event of w.events.filter((event) => event.name === 'missionRecipes.changed'))
      expect(Object.keys(event.payload as object).sort()).toEqual([
        'kind',
        'occurredAt',
        'recipeId',
        'type',
        'version',
      ]);
  });
  it('checks editor and base versions and preserves a conflicting editor', async () => {
    const w = createWorld();
    const editor = await w.ok<MissionRecipeEditor>('missionRecipes.openEditor', {});
    const saved = await w.ok<MissionRecipeEditor>('missionRecipes.saveEditor', {
      editorId: editor.editorId,
      expectedVersion: 1,
      content: { ...editor.content, name: 'Review', outcomeScaffold: 'Review changes' },
    });
    const preview = await w.ok<{ previewId: string }>('missionRecipes.previewSave', {
      editorId: editor.editorId,
      expectedVersion: saved.version,
    });
    const receipt = await w.ok<MissionRecipeReceipt>('missionRecipes.save', {
      previewId: preview.previewId,
      requestId: randomUUID(),
    });
    const detail = await w.ok<MissionRecipeDetail>('missionRecipes.get', {
      recipeId: receipt.targetId,
    });
    const first = await w.ok<MissionRecipeEditor>('missionRecipes.edit', {
      recipeId: detail.recipeId,
      revisionId: detail.revisionId,
      expectedVersion: 1,
    });
    const second = await w.ok<MissionRecipeEditor>('missionRecipes.edit', {
      recipeId: detail.recipeId,
      revisionId: detail.revisionId,
      expectedVersion: 1,
    });
    const a = await w.ok<{ previewId: string }>('missionRecipes.previewSave', {
      editorId: first.editorId,
      expectedVersion: 1,
    });
    const b = await w.ok<{ previewId: string }>('missionRecipes.previewSave', {
      editorId: second.editorId,
      expectedVersion: 1,
    });
    await w.ok('missionRecipes.save', { previewId: a.previewId, requestId: randomUUID() });
    expect(
      (await w.call('missionRecipes.save', { previewId: b.previewId, requestId: randomUUID() })).ok,
    ).toBe(false);
    expect(await w.ok('missionRecipes.getEditor', { editorId: second.editorId })).toEqual(second);
  });
});
