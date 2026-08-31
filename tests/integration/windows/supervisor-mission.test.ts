/** Real Windows hosts, Job Objects and authenticated bridge calls; no LLM or injected mission rows. */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  MissionDetailView,
  MissionEnvelopeInput,
  MissionPreviewView,
  SupervisorAttemptView,
  SupervisorResultDisposition,
} from '@threadhelm/contracts';
import { cleanupUserData, launchApp, waitFor, type LaunchedApp } from '../../e2e/helpers/app.js';
import { missionProfile, prepareFixtureMission } from '../../e2e/helpers/mission.js';
import { supervisorFixtureWork } from '../../../packages/test-fixtures/src/supervisor.js';
import { sendInput, waitForPidExit } from './helpers/harness.js';

let app: LaunchedApp;
const directories: string[] = [];
beforeEach(async () => {
  app = await launchApp();
  await app.useFixtureAdapters({ 'codex-cli': 'echo' });
});
afterEach(async () => {
  await app.close();
  cleanupUserData(app.userData);
  for (const directory of directories.splice(0)) cleanupUserData(directory);
});

async function prepare(workers = 1) {
  const dirs = Array.from({ length: workers + 1 }, () => {
    const directory = mkdtempSync(join(tmpdir(), 'threadhelm-mission-win-'));
    directories.push(directory);
    return directory;
  });
  const input = await prepareFixtureMission(app, dirs);
  input.bounds.maxTokenBudget = 1_000_000;
  return input;
}
async function confirm(input: MissionEnvelopeInput) {
  const preview = await app.call<MissionPreviewView>('missions.preview', { envelope: input });
  return app.call<MissionDetailView>('missions.confirm', {
    previewToken: preview.previewToken,
    boundaryConfirmation: true,
  });
}
function decision(missionId: string, extra: Record<string, unknown> = {}) {
  return {
    missionId,
    idempotencyKey: randomUUID(),
    rationale: 'Perform the bounded fixture work',
    inputRefs: [],
    expectedEvidence: 'A cited fixture report',
    ...extra,
  };
}
const detail = (missionId: string) => app.call<MissionDetailView>('missions.detail', { missionId });
async function assign(mission: MissionDetailView, index = 0) {
  const binding = mission.envelope!.bindings.filter((item) => item.role === 'worker')[index]!;
  const work = supervisorFixtureWork(binding.workspaceId);
  const supervisor = mission.supervisorSessionId!;
  await app.bridgeRequest(
    supervisor,
    'threadhelm_work_decompose',
    decision(mission.id, { items: [work] }),
  );
  const request = decision(mission.id, { workItemId: work.id, bindingId: binding.bindingId });
  await app.bridgeRequest(supervisor, 'threadhelm_work_assign', request);
  const attempt = (await detail(mission.id)).attempts.find((item) => item.workItemId === work.id)!;
  return { work, binding, attempt, request };
}
async function stop(sessionId: string) {
  const token = await app.call<{ stopToken: string }>('sessions.requestStop', { sessionId });
  await app.call('sessions.confirmStop', token);
  await waitFor(
    () => app.liveSessions(),
    (sessions) => !sessions.some((session) => session.id === sessionId),
  );
}
const result = (attempt: SupervisorAttemptView, disposition: SupervisorResultDisposition) => ({
  missionId: attempt.missionId,
  workItemId: attempt.workItemId,
  attemptId: attempt.id,
  idempotencyKey: randomUUID(),
  disposition,
  explanation: 'A bounded fixture result',
  evidenceRefs: disposition === 'completion' ? [{ kind: 'artifact', id: 'fixture-report.md' }] : [],
});

