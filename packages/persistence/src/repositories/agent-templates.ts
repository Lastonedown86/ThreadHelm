import { createHash, randomUUID } from 'node:crypto';
import {
  HireManifestV1,
  isSafeAuthoredText,
  MAX_GOAL_LENGTH,
  ThreadHelmError,
} from '@threadhelm/contracts';
import { completeTemplateDraft, createTemplateDraft, parseHireManifest } from '@threadhelm/domain';
import type { Db } from '../migrate.js';
import { AgentProfileRepository } from './agent-profiles.js';

export interface TemplateVariable {
  name: string;
  type: 'text';
  maxLength: number;
  defaultValue?: string;
}
export type WizardStep = 'start' | 'identity' | 'role' | 'capabilities' | 'runtime' | 'review';
export interface TemplateRevisionInput {
  key: string;
  name: string;
  manifestJson: string;
  digest: string;
  variables?: readonly TemplateVariable[];
  sourceProfileRevisionId?: string;
  /** The scaffold already copied this provenance; it is no longer a live source dependency. */
  sourceProfileIsHistorical?: boolean;
  createdAt: string;
}
export interface TemplateRevision {
  revisionId: string;
  templateId: string;
  revision: number;
  name: string;
  manifestJson: string;
  digest: string;
  variables: TemplateVariable[];
  sourceProfileRevisionId: string | null;
}
interface TemplateRow {
  id: string;
  template_key: string;
  origin: 'bundled' | 'user';
  state: 'active' | 'disabled' | 'superseded' | 'deleted';
  current_revision_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface TemplateDraftDetail {
  draftId: string;
  sourceTemplateRevisionId: string | null;
  sourceProfileRevisionId: string | null;
  state: 'editing' | 'invalid' | 'ready_for_review' | 'completed' | 'deleted';
  version: number;
  currentStep: WizardStep;
  fieldValues: Partial<HireManifestV1>;
  variableValues: Record<string, string>;
  validationIssues: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
type DraftMutation = { draftId: string; expectedVersion: number };
const OPEN_STATES = "('editing', 'invalid', 'ready_for_review')";
export const MAX_USER_TEMPLATES = 100;
export const MAX_TEMPLATE_REVISIONS = 32;
export const MAX_OPEN_DRAFTS = 20;
export const MAX_OPEN_DRAFT_BYTES = 1024 * 1024;
export const MAX_TEMPLATE_VARIABLES = 16;
export const MAX_TEMPLATE_VARIABLE_LENGTH = 256;
const STEPS: readonly WizardStep[] = [
  'start',
  'identity',
  'role',
  'capabilities',
  'runtime',
  'review',
];

function invalid(): never {
  throw new ThreadHelmError('INVALID_REQUEST', 'Template or draft fields are invalid.');
}
function stale(): never {
  throw new ThreadHelmError(
    'PROFILE_REVISION_STALE',
    'The template or draft changed; review it again.',
  );
}
function boundedJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (!json || Buffer.byteLength(json, 'utf8') > 65_536) invalid();
  return json;
}
function fields(value: unknown): Partial<HireManifestV1> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  boundedJson(value);
  const text: Record<string, string> = {};
  const candidate = { ...value } as Record<string, unknown>;
  const textLimits = {
    name: 200,
    description: MAX_GOAL_LENGTH,
    model: 128,
    goal: MAX_GOAL_LENGTH,
    author: 200,
  };
  for (const [key, limit] of Object.entries(textLimits)) {
    if (candidate[key] === undefined) continue;
    if (
      typeof candidate[key] !== 'string' ||
      candidate[key].length > limit ||
      !isSafeAuthoredText(candidate[key])
    )
      invalid();
    text[key] = candidate[key];
    delete candidate[key];
  }
  const result: Record<string, unknown> = {};
  if (candidate.spec !== undefined) {
    if (candidate.spec !== 'munder-difflin/hire@1') invalid();
    result.spec = candidate.spec;
    delete candidate.spec;
  }
  if (candidate.provider !== undefined) {
    if (!['claude', 'codex', 'claude-code', 'codex-cli'].includes(candidate.provider as string))
      invalid();
    result.provider = candidate.provider;
    delete candidate.provider;
  }
  if (candidate.capabilities !== undefined) {
    if (
      !Array.isArray(candidate.capabilities) ||
      candidate.capabilities.length > 16 ||
      candidate.capabilities.some(
        (item) => typeof item !== 'string' || item.length > 64 || !isSafeAuthoredText(item),
      )
    )
      invalid();
    result.capabilities = [...candidate.capabilities];
    delete candidate.capabilities;
  }
  if (candidate.isolate !== undefined) {
    if (typeof candidate.isolate !== 'boolean') invalid();
    result.isolate = candidate.isolate;
    delete candidate.isolate;
  }
  if (candidate.tokenCap !== undefined) {
    if (
      !Number.isInteger(candidate.tokenCap) ||
      (candidate.tokenCap as number) < 0 ||
      (candidate.tokenCap as number) > 2_000_000
    )
      invalid();
    result.tokenCap = candidate.tokenCap;
    delete candidate.tokenCap;
  }
  if (Object.keys(candidate).length !== 0) invalid();
  boundedJson(result);
  return {
    ...result,
    ...text,
  } as Partial<HireManifestV1>;
}

