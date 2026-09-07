import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openStorage, recipeDigest, migrate } from '@threadhelm/persistence';
const now = '2026-09-07T12:00:00.000Z';
const content = {
  name: 'Same name',
  description: '',
  outcomeScaffold: 'Review',
  acceptanceChecklist: ['Check'],
  suggestedRoles: [],
  variables: [],
};
describe('personal recipe atomic lifecycle', () => {
  it('keeps immutable revisions and independently edited drafts after source/editor scrubbing', () => {
    const storage = openStorage(':memory:');
    try {
      const repo = storage.repositories.missionRecipes;
      const editor = repo.openEditor({ mode: 'create', base: null, source: null, content, now });
      const input = {
        editorId: editor.editorId,
        expectedVersion: 1,
        requestId: randomUUID(),
        requestDigest: recipeDigest('initial'),
        now,
      };
      const saved = repo.save(input);
      const original = repo.get(saved.targetId);
      const drafts = [1, 2].map((n) => {
        const receipt = repo.createDraft({
          reference: original,
          expanded: { outcome: 'Review', acceptanceChecklist: ['Check'], suggestedRoles: [] },
          projection: { objective: 'Review', completionEvidence: 'Check' },
          requestId: randomUUID(),
          requestDigest: recipeDigest(n),
          now,
        });
        storage.repositories.missionComposer.updateDraft({
          draftId: receipt.targetId,
          expectedVersion: 1,
          fieldValues: { objective: 'Independent ' + n, completionEvidence: 'Check' },
          currentStage: 'outcome',
          issueCodes: [],
          state: 'editing',
          updatedAt: now,
        });
        return storage.repositories.missionComposer.getDraft(receipt.targetId);
      });
      const edit = repo.openEditor({
        mode: 'edit',
        base: {
          recipeId: original.recipeId,
          revisionId: original.revisionId,
          version: original.version,
        },
        source: null,
        content: { ...content, outcomeScaffold: 'Revised' },
        now,
      });
      repo.save({
        editorId: edit.editorId,
        expectedVersion: 1,
        requestId: randomUUID(),
        requestDigest: recipeDigest('edit'),
        now,
      });
      const revised = repo.get(original.recipeId);
      expect(revised.ordinal).toBe(2);
      expect(
        (
          storage.db
            .prepare('SELECT content FROM mission_recipe_revisions WHERE id=?')
            .get(original.revisionId) as { content: string }
        ).content,
      ).toBe(JSON.stringify(content));
      repo.openEditor({
        mode: 'duplicate',
        base: {
          recipeId: revised.recipeId,
          revisionId: revised.revisionId,
          version: revised.version,
        },
        source: null,
        content: revised.content!,
        now,
      });
      const deletion = {
        reference: revised,
        requestId: randomUUID(),
        requestDigest: recipeDigest('delete'),
        now,
      };
      const receipt = repo.delete(deletion);
      expect(repo.delete(deletion)).toEqual(receipt);
      expect(repo.save(input)).toEqual(saved); // Receipt never recreates deleted content.
      expect(() => repo.get(original.recipeId)).toThrow('DELETED');
      expect(repo.listEditors().items).toEqual([]);
      expect(storage.db.prepare('SELECT * FROM mission_recipe_revisions').all()).toEqual([]);
      expect(drafts.map((d) => storage.repositories.missionComposer.getDraft(d.draftId))).toEqual(
        drafts,
      );
      expect(
        JSON.stringify(storage.db.prepare('SELECT * FROM mission_recipe_operation_receipts').all()),
      ).not.toContain('Same name');
    } finally {
      storage.db.close();
    }
  });
  it('rolls back failed head changes and preserves editor then accepts exact retry', () => {
    const storage = openStorage(':memory:');
    try {
      const repo = storage.repositories.missionRecipes;
      const editor = repo.openEditor({ mode: 'create', base: null, source: null, content, now });
      const input = {
        editorId: editor.editorId,
        expectedVersion: 1,
        requestId: randomUUID(),
        requestDigest: recipeDigest('retry'),
        now,
      };
      storage.db.exec(
        "CREATE TRIGGER fail_receipt BEFORE INSERT ON mission_recipe_operation_receipts BEGIN SELECT RAISE(ABORT,'storage unavailable'); END",
      );
      expect(() => repo.save(input)).toThrow();
      expect(repo.list().items).toEqual([]);
      expect(repo.getEditor(editor.editorId)).toEqual(editor);
      storage.db.exec('DROP TRIGGER fail_receipt');
      const receipt = repo.save(input);
      expect(repo.save(input)).toEqual(receipt);
      expect(() => repo.save({ ...input, requestDigest: recipeDigest('changed') })).toThrow(
        'REQUEST_CONFLICT',
      );
    } finally {
      storage.db.close();
    }
  });
  it('repairs provenance table and retains immutable copied-from identity after source deletion', () => {
    const storage = openStorage(':memory:');
    try {
      storage.db.exec('DROP TABLE mission_recipe_origins');
      migrate(storage.db);
      const repo = storage.repositories.missionRecipes;
      const originalEditor = repo.openEditor({
        mode: 'create',
        base: null,
        source: null,
        content,
        now,
      });
      const originalSave = repo.save({
        editorId: originalEditor.editorId,
        expectedVersion: 1,
        requestId: randomUUID(),
        requestDigest: recipeDigest('origin'),
        now,
      });
      const original = repo.get(originalSave.targetId);
      const base = {
        recipeId: original.recipeId,
        revisionId: original.revisionId,
        version: original.version,
      };
      const duplicate = repo.openEditor({ mode: 'duplicate', base, source: null, content, now });
      const saved = repo.save({
        editorId: duplicate.editorId,
        expectedVersion: 1,
        requestId: randomUUID(),
        requestDigest: recipeDigest('copy'),
        now,
      });
      expect(repo.get(saved.targetId).copiedFrom).toEqual(base);
      repo.delete({
        reference: base,
        requestId: randomUUID(),
        requestDigest: recipeDigest('remove origin'),
        now,
      });
      expect(repo.get(saved.targetId).copiedFrom).toEqual(base);
      expect(repo.get(saved.targetId).content).toEqual(content);
    } finally {
      storage.db.close();
    }
  });
});
