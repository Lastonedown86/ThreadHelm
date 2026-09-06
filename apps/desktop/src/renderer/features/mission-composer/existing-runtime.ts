import type { MissionEligibleSessionView } from '@threadhelm/contracts';
import type { WorkerFields } from './composer-fields.js';

// Compare the entire recorded tuple independent of property order after storage round trips.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return JSON.stringify(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  return JSON.stringify(value) ?? 'undefined';
}
export function existingRuntimeIssue(
  worker: WorkerFields,
  sessions: MissionEligibleSessionView[],
  index: number,
): string | null {
  if (!worker.sessionId) return null;
  const session = sessions.find((s) => s.sessionId === worker.sessionId);
  if (!session)
    return `Worker ${index + 1}'s selected session is no longer eligible. Choose a live session or switch to a new session.`;
  if (
    worker.workspaceId !== session.workspaceId ||
    worker.autoStart ||
    canonical(worker.runtimeSelection) !== canonical(session.runtimeSelection) ||
    canonical(worker.permissionSelection) !== canonical(session.permissionSelection) ||
    canonical(worker.executionBounds) !== canonical(session.executionBounds)
  )
    return `Worker ${index + 1}'s saved settings differ from its recorded launch. Use recorded settings or switch to a new session.`;
  return null;
}
