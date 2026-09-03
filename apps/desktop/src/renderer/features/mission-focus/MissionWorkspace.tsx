import { useEffect, useRef, useState } from 'react';
import { LaunchError } from '../launch/LaunchErrors.js';
import { MissionCourse } from './MissionCourse.js';
import type { ActionKind } from './mission-presentation.js';
import { MissionResult } from './MissionResult.js';
import { MissionSessionSummary } from './MissionSessionSummary.js';
import { MissionStrip } from './MissionStrip.js';
import type { MissionWorkspaceState } from './useMissionWorkspace.js';

export function MissionWorkspace({
  workspace,
  onOpenDetail,
  onAction,
  onOpenTerminal,
}: {
  workspace: MissionWorkspaceState;
  onOpenDetail(): void;
  onAction(kind: ActionKind): void;
  onOpenTerminal(sessionId: string): void;
}) {
  const [announcement, setAnnouncement] = useState('');
  const detailId = workspace.detail?.id ?? null;
  const attentionLabel = workspace.presentation?.attentionLabel ?? null;
  const lifecycle = workspace.presentation?.lifecycleLabel ?? null;
  const title = workspace.presentation?.title ?? null;
  const lastId = useRef<string | null>(null);
  const lastAttention = useRef<string | null>(null);
  useEffect(() => {
    if (!detailId || !title) return;
    if (detailId !== lastId.current) {
      lastId.current = detailId;
      lastAttention.current = attentionLabel;
      setAnnouncement(`Mission changed: ${title}, ${lifecycle}`);
    } else if (attentionLabel !== lastAttention.current) {
      lastAttention.current = attentionLabel;
      if (attentionLabel) setAnnouncement(attentionLabel);
    }
  }, [detailId, title, lifecycle, attentionLabel]);

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
          Use <strong>New mission…</strong> in the rail. You will describe one outcome, choose the
          crew, set access and limits, then review the exact mission before anything starts.
        </p>
      </div>
    );

  const { detail, presentation } = workspace;
  return (
    <article className="mission-workspace-content">
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <header className="mission-header">
        <div>
          <span className="mission-lifecycle">
            <span>{presentation.lifecycleLabel}</span> · local
          </span>
          <h1 tabIndex={-1}>{presentation.title}</h1>
          {presentation.objective && presentation.objective !== presentation.title ? (
            <p>{presentation.objective}</p>
          ) : null}
        </div>
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
      <MissionStrip strip={presentation.strip} state={detail.state} />
      <MissionCourse
        course={presentation.course}
        onOpenDetail={onOpenDetail}
        onOpenTerminal={onOpenTerminal}
      />
      {presentation.verifiedResult ? null : (
        <p className="mission-result-note">No verified result yet.</p>
      )}
      <div className="mission-summary-grid">
        {presentation.verifiedResult ? (
          <MissionResult result={presentation.verifiedResult} onOpenDetail={onOpenDetail} />
        ) : null}
        <MissionSessionSummary detail={detail} />
      </div>
    </article>
  );
}
