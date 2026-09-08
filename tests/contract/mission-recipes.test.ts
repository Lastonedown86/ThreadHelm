import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type {
  MissionRecipeSummary,
  MissionRecipePreview,
  MissionRecipeReceipt,
  MissionComposerDraftDetailView,
} from '@threadhelm/contracts';
import { createWorld } from './helpers/fake-context.js';

describe('mission recipe IPC', () => {
  it('lists only three generic starters and creates exactly one independent draft per receipt', async () => {
    const world = createWorld();
    const listed = await world.ok<{ items: MissionRecipeSummary[] }>('missionRecipes.list', {});
    expect(listed.items.map((r) => r.name).sort()).toEqual([
      'Investigate a bug',
      'Prepare a release',
      'Review a PR',
    ]);
    const selected = listed.items.find((r) => r.name === 'Investigate a bug')!;
    const preview = await world.ok<MissionRecipePreview>('missionRecipes.preview', {
      recipeId: selected.recipeId,
      revisionId: selected.revisionId,
      expectedVersion: selected.version,
      values: { symptom: 'A literal bug' },
    });
    expect(preview.issues).toEqual([]);
    const request = { previewId: preview.previewId, requestId: randomUUID() };
    const saved = await world.ok<MissionRecipeReceipt>('missionRecipes.createDraft', request);
    expect(await world.ok('missionRecipes.createDraft', request)).toEqual(saved);
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.getDraft', {
      draftId: saved.targetId,
    });
    expect(draft).toMatchObject({
      sourceMissionId: null,
      currentStage: 'outcome',
      state: 'editing',
    });
    expect(draft.fieldValues).toEqual(preview.projection);
    expect(draft.recipeContext?.expanded).toEqual(preview.expanded);
    expect(draft.fieldValues.workers).toBeUndefined();
    expect(world.hosts).toHaveLength(0);
    expect(
      world.ctx.storage!.db.prepare('SELECT count(*) AS count FROM agent_sessions').get(),
    ).toEqual({ count: 0 });
    expect(
      world.ctx.storage!.db.prepare('SELECT count(*) AS count FROM approved_workspaces').get(),
    ).toEqual({ count: 0 });
    expect(JSON.stringify(world.events)).not.toContain('A literal bug');
    const invalid = await world.call('missionRecipes.createDraft', {
      ...request,
      permissions: 'all',
    });
    expect(invalid.ok).toBe(false);
    const senderDenied = await world.router.dispatch(
      'missionRecipes.list',
      {},
      { frameUrl: 'https://example.invalid', isMainFrame: false },
    );
    expect(senderDenied.ok).toBe(false);
  });
  it('blocks stale revision previews and retains field-limit outcomes', async () => {
    const world = createWorld();
    const listed = await world.ok<{ items: MissionRecipeSummary[] }>('missionRecipes.list', {});
    const recipe = listed.items.find((r) => r.name === 'Review a PR')!;
    const stale = await world.call('missionRecipes.preview', {
      recipeId: recipe.recipeId,
      revisionId: randomUUID(),
      expectedVersion: recipe.version,
      values: {},
    });
    expect(stale.ok).toBe(false);
    const preview = await world.ok<MissionRecipePreview>('missionRecipes.preview', {
      recipeId: recipe.recipeId,
      revisionId: recipe.revisionId,
      expectedVersion: recipe.version,
      values: {},
    });
    expect(preview.previewId).toBeNull();
    expect(preview.issues[0]?.code).toBe('REQUIRED_VALUE');
  });
});
