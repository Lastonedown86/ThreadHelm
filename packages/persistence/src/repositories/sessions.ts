/** AgentSession + SessionEvent repositories (T020). */

import { randomUUID } from 'node:crypto';
import type {
  AccessMode,
  ActivityState,
  Actor,
  EventKind,
  LifecycleState,
  ProviderId,
  SessionEventView,
  StopKind,
} from '@threadhelm/contracts';

import type { Db } from '../migrate.js';
import { assertNoRawContent, sanitizeSummary } from '../sanitize.js';

export interface AgentSessionRecord {
  id: string;
  workspaceId: string;
  definitionId: ProviderId;
  readinessSnapshotId: string;
  accessMode: AccessMode;
  lifecycleState: LifecycleState;
  activityState: ActivityState;
  activityEvidenceKind: string;
  activityObservedAt: string | null;
  hostPid: number | null;
  rootPid: number | null;
  columns: number;
  rows: number;
  startedAt: string | null;
  endedAt: string | null;
  exitCode: number | null;
  stopKind: StopKind | null;
  truncationCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SessionRow {
  id: string;
  workspace_id: string;
  definition_id: ProviderId;
  readiness_snapshot_id: string;
  access_mode: AccessMode;
  lifecycle_state: LifecycleState;
  activity_state: ActivityState;
  activity_evidence_kind: string;
  activity_observed_at: string | null;
  host_pid: number | null;
  root_pid: number | null;
  columns: number;
  rows: number;
  started_at: string | null;
  ended_at: string | null;
  exit_code: number | null;
  stop_kind: StopKind | null;
  truncation_count: number;
  created_at: string;
  updated_at: string;
}

const toSession = (r: SessionRow): AgentSessionRecord => ({
  id: r.id,
  workspaceId: r.workspace_id,
  definitionId: r.definition_id,
  readinessSnapshotId: r.readiness_snapshot_id,
  accessMode: r.access_mode,
  lifecycleState: r.lifecycle_state,
  activityState: r.activity_state,
  activityEvidenceKind: r.activity_evidence_kind,
  activityObservedAt: r.activity_observed_at,
  hostPid: r.host_pid,
  rootPid: r.root_pid,
  columns: r.columns,
  rows: r.rows,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  exitCode: r.exit_code,
  stopKind: r.stop_kind,
  truncationCount: r.truncation_count,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface SessionInsert {
  id?: string;
  workspaceId: string;
  definitionId: ProviderId;
  readinessSnapshotId: string;
  accessMode?: AccessMode;
  columns: number;
  rows: number;
  createdAt: string;
}

/** Everything that may change after `starting`. */
export type SessionPatch = Partial<
  Pick<
    AgentSessionRecord,
    | 'lifecycleState'
    | 'activityState'
    | 'activityEvidenceKind'
    | 'activityObservedAt'
    | 'hostPid'
    | 'rootPid'
    | 'columns'
    | 'rows'
    | 'startedAt'
    | 'endedAt'
    | 'exitCode'
    | 'stopKind'
    | 'truncationCount'
  >
>;

const PATCH_COLUMNS: Record<keyof SessionPatch, string> = {
  lifecycleState: 'lifecycle_state',
  activityState: 'activity_state',
  activityEvidenceKind: 'activity_evidence_kind',
  activityObservedAt: 'activity_observed_at',
  hostPid: 'host_pid',
  rootPid: 'root_pid',
  columns: 'columns',
  rows: 'rows',
  startedAt: 'started_at',
  endedAt: 'ended_at',
  exitCode: 'exit_code',
  stopKind: 'stop_kind',
  truncationCount: 'truncation_count',
};

const UNFINISHED: readonly LifecycleState[] = ['starting', 'running', 'interrupting', 'stopping'];

export class AgentSessionRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** Persists the `starting` record; call inside the launch transaction. */
  insertStarting(input: SessionInsert): AgentSessionRecord {
    const id = input.id ?? randomUUID();
    this.#db
      .prepare(
        `INSERT INTO agent_sessions
           (id, workspace_id, definition_id, readiness_snapshot_id, access_mode, lifecycle_state,
            activity_state, activity_evidence_kind, columns, rows, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'starting', 'unknown', 'none', ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.workspaceId,
        input.definitionId,
        input.readinessSnapshotId,
        input.accessMode ?? 'write_capable',
        input.columns,
        input.rows,
        input.createdAt,
        input.createdAt,
      );
    return this.findById(id)!;
  }

  findById(id: string): AgentSessionRecord | null {
    const row = this.#db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(id) as
      SessionRow | undefined;
    return row ? toSession(row) : null;
  }

  list(options: { limit?: number } = {}): AgentSessionRecord[] {
    const rows = this.#db
      .prepare('SELECT * FROM agent_sessions ORDER BY created_at DESC, id LIMIT ?')
      .all(options.limit ?? 500) as SessionRow[];
    return rows.map(toSession);
  }

  listUnfinished(): AgentSessionRecord[] {
    const placeholders = UNFINISHED.map(() => '?').join(', ');
    const rows = this.#db
      .prepare(`SELECT * FROM agent_sessions WHERE lifecycle_state IN (${placeholders})`)
      .all(...UNFINISHED) as SessionRow[];
    return rows.map(toSession);
  }

  listByWorkspace(workspaceId: string): AgentSessionRecord[] {
    const rows = this.#db
      .prepare('SELECT * FROM agent_sessions WHERE workspace_id = ? ORDER BY created_at DESC')
      .all(workspaceId) as SessionRow[];
    return rows.map(toSession);
  }

  update(id: string, patch: SessionPatch, updatedAt: string): AgentSessionRecord {
    assertNoRawContent(patch);
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      sets.push(`${PATCH_COLUMNS[key as keyof SessionPatch]} = ?`);
      values.push(value);
    }
    sets.push('updated_at = ?');
    values.push(updatedAt, id);
    this.#db.prepare(`UPDATE agent_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id)!;
  }
}

export interface SessionEventInsert {
  kind: EventKind;
  fromState: LifecycleState | null;
  toState: LifecycleState | null;
  actor: Actor;
  reasonCode: string | null;
  safeSummary: string;
  occurredAt: string;
}

interface EventRow {
  id: string;
  session_id: string;
  sequence: number;
  kind: EventKind;
  from_state: LifecycleState | null;
  to_state: LifecycleState | null;
  actor: Actor;
  reason_code: string | null;
  safe_summary: string;
  occurred_at: string;
}

const toEvent = (r: EventRow): SessionEventView => ({
  id: r.id,
  sessionId: r.session_id,
  sequence: r.sequence,
  kind: r.kind,
  fromState: r.from_state,
  toState: r.to_state,
  actor: r.actor,
  reasonCode: r.reason_code,
  safeSummary: r.safe_summary,
  occurredAt: r.occurred_at,
});

export class SessionEventRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** Next sequence is computed inside a transaction, so it is strictly increasing. */
  append(sessionId: string, input: SessionEventInsert): SessionEventView {
    assertNoRawContent({ reasonCode: input.reasonCode });
    const summary = sanitizeSummary(input.safeSummary);
    const id = randomUUID();
    this.#db.transaction(() => {
      const next = (
        this.#db
          .prepare(
            'SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM session_events WHERE session_id = ?',
          )
          .get(sessionId) as { n: number }
      ).n;
      this.#db
        .prepare(
          `INSERT INTO session_events
             (id, session_id, sequence, kind, from_state, to_state, actor, reason_code,
              safe_summary, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          sessionId,
          next,
          input.kind,
          input.fromState,
          input.toState,
          input.actor,
          input.reasonCode,
          summary,
          input.occurredAt,
        );
    })();
    return toEvent(
      this.#db.prepare('SELECT * FROM session_events WHERE id = ?').get(id) as EventRow,
    );
  }

  listBySession(sessionId: string): SessionEventView[] {
    const rows = this.#db
      .prepare('SELECT * FROM session_events WHERE session_id = ? ORDER BY sequence')
      .all(sessionId) as EventRow[];
    return rows.map(toEvent);
  }
}
