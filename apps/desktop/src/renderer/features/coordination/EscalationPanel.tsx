import { useEffect, useState } from 'react';
import type {
  AutoContinueDisclosureView,
  ConversationSummaryView,
  EscalationView,
  SessionView,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The coordination action failed.';
}

export function AutoContinueDialog({
  summary,
  onComplete,
  onCancel,
}: {
  summary: ConversationSummaryView;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const requestedEnabled = !summary.autoContinueEnabled;
  const [disclosure, setDisclosure] = useState<AutoContinueDisclosureView | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void call(
      api.coordination.previewAutoContinue({
        conversationId: summary.id,
        enabled: requestedEnabled,
      }),
    )
      .then(setDisclosure)
      .catch((reason) => setError(message(reason)));
  }, [requestedEnabled, summary.id]);

  const apply = async () => {
    if (!disclosure || !confirmed) return;
    try {
      await call(
        api.coordination.confirmAutoContinue({
          autoContinueToken: disclosure.autoContinueToken,
          autoContinueConfirmation: true,
        }),
      );
      onComplete();
    } catch (reason) {
      setError(message(reason));
    }
  };

  const title = requestedEnabled ? 'Enable bounded continuation' : 'Disable automatic continuation';
  return (
    <div className="dialog-backdrop">
      <section role="dialog" aria-modal="true" aria-label={title} className="dialog-card">
        <h3>{title}</h3>
        {error ? <p className="notice error">{error}</p> : null}
        {disclosure ? (
          <>
            <p>This opt-in applies only to this exact two-session conversation.</p>
            <ul>
              <li>Reply depth: {disclosure.replyDepthLimit}</li>
              <li>
                Equivalent repeat: {disclosure.equivalentRepeatThreshold} within{' '}
                {disclosure.equivalentRepeatWindow}
              </li>
              <li>Delivery failures: {disclosure.deliveryFailureThreshold}</li>
              <li>Held kinds: {disclosure.heldKinds.join(', ')}</li>
            </ul>
            <p>{disclosure.authorityDisclosure}</p>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />{' '}
              I reviewed these fixed bounds.
            </label>
          </>
        ) : null}
        <div className="actions">
          <button type="button" onClick={() => void apply()} disabled={!disclosure || !confirmed}>
            {title}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

export function EscalationPanel({
  escalation,
  sessions,
  participantSessionIds,
  onResolved,
}: {
  escalation: EscalationView;
  sessions: Record<string, SessionView>;
  participantSessionIds: string[];
  onResolved: () => void;
}) {
  const [redirectSessionId, setRedirectSessionId] = useState(participantSessionIds[0] ?? '');
  const [error, setError] = useState<string | null>(null);
  const resolve = async (disposition: 'continue' | 'redirect' | 'close') => {
    try {
      await call(
        api.coordination.resolveEscalation(
          disposition === 'redirect'
            ? {
                escalationId: escalation.id,
                disposition,
                recipientSessionId: redirectSessionId,
              }
            : { escalationId: escalation.id, disposition },
        ),
      );
      onResolved();
    } catch (reason) {
      setError(message(reason));
    }
  };
  const plainKind = escalation.kind.split('_').join(' ');
  const kind = plainKind[0]!.toUpperCase() + plainKind.slice(1);

  return (
    <section
      className="escalation-panel notice warning"
      role="region"
      aria-label="Coordination escalation"
    >
      <h4>{kind}</h4>
      <p>{escalation.safeSummary}</p>
      <p className="hint">Reason: {escalation.reasonCode}</p>
      {error ? <p className="notice error">{error}</p> : null}
      <label>
        Redirect to
        <select
          value={redirectSessionId}
          onChange={(event) => setRedirectSessionId(event.target.value)}
        >
          {participantSessionIds.map((sessionId) => (
            <option key={sessionId} value={sessionId}>
              {sessions[sessionId]?.providerDisplayName ?? sessionId.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <div className="actions inline">
        <button type="button" className="small" onClick={() => void resolve('continue')}>
          Continue once
        </button>
        <button
          type="button"
          className="small"
          disabled={!redirectSessionId}
          onClick={() => void resolve('redirect')}
        >
          Redirect
        </button>
        <button type="button" className="small danger" onClick={() => void resolve('close')}>
          Close conversation
        </button>
      </div>
    </section>
  );
}
