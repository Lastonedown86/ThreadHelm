import { useEffect, useState } from 'react';
import type {
  DeleteContentDisclosureView,
  DeliveryAttemptView,
  HandoffSummaryView,
  PresentationDisclosureView,
  RetargetDisclosureView,
  SessionView,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { Modal } from '../control/Modal.js';
import { LaunchError } from '../launch/LaunchErrors.js';

function label(session: SessionView | undefined): string {
  return session
    ? `${session.providerDisplayName} · ${session.workspaceDisplayPath} · ${session.id.slice(0, 8)}`
    : 'Session unavailable';
}

export function PresentationDialog({
  handoff,
  sessions,
  onComplete,
  onCancel,
}: {
  handoff: HandoffSummaryView;
  sessions: Record<string, SessionView>;
  onComplete: (attempt: DeliveryAttemptView) => void;
  onCancel: () => void;
}) {
  const [disclosure, setDisclosure] = useState<PresentationDisclosureView | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    call(api.coordination.requestPresentation({ handoffId: handoff.id }))
      .then((value) => active && setDisclosure(value))
      .catch((reason: unknown) => active && setError(reason));
    return () => {
      active = false;
    };
  }, [handoff.id]);

  const present = async () => {
    if (!disclosure) return;
    setBusy(true);
    setError(null);
    try {
      onComplete(
        await call(
          api.coordination.confirmPresentation({
            presentationToken: disclosure.presentationToken,
            submitConfirmation: true,
          }),
        ),
      );
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Modal title="Review manual presentation" onCancel={onCancel} describedBy="presentation-risk">
      {disclosure ? (
        <>
          <dl className="facts">
            <dt>Exact recipient</dt>
            <dd>{label(sessions[disclosure.recipientSessionId])}</dd>
            <dt>Lifecycle</dt>
            <dd>{disclosure.lifecycleState}</dd>
            <dt>Observed activity</dt>
            <dd>
              {disclosure.activityState} ({disclosure.activityEvidenceKind})
            </dd>
            <dt>Observation time</dt>
            <dd>
              {disclosure.activityObservedAt
                ? new Date(disclosure.activityObservedAt).toLocaleString()
                : 'No trustworthy observation'}
            </dd>
          </dl>
          <section className="handoff-content" aria-labelledby="terminal-envelope-heading">
            <h3 id="terminal-envelope-heading">Exact terminal envelope</h3>
            <pre>{disclosure.terminalEnvelope}</pre>
          </section>
          <p id="presentation-risk" className="notice warning">
            {disclosure.manualRisk}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Submit this exact envelope to the selected recipient now.
          </label>
        </>
      ) : error ? null : (
        <p>Revalidating the selected recipient…</p>
      )}
      <LaunchError error={error} />
      <div className="actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={!disclosure || !confirmed || busy}
          onClick={() => void present()}
        >
          Present once
        </button>
      </div>
    </Modal>
  );
}

export function RetargetDialog({
  handoff,
  sessions,
  onSaved,
  onCancel,
}: {
  handoff: HandoffSummaryView;
  sessions: SessionView[];
  onSaved: (handoff: HandoffSummaryView) => void;
  onCancel: () => void;
}) {
  const targets = sessions.filter(
    ({ id }) => id !== handoff.senderSessionId && id !== handoff.recipientSessionId,
  );
  const [recipientSessionId, setRecipientSessionId] = useState(targets[0]?.id ?? '');
  const [disclosure, setDisclosure] = useState<RetargetDisclosureView | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const review = async () => {
    setBusy(true);
    setError(null);
    try {
      setDisclosure(
        await call(api.coordination.previewRetarget({ handoffId: handoff.id, recipientSessionId })),
      );
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!disclosure) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await call(
          api.coordination.confirmRetarget({
            retargetToken: disclosure.retargetToken,
            retargetConfirmation: true,
          }),
        ),
      );
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Modal title="Review handoff retarget" onCancel={onCancel} describedBy="retarget-warning">
      {disclosure ? (
        <>
          <dl className="facts">
            <dt>Current recipient</dt>
            <dd>{label(sessions.find(({ id }) => id === disclosure.currentRecipientSessionId))}</dd>
            <dt>New recipient</dt>
            <dd>{label(sessions.find(({ id }) => id === disclosure.recipientSessionId))}</dd>
          </dl>
          <p id="retarget-warning" className="notice warning">
            Retargeting changes only this undelivered handoff. It does not deliver it.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Retarget this handoff to the exact session shown.
          </label>
        </>
      ) : targets.length ? (
        <label className="field">
          New recipient session
          <select
            value={recipientSessionId}
            onChange={(event) => setRecipientSessionId(event.target.value)}
          >
            {targets.map((session) => (
              <option key={session.id} value={session.id}>
                {label(session)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="notice warning">No different eligible recipient is available.</p>
      )}
      <LaunchError error={error} />
      <div className="actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy || (disclosure ? !confirmed : !recipientSessionId)}
          onClick={() => void (disclosure ? save() : review())}
        >
          {disclosure ? 'Retarget handoff' : 'Review target'}
        </button>
      </div>
    </Modal>
  );
}

export function CancelHandoffDialog({
  handoff,
  onSaved,
  onCancel,
}: {
  handoff: HandoffSummaryView;
  onSaved: (handoff: HandoffSummaryView) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await call(api.coordination.cancelHandoff({ handoffId: handoff.id })));
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Modal title="Cancel this handoff?" onCancel={onCancel} describedBy="cancel-handoff-warning">
      <p id="cancel-handoff-warning" className="notice warning">
        The handoff remains in local history as cancelled and will not be presented.
      </p>
      <LaunchError error={error} />
      <div className="actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Keep handoff
        </button>
        <button type="button" className="danger" onClick={() => void cancel()} disabled={busy}>
          Cancel handoff
        </button>
      </div>
    </Modal>
  );
}

export function DeleteConversationDialog({
  conversationId,
  onComplete,
  onCancel,
}: {
  conversationId: string;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [disclosure, setDisclosure] = useState<DeleteContentDisclosureView | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    call(api.coordination.requestContentDeletion({ conversationId }))
      .then((value) => active && setDisclosure(value))
      .catch((reason: unknown) => active && setError(reason));
    return () => {
      active = false;
    };
  }, [conversationId]);

  const deleteContent = async () => {
    if (!disclosure) return;
    setBusy(true);
    setError(null);
    try {
      await call(
        api.coordination.confirmContentDeletion({
          deletionToken: disclosure.deletionToken,
          deletionConfirmation: true,
        }),
      );
      onComplete();
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Modal title="Delete conversation content" onCancel={onCancel} describedBy="deletion-warning">
      {disclosure ? (
        <>
          <p id="deletion-warning" className="notice warning">
            This will permanently delete all message purposes, bodies, and payloads across all{' '}
            <strong>{disclosure.handoffCount}</strong> handoff(s) in this conversation. Conversation
            structure, participant identities, timestamps, and reason codes will be preserved for
            auditability.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm that I want to permanently delete the content of this inactive conversation.
          </label>
        </>
      ) : error ? null : (
        <p className="hint">Preparing deletion disclosure…</p>
      )}
      {error ? <LaunchError error={error} /> : null}
      <div className="actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="danger"
          disabled={!confirmed || busy || !disclosure}
          onClick={() => void deleteContent()}
        >
          {busy ? 'Deleting…' : 'Delete content permanently'}
        </button>
      </div>
    </Modal>
  );
}
