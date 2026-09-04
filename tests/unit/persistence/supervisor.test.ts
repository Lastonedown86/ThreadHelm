import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createRepositories,
  migrate,
  openDatabase,
  readSchemaVersion,
  SCHEMA_VERSION,
  type Db,
  type Repositories,
} from '@threadhelm/persistence';
import {
  supervisorFixtureBinding,
  supervisorFixtureEnvelope,
  supervisorFixtureWork,
} from '../../../packages/test-fixtures/src/supervisor.js';
import {
  MissionComposerFields,
  type MissionBindingView,
  type SupervisorWorkInput,
} from '@threadhelm/contracts';

const at = '2026-08-30T00:00:00.000Z';
describe('durable supervisor transactions', () => {
  let db: Db;
  let repos: Repositories;
  let bindings: MissionBindingView[];
  beforeEach(() => {
    db = openDatabase(':memory:');
    migrate(db);
    repos = createRepositories(db);
    bindings = [0, 1].map((n) => {
      const profile = repos.agentProfiles.importManifest({
        manifestKey: `fixture-${n}`,
        digest: String(n).repeat(64),
        displayName: `Worker ${n}`,
        description: 'Fixture',
        requestedProvider: 'codex',
        requestedModel: 'default',
        capabilities: [],
        isolateRequested: false,
        tokenCapRequested: 1000,
        author: 'Test',
        goal: 'Check fixture',
        manifestSpec: 'munder-difflin/hire@1',
        compatibility: 'compatible',
        sourceBasename: 'fixture.json',
        createdAt: at,
      });
      const w = repos.workspaces.insertApproval({
        selectedPath: `C:\\fixture-${n}`,
        displayPath: `C:\\fixture-${n}`,
        canonicalPath: `\\\\?\\C:\\fixture-${n}`,
        volumeSerial: '0'.repeat(16),
        fileId: String(n).repeat(32),
        approvedAt: at,
      });
      return supervisorFixtureBinding({
        profileId: profile.profileId,
        profileRevisionId: profile.revisionId,
        profileDigest: String(n).repeat(64),
        workspaceId: w.id,
        identity: { volumeSerial: w.volumeSerial, fileId: w.fileId },
        ...(n === 0 ? { role: 'supervisor', sessionId: randomUUID(), autoStart: false } : {}),
      });
    });
  });
  afterEach(() => db.close());
  const create = () => {
    const fixture = supervisorFixtureEnvelope(bindings);
    return repos.supervisor.createMission({ id: randomUUID(), ...fixture, at });
  };
  const decompose = (missionId: string, items: SupervisorWorkInput[]) =>
    repos.supervisor.decompose({
      missionId,
      supervisorSessionId: bindings[0]!.sessionId!,
      idempotencyKey: randomUUID(),
      fingerprint: randomUUID(),
      requestDigest: randomUUID(),
      rationale: 'Small independent work',
      inputRefs: [],
      expectedEvidence: 'A report',
      items,
      at,
    });
  it('adds the v3 slice idempotently and persists exact immutable envelope versions and profile pins', () => {
    expect(repos.supervisor).toBeDefined();
    const mission = create();
    migrate(db);
    expect(readSchemaVersion(db)).toBe(SCHEMA_VERSION);
    expect(repos.supervisor.detail(mission.id).envelope!.bindings[1]!.profileRevisionId).toBe(
      bindings[1]!.profileRevisionId,
    );
    expect(() => repos.agentProfiles.previewDelete(bindings[1]!.profileId)).toThrowError(
      expect.objectContaining({ code: 'PROFILE_MISSION_PINNED' }),
    );
    expect(repos.supervisor.events(mission.id).map((e) => e.sequence)).toEqual([1]);
  });
  it('loads the exact pinned revision after the current profile revision changes', () => {
    const original = bindings[1]!;
    repos.agentProfiles.importManifest({
      manifestKey: 'fixture-1',
      digest: 'b'.repeat(64),
      displayName: 'Revised worker',
      description: 'New revision',
      requestedProvider: 'codex',
      requestedModel: 'default',
      capabilities: [],
      isolateRequested: false,
      tokenCapRequested: 1000,
      author: 'Test',
      goal: 'New goal',
      manifestSpec: 'munder-difflin/hire@1',
      compatibility: 'compatible',
      sourceBasename: 'fixture.json',
      createdAt: at,
    });
    expect(repos.agentProfiles.getDetailByRevision(original.profileRevisionId)!.digest).toBe(
      original.profileDigest,
    );
  });
  it('rolls back an invalid DAG and decision together', () => {
    const mission = create();
    const a = randomUUID();
    const b = randomUUID();
    expect(() =>
      decompose(mission.id, [
        supervisorFixtureWork(bindings[1]!.workspaceId, { id: a, dependencies: [b] }),
        supervisorFixtureWork(bindings[1]!.workspaceId, { id: b, dependencies: [a] }),
      ] as SupervisorWorkInput[]),
    ).toThrow();
    expect(repos.supervisor.detail(mission.id).workItems).toHaveLength(0);
    expect(repos.supervisor.detail(mission.id).decisions).toHaveLength(0);
  });
  it('holds a routine child beneath consequential or escalated ancestors', () => {
    const mission = create();
    const parent = supervisorFixtureWork(bindings[1]!.workspaceId, {
      authorityClass: 'destructive',
    });
    const child = supervisorFixtureWork(bindings[1]!.workspaceId, { parentWorkItemId: parent.id });
    decompose(mission.id, [parent, child]);
    expect(repos.supervisor.workItem(mission.id, child.id).state).toBe('escalated');
    expect(() =>
      repos.supervisor.reserveAssignment({
        missionId: mission.id,
        workItemId: child.id,
        binding: bindings[1]!,
        supervisorSessionId: bindings[0]!.sessionId!,
        idempotencyKey: 'unsafe-child',
        fingerprint: 'unsafe-child',
        requestDigest: 'unsafe-child',
        rationale: 'Attempted authority laundering',
        inputRefs: [],
        expectedEvidence: 'Report',
        kind: 'assign',
        plannedSessionId: randomUUID(),
        at,
      }),
    ).toThrowError(expect.objectContaining({ code: 'MISSION_AUTHORITY_REQUIRED' }));
    expect(repos.supervisor.leases(mission.id)).toHaveLength(0);
  });
  it.each(['parent', 'child'])(
    'rechecks %s authority after reservation and before activating an assignment',
    (held) => {
      const mission = create();
      const parent = supervisorFixtureWork(bindings[1]!.workspaceId);
      const child = supervisorFixtureWork(bindings[1]!.workspaceId, {
        parentWorkItemId: parent.id,
      });
      decompose(mission.id, [parent, child]);
      const sessionId = randomUUID();
      const attempt = repos.supervisor.reserveAssignment({
        missionId: mission.id,
        workItemId: child.id,
        binding: bindings[1]!,
        supervisorSessionId: bindings[0]!.sessionId!,
        idempotencyKey: 'held-during-preflight',
        fingerprint: 'held-during-preflight',
        requestDigest: 'held-during-preflight',
        rationale: 'Routine child',
        inputRefs: [],
        expectedEvidence: 'Report',
        kind: 'assign',
        plannedSessionId: sessionId,
        at,
      });
      repos.supervisor.pauseWork(
        mission.id,
        held === 'parent' ? parent.id : child.id,
        'USER_ESCALATION_DISPOSITION',
        at,
      );
      expect(() =>
        repos.supervisor.activateAssignment(attempt.id, sessionId, false, at),
      ).toThrowError(expect.objectContaining({ code: 'MISSION_AUTHORITY_REQUIRED' }));
      expect(repos.supervisor.attempt(attempt.id).state).toBe('reserved');
      expect(repos.supervisor.leases(mission.id)[0]!.state).toBe('reserved');
    },
  );
  it('commits decision and a reserved lease before session binding and refuses a conflicting native alias', () => {
    const mission = create();
    const items = [
      supervisorFixtureWork(bindings[1]!.workspaceId),
      supervisorFixtureWork(bindings[1]!.workspaceId),
    ] as SupervisorWorkInput[];
    decompose(mission.id, items);
    const reserve = (workItemId: string) =>
      repos.supervisor.reserveAssignment({
        missionId: mission.id,
        workItemId,
        binding: bindings[1]!,
        supervisorSessionId: bindings[0]!.sessionId!,
        idempotencyKey: randomUUID(),
        fingerprint: randomUUID(),
        requestDigest: randomUUID(),
        rationale: 'Assign fixture',
        inputRefs: [],
        expectedEvidence: 'Report',
        kind: 'assign',
        plannedSessionId: randomUUID(),
        at,
      });
    const attempt = reserve(items[0]!.id);
    expect(attempt.state).toBe('reserved');
    expect(repos.supervisor.detail(mission.id).leases[0]!.state).toBe('reserved');
    expect(() => reserve(items[1]!.id)).toThrowError(
      expect.objectContaining({ code: 'WORK_LEASE_CONFLICT' }),
    );
    expect(repos.supervisor.detail(mission.id).attempts).toHaveLength(1);
  });
  it('keeps uncertain starts and leases unknown across recovery without replay', () => {
    const mission = create();
    const item = supervisorFixtureWork(bindings[1]!.workspaceId) as SupervisorWorkInput;
    decompose(mission.id, [item]);
    repos.supervisor.reserveAssignment({
      missionId: mission.id,
      workItemId: item.id,
      binding: bindings[1]!,
      supervisorSessionId: bindings[0]!.sessionId!,
      idempotencyKey: 'assign',
      fingerprint: 'one',
      requestDigest: 'one',
      rationale: 'Assign fixture',
      inputRefs: [],
      expectedEvidence: 'Report',
      kind: 'assign',
      plannedSessionId: randomUUID(),
      at,
    });
    repos.supervisor.recover(at);
    const detail = repos.supervisor.detail(mission.id);
    expect(detail.state).toBe('recovery_required');
    expect(detail.leases[0]!.state).toBe('unknown');
    expect(detail.attempts[0]!.state).toBe('unknown');
    repos.supervisor.recover(at);
    expect(repos.supervisor.detail(mission.id).attempts).toHaveLength(1);
  });
  it('reserves aggregate token ceilings before effects and retains the exact envelope version', () => {
    const fixture = supervisorFixtureEnvelope(bindings);
    fixture.envelope.bounds.maxTokenBudget = 1000;
    fixture.input.bounds.maxTokenBudget = 1000;
    const mission = repos.supervisor.createMission({ id: randomUUID(), ...fixture, at });
    const items = [
      supervisorFixtureWork(bindings[1]!.workspaceId),
      supervisorFixtureWork(bindings[1]!.workspaceId),
    ];
    decompose(mission.id, items);
    const reserve = (workItemId: string) =>
      repos.supervisor.reserveAssignment({
        missionId: mission.id,
        workItemId,
        binding: bindings[1]!,
        supervisorSessionId: bindings[0]!.sessionId!,
        idempotencyKey: randomUUID(),
        fingerprint: randomUUID(),
        requestDigest: randomUUID(),
        rationale: 'Allocate bounded work',
        inputRefs: [],
        expectedEvidence: 'Report',
        kind: 'assign',
        plannedSessionId: randomUUID(),
        at,
      });
    const first = reserve(items[0]!.id);
    expect(first.envelopeVersion).toBe(1);
    repos.supervisor.finishAttempt({
      attemptId: first.id,
      disposition: 'completion',
      explanation: 'One report',
      evidenceRefs: [{ kind: 'artifact', id: 'report.md' }],
      reasonCode: null,
      effect: 'possible',
      resultKey: 'one',
      resultDigest: 'one',
      at,
    });
    expect(() => reserve(items[1]!.id)).toThrowError(
      expect.objectContaining({ code: 'MISSION_BOUND_REACHED' }),
    );
    expect(repos.supervisor.attempts(mission.id)).toHaveLength(1);
  });
  it('deletes terminal mission content and fingerprints while retaining causal IDs and event evidence', () => {
    const mission = create();
    const item = supervisorFixtureWork(bindings[1]!.workspaceId) as SupervisorWorkInput;
    decompose(mission.id, [item]);
    repos.supervisor.setState(mission.id, 'cancelled', 'USER_CANCELLED', at);
    repos.supervisor.deleteContent(mission.id, at);
    const detail = repos.supervisor.detail(mission.id);
    expect(detail.state).toBe('deleted');
    expect(detail.envelope).toBeNull();
    expect(detail.workItems[0]!.title).toBeNull();
    expect(detail.decisions[0]!.rationale).toBeNull();
    const row = db
      .prepare('SELECT fingerprint FROM supervisor_decisions WHERE mission_id=?')
      .get(mission.id) as { fingerprint: null };
    expect(row.fingerprint).toBeNull();
    expect(repos.supervisor.events(mission.id).at(-1)!.reasonCode).toBe('MISSION_CONTENT_DELETED');
  });
  it('reads a pre-branch stored envelope (no assignment/requiredReturnEvidence/exclusions) via detail() and the revision createDraft path', () => {
    const mission = create();
    // Simulate a mission confirmed before this branch: strip the three fields
    // this branch added to MissionWorkerInput/MissionEnvelopeInput from the
    // already-persisted input_json, exactly as an old row would look.
    const row = db
      .prepare('SELECT input_json FROM supervisor_envelopes WHERE mission_id=? AND version=1')
      .get(mission.id) as { input_json: string };
    const stored = JSON.parse(row.input_json) as Record<string, unknown>;
    delete stored.exclusions;
    for (const worker of stored.workers as Record<string, unknown>[]) {
      delete worker.assignment;
      delete worker.requiredReturnEvidence;
    }
    db.prepare('UPDATE supervisor_envelopes SET input_json=? WHERE mission_id=? AND version=1').run(
      JSON.stringify(stored),
      mission.id,
    );

    const detail = repos.supervisor.detail(mission.id);
    expect(detail.input).not.toBeNull();
    expect(detail.input!.exclusions).toEqual([]);
    for (const worker of detail.input!.workers) {
      expect(worker.assignment).toBe('');
      expect(worker.requiredReturnEvidence).toEqual([]);
    }

    // The composer revision path: createDraft({ sourceMissionId }) reads
    // mission.input and parses it as MissionComposerFields — must not throw.
    const fieldValues = MissionComposerFields.parse(detail.input);
    const { draftId } = repos.missionComposer.createDraft({
      sourceMissionId: mission.id,
      fieldValues,
      currentStage: 'review',
      createdAt: at,
    });
    expect(repos.missionComposer.getDraft(draftId).fieldValues.workers?.[0]?.assignment).toBe('');
  });
});
