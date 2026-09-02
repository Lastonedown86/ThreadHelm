import type { RecoveryRecordView, SessionView } from '@threadhelm/contracts';
import { LIFECYCLE_LABEL } from '../sessions/SessionList.js';
import { RecoveryCoach } from './RecoveryCoach.js';

export function RecoveryDetail({
  record,
  session,
  onDismiss,
  onReplace,
  disabled,
}: {
  record: RecoveryRecordView;
  session?: SessionView;
  onDismiss(): void;
  onReplace(): void;
  disabled: boolean;
}) {
  const labels = {
    interrupted_start: 'Interrupted while starting',
    unexpected_shutdown: 'ThreadHelm ended unexpectedly',
    incomplete_stop: 'Stop did not complete',
    storage_repair: 'Storage was repaired',
    observation_lost: 'Observation lost',
  } as const;
  return (
    <section className="recovery-detail" aria-labelledby="recovery-detail-heading">
      <header>
        <p className="eyebrow">Exact recovery record</p>
        <h2 id="recovery-detail-heading">{labels[record.classification]}</h2>
      </header>
      <dl className="setup-evidence">
        <dt>Record</dt>
        <dd className="mono">{record.id}</dd>
        <dt>Session</dt>
        <dd className="mono">{record.sessionId}</dd>
        <dt>Provider</dt>
        <dd>{session?.providerDisplayName ?? 'Unavailable session record'}</dd>
        <dt>Workspace</dt>
        <dd className="mono">{session?.workspaceDisplayPath ?? 'Unavailable'}</dd>
        <dt>Last known state</dt>
        <dd>{LIFECYCLE_LABEL[record.lastKnownState]}</dd>
        <dt>Observed</dt>
        <dd>{new Date(record.createdAt).toLocaleString()}</dd>
      </dl>
      <p>{record.safeSummary}</p>
      <p className="mono hint">Reason {record.reasonCode}</p>
      <RecoveryCoach record={record} />
      <div className="actions">
        <button type="button" onClick={onDismiss} disabled={disabled}>
          Dismiss
        </button>
        {session ? (
          <button type="button" className="primary" onClick={onReplace} disabled={disabled}>
            Start new session
          </button>
        ) : null}
      </div>
    </section>
  );
}
