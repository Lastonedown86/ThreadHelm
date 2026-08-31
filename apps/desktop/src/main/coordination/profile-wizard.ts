/**
 * Main-owned, non-executable agent creation wizard (US7). The renderer only
 * receives bounded forms and explicit previews; filesystem writes, profile
 * revisions, template storage, and all authority boundaries remain here.
 */

import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import {
  AgentTemplateDeletePreviewView,
  AgentTemplateDetailView,
  AgentTemplateSummaryView,
  AgentTemplatesChangedEvent,
  AgentWizardChangedEvent,
  AgentWizardCompletionPreviewView,
  AgentWizardDraftDetailView,
  AgentWizardDraftSummaryView,
  AgentWizardExportPreviewView,
  HireManifestV1,
  ThreadHelmError,
  TOKEN_TTL_MS,
  type AgentWizardStep,
  type OperationRequest,
  type ProfileCompatibility,
  type ProviderId,
} from '@threadhelm/contracts';
import {
  applyTemplateVariables,
  completeTemplateDraft,
  createTemplateDraft,
  evaluateProfileCompatibility,
} from '@threadhelm/domain';
import { GENERIC_AGENT_TEMPLATE_FIXTURES } from '@threadhelm/test-fixtures/desktop';
import type { TemplateDraftDetail } from '@threadhelm/persistence';
import type { Context } from '../context.js';
import { TokenStore } from '../tokens.js';
import type { ProfileService } from './profiles.js';

const TESTED_MODELS: Readonly<Record<ProviderId, readonly string[]>> = {
  'claude-code': ['claude-opus-5', 'claude-sonnet-5'],
  'codex-cli': ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'],
};

type CompletionSnapshot = {
  action: 'profile' | 'export';
  draftId: string;
  version: number;
  manifest: HireManifestV1;
  manifestJson: string;
  digest: string;
};
type TargetFingerprint = { exists: boolean; value: string };
type ExportSnapshot = CompletionSnapshot & {
  path: string;
  parent: string;
  target: TargetFingerprint;
};
type DeleteSnapshot = {
  templateId: string;
  revisionId: string;
  summary: ReturnType<typeof summaryOf>;
};

export interface AgentWizardService {
  createDraft(request: OperationRequest<'agentWizard.createDraft'>): ReturnType<typeof detailOf>;
  listDrafts(request: OperationRequest<'agentWizard.listDrafts'>): {
    drafts: ReturnType<typeof summaryOfDraft>[];
    nextCursor: string | null;
  };
  getDraft(request: OperationRequest<'agentWizard.getDraft'>): ReturnType<typeof detailOf>;
  updateStep(request: OperationRequest<'agentWizard.updateStep'>): ReturnType<typeof detailOf>;
  previewCompletion(
    request: OperationRequest<'agentWizard.previewCompletion'>,
  ): ReturnType<typeof completionView>;
  confirmProfile(
    request: OperationRequest<'agentWizard.confirmProfile'>,
  ): ReturnType<ProfileService['saveReviewedManifest']>;
  chooseExportTarget(): Promise<{ targetHandle: string }>;
  previewExport(
    request: OperationRequest<'agentWizard.previewExport'>,
  ): Promise<ReturnType<typeof exportView>>;
  confirmExport(
    request: OperationRequest<'agentWizard.confirmExport'>,
  ): Promise<{ draftId: string; state: 'completed'; digest: string; completedAt: string }>;
  deleteDraft(request: OperationRequest<'agentWizard.deleteDraft'>): {
    draftId: string;
    state: 'deleted';
    version: number;
    deletedAt: string;
  };
  listTemplates(request: OperationRequest<'agentTemplates.list'>): {
    templates: ReturnType<typeof summaryOf>[];
    nextCursor: string | null;
  };
  getTemplate(request: OperationRequest<'agentTemplates.get'>): ReturnType<typeof detailTemplate>;
  saveRevision(
    request: OperationRequest<'agentTemplates.saveRevision'>,
  ): ReturnType<typeof summaryOf>;
  duplicate(request: OperationRequest<'agentTemplates.duplicate'>): ReturnType<typeof summaryOf>;
  setEnabled(request: OperationRequest<'agentTemplates.setEnabled'>): ReturnType<typeof summaryOf>;
  previewDeleteTemplate(
    request: OperationRequest<'agentTemplates.previewDelete'>,
  ): ReturnType<typeof deleteView>;
  deleteTemplate(request: OperationRequest<'agentTemplates.delete'>): ReturnType<typeof summaryOf>;
}

