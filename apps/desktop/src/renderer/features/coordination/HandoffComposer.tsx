import { useMemo, useState } from 'react';
import type {
  HandoffKind,
  HandoffPreviewView,
  HandoffSummaryView,
  SessionView,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { Modal } from '../control/Modal.js';
import { LaunchError } from '../launch/LaunchErrors.js';

interface Props {
  sessions: SessionView[];
  selectedSessionId: string | null;
  onSaved: (handoff: HandoffSummaryView) => void;
  onCancel: () => void;
}

const KINDS: readonly HandoffKind[] = ['request', 'query', 'proposal', 'inform'];

function sessionLabel(session: SessionView): string {
  return `${session.providerDisplayName} · ${session.workspaceDisplayPath} · ${session.id.slice(0, 8)}`;
}

export function HandoffComposer({ sessions, selectedSessionId, onSaved, onCancel }: Props) {
  const initialSource = sessions.some(({ id }) => id === selectedSessionId)
    ? selectedSessionId!
    : (sessions[0]?.id ?? '');
  const [sourceSessionId, setSourceSessionId] = useState(initialSource);
  const initialRecipient = sessions.find(({ id }) => id !== initialSource)?.id ?? '';
  const [recipientSessionId, setRecipientSessionId] = useState(initialRecipient);
  const [kind, setKind] = useState<HandoffKind>('request');
  const [purpose, setPurpose] = useState('');
  const [body, setBody] = useState('');
  const [responseExpected, setResponseExpected] = useState(true);
  const [preview, setPreview] = useState<HandoffPreviewView | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const byId = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);

  const updateSource = (value: string) => {
    setSourceSessionId(value);
    if (recipientSessionId === value) {
      setRecipientSessionId(sessions.find(({ id }) => id !== value)?.id ?? '');
    }
  };

  const review = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(
        await call(
          api.coordination.previewHandoff({
            sourceSessionId,
            recipientSessionId,
            kind,
            purpose,
            body,
            responseExpected,
          }),
        ),
      );
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const handoff = await call(
        api.coordination.confirmHandoff({
          previewToken: preview.previewToken,
          persistenceConfirmation: true,
        }),
      );
      onSaved(handoff);
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={preview ? 'Review durable handoff' : 'Create directed handoff'}
      onCancel={onCancel}
      describedBy={preview ? 'handoff-persistence' : 'handoff-help'}
    >
      {preview ? (
        <>
          <dl className="facts">
            <dt>Source</dt>
            <dd>{sessionLabel(byId.get(preview.sourceSessionId)!)}</dd>
            <dt>Recipient</dt>
            <dd>{sessionLabel(byId.get(preview.recipientSessionId)!)}</dd>
            <dt>Kind</dt>
            <dd>{preview.kind}</dd>
            <dt>Purpose</dt>
            <dd>{preview.normalizedPurpose}</dd>
            <dt>Response expected</dt>
            <dd>{preview.responseExpected ? 'Yes' : 'No'}</dd>
            <dt>Already retained</dt>
            <dd>{preview.retainedContentBytes.toLocaleString()} bytes</dd>
          </dl>
          <section className="handoff-content" aria-labelledby="handoff-content-heading">
            <h3 id="handoff-content-heading">Exact content to retain</h3>
            <pre>{preview.normalizedBody}</pre>
          </section>
          <p id="handoff-persistence" className="notice warning">
            {preview.persistenceDisclosure} Saving does not deliver or grant new authority.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Store this exact handoff locally.
          </label>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void review();
          }}
        >
          <p id="handoff-help" className="hint">
            One reviewed source and one reviewed recipient. Delivery is a separate explicit step.
          </p>
          <label className="field">
            Source session
            <select value={sourceSessionId} onChange={(event) => updateSource(event.target.value)}>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {sessionLabel(session)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Recipient session
            <select
              value={recipientSessionId}
              onChange={(event) => setRecipientSessionId(event.target.value)}
            >
              {sessions
                .filter(({ id }) => id !== sourceSessionId)
                .map((session) => (
                  <option key={session.id} value={session.id}>
                    {sessionLabel(session)}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Kind
            <select value={kind} onChange={(event) => setKind(event.target.value as HandoffKind)}>
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Purpose
            <input
              value={purpose}
              maxLength={160}
              required
              onChange={(event) => setPurpose(event.target.value)}
            />
          </label>
          <label className="field">
            Handoff body
            <textarea
              value={body}
              maxLength={16_384}
              rows={8}
              required
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={responseExpected}
              onChange={(event) => setResponseExpected(event.target.checked)}
            />
            A response is expected.
          </label>
        </form>
      )}
      <LaunchError error={error} />
      <div className="actions">
        <button type="button" onClick={preview ? () => setPreview(null) : onCancel} disabled={busy}>
          {preview ? 'Back' : 'Cancel'}
        </button>
        <button
          type="button"
          className="primary"
          disabled={
            busy ||
            (preview
              ? !confirmed
              : !sourceSessionId || !recipientSessionId || !purpose.trim() || !body.trim())
          }
          onClick={() => void (preview ? save() : review())}
        >
          {preview ? 'Save handoff' : 'Review handoff'}
        </button>
      </div>
    </Modal>
  );
}