type PageOptions = { limit?: number; cursor?: string };
function page(options: PageOptions, kind: string): { limit: number; after: string } {
  const limit = options.limit ?? 20;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) invalid();
  if (!options.cursor) return { limit, after: '' };
  if (options.cursor.length > 256 || !options.cursor.startsWith(kind + ':')) invalid();
  const after = options.cursor.slice(kind.length + 1);
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(after)) invalid();
  return { limit, after };
}
function declarations(value: readonly TemplateVariable[]): TemplateVariable[] {
  if (!Array.isArray(value) || value.length > MAX_TEMPLATE_VARIABLES) invalid();
  boundedJson(value);
  const names = new Set<string>();
  return value.map((item) => {
    if (
      !item ||
      Object.keys(item).some(
        (key) => !['name', 'type', 'maxLength', 'defaultValue'].includes(key),
      ) ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(item.name) ||
      names.has(item.name) ||
      item.type !== 'text' ||
      !Number.isInteger(item.maxLength) ||
      item.maxLength < 1 ||
      item.maxLength > MAX_TEMPLATE_VARIABLE_LENGTH ||
      (item.defaultValue !== undefined &&
        (typeof item.defaultValue !== 'string' ||
          Array.from(item.defaultValue).length > item.maxLength ||
          !isSafeAuthoredText(item.defaultValue)))
    )
      invalid();
    names.add(item.name);
    return { ...item };
  });
}
function variables(
  value: Record<string, string>,
  declared: readonly TemplateVariable[],
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  for (const [name, text] of Object.entries(value)) {
    const definition = declared.find((item) => item.name === name);
    if (
      !definition ||
      typeof text !== 'string' ||
      Array.from(text).length > definition.maxLength ||
      !isSafeAuthoredText(text)
    )
      invalid();
  }
  boundedJson(value);
  return { ...value };
}

