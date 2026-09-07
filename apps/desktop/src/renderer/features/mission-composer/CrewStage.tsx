import { WorkerModelPicker } from './WorkerModelPicker.js';
import type { ApprovedWorkspaceView, OperationResponse } from '@threadhelm/contracts';
import { existingRuntimeIssue } from './existing-runtime.js';
import { ListEditor } from './ListEditor.js';
import type { StageProps } from './OutcomeStage.js';
import {
  deriveWorkspaces,
  newWorker,
  runtimeSummary,
  type WorkerFields,
} from './composer-fields.js';

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
          No live session can supervise yet. Choose an approved folder and provider in Settings,
          then review a session launch first.
        </p>
        <button type="button" className="primary" onClick={onLaunchSession}>
          Choose session launch in Settings…
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
  const selectSession = (index: number, chosen: Eligible | undefined) => {
    const nextWorkers = workers.map((w, i) =>
      i === index
        ? {
            ...w,
            sessionId: chosen?.sessionId ?? null,
            autoStart: false,
            ...(chosen
              ? {
                  workspaceId: chosen.workspaceId,
                  runtimeSelection: chosen.runtimeSelection,
                  permissionSelection: chosen.permissionSelection,
                  executionBounds: chosen.executionBounds,
                }
              : {}),
          }
        : w,
    );
    setFields({
      workers: nextWorkers,
      workspaces: deriveWorkspaces(
        { ...fields, workers: nextWorkers },
        eligible.find((s) => s.sessionId === supervisor.sessionId)?.workspaceId ?? null,
      ),
    });
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
            onChange={(event) => {
              const chosen = eligible.find((s) => s.sessionId === event.target.value);
              const nextSupervisor = { ...supervisor, sessionId: event.target.value || null };
              // The supervisor's own workspace needs an access entry too (it is
              // resolved from the live session, not chosen on the Access stage).
              // Recomputed, not appended, so a session change drops the old
              // workspace instead of leaving a stale write-access entry behind.
              setFields({
                supervisor: nextSupervisor,
                workspaces: deriveWorkspaces(
                  { ...fields, supervisor: nextSupervisor },
                  chosen?.workspaceId ?? null,
                ),
              });
            }}
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

      {workers.map((savedWorker, index) => {
        const recorded = eligible.find((s) => s.sessionId === savedWorker.sessionId);
        const worker = recorded
          ? {
              ...savedWorker,
              autoStart: false,
              runtimeSelection: recorded.runtimeSelection,
              permissionSelection: recorded.permissionSelection,
              executionBounds: recorded.executionBounds,
            }
          : savedWorker;

        const n = index + 1;
        const sessions = eligible.filter(
          (s) => s.providerId === providerOf(worker) && s.sessionId !== supervisor.sessionId,
        );
        const issue = existingRuntimeIssue(savedWorker, sessions, index);
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
                data-field={`workers.${index}.sessionId`}
                aria-invalid={Boolean(issue) || undefined}
                onChange={(event) =>
                  selectSession(
                    index,
                    sessions.find((s) => s.sessionId === event.target.value),
                  )
                }
              >
                <option value="">New session · startup authorization below</option>
                {worker.sessionId && !sessions.some((s) => s.sessionId === worker.sessionId) ? (
                  <option value={worker.sessionId}>Unavailable session · {worker.sessionId}</option>
                ) : null}
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.providerId} · {pathOf(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={worker.autoStart}
                disabled={worker.sessionId !== null}
                onChange={(event) => patchWorker(index, { autoStart: event.target.checked })}
              />
              Authorize automatic startup of worker {n} within this mission
            </label>
            {worker.sessionId ? (
              <div className="composer-notice">
                <p>
                  Existing session · {worker.sessionId}.{' '}
                  {recorded
                    ? 'Runtime settings are fixed by its recorded launch.'
                    : 'Saved draft settings are shown below; this session is unavailable.'}
                </p>
                {issue ? <p role="alert">{issue}</p> : null}
                {issue && recorded && sessions.includes(recorded) ? (
                  <button type="button" onClick={() => selectSession(index, recorded)}>
                    Use recorded settings for worker {n}
                  </button>
                ) : null}
                <button type="button" onClick={() => selectSession(index, undefined)}>
                  Switch worker {n} to a new session
                </button>
                {!recorded ? (
                  <button type="button" onClick={onRetryLoad}>
                    Refresh sessions
                  </button>
                ) : null}
              </div>
            ) : null}
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
              <summary>
                {worker.sessionId
                  ? `${recorded ? 'Recorded runtime (fixed)' : 'Saved runtime (session unavailable)'} - ${worker.runtimeSelection.model ?? 'CLI default model'}`
                  : `Customize runtime - ${runtimeSummary(worker)}`}
              </summary>
              <fieldset disabled={worker.sessionId !== null}>
                <legend className="visually-hidden">Worker {n} runtime settings</legend>
                {worker.sessionId ? (
                  <p className="hint">
                    {recorded ? 'Recorded limits:' : 'Saved limits:'}{' '}
                    {worker.executionBounds.maxElapsedMs / 60000} minutes,{' '}
                    {worker.executionBounds.maxTurns} turns,{' '}
                    {worker.executionBounds.maxNoProgressMs / 60000} minutes without progress,{' '}
                    {worker.executionBounds.maxOutputBytes / 1048576} MiB output,{' '}
                    {worker.executionBounds.maxConcurrentProcesses} concurrent processes.
                  </p>
                ) : null}
                <WorkerModelPicker
                  key={`${worker.profileId}:${worker.sessionId}`}
                  providerId={providerOf(worker)}
                  index={n}
                  model={worker.runtimeSelection.model}
                  onChange={(model) =>
                    patchWorker(index, { runtimeSelection: { ...worker.runtimeSelection, model } })
                  }
                />
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
                    {worker.runtimeSelection.effort &&
                    !['low', 'medium'].includes(worker.runtimeSelection.effort) ? (
                      <option value={worker.runtimeSelection.effort}>
                        {worker.runtimeSelection.effort}
                      </option>
                    ) : null}
                    <option value="">CLI default effort</option>
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
                    {worker.permissionSelection.policy &&
                    worker.permissionSelection.policy !== 'bounded_allowlist' ? (
                      <option value={worker.permissionSelection.policy}>
                        {worker.permissionSelection.policy.replaceAll('_', ' ')}
                      </option>
                    ) : null}
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
              </fieldset>
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
