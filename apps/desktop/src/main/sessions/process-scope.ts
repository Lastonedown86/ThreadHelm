/**
 * Process-scope inspection (T071). Job membership — not a PID walk — is the
 * authority for "what is still alive in this session".
 */

import type { Context, JobSnapshot, LiveSession } from '../context.js';
import { recordEvent } from './registry.js';

export interface ScopeReport {
  /** Processes that should not be alive: everything but the host, or everything once the host was told to shut down. */
  residual: number;
  hostAlive: boolean;
  processIds: number[];
  truncated: boolean;
}

export function inspectScope(ctx: Context, live: LiveSession, hostGone = false): ScopeReport {
  let snapshot: JobSnapshot;
  try {
    snapshot = ctx.native.inspectJob(live.jobToken);
  } catch {
    ctx.log.warn('scope.inspect_failed', { sessionId: live.id });
    return { residual: 0, hostAlive: false, processIds: [], truncated: true };
  }
  const hostAlive = snapshot.processIds.includes(live.hostPid);
  const others = snapshot.processIds.filter((pid) => pid !== live.hostPid);
  const residual = hostGone
    ? snapshot.activeProcessCount
    : Math.max(0, snapshot.activeProcessCount - (hostAlive ? 1 : 0));
  return { residual, hostAlive, processIds: others, truncated: snapshot.truncated };
}

const POLL_MS = 100;

/** Waits (bounded) for every non-host process in the scope to exit. */
export async function waitForScopeEmpty(
  ctx: Context,
  live: LiveSession,
  timeoutMs: number,
  hostGone = false,
): Promise<ScopeReport> {
  const deadline = Date.now() + timeoutMs;
  let report = inspectScope(ctx, live, hostGone);
  while (report.residual > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    report = inspectScope(ctx, live, hostGone);
  }
  return report;
}

/** Surfaces survivors after a stop level; never hides them (FR-029). */
export function reportResidual(ctx: Context, live: LiveSession, report: ScopeReport): void {
  if (report.residual === 0) return;
  ctx.log.warn('scope.residual_processes', {
    sessionId: live.id,
    residual: report.residual,
    truncated: report.truncated,
  });
  recordEvent(ctx, live.id, {
    kind: 'state_changed',
    actor: 'windows',
    reasonCode: 'RESIDUAL_PROCESSES',
    summary: `Processes still alive after stop: ${report.residual}`,
  });
}
