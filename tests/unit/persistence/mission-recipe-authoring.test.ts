import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openStorage, recipeDigest } from '@threadhelm/persistence';
const now = '2026-09-07T12:00:00.000Z';
const content = {
  name: '',
  description: '',
  outcomeScaffold: '',
  acceptanceChecklist: [],
  suggestedRoles: [],
  variables: [],
};
describe('personal recipe editor authority and source lifetime', () => {
  it('acknowledges incomplete safe buffers and preserves last valid content on failed update', () => {
    const storage = openStorage(':memory:');
    try {
      const repo = storage.repositories.missionRecipes;
      const editor = repo.openEditor({ mode: 'create', base: null, source: null, content, now });
      const saved = repo.saveEditor(editor.editorId, 1, { ...content, name: 'Durable name' }, now);
      expect(repo.getEditor(editor.editorId)).toEqual(saved);
      expect(() =>
        repo.saveEditor(editor.editorId, 1, { ...content, name: 'Stale name' }, now),
      ).toThrow('STALE_EDITOR');
      expect(() =>
        repo.saveEditor(editor.editorId, 2, { ...content, outcomeScaffold: 'x'.repeat(8001) }, now),
      ).toThrow('INVALID_RECIPE');
      expect(repo.getEditor(editor.editorId)).toEqual(saved);
      expect(() =>
        repo.save({
          editorId: editor.editorId,
          expectedVersion: 2,
          requestId: randomUUID(),
          requestDigest: recipeDigest('invalid'),
          now,
        }),
      ).toThrow('INVALID_RECIPE');
      expect(repo.list().items).toEqual([]);
    } finally {
      storage.db.close();
    }
  });
  it('saves a source snapshot once, survives source deletion and exposes revision one metadata', () => {
    const storage = openStorage(':memory:');
    try {
      const drafts = storage.repositories.missionComposer,
        repo = storage.repositories.missionRecipes;
      const draft = drafts.createDraft({
        sourceMissionId: null,
        fieldValues: { objective: 'Selected' },
        currentStage: 'outcome',
        createdAt: now,
      });
      const editor = repo.openEditor({
        mode: 'save-source',
        base: null,
        source: { kind: 'draft', id: draft.draftId, version: 1 },
        content: { ...content, name: 'Saved selection', outcomeScaffold: 'Selected' },
        now,
      });
      const sourceBefore = drafts.getDraft(draft.draftId);
      const saved = repo.save({
        editorId: editor.editorId,
        expectedVersion: 1,
        requestId: randomUUID(),
        requestDigest: recipeDigest('source save'),
        now,
      });
      expect(drafts.getDraft(draft.draftId)).toEqual(sourceBefore);
      const personal = repo.get(saved.targetId);
      expect(personal).toMatchObject({
        origin: 'personal',
        ordinal: 1,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      drafts.deleteDraft({ draftId: draft.draftId, expectedVersion: 1, deletedAt: now });
      expect(repo.get(saved.targetId)).toEqual(personal);
    } finally {
      storage.db.close();
    }
  });
});