function canonicalManifest(manifest: HireManifestV1): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
function storage(ctx: Context) {
  if (!ctx.storage || ctx.health.degraded) {
    throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Agent-template storage is unavailable.');
  }
  return ctx.storage.repositories;
}
function compatibility(
  ctx: Context,
  manifest: HireManifestV1,
): { compatibility: ProfileCompatibility; reasons: readonly string[] } {
  return evaluateProfileCompatibility({
    requestedProvider: manifest.provider,
    requestedModel: manifest.model,
    availableProviderModels: Object.fromEntries(
      ctx.adapters.map((adapter) => [adapter.id, TESTED_MODELS[adapter.id]]),
    ),
  });
}
function manifestOf(
  draft: TemplateDraftDetail,
  templates: ReturnType<typeof storage>['agentTemplates'],
): HireManifestV1 {
  const source = draft.sourceTemplateRevisionId
    ? templates.getRevision(draft.sourceTemplateRevisionId)
    : undefined;
  if (source) {
    const owner = templates.getTemplate(source.templateId);
    if (owner.currentRevisionId !== source.revisionId || owner.state !== 'active') {
      throw new ThreadHelmError(
        'PROFILE_REVISION_STALE',
        'The template changed after this draft started.',
      );
    }
  }
  try {
    return completeTemplateDraft(
      createTemplateDraft({
        manifest: draft.fieldValues as HireManifestV1,
        variables: draft.variableValues,
      }),
    );
  } catch (error) {
    if (error instanceof ThreadHelmError) {
      throw new ThreadHelmError(
        'TEMPLATE_DRAFT_INCOMPLETE',
        'Complete all required fields before review.',
      );
    }
    throw error;
  }
}
function summaryOfDraft(draft: TemplateDraftDetail) {
  return AgentWizardDraftSummaryView.parse({
    draftId: draft.draftId,
    version: draft.version,
    state: draft.state,
    currentStep: draft.currentStep,
    validationIssues: draft.validationIssues,
    updatedAt: draft.updatedAt,
  });
}
const VARIABLE_FIELDS = ['name', 'description', 'model', 'goal', 'author'] as const;
type VariableField = (typeof VARIABLE_FIELDS)[number];

