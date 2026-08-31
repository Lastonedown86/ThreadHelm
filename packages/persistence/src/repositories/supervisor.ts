/** Main-owned transactional mission ledger. No provider or process APIs belong here. */
import { randomUUID } from 'node:crypto';
import {
  MissionDetailView,
  MissionEnvelopeInput,
  MissionEnvelopeView,
  MissionBindingView,
  SupervisorAttemptView,
  SupervisorDecisionView,
  SupervisorWorkView,
  ThreadHelmError,
  WorkerLeaseView,
  type MissionState,
  type MissionSummaryView,
  type SupervisorEvidenceRef,
  type SupervisorResultDisposition,
  type SupervisorWorkInput,
  type EventPayload,
} from '@threadhelm/contracts';
import {
  assertRoutineWorkAuthority,
  assertSafeRetry,
  assertWorkGraph,
  workerLeaseConflicts,
} from '@threadhelm/domain';
import type { Db } from '../migrate.js';

interface MissionRow {
  id: string;
  state: MissionState;
  version: number;
  supervisor_session_id: string | null;
  started_at: string;
  last_progress_at: string;
  turn_count: number;
  output_bytes: number;
  tokens_used: number;
  reason_code: string | null;
  created_at: string;
  updated_at: string;
}
interface JsonRow {
  view_json: string;
}
export interface DecisionInsert {
  missionId: string;
  supervisorSessionId: string;
  idempotencyKey: string;
  fingerprint: string;
  requestDigest: string;
  rationale: string;
  inputRefs: SupervisorEvidenceRef[];
  expectedEvidence: string;
  at: string;
}
export interface LeaseRecord extends WorkerLeaseView {
  plannedSessionId: string;
  volumeSerial: string;
  fileId: string;
}
export interface AttemptMetadata {
  bindingId: string;
  effect: 'none' | 'possible';
  retryClass: string | null;
  resultKey: string | null;
  resultDigest: string | null;
  turnCount: number;
  outputBytes: number;
  tokensUsed: number;
  lastProgressAt: string;
}
export class SupervisorRepository {
  readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  mission(id: string): MissionRow {
    const row = this.db.prepare('SELECT * FROM supervisor_missions WHERE id=?').get(id) as
      MissionRow | undefined;
    if (!row) throw new ThreadHelmError('MISSION_NOT_FOUND');
    return row;
  }
  envelope(id: string, version = this.mission(id).version): MissionEnvelopeView | null {
    const row = this.db
      .prepare('SELECT envelope_json FROM supervisor_envelopes WHERE mission_id=? AND version=?')
      .get(id, version) as { envelope_json: string | null } | undefined;
    return row?.envelope_json ? MissionEnvelopeView.parse(JSON.parse(row.envelope_json)) : null;
  }
  #input(id: string): MissionEnvelopeInput | null {
    const row = this.db
      .prepare('SELECT input_json FROM supervisor_envelopes WHERE mission_id=? AND version=?')
      .get(id, this.mission(id).version) as { input_json: string | null } | undefined;
    return row?.input_json ? MissionEnvelopeInput.parse(JSON.parse(row.input_json)) : null;
  }
  #count(sql: string, id: string): number {
    return (this.db.prepare(sql).get(id) as { n: number }).n;
  }
  summary(id: string): MissionSummaryView {
    const row = this.mission(id);
    return {
      id: row.id,
      state: row.state,
      version: row.version,
      supervisorSessionId: row.supervisor_session_id,
      workItemCount: this.#count(
        'SELECT COUNT(*) n FROM supervisor_work_items WHERE mission_id=?',
        id,
      ),
      completedWorkItemCount: this.#count(
        "SELECT COUNT(*) n FROM supervisor_work_items WHERE mission_id=? AND state='completed'",
        id,
      ),
      activeWorkerCount: this.#count(
        "SELECT COUNT(*) n FROM supervisor_worker_leases WHERE mission_id=? AND state IN ('reserved','active','unknown')",
        id,
      ),
      sequence: this.#count(
        'SELECT COALESCE(MAX(sequence),0) n FROM supervisor_events WHERE mission_id=?',
        id,
      ),
      reasonCode: row.reason_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  list(limit = 100): MissionSummaryView[] {
    return (
      this.db
        .prepare('SELECT id FROM supervisor_missions ORDER BY updated_at DESC,id LIMIT ?')
        .all(Math.max(1, Math.min(100, limit))) as { id: string }[]
    ).map((row) => this.summary(row.id));
  }
  runningIds(): string[] {
    return (
      this.db
        .prepare("SELECT id FROM supervisor_missions WHERE state='running' ORDER BY id")
        .all() as { id: string }[]
    ).map((row) => row.id);
  }
  monitoredIds(): string[] {
    return (
      this.db
        .prepare(
          "SELECT id FROM supervisor_missions m WHERE state='running' OR (state IN ('paused','recovery_required') AND EXISTS(SELECT 1 FROM supervisor_work_attempts a WHERE a.mission_id=m.id AND a.state IN ('reserved','assigned','running'))) ORDER BY id",
        )
        .all() as { id: string }[]
    ).map((row) => row.id);
  }
  /** A possible effect spends its entire allocation unless main has stronger usage evidence. */
  tokenCommitment(missionId: string): number {
    return this.attempts(missionId).reduce((total, attempt) => {
      const meta = this.attemptMetadata(attempt.id);
      const beforeEffectFailure = attempt.state === 'failed' && meta.effect === 'none';
      return (
        total +
        (beforeEffectFailure
          ? meta.tokensUsed
          : Math.max(attempt.reservedTokenBudget, meta.tokensUsed))
      );
    }, 0);
  }
  detail(id: string): MissionDetailView {
    return MissionDetailView.parse({
      ...this.summary(id),
      envelope: this.envelope(id),
      input: this.#input(id),
      workItems: this.workItems(id),
      decisions: this.decisions(id),
      leases: this.leases(id).map(
        ({ plannedSessionId: _p, volumeSerial: _v, fileId: _f, ...view }) => view,
      ),
      attempts: this.attempts(id),
    });
  }
  workItems(id: string): SupervisorWorkView[] {
    return (
      this.db
        .prepare('SELECT view_json FROM supervisor_work_items WHERE mission_id=? ORDER BY rowid')
        .all(id) as JsonRow[]
    ).map((r) => SupervisorWorkView.parse(JSON.parse(r.view_json)));
  }
  workItem(missionId: string, id: string): SupervisorWorkView {
    const row = this.db
      .prepare('SELECT view_json FROM supervisor_work_items WHERE id=? AND mission_id=?')
      .get(id, missionId) as JsonRow | undefined;
    if (!row) throw new ThreadHelmError('WORK_ITEM_NOT_FOUND');
    return SupervisorWorkView.parse(JSON.parse(row.view_json));
  }
  decisions(missionId: string): SupervisorDecisionView[] {
    return (
      this.db
        .prepare(
          'SELECT view_json FROM supervisor_decisions WHERE mission_id=? ORDER BY rowid DESC LIMIT 100',
        )
        .all(missionId) as JsonRow[]
    )
      .reverse()
      .map((r) => SupervisorDecisionView.parse(JSON.parse(r.view_json)));
  }
  decisionForKey(missionId: string, key: string, digest: string): SupervisorDecisionView | null {
    const row = this.db
      .prepare(
        'SELECT view_json,request_digest FROM supervisor_decisions WHERE mission_id=? AND idempotency_key=?',
      )
      .get(missionId, key) as (JsonRow & { request_digest: string | null }) | undefined;
    if (!row) return null;
    if (row.request_digest !== digest)
      throw new ThreadHelmError(
        'MISSION_ENVELOPE_STALE',
        'The decision key was already used for different content.',
      );
    return SupervisorDecisionView.parse(JSON.parse(row.view_json));
  }
  fingerprints(missionId: string): string[] {
    return (
      this.db
        .prepare(
          'SELECT fingerprint FROM supervisor_decisions WHERE mission_id=? ORDER BY rowid DESC LIMIT 7',
        )
        .all(missionId) as { fingerprint: string | null }[]
    )
      .reverse()
      .flatMap((r) => (r.fingerprint ? [r.fingerprint] : []));
  }
  attempts(missionId: string): SupervisorAttemptView[] {
    return (
      this.db
        .prepare('SELECT view_json FROM supervisor_work_attempts WHERE mission_id=? ORDER BY rowid')
        .all(missionId) as JsonRow[]
    ).map((r) => SupervisorAttemptView.parse(JSON.parse(r.view_json)));
  }
  attempt(id: string): SupervisorAttemptView {
    const row = this.db
      .prepare('SELECT view_json FROM supervisor_work_attempts WHERE id=?')
      .get(id) as JsonRow | undefined;
    if (!row) throw new ThreadHelmError('WORK_ITEM_NOT_FOUND');
    return SupervisorAttemptView.parse(JSON.parse(row.view_json));
  }
  attemptMetadata(id: string): AttemptMetadata {
    const row = this.db
      .prepare(
        'SELECT binding_id,effect,retry_class,result_key,result_digest,turn_count,output_bytes,tokens_used,last_progress_at FROM supervisor_work_attempts WHERE id=?',
      )
      .get(id) as
      | {
          binding_id: string;
          effect: 'none' | 'possible';
          retry_class: string | null;
          result_key: string | null;
          result_digest: string | null;
          turn_count: number;
          output_bytes: number;
          tokens_used: number;
          last_progress_at: string;
        }
      | undefined;
    if (!row) throw new ThreadHelmError('WORK_ITEM_NOT_FOUND');
    return {
      bindingId: row.binding_id,
      effect: row.effect,
      retryClass: row.retry_class,
      resultKey: row.result_key,
      resultDigest: row.result_digest,
      turnCount: row.turn_count,
      outputBytes: row.output_bytes,
      tokensUsed: row.tokens_used,
      lastProgressAt: row.last_progress_at,
    };
  }
  leases(missionId?: string): LeaseRecord[] {
    const rows = (
      missionId
        ? this.db
            .prepare('SELECT * FROM supervisor_worker_leases WHERE mission_id=? ORDER BY rowid')
            .all(missionId)
        : this.db.prepare('SELECT * FROM supervisor_worker_leases ORDER BY rowid').all()
    ) as (JsonRow & { planned_session_id: string; volume_serial: string; file_id: string })[];
    return rows.map((r) => ({
      ...WorkerLeaseView.parse(JSON.parse(r.view_json)),
      plannedSessionId: r.planned_session_id,
      volumeSerial: r.volume_serial,
      fileId: r.file_id,
    }));
  }
  roleForSession(sessionId: string): { missionId: string; bindingId: string; role: string } | null {
    const row = this.db
      .prepare(
        'SELECT mission_id,binding_id,role FROM supervisor_session_roles WHERE session_id=? AND active=1',
      )
      .get(sessionId) as { mission_id: string; binding_id: string; role: string } | undefined;
    return row ? { missionId: row.mission_id, bindingId: row.binding_id, role: row.role } : null;
  }
  bindSession(
    missionId: string,
    bindingId: string,
    sessionId: string,
    role: string,
    at: string,
  ): void {
    const old = this.roleForSession(sessionId);
    if (old) {
      if (old.missionId !== missionId || old.bindingId !== bindingId || old.role !== role)
        throw new ThreadHelmError('SUPERVISOR_NOT_BOUND');
      return;
    }
    this.db
      .prepare(
        'INSERT INTO supervisor_session_roles(mission_id,binding_id,session_id,role,active,created_at) VALUES(?,?,?,?,1,?)',
      )
      .run(missionId, bindingId, sessionId, role, at);
  }
  events(missionId: string): EventPayload<'mission.changed'>[] {
    return (
      this.db
        .prepare('SELECT * FROM supervisor_events WHERE mission_id=? ORDER BY sequence')
        .all(missionId) as {
        mission_id: string;
        sequence: number;
        state: MissionState;
        work_item_id: string | null;
        reason_code: string | null;
      }[]
    ).map((r) => ({
      missionId: r.mission_id,
      sequence: r.sequence,
      state: r.state,
      workItemId: r.work_item_id,
      reasonCode: r.reason_code,
    }));
  }
  event(missionId: string, workItemId: string | null, reasonCode: string | null, at: string): void {
    const mission = this.mission(missionId);
    this.db
      .prepare(
        'INSERT INTO supervisor_events(mission_id,sequence,state,work_item_id,reason_code,occurred_at) SELECT ?,COALESCE(MAX(sequence),0)+1,?,?,?,? FROM supervisor_events WHERE mission_id=?',
      )
      .run(missionId, mission.state, workItemId, reasonCode, at, missionId);
    this.db.prepare('UPDATE supervisor_missions SET updated_at=? WHERE id=?').run(at, missionId);
  }
  #persistEnvelope(
    missionId: string,
    version: number,
    envelope: MissionEnvelopeView,
    input: MissionEnvelopeInput,
    at: string,
  ): void {
    this.db
      .prepare(
        'INSERT INTO supervisor_envelopes(mission_id,version,envelope_json,input_json,confirmed_at) VALUES(?,?,?,?,?)',
      )
      .run(missionId, version, JSON.stringify(envelope), JSON.stringify(input), at);
    this.db.prepare('DELETE FROM mission_profile_pins WHERE mission_id=?').run(missionId);
    for (const binding of envelope.bindings) {
      const pinned = this.db
        .prepare('SELECT revision_id FROM mission_profile_pins WHERE mission_id=? AND profile_id=?')
        .get(missionId, binding.profileId) as { revision_id: string } | undefined;
      if (pinned && pinned.revision_id !== binding.profileRevisionId)
        throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
      this.db
        .prepare(
          'INSERT OR IGNORE INTO mission_profile_pins(mission_id,profile_id,revision_id,pinned_at) VALUES(?,?,?,?)',
        )
        .run(missionId, binding.profileId, binding.profileRevisionId, at);
      if (binding.sessionId)
        this.bindSession(missionId, binding.bindingId, binding.sessionId, binding.role, at);
    }
  }
  createMission(input: {
    id: string;
    envelope: MissionEnvelopeView;
    input: MissionEnvelopeInput;
    at: string;
  }): MissionDetailView {
    return this.db.transaction(() => {
      const envelope = MissionEnvelopeView.parse(input.envelope);
      const request = MissionEnvelopeInput.parse(input.input);
      const supervisor = envelope.bindings.find((b) => b.role === 'supervisor');
      if (!supervisor?.sessionId) throw new ThreadHelmError('SUPERVISOR_NOT_BOUND');
      this.db
        .prepare(
          "INSERT INTO supervisor_missions(id,state,version,supervisor_session_id,started_at,last_progress_at,created_at,updated_at) VALUES(?,'running',1,?,?,?,?,?)",
        )
        .run(input.id, supervisor.sessionId, input.at, input.at, input.at, input.at);
      this.#persistEnvelope(input.id, 1, envelope, request, input.at);
      this.event(input.id, null, 'MISSION_CONFIRMED', input.at);
      return this.detail(input.id);
    })();
  }
  reviseMission(input: {
    id: string;
    expectedVersion: number;
    envelope: MissionEnvelopeView;
    input: MissionEnvelopeInput;
    at: string;
  }): MissionDetailView {
    return this.db.transaction(() => {
      const mission = this.mission(input.id);
      if (
        mission.version !== input.expectedVersion ||
        !['paused', 'recovery_required'].includes(mission.state) ||
        this.leases(input.id).some((l) => ['reserved', 'active', 'unknown'].includes(l.state))
      )
        throw new ThreadHelmError('MISSION_ENVELOPE_STALE');
      const envelope = MissionEnvelopeView.parse(input.envelope);
      const request = MissionEnvelopeInput.parse(input.input);
      assertWorkGraph(
        this.workItems(input.id),
        [],
        envelope.bounds,
        envelope.workspaces.map((w) => w.workspaceId),
      );
      this.db
        .prepare('UPDATE supervisor_session_roles SET active=0 WHERE mission_id=?')
        .run(input.id);
      this.#persistEnvelope(input.id, mission.version + 1, envelope, request, input.at);
      this.db
        .prepare(
          "UPDATE supervisor_missions SET version=version+1,supervisor_session_id=?,state='paused',reason_code='ENVELOPE_REVISED' WHERE id=?",
        )
        .run(envelope.bindings.find((b) => b.role === 'supervisor')!.sessionId, input.id);
      this.event(input.id, null, 'ENVELOPE_REVISED', input.at);
      return this.detail(input.id);
    })();
  }
  recordDecision(
    input: DecisionInsert & {
      kind: SupervisorDecisionView['kind'];
      workItemId?: string | null;
      policyResult: SupervisorDecisionView['policyResult'];
      reasonCode?: string | null;
    },
  ): SupervisorDecisionView {
    const prior = this.decisionForKey(input.missionId, input.idempotencyKey, input.requestDigest);
    if (prior) return prior;
    const view = SupervisorDecisionView.parse({
      id: randomUUID(),
      missionId: input.missionId,
      envelopeVersion: this.mission(input.missionId).version,
      workItemId: input.workItemId ?? null,
      supervisorSessionId: input.supervisorSessionId,
      kind: input.kind,
      policyResult: input.policyResult,
      reasonCode: input.reasonCode ?? null,
      rationale: input.rationale,
      inputRefs: input.inputRefs,
      expectedEvidence: input.expectedEvidence,
      createdAt: input.at,
    });
    this.db
      .prepare(
        'INSERT INTO supervisor_decisions(id,mission_id,work_item_id,idempotency_key,fingerprint,request_digest,view_json,created_at) VALUES(?,?,?,?,?,?,?,?)',
      )
      .run(
        view.id,
        view.missionId,
        view.workItemId,
        input.idempotencyKey,
        input.fingerprint,
        input.requestDigest,
        JSON.stringify(view),
        input.at,
      );
    this.db
      .prepare('UPDATE supervisor_missions SET turn_count=turn_count+1 WHERE id=?')
      .run(input.missionId);
    this.event(
      input.missionId,
      view.workItemId,
      input.reasonCode ?? 'DECISION_COMMITTED',
      input.at,
    );
    return view;
  }
  #running(id: string, sessionId: string): MissionEnvelopeView {
    const row = this.mission(id);
    if (row.state !== 'running' || row.supervisor_session_id !== sessionId)
      throw new ThreadHelmError('SUPERVISOR_NOT_BOUND');
    return this.envelope(id)!;
  }
  decompose(input: DecisionInsert & { items: SupervisorWorkInput[] }): SupervisorDecisionView {
    return this.db.transaction(() => {
      const prior = this.decisionForKey(input.missionId, input.idempotencyKey, input.requestDigest);
      if (prior) return prior;
      const envelope = this.#running(input.missionId, input.supervisorSessionId);
      const existing = this.workItems(input.missionId);
      assertWorkGraph(
        existing,
        input.items.map((i) => ({ ...i, state: 'ready' })),
        envelope.bounds,
        envelope.workspaces.map((w) => w.workspaceId),
      );
      const decision = this.recordDecision({
        ...input,
        kind: 'decompose',
        policyResult: 'accepted',
      });
      for (const item of input.items) {
        let held = false;
        try {
          assertRoutineWorkAuthority(
            [...existing, ...input.items.map((i) => ({ ...i, state: 'ready' }))],
            item.id,
          );
        } catch (error) {
          if (!(error instanceof ThreadHelmError) || error.code !== 'MISSION_AUTHORITY_REQUIRED')
            throw error;
          held = true;
        }
        const state = held
          ? 'escalated'
          : item.dependencies.every(
                (id) => existing.find((i) => i.id === id)?.state === 'completed',
              )
            ? 'ready'
            : 'blocked';
        const view = SupervisorWorkView.parse({
          ...item,
          missionId: input.missionId,
          state,
          assignedSessionId: null,
          attemptCount: 0,
          reasonCode: held ? 'MISSION_AUTHORITY_REQUIRED' : null,
          createdAt: input.at,
          updatedAt: input.at,
        });
        this.db
          .prepare(
            'INSERT INTO supervisor_work_items(id,mission_id,workspace_id,state,view_json,created_by_decision_id) VALUES(?,?,?,?,?,?)',
          )
          .run(
            item.id,
            input.missionId,
            item.workspaceId,
            state,
            JSON.stringify(view),
            decision.id,
          );
      }
      for (const item of input.items)
        for (const dependency of item.dependencies)
          this.db
            .prepare(
              'INSERT INTO supervisor_dependencies(mission_id,work_item_id,dependency_id) VALUES(?,?,?)',
            )
            .run(input.missionId, item.id, dependency);
      this.event(input.missionId, null, 'WORK_DECOMPOSED', input.at);
      return decision;
    })();
  }
  #saveWork(view: SupervisorWorkView): void {
    SupervisorWorkView.parse(view);
    this.db
      .prepare('UPDATE supervisor_work_items SET state=?,view_json=? WHERE id=? AND mission_id=?')
      .run(view.state, JSON.stringify(view), view.id, view.missionId);
  }
  #saveAttempt(view: SupervisorAttemptView): void {
    SupervisorAttemptView.parse(view);
    this.db
      .prepare('UPDATE supervisor_work_attempts SET state=?,view_json=? WHERE id=?')
      .run(view.state, JSON.stringify(view), view.id);
  }
  #saveLease(view: LeaseRecord): void {
    const data = Object.fromEntries(
      Object.entries(view).filter(
        ([key]) => !['plannedSessionId', 'volumeSerial', 'fileId'].includes(key),
      ),
    );
    WorkerLeaseView.parse(data);
    this.db
      .prepare('UPDATE supervisor_worker_leases SET state=?,session_id=?,view_json=? WHERE id=?')
      .run(view.state, view.sessionId, JSON.stringify(data), view.id);
  }
  reserveAssignment(
    input: DecisionInsert & {
      kind: 'assign' | 'reassign';
      workItemId: string;
      binding: MissionBindingView;
      plannedSessionId: string;
    },
  ): SupervisorAttemptView {
    return this.db.transaction(() => {
      const envelope = this.#running(input.missionId, input.supervisorSessionId);
      const binding = envelope.bindings.find((b) => b.bindingId === input.binding.bindingId);
      if (
        !binding ||
        JSON.stringify(binding) !== JSON.stringify(MissionBindingView.parse(input.binding)) ||
        binding.role === 'supervisor'
      )
        throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
      const work = this.workItem(input.missionId, input.workItemId);
      assertRoutineWorkAuthority(this.workItems(input.missionId), work.id);
      if (work.workspaceId !== binding.workspaceId || work.authorityClass !== 'routine')
        throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
      if (!['ready', 'failed'].includes(work.state))
        throw new ThreadHelmError(
          work.state === 'escalated' ? 'WORK_ATTEMPT_UNKNOWN' : 'INVALID_STATE',
        );
      if (work.attemptCount) {
        const prior = this.attempts(input.missionId)
          .filter((a) => a.workItemId === work.id)
          .at(-1)!;
        assertSafeRetry(
          work.attemptCount,
          { state: prior.state, ...this.attemptMetadata(prior.id) },
          envelope.bounds.maxAttempts,
          envelope.knownSafeRetryClasses,
        );
      }
      const live = this.leases().filter((l) => ['reserved', 'active', 'unknown'].includes(l.state));
      if (live.filter((l) => l.missionId === input.missionId).length >= envelope.bounds.maxWorkers)
        throw new ThreadHelmError('MISSION_BOUND_REACHED');
      const candidate = { ...binding.identity, mode: binding.mode, state: 'reserved' };
      if (live.some((l) => workerLeaseConflicts(l, candidate)))
        throw new ThreadHelmError('WORK_LEASE_CONFLICT');
      const mission = this.mission(input.missionId);
      if (
        this.tokenCommitment(input.missionId) + binding.effectiveTokenBudget >
        envelope.bounds.maxTokenBudget
      )
        throw new ThreadHelmError('MISSION_BOUND_REACHED');
      const expiresAt = new Date(
        Math.min(
          Date.parse(mission.started_at) + envelope.bounds.maxElapsedMs,
          Date.parse(input.at) + binding.executionBounds.maxElapsedMs,
        ),
      ).toISOString();
      if (Date.parse(expiresAt) <= Date.parse(input.at))
        throw new ThreadHelmError('MISSION_BOUND_REACHED');
      const decision = this.recordDecision({
        ...input,
        workItemId: work.id,
        policyResult: 'accepted',
      });
      const lease: WorkerLeaseView = {
        id: randomUUID(),
        missionId: input.missionId,
        workItemId: work.id,
        workspaceId: binding.workspaceId,
        profileRevisionId: binding.profileRevisionId,
        sessionId: null,
        mode: binding.mode,
        state: 'reserved',
        acquiredAt: input.at,
        expiresAt,
        releasedAt: null,
      };
      this.db
        .prepare(
          'INSERT INTO supervisor_worker_leases(id,mission_id,work_item_id,workspace_id,profile_revision_id,session_id,planned_session_id,volume_serial,file_id,mode,state,view_json) VALUES(?,?,?,?,?,NULL,?,?,?,?,?,?)',
        )
        .run(
          lease.id,
          lease.missionId,
          lease.workItemId,
          lease.workspaceId,
          lease.profileRevisionId,
          input.plannedSessionId,
          binding.identity.volumeSerial,
          binding.identity.fileId,
          lease.mode,
          lease.state,
          JSON.stringify(lease),
        );
      const attempt: SupervisorAttemptView = {
        id: randomUUID(),
        missionId: input.missionId,
        envelopeVersion: mission.version,
        reservedTokenBudget: binding.effectiveTokenBudget,
        workItemId: work.id,
        decisionId: decision.id,
        leaseId: lease.id,
        profileRevisionId: binding.profileRevisionId,
        sessionId: null,
        attemptNumber: work.attemptCount + 1,
        state: 'reserved',
        workerStartDisposition: binding.sessionId ? 'not_needed' : 'held',
        handoffId: null,
        resultHandoffId: null,
        supervisorSessionId: input.supervisorSessionId,
        disposition: null,
        explanation: null,
        evidenceRefs: [],
        reasonCode: null,
        createdAt: input.at,
        completedAt: null,
      };
      this.db
        .prepare(
          "INSERT INTO supervisor_work_attempts(id,mission_id,work_item_id,decision_id,lease_id,binding_id,state,attempt_number,effect,last_progress_at,view_json) VALUES(?,?,?,?,?,?,'reserved',?,'none',?,?)",
        )
        .run(
          attempt.id,
          attempt.missionId,
          attempt.workItemId,
          attempt.decisionId,
          attempt.leaseId,
          binding.bindingId,
          attempt.attemptNumber,
          input.at,
          JSON.stringify(attempt),
        );
      this.#saveWork({
        ...work,
        state: 'assigned',
        attemptCount: attempt.attemptNumber,
        updatedAt: input.at,
      });
      this.event(input.missionId, work.id, 'WORK_RESERVED', input.at);
      return attempt;
    })();
  }
  attachReservedSession(leaseId: string, sessionId: string, at: string): void {
    const lease = this.leases().find((l) => l.id === leaseId);
    if (!lease || lease.state !== 'reserved' || lease.plannedSessionId !== sessionId)
      throw new ThreadHelmError('WORKER_AUTOSTART_NOT_AUTHORIZED');
    const attempt = this.attempts(lease.missionId).find((a) => a.leaseId === leaseId)!;
    const binding = this.envelope(lease.missionId)!.bindings.find(
      (b) => b.bindingId === this.attemptMetadata(attempt.id).bindingId,
    )!;
    this.#saveLease({ ...lease, sessionId });
    this.#saveAttempt({ ...attempt, sessionId });
    this.bindSession(lease.missionId, binding.bindingId, sessionId, binding.role, at);
  }
  activateAssignment(
    attemptId: string,
    sessionId: string,
    started: boolean,
    at: string,
  ): SupervisorAttemptView {
    return this.db.transaction(() => {
      const attempt = this.attempt(attemptId);
      const lease = this.leases(attempt.missionId).find((l) => l.id === attempt.leaseId)!;
      if (
        lease.state !== 'reserved' ||
        lease.plannedSessionId !== sessionId ||
        attempt.state !== 'reserved' ||
        Date.parse(lease.expiresAt) <= Date.parse(at)
      )
        throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
      assertRoutineWorkAuthority(this.workItems(attempt.missionId), attempt.workItemId);
      if (this.workItem(attempt.missionId, attempt.workItemId).state !== 'assigned')
        throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
      this.attachReservedSession(lease.id, sessionId, at);
      const view = {
        ...attempt,
        sessionId,
        state: 'assigned' as const,
        workerStartDisposition: started ? ('started' as const) : ('not_needed' as const),
      };
      this.#saveAttempt(view);
      this.#saveLease({ ...lease, sessionId, state: 'active' });
      const work = this.workItem(attempt.missionId, attempt.workItemId);
      this.#saveWork({ ...work, state: 'assigned', assignedSessionId: sessionId, updatedAt: at });
      this.event(attempt.missionId, work.id, 'WORK_ASSIGNED', at);
      return view;
    })();
  }
  linkAssignment(attemptId: string, handoffId: string, at: string): void {
    const attempt = this.attempt(attemptId);
    if (attempt.handoffId && attempt.handoffId !== handoffId)
      throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
    this.#saveAttempt({ ...attempt, handoffId, state: 'running' });
    this.db
      .prepare("UPDATE supervisor_work_attempts SET effect='possible' WHERE id=?")
      .run(attemptId);
    const work = this.workItem(attempt.missionId, attempt.workItemId);
    this.#saveWork({ ...work, state: 'running', updatedAt: at });
    this.event(attempt.missionId, work.id, 'ASSIGNMENT_QUEUED', at);
  }
  markExternalStart(attemptId: string, at: string): void {
    const attempt = this.attempt(attemptId);
    if (attempt.state !== 'reserved') throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
    this.db
      .prepare("UPDATE supervisor_work_attempts SET effect='possible' WHERE id=?")
      .run(attemptId);
    this.event(attempt.missionId, attempt.workItemId, 'WORKER_START_DISPATCHED', at);
  }
  finishAttempt(input: {
    attemptId: string;
    disposition: SupervisorResultDisposition;
    explanation: string;
    evidenceRefs: SupervisorEvidenceRef[];
    reasonCode: string | null;
    effect: 'none' | 'possible';
    resultKey: string;
    resultDigest: string;
    at: string;
  }): SupervisorAttemptView {
    return this.db.transaction(() => {
      const attempt = this.attempt(input.attemptId);
      const meta = this.attemptMetadata(attempt.id);
      if (meta.resultKey) {
        if (meta.resultKey === input.resultKey && meta.resultDigest === input.resultDigest)
          return attempt;
        throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
      }
      if (!['reserved', 'assigned', 'running'].includes(attempt.state))
        throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
      if (input.disposition === 'completion' && !input.evidenceRefs.length)
        throw new ThreadHelmError('INVALID_REQUEST', 'Completion requires deliberate evidence.');
      const unknown = input.disposition === 'unknown';
      const state = unknown
        ? 'unknown'
        : input.disposition === 'completion'
          ? 'completed'
          : input.disposition === 'cancelled'
            ? 'cancelled'
            : 'failed';
      const view: SupervisorAttemptView = {
        ...attempt,
        state,
        disposition: input.disposition,
        explanation: input.explanation,
        evidenceRefs: input.evidenceRefs,
        reasonCode: input.reasonCode,
        completedAt: input.at,
        workerStartDisposition:
          attempt.state === 'reserved'
            ? input.effect === 'none'
              ? 'failed'
              : 'held'
            : attempt.workerStartDisposition,
      };
      this.#saveAttempt(view);
      this.db
        .prepare(
          'UPDATE supervisor_work_attempts SET effect=?,retry_class=?,result_key=?,result_digest=? WHERE id=?',
        )
        .run(
          input.effect,
          input.effect === 'none' && state === 'failed' ? 'failed_before_effect' : null,
          input.resultKey,
          input.resultDigest,
          attempt.id,
        );
      const lease = this.leases(attempt.missionId).find((l) => l.id === attempt.leaseId)!;
      this.#saveLease({
        ...lease,
        state: unknown ? 'unknown' : 'released',
        releasedAt: unknown ? null : input.at,
      });
      const work = this.workItem(attempt.missionId, attempt.workItemId);
      const workState =
        state === 'unknown' || ['proposal', 'authority_required'].includes(input.disposition)
          ? 'escalated'
          : state;
      this.#saveWork({
        ...work,
        state: workState,
        reasonCode: input.reasonCode,
        updatedAt: input.at,
      });
      if (state === 'completed') {
        for (const child of this.workItems(attempt.missionId)) {
          if (
            child.state === 'blocked' &&
            child.dependencies.every(
              (id) => this.workItem(attempt.missionId, id).state === 'completed',
            )
          )
            this.#saveWork({ ...child, state: 'ready', updatedAt: input.at });
        }
        this.db
          .prepare('UPDATE supervisor_missions SET last_progress_at=? WHERE id=?')
          .run(input.at, attempt.missionId);
      }
      this.event(
        attempt.missionId,
        attempt.workItemId,
        unknown ? 'WORK_ATTEMPT_UNKNOWN' : 'WORK_RESULT_COMMITTED',
        input.at,
      );
      return view;
    })();
  }
  linkResult(attemptId: string, handoffId: string, at: string): SupervisorAttemptView {
    const attempt = this.attempt(attemptId);
    if (attempt.resultHandoffId && attempt.resultHandoffId !== handoffId)
      throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
    const result = { ...attempt, resultHandoffId: handoffId };
    this.#saveAttempt(result);
    this.event(attempt.missionId, attempt.workItemId, 'RESULT_ROUTED', at);
    return result;
  }
  setState(
    id: string,
    state: MissionState,
    reasonCode: string | null,
    at: string,
    supervisorSessionId?: string,
  ): MissionDetailView {
    return this.db.transaction(() => {
      const mission = this.mission(id);
      if (['completed', 'cancelled', 'deleted'].includes(mission.state) && state !== mission.state)
        throw new ThreadHelmError('INVALID_STATE');
      this.db
        .prepare(
          'UPDATE supervisor_missions SET state=?,reason_code=?,supervisor_session_id=? WHERE id=?',
        )
        .run(state, reasonCode, supervisorSessionId ?? mission.supervisor_session_id, id);
      if (supervisorSessionId)
        this.db
          .prepare(
            "UPDATE supervisor_session_roles SET active=0 WHERE mission_id=? AND role='supervisor' AND session_id<>?",
          )
          .run(id, supervisorSessionId);
      if (['completed', 'cancelled', 'deleted'].includes(state)) {
        this.db.prepare('UPDATE supervisor_session_roles SET active=0 WHERE mission_id=?').run(id);
        if (!this.leases(id).some((l) => ['reserved', 'active', 'unknown'].includes(l.state)))
          this.db.prepare('DELETE FROM mission_profile_pins WHERE mission_id=?').run(id);
        for (const work of this.workItems(id))
          if (
            !['completed', 'cancelled'].includes(work.state) &&
            !this.attempts(id).some(
              (a) =>
                a.workItemId === work.id &&
                ['reserved', 'assigned', 'running', 'unknown'].includes(a.state),
            )
          )
            this.#saveWork({ ...work, state: 'cancelled', updatedAt: at });
      }
      this.event(id, null, reasonCode, at);
      return this.detail(id);
    })();
  }
  pauseWork(missionId: string, workItemId: string, reasonCode: string, at: string): void {
    const work = this.workItem(missionId, workItemId);
    if (['completed', 'cancelled'].includes(work.state)) throw new ThreadHelmError('INVALID_STATE');
    this.#saveWork({ ...work, state: 'escalated', reasonCode, updatedAt: at });
    this.event(missionId, workItemId, reasonCode, at);
  }
  cancelWork(missionId: string, workItemId: string, at: string): void {
    const work = this.workItem(missionId, workItemId);
    if (
      this.leases(missionId).some(
        (l) => l.workItemId === workItemId && ['reserved', 'active', 'unknown'].includes(l.state),
      )
    )
      throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
    if (work.state === 'completed') throw new ThreadHelmError('INVALID_STATE');
    this.#saveWork({ ...work, state: 'cancelled', reasonCode: 'USER_CANCELLED', updatedAt: at });
    this.event(missionId, workItemId, 'USER_CANCELLED', at);
  }
  acknowledgeUnknown(attemptId: string, at: string): void {
    const attempt = this.attempt(attemptId);
    if (attempt.state !== 'unknown') throw new ThreadHelmError('INVALID_STATE');
    const lease = this.leases(attempt.missionId).find((l) => l.id === attempt.leaseId)!;
    this.#saveLease({ ...lease, state: 'released', releasedAt: at });
    const work = this.workItem(attempt.missionId, attempt.workItemId);
    this.#saveWork({
      ...work,
      state: 'cancelled',
      reasonCode: 'UNKNOWN_ACKNOWLEDGED_NO_REPLAY',
      updatedAt: at,
    });
    this.event(attempt.missionId, attempt.workItemId, 'UNKNOWN_ACKNOWLEDGED_NO_REPLAY', at);
    if (
      ['completed', 'cancelled'].includes(this.mission(attempt.missionId).state) &&
      !this.leases(attempt.missionId).some((l) =>
        ['reserved', 'active', 'unknown'].includes(l.state),
      )
    )
      this.db.prepare('DELETE FROM mission_profile_pins WHERE mission_id=?').run(attempt.missionId);
  }
  recordProgress(
    attemptId: string,
    progress: {
      turnCount: number;
      outputBytes: number;
      tokensUsed: number;
      madeProgress: boolean;
      at: string;
    },
  ): void {
    const attempt = this.attempt(attemptId);
    if (!['assigned', 'running'].includes(attempt.state)) return;
    const prior = this.attemptMetadata(attemptId);
    if (
      progress.turnCount < prior.turnCount ||
      progress.outputBytes < prior.outputBytes ||
      progress.tokensUsed < prior.tokensUsed
    )
      throw new ThreadHelmError('INVALID_REQUEST');
    this.db
      .prepare(
        'UPDATE supervisor_work_attempts SET turn_count=?,output_bytes=?,tokens_used=?,last_progress_at=? WHERE id=?',
      )
      .run(
        progress.turnCount,
        progress.outputBytes,
        progress.tokensUsed,
        progress.madeProgress ? progress.at : prior.lastProgressAt,
        attemptId,
      );
    this.db
      .prepare(
        'UPDATE supervisor_missions SET turn_count=turn_count+?,output_bytes=output_bytes+?,tokens_used=tokens_used+?,last_progress_at=CASE WHEN ? THEN ? ELSE last_progress_at END WHERE id=?',
      )
      .run(
        progress.turnCount - prior.turnCount,
        progress.outputBytes - prior.outputBytes,
        progress.tokensUsed - prior.tokensUsed,
        Number(progress.madeProgress),
        progress.at,
        attempt.missionId,
      );
  }
  recover(at: string): number {
    return this.db.transaction(() => {
      let count = 0;
      const missions = this.db
        .prepare(
          "SELECT id FROM supervisor_missions WHERE state NOT IN ('completed','cancelled','deleted')",
        )
        .all() as { id: string }[];
      for (const { id } of missions) {
        for (const attempt of this.attempts(id))
          if (['reserved', 'assigned', 'running'].includes(attempt.state)) {
            this.#saveAttempt({
              ...attempt,
              state: 'unknown',
              disposition: 'unknown',
              reasonCode: 'RECOVERY_OUTCOME_UNKNOWN',
              completedAt: at,
            });
            const lease = this.leases(id).find((l) => l.id === attempt.leaseId)!;
            this.#saveLease({ ...lease, state: 'unknown' });
            this.pauseWork(id, attempt.workItemId, 'WORK_ATTEMPT_UNKNOWN', at);
            count++;
          }
        this.db.prepare('UPDATE supervisor_session_roles SET active=0 WHERE mission_id=?').run(id);
        if (this.mission(id).state !== 'recovery_required')
          this.setState(id, 'recovery_required', 'SUPERVISOR_RECOVERY_REQUIRED', at);
      }
      return count;
    })();
  }
  deleteContent(id: string, at: string): MissionDetailView {
    return this.db.transaction(() => {
      const mission = this.mission(id);
      if (
        !['completed', 'cancelled'].includes(mission.state) ||
        this.leases(id).some((l) => ['reserved', 'active', 'unknown'].includes(l.state))
      )
        throw new ThreadHelmError('INVALID_STATE');
      this.db
        .prepare(
          'UPDATE supervisor_envelopes SET envelope_json=NULL,input_json=NULL WHERE mission_id=?',
        )
        .run(id);
      for (const work of this.workItems(id))
        this.#saveWork({
          ...work,
          title: null,
          specification: null,
          acceptanceCriteria: null,
          updatedAt: at,
        });
      for (const row of this.db
        .prepare('SELECT view_json FROM supervisor_decisions WHERE mission_id=?')
        .all(id) as JsonRow[]) {
        const d = SupervisorDecisionView.parse(JSON.parse(row.view_json));
        this.db
          .prepare(
            "UPDATE supervisor_decisions SET view_json=?,fingerprint=NULL,request_digest=NULL,idempotency_key='deleted:'||id WHERE id=?",
          )
          .run(
            JSON.stringify({ ...d, rationale: null, inputRefs: [], expectedEvidence: null }),
            d.id,
          );
      }
      for (const attempt of this.attempts(id))
        this.#saveAttempt({ ...attempt, explanation: null, evidenceRefs: [] });
      this.db
        .prepare(
          'UPDATE supervisor_work_attempts SET result_key=NULL,result_digest=NULL WHERE mission_id=?',
        )
        .run(id);
      this.db
        .prepare(
          "UPDATE supervisor_missions SET state='deleted',reason_code='MISSION_CONTENT_DELETED' WHERE id=?",
        )
        .run(id);
      this.db.prepare('DELETE FROM mission_profile_pins WHERE mission_id=?').run(id);
      this.event(id, null, 'MISSION_CONTENT_DELETED', at);
      return this.detail(id);
    })();
  }
}
