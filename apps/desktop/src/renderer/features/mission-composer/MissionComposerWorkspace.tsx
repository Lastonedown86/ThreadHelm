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
} from './composer-fields.js';
import { DraftBanner } from './DraftBanner.js';
import { OutcomeStage } from './OutcomeStage.js';
import { useDraft } from './useDraft.js';

type Profile = OperationResponse<'profiles.list'>['profiles'][number];
type Eligible = OperationResponse<'missions.eligibleSessions'>[number];

export function MissionComposerWorkspace({
  draftId,
  onClose,
  // Wired for Task 9, which mounts the Review stage and calls it after confirm.
  onStarted: _onStarted,
}: {
  draftId: string;
  onClose(): void;
  onStarted(mission: MissionDetailView): void;
}) {
  const { state, actions } = useStore();
  const draft = useDraft(draftId);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const [closing, setClosing] = useState<{ savedAt: string; stage: Stage } | null>(null);
  const [discarding, setDiscarding] = useState<{ token: string; stage: Stage } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [invalid, setInvalid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
      .catch((cause) => !cancelled && setLoadError(cause));
    return () => {
      cancelled = true;
    };
  }, [state.profilesSequence, state.missionSequence]);

  const stage = draft.stage;
  const index = STAGES.indexOf(stage);
  const context = { hasProfiles: profiles.length > 0, hasEligibleSessions: eligible.length > 0 };
  const readiness = useMemo(
    () => stageReadiness(stage, draft.fields, context),
    [stage, draft.fields, context.hasProfiles, context.hasEligibleSessions],
  );

  useEffect(() => {
    heading.current?.focus();
    setAnnouncement(`Step ${index + 1} of 4, ${STAGE_LABEL[stage]}`);
    setInvalid(null);
  }, [stage, index]);
  useEffect(() => {
    if (draft.receipt) setAnnouncement('Draft saved');
  }, [draft.receipt]);

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
    if (saved) setClosing({ savedAt: saved.savedAt, stage: saved.currentStage });
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
        <p className="eyebrow">Mission draft · saved</p>
        <h1 id="composer-receipt-heading" tabIndex={-1} ref={heading}>
          Your mission draft is saved locally.
        </h1>
        <dl className="composer-receipt-grid">
          <div>
            <dt>Saved</dt>
            <dd>{new Date(closing.savedAt).toLocaleTimeString()}</dd>
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
        <p>A draft is not mission authority. Nothing was launched or granted access.</p>
        <div className="mission-action-row">
          <button type="button" onClick={() => setClosing(null)}>
            Keep editing
          </button>
          <button type="button" className="primary" onClick={onClose}>
            Close composer
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
        {STAGES.map((item, i) => (
          <li
            key={item}
            aria-current={item === stage ? 'step' : undefined}
            data-done={i < index || undefined}
          >
            {i < index ? (
              <button type="button" className="small" onClick={() => void draft.goTo(item)}>
                {STAGE_LABEL[item]}
              </button>
            ) : (
              <span>{STAGE_LABEL[item]}</span>
            )}
          </li>
        ))}
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
        {/* Task 7 mounts CrewStage and AccessStage; Task 9 mounts ReviewStage. */}
      </div>
      <p className={`composer-readiness${readiness.ready ? ' ready' : ''}`} role="status">
        {readiness.message}
      </p>
      <div className="mission-action-row composer-actions">
        <button type="button" onClick={() => void close()} disabled={blocked || draft.saving}>
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
