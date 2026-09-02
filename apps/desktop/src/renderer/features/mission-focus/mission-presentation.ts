import type {
  MissionDetailView,
  SupervisorAttemptView,
  SupervisorWorkView,
} from '@threadhelm/contracts';
import { reasonLabel } from './reason-labels.js';

export type MissionAttention = 'none' | 'decision' | 'recovery' | 'uncertain';
export type CourseNodeState = 'verified' | 'current' | 'queued' | 'waiting' | 'uncertain' | 'held';
export type ActionKind = 'pause' | 'resume' | 'review' | 'inspect' | 'view_evidence';
export interface ActionSpec {
  kind: ActionKind;
  label: string;
}
export type NodeAction =
  | { kind: 'open_terminal'; sessionId: string; label: 'Open terminal' }
  | { kind: 'review'; label: 'Review choices…' }
  | { kind: 'inspect'; label: 'Inspect evidence…' };
export interface CourseNode {
  id: string;
  index: number;
  title: string;
  state: CourseNodeState;
  summary: string;
  action: NodeAction | null;
}
export interface MissionPresentation {
  title: string;
  objective: string | null;
  lifecycleLabel: string;
  attention: MissionAttention;
  attentionLabel: string | null;
  attentionSummary: string | null;
  primaryAction: ActionSpec | null;
  secondaryAction: ActionSpec | null;
  strip: { execution: string; decisionsPending: number; sessionsAttached: number };
  course: CourseNode[];
  verifiedResult: { explanation: string; evidence: string[] } | null;
}
export interface PresentationContext {
  liveSessionIds: ReadonlySet<string>;
}

/** Pause acts directly; the others open the detail dialog, so they end with an ellipsis. */
export const ACTION_LABELS: Record<ActionKind, string> = {
  pause: 'Pause mission',
  resume: 'Resume mission…',
  review: 'Review choices…',
  inspect: 'Inspect evidence…',
  view_evidence: 'View evidence…',
};

const action = (kind: ActionKind): ActionSpec => ({ kind, label: ACTION_LABELS[kind] });

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

const attentionLabels: Record<Exclude<MissionAttention, 'none'>, string> = {
  decision: 'Needs your decision',
  uncertain: 'Outcome uncertain',
  recovery: 'Recovery required',
};

function latestAttempt(workItemId: string, attempts: SupervisorAttemptView[]) {
  return attempts
    .filter((attempt) => attempt.workItemId === workItemId)
    .sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
}

function hasRetainedEvidence(workItemId: string, attempts: SupervisorAttemptView[]): boolean {
  return attempts.some(
    (attempt) =>
      attempt.workItemId === workItemId &&
      attempt.state === 'completed' &&
      attempt.evidenceRefs.length > 0,
  );
}

function nodeState(
  workItem: SupervisorWorkView,
  attempts: SupervisorAttemptView[],
): CourseNodeState {
  if (latestAttempt(workItem.id, attempts)?.state === 'unknown') return 'uncertain';
  switch (workItem.state) {
    case 'completed':
      return hasRetainedEvidence(workItem.id, attempts) ? 'verified' : 'held';
    case 'assigned':
    case 'running':
      return 'current';
    case 'blocked':
    case 'ready':
      return 'queued';
    case 'waiting':
    case 'escalated':
      return 'waiting';
    case 'failed':
    case 'cancelled':
      return 'held';
  }
}

function nodeSummary(workItem: SupervisorWorkView, state: CourseNodeState): string {
  if (state === 'uncertain') return 'The outcome is unknown; retained evidence is kept as it is.';
  if (state === 'verified') return 'Completed with retained evidence.';
  if (workItem.state === 'completed')
    return 'Completion is held because no retained evidence is referenced.';
  const reason = reasonLabel(workItem.reasonCode);
  if (reason) return reason;
  switch (state) {
    case 'current':
      return 'Work is running.';
    case 'queued':
      return workItem.state === 'blocked'
        ? `Waiting on ${workItem.dependencies.length} earlier step${workItem.dependencies.length === 1 ? '' : 's'}.`
        : 'Ready to start.';
    case 'waiting':
      return 'This step needs your decision before work continues.';
    case 'held':
      return workItem.state === 'cancelled' ? 'This step was cancelled.' : 'This step failed.';
  }
}

