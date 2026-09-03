import type { ApprovedWorkspaceView, MissionBounds, ReadinessView } from '@threadhelm/contracts';
import type { StageProps } from './OutcomeStage.js';
import { BOUND_LABELS, DEFAULT_BOUNDS, accessReason, limitsSummary } from './composer-fields.js';

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
}: StageProps & {
  workspaces: ApprovedWorkspaceView[];
  readiness: ReadinessView[];
  providersInUse: ReadinessView['providerId'][];
}) {
  const workers = fields.workers ?? [];
  const modes = new Map((fields.workspaces ?? []).map((w) => [w.workspaceId, w.mode] as const));
  const approved = workspaces.filter((w) => !w.revokedAt);
  const setWorkspace = (index: number, workspaceId: string | null) => {
    const next = workers.map((w, i) => (i === index ? { ...w, workspaceId } : w));
    const ids = [
      ...new Set(next.map((w) => w.workspaceId).filter((id): id is string => id !== null)),
    ];
    setFields({
      workers: next,
      workspaces: ids.map((id) => ({ workspaceId: id, mode: modes.get(id) ?? 'write' })),
    });
  };
  const setMode = (workspaceId: string, mode: 'read' | 'write') =>
    setFields({
      workspaces: (fields.workspaces ?? []).map((w) =>
        w.workspaceId === workspaceId ? { ...w, mode } : w,
      ),
    });
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
            No approved folder yet. Go to Settings and approve a folder, then come back to choose
            it here.
          </p>
        ) : null}
        {workers.map((worker, index) => {
          const n = index + 1;
          const mode = worker.workspaceId ? (modes.get(worker.workspaceId) ?? 'write') : null;
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
              {worker.workspaceId && mode ? (
                <fieldset className="composer-mode">
                  <legend>Worker {n} access</legend>
                  <label className="check">
                    <input
                      type="radio"
                      name={`mode-${index}`}
                      checked={mode === 'read'}
                      onChange={() => setMode(worker.workspaceId!, 'read')}
                    />
                    Read
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      name={`mode-${index}`}
                      checked={mode === 'write'}
                      onChange={() => setMode(worker.workspaceId!, 'write')}
                    />
                    Write
                  </label>
                  <p className="hint">{accessReason(mode)}</p>
                </fieldset>
              ) : null}
            </div>
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
          {(Object.keys(BOUND_LABELS) as (keyof MissionBounds)[]).map((key) => (
            <label key={key} className="field">
              {BOUND_LABELS[key]}
              <input
                type="number"
                min={1}
                value={bounds[key]}
                onChange={(event) =>
                  setFields({ bounds: { ...bounds, [key]: Number(event.target.value) } })
                }
              />
            </label>
          ))}
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