describe('Windows supervisor mission authority and recovery', () => {
  it('starts an exactly authorized Claude-auto fixture without granting real-provider authority', async () => {
    await app.useFixtureAdapters({ 'codex-cli': 'echo', 'claude-code': 'echo' }, undefined, {
      'claude-code': 'allowed',
    });
    const input = await prepare();
    await stop(input.workers[0]!.sessionId!);
    const profile = await missionProfile(app, 'Authorized Claude fixture', {
      provider: 'claude',
      model: 'claude-sonnet-5',
    });
    input.workers[0] = {
      ...input.workers[0]!,
      profileId: profile.profileId,
      profileRevisionId: profile.currentRevisionId,
      sessionId: null,
      autoStart: true,
      runtimeSelection: { model: 'claude-sonnet-5', effort: null },
      permissionSelection: { policy: 'auto', boundedAllowlist: [] },
    };
    const mission = await confirm(input);
    const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
    expect(binding.launchDisposition, binding.reasonCode ?? undefined).toBe('ready');
    expect(binding.permissionResolution.policy).toBe('auto');
    expect(binding.permissionResolution.providerMapping).toBe('claude_auto');
    expect(binding.permissionResolution.capabilityEvidence?.organizationPolicy).toBe('allowed');
    const { attempt } = await assign(mission);
    expect(attempt.workerStartDisposition).toBe('started');
    expect(attempt.profileRevisionId).toBe(profile.currentRevisionId);
    expect(await app.liveSessions()).toHaveLength(2);
  });

  it('holds launch-time folder drift before effects and reassigns only after explicit scope revalidation', async () => {
    const input = await prepare();
    await stop(input.workers[0]!.sessionId!);
    input.workers[0]!.sessionId = null;
    input.workers[0]!.autoStart = true;
    const mission = await confirm(input);
    const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
    const work = supervisorFixtureWork(binding.workspaceId);
    await app.bridgeRequest(
      mission.supervisorSessionId!,
      'threadhelm_work_decompose',
      decision(mission.id, { items: [work] }),
    );
    const folder = directories[1]!;
    const moved = folder + '-moved';
    directories.push(moved);
    await app.delayNextHostReady(1_500);
    const assigning = app
      .bridgeRequest(
        mission.supervisorSessionId!,
        'threadhelm_work_assign',
        decision(mission.id, { workItemId: work.id, bindingId: binding.bindingId }),
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    try {
      await waitFor(
        () => app.liveSessions(),
        (sessions) => sessions.some((session) => session.state === 'starting'),
        5_000,
        20,
      );
      renameSync(folder, moved);
      expect(await assigning).toBeInstanceOf(Error);
    } finally {
      if (existsSync(moved)) renameSync(moved, folder);
    }
    const failed = await detail(mission.id);
    expect(failed.attempts[0]!.workerStartDisposition).toBe('failed');
    expect(failed.attempts[0]!.disposition).toBe('failure');
    expect(failed.leases[0]!.state).toBe('released');
    expect(failed.state).toBe('paused');
    await app.call('missions.resume', {
      missionId: mission.id,
      supervisorSessionId: mission.supervisorSessionId,
    });
    await app.bridgeRequest(
      mission.supervisorSessionId!,
      'threadhelm_work_reassign',
      decision(mission.id, { workItemId: work.id, bindingId: binding.bindingId }),
    );
    const retried = await detail(mission.id);
    expect(retried.attempts).toHaveLength(2);
    expect(retried.attempts[1]!.workerStartDisposition).toBe('started');
    expect(await app.liveSessions()).toHaveLength(2);
  });

  it('reassigns a known failed dormant host without prompting or replaying an uncertain effect', async () => {
    const input = await prepare();
    await stop(input.workers[0]!.sessionId!);
    input.workers[0]!.sessionId = null;
    input.workers[0]!.autoStart = true;
    const mission = await confirm(input);
    const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
    const work = supervisorFixtureWork(binding.workspaceId);
    await app.bridgeRequest(
      mission.supervisorSessionId!,
      'threadhelm_work_decompose',
      decision(mission.id, { items: [work] }),
    );
    await app.delayNextHostReady(1_500);
    const assigning = app
      .bridgeRequest(
        mission.supervisorSessionId!,
        'threadhelm_work_assign',
        decision(mission.id, { workItemId: work.id, bindingId: binding.bindingId }),
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    const starting = (
      await waitFor(
        () => app.liveSessions(),
        (sessions) => sessions.some((session) => session.state === 'starting'),
        5_000,
        20,
      )
    ).find((session) => session.state === 'starting')!;
    await app.failSession(starting.id);
    expect(await assigning).toBeInstanceOf(Error);
    const failed = await detail(mission.id);
    expect(failed.state).toBe('running');
    expect(failed.attempts[0]!.disposition).toBe('failure');
    expect(failed.attempts[0]!.workerStartDisposition).toBe('failed');
    expect(failed.leases[0]!.state).toBe('released');
    await app.bridgeRequest(
      mission.supervisorSessionId!,
      'threadhelm_work_reassign',
      decision(mission.id, { workItemId: work.id, bindingId: binding.bindingId }),
    );
    const retried = await detail(mission.id);
    expect(retried.attempts).toHaveLength(2);
    expect(retried.attempts[1]!.workerStartDisposition).toBe('started');
  });

  it('holds unavailable Claude auto without starting a worker or falling back to bypass', async () => {
    await app.useFixtureAdapters({ 'codex-cli': 'echo', 'claude-code': 'echo' });
    const input = await prepare();
    await stop(input.workers[0]!.sessionId!);
    const profile = await missionProfile(app, 'Claude fixture specialist', {
      provider: 'claude',
      model: 'claude-opus-5',
    });
    input.workers[0] = {
      ...input.workers[0]!,
      profileId: profile.profileId,
      profileRevisionId: profile.currentRevisionId,
      sessionId: null,
      autoStart: true,
      runtimeSelection: { model: 'claude-opus-5', effort: null },
      permissionSelection: { policy: 'auto', boundedAllowlist: [] },
    };
    const mission = await confirm(input);
    const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
    expect(binding.launchDisposition).toBe('held');
    expect(binding.permissionResolution.policy).toBe('auto');
    await expect(assign(mission)).rejects.toThrow('WORKER_AUTOSTART_PREFLIGHT_FAILED');
    const held = await detail(mission.id);
    expect(held.attempts).toHaveLength(0);
    expect(held.leases).toHaveLength(0);
    expect(await app.liveSessions()).toHaveLength(1);
  });

  it.each(['elapsed', 'no_progress', 'output'] as const)(
    'enforces the main-owned %s bound on real worker activity',
    async (bound) => {
      const input = await prepare();
      if (bound === 'elapsed') input.bounds.maxElapsedMs = 2_000;
      if (bound === 'no_progress') input.bounds.maxNoProgressMs = 2_000;
      if (bound === 'output') input.bounds.maxOutputBytes = 1_024;
      const mission = await confirm(input);
      const { attempt } = await assign(mission);
      if (bound === 'output') {
        await app.call('sessions.select', { sessionId: attempt.sessionId });
        expect(
          (await sendInput(app, attempt.sessionId!, 'BOUND_OUTPUT_' + 'x'.repeat(2048) + '\r')).ok,
        ).toBe(true);
      }
      const held = await waitFor(
        () => detail(mission.id),
        (current) => current.attempts[0]?.disposition !== null && current.state === 'paused',
        10_000,
      );
      const expected =
        bound === 'elapsed'
          ? 'timed_out'
          : bound === 'no_progress'
            ? 'no_progress'
            : 'budget_exhausted';
      expect([expected, 'unknown']).toContain(held.attempts[0]!.disposition);
      expect(held.attempts).toHaveLength(1);
      await waitFor(
        () => app.liveSessions(),
        (sessions) => !sessions.some((session) => session.id === attempt.sessionId),
      );
      expect(readFileSync(join(app.userData, 'logs', 'threadhelm.log'), 'utf8')).not.toContain(
        'BOUND_OUTPUT_',
      );
    },
  );

  it('runs three exact workers, preserves causal results and deduplicates assignments', async () => {
    const mission = await confirm(await prepare(3));
    const assignments = [];
    for (let index = 0; index < 3; index++) assignments.push(await assign(mission, index));
    expect((await detail(mission.id)).activeWorkerCount).toBe(3);
    expect(await app.liveSessions()).toHaveLength(4);
    await app.bridgeRequest(
      mission.supervisorSessionId!,
      'threadhelm_work_assign',
      assignments[0]!.request,
    );
    expect((await detail(mission.id)).attempts).toHaveLength(3);
    for (const { attempt } of assignments) {
      expect((await app.jobSnapshot(attempt.sessionId!))!.activeProcessCount).toBeGreaterThan(0);
      const response = result(attempt, 'completion');
      await app.bridgeRequest(attempt.sessionId!, 'threadhelm_work_result', response);
      // Final results end the bounded worker and revoke its bridge credential.
      await expect(
        app.bridgeRequest(attempt.sessionId!, 'threadhelm_work_result', response),
      ).rejects.toThrow();
      expect(await app.jobSnapshot(attempt.sessionId!)).toBeNull();
    }
    const finished = await detail(mission.id);
    expect(finished.completedWorkItemCount).toBe(3);
    expect(finished.leases.every((lease) => lease.state === 'released')).toBe(true);
    expect(
      finished.attempts.every(
        (attempt) => attempt.resultHandoffId && attempt.handoffId && attempt.profileRevisionId,
      ),
    ).toBe(true);
    await app.bridgeRequest(
      mission.supervisorSessionId!,
      'threadhelm_mission_complete',
      decision(mission.id, { evidenceRefs: [{ kind: 'artifact', id: 'fixture-report.md' }] }),
    );
    expect((await detail(mission.id)).state).toBe('completed');
  });

  it('starts only the exact preauthorized offline worker and records its profile and start link', async () => {
    const input = await prepare();
    const previous = input.workers[0]!.sessionId!;
    await stop(previous);
    input.workers[0]!.sessionId = null;
    input.workers[0]!.autoStart = true;
    const mission = await confirm(input);
    expect(await app.liveSessions()).toHaveLength(1);
    const { attempt, binding } = await assign(mission);
    expect(attempt.sessionId).not.toBe(previous);
    expect(attempt.workerStartDisposition).toBe('started');
    expect(attempt.profileRevisionId).toBe(binding.profileRevisionId);
    expect(attempt.handoffId).not.toBeNull();
    expect(await app.liveSessions()).toHaveLength(2);
  });

  it('rejects worker self-appointment and envelope escape, and holds consequential descendants', async () => {
    const mission = await confirm(await prepare());
    const worker = mission.envelope!.bindings.find((binding) => binding.role === 'worker')!;
    await expect(
      app.bridgeRequest(
        worker.sessionId!,
        'threadhelm_work_decompose',
        decision(mission.id, { items: [supervisorFixtureWork(worker.workspaceId)] }),
      ),
    ).rejects.toThrow();
    await expect(
      app.bridgeRequest(
        mission.supervisorSessionId!,
        'threadhelm_work_decompose',
        decision(randomUUID(), { items: [supervisorFixtureWork(worker.workspaceId)] }),
      ),
    ).rejects.toThrow();
    const parent = supervisorFixtureWork(worker.workspaceId, { authorityClass: 'destructive' });
    const child = supervisorFixtureWork(worker.workspaceId, { parentWorkItemId: parent.id });
    await app.bridgeRequest(
      mission.supervisorSessionId!,
      'threadhelm_work_decompose',
      decision(mission.id, { items: [parent, child] }),
    );
    await expect(
      app.bridgeRequest(
        mission.supervisorSessionId!,
        'threadhelm_work_assign',
        decision(mission.id, { workItemId: child.id, bindingId: worker.bindingId }),
      ),
    ).rejects.toThrow();
    const held = await detail(mission.id);
    expect(held.attempts).toHaveLength(0);
    expect(held.leases).toHaveLength(0);
    expect(
      held.workItems.every((item) => item.state !== 'ready' && item.state !== 'assigned'),
    ).toBe(true);
    expect(await app.liveSessions()).toHaveLength(2);
  });

  it('holds a second write assignment while the native workspace lease is active', async () => {
    const mission = await confirm(await prepare());
    const first = await assign(mission);
    const other = supervisorFixtureWork(first.binding.workspaceId, {
      title: 'A separate work item',
    });
    await app.bridgeRequest(
      mission.supervisorSessionId!,
      'threadhelm_work_decompose',
      decision(mission.id, { items: [other] }),
    );
    await expect(
      app.bridgeRequest(
        mission.supervisorSessionId!,
        'threadhelm_work_assign',
        decision(mission.id, { workItemId: other.id, bindingId: first.binding.bindingId }),
      ),
    ).rejects.toThrow();
    const held = await detail(mission.id);
    expect(held.attempts).toHaveLength(1);
    expect(held.leases.filter((lease) => lease.state === 'active')).toHaveLength(1);
  });

  it('stops three equivalent decisions without launching or replaying work', async () => {
    const mission = await confirm(await prepare());
    const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
    for (let index = 0; index < 2; index++) {
      await app.bridgeRequest(
        mission.supervisorSessionId!,
        'threadhelm_work_decompose',
        decision(mission.id, { items: [supervisorFixtureWork(binding.workspaceId)] }),
      );
    }
    await expect(
      app.bridgeRequest(
        mission.supervisorSessionId!,
        'threadhelm_work_decompose',
        decision(mission.id, { items: [supervisorFixtureWork(binding.workspaceId)] }),
      ),
    ).rejects.toThrow('SUPERVISOR_DECISION_LOOP');
    const held = await detail(mission.id);
    expect(held.state).toBe('paused');
    expect(held.attempts).toHaveLength(0);
    expect(await app.liveSessions()).toHaveLength(2);
  });

  it.each([
    'timed_out',
    'no_progress',
    'budget_exhausted',
    'permission_blocked',
    'classifier_failed',
  ] as const)(
    'stops a %s worker and retains an honest result without automatic retry',
    async (disposition) => {
      const mission = await confirm(await prepare());
      const { attempt } = await assign(mission);
      // Stopping the originating worker may close its transport before the reply arrives.
      await app
        .bridgeRequest(attempt.sessionId!, 'threadhelm_work_result', result(attempt, disposition))
        .catch(() => undefined);
      const held = await waitFor(
        () => detail(mission.id),
        (current) => current.attempts[0]!.disposition !== null,
      );
      expect([disposition, 'unknown']).toContain(held.attempts[0]!.disposition);
      expect(held.state).toBe('paused');
      expect(held.attempts).toHaveLength(1);
      if (held.attempts[0]!.disposition === 'unknown')
        expect(held.leases[0]!.state).toBe('unknown');
      await waitFor(
        () => app.liveSessions(),
        (sessions) => !sessions.some((session) => session.id === attempt.sessionId),
      );
      expect((await detail(mission.id)).attempts).toHaveLength(1);
    },
  );

  it('crash recovery retains three unknown leases, starts nothing, and requires exact owner disposition', async () => {
    const mission = await confirm(await prepare(3));
    for (let index = 0; index < 3; index++) await assign(mission, index);
    const before = await detail(mission.id);
    const pids = (
      await Promise.all((await app.liveSessions()).map((session) => app.jobSnapshot(session.id)))
    ).flatMap((snapshot) => snapshot?.processIds ?? []);
    const userData = app.userData;
    await app.crashCoordinator();
    for (const pid of pids)
      expect(await waitForPidExit(pid, 10_000), `contained PID ${pid}`).toBe(true);
    app = await launchApp({ userData });
    const recovered = await detail(mission.id);
    expect(recovered.state).toBe('recovery_required');
    expect(recovered.attempts).toHaveLength(3);
    expect(recovered.attempts.every((attempt) => attempt.state === 'unknown')).toBe(true);
    expect(recovered.leases.every((lease) => lease.state === 'unknown')).toBe(true);
    expect(await app.liveSessions()).toHaveLength(0);
    await app.call('missions.cancel', { missionId: mission.id });
    for (const attempt of before.attempts) {
      await app.call('missions.resolveEscalation', {
        missionId: mission.id,
        workItemId: attempt.workItemId,
        disposition: 'acknowledge_unknown',
        expectedAttemptId: attempt.id,
        expectedLeaseId: attempt.leaseId,
      });
    }
    const resolved = await detail(mission.id);
    expect(resolved.state).toBe('cancelled');
    expect(resolved.leases.every((lease) => lease.state === 'released')).toBe(true);
    expect(resolved.attempts).toHaveLength(3);
    expect(await app.liveSessions()).toHaveLength(0);
  });

  it('power invalidation pauses work and never starts a replacement worker', async () => {
    const mission = await confirm(await prepare());
    await assign(mission);
    await app.simulatePower('suspend');
    const held = await detail(mission.id);
    expect(['paused', 'recovery_required']).toContain(held.state);
    expect(held.attempts).toHaveLength(1);
    await app.simulatePower('resume');
    expect((await detail(mission.id)).attempts).toHaveLength(1);
  });
});
