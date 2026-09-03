import { useEffect, useRef, useState } from 'react';
import type {
  MissionDetailView,
  MissionPreviewView,
  OperationResponse,
} from '@threadhelm/contracts';
import { api, call, errorCode } from '../../api.js';
import { useStore } from '../../store.js';
import { reasonLabel } from '../mission-focus/reason-labels.js';
import { MissionEnvelopeDisclosure } from './MissionEnvelopeDisclosure.js';
import { limitsSummary, type Stage } from './composer-fields.js';

type Preview = OperationResponse<'missionComposer.preview'>;
type Profile = OperationResponse<'profiles.list'>['profiles'][number];
type ReviewState = 'loading' | 'ready' | 'incomplete' | 'changed' | 'expired' | 'failed';

export function ReviewStage({
  draftId,
  version,
  isRevision,
  profiles,
  onStarted,
  onGoTo,
  onAnnounce,
}: {
  draftId: string;
  version(): number;
  isRevision: boolean;
  profiles: Profile[];
  onStarted(mission: MissionDetailView): void;
  onGoTo(stage: Stage): void;
  onAnnounce(message: string): void;
}) {
  const { state, actions } = useStore();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<ReviewState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setStatus('loading');
    setError(null);
    setConfirmed(false);
    try {
      const view = await call(api.missionComposer.preview({ draftId, version: version() }));
      setPreview(view);
      const held = view.envelope.bindings.some((b) => b.launchDisposition === 'held');
      setStatus(held ? 'incomplete' : 'ready');
      if (expiry.current) clearTimeout(expiry.current);
      expiry.current = setTimeout(
        () => setStatus('expired'),
        Math.max(0, Date.parse(view.expiresAt) - Date.now()),
      );
    } catch (cause) {
      setPreview(null);
      setError(reasonLabel(errorCode(cause)));
      setStatus('failed');
    }
  };
  useEffect(() => {
    void load();
    return () => {
      if (expiry.current) clearTimeout(expiry.current);
    };
  }, [draftId]);
  useEffect(() => {
    if (preview && preview.draftVersion !== version()) setStatus('changed');
  }, [preview, version, state.missionSequence]);

  const start = async () => {
    if (!preview || !confirmed || busy) return;
    setBusy(true);
    try {
      onStarted(
        await call(
          api.missionComposer.confirm({
            draftId,
            version: version(),
            previewToken: preview.previewToken,
          }),
        ),
      );
    } catch (cause) {
      const code = errorCode(cause);
      setConfirmed(false);
      if (code === 'MISSION_CONFIRMATION_EXPIRED') setStatus('expired');
      else if (code === 'MISSION_DRAFT_STALE' || code === 'MISSION_ENVELOPE_STALE')
        setStatus('changed');
      else {
        setError(reasonLabel(code));
        setStatus('failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const profileName = (id: string) =>
    profiles.find((p) => p.profileId === id)?.displayName ?? 'Profile';
  const held = preview?.envelope.bindings.filter((b) => b.launchDisposition === 'held') ?? [];
  const stageFor = (b: MissionPreviewView['envelope']['bindings'][number]): Stage =>
    b.reasonCode?.startsWith('RUNTIME') || b.reasonCode?.startsWith('PERMISSION')
      ? 'crew'
      : 'access';

  // The one shared live region announces stage entry, not this stage's own
  // async preview outcome — mirror the visible ready/incomplete/changed text
  // into it so a screen-reader user hears the real result, not a constant.
  useEffect(() => {
    if (status === 'ready') {
      onAnnounce('Ready to start. Everything below is exactly what will be pinned.');
    } else if (status === 'incomplete') {
      const reasons = held
        .map((b) => `${b.role} · ${profileName(b.profileId)}: ${reasonLabel(b.reasonCode)}`)
        .join('. ');
      onAnnounce(`Setup incomplete. ${reasons}`);
    } else if (status === 'changed') {
      onAnnounce('Mission changed. The draft moved after this review was prepared.');
    }
  }, [status]);

  return (
    <div className="composer-stage-body">
      {status === 'loading' ? <p>Preparing the exact mission…</p> : null}
      {status === 'ready' ? (
        <p className="composer-state ready">
          <strong>Ready to start.</strong> Everything below is exactly what will be pinned.
        </p>
      ) : null}
      {status === 'incomplete' ? (
        <div className="composer-state held">
          <strong>Setup incomplete.</strong> No substitution or partial start is offered.
          <ul className="list">
            {held.map((b) => (
              <li key={b.bindingId}>
                {b.role} · {profileName(b.profileId)}: {reasonLabel(b.reasonCode)}{' '}
                <button type="button" className="small" onClick={() => onGoTo(stageFor(b))}>
                  Go to {stageFor(b) === 'crew' ? 'crew' : 'access and limits'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {status === 'changed' ? (
        <div className="composer-state changed">
          <strong>Mission changed.</strong> The draft moved after this review was prepared.
          <button type="button" className="small" onClick={() => void load()}>
            Refresh review
          </button>
        </div>
      ) : null}
      {status === 'expired' ? (
        <div className="composer-state expired" role="alert">
          <strong>Approval expired.</strong> {reasonLabel('MISSION_CONFIRMATION_EXPIRED')} Your
          draft is unchanged.
          <button
            type="button"
            className="small"
            onClick={() => {
              actions.setNotice('Approval stale. Review access and limits again.');
              onGoTo('access');
            }}
          >
            Return to access and limits
          </button>
        </div>
      ) : null}
      {status === 'failed' ? (
        <div className="composer-state failed" role="alert">
          <strong>Review could not be prepared.</strong> {error}
          <button type="button" className="small" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : null}

      {preview ? (
        <>
          <section className="composer-card" aria-label="Launch brief">
            <h2>Launch brief</h2>
            <h3>Outcome</h3>
            <p>{preview.envelope.objective}</p>
            <p className="hint">Proof: {preview.envelope.completionEvidence}</p>
            {preview.envelope.exclusions.length ? (
              <p className="hint">Outside this mission: {preview.envelope.exclusions.join('; ')}</p>
            ) : null}
            <h3>Crew</h3>
            <ul className="list">
              {preview.envelope.bindings.map((b) => (
                <li key={b.bindingId}>
                  <strong>{b.role}</strong> · {profileName(b.profileId)}
                  {b.assignment ? ` · ${b.assignment}` : ''}
                  {b.requiredReturnEvidence.length
                    ? ` · brings back ${b.requiredReturnEvidence.join('; ')}`
                    : ''}
                </li>
              ))}
            </ul>
            <h3>Access</h3>
            <ul className="list">
              {preview.envelope.bindings.map((b) => (
                <li key={b.bindingId}>
                  {b.displayPath} · {b.mode}
                  {status === 'expired' ? ' · approval stale' : ''}
                </li>
              ))}
            </ul>
            <h3>Limits</h3>
            <p>{limitsSummary(preview.envelope.bounds)}</p>
            <h3>Stop and approval behavior</h3>
            <p>
              Work stops for consequential actions, unknown outcomes, exhausted limits, and loss of
              the supervisor. Routine actions allowed:{' '}
              {preview.envelope.permittedRoutineActions.join(', ')}.
            </p>
            <p className="notice">{preview.boundaryWarning}</p>
          </section>
          <details className="composer-card" open>
            <summary>Exact mission authority</summary>
            <MissionEnvelopeDisclosure preview={preview} />
          </details>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={status !== 'ready' || busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I reviewed this exact mission authority
          </label>
          <div className="mission-action-row">
            <button
              type="button"
              className="primary"
              disabled={status !== 'ready' || !confirmed || busy || state.storageDegraded}
              onClick={() => void start()}
            >
              {isRevision ? 'Apply revision' : 'Start mission'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
