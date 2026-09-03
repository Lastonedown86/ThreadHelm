import type { ApprovedWorkspaceView, OperationResponse } from '@threadhelm/contracts';
import { ListEditor } from './ListEditor.js';
import type { StageProps } from './OutcomeStage.js';
import { newWorker, runtimeSummary, type WorkerFields } from './composer-fields.js';

type Profile = OperationResponse<'profiles.list'>['profiles'][number];
type Eligible = OperationResponse<'missions.eligibleSessions'>[number];

export function CrewStage({
  fields,
  setFields,
  invalid,
  profiles,
  eligible,
  workspaces,
  loading,
  loadError,
  onCreateAgent,
  onLaunchSession,
  onRetryLoad,
}: StageProps & {
  profiles: Profile[];
  eligible: Eligible[];
  workspaces: ApprovedWorkspaceView[];
  loading: boolean;
  loadError: boolean;
  onCreateAgent(): void;
  onLaunchSession(): void;
  onRetryLoad(): void;
}) {
  // ponytail: a plain paragraph, not role="status" — the composer's one shared
  // live region (MissionComposerWorkspace) already owns announcements.
  if (loading) return <p>Loading profiles…</p>;
  if (loadError)
    return (
      <div className="composer-notice">
        <p>Profiles could not be loaded.</p>
        <button type="button" className="small" onClick={onRetryLoad}>
          Retry
        </button>
      </div>
    );
  if (profiles.length === 0)
    return (
      <div className="composer-notice">
        <p>
          No reviewed profile yet. A profile is needed before a supervisor or worker can be chosen.
        </p>
        <button type="button" className="primary" onClick={onCreateAgent}>
          Create agent
        </button>
      </div>
    );
  if (eligible.length === 0)
    return (
      <div className="composer-notice">
        <p>
          No live session can supervise yet. Launch a session with a verified launch snapshot first.
        </p>
        <button type="button" className="primary" onClick={onLaunchSession}>
          Launch a session
        </button>
      </div>
    );

  const supervisor = fields.supervisor ?? {
    profileId: null,
    profileRevisionId: null,
    sessionId: null,
  };
  const workers = fields.workers ?? [];
  const profileOf = (id: string | null) => profiles.find((p) => p.profileId === id);
  const patchWorker = (index: number, patch: Partial<WorkerFields>) =>
    setFields({ workers: workers.map((w, i) => (i === index ? { ...w, ...patch } : w)) });
  const providerOf = (worker: WorkerFields) => {
    const requested = profileOf(worker.profileId)?.requestedProvider;
    return requested === 'codex' || requested === 'codex-cli' ? 'codex-cli' : 'claude-code';
  };
  const pathOf = (s: Eligible) =>
    workspaces.find((w) => w.id === s.workspaceId)?.displayPath ?? 'an approved folder';

  return (
    <div className="composer-stage-body">
      <fieldset className="composer-card">
        <legend>Supervisor</legend>
        <p className="hint">
          The supervisor decomposes and assigns work. It must already be a live session with a
          recorded launch.
        </p>
        <label className="field">
          Supervisor profile
          <select
            data-field="supervisor.profileId"
            aria-invalid={invalid === 'supervisor.profileId' || undefined}
            value={supervisor.profileId ?? ''}
            onChange={(event) => {
              const profile = profileOf(event.target.value);
              setFields({
                supervisor: {
                  ...supervisor,
                  profileId: profile?.profileId ?? null,
                  profileRevisionId: profile?.currentRevisionId ?? null,
                },
              });
            }}
          >
            <option value="">Choose a reviewed profile</option>
            {profiles.map((p) => (
              <option key={p.profileId} value={p.profileId}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Supervisor session
          <select
            data-field="supervisor.sessionId"
            aria-invalid={invalid === 'supervisor.sessionId' || undefined}
            value={supervisor.sessionId ?? ''}
            onChange={(event) =>
              setFields({ supervisor: { ...supervisor, sessionId: event.target.value || null } })
            }
          >
            <option value="">Choose a live session</option>
            {eligible.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.providerId} · {pathOf(s)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {workers.map((worker, index) => {
        const n = index + 1;
        const sessions = eligible.filter(
          (s) => s.providerId === providerOf(worker) && s.sessionId !== supervisor.sessionId,
        );
        return (
          <fieldset key={index} className="composer-card" aria-label={`Worker ${n}`}>
            <legend>Worker {n}</legend>
            <label className="field">
              Worker {n} profile
              <select
                data-field={`workers.${index}.profileId`}
                aria-invalid={invalid === `workers.${index}.profileId` || undefined}
                value={worker.profileId ?? ''}
                onChange={(event) => {
                  const profile = profileOf(event.target.value);
                  patchWorker(index, {
                    profileId: profile?.profileId ?? null,
                    profileRevisionId: profile?.currentRevisionId ?? null,
                  });
                }}
              >
                <option value="">Choose a reviewed profile</option>
                {profiles.map((p) => (
                  <option key={p.profileId} value={p.profileId}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            {worker.profileId ? (
              <p className="hint">Goal: {profileOf(worker.profileId)?.description}</p>
            ) : null}
            <label className="field">
              Worker {n} role
              <select
                value={worker.role}
                onChange={(event) =>
                  patchWorker(index, { role: event.target.value as WorkerFields['role'] })
                }
              >
                <option value="worker">Worker: does the assigned work</option>
                <option value="reviewer">Reviewer: checks another worker's result</option>
                <option value="triage">Triage: sorts and routes incoming items</option>
              </select>
            </label>
            <label className="field">
              Worker {n} session
              <select
                value={worker.sessionId ?? ''}
                onChange={(event) =>
                  patchWorker(index, {
                    sessionId: event.target.value || null,
                    ...(event.target.value ? { autoStart: false } : {}),
                  })
                }
              >
                <option value="">Start a new session at launch</option>
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.providerId} · {pathOf(s)}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <label htmlFor={`worker-${index}-assignment`}>What worker {n} contributes</label>
              <span className="hint" id={`worker-${index}-assignment-hint`}>
                One concrete contribution for this mission only.
              </span>
              <textarea
                id={`worker-${index}-assignment`}
                rows={2}
                maxLength={2000}
                data-field={`workers.${index}.assignment`}
                aria-invalid={invalid === `workers.${index}.assignment` || undefined}
                aria-describedby={`worker-${index}-assignment-hint`}
                value={worker.assignment}
                onChange={(event) => patchWorker(index, { assignment: event.target.value })}
              />
            </div>
            <ListEditor
              label={`What worker ${n} must bring back`}
              hint="Evidence you can judge the result by. At least one."
              items={worker.requiredReturnEvidence}
              max={8}
              dataField={`workers.${index}.requiredReturnEvidence`}
              invalid={invalid === `workers.${index}.requiredReturnEvidence`}
              onChange={(requiredReturnEvidence) => patchWorker(index, { requiredReturnEvidence })}
            />
            <details>
              <summary>Customize runtime · {runtimeSummary(worker)}</summary>
              <label className="field">
                Worker {n} model
                <input
                  value={worker.runtimeSelection.model ?? ''}
                  placeholder="Provider default"
                  onChange={(event) =>
                    patchWorker(index, {
                      runtimeSelection: {
                        ...worker.runtimeSelection,
                        model: event.target.value || null,
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                Worker {n} effort
                <select
                  value={worker.runtimeSelection.effort ?? ''}
                  onChange={(event) =>
                    patchWorker(index, {
                      runtimeSelection: {
                        ...worker.runtimeSelection,
                        effort: (event.target.value ||
                          null) as WorkerFields['runtimeSelection']['effort'],
                      },
                    })
                  }
                >
                  <option value="">Provider default effort</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                </select>
              </label>
              <label className="field">
                Worker {n} permission
                <select
                  value={worker.permissionSelection.policy ?? ''}
                  onChange={(event) =>
                    patchWorker(index, {
                      permissionSelection: {
                        ...worker.permissionSelection,
                        policy: (event.target.value ||
                          null) as WorkerFields['permissionSelection']['policy'],
                      },
                    })
                  }
                >
                  <option value="">Manual permission (asks you)</option>
                  <option value="bounded_allowlist">Allow-listed tools only</option>
                </select>
              </label>
              {worker.permissionSelection.policy === 'bounded_allowlist' ? (
                <ListEditor
                  label={`Worker ${n} allowed tools`}
                  items={worker.permissionSelection.boundedAllowlist}
                  max={32}
                  itemMax={64}
                  onChange={(boundedAllowlist) =>
                    patchWorker(index, {
                      permissionSelection: { ...worker.permissionSelection, boundedAllowlist },
                    })
                  }
                />
              ) : null}
              <label className="check">
                <input
                  type="checkbox"
                  checked={worker.autoStart}
                  disabled={worker.sessionId !== null}
                  onChange={(event) => patchWorker(index, { autoStart: event.target.checked })}
                />
                Authorize automatic startup of worker {n} within this mission
              </label>
            </details>
            <button
              type="button"
              className="small"
              onClick={() => setFields({ workers: workers.filter((_, i) => i !== index) })}
            >
              Remove worker {n}
            </button>
          </fieldset>
        );
      })}
      <button
        type="button"
        data-field="workers"
        disabled={workers.length >= 16}
        onClick={() => setFields({ workers: [...workers, newWorker()] })}
      >
        Add worker
      </button>
    </div>
  );
}
