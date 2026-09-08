import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissionRecipeContent } from '@threadhelm/contracts';
import { openStorage } from '@threadhelm/persistence';
import { MISSION_RECIPE_STARTERS } from '../../../packages/domain/src/mission-recipe-starters.js';
import { assertProductionPersonaBoundary } from '../../../apps/desktop/src/packaging/release-personas.js';
import { createMissionRecipeService } from '../../../apps/desktop/src/main/coordination/mission-recipes.js';
import { StorageHealth } from '../../../apps/desktop/src/main/storage-health.js';
import { createLogger } from '../../../apps/desktop/src/main/logging.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('production mission recipe content and authority boundary', () => {
  it('ships exactly the generic production starters through the packaging content guard', () => {
    const directory = mkdtempSync(join(tmpdir(), 'threadhelm-recipe-content-'));
    try {
      expect(MISSION_RECIPE_STARTERS.map((starter) => starter.content.name)).toEqual([
        'Investigate a bug',
        'Review a PR',
        'Prepare a release',
      ]);
      writeFileSync(
        join(directory, 'mission-recipes.json'),
        JSON.stringify(MISSION_RECIPE_STARTERS),
      );
      expect(() => assertProductionPersonaBoundary(directory)).not.toThrow();
      const source = readFileSync(
        resolve(import.meta.dirname, '../../../packages/domain/src/mission-recipe-starters.ts'),
        'utf8',
      );
      expect(source).not.toMatch(
        /(?:from\s*|import\s*\()["'][^"']*(?:test-fixtures|fixtures|personas)/,
      );
      for (const { content } of MISSION_RECIPE_STARTERS) {
        expect(Object.keys(content).sort()).toEqual([
          'acceptanceChecklist',
          'description',
          'name',
          'outcomeScaffold',
          'suggestedRoles',
          'variables',
        ]);
        for (const key of [
          'workspaceId',
          'workspaceApproval',
          'permissions',
          'providerId',
          'model',
          'workers',
          'agentProfile',
          'assignments',
          'launchAuthority',
        ]) {
          expect(MissionRecipeContent.safeParse({ ...content, [key]: 'forbidden' }).success).toBe(
            false,
          );
        }
      }
      // Positive control proves this scanner sees contaminated generated content.
      writeFileSync(join(directory, 'stale-chunk.cjs'), 'const MARVEL_ROSTER_FIXTURES = [];');
      expect(() => assertProductionPersonaBoundary(directory)).toThrow('private persona');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('literal URL and shell text create context only with content-free events, errors and receipts', () => {
    const storage = openStorage(':memory:');
    const logs: string[] = [];
    const events: unknown[] = [];
    const fetch = vi.fn(() => {
      throw new Error('Network authority invoked');
    });
    vi.stubGlobal('fetch', fetch);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger({ write: (line) => logs.push(line) });
    const dependencies: Parameters<typeof createMissionRecipeService>[0] = {
      storage,
      health: new StorageHealth(log),
      clock: () => new Date('2026-09-07T12:00:00.000Z'),
      events: {
        emit: (name, payload) => {
          events.push({ name, payload });
        },
        transferStreamPort: () => {
          throw new Error('Stream authority invoked');
        },
      },
    };
    const accessed: string[] = [];
    const guarded = new Proxy(dependencies, {
      get(target, key, receiver) {
        if (typeof key === 'string') accessed.push(key);
        if (!(key in target)) throw new Error('Unexpected recipe dependency');
        return Reflect.get(target, key, receiver);
      },
    });
    try {
      const service = createMissionRecipeService(guarded);
      const recipe = service.list({}).items.find((item) => item.name === 'Review a PR')!;
      const literal = 'https://example.invalid/private-pr $(echo recipe_canary)';
      const preview = service.preview({
        recipeId: recipe.recipeId,
        revisionId: recipe.revisionId,
        expectedVersion: recipe.version,
        values: { pr_reference: literal },
      });
      expect(preview.issues).toEqual([]);
      expect(preview.expanded?.outcome).toContain(literal);
      const receipt = service.createDraft({
        previewId: preview.previewId!,
        requestId: randomUUID(),
      });
      const draft = storage.repositories.missionComposer.getDraft(receipt.targetId);
      expect(draft.fieldValues).toEqual(preview.projection);
      expect(Object.keys(draft.fieldValues).sort()).toEqual(['completionEvidence', 'objective']);
      expect(draft.sourceMissionId).toBeNull();
      for (const table of ['agent_sessions', 'approved_workspaces'])
        expect(storage.db.prepare(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({
          count: 0,
        });
      let error: unknown;
      try {
        service.createDraft({ previewId: preview.previewId!, requestId: randomUUID() });
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ message: 'STALE_PREVIEW' });
      expect(JSON.stringify({ logs, events, receipt, error })).not.toContain('recipe_canary');
      expect(logs).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
      expect(consoleLog).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect([...new Set(accessed)].sort()).toEqual(['clock', 'events', 'health', 'storage']);
    } finally {
      storage.db.close();
    }
  });
});
