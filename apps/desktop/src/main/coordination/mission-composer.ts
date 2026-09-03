import {
  MissionComposerChangedEvent,
  MissionComposerDraftDetailView,
  MissionComposerDraftSummaryView,
  MissionComposerFields,
  MissionEnvelopeInput,
  ThreadHelmError,
  TOKEN_TTL_MS,
  type MissionComposerStage,
  type OperationRequest,
  type OperationResponse,
} from '@threadhelm/contracts';
import type { Context } from '../context.js';
import { TokenStore } from '../tokens.js';
import type { SupervisorService } from './supervisor.js';

export interface MissionComposerService {
  createDraft(
    request: OperationRequest<'missionComposer.createDraft'>,
  ): OperationResponse<'missionComposer.createDraft'>;
  listDrafts(
    request: OperationRequest<'missionComposer.listDrafts'>,
  ): OperationResponse<'missionComposer.listDrafts'>;
  getDraft(
    request: OperationRequest<'missionComposer.getDraft'>,
  ): OperationResponse<'missionComposer.getDraft'>;
  updateDraft(
    request: OperationRequest<'missionComposer.updateDraft'>,
  ): OperationResponse<'missionComposer.updateDraft'>;
  preview(
    request: OperationRequest<'missionComposer.preview'>,
  ): Promise<OperationResponse<'missionComposer.preview'>>;
  confirm(
    request: OperationRequest<'missionComposer.confirm'>,
  ): Promise<OperationResponse<'missionComposer.confirm'>>;
  previewDiscard(
    request: OperationRequest<'missionComposer.previewDiscard'>,
  ): OperationResponse<'missionComposer.previewDiscard'>;
  confirmDiscard(
    request: OperationRequest<'missionComposer.confirmDiscard'>,
  ): OperationResponse<'missionComposer.confirmDiscard'>;
}

/** Turns a partial draft into an exact envelope or names every missing path. */
function envelopeOf(fields: MissionComposerFields): MissionEnvelopeInput {
  const parsed = MissionEnvelopeInput.safeParse(fields);
  if (parsed.success) return parsed.data;
  const paths = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
  throw new ThreadHelmError('INVALID_REQUEST', 'The draft is not complete.', {
    paths: paths.join(','),
  });
}

