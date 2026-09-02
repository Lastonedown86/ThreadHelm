import { LaunchError } from '../launch/LaunchErrors.js';
import { MissionCourse } from './MissionCourse.js';
import type { ActionKind } from './mission-presentation.js';
import { MissionResult } from './MissionResult.js';
import { MissionSessionSummary } from './MissionSessionSummary.js';
import type { MissionWorkspaceState } from './useMissionWorkspace.js';

export function MissionWorkspace({
  workspace,
  onCreate,
  onAction,
}: {
  workspace: MissionWorkspaceState;
  onCreate(): void;
  onAction(kind: ActionKind): void;
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
  return (
    <article className="mission-workspace-content">
      <header>
        <span className="mission-lifecycle">{presentation.lifecycleLabel}</span>
        <h1 tabIndex={-1}>{presentation.title}</h1>
        {presentation.objective && presentation.objective !== presentation.title ? (
          <p>{presentation.objective}</p>
        ) : null}
        <div className="mission-action-row">
          {presentation.secondaryAction ? (
            <button type="button" onClick={() => onAction(presentation.secondaryAction!.kind)}>
              {presentation.secondaryAction.label}
            </button>
          ) : null}
          {presentation.primaryAction ? (
            <button
              type="button"
              className="primary"
              onClick={() => onAction(presentation.primaryAction!.kind)}
            >
              {presentation.primaryAction.label}
            </button>
          ) : null}
        </div>
      </header>
      <MissionCourse course={presentation.course} />
      <div className="mission-summary-grid">
        <MissionResult result={presentation.verifiedResult} />
        <MissionSessionSummary detail={detail} />
      </div>
    </article>
  );
}