function fieldAcceptsExpandedValue(field: VariableField, value: string): boolean {
  return HireManifestV1.safeParse({
    spec: 'munder-difflin/hire@1',
    name: 'Agent',
    description: 'Bounded description',
    provider: 'codex',
    model: 'model',
    goal: 'Bounded goal',
    capabilities: [],
    isolate: false,
    tokenCap: 1,
    author: 'Owner',
    [field]: value,
  }).success;
}
function errorsOf(
  draft: TemplateDraftDetail,
  templates?: ReturnType<typeof storage>['agentTemplates'],
): Record<string, string> {
  // A completed draft is immutable and was validated before completion. Its
  // source template may later be safely deleted and scrubbed, so detail reads
  // must not re-resolve that no-longer-live revision.
  if (draft.state === 'completed') return {};
  const fields = draft.fieldValues as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const requiredText: [string, number][] = [
    ['name', 200],
    ['description', 4000],
    ['author', 200],
    ['goal', 4000],
  ];
  for (const [key, limit] of requiredText) {
    const value = fields[key];
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > limit) {
      errors[key] = 'TEMPLATE_DRAFT_INCOMPLETE';
    }
  }
  if (
    !Array.isArray(fields.capabilities) ||
    fields.capabilities.length > 16 ||
    fields.capabilities.some(
      (value) => typeof value !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(value),
    )
  )
    errors.capabilities = 'TEMPLATE_DRAFT_INCOMPLETE';
  if (!['claude', 'codex', 'claude-code', 'codex-cli'].includes(fields.provider as string))
    errors.provider = 'TEMPLATE_DRAFT_INCOMPLETE';
  if (typeof fields.model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(fields.model))
    errors.model = 'TEMPLATE_DRAFT_INCOMPLETE';
  if (typeof fields.isolate !== 'boolean') errors.isolate = 'TEMPLATE_DRAFT_INCOMPLETE';
  if (!Number.isInteger(fields.tokenCap) || (fields.tokenCap as number) <= 0)
    errors.tokenCap = 'TEMPLATE_DRAFT_INCOMPLETE';
  const declared = draft.sourceTemplateRevisionId
    ? (templates?.getRevision(draft.sourceTemplateRevisionId).variables ?? [])
    : [];
  const declaredNames = declared.map((item) => item.name);
  for (const field of VARIABLE_FIELDS) {
    const text = fields[field];
    if (typeof text !== 'string') continue;
    try {
      const expanded = applyTemplateVariables(text, draft.variableValues, declaredNames);
      if (!fieldAcceptsExpandedValue(field, expanded)) {
        errors[field] = 'TEMPLATE_DRAFT_INCOMPLETE';
      }
    } catch (error) {
      errors[field] =
        error instanceof ThreadHelmError && error.code === 'TEMPLATE_VARIABLE_UNRESOLVED'
          ? error.code
          : 'TEMPLATE_DRAFT_INCOMPLETE';
    }
  }
  return errors;
}
function stepIsComplete(step: AgentWizardStep, values: Record<string, unknown>): boolean {
  const text = (key: string, limit: number) =>
    typeof values[key] === 'string' &&
    values[key]!.trim().length > 0 &&
    (values[key] as string).length <= limit;
  if (step === 'identity')
    return text('name', 200) && text('description', 4000) && text('author', 200);
  if (step === 'role') return text('goal', 4000);
  if (step === 'capabilities')
    return (
      Array.isArray(values.capabilities) &&
      values.capabilities.length <= 16 &&
      values.capabilities.every(
        (value) => typeof value === 'string' && /^[a-z][a-z0-9_-]*$/.test(value),
      )
    );
  if (step === 'runtime') {
    return (
      ['claude', 'codex', 'claude-code', 'codex-cli'].includes(values.provider as string) &&
      typeof values.model === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(values.model) &&
      typeof values.isolate === 'boolean' &&
      Number.isInteger(values.tokenCap) &&
      (values.tokenCap as number) > 0
    );
  }
  return true;
}
function stepOrder(step: AgentWizardStep): number {
  return ['start', 'identity', 'role', 'capabilities', 'runtime', 'review'].indexOf(step);
}
function ownedFields(step: AgentWizardStep): readonly string[] {
  if (step === 'identity') return ['name', 'description', 'author'];
  if (step === 'role') return ['goal'];
  if (step === 'capabilities') return ['capabilities'];
  if (step === 'runtime') return ['provider', 'model', 'isolate', 'tokenCap'];
  return [];
}
function detailOf(
  draft: TemplateDraftDetail,
  templates?: ReturnType<typeof storage>['agentTemplates'],
) {
  return AgentWizardDraftDetailView.parse({
    ...summaryOfDraft(draft),
    fieldValues: draft.fieldValues,
    variableValues: draft.variableValues,
    sourceTemplateRevisionId: draft.sourceTemplateRevisionId,
    sourceProfileRevisionId: draft.sourceProfileRevisionId,
    provenance: {
      templateRevisionId: draft.sourceTemplateRevisionId,
      profileRevisionId: draft.sourceProfileRevisionId,
    },
    fieldErrors: errorsOf(draft, templates),
    createdAt: draft.createdAt,
    completedAt: draft.completedAt,
  });
}
function summaryOf(value: {
  templateId: string;
  key: string;
  currentRevisionId: string | null;
  revision: number;
  name: string;
  origin: 'bundled' | 'user';
  state: 'active' | 'disabled' | 'superseded' | 'deleted';
  updatedAt: string;
}) {
  if (!value.currentRevisionId)
    throw new ThreadHelmError('PROFILE_NOT_FOUND', 'The template was not found.');
  return AgentTemplateSummaryView.parse({
    templateId: value.templateId,
    key: value.key,
    currentRevisionId: value.currentRevisionId,
    revision: value.revision,
    name: value.name,
    origin: value.origin,
    state: value.state,
    updatedAt: value.updatedAt,
  });
}
function detailTemplate(
  template: ReturnType<typeof storage>['agentTemplates'],
  templateId: string,
) {
  const base = template.getTemplate(templateId);
  if (!base.currentRevisionId)
    throw new ThreadHelmError('PROFILE_NOT_FOUND', 'The template was not found.');
  const revision = template.getRevision(base.currentRevisionId);
  return AgentTemplateDetailView.parse({
    ...summaryOf({ ...base, revision: revision.revision, name: revision.name }),
    manifest: JSON.parse(revision.manifestJson),
    manifestJson: revision.manifestJson,
    digest: revision.digest,
    variables: revision.variables,
    provenance: { sourceProfileRevisionId: revision.sourceProfileRevisionId },
    createdAt: base.createdAt,
  });
}
function completionView(
  snapshot: CompletionSnapshot,
  result: ReturnType<typeof compatibility>,
  token: string,
  expiresAt: string,
) {
  return AgentWizardCompletionPreviewView.parse({
    completionToken: token,
    draftId: snapshot.draftId,
    version: snapshot.version,
    manifest: snapshot.manifest,
    manifestJson: snapshot.manifestJson,
    digest: snapshot.digest,
    compatibility: result.compatibility,
    compatibilityReasons: result.reasons,
    disclosure:
      'This saves or exports reviewed profile data only. Provider, effort, permissions, tools, workspace, and mission role are resolved separately at launch.',
    expiresAt,
  });
}
function exportView(snapshot: ExportSnapshot, token: string, expiresAt: string) {
  return AgentWizardExportPreviewView.parse({
    exportToken: token,
    draftId: snapshot.draftId,
    displayPath: snapshot.path,
    basename: basename(snapshot.path),
    collision: snapshot.target.exists,
    requiresOverwriteConfirmation: snapshot.target.exists,
    expiresAt,
  });
}
function deleteView(snapshot: DeleteSnapshot, token: string, expiresAt: string) {
  return AgentTemplateDeletePreviewView.parse({
    deleteToken: token,
    templateId: snapshot.templateId,
    revisionId: snapshot.revisionId,
    name: snapshot.summary.name,
    expiresAt,
  });
}
async function fingerprint(path: string): Promise<TargetFingerprint> {
  try {
    const entry = await lstat(path);
    if (!entry.isFile())
      throw new ThreadHelmError('TARGET_CHANGED', 'The export target is not a file.');
    return { exists: true, value: `${entry.dev}:${entry.ino}:${entry.size}:${entry.mtimeMs}` };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { exists: false, value: 'missing' };
    throw error;
  }
}

