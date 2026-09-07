import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MISSION_RECIPE_STARTERS, expandMissionRecipe } from '@threadhelm/domain';
import { recipeFixture } from './helpers/mission-recipes.js';

it('SQLite FULL preserves the complete acknowledged editor and no partial recipe', () => {
  const fixture = recipeFixture();
  try {
    const storage = fixture.storage;
    const repo = storage.repositories.missionRecipes;
    const content = {
      name: 'Disk capacity fixture',
      description: 'x'.repeat(1000),
      outcomeScaffold: 'y'.repeat(8000),
      acceptanceChecklist: Array.from({ length: 30 }, () => 'a'.repeat(1000)),
      suggestedRoles: Array.from({ length: 12 }, () => 'b'.repeat(1000)),
      variables: [],
    };
    const editor = repo.openEditor({
      mode: 'create',
      content,
      base: null,
      source: null,
      now: '2026-09-07T12:00:00.000Z',
    });
    const pages = storage.db.pragma('page_count', { simple: true }) as number;
    storage.db.pragma(`max_page_count = ${pages}`);
    expect(() =>
      repo.save({
        editorId: editor.editorId,
        expectedVersion: editor.version,
        requestId: randomUUID(),
        requestDigest: 'a'.repeat(64),
        now: '2026-09-07T12:00:01.000Z',
      }),
    ).toThrow(/full/i);
    expect(repo.getEditor(editor.editorId)).toEqual(editor);
    expect(repo.list().items).toEqual([]);
    expect(
      storage.db.prepare('SELECT count(*) AS count FROM mission_recipe_operation_receipts').get(),
    ).toEqual({ count: 0 });
    const reopened = fixture.reopen();
    expect(reopened.repositories.missionRecipes.getEditor(editor.editorId)).toEqual(editor);
    expect(reopened.db.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
  } finally {
    fixture.close();
  }
});

async function interrupt(
  path: string,
  operation: string,
  barrier: string,
  requestId: string,
  revisionId: string,
) {
  const marker = `${path}.${operation}.${barrier}`;
  const child = spawn(
    process.execPath,
    [
      '--experimental-strip-types',
      resolve(import.meta.dirname, 'helpers/mission-recipe-crash-child.ts'),
      path,
      marker,
      operation,
      barrier,
      requestId,
      revisionId,
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const exit = new Promise<void>((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', () => resolveExit());
  });
  try {
    await new Promise<void>((ready, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (existsSync(marker)) {
          clearInterval(timer);
          ready();
        } else if (child.exitCode !== null || Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error(`Child did not reach ${operation}/${barrier}: ${stderr}`));
        }
      }, 20);
    });
    expect(child.kill('SIGKILL')).toBe(true);
    await exit;
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exit;
  }
}

