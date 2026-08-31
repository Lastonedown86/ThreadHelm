import { useEffect, useState } from 'react';
import type { MissionDetailView, OperationResponse } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { LaunchError } from '../launch/LaunchErrors.js';
import { ModalDialog } from './ModalDialog.js';
import { MissionComposer } from './MissionComposer.js';

export function MissionDetail({ missionId, onClose }: { missionId: string; onClose(): void }) {
  const { state } = useStore();
  const [detail, setDetail] = useState<MissionDetailView | null>(null);
  const [sessions, setSessions] = useState<OperationResponse<'missions.eligibleSessions'>>([]);
  const [resumeSession, setResumeSession] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<'cancel' | 'delete' | null>(null);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [unknownInspection, setUnknownInspection] = useState<{
    workId: string;
    attemptId: string;
    leaseId: string;
  } | null>(null);
  const [unknownInspected, setUnknownInspected] = useState(false);
  const inspectionCurrent = Boolean(
    unknownInspection &&
    detail?.attempts.some(
      (attempt) =>
        attempt.id === unknownInspection.attemptId &&
        attempt.workItemId === unknownInspection.workId &&
        attempt.leaseId === unknownInspection.leaseId &&
        attempt.state === 'unknown',
    ) &&
    detail.leases.some(
      (lease) => lease.id === unknownInspection.leaseId && lease.state === 'unknown',
    ),
  );
  useEffect(() => {
    if (unknownInspection && !inspectionCurrent) {
      setUnknownInspection(null);
      setUnknownInspected(false);
    }
  }, [unknownInspection, inspectionCurrent]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      call(api.missions.detail({ missionId })),
      call(api.missions.eligibleSessions(undefined)),
    ])
      .then(([value, eligible]) => {
        if (!cancelled) {
          setDetail(value);
          setSessions(eligible);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause);
      });
    return () => {
      cancelled = true;
    };
  }, [missionId, state.missionSequence]);
  async function act(fn: () => Promise<MissionDetailView>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setDetail(await fn());
      setAction(null);
      setConfirmed(false);
      setUnknownInspection(null);
      setUnknownInspected(false);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  async function requestDeletion() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const preview = await call(api.missions.previewDelete({ missionId }));
      setDeleteToken(preview.previewToken);
      setAction('delete');
      setConfirmed(false);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  if (editing && detail)
    return (
      <MissionComposer
        current={detail}
        onClose={() => setEditing(false)}
        onSaved={(value) => {
          setDetail(value);
          setEditing(false);
        }}
      />
    );
  return (
    <ModalDialog
      label="Mission detail"
      onDismiss={() => {
        if (!busy) onClose();
      }}
    >
      <h2>Mission {missionId.slice(0, 8)}</h2>
      <LaunchError error={error} />
      {detail ? (
        <>
          <p role="status">
            {detail.state.replaceAll('_', ' ')} · version {detail.version} ·{' '}
            {detail.completedWorkItemCount}/{detail.workItemCount} complete
          </p>
          {detail.reasonCode ? <p className="notice">{detail.reasonCode}</p> : null}
          {detail.state === 'recovery_required' ? (
            <p className="notice">
              Nothing was restarted or replayed. Inspect previous effects, choose a valid
              supervisor, and explicitly resume.
            </p>
          ) : null}
          {detail.envelope ? (
            <>
              <h3>Objective</h3>
              <p>{detail.envelope.objective}</p>
              <h3>Completion evidence</h3>
              <p>{detail.envelope.completionEvidence}</p>
              <h3>Pinned roster and authority</h3>
              {detail.envelope.bindings.map((binding) => (
                <details key={binding.bindingId}>
                  <summary>
                    {binding.role} · {binding.profileId.slice(0, 8)} /{' '}
                    {binding.profileRevisionId.slice(0, 8)} · {binding.launchDisposition}
                  </summary>
                  <p>
                    {binding.displayPath} · {binding.mode} · {binding.providerId}
                  </p>
                  <p>
                    Automatic start: {String(binding.autoStart)}. Session:{' '}
                    {binding.sessionId ?? 'offline'}.
                  </p>
                  <pre>{JSON.stringify(binding, null, 2)}</pre>
                </details>
              ))}
              <details>
                <summary>Mission limits and routine actions</summary>
                <pre>
                  {JSON.stringify(
                    {
                      bounds: detail.envelope.bounds,
                      actions: detail.envelope.permittedRoutineActions,
                      retries: detail.envelope.knownSafeRetryClasses,
                      escalations: detail.envelope.escalationRules,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          ) : (
            <p>Mission content was deleted. Only lifecycle evidence remains.</p>
          )}
          <div className="actions">
            {detail.state === 'running' ? (
              <button
                disabled={busy || state.storageDegraded}
                onClick={() => void act(() => call(api.missions.pause({ missionId })))}
              >
                Pause mission
              </button>
            ) : null}
            {['running', 'paused', 'recovery_required'].includes(detail.state) ? (
              <>
                <button
                  disabled={busy || state.storageDegraded || detail.state === 'running'}
                  onClick={() => setEditing(true)}
                >
                  Revise envelope…
                </button>
                {detail.state === 'running' ? (
                  <span className="hint">Pause before revising the envelope.</span>
                ) : null}
                <button
                  disabled={busy || state.storageDegraded}
                  onClick={() => {
                    setAction('cancel');
                    setConfirmed(false);
                  }}
                >
                  Cancel mission…
                </button>
              </>
            ) : null}
            {['completed', 'cancelled'].includes(detail.state) ? (
              <button
                disabled={
                  busy ||
                  state.storageDegraded ||
                  detail.leases.some((lease) =>
                    ['reserved', 'active', 'unknown'].includes(lease.state),
                  )
                }
                onClick={() => void requestDeletion()}
              >
                Delete mission content…
              </button>
            ) : null}
            {['completed', 'cancelled'].includes(detail.state) &&
            detail.leases.some((lease) =>
              ['reserved', 'active', 'unknown'].includes(lease.state),
            ) ? (
              <p className="hint">
                Resolve the remaining worker scope before deleting mission content.
              </p>
            ) : null}
          </div>
          {['paused', 'recovery_required'].includes(detail.state) ? (
            <fieldset disabled={busy || state.storageDegraded}>
              <legend>Explicit mission resume</legend>
              <p>
                Resume revalidates this envelope. It does not replay unknown actions or widen
                authority.
              </p>
              <label>
                Resume with supervisor
                <select value={resumeSession} onChange={(e) => setResumeSession(e.target.value)}>
                  <option value="">Choose eligible session</option>
                  {sessions.map((s) => (
                    <option key={s.sessionId} value={s.sessionId}>
                      {s.providerId} · {s.sessionId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={!resumeSession}
                onClick={() =>
                  void act(() =>
                    call(api.missions.resume({ missionId, supervisorSessionId: resumeSession })),
                  )
                }
              >
                Resume mission
              </button>
            </fieldset>
          ) : null}
          {action ? (
            <fieldset disabled={busy}>
              <legend>
                {action === 'delete' ? 'Delete stored mission content' : 'Cancel this mission'}
              </legend>
              <p>
                Target: {missionId}.{' '}
                {action === 'delete'
                  ? 'The objective, work descriptions, decision content, linked handoffs and mission memory will be permanently removed. Other workspace memory is kept.'
                  : 'No further work will be assigned. Existing uncertain effects remain visible for inspection.'}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I confirm this exact{' '}
                {action === 'delete' ? 'content deletion' : 'mission cancellation'}
              </label>
              <button
                disabled={!confirmed}
                onClick={() =>
                  void act(() =>
                    call(
                      action === 'delete'
                        ? api.missions.confirmDelete({ previewToken: deleteToken! })
                        : api.missions.cancel({ missionId }),
                    ),
                  )
                }
              >
                Confirm {action === 'delete' ? 'content deletion' : 'mission cancellation'}
              </button>
              <button onClick={() => setAction(null)}>Keep mission</button>
            </fieldset>
          ) : null}
          <h3>Work and dependencies</h3>
          <div className="mission-table">
            <table>
              <caption>Work DAG</caption>
              <thead>
                <tr>
                  <th scope="col">Work</th>
                  <th scope="col">State</th>
                  <th scope="col">Depends on</th>
                  <th scope="col">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {detail.workItems.map((work) => (
                  <tr key={work.id}>
                    <th scope="row">
                      <details>
                        <summary>{work.title ?? work.id.slice(0, 8)}</summary>
                        <p>{work.specification}</p>
                        <p>Acceptance: {work.acceptanceCriteria}</p>
                        <p>Workspace: {work.workspaceId}</p>
                        <p>Parent: {work.parentWorkItemId ?? 'none'}</p>
                        <p>Reason: {work.reasonCode ?? 'none'}</p>
                      </details>
                    </th>
                    <td>{work.state}</td>
                    <td>{work.dependencies.map((id) => id.slice(0, 8)).join(', ') || 'none'}</td>
                    <td>{work.attemptCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.workItems
            .filter((work) => work.state === 'escalated' || work.reasonCode)
            .map((work) => (
              <fieldset key={work.id} disabled={busy || state.storageDegraded}>
                <legend>Held work {work.id.slice(0, 8)}</legend>
                <p>{work.reasonCode}. These controls do not approve consequential actions.</p>
                <button
                  disabled={['cancelled', 'completed', 'deleted'].includes(detail.state)}
                  onClick={() =>
                    void act(() =>
                      call(
                        api.missions.resolveEscalation({
                          missionId,
                          workItemId: work.id,
                          disposition: 'keep_paused',
                        }),
                      ),
                    )
                  }
                >
                  Keep work paused
                </button>
                <button
                  disabled={['cancelled', 'completed', 'deleted'].includes(detail.state)}
                  onClick={() =>
                    void act(() =>
                      call(
                        api.missions.resolveEscalation({
                          missionId,
                          workItemId: work.id,
                          disposition: 'cancel_work',
                        }),
                      ),
                    )
                  }
                >
                  Cancel held work {work.id.slice(0, 8)}
                </button>
                {detail.attempts.some(
                  (attempt) =>
                    attempt.workItemId === work.id &&
                    attempt.state === 'unknown' &&
                    detail.leases.some(
                      (lease) => lease.id === attempt.leaseId && lease.state === 'unknown',
                    ),
                ) ? (
                  <>
                    <button
                      onClick={() => {
                        const attempt = detail.attempts.find(
                          (item) =>
                            item.workItemId === work.id &&
                            item.state === 'unknown' &&
                            detail.leases.some(
                              (lease) => lease.id === item.leaseId && lease.state === 'unknown',
                            ),
                        );
                        if (!attempt) return;
                        setUnknownInspection({
                          workId: work.id,
                          attemptId: attempt.id,
                          leaseId: attempt.leaseId,
                        });
                        setUnknownInspected(false);
                      }}
                    >
                      Inspect unknown effect {work.id.slice(0, 8)}…
                    </button>
                    {unknownInspection?.workId === work.id && inspectionCurrent ? (
                      <div>
                        <p>
                          Work {work.id}, attempt {unknownInspection.attemptId}, lease{' '}
                          {unknownInspection.leaseId}. Inspect external effects before releasing
                          this hold. Main must verify that the previous worker has stopped.
                          Acknowledgement does not retry, complete, resume, or authorize additional
                          work.
                        </p>
                        <label>
                          <input
                            type="checkbox"
                            checked={unknownInspected}
                            onChange={(event) => setUnknownInspected(event.target.checked)}
                          />
                          I inspected this work’s effects and verified the previous worker is
                          stopped
                        </label>
                        <button
                          disabled={!unknownInspected || !inspectionCurrent}
                          onClick={() =>
                            void act(() =>
                              call(
                                api.missions.resolveEscalation({
                                  missionId,
                                  workItemId: work.id,
                                  disposition: 'acknowledge_unknown',
                                  expectedAttemptId: unknownInspection.attemptId,
                                  expectedLeaseId: unknownInspection.leaseId,
                                }),
                              ),
                            )
                          }
                        >
                          Acknowledge inspected unknown effect
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </fieldset>
            ))}
          <details>
            <summary>Decision history ({detail.decisions.length})</summary>
            {detail.decisions.map((decision) => (
              <article key={decision.id}>
                <h4>
                  {decision.kind} · {decision.policyResult}
                </h4>
                <p>{decision.reasonCode}</p>
                <p>{decision.rationale}</p>
                <p>Expected evidence: {decision.expectedEvidence}</p>
                <pre>{JSON.stringify(decision.inputRefs, null, 2)}</pre>
              </article>
            ))}
          </details>
          <details>
            <summary>Attempts, starts and results ({detail.attempts.length})</summary>
            {detail.attempts.map((attempt) => (
              <article key={attempt.id}>
                <h4>
                  {attempt.workItemId.slice(0, 8)} · attempt {attempt.attemptNumber}
                </h4>
                <p>
                  {attempt.state} · start {attempt.workerStartDisposition} · result{' '}
                  {attempt.disposition ?? 'pending'}
                </p>
                <p>{attempt.explanation}</p>
                <pre>{JSON.stringify(attempt, null, 2)}</pre>
              </article>
            ))}
          </details>
          <details>
            <summary>Workspace leases ({detail.leases.length})</summary>
            {detail.leases.map((lease) => (
              <p key={lease.id}>
                {lease.workspaceId} · {lease.mode} · {lease.state} · session{' '}
                {lease.sessionId ?? 'reserved'} · expires {lease.expiresAt}
              </p>
            ))}
          </details>
        </>
      ) : (
        <p>Loading mission detail…</p>
      )}
      <button disabled={busy} onClick={onClose}>
        Close mission
      </button>
    </ModalDialog>
  );
}
