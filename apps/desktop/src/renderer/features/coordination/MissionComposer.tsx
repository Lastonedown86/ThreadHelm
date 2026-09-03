import { useEffect, useRef, useState } from 'react';
import type {
  MissionDetailView,
  MissionEnvelopeInput,
  MissionPreviewView,
  OperationResponse,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { LaunchError } from '../launch/LaunchErrors.js';
import { MissionEnvelopeDisclosure } from '../mission-composer/MissionEnvelopeDisclosure.js';
import { ModalDialog } from './ModalDialog.js';

type Profile = OperationResponse<'profiles.list'>['profiles'][number];
type Worker = MissionEnvelopeInput['workers'][number];
type Eligible = OperationResponse<'missions.eligibleSessions'>[number];
const executionBounds = {
  maxElapsedMs: 1_800_000,
  maxTurns: 64,
  maxNoProgressMs: 300_000,
  maxOutputBytes: 8_388_608,
  maxConcurrentProcesses: 8,
};
const defaultBounds = {
  ...executionBounds,
  maxConcurrentProcesses: 16,
  maxWorkers: 4,
  maxWorkItems: 64,
  maxDepth: 8,
  maxAttempts: 3,
  maxTokenBudget: 250_000,
};
const boundLabels: Record<keyof typeof defaultBounds, string> = {
  maxElapsedMs: 'Elapsed limit (ms)',
  maxTurns: 'Turn limit',
  maxNoProgressMs: 'No-progress limit (ms)',
  maxOutputBytes: 'Output limit (bytes)',
  maxConcurrentProcesses: 'Process limit',
  maxWorkers: 'Concurrent worker limit',
  maxWorkItems: 'Work item limit',
  maxDepth: 'Decomposition depth limit',
  maxAttempts: 'Attempt limit',
  maxTokenBudget: 'Token budget',
};

function AllowedToolsInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange(value: string[]): void;
}) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => {
    const parsed = text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (JSON.stringify(parsed) !== JSON.stringify(value)) setText(value.join(', '));
  }, [value, text]);
  return (
    <label className="field">
      {label}
      <input
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(
            event.target.value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          );
        }}
      />
    </label>
  );
}

