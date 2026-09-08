import { describe, expect, it } from 'vitest';
import { recipeFixture } from './helpers/mission-recipes.js';

describe('recipe foundation on disk', () => {
  it('recovers acknowledged buffers and rolls back failed writes', () => {
    const fixture = recipeFixture();
    try {
      const content = {
        name: 'Saved input',
        description: '',
        outcomeScaffold: '',
        acceptanceChecklist: [],
        suggestedRoles: [],
        variables: [],
      };
      const input = {
        mode: 'create' as const,
        content,
        base: null,
        source: null,
        now: '2026-09-07T12:00:00.000Z',
      };
      const editor = fixture.storage.repositories.missionRecipes.openEditor(input);
      fixture.failWrites('mission_recipe_editor_drafts');
      expect(() => fixture.storage.repositories.missionRecipes.openEditor(input)).toThrow(
        'injected',
      );
      fixture.clearFailure();
      fixture.reopen();
      expect(fixture.storage.repositories.missionRecipes.getEditor(editor.editorId)).toEqual(
        editor,
      );
      expect(fixture.storage.repositories.missionRecipes.listEditors().items).toHaveLength(1);
    } finally {
      fixture.close();
    }
  });
});
