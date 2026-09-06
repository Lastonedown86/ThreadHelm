import type {
  ApprovedWorkspaceView,
  MissionBounds,
  OperationResponse,
  ReadinessView,
} from '@threadhelm/contracts';
import type { StageProps } from './OutcomeStage.js';
import {
  BOUND_LABELS,
  BOUND_MAX,
  BOUND_MIN,
  DEFAULT_BOUNDS,
  accessReason,
  boundOutOfRange,
  deriveWorkspaces,
  limitsSummary,
} from './composer-fields.js';

type Eligible = OperationResponse<'missions.eligibleSessions'>[number];

// ponytail: only two providers exist (ProviderId), no shared label module needed yet.
const PROVIDER_LABEL: Record<ReadinessView['providerId'], string> = {
  'codex-cli': 'Codex CLI',
  'claude-code': 'Claude Code',
};

const WITHHELD = [
  'Break-glass bypass',
  'Parent or sibling folders',
  'Automatic startup unless chosen per worker',
  'Consequential external actions without your approval',
  'Provider or model substitution',
];

export function AccessStage({
  fields,
  setFields,
  invalid,
  workspaces,
  readiness,
  providersInUse,
  eligible,
}: StageProps & {
  workspaces: ApprovedWorkspaceView[];
  readiness: ReadinessView[];
  providersInUse: ReadinessView['providerId'][];
  eligible: Eligible[];
}) {
  const workers = fields.workers ?? [];
  const modes = new Map((fields.workspaces ?? []).map((w) => [w.workspaceId, w.mode] as const));
  const approved = workspaces.filter((w) => !w.revokedAt);
  const supervisorWorkspaceId =
    eligible.find((s) => s.sessionId === fields.supervisor?.sessionId)?.workspaceId ?? null;
  const setWorkspace = (index: number, workspaceId: string | null) => {
    const next = workers.map((w, i) => (i === index ? { ...w, workspaceId } : w));
    // Recomputed, not appended, so choosing a different folder for this
    // worker drops its old workspace instead of leaving a stale entry behind;
    // the supervisor's own entry is always kept.
    setFields({
      workers: next,
      workspaces: deriveWorkspaces({ ...fields, workers: next }, supervisorWorkspaceId),
    });
  };
  const setMode = (workspaceId: string, mode: 'read' | 'write') =>
    setFields({
      workspaces: modes.has(workspaceId)
        ? (fields.workspaces ?? []).map((w) => (w.workspaceId === workspaceId ? { ...w, mode } : w))
        : [...(fields.workspaces ?? []), { workspaceId, mode }],
    });
  const folders = deriveWorkspaces(fields, supervisorWorkspaceId).map(({ workspaceId }) => ({
    workspaceId,
    workspace: approved.find((w) => w.id === workspaceId),
    members: [
      ...(workspaceId === supervisorWorkspaceId ? ['Supervisor'] : []),
      ...workers.flatMap((w, index) =>
        w.workspaceId === workspaceId ? [`Worker ${index + 1} (${w.role})`] : [],
      ),
    ],
  }));
  const bounds: MissionBounds = fields.bounds ?? DEFAULT_BOUNDS;

  return (
    <div className="composer-stage-body">
      <section className="composer-card" aria-labelledby="composer-access-heading">
        <h2 id="composer-access-heading">Workspace access</h2>
        <p className="hint">
          Only folders you already approved appear here. ThreadHelm starts each worker inside its
          folder; it cannot confine what the provider does there.
        </p>
        {approved.length === 0 ? (
          <p className="hint">
            No approved folder yet. Go to Settings and approve a folder, then come back to choose it
            here.
          </p>
        ) : null}
        {workers.map((worker, index) => {
          const n = index + 1;
          if (approved.length === 0) return null;
          return (
            <div key={index} className="composer-access-row">
              <label className="field">
                Worker {n} folder
                <select
                  data-field={`workers.${index}.workspaceId`}
                  aria-invalid={invalid === `workers.${index}.workspaceId` || undefined}
                  value={worker.workspaceId ?? ''}
                  onChange={(event) => setWorkspace(index, event.target.value || null)}
                >
                  <option value="">Choose an approved folder</option>
                  {approved.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.displayPath}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
        <p className="hint">
          Access is shared by folder. Changing Read or Write applies to every member listed for that
          folder. These are mission rules, not operating-system confinement.
        </p>
        {!supervisorWorkspaceId ? (
          <p role="alert">
            The supervisor folder cannot be resolved from a live session. Return to Crew to select
            an eligible supervisor session.
          </p>
        ) : null}
        {folders.map(({ workspaceId, workspace, members }) => {
          const mode = modes.get(workspaceId);
          return (
            <fieldset
              key={workspaceId}
              className="composer-folder-access"
              aria-label={`Folder access: ${workspace?.displayPath ?? workspaceId}`}
            >
              <legend>Folder access: {workspace?.displayPath ?? workspaceId}</legend>
              <p>Applies to: {members.join(', ')}</p>
              {!workspace ? (
                <p role="alert">
                  This folder is unavailable or no longer approved. Review its approval in Settings
                  before continuing.
                </p>
              ) : null}
              <div className="composer-mode">
                {(['read', 'write'] as const).map((value) => (
                  <label key={value} className="check">
                    <input
                      type="radio"
                      name={`folder-mode-${workspaceId}`}
                      disabled={!workspace}
                      data-field={!mode && value === 'read' ? 'workspaces' : undefined}
                      aria-invalid={(invalid === 'workspaces' && !mode) || undefined}
                      checked={mode === value}
                      onChange={() => setMode(workspaceId, value)}
                    />
                    {value === 'read' ? 'Read' : 'Write'}
                  </label>
                ))}
              </div>
              <p className="hint">
                {mode ? accessReason(mode) : 'Choose Read or Write for this folder.'}
              </p>
            </fieldset>
          );
        })}
      </section>

      <section className="composer-card" aria-labelledby="composer-runtime-heading">
        <h2 id="composer-runtime-heading">Runtime readiness</h2>
        <ul className="list">
          {providersInUse.map((providerId) => {
            const r = readiness.find((item) => item.providerId === providerId);
            return (
              <li key={providerId}>
                <strong>{PROVIDER_LABEL[providerId]}</strong> ·{' '}
                {r
                  ? `${r.availability === 'available' ? 'Available' : r.availability} · ${r.safeSummary}`
                  : 'Not checked yet'}
              </li>
            );
          })}
        </ul>
        <p className="hint">
          Nothing here installs or signs in to a provider. Fix readiness in Settings.
        </p>
      </section>

      <details className="composer-card">
        <summary>Customize limits · {limitsSummary(bounds)}</summary>
        <div className="mission-limits-grid">
          {(Object.keys(BOUND_LABELS) as (keyof MissionBounds)[]).map((key) => {
            const outOfRange = boundOutOfRange(key, bounds[key]);
            return (
              <label key={key} className="field">
                {BOUND_LABELS[key]}
                <input
                  type="number"
                  min={BOUND_MIN[key]}
                  max={BOUND_MAX[key]}
                  data-field={`bounds.${key}`}
                  aria-invalid={outOfRange || invalid === `bounds.${key}` || undefined}
                  value={bounds[key]}
                  onChange={(event) =>
                    setFields({ bounds: { ...bounds, [key]: Number(event.target.value) } })
                  }
                />
                {outOfRange ? (
                  <span className="hint">
                    Must be a whole number between {BOUND_MIN[key].toLocaleString('en-US')} and{' '}
                    {BOUND_MAX[key].toLocaleString('en-US')}.
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </details>

      <section className="composer-card" aria-labelledby="composer-withheld-heading">
        <h2 id="composer-withheld-heading">What stays off</h2>
        <ul className="list">
          {WITHHELD.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
