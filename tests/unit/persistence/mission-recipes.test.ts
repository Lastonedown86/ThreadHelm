import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { openStorage } from '@threadhelm/persistence';
import { MISSION_RECIPE_STARTERS, expandMissionRecipe } from '@threadhelm/domain';
const AT = '2026-09-07T12:00:00.000Z';
const empty = {
  name: '',
  description: '',
  outcomeScaffold: '',
  acceptanceChecklist: [],
  suggestedRoles: [],
  variables: [],
};

describe('mission recipe repository foundation', () => {
  it('bounds current aggregate context even when a field save omits role changes', () => {
    const storage = openStorage(':memory:');
    try {
      const repo = storage.repositories.missionRecipes;
      const starter = MISSION_RECIPE_STARTERS[0]!;
      repo.seedBundled(starter, AT);
      const selected = repo.get(starter.recipeId);
      const expanded = {
        outcome: 'x',
        acceptanceChecklist: [],
        suggestedRoles: ['a'.repeat(63999)],
      };
      const receipt = repo.createDraft({
        reference: selected,
        expanded,
        projection: { objective: 'x', completionEvidence: '' },
        requestId: randomUUID(),
        requestDigest: 'f'.repeat(64),
        now: AT,
      });
      const drafts = storage.repositories.missionComposer;
      expect(() =>
        drafts.updateDraft({
          draftId: receipt.targetId,
          expectedVersion: 1,
          fieldValues: { objective: 'xx' },
          currentStage: 'outcome',
          issueCodes: [],
          state: 'editing',
          updatedAt: AT,
        }),
      ).toThrow('EXPANDED_LIMIT');
      expect(drafts.getDraft(receipt.targetId).version).toBe(1);
    } finally {
      storage.db.close();
    }
  });
  it('pages 500 identities and preserves unsupported data without parsing its body', () => {
    const storage = openStorage(':memory:');
    try {
      const repo = storage.repositories.missionRecipes;
      for (let n = 0; n < 500; n++)
        repo.seedBundled(
          {
            recipeId: randomUUID(),
            revisionId: randomUUID(),
            content: MISSION_RECIPE_STARTERS[0]!.content,
          },
          AT,
        );
      let cursor: string | null = null;
      const seen = new Set<string>();
      do {
        const page = repo.list({ cursor });
        expect(page.items.length).toBeLessThanOrEqual(50);
        for (const item of page.items) seen.add(item.recipeId);
        cursor = page.nextCursor;
      } while (cursor);
      expect(seen.size).toBe(500);
      const first = repo.list().items[0]!;
      storage.db
        .prepare('UPDATE mission_recipes SET schema_version=99 WHERE id=?')
        .run(first.recipeId);
      storage.db
        .prepare('UPDATE mission_recipe_revisions SET content=? WHERE id=?')
        .run('future opaque data', first.revisionId);
      expect(repo.get(first.recipeId)).toMatchObject({
        availability: 'unsupported',
        content: null,
      });
      expect(() => repo.assertAvailable(first)).toThrow('UNSUPPORTED_VERSION');
      expect(
        storage.db
          .prepare('SELECT content FROM mission_recipe_revisions WHERE id=?')
          .get(first.revisionId),
      ).toEqual({ content: 'future opaque data' });
    } finally {
      storage.db.close();
    }
  });
  it('retains two copied contexts across source changes and keeps editable roles separate', () => {
    const storage = openStorage(':memory:');
    try {
      const repo = storage.repositories.missionRecipes;
      const starter = MISSION_RECIPE_STARTERS[0]!;
      repo.seedBundled(starter, AT);
      const selected = repo.get(starter.recipeId);
      const expansion = expandMissionRecipe(starter.content, { symptom: 'bug' });
      const input = {
        reference: selected,
        expanded: expansion.expanded!,
        projection: expansion.projection!,
        requestId: randomUUID(),
        requestDigest: 'e'.repeat(64),
        now: AT,
      };
      const one = repo.createDraft(input);
      const two = repo.createDraft({ ...input, requestId: randomUUID() });
      const drafts = storage.repositories.missionComposer;
      const before = drafts.getDraft(two.targetId);
      drafts.updateDraft({
        draftId: one.targetId,
        expectedVersion: 1,
        fieldValues: { objective: 'Edited' },
        suggestedRoles: ['Independent reviewer'],
        currentStage: 'outcome',
        issueCodes: [],
        state: 'editing',
        updatedAt: AT,
      });
      expect(drafts.getDraft(one.targetId).recipeContext).toMatchObject({
        expanded: expansion.expanded,
        suggestedRoles: ['Independent reviewer'],
      });
      expect(drafts.getDraft(two.targetId)).toEqual(before);
      repo.seedBundled(
        {
          ...starter,
          revisionId: randomUUID(),
          content: { ...starter.content, description: 'New revision' },
        },
        AT,
      );
      expect(() => repo.createDraft({ ...input, requestId: randomUUID() })).toThrow(
        'STALE_PREVIEW',
      );
      storage.db.prepare('DELETE FROM mission_recipes WHERE id=?').run(selected.recipeId);
      expect(drafts.getDraft(two.targetId)).toEqual(before);
    } finally {
      storage.db.close();
    }
  });
  it('creates recipe draft/context/receipt atomically and enforces independent copy and cap', () => {
    const storage = openStorage(':memory:');
    try {
      const repo = storage.repositories.missionRecipes;
      expect(repo).toHaveProperty('createDraft');
      const starter = MISSION_RECIPE_STARTERS[0]!;
      repo.seedBundled(starter, AT);
      const selected = repo.get(starter.recipeId);
      const expansion = expandMissionRecipe(starter.content, { symptom: 'bug' });
      const request = {
        reference: selected,
        expanded: expansion.expanded!,
        projection: expansion.projection!,
        requestId: randomUUID(),
        requestDigest: 'd'.repeat(64),
        now: AT,
      };
      storage.db.exec(
        "CREATE TEMP TRIGGER stop_context BEFORE INSERT ON mission_draft_recipe_context BEGIN SELECT RAISE(ABORT, 'stop'); END",
      );
      expect(() => repo.createDraft(request)).toThrow('stop');
      expect(storage.repositories.missionComposer.listDrafts()).toEqual([]);
      expect(repo.getReceipt(request.requestId, request.requestDigest)).toBeNull();
      storage.db.exec('DROP TRIGGER stop_context');
      const receipt = repo.createDraft(request);
      expect(repo.createDraft(request)).toEqual(receipt);
      const draft = storage.repositories.missionComposer.getDraft(receipt.targetId);
      expect(draft.recipeContext?.expanded).toEqual(expansion.expanded);
      expect(draft.sourceMissionId).toBeNull();
      for (let i = 1; i < 20; i++) repo.createDraft({ ...request, requestId: randomUUID() });
      expect(() => repo.createDraft({ ...request, requestId: randomUUID() })).toThrow(
        'MISSION_DRAFT_LIMIT',
      );
      storage.repositories.missionComposer.deleteDraft({
        draftId: draft.draftId,
        expectedVersion: 1,
        deletedAt: AT,
      });
      expect(
        storage.db
          .prepare('SELECT * FROM mission_draft_recipe_context WHERE draft_id=?')
          .get(draft.draftId),
      ).toBeUndefined();
    } finally {
      storage.db.close();
    }
  });
  it('exposes a separate repository with durable versioned editor buffers', () => {
    const storage = openStorage(':memory:');
    try {
      expect(storage.repositories).toHaveProperty('missionRecipes');
      const repo = storage.repositories.missionRecipes;
      const draft = repo.openEditor({
        mode: 'create',
        content: empty,
        base: null,
        source: null,
        now: AT,
      });
      expect(repo.getEditor(draft.editorId)).toEqual(draft);
      const saved = repo.saveEditor(draft.editorId, 1, { ...empty, name: 'Review' }, AT);
      expect(saved.version).toBe(2);
      expect(() => repo.saveEditor(draft.editorId, 1, empty, AT)).toThrow('STALE_EDITOR');
      expect(repo.getEditor(draft.editorId).content.name).toBe('Review');
      expect(repo.listEditors().items.map((d) => d.editorId)).toContain(draft.editorId);
      repo.discardEditor(draft.editorId, 2);
      expect(() => repo.getEditor(draft.editorId)).toThrow('DELETED');
    } finally {
      storage.db.close();
    }
  });
  it('rejects unsafe writes and rolls back caller transactions', () => {
    const storage = openStorage(':memory:');
    try {
      const repo = storage.repositories.missionRecipes;
      expect(repo).toBeDefined();
      expect(() =>
        repo.openEditor({
          mode: 'create',
          content: { ...empty, name: 'password=abcdefghijk' },
          base: null,
          source: null,
          now: AT,
        }),
      ).toThrow('INVALID_RECIPE');
      expect(() =>
        storage.repositories.transaction(() => {
          repo.openEditor({ mode: 'create', content: empty, base: null, source: null, now: AT });
          throw new Error('rollback');
        }),
      ).toThrow('rollback');
      expect(repo.listEditors().items).toEqual([]);
    } finally {
      storage.db.close();
    }
  });
  it('stores content-free idempotent receipts and rejects mismatched retry payloads', () => {
    const storage = openStorage(':memory:');
    try {
      const repo = storage.repositories.missionRecipes;
      expect(repo).toBeDefined();
      const receipt = {
        requestId: randomUUID(),
        kind: 'save' as const,
        targetId: randomUUID(),
        version: 1,
        savedAt: AT,
      };
      repo.recordReceipt(receipt, 'a'.repeat(64));
      expect(repo.getReceipt(receipt.requestId, 'a'.repeat(64))).toEqual(receipt);
      expect(() => repo.getReceipt(receipt.requestId, 'b'.repeat(64))).toThrow('REQUEST_CONFLICT');
      expect(() =>
        storage.repositories.transaction(() => {
          repo.recordReceipt(
            { ...receipt, requestId: '11111111-1111-4111-8111-111111111111' },
            'c'.repeat(64),
          );
          throw new Error('rollback');
        }),
      ).toThrow('rollback');
      expect(repo.getReceipt('11111111-1111-4111-8111-111111111111', 'c'.repeat(64))).toBeNull();
    } finally {
      storage.db.close();
    }
  });
});
