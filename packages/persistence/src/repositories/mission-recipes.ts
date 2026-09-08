import { createHash, randomUUID } from 'node:crypto';
import {
  MissionRecipeEditor,
  type MissionRecipeEditorContent,
  MissionRecipeReceipt,
  MissionRecipeContent,
  MissionRecipeDetail,
  MissionRecipeSummary,
  MissionRecipeExpanded,
  MissionRecipeProjection,
  MissionDraftRecipeContext,
  type MissionRecipeReference,
  ThreadHelmError,
} from '@threadhelm/contracts';
import type { Db } from '../migrate.js';
import { SupervisorRepository } from './supervisor.js';
import { MissionComposerRepository } from './mission-composer.js';

interface RecipeRow {
  id: string;
  origin: 'bundled' | 'personal';
  schema_version: number;
  version: number;
  enabled: number;
  current_revision_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  ordinal: number;
  digest: string;
  content: string;
}
const recipeJoin = `FROM mission_recipes r
  JOIN mission_recipe_revisions v ON v.id=r.current_revision_id AND v.recipe_id=r.id`;

export const recipeDigest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function recipeFailure(reason: string): never {
  // Only constant reason codes, never authored text, reach an error or log.
  throw new ThreadHelmError('INVALID_REQUEST', reason, { reason });
}
function parse<T>(
  schema: { safeParse(value: unknown): { success: boolean; data?: T } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) recipeFailure('INVALID_RECIPE');
  return result.data as T;
}

