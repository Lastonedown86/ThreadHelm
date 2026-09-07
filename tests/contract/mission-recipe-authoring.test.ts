import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type {
  MissionRecipeEditor,
  MissionRecipeReceipt,
  MissionRecipeDetail,
} from '@threadhelm/contracts';
import { createWorld } from './helpers/fake-context.js';

describe('personal recipe authoring', () => {
  it('explicitly extracts selected fields, saves complete revision and retries exactly once', async () => {
    const w = createWorld();
    const draft = await w.ok<{ draftId: string; version: number }>('missionComposer.createDraft');
    await w.ok('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { objective: 'Investigate', completionEvidence: 'Evidence line' },
      currentStage: 'outcome',
    });
    const source = { kind: 'draft', id: draft.draftId, version: 2 };
    const selection = await w.ok<{ previewId: string; content: MissionRecipeEditor['content'] }>(
      'missionRecipes.previewSource',
      { source, fields: ['objective'] },
    );
    expect(selection.content.acceptanceChecklist).toEqual([]);
    const editor = await w.ok<MissionRecipeEditor>('missionRecipes.openEditor', {
      sourcePreviewId: selection.previewId,
    });
    const updated = await w.ok<MissionRecipeEditor>('missionRecipes.saveEditor', {
      editorId: editor.editorId,
      expectedVersion: editor.version,
      content: { ...editor.content, name: 'Personal investigation' },
    });
    const preview = await w.ok<{ previewId: string }>('missionRecipes.previewSave', {
      editorId: editor.editorId,
      expectedVersion: updated.version,
    });
    const input = { previewId: preview.previewId, requestId: randomUUID() };
    const receipt = await w.ok<MissionRecipeReceipt>('missionRecipes.save', input);
    expect(await w.ok('missionRecipes.save', input)).toEqual(receipt);
    const recipe = await w.ok<MissionRecipeDetail>('missionRecipes.get', {
      recipeId: receipt.targetId,
    });
    expect(recipe.content?.name).toBe('Personal investigation');
    expect(recipe.content?.acceptanceChecklist).toEqual([]);
    expect(recipe.origin).toBe('personal');
    expect(w.hosts).toEqual([]);
  });
  it('holds save when source changed and retains editor input', async () => {
    const w = createWorld();
    const editor = await w.ok<MissionRecipeEditor>('missionRecipes.openEditor', {});
    const saved = await w.ok<MissionRecipeEditor>('missionRecipes.saveEditor', {
      editorId: editor.editorId,
      expectedVersion: 1,
      content: { ...editor.content, name: 'Saved input', outcomeScaffold: 'Review' },
    });
    expect(
      (
        await w.call('missionRecipes.saveEditor', {
          editorId: editor.editorId,
          expectedVersion: 1,
          content: saved.content,
        })
      ).ok,
    ).toBe(false);
    expect(await w.ok('missionRecipes.getEditor', { editorId: editor.editorId })).toEqual(saved);
  });
  it('rejects a changed source inside final save and permits explicit independent conversion', async () => {
    const w = createWorld();
    const draft = await w.ok<{ draftId: string }>('missionComposer.createDraft');
    await w.ok('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { objective: 'Selected source' },
      currentStage: 'outcome',
    });
    const selected = await w.ok<{ previewId: string }>('missionRecipes.previewSource', {
      source: { kind: 'draft', id: draft.draftId, version: 2 },
      fields: ['objective'],
    });
    const editor = await w.ok<MissionRecipeEditor>('missionRecipes.openEditor', {
      sourcePreviewId: selected.previewId,
    });
    const saved = await w.ok<MissionRecipeEditor>('missionRecipes.saveEditor', {
      editorId: editor.editorId,
      expectedVersion: 1,
      content: { ...editor.content, name: 'Independent' },
    });
    const preview = await w.ok<{ previewId: string }>('missionRecipes.previewSave', {
      editorId: editor.editorId,
      expectedVersion: saved.version,
    });
    await w.ok('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: 2,
      fieldValues: { objective: 'Changed source' },
      currentStage: 'outcome',
    });
    expect(
      (
        await w.call('missionRecipes.save', {
          previewId: preview.previewId,
          requestId: randomUUID(),
        })
      ).ok,
    ).toBe(false);
    expect(
      (await w.ok<MissionRecipeEditor>('missionRecipes.getEditor', { editorId: editor.editorId }))
        .content.outcomeScaffold,
    ).toBe('Selected source');
    const manual = await w.ok<MissionRecipeEditor>('missionRecipes.detachSource', {
      editorId: editor.editorId,
      expectedVersion: 2,
    });
    expect(manual.source).toBeNull();
    const fresh = await w.ok<{ previewId: string }>('missionRecipes.previewSave', {
      editorId: editor.editorId,
      expectedVersion: manual.version,
    });
    expect(
      (await w.call('missionRecipes.save', { previewId: fresh.previewId, requestId: randomUUID() }))
        .ok,
    ).toBe(true);
  });
  it('rejects unselected authority and unsafe payloads without exposing text', async () => {
    const w = createWorld();
    const editor = await w.ok<MissionRecipeEditor>('missionRecipes.openEditor', {});
    const bad = await w.call('missionRecipes.saveEditor', {
      editorId: editor.editorId,
      expectedVersion: 1,
      content: { ...editor.content, provider: 'codex' },
    });
    expect(bad.ok).toBe(false);
    expect(
      (
        await w.call('missionRecipes.previewSource', {
          source: { kind: 'draft', id: randomUUID(), version: 1 },
          fields: ['workers'],
        })
      ).ok,
    ).toBe(false);
    expect(await w.ok('missionRecipes.getEditor', { editorId: editor.editorId })).toEqual(editor);
  });

  it('retains oversized source text in a transient preview for explicit correction', async () => {
    const w = createWorld();
    const draft = await w.ok<{ draftId: string }>('missionComposer.createDraft');
    await w.ok('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { objective: 'Outcome', completionEvidence: 'x'.repeat(1500) },
      currentStage: 'outcome',
    });
    const source = await w.ok<{ previewId: string; content: MissionRecipeEditor['content'] }>(
      'missionRecipes.previewSource',
      {
        source: { kind: 'draft', id: draft.draftId, version: 2 },
        fields: ['objective', 'completionEvidence'],
      },
    );
    expect(source.content.acceptanceChecklist[0]).toHaveLength(1500);
    const corrected = { ...source.content, acceptanceChecklist: ['Reviewed'] };
    const editor = await w.ok<MissionRecipeEditor>('missionRecipes.openEditor', {
      sourcePreviewId: source.previewId,
      content: corrected,
    });
    expect(editor.content).toEqual(corrected);
    expect(editor.source?.version).toBe(2);
  });
});
