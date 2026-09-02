import { useState } from 'react';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { RecoveryDetail } from './RecoveryDetail.js';
import { SessionList } from '../sessions/SessionList.js';

export function RecoveryAttentionQueue() {
  const { state, actions } = useStore();
  const open = state.recoveryRecords.filter((record) => record.resolvedAt === null);
  const [selectedId, setSelectedId] = useState(open[0]?.id ?? null);
  const selected = open.find((record) => record.id === selectedId) ?? open[0];
  const labels = {
    interrupted_start: 'Interrupted while starting',
    unexpected_shutdown: 'ThreadHelm ended unexpectedly',
    incomplete_stop: 'Stop did not complete',
    storage_repair: 'Storage was repaired',
    observation_lost: 'Observation lost',
  } as const;
  const dismiss = async (recordId: string) => {
    actions.recoveryChanged(
      await call(api.recovery.resolve({ recordId, resolution: 'dismissed' })),
    );
    setSelectedId(null);
  };
  const replace = (recordId: string) => {
    const record = open.find((item) => item.id === recordId);
    const session = record ? state.sessions[record.sessionId] : undefined;
    if (record && session)
      actions.openLaunch({
        workspaceId: session.workspaceId,
        providerId: session.providerId,
        recoveryRecordId: record.id,
      });
  };
  return (
    <main className="recovery-attention-workspace" aria-labelledby="attention-heading">
      <header className="workspace-page-header">
        <p className="eyebrow">Cross-mission attention</p>
        <h1 id="attention-heading">Recovery attention queue</h1>
        <p>
          Inspect unresolved local evidence. Recovery resolution never changes the truth of an
          unknown outcome.
        </p>
      </header>
      {open.length === 0 ? (
        <section className="mission-workspace-state">
          <h2>No recovery records need attention</h2>
          <p>Interrupted or uncertain session endings will appear here.</p>
        </section>
      ) : (
        <section className="recovery-attention-grid" aria-label="Needs attention">
          <ol className="recovery-queue" aria-label="Unresolved recovery records">
            {open.map((record) => (
              <li key={record.id}>
                <button
                  type="button"
                  className={record.id === selected?.id ? 'selected' : undefined}
                  onClick={() => setSelectedId(record.id)}
                >
                  <strong>{labels[record.classification]}</strong>
                  <span className="mono">
                    {state.sessions[record.sessionId]?.workspaceDisplayPath ?? record.sessionId}
                  </span>
                  <span>{new Date(record.createdAt).toLocaleString()}</span>
                </button>
                <div className="actions inline">
                  <button
                    type="button"
                    className="small"
                    disabled={state.storageDegraded}
                    onClick={() =>
                      void dismiss(record.id).catch((error) =>
                        actions.setNotice(
                          error instanceof Error ? error.message : 'Recovery update failed.',
                        ),
                      )
                    }
                  >
                    Dismiss
                  </button>
                  {state.sessions[record.sessionId] ? (
                    <button
                      type="button"
                      className="small primary"
                      disabled={state.storageDegraded}
                      onClick={() => replace(record.id)}
                    >
                      Start new session
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {selected ? (
            <RecoveryDetail
              record={selected}
              {...(state.sessions[selected.sessionId]
                ? { session: state.sessions[selected.sessionId] }
                : {})}
              disabled={state.storageDegraded}
              onDismiss={() =>
                void dismiss(selected.id).catch((error) =>
                  actions.setNotice(
                    error instanceof Error ? error.message : 'Recovery update failed.',
                  ),
                )
              }
              onReplace={() => replace(selected.id)}
            />
          ) : null}
        </section>
      )}
      <SessionList />
    </main>
  );
}
