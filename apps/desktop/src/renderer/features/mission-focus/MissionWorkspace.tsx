import { LaunchError } from '../launch/LaunchErrors.js';
import { MissionCourse } from './MissionCourse.js';
import { MissionResult } from './MissionResult.js';
import { MissionSessionSummary } from './MissionSessionSummary.js';
import type { MissionWorkspaceState } from './useMissionWorkspace.js';

/** Pause acts directly; the others open the detail dialog, so they end with an ellipsis. */
const actionLabels = {
  pause: 'Pause mission',
  resume: 'Resume mission…',
  inspect: 'Inspect mission…',
  view_evidence: 'View evidence…',
} as const;

export function MissionWorkspace({
  workspace,
  onCreate,
  onOpenDetail,
  onPause,
}: {
  workspace: MissionWorkspaceState;
  onCreate(): void;
  onOpenDetail(): void;
  onPause(): void;
}) {
  if (workspace.loading && !workspace.detail)
    return (
      <p className="mission-workspace-state" role="status">
        Loading missions…
      </p>
    );
  if (workspace.error)
    return (
      <div className="mission-workspace-state">
        <h1 tabIndex={-1}>Missions unavailable</h1>
        <LaunchError error={workspace.error} />
      </div>
    );
  if (!workspace.detail || !workspace.presentation)
    return (
      <div className="mission-workspace-state">
        <h1 tabIndex={-1}>Start a mission</h1>
        <p>
          Create one bounded outcome, review its exact authority, then decide whether to start it.
        </p>
        <button type="button" className="primary" onClick={onCreate}>
          Create mission
        </button>
      </div>
    );

  const { detail, presentation } = workspace;
  const action = presentation.primaryAction;
  return (
    <article className="mission-workspace-content">
      <header>
        <span className="mission-lifecycle">{presentation.lifecycleLabel}</span>
        <h1 tabIndex={-1}>{presentation.title}</h1>
        {presentation.objective && presentation.objective !== presentation.title ? (
          <p>{presentation.objective}</p>
        ) : null}
        {action ? (
          <button
            type="button"
            className="primary"
            onClick={action === 'pause' ? onPause : onOpenDetail}
          >
            {actionLabels[action]}
          </button>
        ) : null}
      </header>
      <MissionCourse course={presentation.course} />
      <div className="mission-summary-grid">
        <MissionResult detail={detail} />
        <MissionSessionSummary detail={detail} />
      </div>
    </article>
  );
}