function nodeAction(
  workItem: SupervisorWorkView,
  state: CourseNodeState,
  context: PresentationContext,
): NodeAction | null {
  switch (state) {
    case 'current':
      return workItem.assignedSessionId && context.liveSessionIds.has(workItem.assignedSessionId)
        ? { kind: 'open_terminal', sessionId: workItem.assignedSessionId, label: 'Open terminal' }
        : null;
    case 'waiting':
      return { kind: 'review', label: 'Review choices…' };
    case 'uncertain':
    case 'held':
      return { kind: 'inspect', label: 'Inspect evidence…' };
    default:
      return null;
  }
}

function presentCourse(detail: MissionDetailView, context: PresentationContext): CourseNode[] {
  return [...detail.workItems]
    .sort((left, right) =>
      left.createdAt === right.createdAt
        ? left.id.localeCompare(right.id)
        : left.createdAt.localeCompare(right.createdAt),
    )
    .map((workItem, index) => {
      const state = nodeState(workItem, detail.attempts);
      return {
        id: workItem.id,
        index: index + 1,
        title: workItem.title ?? 'Work item content was deleted.',
        state,
        summary: nodeSummary(workItem, state),
        action: nodeAction(workItem, state, context),
      };
    });
}

function verifiedResult(detail: MissionDetailView): MissionPresentation['verifiedResult'] {
  const latest = [...detail.attempts]
    .filter((attempt) => attempt.state === 'completed' && attempt.evidenceRefs.length > 0)
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))[0];
  if (!latest) return null;
  return {
    explanation: latest.explanation ?? 'Completed work retained evidence.',
    evidence: latest.evidenceRefs.map((reference) => `${reference.kind} · ${reference.id}`),
  };
}

export function presentMission(
  detail: MissionDetailView,
  context: PresentationContext = { liveSessionIds: new Set() },
): MissionPresentation {
  const course = presentCourse(detail, context);
  const uncertain = course.some((node) => node.state === 'uncertain');
  const waitingNodes = course.filter((node) => node.state === 'waiting');
  const heldDecisions = detail.decisions.filter((decision) => decision.policyResult === 'held');
  const decisionsPending = waitingNodes.length + heldDecisions.length;

  const attention: MissionAttention = uncertain
    ? 'uncertain'
    : detail.state === 'recovery_required'
      ? 'recovery'
      : decisionsPending > 0
        ? 'decision'
        : 'none';

  const focusNode =
    course.find((node) => node.state === (attention === 'uncertain' ? 'uncertain' : 'waiting')) ??
    null;

  let lifecycleLabel = lifecycleLabels[detail.state];
  if (attention === 'uncertain') lifecycleLabel = 'Outcome uncertain';
  else if (attention === 'decision') lifecycleLabel = 'Waiting for you';

  let primaryAction: ActionSpec | null = null;
  let secondaryAction: ActionSpec | null = null;
  if (attention === 'uncertain' || attention === 'recovery') primaryAction = action('inspect');
  else if (attention === 'decision') primaryAction = action('review');
  else if (detail.state === 'running') primaryAction = action('pause');
  else if (detail.state === 'paused') primaryAction = action('resume');
  else if (detail.state === 'completed') primaryAction = action('view_evidence');
  if (attention !== 'none' && (detail.state === 'running' || detail.state === 'paused'))
    secondaryAction = action(detail.state === 'running' ? 'pause' : 'resume');

  const execution =
    attention === 'uncertain'
      ? 'Held with uncertain outcome'
      : attention === 'recovery'
        ? 'Recovery required'
        : attention === 'decision'
          ? 'Waiting for your decision'
          : detail.state === 'running'
            ? 'Work continues locally'
            : detail.state === 'paused'
              ? 'Paused by you'
              : lifecycleLabels[detail.state];

  const sessionsAttached = new Set(
    (detail.envelope?.bindings ?? []).flatMap((binding) =>
      binding.sessionId ? [binding.sessionId] : [],
    ),
  ).size;

  return {
    title: missionTitle(detail.envelope?.objective, detail.id),
    objective: detail.envelope?.objective ?? 'Mission content was deleted.',
    lifecycleLabel,
    attention,
    attentionLabel: attention === 'none' ? null : attentionLabels[attention],
    attentionSummary:
      attention === 'none'
        ? null
        : (focusNode?.title ?? reasonLabel(detail.reasonCode) ?? lifecycleLabel),
    primaryAction,
    secondaryAction,
    strip: { execution, decisionsPending, sessionsAttached },
    course,
    verifiedResult: verifiedResult(detail),
  };
}
