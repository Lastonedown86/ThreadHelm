/**
 * Shared session core: view assembly, atomic lifecycle transitions (durable
 * state + SessionEvent in one transaction — invariant 5), and the serialized
 * control channel to a session's host.
 */

import {
  ThreadHelmError,
  type Actor,
  type EventKind,
  type LifecycleState,
  type MainToHostMessage,
  type SessionView,
} from '@threadhelm/contracts';
import { assertTransition } from '@threadhelm/domain';
import type { AgentSessionRecord, SessionPatch, Storage } from '@threadhelm/persistence';
import { now, type Context, type LiveSession } from '../context.js';

export function storageOf(ctx: Context): Storage {
  if (!ctx.storage) {
    throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Local storage is unavailable.');
  }
  return ctx.storage;
}

export function requireLive(ctx: Context, sessionId: string): LiveSession {
  const live = ctx.live.get(sessionId);
  if (!live) {
    throw new ThreadHelmError('SESSION_NOT_FOUND', 'That session is not running.', { sessionId });
  }
  return live;
}

export function requireRecord(ctx: Context, sessionId: string): AgentSessionRecord {
  const record = storageOf(ctx).repositories.sessions.findById(sessionId);
  if (!record) {
    throw new ThreadHelmError('SESSION_NOT_FOUND', 'That session does not exist.', { sessionId });
  }
  return record;
}

export function toSessionView(ctx: Context, record: AgentSessionRecord): SessionView {
  const live = ctx.live.get(record.id);
  const workspace = ctx.storage?.repositories.workspaces.findById(record.workspaceId);
  const adapter = ctx.adapters.find((candidate) => candidate.id === record.definitionId);
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    workspaceDisplayPath: workspace?.displayPath ?? '(unknown workspace)',
    providerId: record.definitionId,
    providerDisplayName: adapter?.displayName ?? record.definitionId,
    accessMode: record.accessMode,
    lifecycleState: live?.state ?? record.lifecycleState,
    activityState: record.activityState,
    activityEvidenceKind: record.activityEvidenceKind,
    activityObservedAt: record.activityObservedAt,
    columns: record.columns,
    rows: record.rows,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    exitCode: record.exitCode,
    stopKind: record.stopKind,
    truncationCount: record.truncationCount,
    forceStopAvailable: live?.forceStopAvailable ?? false,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function sessionView(ctx: Context, sessionId: string): SessionView {
  return toSessionView(ctx, requireRecord(ctx, sessionId));
}

export function currentState(ctx: Context, sessionId: string): LifecycleState {
  const live = ctx.live.get(sessionId);
  if (live) return live.state;
  return requireRecord(ctx, sessionId).lifecycleState;
}

export interface TransitionInput {
  to: LifecycleState;
  actor: Actor;
  kind: EventKind;
  reasonCode: string | null;
  summary: string;
  patch?: SessionPatch;
  /**
   * `required` (launch-path transitions) fails closed on a storage error;
   * the default is best-effort so safety controls still act on live processes
   * when the disk is failing (T084).
   */
  required?: boolean;
}

/** Lifecycle mutation committed atomically with its SessionEvent. */
export function transition(ctx: Context, sessionId: string, input: TransitionInput): SessionView {
  const from = currentState(ctx, sessionId);
  assertTransition(from, input.to);
  const at = now(ctx);
  const live = ctx.live.get(sessionId);
  let sequence = 0;

  const write = () => {
    const storage = storageOf(ctx);
    storage.repositories.transaction(() => {
      storage.repositories.sessions.update(
        sessionId,
        { ...input.patch, lifecycleState: input.to },
        at,
      );
      const event = storage.repositories.events.append(sessionId, {
        kind: input.kind,
        fromState: from,
        toState: input.to,
        actor: input.actor,
        reasonCode: input.reasonCode,
        safeSummary: input.summary,
        occurredAt: at,
      });
      sequence = event.sequence;
    });
  };
  if (input.required) ctx.health.required(write);
  else ctx.health.bestEffort(write);

  if (live) live.state = input.to;
  ctx.log.info('session.transition', {
    sessionId,
    from,
    to: input.to,
    reasonCode: input.reasonCode,
  });

  const view = ctx.storage ? sessionView(ctx, sessionId) : liveOnlyView(ctx, live!, at);
  ctx.events.emit('session.changed', { session: view, reasonCode: input.reasonCode, sequence });
  return view;
}

/** Non-transition history entry (interrupt requested, output truncated, …). */
export function recordEvent(
  ctx: Context,
  sessionId: string,
  input: { kind: EventKind; actor: Actor; reasonCode: string | null; summary: string },
): void {
  const state = currentState(ctx, sessionId);
  ctx.health.bestEffort(() => {
    storageOf(ctx).repositories.events.append(sessionId, {
      kind: input.kind,
      fromState: state,
      toState: state,
      actor: input.actor,
      reasonCode: input.reasonCode,
      safeSummary: input.summary,
      occurredAt: now(ctx),
    });
  });
}

export function emitChanged(ctx: Context, sessionId: string, reasonCode: string | null): void {
  if (!ctx.storage) return;
  ctx.events.emit('session.changed', {
    session: sessionView(ctx, sessionId),
    reasonCode,
    sequence: 0,
  });
}

/** Degraded fallback when storage is gone entirely: the live mirror only. */
function liveOnlyView(ctx: Context, live: LiveSession, at: string): SessionView {
  return {
    id: live.id,
    workspaceId: live.workspaceId,
    workspaceDisplayPath: live.canonicalPath,
    providerId: live.providerId,
    providerDisplayName: live.adapter.displayName,
    accessMode: 'write_capable',
    lifecycleState: live.state,
    activityState: 'unknown',
    activityEvidenceKind: 'none',
    activityObservedAt: null,
    columns: live.terminal.columns,
    rows: live.terminal.rows,
    startedAt: null,
    endedAt: null,
    exitCode: live.exit?.exitCode ?? null,
    stopKind: null,
    truncationCount: 0,
    forceStopAvailable: live.forceStopAvailable,
    createdAt: at,
    updatedAt: at,
  };
}

// --- serialized host controls ------------------------------------------------

export const CONTROL_ACK_TIMEOUT_MS = 5_000;

/**
 * Allocates the next control sequence, sends the message, and resolves true
 * when the host acknowledges it (false on timeout, send failure, or session
 * teardown). Ordering is guaranteed by the strictly increasing sequence and
 * the host's single queue.
 */
export function sendControl(
  ctx: Context,
  live: LiveSession,
  build: (controlSequence: number) => MainToHostMessage,
  timeoutMs = CONTROL_ACK_TIMEOUT_MS,
  beforeSubmit?: (controlSequence: number) => void,
): { controlSequence: number; applied: Promise<boolean>; submitted: boolean } {
  const controlSequence = ++live.controlSequence;
  let settle: (applied: boolean) => void = () => undefined;
  const applied = new Promise<boolean>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      live.pendingControls.delete(controlSequence);
      settle(false);
    }, timeoutMs);
    settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    live.pendingControls.set(controlSequence, settle);
  });
  try {
    beforeSubmit?.(controlSequence);
  } catch (error) {
    live.pendingControls.delete(controlSequence);
    settle(false);
    throw error;
  }
  let submitted = true;
  try {
    live.host.postMessage(build(controlSequence));
  } catch {
    submitted = false;
    live.pendingControls.delete(controlSequence);
    settle(false);
    ctx.log.warn('session.control_send_failed', { sessionId: live.id, controlSequence });
  }
  return { controlSequence, applied, submitted };
}