/** Main-owned, deliberately separate from AgentTemplateRepository. */
export class MissionRecipeRepository {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  private summary(row: RecipeRow): MissionRecipeSummary {
    return parse(MissionRecipeSummary, {
      recipeId: row.id,
      revisionId: row.current_revision_id,
      version: row.version,
      schemaVersion: row.schema_version,
      origin: row.origin,
      ordinal: row.ordinal,
      availability: row.schema_version !== 1 ? 'unsupported' : row.enabled ? 'enabled' : 'disabled',
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  get(recipeId: string): MissionRecipeDetail {
    const row = this.db
      .prepare(`SELECT r.*, v.ordinal, v.digest, v.content ${recipeJoin} WHERE r.id=?`)
      .get(recipeId) as RecipeRow | undefined;
    if (!row) recipeFailure('DELETED');
    return parse(MissionRecipeDetail, {
      ...this.summary(row),
      digest: row.digest,
      copiedFrom: (() => {
        const origin = this.db
          .prepare(
            'SELECT source_recipe_id,source_revision_id,source_version FROM mission_recipe_origins WHERE recipe_id=?',
          )
          .get(recipeId) as
          | { source_recipe_id: string; source_revision_id: string; source_version: number }
          | undefined;
        return origin
          ? {
              recipeId: origin.source_recipe_id,
              revisionId: origin.source_revision_id,
              version: origin.source_version,
            }
          : null;
      })(),
      content:
        row.schema_version === 1 ? parse(MissionRecipeContent, JSON.parse(row.content)) : null,
    });
  }

  list(
    input: {
      cursor?: string | null | undefined;
      origin?: 'bundled' | 'personal' | undefined;
      availability?: 'enabled' | 'disabled' | 'unsupported' | undefined;
    } = {},
  ) {
    const rows = this.db
      .prepare(
        `SELECT r.*, v.ordinal, v.digest ${recipeJoin} WHERE (? IS NULL OR r.id > ?)
      AND (? IS NULL OR r.origin = ?) AND (? IS NULL OR
        (CASE WHEN r.schema_version <> 1 THEN 'unsupported' WHEN r.enabled = 1 THEN 'enabled' ELSE 'disabled' END) = ?)
      ORDER BY r.id LIMIT 51`,
      )
      .all(
        input.cursor ?? null,
        input.cursor ?? null,
        input.origin ?? null,
        input.origin ?? null,
        input.availability ?? null,
        input.availability ?? null,
      ) as RecipeRow[];
    const items = rows.slice(0, 50).map((row) => this.summary(row));
    return { items, nextCursor: rows.length > 50 ? items.at(-1)!.recipeId : null };
  }

  seedBundled(
    input: { recipeId: string; revisionId: string; content: MissionRecipeContent },
    now: string,
  ): void {
    const content = parse(MissionRecipeContent, input.content);
    this.db.transaction(() => {
      const existing = this.db
        .prepare('SELECT schema_version, origin FROM mission_recipes WHERE id=?')
        .get(input.recipeId) as { schema_version: number; origin: string } | undefined;
      if (existing && existing.schema_version !== 1) return;
      if (existing && existing.origin !== 'bundled') recipeFailure('REQUEST_CONFLICT');
      const revision = this.db
        .prepare('SELECT recipe_id, digest FROM mission_recipe_revisions WHERE id=?')
        .get(input.revisionId) as { recipe_id: string; digest: string } | undefined;
      const digest = recipeDigest(content);
      if (revision) {
        if (revision.recipe_id !== input.recipeId || revision.digest !== digest)
          recipeFailure('REQUEST_CONFLICT');
        return;
      }
      const ordinal = existing ? this.get(input.recipeId).ordinal + 1 : 1;
      if (!existing)
        this.db
          .prepare('INSERT INTO mission_recipes VALUES (?, ?, 1, 1, 1, ?, ?, ?, ?, ?)')
          .run(
            input.recipeId,
            'bundled',
            input.revisionId,
            content.name,
            content.description,
            now,
            now,
          );
      this.db
        .prepare('INSERT INTO mission_recipe_revisions VALUES (?, ?, ?, ?, ?, ?)')
        .run(input.revisionId, input.recipeId, ordinal, digest, JSON.stringify(content), now);
      if (existing)
        this.db
          .prepare(
            'UPDATE mission_recipes SET current_revision_id=?, version=version+1, name=?, description=?, updated_at=? WHERE id=?',
          )
          .run(input.revisionId, content.name, content.description, now, input.recipeId);
    })();
  }

  assertAvailable(reference: MissionRecipeReference): MissionRecipeDetail {
    const current = this.get(reference.recipeId);
    if (current.availability !== 'enabled')
      recipeFailure(current.availability === 'unsupported' ? 'UNSUPPORTED_VERSION' : 'DISABLED');
    if (current.version !== reference.version || current.revisionId !== reference.revisionId)
      recipeFailure('STALE_PREVIEW');
    return current;
  }

  createDraft(input: {
    reference: MissionRecipeReference;
    expanded: MissionRecipeExpanded;
    projection: { objective: string; completionEvidence: string };
    requestId: string;
    requestDigest: string;
    now: string;
  }): MissionRecipeReceipt {
    return this.db.transaction(() => {
      const receipt = this.getReceipt(input.requestId, input.requestDigest);
      if (receipt) return receipt;
      const current = this.assertAvailable(input.reference);
      const expanded = parse(MissionRecipeExpanded, input.expanded);
      const projection = parse(MissionRecipeProjection, input.projection);
      if (
        projection.objective !== expanded.outcome.trim() ||
        projection.completionEvidence !== expanded.acceptanceChecklist.join('\n').trim()
      )
        recipeFailure('INVALID_RECIPE');
      const context = parse(MissionDraftRecipeContext, {
        recipeId: current.recipeId,
        revisionId: current.revisionId,
        name: current.name,
        origin: current.origin,
        appliedAt: input.now,
        digest: current.digest,
        expanded,
        suggestedRoles: expanded.suggestedRoles,
      });
      const draft = new MissionComposerRepository(this.db).createDraft({
        sourceMissionId: null,
        fieldValues: projection,
        currentStage: 'outcome',
        createdAt: input.now,
      });
      this.db
        .prepare('INSERT INTO mission_draft_recipe_context VALUES (?, ?)')
        .run(draft.draftId, JSON.stringify(context));
      const saved: MissionRecipeReceipt = {
        requestId: input.requestId,
        kind: 'createDraft',
        targetId: draft.draftId,
        version: 1,
        savedAt: input.now,
      };
      this.recordReceipt(saved, input.requestDigest);
      return saved;
    })();
  }

  sourceContent(source: NonNullable<MissionRecipeEditor['source']>): {
    objective: string;
    completionEvidence: string;
    suggestedRoles: string[];
  } {
    if (source.kind === 'draft') {
      const draft = new MissionComposerRepository(this.db).getDraft(source.id);
      if (draft.version !== source.version || draft.state === 'deleted')
        recipeFailure('STALE_PREVIEW');
      return {
        objective: draft.fieldValues.objective ?? '',
        completionEvidence: draft.fieldValues.completionEvidence ?? '',
        suggestedRoles: draft.recipeContext?.suggestedRoles ?? [],
      };
    }
    const supervisor = new SupervisorRepository(this.db);
    if (supervisor.mission(source.id).version !== source.version) recipeFailure('STALE_PREVIEW');
    const envelope = supervisor.envelope(source.id);
    if (!envelope) recipeFailure('DELETED');
    return {
      objective: envelope.objective,
      completionEvidence: envelope.completionEvidence,
      suggestedRoles: [],
    };
  }

  assertCurrent(reference: MissionRecipeReference, personal = false): MissionRecipeDetail {
    const current = this.get(reference.recipeId);
    if (current.schemaVersion !== 1) recipeFailure('UNSUPPORTED_VERSION');
    if (personal && current.origin !== 'personal') recipeFailure('BUNDLED_READ_ONLY');
    if (current.version !== reference.version || current.revisionId !== reference.revisionId)
      recipeFailure('STALE_PREVIEW');
    return current;
  }

  validateEditor(editorId: string, expectedVersion: number): MissionRecipeEditor {
    const editor = this.getEditor(editorId);
    if (editor.version !== expectedVersion) recipeFailure('STALE_EDITOR');
    if (editor.base) this.assertCurrent(editor.base, editor.mode === 'edit');
    if (editor.source) this.sourceContent(editor.source);
    return editor;
  }

  save(input: {
    editorId: string;
    expectedVersion: number;
    requestId: string;
    requestDigest: string;
    now: string;
  }): MissionRecipeReceipt {
    return this.db.transaction(() => {
      const previous = this.getReceipt(input.requestId, input.requestDigest);
      if (previous) return previous;
      const editor = this.validateEditor(input.editorId, input.expectedVersion);
      const content = parse(MissionRecipeContent, editor.content);
      const existing =
        editor.mode === 'edit' && editor.base ? this.assertCurrent(editor.base, true) : null;
      const recipeId = existing?.recipeId ?? randomUUID(),
        revisionId = randomUUID();
      if (!existing)
        this.db
          .prepare('INSERT INTO mission_recipes VALUES (?, ?, 1, 1, 1, ?, ?, ?, ?, ?)')
          .run(
            recipeId,
            'personal',
            revisionId,
            content.name,
            content.description,
            input.now,
            input.now,
          );
      this.db
        .prepare('INSERT INTO mission_recipe_revisions VALUES (?, ?, ?, ?, ?, ?)')
        .run(
          revisionId,
          recipeId,
          (existing?.ordinal ?? 0) + 1,
          recipeDigest(content),
          JSON.stringify(content),
          input.now,
        );
      if (existing)
        this.db
          .prepare(
            'UPDATE mission_recipes SET current_revision_id=?,version=version+1,name=?,description=?,updated_at=? WHERE id=?',
          )
          .run(revisionId, content.name, content.description, input.now, recipeId);
      if (!existing && editor.mode === 'duplicate' && editor.base)
        this.db
          .prepare('INSERT INTO mission_recipe_origins VALUES (?, ?, ?, ?)')
          .run(recipeId, editor.base.recipeId, editor.base.revisionId, editor.base.version);
      this.db.prepare('DELETE FROM mission_recipe_editor_drafts WHERE id=?').run(editor.editorId);
      const receipt: MissionRecipeReceipt = {
        requestId: input.requestId,
        kind: 'save',
        targetId: recipeId,
        version: (existing?.version ?? 0) + 1,
        savedAt: input.now,
      };
      this.recordReceipt(receipt, input.requestDigest);
      return receipt;
    })();
  }

  setEnabled(input: {
    recipeId: string;
    expectedVersion: number;
    enabled: boolean;
    requestId: string;
    requestDigest: string;
    now: string;
  }): MissionRecipeReceipt {
    return this.db.transaction(() => {
      const previous = this.getReceipt(input.requestId, input.requestDigest);
      if (previous) return previous;
      const current = this.get(input.recipeId);
      this.assertCurrent({ ...current, version: input.expectedVersion }, true);
      this.db
        .prepare('UPDATE mission_recipes SET enabled=?,version=version+1,updated_at=? WHERE id=?')
        .run(Number(input.enabled), input.now, input.recipeId);
      const receipt: MissionRecipeReceipt = {
        requestId: input.requestId,
        kind: 'setEnabled',
        targetId: input.recipeId,
        version: current.version + 1,
        savedAt: input.now,
      };
      this.recordReceipt(receipt, input.requestDigest);
      return receipt;
    })();
  }

  delete(input: {
    reference: MissionRecipeReference;
    requestId: string;
    requestDigest: string;
    now: string;
  }): MissionRecipeReceipt {
    return this.db.transaction(() => {
      const previous = this.getReceipt(input.requestId, input.requestDigest);
      if (previous) return previous;
      const current = this.assertCurrent(input.reference, true);
      this.db
        .prepare('DELETE FROM mission_recipe_editor_drafts WHERE base_recipe_id=?')
        .run(current.recipeId);
      this.db
        .prepare('DELETE FROM mission_recipe_revisions WHERE recipe_id=?')
        .run(current.recipeId);
      this.db.prepare('DELETE FROM mission_recipes WHERE id=?').run(current.recipeId);
      const receipt: MissionRecipeReceipt = {
        requestId: input.requestId,
        kind: 'delete',
        targetId: current.recipeId,
        version: current.version + 1,
        savedAt: input.now,
      };
      this.recordReceipt(receipt, input.requestDigest);
      return receipt;
    })();
  }

  detachSource(editorId: string, expectedVersion: number, now: string): MissionRecipeEditor {
    return this.db.transaction(() => {
      const previous = this.getEditor(editorId);
      if (previous.version !== expectedVersion) recipeFailure('STALE_EDITOR');
      if (!previous.source && !previous.base) recipeFailure('INVALID_RECIPE');
      const next = parse(MissionRecipeEditor, {
        ...previous,
        source: null,
        base: null,
        mode: 'create',
        version: expectedVersion + 1,
        updatedAt: now,
      });
      this.db
        .prepare(
          'UPDATE mission_recipe_editor_drafts SET version=?,base_recipe_id=NULL,content=?,updated_at=? WHERE id=?',
        )
        .run(next.version, JSON.stringify(next), now, editorId);
      return next;
    })();
  }

  getReceipt(requestId: string, digest: string): MissionRecipeReceipt | null {
    const row = this.db
      .prepare(
        'SELECT request_digest, content FROM mission_recipe_operation_receipts WHERE request_id=?',
      )
      .get(requestId) as { request_digest: string; content: string } | undefined;
    if (!row) return null;
    if (row.request_digest !== digest) recipeFailure('REQUEST_CONFLICT');
    return parse(MissionRecipeReceipt, JSON.parse(row.content));
  }

  recordReceipt(receipt: MissionRecipeReceipt, digest: string): void {
    const safe = parse(MissionRecipeReceipt, receipt);
    if (!/^[a-f0-9]{64}$/.test(digest)) recipeFailure('INVALID_RECIPE');
    const existing = this.getReceipt(safe.requestId, digest);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(safe)) recipeFailure('REQUEST_CONFLICT');
      return;
    }
    this.db
      .prepare('INSERT INTO mission_recipe_operation_receipts VALUES (?, ?, ?)')
      .run(safe.requestId, digest, JSON.stringify(safe));
  }

