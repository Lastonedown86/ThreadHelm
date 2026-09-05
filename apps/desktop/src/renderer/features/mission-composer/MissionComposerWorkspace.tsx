import { useEffect, useMemo, useRef, useState } from 'react';
import type { MissionDetailView, OperationResponse } from '@threadhelm/contracts';
import { api, call, errorCode } from '../../api.js';
import { useStore } from '../../store.js';
import { reasonLabel } from '../mission-focus/reason-labels.js';
import {
  CONTINUE_LABEL,
  STAGES,
  STAGE_HEADING,
  STAGE_LABEL,
  stageReadiness,
  type Stage,
  type WorkerFields,
} from './composer-fields.js';
import { AccessStage } from './AccessStage.js';
import { CrewStage } from './CrewStage.js';
import { DraftBanner } from './DraftBanner.js';
import { OutcomeStage } from './OutcomeStage.js';
import { ReviewStage } from './ReviewStage.js';
import { useDraft } from './useDraft.js';

type Profile = OperationResponse<'profiles.list'>['profiles'][number];
type Eligible = OperationResponse<'missions.eligibleSessions'>[number];

export function MissionComposerWorkspace({
  draftId,
  onClose,
  onStarted,
  onState,
  onFlushReady,
}: {
  draftId: string;
  onClose(): void;
  onStarted(mission: MissionDetailView): void;
  onState?(state: { stage: Stage; workers: WorkerFields[] }): void;
  /**
   * Hands the caller a flush function while this workspace is mounted, and
   * `null` once it unmounts. The caller (App.tsx) awaits this before
   * completing a rail/destination switch, so an in-flight or pending
   * autosave is never silently dropped by the unmount that follows.
   */
  onFlushReady?(flush: (() => Promise<boolean>) | null): void;
}) {
  const { state, actions } = useStore();
  const draft = useDraft(draftId);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const [closing, setClosing] = useState<{
    savedAt: string | null;
    stage: Stage;
    unsaved: boolean;
  } | null>(null);
  const [discarding, setDiscarding] = useState<{ token: string; stage: Stage } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [everReviewed, setEverReviewed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      call(api.profiles.list({ state: 'active', limit: 100 })),
      call(api.missions.eligibleSessions(undefined)),
    ])
      .then(([roster, sessions]) => {
        if (cancelled) return;
        setProfiles(roster.profiles);
        setEligible(sessions);
        setLoadError(null);
      })
      .catch((cause) => !cancelled && setLoadError(cause))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [state.profilesSequence, state.missionSequence, reload]);

  const stage = draft.stage;
  // Stabilized: draft.fields.workers ?? [] would allocate a fresh array
  // reference every render when workers is undefined (a new draft), and the
  // effect below depends on `workers` — an ever-changing dependency refires
  // the effect every render, which calls onState and re-renders, forever.
  const workers = useMemo(() => draft.fields.workers ?? [], [draft.fields.workers]);
  const index = STAGES.indexOf(stage);
  const context = { hasProfiles: profiles.length > 0, hasEligibleSessions: eligible.length > 0 };
  const readiness = useMemo(
    () => stageReadiness(stage, draft.fields, context),
    [stage, draft.fields, context.hasProfiles, context.hasEligibleSessions],
  );

  useEffect(() => {
    heading.current?.focus();
    setInvalid(null);
  }, [stage, index]);
  useEffect(() => {
    if (stage === 'review' || draft.draft?.state === 'ready_for_review') setEverReviewed(true);
  }, [stage, draft.draft]);
  // One live region for the whole composer: step entry and readiness changes
  // both flow through this announcement instead of a second aria-live source.
  useEffect(() => {
    setAnnouncement(`Step ${index + 1} of 4, ${STAGE_LABEL[stage]}. ${readiness.message}`);
  }, [stage, index, readiness.message]);
  useEffect(() => {
    if (draft.receipt) setAnnouncement('Draft saved');
  }, [draft.receipt]);
  useEffect(() => {
    onState?.({ stage, workers });
  }, [stage, workers]);
  useEffect(() => {
    onFlushReady?.(async () => (await draft.saveNow()) !== null);
    return () => onFlushReady?.(null);
  }, [draft.saveNow, onFlushReady]);

  const blocked = state.storageDegraded || draft.failure !== null;
  const isRevision = draft.draft?.sourceMissionId !== null && draft.draft !== null;

  const focusInvalid = (path: string | null) => {
    setInvalid(path);
    if (!path) return;
    requestAnimationFrame(() => {
      body.current?.querySelector<HTMLElement>(`[data-field="${path}"]`)?.focus();
    });
  };
  const advance = async () => {
    if (!readiness.ready) return focusInvalid(readiness.firstInvalid);
    const next = STAGES[index + 1];
    if (next) await draft.goTo(next);
  };
  const back = async () => {
    const prev = STAGES[index - 1];
    if (prev) await draft.goTo(prev);
  };
  const close = async () => {
    const saved = await draft.saveNow();
    // Close must never be a trap: if the draft cannot be saved right now
    // (storage degraded, or a prior save failure), closing still proceeds —
    // it is just honest that the latest edits were not saved.
    if (saved) setClosing({ savedAt: saved.savedAt, stage: saved.currentStage, unsaved: false });
    else setClosing({ savedAt: null, stage, unsaved: true });
  };
  const startDiscard = async () => {
    try {
      const preview = await call(
        api.missionComposer.previewDiscard({ draftId, version: draft.version() }),
      );
      setDiscarding({ token: preview.discardToken, stage: preview.currentStage });
    } catch (cause) {
      actions.setNotice(reasonLabel(errorCode(cause)) ?? 'The discard could not be prepared.');
    }
  };
  const confirmDiscard = async () => {
    if (!discarding) return;
    try {
      await call(
        api.missionComposer.confirmDiscard({
          draftId,
          version: draft.version(),
          discardToken: discarding.token,
        }),
      );
      onClose();
    } catch (cause) {
      setDiscarding(null);
      actions.setNotice(reasonLabel(errorCode(cause)) ?? 'The draft was not discarded.');
    }
  };

  if (closing)
    return (
      <section className="composer-receipt" aria-labelledby="composer-receipt-heading">
        <p className="eyebrow">
          {closing.unsaved ? 'Mission draft · not saved' : 'Mission draft · saved'}
        </p>
        <h1 id="composer-receipt-heading" tabIndex={-1} ref={heading}>
          {closing.unsaved
            ? 'Your latest edits could not be saved.'
            : 'Your mission draft is saved locally.'}
        </h1>
        <dl className="composer-receipt-grid">
          <div>
            <dt>Saved</dt>
            <dd>
              {closing.savedAt ? new Date(closing.savedAt).toLocaleTimeString() : 'Not saved'}
            </dd>
          </div>
          <div>
            <dt>Resume point</dt>
            <dd>{STAGE_LABEL[closing.stage]}</dd>
          </div>
          <div>
            <dt>Still off</dt>
            <dd>Still off: access, permissions, launch</dd>
          </div>
        </dl>
        {closing.unsaved ? (
          <p>
            This draft&rsquo;s most recent edits were not saved. Closing now will leave them out of
            the saved draft.
          </p>
        ) : (
          <p>A draft is not mission authority. Nothing was launched or granted access.</p>
        )}
        <div className="mission-action-row">
          <button type="button" onClick={() => setClosing(null)}>
            Keep editing
          </button>
          <button type="button" className="primary" onClick={onClose}>
            {closing.unsaved ? 'Close without saving' : 'Close composer'}
          </button>
        </div>
      </section>
    );

  return (
    <section className="composer" aria-labelledby="composer-heading">
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <DraftBanner
        failure={draft.failure}
        storageDegraded={state.storageDegraded}
        onRetry={() => void draft.retry()}
        onKeepEditing={() => setAnnouncement('Keep editing. Nothing was discarded.')}
        onDiscard={() => void startDiscard()}
        onUseSaved={draft.useSavedVersion}
        onKeepMine={draft.keepMyEdits}
      />
      <ol className="composer-strip" aria-label="Mission stages">
        {STAGES.map((item, i) => {
          const canJump =
            item !== stage && (i < index || everReviewed || Boolean(draft.draft?.sourceMissionId));
          return (
            <li
              key={item}
              aria-current={item === stage ? 'step' : undefined}
              data-done={i < index || undefined}
            >
              {canJump ? (
                <button type="button" className="small" onClick={() => void draft.goTo(item)}>
                  {STAGE_LABEL[item]}
                </button>
              ) : (
                <span>{STAGE_LABEL[item]}</span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="eyebrow">
        Step {index + 1} of 4 · {STAGE_LABEL[stage]}
        {isRevision ? ' · Revise mission' : ''}
      </p>
      <h1 id="composer-heading" tabIndex={-1} ref={heading}>
        {STAGE_HEADING[stage]}
      </h1>
      {loadError ? <p className="notice">{reasonLabel(errorCode(loadError))}</p> : null}
      <div ref={body}>
        {stage === 'outcome' ? (
          <OutcomeStage fields={draft.fields} setFields={draft.setFields} invalid={invalid} />
        ) : null}
        {stage === 'crew' ? (
          <CrewStage
            fields={draft.fields}
            setFields={draft.setFields}
            invalid={invalid}
            profiles={profiles}
            eligible={eligible}
            workspaces={state.workspaces}
            loading={loading}
            loadError={loadError !== null}
            onCreateAgent={() =>
              void draft.saveNow().then((s) => {
                if (!s) return;
                actions.selectDestination('agents');
                onClose();
              })
            }
            onLaunchSession={() => {
              const workspace = state.workspaces.find((w) => !w.revokedAt);
              void draft.saveNow().then((s) => {
                if (!s) return;
                if (workspace) {
                  actions.openLaunch({ workspaceId: workspace.id, providerId: 'codex-cli' });
                } else {
                  actions.selectDestination('settings');
                  onClose();
                }
              });
            }}
            onRetryLoad={() => setReload((n) => n + 1)}
          />
        ) : null}
        {stage === 'access' ? (
          <AccessStage
            fields={draft.fields}
            setFields={draft.setFields}
            invalid={invalid}
            workspaces={state.workspaces}
            readiness={state.readiness}
            eligible={eligible}
            providersInUse={[
              ...new Set([
                ...eligible
                  .filter((s) => s.sessionId === draft.fields.supervisor?.sessionId)
                  .map((s) => s.providerId),
                ...(draft.fields.workers ?? []).map((w) => {
                  const requested = profiles.find(
                    (p) => p.profileId === w.profileId,
                  )?.requestedProvider;
                  return requested === 'codex' || requested === 'codex-cli'
                    ? ('codex-cli' as const)
                    : ('claude-code' as const);
                }),
              ]),
            ]}
          />
        ) : null}
        {stage === 'review' ? (
          <ReviewStage
            draftId={draftId}
            version={draft.version}
            isRevision={isRevision}
            profiles={profiles}
            onStarted={onStarted}
            onGoTo={(target) => void draft.goTo(target)}
            onAnnounce={setAnnouncement}
          />
        ) : null}
      </div>
      <p className={`composer-readiness${readiness.ready ? ' ready' : ''}`}>{readiness.message}</p>
      <div className="mission-action-row composer-actions">
        {/* Close is never gated on a successful save: a draft that can't be
            saved right now (storage degraded, prior save failure) must still
            have an escape hatch — see close()'s honest "not saved" receipt. */}
        <button type="button" onClick={() => void close()} disabled={draft.saving}>
          Close
        </button>
        {index > 0 ? (
          <button type="button" onClick={() => void back()} disabled={draft.saving}>
            Back
          </button>
        ) : null}
        {stage !== 'review' ? (
          <button
            type="button"
            className="primary"
            disabled={!readiness.ready || blocked || draft.saving}
            onClick={() => void advance()}
          >
            {CONTINUE_LABEL[stage]}
          </button>
        ) : null}
      </div>
      {discarding ? (
        <div className="composer-discard" role="dialog" aria-labelledby="composer-discard-heading">
          <h2 id="composer-discard-heading">Discard this draft?</h2>
          <p>
            The draft at {STAGE_LABEL[discarding.stage]} will be deleted. Nothing else changes; no
            mission exists yet.
          </p>
          <div className="mission-action-row">
            <button type="button" onClick={() => setDiscarding(null)}>
              Keep draft
            </button>
            <button type="button" className="danger" onClick={() => void confirmDiscard()}>
              Discard draft
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