describe('recipe real process interruption (temporary on-disk SQLite)', () => {
  describe.each(['create', 'edit'] as const)('personal %s', (mode) => {
    it.each(['preinsert', 'between', 'editorconsumed', 'precommit', 'postcommit'])(
      'recovers revision, head, buffer and receipt together at %s',
      async (barrier) => {
        const fixture = recipeFixture();
        try {
          const repo = fixture.storage.repositories.missionRecipes;
          const original = MISSION_RECIPE_STARTERS[0]!.content;
          const now = '2026-09-07T12:00:00.000Z';
          let base = null;
          if (mode === 'edit') {
            const initial = repo.openEditor({
              mode: 'create',
              content: original,
              base: null,
              source: null,
              now,
            });
            const initialReceipt = repo.save({
              editorId: initial.editorId,
              expectedVersion: 1,
              requestId: randomUUID(),
              requestDigest: 'a'.repeat(64),
              now,
            });
            base = repo.get(initialReceipt.targetId);
          }
          const content = { ...original, description: 'Personal interrupted save' };
          const editor = repo.openEditor({
            mode,
            content,
            base: base
              ? { recipeId: base.recipeId, revisionId: base.revisionId, version: base.version }
              : null,
            source: null,
            now,
          });
          const requestId = randomUUID();
          const input = {
            editorId: editor.editorId,
            expectedVersion: editor.version,
            requestId,
            requestDigest: 'c'.repeat(64),
            now: '2026-09-07T13:00:00.000Z',
          };
          await interrupt(fixture.path, 'personal', barrier, requestId, editor.editorId);
          const storage = fixture.reopen();
          const reopened = storage.repositories.missionRecipes;
          const committed = barrier === 'postcommit';
          expect(storage.repaired).toBeNull();
          expect(storage.db.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
          expect(storage.db.pragma('foreign_key_check')).toEqual([]);
          const prior = reopened.getReceipt(requestId, input.requestDigest);
          const initialCount = mode === 'edit' ? 1 : 0;
          expect(
            storage.db.prepare('SELECT count(*) AS count FROM mission_recipe_revisions').get(),
          ).toEqual({ count: initialCount + Number(committed) });
          expect(reopened.list({ origin: 'personal' }).items).toHaveLength(
            mode === 'edit' || committed ? 1 : 0,
          );
          if (committed) {
            expect(prior).not.toBeNull();
            expect(() => reopened.getEditor(editor.editorId)).toThrow('DELETED');
            const saved = reopened.get(prior!.targetId);
            expect(saved.content).toEqual(content);
            expect(saved.ordinal).toBe(mode === 'edit' ? 2 : 1);
            expect(saved.version).toBe(mode === 'edit' ? 2 : 1);
            if (base) expect(saved.revisionId).not.toBe(base.revisionId);
          } else {
            expect(prior).toBeNull();
            expect(reopened.getEditor(editor.editorId)).toEqual(editor);
            if (base) expect(reopened.get(base.recipeId)).toEqual(base);
          }
          const receipt = reopened.save(input);
          if (prior) expect(receipt).toEqual(prior);
          expect(reopened.save(input)).toEqual(receipt);
          expect(() => reopened.save({ ...input, requestDigest: 'd'.repeat(64) })).toThrow(
            'REQUEST_CONFLICT',
          );
          expect(reopened.get(receipt.targetId).content).toEqual(content);
          expect(reopened.list({ origin: 'personal' }).items).toHaveLength(1);
          expect(reopened.listEditors().items).toEqual([]);
          expect(
            storage.db.prepare('SELECT count(*) AS count FROM mission_recipe_revisions').get(),
          ).toEqual({ count: initialCount + 1 });
          if (base) {
            const preserved = storage.db
              .prepare('SELECT content FROM mission_recipe_revisions WHERE id=?')
              .get(base.revisionId) as { content: string };
            expect(JSON.parse(preserved.content)).toEqual(original);
          }
        } finally {
          fixture.close();
        }
      },
    );
  });

  it('preserves acknowledged editor content and reports write-denied storage explicitly', () => {
    const fixture = recipeFixture();
    try {
      const repo = fixture.storage.repositories.missionRecipes;
      const editor = repo.openEditor({
        mode: 'create',
        content: MISSION_RECIPE_STARTERS[0]!.content,
        base: null,
        source: null,
        now: '2026-09-07T12:00:00.000Z',
      });
      fixture.storage.db.pragma('query_only = ON');
      expect(() =>
        repo.saveEditor(
          editor.editorId,
          editor.version,
          {
            ...editor.content,
            name: 'Unacknowledged edit',
          },
          '2026-09-07T13:00:00.000Z',
        ),
      ).toThrow(/readonly/i);
      fixture.storage.db.pragma('query_only = OFF');
      expect(() =>
        repo.saveEditor(
          editor.editorId,
          editor.version,
          {
            ...editor.content,
            name: 'password=abcdefghijk',
          },
          '2026-09-07T13:00:00.000Z',
        ),
      ).toThrow('INVALID_RECIPE');
      const reopened = fixture.reopen();
      expect(reopened.repaired).toBeNull();
      expect(reopened.repositories.missionRecipes.getEditor(editor.editorId)).toEqual(editor);
      expect(reopened.repositories.missionRecipes.listEditors().items).toHaveLength(1);
    } finally {
      fixture.close();
    }
  });

  it.each(['preinsert', 'between', 'precommit', 'postcommit'])(
    'recovers complete revision/head at %s',
    async (barrier) => {
      const fixture = recipeFixture();
      try {
        const starter = MISSION_RECIPE_STARTERS[0]!;
        fixture.storage.repositories.missionRecipes.seedBundled(
          starter,
          '2026-09-07T12:00:00.000Z',
        );
        const editor = fixture.storage.repositories.missionRecipes.openEditor({
          mode: 'create',
          content: starter.content,
          base: null,
          source: null,
          now: '2026-09-07T12:00:00.000Z',
        });
        const revisionId = randomUUID();
        await interrupt(fixture.path, 'revision', barrier, randomUUID(), revisionId);
        const storage = fixture.reopen();
        expect(storage.repaired).toBeNull();
        expect(storage.db.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
        expect(storage.db.pragma('foreign_key_check')).toEqual([]);
        const current = storage.repositories.missionRecipes.get(starter.recipeId);
        const committed = barrier === 'postcommit';
        expect(current.revisionId).toBe(committed ? revisionId : starter.revisionId);
        expect(current.version).toBe(committed ? 2 : 1);
        expect(current.content?.description).toBe(
          committed ? 'Replacement revision' : starter.content.description,
        );
        expect(
          storage.db.prepare('SELECT count(*) AS count FROM mission_recipe_revisions').get(),
        ).toEqual({ count: committed ? 2 : 1 });
        expect(storage.repositories.missionRecipes.getEditor(editor.editorId)).toEqual(editor);
      } finally {
        fixture.close();
      }
    },
  );

  it.each(['preinsert', 'between', 'precommit', 'postcommit'])(
    'recovers atomic draft/context/receipt and exact retry at %s',
    async (barrier) => {
      const fixture = recipeFixture();
      try {
        const starter = MISSION_RECIPE_STARTERS[0]!;
        fixture.storage.repositories.missionRecipes.seedBundled(
          starter,
          '2026-09-07T12:00:00.000Z',
        );
        const requestId = randomUUID();
        await interrupt(fixture.path, 'draft', barrier, requestId, randomUUID());
        const storage = fixture.reopen();
        expect(storage.repaired).toBeNull();
        expect(storage.db.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
        expect(storage.db.pragma('foreign_key_check')).toEqual([]);
        for (const table of [
          'mission_composer_drafts',
          'mission_draft_recipe_context',
          'mission_recipe_operation_receipts',
        ]) {
          expect(storage.db.prepare(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({
            count: barrier === 'postcommit' ? 1 : 0,
          });
        }
        const repo = storage.repositories.missionRecipes;
        const prior = repo.getReceipt(requestId, 'c'.repeat(64));
        const expansion = expandMissionRecipe(starter.content, { symptom: 'Crash fixture' });
        const input = {
          reference: repo.get(starter.recipeId),
          expanded: expansion.expanded!,
          projection: expansion.projection!,
          requestId,
          requestDigest: 'c'.repeat(64),
          now: '2026-09-07T13:00:00.000Z',
        };
        const receipt = repo.createDraft(input);
        if (prior) expect(receipt).toEqual(prior);
        expect(repo.createDraft(input)).toEqual(receipt);
        expect(() => repo.createDraft({ ...input, requestDigest: 'd'.repeat(64) })).toThrow(
          'REQUEST_CONFLICT',
        );
        const drafts = storage.repositories.missionComposer.listDrafts();
        expect(drafts).toHaveLength(1);
        const draft = storage.repositories.missionComposer.getDraft(receipt.targetId);
        expect(draft.fieldValues).toEqual(expansion.projection);
        expect(draft.recipeContext?.expanded).toEqual(expansion.expanded);
        expect(draft.sourceMissionId).toBeNull();
      } finally {
        fixture.close();
      }
    },
  );
});
