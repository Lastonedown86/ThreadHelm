/** Test-only child: source modules, isolated SQLite, no provider or desktop process. */
import { registerHooks } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
registerHooks({
  resolve(specifier, context, nextResolve) {
    const workspace = /^@threadhelm\/(contracts|domain|persistence)(?:\/(\w+))?$/.exec(specifier);
    if (workspace) {
      return nextResolve(
        pathToFileURL(resolve(root, `packages/${workspace[1]}/src/${workspace[2] ?? 'index'}.ts`))
          .href,
        context,
      );
    }
    if (
      specifier.endsWith('.js') &&
      specifier.startsWith('.') &&
      context.parentURL?.startsWith('file:')
    ) {
      const candidate = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { openStorage } = await import('@threadhelm/persistence');
const { MISSION_RECIPE_STARTERS, expandMissionRecipe } = await import('@threadhelm/domain');
const [path, marker, operation, barrier, requestId, revisionId] = process.argv.slice(2);
if (!path || !marker || !requestId || !revisionId)
  throw new Error('Missing child fixture arguments');
const storage = openStorage(path);
const repo = storage.repositories.missionRecipes;
const starter = MISSION_RECIPE_STARTERS[0]!;
const pause = () => {
  // Durable marker signals the exact SQL boundary; never logs authored content.
  writeFileSync(marker, barrier!);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  throw new Error('Crash barrier unexpectedly resumed');
};
storage.db.function('recipe_crash_barrier', pause);
const trigger =
  operation === 'personal'
    ? {
        preinsert: 'BEFORE INSERT ON mission_recipe_revisions',
        between: 'AFTER INSERT ON mission_recipe_revisions',
        editorconsumed: 'AFTER DELETE ON mission_recipe_editor_drafts',
        precommit: 'AFTER INSERT ON mission_recipe_operation_receipts',
      }
    : operation === 'revision'
      ? {
          preinsert: 'BEFORE INSERT ON mission_recipe_revisions',
          between: 'AFTER INSERT ON mission_recipe_revisions',
          precommit: 'AFTER UPDATE ON mission_recipes',
        }
      : {
          preinsert: 'BEFORE INSERT ON mission_composer_drafts',
          between: 'AFTER INSERT ON mission_draft_recipe_context',
          precommit: 'AFTER INSERT ON mission_recipe_operation_receipts',
        };
if (barrier !== 'postcommit') {
  const location = trigger[barrier as keyof typeof trigger];
  if (!location) throw new Error('Unknown crash barrier');
  storage.db.exec(
    `CREATE TEMP TRIGGER crash_recipe ${location} BEGIN SELECT recipe_crash_barrier(); END`,
  );
}
if (operation === 'personal') {
  repo.save({
    editorId: revisionId,
    expectedVersion: 1,
    requestId,
    requestDigest: 'c'.repeat(64),
    now: '2026-09-07T13:00:00.000Z',
  });
} else if (operation === 'revision') {
  repo.seedBundled(
    {
      ...starter,
      revisionId,
      content: { ...starter.content, description: 'Replacement revision' },
    },
    '2026-09-07T13:00:00.000Z',
  );
} else {
  const expansion = expandMissionRecipe(starter.content, { symptom: 'Crash fixture' });
  repo.createDraft({
    reference: repo.get(starter.recipeId),
    expanded: expansion.expanded!,
    projection: expansion.projection!,
    requestId,
    requestDigest: 'c'.repeat(64),
    now: '2026-09-07T13:00:00.000Z',
  });
}
pause();
