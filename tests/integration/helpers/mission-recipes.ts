import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStorage } from '@threadhelm/persistence';

/** Isolated storage only; no provider/process authority is supplied to recipe services. */
export function recipeFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'threadhelm-recipes-'));
  const path = join(directory, 'recipes.sqlite');
  let storage = openStorage(path);
  return {
    path,
    get storage() {
      return storage;
    },
    reopen() {
      storage.db.close();
      storage = openStorage(path);
      return storage;
    },
    /** A SQL barrier interrupts an actual write without changing production APIs. */
    failWrites(
      table:
        | 'mission_recipe_revisions'
        | 'mission_recipe_editor_drafts'
        | 'mission_draft_recipe_context',
    ) {
      storage.db.exec(
        `CREATE TEMP TRIGGER recipe_test_failure BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'injected recipe write failure'); END`,
      );
    },
    clearFailure() {
      storage.db.exec('DROP TRIGGER IF EXISTS recipe_test_failure');
    },
    close() {
      storage.db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