export function createMissionComposerService(
  ctx: Context,
  supervisor: SupervisorService,
): MissionComposerService {
  const repo = () => {
    if (!ctx.storage || ctx.health.degraded)
      throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Mission draft storage is unavailable.');
    return ctx.storage.repositories;
  };
  const now = () => ctx.clock().toISOString();
  const discards = new TokenStore<{ draftId: string; version: number }>(TOKEN_TTL_MS, () =>
    ctx.clock().getTime(),
  );
  /** Preview issue per draft; confirm checks it before touching the supervisor token. */
  const previews = new Map<string, { version: number; expiresAt: number; revision: boolean }>();
  const detail = (draftId: string) =>
    MissionComposerDraftDetailView.parse(repo().missionComposer.getDraft(draftId));
  const emit = (draftId: string) => {
    const draft = repo().missionComposer.getDraft(draftId);
    ctx.events.emit(
      'missionComposer.changed',
      MissionComposerChangedEvent.parse({
        type: 'missionComposer.changed',
        draftId,
        version: draft.version,
        state: draft.state,
        currentStage: draft.currentStage,
        occurredAt: now(),
      }),
    );
  };

  return {
    createDraft(request) {
      const source = request?.sourceMissionId ?? null;
      let fieldValues: MissionComposerFields = {};
      let currentStage: MissionComposerStage = 'outcome';
      if (source) {
        const mission = repo().supervisor.detail(source);
        if (!mission.input) throw new ThreadHelmError('MISSION_NOT_FOUND');
        fieldValues = MissionComposerFields.parse(mission.input);
        currentStage = 'review';
      }
      const { draftId } = repo().missionComposer.createDraft({
        sourceMissionId: source,
        fieldValues,
        currentStage,
        createdAt: now(),
      });
      emit(draftId);
      return detail(draftId);
    },
    listDrafts(request) {
      return {
        drafts: repo()
          .missionComposer.listDrafts(request?.limit ?? 20)
          .map((item) => MissionComposerDraftSummaryView.parse(item)),
      };
    },
    getDraft({ draftId }) {
      return detail(draftId);
    },
    updateDraft(request) {
      const complete = MissionEnvelopeInput.safeParse(request.fieldValues).success;
      let version: number;
      try {
        version = repo().missionComposer.updateDraft({
          draftId: request.draftId,
          expectedVersion: request.expectedVersion,
          fieldValues: request.fieldValues,
          currentStage: request.currentStage,
          issueCodes: [],
          state: complete && request.currentStage === 'review' ? 'ready_for_review' : 'editing',
          updatedAt: now(),
        }).version;
      } catch (error) {
        if (error instanceof ThreadHelmError) throw error;
        throw new ThreadHelmError('MISSION_DRAFT_SAVE_FAILED', 'The draft could not be saved.');
      }
      previews.delete(request.draftId);
      emit(request.draftId);
      return {
        draftId: request.draftId,
        version,
        savedAt: now(),
        currentStage: request.currentStage,
      };
    },
    async preview({ draftId, version }) {
      const draft = repo().missionComposer.getDraft(draftId);
      if (draft.version !== version) throw new ThreadHelmError('MISSION_DRAFT_STALE');
      const envelope = envelopeOf(draft.fieldValues);
      const revision = draft.sourceMissionId !== null;
      const view = await supervisor.preview(
        revision
          ? {
              missionId: draft.sourceMissionId!,
              expectedVersion: repo().supervisor.mission(draft.sourceMissionId!).version,
              envelope,
            }
          : { envelope },
      );
      previews.set(draftId, { version, expiresAt: Date.parse(view.expiresAt), revision });
      return { ...view, draftVersion: version };
    },
    async confirm({ draftId, version, previewToken }) {
      const draft = repo().missionComposer.getDraft(draftId);
      const issued = previews.get(draftId);
      if (draft.version !== version || !issued || issued.version !== version)
        throw new ThreadHelmError(
          'MISSION_DRAFT_STALE',
          'Review the mission again before starting.',
        );
      if (issued.expiresAt <= ctx.clock().getTime()) {
        previews.delete(draftId);
        throw new ThreadHelmError(
          'MISSION_CONFIRMATION_EXPIRED',
          'The review expired. Return to access and limits for a fresh approval.',
        );
      }
      const mission = await supervisor.confirm(
        { previewToken, boundaryConfirmation: true },
        issued.revision,
      );
      previews.delete(draftId);
      // ponytail: mission commit then draft mark; a crash between leaves an open draft, never a lost mission.
      repo().missionComposer.markConverted({
        draftId,
        expectedVersion: version,
        missionId: mission.id,
        convertedAt: now(),
      });
      emit(draftId);
      return mission;
    },
    previewDiscard({ draftId, version }) {
      const draft = repo().missionComposer.getDraft(draftId);
      if (draft.version !== version) throw new ThreadHelmError('MISSION_DRAFT_DISCARD_STALE');
      const issued = discards.issue({ draftId, version });
      return {
        discardToken: issued.token,
        currentStage: draft.currentStage,
        expiresAt: issued.expiresAt,
      };
    },
    confirmDiscard({ draftId, version, discardToken }) {
      const payload = discards.take(discardToken);
      if (!payload || payload.draftId !== draftId || payload.version !== version)
        throw new ThreadHelmError('MISSION_DRAFT_DISCARD_STALE', 'Preview the discard again.');
      const deletedAt = now();
      try {
        repo().missionComposer.deleteDraft({ draftId, expectedVersion: version, deletedAt });
      } catch (error) {
        if (error instanceof ThreadHelmError && error.code === 'MISSION_DRAFT_STALE')
          throw new ThreadHelmError('MISSION_DRAFT_DISCARD_STALE', 'Preview the discard again.');
        throw error;
      }
      ctx.events.emit(
        'missionComposer.changed',
        MissionComposerChangedEvent.parse({
          type: 'missionComposer.changed',
          draftId,
          version: version + 1,
          state: 'deleted',
          currentStage: 'outcome',
          occurredAt: deletedAt,
        }),
      );
      return { draftId, state: 'deleted' as const, version: version + 1, deletedAt };
    },
  };
}