/** Only Electron main calls this repository; every authority decision stays outside template data. */
export class AgentTemplateRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  private row(id: string): TemplateRow {
    const row = this.db.prepare('SELECT * FROM agent_profile_templates WHERE id = ?').get(id) as
      TemplateRow | undefined;
    if (!row || row.state === 'deleted')
      throw new ThreadHelmError('PROFILE_NOT_FOUND', 'The template was not found.');
    return row;
  }

  private assertOpenDraftBytes(
    fieldValues: unknown,
    variableValues: unknown,
    excludingDraftId?: string,
  ): void {
    const next =
      Buffer.byteLength(JSON.stringify(fieldValues), 'utf8') +
      Buffer.byteLength(JSON.stringify(variableValues), 'utf8');
    const aggregate = this.db
      .prepare(
        `SELECT COALESCE(SUM(length(CAST(field_values AS BLOB)) + length(CAST(variable_values AS BLOB))), 0) AS bytes
           FROM agent_profile_drafts
          WHERE state IN ${OPEN_STATES}${excludingDraftId ? ' AND id <> ?' : ''}`,
      )
      .get(...(excludingDraftId ? [excludingDraftId] : [])) as { bytes: number };
    if (aggregate.bytes + next > MAX_OPEN_DRAFT_BYTES) {
      throw new ThreadHelmError(
        'PROFILE_LIMIT_REACHED',
        'The open-draft storage limit was reached.',
      );
    }
  }

  getTemplate(templateId: string) {
    const row = this.row(templateId);
    return {
      templateId: row.id,
      key: row.template_key,
      origin: row.origin,
      state: row.state,
      currentRevisionId: row.current_revision_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listTemplates(options: PageOptions & { state?: 'active' | 'disabled' } = {}) {
    const { limit, after } = page(options, 'templates');
    const state = options.state;
    const rows = this.db
      .prepare(
        `SELECT id FROM agent_profile_templates WHERE state ${state ? '= ?' : "IN ('active', 'disabled')"} AND id > ? ORDER BY id LIMIT ?`,
      )
      .all(...(state ? [state, after, limit + 1] : [after, limit + 1])) as { id: string }[];
    return {
      items: rows.slice(0, limit).map((row) => {
        const template = this.getTemplate(row.id);
        const revision = this.getRevision(template.currentRevisionId!);
        return { ...template, name: revision.name, revision: revision.revision };
      }),
      nextCursor: rows.length > limit ? 'templates:' + rows[limit - 1]!.id : null,
    };
  }

  listDrafts(options: PageOptions = {}) {
    const { limit, after } = page(options, 'drafts');
    const rows = this.db
      .prepare(
        `SELECT id FROM agent_profile_drafts WHERE state IN ${OPEN_STATES} AND id > ? ORDER BY id LIMIT ?`,
      )
      .all(after, limit + 1) as { id: string }[];
    return {
      items: rows.slice(0, limit).map((row) => {
        const draft = this.getDraft(row.id);
        return {
          draftId: draft.draftId,
          version: draft.version,
          state: draft.state,
          currentStep: draft.currentStep,
          validationIssues: draft.validationIssues,
          updatedAt: draft.updatedAt,
        };
      }),
      nextCursor: rows.length > limit ? 'drafts:' + rows[limit - 1]!.id : null,
    };
  }

  private profileSource(revisionId: string): HireManifestV1 {
    const row = this.db
      .prepare('SELECT profile_id FROM agent_profile_revisions WHERE id = ?')
      .get(revisionId) as { profile_id: string } | undefined;
    const profile = row ? new AgentProfileRepository(this.db).getDetail(row.profile_id) : undefined;
    if (!profile || profile.state !== 'active' || profile.compatibility !== 'compatible') {
      throw new ThreadHelmError(
        'PROFILE_INCOMPATIBLE',
        'The source profile is unavailable or incompatible.',
      );
    }
    if (profile.currentRevisionId !== revisionId) stale();
    return {
      spec: profile.manifestSpec,
      name: profile.displayName,
      description: profile.description,
      goal: profile.goal,
      provider: profile.requestedProvider,
      model: profile.requestedModel,
      capabilities: profile.capabilities,
      isolate: profile.isolateRequested,
      tokenCap: profile.tokenCapRequested,
      author: profile.author,
    };
  }

  getRevision(revisionId: string): TemplateRevision {
    const row = this.db
      .prepare('SELECT * FROM agent_profile_template_revisions WHERE id = ?')
      .get(revisionId) as
      | {
          id: string;
          template_id: string;
          revision: number;
          name: string;
          manifest_json: string;
          digest: string;
          variables_json: string;
          source_profile_revision_id: string | null;
        }
      | undefined;
    if (!row)
      throw new ThreadHelmError('PROFILE_NOT_FOUND', 'The template revision was not found.');
    this.row(row.template_id);
    return {
      revisionId: row.id,
      templateId: row.template_id,
      revision: row.revision,
      name: row.name,
      manifestJson: row.manifest_json,
      digest: row.digest,
      variables: JSON.parse(row.variables_json) as TemplateVariable[],
      sourceProfileRevisionId: row.source_profile_revision_id,
    };
  }

  private current(revisionId: string): TemplateRevision {
    const revision = this.getRevision(revisionId);
    const row = this.row(revision.templateId);
    if (row.current_revision_id !== revisionId) stale();
    if (row.state !== 'active')
      throw new ThreadHelmError('INVALID_STATE', 'The template is not active.');
    return revision;
  }

  private editable(templateId: string, revisionId: string): TemplateRow {
    const row = this.row(templateId);
    if (row.origin !== 'user')
      throw new ThreadHelmError('INVALID_STATE', 'Bundled templates are read-only.');
    if (row.current_revision_id !== revisionId) stale();
    return row;
  }

  private writeRevision(
    input: TemplateRevisionInput,
    origin: 'bundled' | 'user',
    existing?: TemplateRow,
  ) {
    if (
      !/^[a-z0-9][a-z0-9-]{0,127}$/.test(input.key) ||
      !input.name.trim() ||
      input.name.length > 200 ||
      !isSafeAuthoredText(input.name)
    )
      invalid();
    parseHireManifest(input.manifestJson);
    const digest = createHash('sha256').update(input.manifestJson).digest('hex');
    if (input.digest !== digest)
      throw new ThreadHelmError(
        'PROFILE_DIGEST_CHANGED',
        'Template content does not match its digest.',
      );
    const declared = declarations(input.variables ?? []);
    // Placeholders must be declared; only supported manifest string fields are substituted.
    const manifest = parseHireManifest(input.manifestJson);
    for (const text of [
      manifest.name,
      manifest.description,
      manifest.goal,
      manifest.author,
      manifest.model,
    ]) {
      for (const match of text.matchAll(/{{([a-z][a-z0-9_]*)}}/g)) {
        if (!declared.some((item) => item.name === match[1])) invalid();
      }
    }
    if (input.sourceProfileRevisionId && !input.sourceProfileIsHistorical) {
      const source = this.db
        .prepare(
          'SELECT 1 FROM agent_profile_revisions r JOIN agent_profiles p ON p.id = r.profile_id WHERE r.id = ? AND p.state != ?',
        )
        .get(input.sourceProfileRevisionId, 'deleted');
      if (!source)
        throw new ThreadHelmError(
          'PROFILE_NOT_FOUND',
          'The source profile revision was not found.',
        );
    }
    if (existing?.current_revision_id) {
      const current = this.getRevision(existing.current_revision_id);
      if (
        current.digest === digest &&
        current.name === input.name &&
        JSON.stringify(current.variables) === JSON.stringify(declared) &&
        current.sourceProfileRevisionId === (input.sourceProfileRevisionId ?? null)
      ) {
        return { templateId: existing.id, revisionId: current.revisionId };
      }
      if (origin === 'bundled')
        throw new ThreadHelmError(
          'INVALID_STATE',
          'Bundled template versions cannot be overwritten.',
        );
    }
    if (!existing && origin === 'user') {
      const count = this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM agent_profile_templates WHERE origin = 'user' AND state = 'active'",
        )
        .get() as { count: number };
      if (count.count >= MAX_USER_TEMPLATES)
        throw new ThreadHelmError('PROFILE_LIMIT_REACHED', 'The local template limit was reached.');
    }
    const templateId = existing?.id ?? randomUUID();
    const revisionId = randomUUID();
    const next = this.db
      .prepare(
        'SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM agent_profile_template_revisions WHERE template_id = ?',
      )
      .get(templateId) as { revision: number };
    if (next.revision > MAX_TEMPLATE_REVISIONS) {
      throw new ThreadHelmError(
        'PROFILE_LIMIT_REACHED',
        'The template revision limit was reached.',
      );
    }
    if (!existing) {
      if (
        this.db
          .prepare('SELECT 1 FROM agent_profile_templates WHERE template_key = ?')
          .get(input.key)
      ) {
        throw new ThreadHelmError('INVALID_STATE', 'That template identity already exists.');
      }
      this.db
        .prepare(
          'INSERT INTO agent_profile_templates (id, template_key, origin, state, current_revision_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(templateId, input.key, origin, 'active', revisionId, input.createdAt, input.createdAt);
    }
    this.db
      .prepare(
        'INSERT INTO agent_profile_template_revisions (id, template_id, revision, name, manifest_json, digest, variables_json, source_profile_revision_id, created_by_user, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        revisionId,
        templateId,
        next.revision,
        input.name,
        input.manifestJson,
        digest,
        JSON.stringify(declared),
        input.sourceProfileRevisionId ?? null,
        origin === 'user' ? 1 : 0,
        input.createdAt,
      );
    this.db
      .prepare(
        'UPDATE agent_profile_templates SET current_revision_id = ?, updated_at = ? WHERE id = ?',
      )
      .run(revisionId, input.createdAt, templateId);
    return { templateId, revisionId };
  }

  createBundled(input: TemplateRevisionInput) {
    return this.db.transaction(() => {
      const existing = this.db
        .prepare('SELECT * FROM agent_profile_templates WHERE template_key = ?')
        .get(input.key) as TemplateRow | undefined;
      if (existing && (existing.origin !== 'bundled' || existing.state !== 'active')) invalid();
      return this.writeRevision(input, 'bundled', existing);
    })();
  }

  saveRevision(
    input: TemplateRevisionInput & { templateId?: string; expectedRevisionId?: string },
  ) {
    return this.db.transaction(() => {
      if (Boolean(input.templateId) !== Boolean(input.expectedRevisionId)) invalid();
      const existing = input.templateId
        ? this.editable(input.templateId, input.expectedRevisionId!)
        : undefined;
      if (existing && existing.template_key !== input.key) invalid();
      return this.writeRevision(input, 'user', existing);
    })();
  }

  duplicate(input: { templateRevisionId: string; key: string; name: string; createdAt: string }) {
    return this.db.transaction(() => {
      const source = this.current(input.templateRevisionId);
      return this.writeRevision(
        {
          key: input.key,
          name: input.name,
          manifestJson: source.manifestJson,
          digest: source.digest,
          variables: source.variables,
          createdAt: input.createdAt,
          ...(source.sourceProfileRevisionId
            ? {
                sourceProfileRevisionId: source.sourceProfileRevisionId,
                sourceProfileIsHistorical: true,
              }
            : {}),
        },
        'user',
      );
    })();
  }

  setEnabled(input: {
    templateId: string;
    expectedRevisionId: string;
    enabled: boolean;
    updatedAt: string;
  }): void {
    this.db.transaction(() => {
      const template = this.editable(input.templateId, input.expectedRevisionId);
      if (input.enabled && template.state !== 'active') {
        const count = this.db
          .prepare(
            "SELECT COUNT(*) AS count FROM agent_profile_templates WHERE origin = 'user' AND state = 'active'",
          )
          .get() as { count: number };
        if (count.count >= MAX_USER_TEMPLATES) {
          throw new ThreadHelmError(
            'PROFILE_LIMIT_REACHED',
            'The active template limit was reached.',
          );
        }
      }
      this.db
        .prepare('UPDATE agent_profile_templates SET state = ?, updated_at = ? WHERE id = ?')
        .run(input.enabled ? 'active' : 'disabled', input.updatedAt, input.templateId);
    })();
  }

  deleteTemplate(input: {
    templateId: string;
    expectedRevisionId: string;
    deletedAt: string;
  }): void {
    this.db.transaction(() => {
      this.editable(input.templateId, input.expectedRevisionId);
      const pinned = this.db
        .prepare(
          `SELECT 1 FROM agent_profile_drafts d JOIN agent_profile_template_revisions r ON r.id = d.source_template_revision_id WHERE r.template_id = ? AND d.state IN ${OPEN_STATES} LIMIT 1`,
        )
        .get(input.templateId);
      if (pinned)
        throw new ThreadHelmError('INVALID_STATE', 'An open draft still uses this template.');
      this.db
        .prepare(
          "UPDATE agent_profile_template_revisions SET name = '', manifest_json = '{}', variables_json = '[]', source_profile_revision_id = NULL WHERE template_id = ?",
        )
        .run(input.templateId);
      this.db
        .prepare(
          "UPDATE agent_profile_templates SET state = 'deleted', current_revision_id = NULL, updated_at = ? WHERE id = ?",
        )
        .run(input.deletedAt, input.templateId);
    })();
  }

  createDraft(input: {
    templateRevisionId?: string;
    profileRevisionId?: string;
    createdAt: string;
  }) {
    return this.db.transaction(() => {
      if (input.templateRevisionId && input.profileRevisionId) invalid();
      const count = this.db
        .prepare(`SELECT COUNT(*) AS count FROM agent_profile_drafts WHERE state IN ${OPEN_STATES}`)
        .get() as { count: number };
      if (count.count >= MAX_OPEN_DRAFTS)
        throw new ThreadHelmError('PROFILE_LIMIT_REACHED', 'The open draft limit was reached.');
      const source = input.templateRevisionId ? this.current(input.templateRevisionId) : undefined;
      const fieldValues = source
        ? fields(JSON.parse(source.manifestJson))
        : input.profileRevisionId
          ? fields(this.profileSource(input.profileRevisionId))
          : { spec: 'munder-difflin/hire@1', isolate: false };
      const variableValues = Object.fromEntries(
        (source?.variables ?? [])
          .filter((item) => item.defaultValue !== undefined)
          .map((item) => [item.name, item.defaultValue!]),
      );
      variables(variableValues, source?.variables ?? []);
      this.assertOpenDraftBytes(fieldValues, variableValues);
      const draftId = randomUUID();
      this.db
        .prepare(
          'INSERT INTO agent_profile_drafts (id, source_template_revision_id, source_profile_revision_id, state, field_values, variable_values, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          draftId,
          source?.revisionId ?? null,
          input.profileRevisionId ?? null,
          'editing',
          JSON.stringify(fieldValues),
          JSON.stringify(variableValues),
          input.createdAt,
          input.createdAt,
        );
      return { draftId };
    })();
  }

  getDraft(draftId: string): TemplateDraftDetail {
    const row = this.db.prepare('SELECT * FROM agent_profile_drafts WHERE id = ?').get(draftId) as
      | {
          id: string;
          source_template_revision_id: string | null;
          source_profile_revision_id: string | null;
          state: TemplateDraftDetail['state'];
          version: number;
          current_step: WizardStep;
          field_values: string;
          variable_values: string;
          validation_issues: string;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        }
      | undefined;
    if (!row || row.state === 'deleted')
      throw new ThreadHelmError('PROFILE_NOT_FOUND', 'The draft was not found.');
    return {
      draftId: row.id,
      sourceTemplateRevisionId: row.source_template_revision_id,
      sourceProfileRevisionId: row.source_profile_revision_id,
      state: row.state,
      version: row.version,
      currentStep: row.current_step,
      fieldValues: JSON.parse(row.field_values) as Partial<HireManifestV1>,
      variableValues: JSON.parse(row.variable_values) as Record<string, string>,
      validationIssues: JSON.parse(row.validation_issues) as string[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  private mutableDraft(input: DraftMutation): TemplateDraftDetail {
    const draft = this.getDraft(input.draftId);
    if (draft.state === 'completed')
      throw new ThreadHelmError('INVALID_STATE', 'Completed drafts are immutable.');
    if (!Number.isSafeInteger(input.expectedVersion) || draft.version !== input.expectedVersion)
      stale();
    return draft;
  }

  private finalManifest(draft: TemplateDraftDetail): HireManifestV1 {
    const parsed = HireManifestV1.safeParse(draft.fieldValues);
    if (!parsed.success)
      throw new ThreadHelmError(
        'TEMPLATE_DRAFT_INCOMPLETE',
        'Complete all required fields before review.',
      );
    return completeTemplateDraft(
      createTemplateDraft({ manifest: parsed.data, variables: draft.variableValues }),
    );
  }

  updateDraft(
    input: DraftMutation & {
      fieldValues: unknown;
      currentStep: WizardStep;
      variableValues?: Record<string, string>;
      updatedAt: string;
    },
  ): void {
    this.db.transaction(() => {
      const draft = this.mutableDraft(input);
      if (!STEPS.includes(input.currentStep)) invalid();
      const fieldValues = fields(input.fieldValues);
      const declared = draft.sourceTemplateRevisionId
        ? this.getRevision(draft.sourceTemplateRevisionId).variables
        : [];
      const variableValues = variables(input.variableValues ?? draft.variableValues, declared);
      this.assertOpenDraftBytes(fieldValues, variableValues, input.draftId);
      let state = 'editing';
      const issues: string[] = [];
      try {
        this.finalManifest({ ...draft, fieldValues, variableValues });
        if (input.currentStep === 'review') state = 'ready_for_review';
      } catch (error) {
        if (!(error instanceof ThreadHelmError)) throw error;
        issues.push(error.code);
        state = 'invalid';
      }
      this.db
        .prepare(
          'UPDATE agent_profile_drafts SET field_values = ?, variable_values = ?, current_step = ?, state = ?, validation_issues = ?, version = version + 1, updated_at = ? WHERE id = ?',
        )
        .run(
          JSON.stringify(fieldValues),
          JSON.stringify(variableValues),
          input.currentStep,
          state,
          JSON.stringify(issues),
          input.updatedAt,
          input.draftId,
        );
    })();
  }

  completeDraft(input: DraftMutation & { completedAt: string }): void {
    this.db.transaction(() => {
      const draft = this.mutableDraft(input);
      if (draft.sourceTemplateRevisionId) this.current(draft.sourceTemplateRevisionId);
      this.finalManifest(draft);
      this.db
        .prepare(
          "UPDATE agent_profile_drafts SET state = 'completed', version = version + 1, completed_at = ?, updated_at = ?, validation_issues = '[]' WHERE id = ?",
        )
        .run(input.completedAt, input.completedAt, input.draftId);
    })();
  }

  deleteDraft(input: DraftMutation & { deletedAt: string }): void {
    this.db.transaction(() => {
      this.mutableDraft(input);
      this.db
        .prepare(
          "UPDATE agent_profile_drafts SET state = 'deleted', version = version + 1, field_values = '{}', variable_values = '{}', validation_issues = '[]', deleted_at = ?, updated_at = ? WHERE id = ?",
        )
        .run(input.deletedAt, input.deletedAt, input.draftId);
    })();
  }
}