export function createAgentWizardService(
  ctx: Context,
  profiles: ProfileService,
): AgentWizardService {
  const repos = storage(ctx);
  const templates = repos.agentTemplates;
  repos.agentProfileExports.recoverUnknown(ctx.clock().toISOString());
  for (const fixture of GENERIC_AGENT_TEMPLATE_FIXTURES) {
    const manifestJson = canonicalManifest(fixture.manifest as HireManifestV1);
    templates.createBundled({
      key: fixture.key,
      name: fixture.manifest.name,
      manifestJson,
      digest: digest(manifestJson),
      createdAt: ctx.clock().toISOString(),
    });
  }
  const completions = new TokenStore<CompletionSnapshot>(TOKEN_TTL_MS, () => ctx.clock().getTime());
  const exports = new TokenStore<ExportSnapshot>(TOKEN_TTL_MS, () => ctx.clock().getTime());
  const deletes = new TokenStore<DeleteSnapshot>(TOKEN_TTL_MS, () => ctx.clock().getTime());
  const targets = new Map<string, string>();
  const activeExportTargets = new Set<string>();
  const emitDraft = (draft: TemplateDraftDetail) =>
    ctx.events.emit(
      'agentWizard.changed',
      AgentWizardChangedEvent.parse({
        type: 'agentWizard.changed',
        draftId: draft.draftId,
        version: draft.version,
        state: draft.state,
        currentStep: draft.currentStep,
        validationIssues: draft.validationIssues,
        occurredAt: ctx.clock().toISOString(),
      }),
    );
  const emitTemplate = (value: ReturnType<typeof summaryOf>) =>
    ctx.events.emit(
      'agentTemplates.changed',
      AgentTemplatesChangedEvent.parse({
        type: 'agentTemplates.changed',
        templateId: value.templateId,
        revisionId: value.currentRevisionId,
        state: value.state,
        occurredAt: ctx.clock().toISOString(),
      }),
    );
  const review = (
    draftId: string,
    version: number,
    action: 'profile' | 'export' = 'profile',
  ): CompletionSnapshot => {
    const draft = templates.getDraft(draftId);
    if (draft.version !== version || draft.state === 'completed')
      throw new ThreadHelmError('PROFILE_REVISION_STALE', 'The draft changed after review.');
    const manifest = manifestOf(draft, templates);
    const manifestJson = canonicalManifest(manifest);
    return { action, draftId, version, manifest, manifestJson, digest: digest(manifestJson) };
  };

  return {
    createDraft(request) {
      const source = request.source;
      const created = templates.createDraft({
        ...(source.kind === 'template' ? { templateRevisionId: source.templateRevisionId } : {}),
        ...(source.kind === 'profile' ? { profileRevisionId: source.profileRevisionId } : {}),
        createdAt: ctx.clock().toISOString(),
      });
      const draft = templates.getDraft(created.draftId);
      emitDraft(draft);
      return detailOf(draft, templates);
    },
    listDrafts(request) {
      const page = templates.listDrafts({
        ...(request?.cursor !== undefined ? { cursor: request.cursor } : {}),
        ...(request?.limit !== undefined ? { limit: request.limit } : {}),
      });
      return {
        drafts: page.items.map((item) => AgentWizardDraftSummaryView.parse(item)),
        nextCursor: page.nextCursor,
      };
    },
    getDraft({ draftId }) {
      return detailOf(templates.getDraft(draftId), templates);
    },
    updateStep(request) {
      if (repos.agentProfileExports.hasActive(request.draftId))
        throw new ThreadHelmError('INVALID_STATE', 'An export is in progress for this draft.');
      const draft = templates.getDraft(request.draftId);
      if (draft.version !== request.version)
        throw new ThreadHelmError(
          'PROFILE_REVISION_STALE',
          'The draft changed after it was displayed.',
        );
      const merged = { ...draft.fieldValues, ...request.fields };
      const candidate = {
        ...draft,
        fieldValues: merged as TemplateDraftDetail['fieldValues'],
        variableValues: request.variables ?? draft.variableValues,
      };
      const next = request.nextStep ?? request.step;
      const advancing = stepOrder(next) > stepOrder(request.step);
      // Invalid typing is durable, but it cannot move the visible wizard forward.
      const stepHasErrors = ownedFields(request.step).some((field) =>
        Object.hasOwn(errorsOf(candidate, templates), field),
      );
      const currentStep =
        advancing && (!stepIsComplete(request.step, merged) || stepHasErrors) ? request.step : next;
      templates.updateDraft({
        draftId: request.draftId,
        expectedVersion: request.version,
        fieldValues: merged,
        currentStep: currentStep as AgentWizardStep,
        ...(request.variables !== undefined ? { variableValues: request.variables } : {}),
        updatedAt: ctx.clock().toISOString(),
      });
      const updated = templates.getDraft(request.draftId);
      emitDraft(updated);
      return detailOf(updated, templates);
    },
    previewCompletion({ draftId, version, action }) {
      const snapshot = review(draftId, version, action);
      const issued = completions.issue(snapshot);
      return completionView(
        snapshot,
        compatibility(ctx, snapshot.manifest),
        issued.token,
        issued.expiresAt,
      );
    },
    confirmProfile({ completionToken }) {
      const snapshot = completions.take(completionToken);
      if (!snapshot)
        throw new ThreadHelmError(
          'CONFIRMATION_EXPIRED',
          'The completion preview expired or was used.',
        );
      if (snapshot.action !== 'profile')
        throw new ThreadHelmError(
          'INVALID_REQUEST',
          'This preview is not bound to profile saving.',
        );
      if (repos.agentProfileExports.hasActive(snapshot.draftId))
        throw new ThreadHelmError('INVALID_STATE', 'An export is in progress for this draft.');
      const current = review(snapshot.draftId, snapshot.version, 'profile');
      if (current.digest !== snapshot.digest)
        throw new ThreadHelmError('PROFILE_DIGEST_CHANGED', 'The draft changed after review.');
      let summary: ReturnType<ProfileService['saveReviewedManifest']>;
      repos.transaction(() => {
        templates.completeDraft({
          draftId: current.draftId,
          expectedVersion: current.version,
          completedAt: ctx.clock().toISOString(),
        });
        summary = profiles.saveReviewedManifest(
          current.manifest,
          current.digest,
          `${current.digest.slice(0, 12)}.hire.json`,
        );
      });
      emitDraft(templates.getDraft(current.draftId));
      return summary!;
    },
    async chooseExportTarget() {
      const target = await ctx.agentExportPicker.pickTarget();
      if (!target)
        throw new ThreadHelmError('SELECTION_CANCELLED', 'No export target was selected.');
      const targetHandle = randomUUID();
      targets.set(targetHandle, target);
      while (targets.size > 32) targets.delete(targets.keys().next().value!);
      return { targetHandle };
    },
    async previewExport({ completionToken, targetHandle }) {
      const snapshot = completions.take(completionToken);
      const path = targets.get(targetHandle);
      targets.delete(targetHandle);
      if (!snapshot)
        throw new ThreadHelmError('CONFIRMATION_EXPIRED', 'The export review expired or was used.');
      if (snapshot.action !== 'export')
        throw new ThreadHelmError('INVALID_REQUEST', 'This preview is not bound to export.');
      if (
        !path ||
        extname(path).toLocaleLowerCase('en-US') !== '.json' ||
        !path.toLocaleLowerCase('en-US').endsWith('.hire.json')
      )
        throw new ThreadHelmError('INVALID_REQUEST', 'Choose a .hire.json export target.');
      const parent = await realpath(dirname(path)).catch(() => {
        throw new ThreadHelmError('TARGET_CHANGED', 'The export folder is unavailable.');
      });
      const target = await fingerprint(path).catch((error) => {
        if (error instanceof ThreadHelmError) throw error;
        throw new ThreadHelmError('TARGET_CHANGED', 'The export target is unavailable.');
      });
      const current = review(snapshot.draftId, snapshot.version, 'export');
      if (current.digest !== snapshot.digest)
        throw new ThreadHelmError('PROFILE_DIGEST_CHANGED', 'The draft changed after review.');
      const issued = exports.issue({ ...current, path, parent, target });
      return exportView({ ...current, path, parent, target }, issued.token, issued.expiresAt);
    },
    async confirmExport({ exportToken, overwriteConfirmation }) {
      const snapshot = exports.take(exportToken);
      if (!snapshot)
        throw new ThreadHelmError(
          'CONFIRMATION_EXPIRED',
          'The export preview expired or was used.',
        );
      if (snapshot.target.exists && !overwriteConfirmation)
        throw new ThreadHelmError(
          'CONFIRMATION_REQUIRED',
          'Confirm replacement of the existing export file.',
        );
      const current = review(snapshot.draftId, snapshot.version, 'export');
      const parent = await realpath(dirname(snapshot.path)).catch(() => {
        throw new ThreadHelmError('TARGET_CHANGED', 'The export folder changed after review.');
      });
      const target = await fingerprint(snapshot.path).catch((error) => {
        if (error instanceof ThreadHelmError) throw error;
        throw new ThreadHelmError('TARGET_CHANGED', 'The export target changed after review.');
      });
      if (
        current.digest !== snapshot.digest ||
        parent !== snapshot.parent ||
        target.exists !== snapshot.target.exists ||
        target.value !== snapshot.target.value
      )
        throw new ThreadHelmError(
          'TARGET_CHANGED',
          'The draft or export target changed after review.',
        );
      if (repos.agentProfileExports.hasActive(current.draftId))
        throw new ThreadHelmError(
          'INVALID_STATE',
          'An export is already in progress for this draft.',
        );
      const targetKey = `${snapshot.parent}\u0000${basename(snapshot.path).toLocaleLowerCase('en-US')}`;
      if (activeExportTargets.has(targetKey))
        throw new ThreadHelmError(
          'INVALID_STATE',
          'An export is already in progress for this target.',
        );
      activeExportTargets.add(targetKey);
      let exportId: string;
      try {
        exportId = repos.agentProfileExports.begin({
          draftId: current.draftId,
          draftVersion: current.version,
          digest: current.digest,
          targetBasename: basename(snapshot.path),
          targetIdentity: createHash('sha256')
            .update(`${snapshot.parent}|${snapshot.target.value}`)
            .digest('hex'),
          createdAt: ctx.clock().toISOString(),
        });
      } catch (error) {
        activeExportTargets.delete(targetKey);
        throw error;
      }
      const temporary = join(snapshot.parent, `.${basename(snapshot.path)}.${randomUUID()}.tmp`);
      repos.agentProfileExports.markWriting(exportId);
      let replaced = false;
      try {
        if (ctx.agentExportFailureInjector?.consumeBeforeWriteFailure()) {
          throw new ThreadHelmError(
            'STORAGE_UNAVAILABLE',
            'The profile export could not be written.',
          );
        }
        await writeFile(temporary, current.manifestJson, { encoding: 'utf8', flag: 'wx' });
        const currentAfterWrite = review(snapshot.draftId, snapshot.version, 'export');
        const parentAfterWrite = await realpath(dirname(snapshot.path));
        const finalTarget = await fingerprint(snapshot.path);
        if (
          currentAfterWrite.digest !== snapshot.digest ||
          parentAfterWrite !== snapshot.parent ||
          finalTarget.exists !== snapshot.target.exists ||
          finalTarget.value !== snapshot.target.value
        )
          throw new ThreadHelmError(
            'TARGET_CHANGED',
            'The draft or export target changed during replacement.',
          );
        if (!ctx.storage || ctx.health.degraded) {
          throw new ThreadHelmError(
            'STORAGE_UNAVAILABLE',
            'Storage became unavailable before export replacement.',
          );
        }
        if (snapshot.target.exists) await rename(temporary, snapshot.path);
        else {
          try {
            await link(temporary, snapshot.path);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
              throw new ThreadHelmError(
                'TARGET_CHANGED',
                'The export target appeared during replacement.',
              );
            }
            throw error;
          }
          // The destination now exists even if temp cleanup subsequently fails.
          // That outcome is durable-unknown, never a retryable write failure.
          replaced = true;
          if (ctx.agentExportFailureInjector?.consumeTempCleanupFailure()) {
            throw new ThreadHelmError(
              'INTERNAL',
              'The export outcome requires review after replacement.',
            );
          }
          await unlink(temporary);
        }
        if (snapshot.target.exists) replaced = true;
        if (ctx.agentExportFailureInjector?.consumeAfterReplaceFailure()) {
          throw new ThreadHelmError(
            'INTERNAL',
            'The export outcome requires review after replacement.',
          );
        }
      } catch (error) {
        await unlink(temporary).catch(() => undefined);
        if (replaced) repos.agentProfileExports.markUnknown(exportId, ctx.clock().toISOString());
        else
          repos.agentProfileExports.fail(
            exportId,
            error instanceof ThreadHelmError ? error.code : 'EXPORT_WRITE_FAILED',
            ctx.clock().toISOString(),
          );
        activeExportTargets.delete(targetKey);
        if (error instanceof ThreadHelmError) throw error;
        throw new ThreadHelmError(
          'STORAGE_UNAVAILABLE',
          'The profile export could not be written.',
        );
      }
      const completedAt = ctx.clock().toISOString();
      try {
        repos.transaction(() => {
          repos.agentProfileExports.complete(exportId, completedAt);
          templates.completeDraft({
            draftId: current.draftId,
            expectedVersion: current.version,
            completedAt,
          });
        });
      } catch {
        repos.agentProfileExports.markUnknown(exportId, ctx.clock().toISOString());
        activeExportTargets.delete(targetKey);
        throw new ThreadHelmError(
          'INTERNAL',
          'The export outcome requires review after replacement.',
        );
      }
      emitDraft(templates.getDraft(current.draftId));
      activeExportTargets.delete(targetKey);
      return {
        draftId: current.draftId,
        state: 'completed' as const,
        digest: current.digest,
        completedAt,
      };
    },
    deleteDraft({ draftId, version }) {
      if (repos.agentProfileExports.hasActive(draftId))
        throw new ThreadHelmError('INVALID_STATE', 'An export is in progress for this draft.');
      // Deletion scrubs the persisted draft, so retain only the event-safe summary
      // needed to notify other subscribers after the tombstone is written.
      const deleted = templates.getDraft(draftId);
      const deletedAt = ctx.clock().toISOString();
      templates.deleteDraft({
        draftId,
        expectedVersion: version,
        deletedAt,
      });
      ctx.events.emit(
        'agentWizard.changed',
        AgentWizardChangedEvent.parse({
          type: 'agentWizard.changed',
          draftId,
          version: version + 1,
          state: 'deleted',
          currentStep: deleted.currentStep,
          validationIssues: [],
          occurredAt: deletedAt,
        }),
      );
      return {
        draftId,
        state: 'deleted' as const,
        version: version + 1,
        deletedAt,
      };
    },
    listTemplates(request) {
      const page = templates.listTemplates({
        ...(request?.cursor !== undefined ? { cursor: request.cursor } : {}),
        ...(request?.limit !== undefined ? { limit: request.limit } : {}),
        ...(request?.state !== undefined ? { state: request.state } : {}),
      });
      return {
        templates: page.items.map((item) =>
          summaryOf({ ...item, ...templates.getTemplate(item.templateId) }),
        ),
        nextCursor: page.nextCursor,
      };
    },
    getTemplate({ templateId }) {
      return detailTemplate(templates, templateId);
    },
    saveRevision(request) {
      let manifest: HireManifestV1;
      let manifestJson: string;
      let sourceProfileRevisionId: string | null;
      let sourceProfileIsHistorical = false;
      let inheritedVariables: ReturnType<typeof templates.getRevision>['variables'] | undefined;
      if (request.source.kind === 'draft') {
        if (repos.agentProfileExports.hasActive(request.source.draftId))
          throw new ThreadHelmError('INVALID_STATE', 'An export is in progress for this draft.');
        manifest = review(request.source.draftId, request.source.version).manifest;
        const draft = templates.getDraft(request.source.draftId);
        sourceProfileRevisionId = draft.sourceProfileRevisionId;
        sourceProfileIsHistorical = sourceProfileRevisionId !== null;
        if (draft.sourceTemplateRevisionId) {
          const source = templates.getRevision(draft.sourceTemplateRevisionId);
          inheritedVariables = source.variables;
          sourceProfileRevisionId ??= source.sourceProfileRevisionId;
          sourceProfileIsHistorical ||= sourceProfileRevisionId !== null;
          // `review` above validated the literal expansion. Persist the draft's
          // raw scaffold so user edits to a placeholder-bearing field remain a
          // reusable template expression rather than a frozen expanded value.
          manifestJson = canonicalManifest(draft.fieldValues as HireManifestV1);
        } else manifestJson = canonicalManifest(manifest);
      } else {
        const profile = repos.agentProfiles.getDetailByRevision(request.source.profileRevisionId);
        if (
          !profile ||
          profile.currentRevisionId !== request.source.profileRevisionId ||
          profile.state !== 'active' ||
          profile.compatibility !== 'compatible'
        )
          throw new ThreadHelmError(
            'PROFILE_INCOMPATIBLE',
            'The profile source is unavailable or incompatible.',
          );
        manifest = {
          spec: profile.manifestSpec,
          name: profile.displayName,
          description: profile.description,
          provider: profile.requestedProvider,
          model: profile.requestedModel,
          goal: profile.goal,
          capabilities: profile.capabilities,
          isolate: profile.isolateRequested,
          tokenCap: profile.tokenCapRequested,
          author: profile.author,
        };
        manifestJson = canonicalManifest(manifest);
        sourceProfileRevisionId = request.source.profileRevisionId;
      }
      const variables = request.variables?.map((variable) => ({
        name: variable.name,
        type: variable.type,
        maxLength: variable.maxLength,
        ...(variable.defaultValue !== undefined ? { defaultValue: variable.defaultValue } : {}),
      }));
      const effectiveVariables = variables ?? inheritedVariables;
      const saved = templates.saveRevision({
        key: request.key,
        name: request.name,
        manifestJson,
        digest: digest(manifestJson),
        ...(effectiveVariables !== undefined ? { variables: effectiveVariables } : {}),
        ...(sourceProfileRevisionId ? { sourceProfileRevisionId } : {}),
        ...(sourceProfileIsHistorical ? { sourceProfileIsHistorical: true } : {}),
        ...(request.templateId
          ? { templateId: request.templateId, expectedRevisionId: request.revisionId! }
          : {}),
        createdAt: ctx.clock().toISOString(),
      });
      const result = summaryOf({
        ...templates.getTemplate(saved.templateId),
        ...templates.getRevision(saved.revisionId),
      });
      emitTemplate(result);
      return result;
    },
    duplicate(request) {
      const created = templates.duplicate({ ...request, createdAt: ctx.clock().toISOString() });
      const result = summaryOf({
        ...templates.getTemplate(created.templateId),
        ...templates.getRevision(created.revisionId),
      });
      emitTemplate(result);
      return result;
    },
    setEnabled(request) {
      templates.setEnabled({
        templateId: request.templateId,
        expectedRevisionId: request.revisionId,
        enabled: request.enabled,
        updatedAt: ctx.clock().toISOString(),
      });
      const current = templates.getTemplate(request.templateId);
      const revision = templates.getRevision(current.currentRevisionId!);
      const result = summaryOf({ ...current, ...revision });
      emitTemplate(result);
      return result;
    },
    previewDeleteTemplate(request) {
      const current = templates.getTemplate(request.templateId);
      if (current.currentRevisionId !== request.revisionId)
        throw new ThreadHelmError('PROFILE_REVISION_STALE', 'The template changed after review.');
      const revision = templates.getRevision(request.revisionId);
      const snapshot = {
        templateId: request.templateId,
        revisionId: request.revisionId,
        summary: summaryOf({ ...current, ...revision }),
      };
      const issued = deletes.issue(snapshot);
      return deleteView(snapshot, issued.token, issued.expiresAt);
    },
    deleteTemplate({ deleteToken }) {
      const snapshot = deletes.take(deleteToken);
      if (!snapshot)
        throw new ThreadHelmError(
          'CONFIRMATION_EXPIRED',
          'The template deletion preview expired or was used.',
        );
      templates.deleteTemplate({
        templateId: snapshot.templateId,
        expectedRevisionId: snapshot.revisionId,
        deletedAt: ctx.clock().toISOString(),
      });
      const result = AgentTemplateSummaryView.parse({
        ...snapshot.summary,
        state: 'deleted',
        updatedAt: ctx.clock().toISOString(),
      });
      emitTemplate(result);
      return result;
    },
  };
}