export function MissionComposer({
  current: requestedCurrent,
  onSaved,
  onClose,
}: {
  current?: MissionDetailView;
  onSaved(value: MissionDetailView): void;
  onClose(): void;
}) {
  const { state } = useStore();
  // Keep the version paired with the fields the user started editing. A live
  // event must not silently turn stale fields into a revision of newer authority.
  const [current] = useState(requestedCurrent);
  const reviewRef = useRef<HTMLDivElement>(null);
  const objectiveRef = useRef<HTMLTextAreaElement>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [objective, setObjective] = useState(current?.input?.objective ?? '');
  const [completionEvidence, setCompletionEvidence] = useState(
    current?.input?.completionEvidence ?? '',
  );
  const [supervisorProfile, setSupervisorProfile] = useState(
    current?.input?.supervisor.profileId ?? '',
  );
  const [supervisorSession, setSupervisorSession] = useState(
    current?.input?.supervisor.sessionId ?? '',
  );
  const [workers, setWorkers] = useState<Worker[]>(current?.input?.workers ?? []);
  const [bounds, setBounds] = useState(current?.input?.bounds ?? defaultBounds);
  const [modes, setModes] = useState<Record<string, 'read' | 'write'>>(
    Object.fromEntries(current?.input?.workspaces.map((w) => [w.workspaceId, w.mode]) ?? []),
  );
  const [preview, setPreview] = useState<MissionPreviewView | null>(null);
  useEffect(() => {
    if (preview) reviewRef.current?.querySelector('h3')?.focus();
    else objectiveRef.current?.focus();
  }, [preview]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      call(api.profiles.list({ state: 'active', limit: 100 })),
      call(api.missions.eligibleSessions(undefined)),
    ])
      .then(([roster, sessions]) => {
        if (!cancelled) {
          setProfiles(roster.profiles);
          setEligible(sessions);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const supervisor = eligible.find((session) => session.sessionId === supervisorSession);
  const workspaceIds = [
    ...new Set([
      ...(supervisor ? [supervisor.workspaceId] : []),
      ...workers.map((worker) => worker.workspaceId),
    ]),
  ];
  const profile = profiles.find((item) => item.profileId === supervisorProfile);
  const valid = Boolean(
    objective.trim() &&
    completionEvidence.trim() &&
    profile &&
    supervisor &&
    workers.length &&
    workers.every((w) => w.profileId && w.workspaceId && (w.sessionId || w.autoStart) && w.assignment.trim() && w.requiredReturnEvidence.length > 0),
  );
  const workerPatch = (index: number, patch: Partial<Worker>) =>
    setWorkers((old) => old.map((worker, i) => (i === index ? { ...worker, ...patch } : worker)));
  const workspaceName = (id: string) =>
    state.workspaces.find((w) => w.id === id)?.displayPath ?? id;
  async function review() {
    if (!valid || !profile || busy) return;
    setBusy(true);
    setError(null);
    setConfirmed(false);
    try {
      const envelope: MissionEnvelopeInput = {
        objective,
        completionEvidence,
        supervisor: {
          profileId: profile.profileId,
          profileRevisionId: profile.currentRevisionId,
          sessionId: supervisorSession,
        },
        workspaces: workspaceIds.map((workspaceId) => ({
          workspaceId,
          mode: modes[workspaceId] ?? 'write',
        })),
        workers,
        bounds,
        exclusions: current?.input?.exclusions ?? [],
        permittedRoutineActions: current?.input?.permittedRoutineActions ?? [
          'decompose',
          'assign',
          'retry',
          'reassign',
          'pause',
          'complete',
        ],
        knownSafeRetryClasses: ['failed_before_effect'],
        escalationRules: ['consequential', 'unknown', 'bounds', 'supervisor_loss'],
      };
      setPreview(
        await call(
          current
            ? api.missions.previewRevision({
                missionId: current.id,
                expectedVersion: current.version,
                envelope,
              })
            : api.missions.preview({ envelope }),
        ),
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview || !confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await call(
          current
            ? api.missions.confirmRevision({
                previewToken: preview.previewToken,
                boundaryConfirmation: true,
              })
            : api.missions.confirm({
                previewToken: preview.previewToken,
                boundaryConfirmation: true,
              }),
        ),
      );
    } catch (cause) {
      setError(cause);
      setPreview(null);
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ModalDialog
      label={current ? 'Revise mission envelope' : 'Create mission'}
      onDismiss={() => {
        if (!busy) onClose();
      }}
    >
      <h2>{current ? 'Revise mission envelope' : 'Create mission'}</h2>
      <LaunchError error={error} />
      {preview ? (
        <>
          <div ref={reviewRef}>
            <MissionEnvelopeDisclosure preview={preview} />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm this exact mission and folder-access boundary
          </label>
          <div className="actions">
            <button
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setConfirmed(false);
              }}
            >
              Back to mission
            </button>
            <button disabled={busy || !confirmed} onClick={() => void confirm()}>
              {current ? 'Confirm revision' : 'Start mission'}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            Objective
            <textarea
              ref={objectiveRef}
              maxLength={4000}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field">
            Completion evidence
            <textarea
              maxLength={2000}
              value={completionEvidence}
              onChange={(e) => setCompletionEvidence(e.target.value)}
              disabled={busy}
            />
          </label>
          <p className="hint">
            Choose a reviewed profile and an eligible live session for the supervisor. A profile
            grants no mission authority until this exact envelope is confirmed.
          </p>
          <label className="field">
            Supervisor profile
            <select
              value={supervisorProfile}
              disabled={busy}
              onChange={(e) => setSupervisorProfile(e.target.value)}
            >
              <option value="">Choose reviewed profile</option>
              {profiles.map((p) => (
                <option key={p.profileId} value={p.profileId}>
                  {p.displayName} · {p.currentRevisionId.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Supervisor session
            <select
              value={supervisorSession}
              disabled={busy}
              onChange={(e) => setSupervisorSession(e.target.value)}
            >
              <option value="">Choose live session</option>
              {eligible.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.providerId} · {workspaceName(s.workspaceId)} · {s.sessionId.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          {!eligible.length ? (
            <p className="hint">
              Launch a session with current runtime settings first. Sessions without a verified
              launch snapshot cannot be bound.
            </p>
          ) : null}
          {workers.map((worker, index) => (
            <fieldset key={index} className="launch-settings" disabled={busy}>
              <legend>Worker {index + 1}</legend>
              <label className="field">
                Worker {index + 1} profile
                <select
                  value={worker.profileId}
                  onChange={(e) => {
                    const p = profiles.find((p) => p.profileId === e.target.value)!;
                    workerPatch(index, {
                      profileId: p.profileId,
                      profileRevisionId: p.currentRevisionId,
                      runtimeSelection: { model: p.requestedModel, effort: null },
                    });
                  }}
                >
                  {profiles.map((p) => (
                    <option key={p.profileId} value={p.profileId}>
                      {p.displayName} · {p.currentRevisionId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Worker {index + 1} role
                <select
                  value={worker.role}
                  onChange={(e) => workerPatch(index, { role: e.target.value as Worker['role'] })}
                >
                  {['worker', 'reviewer', 'triage'].map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Worker {index + 1} assignment
                <textarea
                  rows={2}
                  value={worker.assignment}
                  onChange={(event) => workerPatch(index, { assignment: event.target.value })}
                />
              </label>
              <AllowedToolsInput
                label={`Worker ${index + 1} return evidence`}
                value={worker.requiredReturnEvidence}
                onChange={(value) => workerPatch(index, { requiredReturnEvidence: value })}
              />
              <label className="field">
                Worker {index + 1} session
                <select
                  value={worker.sessionId ?? ''}
                  onChange={(e) => {
                    const s = eligible.find((s) => s.sessionId === e.target.value);
                    workerPatch(
                      index,
                      s
                        ? {
                            sessionId: s.sessionId,
                            workspaceId: s.workspaceId,
                            autoStart: false,
                            runtimeSelection: s.runtimeSelection,
                            permissionSelection: s.permissionSelection,
                            executionBounds: s.executionBounds,
                          }
                        : { sessionId: null },
                    );
                  }}
                >
                  <option value="">Offline worker</option>
                  {eligible
                    .filter((s) => s.sessionId !== supervisorSession)
                    .map((s) => (
                      <option key={s.sessionId} value={s.sessionId}>
                        {s.providerId} · {workspaceName(s.workspaceId)} · {s.sessionId.slice(0, 8)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Worker {index + 1} workspace
                <select
                  value={worker.workspaceId}
                  disabled={Boolean(worker.sessionId)}
                  onChange={(e) => workerPatch(index, { workspaceId: e.target.value })}
                >
                  {state.workspaces
                    .filter((w) => !w.revokedAt)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.displayPath}
                      </option>
                    ))}
                </select>
              </label>
              {!worker.sessionId ? (
                <>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={worker.autoStart}
                      onChange={(e) => workerPatch(index, { autoStart: e.target.checked })}
                    />
                    Authorize automatic startup of worker {index + 1} within this mission
                  </label>
                  <label className="field">
                    Worker {index + 1} model
                    <select
                      value={
                        worker.runtimeSelection.model === null
                          ? ''
                          : worker.runtimeSelection.model ===
                              profiles.find((p) => p.profileId === worker.profileId)?.requestedModel
                            ? worker.runtimeSelection.model
                            : '__custom__'
                      }
                      onChange={(e) =>
                        workerPatch(index, {
                          runtimeSelection: {
                            ...worker.runtimeSelection,
                            model:
                              e.target.value === '__custom__'
                                ? 'custom-model'
                                : e.target.value || null,
                          },
                        })
                      }
                    >
                      <option value="">CLI default</option>
                      <option
                        value={
                          profiles.find((p) => p.profileId === worker.profileId)?.requestedModel
                        }
                      >
                        Profile model:{' '}
                        {profiles.find((p) => p.profileId === worker.profileId)?.requestedModel}
                      </option>
                      <option value="__custom__">Custom model…</option>
                    </select>
                  </label>
                  {worker.runtimeSelection.model &&
                  worker.runtimeSelection.model !==
                    profiles.find((p) => p.profileId === worker.profileId)?.requestedModel ? (
                    <label className="field">
                      Worker {index + 1} custom model
                      <input
                        maxLength={128}
                        value={worker.runtimeSelection.model}
                        onChange={(e) =>
                          workerPatch(index, {
                            runtimeSelection: { ...worker.runtimeSelection, model: e.target.value },
                          })
                        }
                      />
                    </label>
                  ) : null}
                  <label className="field">
                    Worker {index + 1} effort
                    <select
                      value={worker.runtimeSelection.effort ?? ''}
                      onChange={(e) =>
                        workerPatch(index, {
                          runtimeSelection: {
                            ...worker.runtimeSelection,
                            effort:
                              (e.target.value as Worker['runtimeSelection']['effort']) || null,
                          },
                        })
                      }
                    >
                      <option value="">CLI default</option>
                      {['low', 'medium', 'high', 'xhigh', 'max'].map((effort) => (
                        <option key={effort}>{effort}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Worker {index + 1} permission
                    <select
                      value={worker.permissionSelection.policy ?? 'manual'}
                      onChange={(e) =>
                        workerPatch(index, {
                          permissionSelection: {
                            policy: e.target.value as Worker['permissionSelection']['policy'],
                            boundedAllowlist: [],
                          },
                        })
                      }
                    >
                      <option value="manual">Manual</option>
                      <option value="auto">Auto (requires exact provider proof)</option>
                      <option value="bounded_allowlist">Bounded allowlist</option>
                    </select>
                  </label>
                  {worker.permissionSelection.policy === 'bounded_allowlist' ? (
                    <AllowedToolsInput
                      label={`Worker ${index + 1} allowed tools`}
                      value={worker.permissionSelection.boundedAllowlist}
                      onChange={(boundedAllowlist) =>
                        workerPatch(index, {
                          permissionSelection: {
                            ...worker.permissionSelection,
                            boundedAllowlist,
                          },
                        })
                      }
                    />
                  ) : null}
                  {Object.entries(worker.executionBounds).map(([key, value]) => (
                    <label key={key} className="field">
                      Worker {index + 1} {boundLabels[key as keyof typeof defaultBounds]}
                      <input
                        type="number"
                        min={1}
                        value={value}
                        onChange={(e) =>
                          workerPatch(index, {
                            executionBounds: {
                              ...worker.executionBounds,
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </>
              ) : (
                <p className="hint">
                  Model, effort, permission and bounds are copied from this session’s verified
                  launch. Review them in the exact envelope.
                </p>
              )}
              <button
                type="button"
                onClick={() => setWorkers((old) => old.filter((_, i) => i !== index))}
              >
                Remove worker {index + 1}
              </button>
            </fieldset>
          ))}
          <button
            disabled={busy || !profiles.length || !state.workspaces.length || workers.length >= 16}
            onClick={() => {
              const p = profiles[0]!;
              setWorkers((old) => [
                ...old,
                {
                  profileId: p.profileId,
                  profileRevisionId: p.currentRevisionId,
                  workspaceId: state.workspaces.find((w) => !w.revokedAt)?.id ?? '',
                  sessionId: null,
                  role: 'worker',
                  autoStart: false,
                  assignment: '',
                  requiredReturnEvidence: [],
                  runtimeSelection: { model: p.requestedModel, effort: null },
                  permissionSelection: { policy: 'manual', boundedAllowlist: [] },
                  executionBounds,
                },
              ]);
            }}
          >
            Add worker
          </button>
          {workspaceIds.map((id) => (
            <label key={id} className="field">
              Access to {workspaceName(id)}
              <select
                value={modes[id] ?? 'write'}
                onChange={(e) =>
                  setModes((old) => ({ ...old, [id]: e.target.value as 'read' | 'write' }))
                }
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
              </select>
            </label>
          ))}
          <fieldset className="launch-settings" disabled={busy}>
            <legend>Mission limits</legend>
            <div className="mission-limits-grid">
              {Object.entries(bounds).map(([key, value]) => (
                <label key={key} className="field">
                  {boundLabels[key as keyof typeof defaultBounds]}
                  <input
                    type="number"
                    min={1}
                    value={value}
                    onChange={(e) =>
                      setBounds((old) => ({ ...old, [key]: Number(e.target.value) }))
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <button disabled={!valid || busy} onClick={() => void review()}>
            Review mission
          </button>
        </>
      )}
      <button disabled={busy} onClick={onClose}>
        Cancel
      </button>
    </ModalDialog>
  );
}
