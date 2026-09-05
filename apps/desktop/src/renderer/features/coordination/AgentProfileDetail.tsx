import { useEffect, useState } from 'react';
import type {
  AgentProfileDetailView,
  AgentProfileSummaryView,
  ProfilePreviewView,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { LaunchError } from '../launch/LaunchErrors.js';
import { ModalDialog } from './ModalDialog.js';

const COMPATIBILITY_LABEL: Record<string, string> = {
  compatible: 'Compatible',
  incompatible_provider: 'Incompatible provider',
  incompatible_model: 'Incompatible model',
  unavailable: 'Unavailable',
};

/** Exact-field review of an unconfirmed import. Grants nothing until confirmed. */
export function AgentProfileImportPreview({
  preview,
  onCancel,
  onImported,
  requireDisplayName = false,
}: {
  preview: ProfilePreviewView;
  onCancel(): void;
  onImported(summary: AgentProfileSummaryView): void;
  /**
   * Recon proposals ship with a placeholder manifest name; the owner types the
   * real one here and Confirm stays disabled until they do. The file-picker
   * import path is unaffected and keeps using the manifest's own name.
   */
  requireDisplayName?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const manifest = preview.normalized;
  const nameReady = !requireDisplayName || displayName.trim().length > 0;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const summary = await call(
        api.profiles.confirmImport({
          previewToken: preview.previewToken,
          importConfirmation: true,
          ...(requireDisplayName ? { displayName: displayName.trim() } : {}),
        }),
      );
      onImported(summary);
    } catch (cause) {
      setError(cause);
      setBusy(false);
    }
  };

  return (
    <ModalDialog label="Review reviewed agent profile" onDismiss={onCancel}>
      <h3>Review reviewed agent profile</h3>
      <p className="hint">
        {preview.basename} · digest {preview.digest.slice(0, 12)}
      </p>
      {requireDisplayName ? (
        <label className="field">
          Display name
          <input
            value={displayName}
            autoComplete="off"
            spellCheck={false}
            placeholder="Name this agent"
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
      ) : null}
      <dl className="facts">
        <dt>Name</dt>
        <dd>{manifest.name}</dd>
        <dt>Author</dt>
        <dd>{manifest.author}</dd>
        <dt>Description</dt>
        <dd>{manifest.description}</dd>
        <dt>Goal</dt>
        <dd>{manifest.goal}</dd>
        <dt>Provider</dt>
        <dd>{manifest.provider}</dd>
        <dt>Model</dt>
        <dd>{manifest.model}</dd>
        <dt>Capabilities</dt>
        <dd>{manifest.capabilities.length > 0 ? manifest.capabilities.join(', ') : 'None'}</dd>
        <dt>Isolate workspace</dt>
        <dd>{manifest.isolate ? 'Yes' : 'No'}</dd>
        <dt>Requested token cap</dt>
        <dd>{manifest.tokenCap.toLocaleString()}</dd>
        <dt>Compatibility</dt>
        <dd>{COMPATIBILITY_LABEL[preview.compatibility] ?? preview.compatibility}</dd>
      </dl>
      {preview.compatibilityReasons.length > 0 ? (
        <ul className="list profile-warnings" aria-label="Compatibility warnings">
          {preview.compatibilityReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      <p className="notice warning">
        Importing this reviewed profile grants no tools, workspaces, roles, or budget. It only saves
        this exact inert presentation and compatibility data locally.
      </p>
      <label className="confirmation">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />{' '}
        Save this exact reviewed profile.
      </label>
      <LaunchError error={error} />
      <div className="actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={!confirmed || !nameReady || busy}
          onClick={() => void confirm()}
        >
          Import profile
        </button>
      </div>
    </ModalDialog>
  );
}

/** Explicit, event-triggered detail load for one reviewed profile. */
export function AgentProfileDetail({
  profileId,
  reloadSequence,
  onChanged,
}: {
  profileId: string;
  reloadSequence: number;
  onChanged(summary: AgentProfileSummaryView): void;
}) {
  const [detail, setDetail] = useState<AgentProfileDetailView | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [loadedSequence, setLoadedSequence] = useState(-1);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setHistoryOpen(false);
    setError(null);
    setDetail(null);
    let cancelled = false;
    void call(api.profiles.get({ profileId }))
      .then((next) => {
        if (!cancelled) {
          setDetail(next);
          setLoadedSequence(reloadSequence);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause);
      });
    return () => {
      cancelled = true;
    };
    // A content-free event is only a reload signal for the currently open detail.
  }, [profileId, reloadSequence, retry]);

  if (!detail || detail.profileId !== profileId || loadedSequence !== reloadSequence)
    return (
      <section aria-label="Agent profile detail">
        {error ? (
          <>
            <LaunchError error={error} />
            <button type="button" onClick={() => setRetry((value) => value + 1)}>
              Retry profile detail
            </button>
          </>
        ) : (
          <p role="status">Loading profile detail...</p>
        )}
      </section>
    );

  const toggleEnabled = async () => {
    setBusy(true);
    setError(null);
    try {
      const summary = await call(
        api.profiles.setEnabled({
          profileId: detail.profileId,
          revisionId: detail.currentRevisionId,
          enabled: detail.state === 'disabled',
        }),
      );
      setDetail((current) => (current ? { ...current, ...summary } : current));
      onChanged(summary);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="agent-profile-detail" role="region" aria-label="Agent profile detail">
      <div className="panel-heading">
        <h3>{detail.displayName}</h3>
        <span className={`badge profile-${detail.compatibility}`}>
          {COMPATIBILITY_LABEL[detail.compatibility] ?? detail.compatibility}
        </span>
      </div>
      <p className="hint">
        {detail.state === 'disabled' ? 'Disabled' : 'Active'} · {detail.requestedProvider} ·{' '}
        {detail.requestedModel} · author {detail.author}
      </p>
      <p>{detail.description}</p>
      <h4>Goal</h4>
      <p>{detail.goal}</p>
      <p className="hint">
        Capabilities: {detail.capabilities.length > 0 ? detail.capabilities.join(', ') : 'None'} ·
        Isolate: {detail.isolateRequested ? 'Yes' : 'No'} · Token cap:{' '}
        {detail.tokenCapRequested.toLocaleString()}
      </p>
      <p className="mono hint">Digest {detail.digest}</p>

      <LaunchError error={error} />
      <div className="actions inline">
        <button
          type="button"
          className="small"
          disabled={busy}
          onClick={() => void toggleEnabled()}
        >
          {detail.state === 'disabled' ? 'Enable' : 'Disable'}
        </button>
        <button
          type="button"
          className="small"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((current) => !current)}
        >
          Revision history
        </button>
      </div>
      {historyOpen ? (
        <ol className="list profile-history" aria-label="Revision history">
          {detail.revisionHistory.map((revision) => (
            <li key={revision.revisionId}>
              {revision.digest.slice(0, 12)} · {new Date(revision.createdAt).toLocaleString()}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
