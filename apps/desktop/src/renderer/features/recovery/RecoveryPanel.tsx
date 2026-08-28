/**
 * Recovery view (T086): honest records for sessions that did not end
 * cleanly, each with an explicit next action. Nothing is relaunched or
 * replayed automatically.
 */

import type { RecoveryClassification } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { describeError } from '../launch/LaunchErrors.js';
import { LIFECYCLE_LABEL } from '../sessions/SessionList.js';

const CLASSIFICATION_LABEL: Record<RecoveryClassification, string> = {
  interrupted_start: 'Interrupted while starting',
  unexpected_shutdown: 'ThreadHelm ended unexpectedly',
  incomplete_stop: 'Stop did not complete',
  storage_repair: 'Storage was repaired',
  observation_lost: 'Observation lost',
};

export function RecoveryPanel() {
  const { state, actions } = useStore();
  const open = state.recoveryRecords.filter((record) => record.resolvedAt === null);
  if (open.length === 0) return null;

  const dismiss = async (recordId: string) => {
    try {
      actions.recoveryChanged(
        await call(api.recovery.resolve({ recordId, resolution: 'dismissed' })),
      );
    } catch (error) {
      actions.setNotice(describeError(error));
    }
  };

  return (
    <section className="panel recovery" aria-labelledby="recovery-heading">
      <h2 id="recovery-heading">Needs attention</h2>
      <ul className="list">
        {open.map((record) => {
          const session = state.sessions[record.sessionId];
          return (
            <li key={record.id}>
              <div>
                <strong>{CLASSIFICATION_LABEL[record.classification]}</strong>
              </div>
              {session ? (
                <div className="hint">
                  {session.providerDisplayName} ·{' '}
                  <span className="mono">{session.workspaceDisplayPath}</span>
                </div>
              ) : null}
              <div className="hint">
                last known {LIFECYCLE_LABEL[record.lastKnownState]} ·{' '}
                {new Date(record.createdAt).toLocaleString()}
              </div>
              <div>{record.safeSummary}</div>
              <div className="actions inline">
                <button type="button" className="small" onClick={() => void dismiss(record.id)}>
                  Dismiss
                </button>
                {session ? (
                  <button
                    type="button"
                    className="small primary"
                    disabled={state.storageDegraded}
                    onClick={() =>
                      actions.openLaunch({
                        workspaceId: session.workspaceId,
                        providerId: session.providerId,
                        recoveryRecordId: record.id,
                      })
                    }
                  >
                    Start new session
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
