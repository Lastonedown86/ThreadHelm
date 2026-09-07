import { randomUUID } from 'node:crypto';
import {
  ThreadHelmError,
  MissionRecipeContent,
  type MissionRecipeEditor,
  type MissionRecipeReceipt,
  TOKEN_TTL_MS,
  type MissionRecipeExpanded,
  type MissionRecipeReference,
  type OperationRequest,
  type OperationResponse,
} from '@threadhelm/contracts';
import { expandMissionRecipe, MISSION_RECIPE_STARTERS } from '@threadhelm/domain';
import { recipeDigest, recipeFailure } from '@threadhelm/persistence';
import { extractRecipeSource } from './mission-recipe-source.js';
import type { Context } from '../context.js';

type Dependencies = Pick<Context, 'storage' | 'health' | 'clock' | 'events'>;
interface Preview {
  reference: MissionRecipeReference;
  expanded: MissionRecipeExpanded;
  projection: { objective: string; completionEvidence: string };
  expiresAt: number;
}

/** No launch, supervisor, filesystem, provider or network dependency. */
export function createMissionRecipeService(ctx: Dependencies) {
  type SourcePreview = {
    source: NonNullable<MissionRecipeEditor['source']>;
    content: MissionRecipeEditor['content'];
    expiresAt: number;
  };
  type SavePreview = { editorId: string; version: number; expiresAt: number };
  type DeletePreview = { reference: MissionRecipeReference; expiresAt: number };
  const sourcePreviews = new Map<string, SourcePreview>();
  const savePreviews = new Map<string, SavePreview>();
  const deletePreviews = new Map<string, DeletePreview>();
  function token<T extends { expiresAt: number }>(
    map: Map<string, T>,
    value: Omit<T, 'expiresAt'>,
  ): string {
    for (const [id, entry] of map) if (entry.expiresAt <= ctx.clock().getTime()) map.delete(id);
    while (map.size >= 32) map.delete(map.keys().next().value!);
    const id = randomUUID();
    map.set(id, { ...value, expiresAt: ctx.clock().getTime() + TOKEN_TTL_MS } as T);
    return id;
  }
  function take<T extends { expiresAt: number }>(map: Map<string, T>, id: string): T {
    const entry = map.get(id);
    map.delete(id);
    if (!entry || entry.expiresAt <= ctx.clock().getTime()) recipeFailure('STALE_PREVIEW');
    return entry;
  }
  const previews = new Map<string, Preview>();
  const now = () => ctx.clock().toISOString();
  const repo = () => {
    if (!ctx.storage || ctx.health.degraded) throw new ThreadHelmError('STORAGE_UNAVAILABLE');
    return ctx.storage.repositories.missionRecipes;
  };
  if (ctx.storage && !ctx.health.degraded) {
    for (const starter of MISSION_RECIPE_STARTERS) repo().seedBundled(starter, now());
  }
  function changed(receipt: MissionRecipeReceipt): MissionRecipeReceipt {
    if (receipt.kind !== 'createDraft')
      ctx.events.emit('missionRecipes.changed', {
        type: 'missionRecipes.changed',
        recipeId: receipt.targetId,
        version: receipt.version,
        kind: receipt.kind,
        occurredAt: receipt.savedAt,
      });
    return receipt;
  }
  function copy(
    request: OperationRequest<'missionRecipes.edit'>,
    mode: 'edit' | 'duplicate',
  ): MissionRecipeEditor {
    const base = {
      recipeId: request.recipeId,
      revisionId: request.revisionId,
      version: request.expectedVersion,
    };
    const current = repo().assertCurrent(base, mode === 'edit');
    return repo().openEditor({ mode, base, source: null, content: current.content!, now: now() });
  }
  return {
    previewSource(request: OperationRequest<'missionRecipes.previewSource'>) {
      const content = extractRecipeSource(repo(), request);
      return { previewId: token(sourcePreviews, { source: request.source, content }), content };
    },
    openEditor(request: OperationRequest<'missionRecipes.openEditor'>) {
      if (request?.content && !request.sourcePreviewId) recipeFailure('INVALID_RECIPE');
      const source = request?.sourcePreviewId
        ? take(sourcePreviews, request.sourcePreviewId)
        : null;
      if (source) repo().sourceContent(source.source);
      return repo().openEditor({
        mode: source ? 'save-source' : 'create',
        base: null,
        source: source?.source ?? null,
        content: request?.content ??
          source?.content ?? {
            name: '',
            description: '',
            outcomeScaffold: '',
            acceptanceChecklist: [],
            suggestedRoles: [],
            variables: [],
          },
        now: now(),
      });
    },
    getEditor(request: OperationRequest<'missionRecipes.getEditor'>) {
      return repo().getEditor(request.editorId);
    },
    listEditors(request: OperationRequest<'missionRecipes.listEditors'>) {
      return repo().listEditors(request?.cursor ?? null);
    },
    saveEditor(request: OperationRequest<'missionRecipes.saveEditor'>) {
      return repo().saveEditor(request.editorId, request.expectedVersion, request.content, now());
    },
    detachSource(request: OperationRequest<'missionRecipes.detachSource'>) {
      return repo().detachSource(request.editorId, request.expectedVersion, now());
    },
    discardEditor(request: OperationRequest<'missionRecipes.discardEditor'>) {
      repo().discardEditor(request.editorId, request.expectedVersion);
      return { discarded: true as const };
    },
    previewSave(request: OperationRequest<'missionRecipes.previewSave'>) {
      const editor = repo().validateEditor(request.editorId, request.expectedVersion);
      const result = MissionRecipeContent.safeParse(editor.content);
      if (!result.success) recipeFailure('INVALID_RECIPE');
      const expanded = expandMissionRecipe(
        result.data,
        Object.fromEntries(result.data.variables.map((v) => [v.key, v.required ? 'value' : ''])),
      );
      if (expanded.issues.some((issue) => issue.code !== 'COMPOSER_LIMIT'))
        recipeFailure('INVALID_RECIPE');
      return {
        previewId: token(savePreviews, { editorId: editor.editorId, version: editor.version }),
        content: result.data,
      };
    },
    save(request: OperationRequest<'missionRecipes.save'>) {
      const requestDigest = recipeDigest({ kind: 'save', previewId: request.previewId });
      const previous = repo().getReceipt(request.requestId, requestDigest);
      if (previous) return previous;
      const preview = take(savePreviews, request.previewId);
      return changed(
        repo().save({
          editorId: preview.editorId,
          expectedVersion: preview.version,
          requestId: request.requestId,
          requestDigest,
          now: now(),
        }),
      );
    },
    edit(request: OperationRequest<'missionRecipes.edit'>) {
      return copy(request, 'edit');
    },
    duplicate(request: OperationRequest<'missionRecipes.duplicate'>) {
      return copy(request, 'duplicate');
    },
    setEnabled(request: OperationRequest<'missionRecipes.setEnabled'>) {
      return changed(
        repo().setEnabled({
          ...request,
          requestDigest: recipeDigest({
            kind: 'setEnabled',
            recipeId: request.recipeId,
            expectedVersion: request.expectedVersion,
            enabled: request.enabled,
          }),
          now: now(),
        }),
      );
    },
    previewDelete(request: OperationRequest<'missionRecipes.previewDelete'>) {
      const current = repo().get(request.recipeId);
      const reference = {
        recipeId: current.recipeId,
        revisionId: current.revisionId,
        version: request.expectedVersion,
      };
      repo().assertCurrent(reference, true);
      return {
        previewId: token(deletePreviews, { reference }),
        recipeId: current.recipeId,
        version: current.version,
        name: current.name,
      };
    },
    delete(request: OperationRequest<'missionRecipes.delete'>) {
      const requestDigest = recipeDigest({ kind: 'delete', previewId: request.previewId });
      const previous = repo().getReceipt(request.requestId, requestDigest);
      if (previous) return previous;
      const preview = take(deletePreviews, request.previewId);
      return changed(
        repo().delete({
          reference: preview.reference,
          requestId: request.requestId,
          requestDigest,
          now: now(),
        }),
      );
    },
    list(
      request: OperationRequest<'missionRecipes.list'>,
    ): OperationResponse<'missionRecipes.list'> {
      return repo().list(request);
    },
    get({
      recipeId,
    }: OperationRequest<'missionRecipes.get'>): OperationResponse<'missionRecipes.get'> {
      return repo().get(recipeId);
    },
    preview(
      request: OperationRequest<'missionRecipes.preview'>,
    ): OperationResponse<'missionRecipes.preview'> {
      const reference = {
        recipeId: request.recipeId,
        revisionId: request.revisionId,
        version: request.expectedVersion,
      };
      const recipe = repo().assertAvailable(reference);
      const result = expandMissionRecipe(recipe.content, request.values);
      const clock = ctx.clock().getTime();
      for (const [id, entry] of previews) if (entry.expiresAt <= clock) previews.delete(id);
      // One selected source preview per renderer view plus a small bounded multi-view cache.
      while (previews.size >= 32) previews.delete(previews.keys().next().value!);
      let previewId: string | null = null;
      if (!result.issues.length && result.expanded && result.projection) {
        previewId = randomUUID();
        previews.set(previewId, {
          reference,
          expanded: result.expanded,
          projection: result.projection,
          expiresAt: clock + TOKEN_TTL_MS,
        });
      }
      return { ...reference, ...result, previewId };
    },
    createDraft(
      request: OperationRequest<'missionRecipes.createDraft'>,
    ): OperationResponse<'missionRecipes.createDraft'> {
      const requestDigest = recipeDigest({ kind: 'createDraft', previewId: request.previewId });
      const previous = repo().getReceipt(request.requestId, requestDigest);
      if (previous) return previous;
      const preview = previews.get(request.previewId);
      previews.delete(request.previewId);
      if (!preview || preview.expiresAt <= ctx.clock().getTime()) recipeFailure('STALE_PREVIEW');
      const receipt = repo().createDraft({
        ...preview,
        requestId: request.requestId,
        requestDigest,
        now: now(),
      });
      ctx.events.emit('missionComposer.changed', {
        type: 'missionComposer.changed',
        draftId: receipt.targetId,
        version: receipt.version,
        state: 'editing',
        currentStage: 'outcome',
        occurredAt: receipt.savedAt,
      });
      return receipt;
    },
  };
}