  openEditor(input: {
    mode: MissionRecipeEditor['mode'];
    content: MissionRecipeEditorContent;
    base: MissionRecipeEditor['base'];
    source: MissionRecipeEditor['source'];
    now: string;
  }): MissionRecipeEditor {
    const editor = parse(MissionRecipeEditor, {
      editorId: randomUUID(),
      version: 1,
      mode: input.mode,
      content: input.content,
      base: input.base,
      source: input.source,
      updatedAt: input.now,
    });
    this.db
      .prepare('INSERT INTO mission_recipe_editor_drafts VALUES (?, ?, ?, ?, ?)')
      .run(
        editor.editorId,
        editor.version,
        editor.base?.recipeId ?? null,
        JSON.stringify(editor),
        editor.updatedAt,
      );
    return editor;
  }

  getEditor(editorId: string): MissionRecipeEditor {
    const row = this.db
      .prepare('SELECT content FROM mission_recipe_editor_drafts WHERE id=?')
      .get(editorId) as { content: string } | undefined;
    if (!row) recipeFailure('DELETED');
    return parse(MissionRecipeEditor, JSON.parse(row.content));
  }

  listEditors(cursor: string | null = null): {
    items: { editorId: string; version: number; name: string; updatedAt: string }[];
    nextCursor: string | null;
  } {
    const rows = this.db
      .prepare(
        'SELECT id, content FROM mission_recipe_editor_drafts WHERE (? IS NULL OR id > ?) ORDER BY id LIMIT 51',
      )
      .all(cursor, cursor) as { id: string; content: string }[];
    const items = rows.slice(0, 50).map((row) => {
      const editor = parse(MissionRecipeEditor, JSON.parse(row.content));
      return {
        editorId: editor.editorId,
        version: editor.version,
        name: editor.content.name,
        updatedAt: editor.updatedAt,
      };
    });
    return { items, nextCursor: rows.length > 50 ? items.at(-1)!.editorId : null };
  }

  saveEditor(
    editorId: string,
    expectedVersion: number,
    content: MissionRecipeEditorContent,
    now: string,
  ): MissionRecipeEditor {
    return this.db.transaction(() => {
      const previous = this.getEditor(editorId);
      if (previous.version !== expectedVersion) recipeFailure('STALE_EDITOR');
      const next = parse(MissionRecipeEditor, {
        ...previous,
        content,
        version: expectedVersion + 1,
        updatedAt: now,
      });
      this.db
        .prepare(
          'UPDATE mission_recipe_editor_drafts SET version=?, content=?, updated_at=? WHERE id=?',
        )
        .run(next.version, JSON.stringify(next), next.updatedAt, editorId);
      return next;
    })();
  }

  discardEditor(editorId: string, expectedVersion: number): void {
    this.db.transaction(() => {
      if (this.getEditor(editorId).version !== expectedVersion) recipeFailure('STALE_EDITOR');
      this.db.prepare('DELETE FROM mission_recipe_editor_drafts WHERE id=?').run(editorId);
    })();
  }
}
