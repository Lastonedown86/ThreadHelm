import type {
  MissionDetailView,
  SupervisorAttemptView,
  SupervisorWorkView,
} from '@threadhelm/contracts';

export type MissionAttention = 'none' | 'decision' | 'recovery' | 'uncertain';
export type CourseNodeState = 'verified' | 'current' | 'queued' | 'held';

export interface MissionPresentation {
  title: string;
  objective: string | null;
  lifecycleLabel: string;
  attention: MissionAttention;
  primaryAction: 'pause' | 'resume' | 'inspect' | 'view_evidence' | null;
  course: Array<{
    id: string;
    title: string;
    state: CourseNodeState;
    summary: string;
  }>;
}

/** First line of the objective, clipped for headings; the id only when content is gone. */
export function missionTitle(objective: string | null | undefined, id: string): string {
  const first = objective?.split('\n')[0]?.trim();
  if (!first) return `Mission ${id.slice(0, 8)}`;
  return first.length > 80 ? `${first.slice(0, 79).trimEnd()}…` : first;
}

const lifecycleLabels: Record<MissionDetailView['state'], string> = {
  running: 'Running',
  paused: 'Paused',
  recovery_required: 'Recovery required',
  completed: 'Completed',
  cancelled: 'Cancelled',
  deleted: 'Deleted',
};

function hasRetainedEvidence(workItemId: string, attempts: SupervisorAttemptView[]): boolean {
  return attempts.some(
    (attempt) =>
      attempt.workItemId === workItemId &&
      attempt.state === 'completed' &&
      attempt.evidenceRefs.length > 0,
  );
}

function presentWorkItem(
  workItem: SupervisorWorkView,
  attempts: SupervisorAttemptView[],
): MissionPresentation['course'][number] {
  const evidenced = hasRetainedEvidence(workItem.id, attempts);
  let state: CourseNodeState;

  if (workItem.state === 'completed') state = evidenced ? 'verified' : 'held';
  else if (workItem.state === 'running' || workItem.state === 'assigned') state = 'current';
  else if (workItem.state === 'ready') state = 'queued';
  else state = 'held';

  const summary =
    workItem.state === 'completed' && !evidenced
      ? 'Completion is held because no retained evidence is referenced.'
      : workItem.reasonCode
        ? `Reason: ${workItem.reasonCode}`
        : workItem.state === 'completed'
          ? 'Completed with retained evidence.'
          : `Work is ${workItem.state}.`;

  return {
    id: workItem.id,
    title: workItem.title ?? 'Work item content was deleted.',
    state,
    summary,
  };
}

function missionAttention(detail: MissionDetailView, hasUnknownAttempt: boolean): MissionAttention {
  if (hasUnknownAttempt) return 'uncertain';
  if (detail.state === 'recovery_required') return 'recovery';
  if (
    detail.decisions.some((decision) => decision.policyResult === 'held') ||
    detail.workItems.some((item) => item.state === 'waiting' || item.state === 'escalated')
  )
    return 'decision';
  return 'none';
}

function primaryAction(
  detail: MissionDetailView,
  hasUnknownAttempt: boolean,
): MissionPresentation['primaryAction'] {
  if (hasUnknownAttempt) return 'inspect';
  if (detail.state === 'running') return 'pause';
  if (detail.state === 'paused') return 'resume';
  if (detail.state === 'recovery_required') return 'inspect';
  if (detail.state === 'completed') return 'view_evidence';
  return null;
}

export function presentMission(detail: MissionDetailView): MissionPresentation {
  const hasUnknownAttempt = detail.attempts.some((attempt) => attempt.state === 'unknown');
  const objective = detail.envelope?.objective ?? 'Mission content was deleted.';

  return {
    title: missionTitle(detail.envelope?.objective, detail.id),
    objective,
    lifecycleLabel: lifecycleLabels[detail.state],
    attention: missionAttention(detail, hasUnknownAttempt),
    primaryAction: primaryAction(detail, hasUnknownAttempt),
    course: [...detail.workItems]
      .sort((left, right) =>
        left.createdAt === right.createdAt
          ? left.id.localeCompare(right.id)
          : left.createdAt.localeCompare(right.createdAt),
      )
      .map((workItem) => presentWorkItem(workItem, detail.attempts)),
  };
}
