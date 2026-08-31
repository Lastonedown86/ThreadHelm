import { afterEach, describe, expect, it } from 'vitest';
import * as contracts from '@threadhelm/contracts';
import { decision, supervisorWorld } from './helpers/supervisor-world.js';
import { supervisorFixtureWork } from '../../packages/test-fixtures/src/supervisor.js';
import { failSession } from '../../apps/desktop/src/main/sessions/failure.js';

describe('supervisor strict IPC and provider contracts', () => {
  it('exposes named mission controls without a generic provider or renderer command gateway', () => {
    expect(contracts.operationNames).toContain('missions.preview');
    expect(contracts.operationNames).toContain('missions.eligibleSessions');
    expect(contracts.operationNames).toContain('missions.confirmRevision');
    expect(contracts.operationNames).not.toContain('missions.execute');
  });
  it('rejects renderer-supplied supervisor decisions and role claims on lifecycle controls', () => {
    const operation = contracts.operations['missions.pause'];
    expect(operation).toBeDefined();
    expect(
      operation.request.safeParse({
        missionId: '00000000-0000-4000-8000-000000000001',
        role: 'supervisor',
        command: 'launch',
      }).success,
    ).toBe(false);
  });
  it('rejects provider-supplied sender identities, arbitrary recipients and transcript attachment', () => {
    const schema = contracts.SupervisorResultInput;
    expect(schema).toBeDefined();
    const result = {
      missionId: '00000000-0000-4000-8000-000000000001',
      workItemId: '00000000-0000-4000-8000-000000000002',
      attemptId: '00000000-0000-4000-8000-000000000003',
      idempotencyKey: 'result-one',
      disposition: 'completion',
      explanation: 'Finished work',
      evidenceRefs: [{ kind: 'artifact', id: 'result.md' }],
    };
    expect(schema.safeParse(result).success).toBe(true);
    for (const extra of [
      { recipientSessionId: result.missionId },
      { senderSessionId: result.missionId },
      { transcript: 'terminal bytes' },
      { authorityApproved: true },
    ]) {
      expect(schema.safeParse({ ...result, ...extra }).success).toBe(false);
    }
  });
  it('keeps mission and work events content-free', () => {
    const event = contracts.events['mission.changed'];
    expect(event).toBeDefined();
    expect(
      event.safeParse({
        missionId: '00000000-0000-4000-8000-000000000001',
        sequence: 1,
        state: 'running',
        workItemId: null,
        reasonCode: null,
        objective: 'secret objective',
      }).success,
    ).toBe(false);
  });
});

describe('main mission authority and process effects', () => {
  let fixture: Awaited<ReturnType<typeof supervisorWorld>> | undefined;
  afterEach(() => fixture?.cleanup());
  it('consumes exact disclosure once and exposes only recorded active session settings', async () => {
    fixture = await supervisorWorld();
    const { world, input } = fixture;
    const eligible = await world.ok<contracts.MissionEligibleSessionView[]>(
      'missions.eligibleSessions',
    );
    expect(eligible.map((s) => s.sessionId)).toContain(fixture.supervisor.id);
    const preview = await world.ok<contracts.MissionPreviewView>('missions.preview', {
      envelope: input,
    });
    const mission = await world.ok<contracts.MissionDetailView>('missions.confirm', {
      previewToken: preview.previewToken,
      boundaryConfirmation: true,
    });
    expect(mission.state).toBe('running');
    expect(world.hosts).toHaveLength(1);
    expect(
      (
        await world.call('missions.confirm', {
          previewToken: preview.previewToken,
          boundaryConfirmation: true,
        })
      ).ok,
    ).toBe(false);
    const summary = await world.ok<contracts.MissionSummaryView[]>('missions.list');
    expect(JSON.stringify(summary)).not.toContain(input.objective);
  });
  it('changes only the authenticated session tool registry after mission binding', async () => {
    fixture = await supervisorWorld();
    const before = await fixture.call(fixture.supervisor.id, 'threadhelm_tool_registry', {});
    expect((before.result as { tools: unknown[] }).tools).toEqual([]);
    const mission = await fixture.confirm();
    const registry = await fixture.call(fixture.supervisor.id, 'threadhelm_tool_registry', {});
    const tools = (registry.result as { tools: { name: string; inputSchema: unknown }[] }).tools;
    expect(tools.map((t) => t.name)).toContain('threadhelm_work_assign');
    expect(tools.map((t) => t.name)).not.toContain('threadhelm_work_result');
    expect(JSON.stringify(tools)).not.toContain(mission.envelope!.objective);
  });
  it('revalidates profile/native/runtime drift and never treats persona capability labels as roles', async () => {
    fixture = await supervisorWorld();
    const { world, input, profiles } = fixture;
    const preview = await world.ok<contracts.MissionPreviewView>('missions.preview', {
      envelope: input,
    });
    world.ctx.storage!.repositories.agentProfiles.setEnabled(
      profiles[1]!.profileId,
      profiles[1]!.revisionId,
      false,
      world.ctx.clock().toISOString(),
    );
    expect(
      (
        await world.call('missions.confirm', {
          previewToken: preview.previewToken,
          boundaryConfirmation: true,
        })
      ).ok,
    ).toBe(false);
    expect(world.hosts).toHaveLength(1);
  });
  it('compares recorded session snapshots structurally across persisted property order', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    const worker = await world.launch(fixture.workspaces[1]!);
    const recorded = world.ctx.live.get(worker.id)!.launchSnapshot!;
    fixture.input.workers[0]!.sessionId = worker.id;
    fixture.input.workers[0]!.runtimeSelection = recorded.runtimeSelection;
    fixture.input.workers[0]!.permissionSelection = recorded.permissionSelection;
    fixture.input.workers[0]!.executionBounds = recorded.executionBounds;
    const mission = await fixture.confirm();
    const reorder = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reorder)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .reverse()
                .map(([key, item]) => [key, reorder(item)]),
            )
          : value;
    for (const sessionId of [supervisor.id, worker.id]) {
      const live = world.ctx.live.get(sessionId)!;
      live.launchSnapshot = reorder(live.launchSnapshot) as NonNullable<typeof live.launchSnapshot>;
    }
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
    );
    const detail = await world.ok<contracts.MissionDetailView>('missions.detail', {
      missionId: mission.id,
    });
    expect(detail.attempts[0]!.sessionId).toBe(worker.id);
    expect(world.hosts).toHaveLength(2);
  });
  it('uses explicit automatic-start permission when the originally bound worker has stopped', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    const worker = await world.launch(fixture.workspaces[1]!);
    const snapshot = world.ctx.live.get(worker.id)!.launchSnapshot!;
    Object.assign(fixture.input.workers[0]!, {
      sessionId: worker.id,
      runtimeSelection: snapshot.runtimeSelection,
      permissionSelection: snapshot.permissionSelection,
      executionBounds: snapshot.executionBounds,
      autoStart: true,
    });
    let mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
    const stop = await world.ok<contracts.StopDisclosureView>('sessions.requestStop', {
      sessionId: worker.id,
    });
    await world.ok('sessions.confirmStop', { stopToken: stop.stopToken });
    await world.until(() => !world.ctx.live.has(worker.id));
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
    );
    mission = await world.ok('missions.detail', { missionId: mission.id });
    expect(mission.attempts[0]!.sessionId).not.toBe(worker.id);
    expect(mission.attempts[0]!.workerStartDisposition).toBe('started');
    expect(world.hosts).toHaveLength(3);
  });
  it('does not let another host acknowledge a reserved worker output budget', async () => {
    fixture = await supervisorWorld(2);
    const { world, call, supervisor } = fixture;
    const workers: { id: string }[] = [];
    for (let n = 0; n < 2; n++) {
      const worker = await world.launch(fixture.workspaces[n + 1]!);
      workers.push(worker);
      const snapshot = world.ctx.live.get(worker.id)!.launchSnapshot!;
      Object.assign(fixture.input.workers[n]!, {
        sessionId: worker.id,
        runtimeSelection: snapshot.runtimeSelection,
        permissionSelection: snapshot.permissionSelection,
        executionBounds: snapshot.executionBounds,
      });
    }
    const mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((item) => item.sessionId === workers[0]!.id)!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    const host = world.hosts[1]!;
    const post = host.postMessage.bind(host);
    let budget: Extract<contracts.MainToHostMessage, { type: 'host.setOutputBudget' }> | undefined;
    host.postMessage = (message, ports) => {
      if (message.type === 'host.setOutputBudget') {
        budget = message;
        host.received.push(message);
      } else post(message, ports);
    };
    let settled = false;
    const pending = call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, {
        workItemId: item.id,
        bindingId: binding.bindingId,
      }),
    ).finally(() => {
      settled = true;
    });
    await world.until(() => budget !== undefined);
    const output = {
      type: 'host.outputProgress' as const,
      sessionId: workers[1]!.id,
      attemptId: budget!.attemptId,
      totalOutputBytes: 0,
      outputBytes: 0,
      sequence: 1,
      limitReached: false,
    };
    world.hosts[2]!.emit(output);
    await world.until(() => !world.ctx.live.has(workers[1]!.id));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const premature = settled;
    host.emit({ ...output, sessionId: workers[0]!.id });
    await pending;
    expect(premature).toBe(false);
    expect(world.ctx.storage!.repositories.supervisor.attempt(budget!.attemptId).state).toBe(
      'running',
    );
  });
  it('closes native and local resources when bridge event delivery throws without releasing unknown mission effects', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    const mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, {
        workItemId: item.id,
        bindingId: binding.bindingId,
      }),
    );
    const attempt = world.ctx.storage!.repositories.supervisor.attempts(mission.id)[0]!;
    const live = world.ctx.live.get(attempt.sessionId!)!;
    const emit = world.ctx.events.emit;
    world.ctx.events.emit = (name, payload) => {
      if (name === 'coordination.bridgeChanged')
        throw new Error('Injected renderer delivery failure');
      emit(name, payload);
    };
    try {
      expect(() => failSession(world.ctx, live, 'HOST_EXITED')).not.toThrow();
      expect(world.ctx.jobs.get(live.id)).toBeUndefined();
      expect(world.ctx.leases.holderOf(binding.identity)).toBeNull();
      expect(world.ctx.live.has(live.id)).toBe(false);
      expect(world.ctx.live.has(supervisor.id)).toBe(true);
      expect(world.ctx.storage!.repositories.supervisor.attempt(attempt.id).state).toBe('unknown');
      expect(world.ctx.storage!.repositories.supervisor.leases(mission.id)[0]!.state).toBe(
        'unknown',
      );
    } finally {
      world.ctx.events.emit = emit;
    }
  });
  it('reserves before an exact automatic start, returns results only to the bound supervisor, and deduplicates decisions', async () => {
    fixture = await supervisorWorld();
    const { world, confirm, supervisor, call } = fixture;
    let mission = await confirm();
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    const assign = decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId });
    await call(supervisor.id, 'threadhelm_work_assign', assign);
    mission = await world.ok('missions.detail', { missionId: mission.id });
    expect(world.hosts).toHaveLength(2);
    expect(mission.leases[0]!.state).toBe('active');
    expect(mission.attempts[0]!.workerStartDisposition).toBe('started');
    await call(supervisor.id, 'threadhelm_work_assign', assign);
    expect(world.hosts).toHaveLength(2);
    const attempt = mission.attempts[0]!;
    await expect(
      call(
        attempt.sessionId!,
        'threadhelm_work_decompose',
        decision(mission.id, { items: [supervisorFixtureWork(binding.workspaceId)] }),
      ),
    ).rejects.toMatchObject({ code: 'SUPERVISOR_ROLE_REQUIRED' });
    await call(attempt.sessionId!, 'threadhelm_work_result', {
      missionId: mission.id,
      workItemId: item.id,
      attemptId: attempt.id,
      idempotencyKey: 'result',
      disposition: 'completion',
      explanation: 'Checked report',
      evidenceRefs: [{ kind: 'artifact', id: 'report.md' }],
    });
    mission = await world.ok('missions.detail', { missionId: mission.id });
    const routed = world.ctx.storage!.repositories.coordination.findHandoffById(
      mission.attempts[0]!.resultHandoffId!,
    );
    expect(routed?.recipientSessionId).toBe(supervisor.id);
    expect(routed?.inReplyToId).toBe(attempt.handoffId);
    expect(mission.workItems[0]!.state).toBe('completed');
  });
  it('holds unavailable auto and consequential work with zero worker starts', async () => {
    fixture = await supervisorWorld();
    fixture.input.workers[0]!.permissionSelection = { policy: 'auto', boundedAllowlist: [] };
    const mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    expect(binding.launchDisposition).toBe('held');
    const work = supervisorFixtureWork(binding.workspaceId);
    await fixture.call(
      fixture.supervisor.id,
      'threadhelm_work_decompose',
      decision(mission.id, { items: [work] }),
    );
    await expect(
      fixture.call(
        fixture.supervisor.id,
        'threadhelm_work_assign',
        decision(mission.id, { workItemId: work.id, bindingId: binding.bindingId }),
      ),
    ).rejects.toMatchObject({ code: 'WORKER_AUTOSTART_PREFLIGHT_FAILED' });
    expect(fixture.world.hosts).toHaveLength(1);
  });
  it('derives shared-memory mission scope from authenticated binding and rejects forged scope', async () => {
    fixture = await supervisorWorld();
    const mission = await fixture.confirm();
    const published = await fixture.call(
      fixture.supervisor.id,
      'threadhelm_memory_propose_revision',
      {
        kind: 'fact',
        title: 'Mission fact',
        body: 'A deliberately shared fact',
        sourceRefs: [],
        confidence: 'medium',
      },
    );
    expect((published.result as contracts.MemoryDetailView).summary.scope).toEqual({
      missionId: mission.id,
    });
    const invalid = await fixture.world.call('memory.previewPublish', {
      scope: { missionId: '00000000-0000-4000-8000-000000000088' },
      kind: 'fact',
      title: 'Unknown mission',
      body: 'A deliberate fact',
      sourceRefs: [],
      confidence: 'medium',
    });
    expect(invalid).toMatchObject({ ok: false, error: { code: 'MEMORY_SCOPE_UNAUTHORIZED' } });
  });
  it('allows explicit disposal of an unknown lease after cancellation without replay', async () => {
    fixture = await supervisorWorld();
    const { world, supervisor, call } = fixture;
    let mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
    );
    mission = await world.ok('missions.detail', { missionId: mission.id });
    const attempt = mission.attempts[0]!;
    await call(attempt.sessionId!, 'threadhelm_work_result', {
      missionId: mission.id,
      workItemId: item.id,
      attemptId: attempt.id,
      idempotencyKey: 'unknown',
      disposition: 'unknown',
      explanation: 'Cannot establish outcome',
      evidenceRefs: [],
    });
    const stop = await world.ok<contracts.StopDisclosureView>('sessions.requestStop', {
      sessionId: attempt.sessionId,
    });
    await world.ok('sessions.confirmStop', { stopToken: stop.stopToken });
    await world.until(() => !world.ctx.live.has(attempt.sessionId!));
    await world.ok('missions.cancel', { missionId: mission.id });
    const stale = await world.call('missions.resolveEscalation', {
      missionId: mission.id,
      workItemId: item.id,
      disposition: 'acknowledge_unknown',
      expectedAttemptId: attempt.id,
      expectedLeaseId: '00000000-0000-4000-8000-000000000099',
    });
    expect(stale).toMatchObject({ ok: false, error: { code: 'WORK_ATTEMPT_UNKNOWN' } });
    const disposed = await world.ok<contracts.MissionDetailView>('missions.resolveEscalation', {
      missionId: mission.id,
      workItemId: item.id,
      disposition: 'acknowledge_unknown',
      expectedAttemptId: attempt.id,
      expectedLeaseId: attempt.leaseId,
    });
    expect(disposed.state).toBe('cancelled');
    expect(disposed.leases[0]!.state).toBe('released');
    expect(world.hosts).toHaveLength(2);
  });
  it('stops the exact worker when trusted host byte counts reach its disclosed output limit', async () => {
    fixture = await supervisorWorld();
    fixture.input.workers[0]!.executionBounds.maxOutputBytes = 1024;
    const { world, call, supervisor } = fixture;
    let mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
    );
    mission = await world.ok('missions.detail', { missionId: mission.id });
    const attempt = mission.attempts[0]!;
    world.hosts[1]!.emit({
      type: 'host.outputProgress',
      sessionId: attempt.sessionId!,
      attemptId: attempt.id,
      totalOutputBytes: 1024,
      outputBytes: 1024,
      sequence: 100,
      limitReached: true,
    });
    await world.until(() => !world.ctx.live.has(attempt.sessionId!));
    mission = await world.ok('missions.detail', { missionId: mission.id });
    expect(mission.state).toBe('paused');
    expect(mission.attempts[0]!.disposition).toBe('budget_exhausted');
    expect(world.ctx.live.has(supervisor.id)).toBe(true);
    expect(mission.leases[0]!.state).toBe('released');
  });
  it('retains an unknown lease when force-stop completion cannot be independently inspected', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    let mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
    );
    world.native.inspectSessionScope = () => {
      throw new Error('JOB_INSPECTION_FAILED');
    };
    mission = await world.ok('missions.cancel', { missionId: mission.id });
    expect(mission.state).toBe('cancelled');
    expect(mission.attempts[0]!.state).toBe('unknown');
    expect(mission.leases[0]!.state).toBe('unknown');
  });
  it('rebinds a replaceable supervisor after explicit resume without changing the pinned launch tuple', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    const mission = await fixture.confirm();
    const stop = await world.ok<contracts.StopDisclosureView>('sessions.requestStop', {
      sessionId: supervisor.id,
    });
    await world.ok('sessions.confirmStop', { stopToken: stop.stopToken });
    await world.until(() => !world.ctx.live.has(supervisor.id));
    world.clock.now += 1000;
    const replacement = await world.launch(fixture.workspaces[0]!);
    const resumed = await world.ok<contracts.MissionDetailView>('missions.resume', {
      missionId: mission.id,
      supervisorSessionId: replacement.id,
    });
    expect(resumed.supervisorSessionId).toBe(replacement.id);
    await expect(
      call(
        replacement.id,
        'threadhelm_work_decompose',
        decision(mission.id, { items: [supervisorFixtureWork(fixture.workspaces[1]!)] }),
      ),
    ).resolves.toBeDefined();
    expect(world.ctx.supervisor!.registryForSession(supervisor.id)).toEqual([]);
  });
  it('rejects resume when an unknown worker outcome arrives during the asynchronous provider probe', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    const mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, {
        workItemId: item.id,
        bindingId: binding.bindingId,
      }),
    );
    await world.ok('missions.pause', { missionId: mission.id });
    const attempt = world.ctx.storage!.repositories.supervisor.attempts(mission.id)[0]!;
    const adapter = world.adapters['codex-cli'];
    const probe = adapter.probe;
    let waiting = false;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    adapter.probe = async (context) => {
      waiting = true;
      await gate;
      return probe(context);
    };
    try {
      const resuming = world.call('missions.resume', {
        missionId: mission.id,
        supervisorSessionId: supervisor.id,
      });
      await world.until(() => waiting);
      await call(attempt.sessionId!, 'threadhelm_work_result', {
        missionId: mission.id,
        workItemId: item.id,
        attemptId: attempt.id,
        idempotencyKey: 'unknown-during-resume',
        disposition: 'unknown',
        explanation: 'Outcome cannot be established',
        evidenceRefs: [],
      });
      release();
      expect(await resuming).toMatchObject({ ok: false, error: { code: 'WORK_ATTEMPT_UNKNOWN' } });
      expect(world.ctx.storage!.repositories.supervisor.mission(mission.id).state).toBe('paused');
      expect(world.ctx.storage!.repositories.supervisor.leases(mission.id)[0]!.state).toBe(
        'unknown',
      );
    } finally {
      release();
      adapter.probe = probe;
    }
  });
  it('allows only three proved-before-effect starts without requiring routine user prompts', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    let mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    world.native.assignThrows = 'PROCESS_ASSIGN_FAILED';
    for (let i = 0; i < 3; i++) {
      await expect(
        call(
          supervisor.id,
          i === 0 ? 'threadhelm_work_assign' : 'threadhelm_work_reassign',
          decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
        ),
      ).rejects.toMatchObject({ code: 'SUPERVISION_FAILED' });
      mission = await world.ok('missions.detail', { missionId: mission.id });
      expect(mission.attempts).toHaveLength(i + 1);
      expect(mission.attempts[i]!.workerStartDisposition).toBe('failed');
      expect(mission.state).toBe(i < 2 ? 'running' : 'paused');
    }
    expect(
      world.hosts.every(
        (host) =>
          !host.received.some((message) => message.type === 'host.launch') ||
          host === world.hosts[0],
      ),
    ).toBe(true);
    expect(mission.leases.every((lease) => lease.state === 'released')).toBe(true);
  });
  it('cleans a dormant host after a descriptive typed preflight error with strict renderer events', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    const mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    const emit = world.ctx.events.emit.bind(world.ctx.events);
    world.ctx.events.emit = (name, payload) => {
      contracts.events[name].parse(payload);
      emit(name, payload);
    };
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    const original = world.adapters['codex-cli'].buildLaunch;
    world.adapters['codex-cli'].buildLaunch = () => {
      throw new contracts.ThreadHelmError(
        'WORKSPACE_CHANGED',
        'The approved folder is no longer available as approved.',
      );
    };
    await expect(
      call(
        supervisor.id,
        'threadhelm_work_assign',
        decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
      ),
    ).rejects.toBeDefined();
    world.adapters['codex-cli'].buildLaunch = original;
    expect([...world.ctx.live.keys()]).toEqual([supervisor.id]);
    const failed = world.ctx.storage!.repositories.supervisor.attempts(mission.id)[0]!;
    expect(failed.workerStartDisposition).toBe('failed');
    await world.ok('missions.resume', {
      missionId: mission.id,
      supervisorSessionId: supervisor.id,
    });
    await call(
      supervisor.id,
      'threadhelm_work_reassign',
      decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
    );
    expect(world.ctx.storage!.repositories.supervisor.attempts(mission.id)).toHaveLength(2);
  });
  it('deletes linked mission handoff and mission-memory content atomically with the mission', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    let mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const memory = await call(supervisor.id, 'threadhelm_memory_propose_revision', {
      kind: 'fact',
      title: 'Deliberate mission note',
      body: 'Private scoped content',
      sourceRefs: [],
      confidence: 'medium',
    });
    const entryId = (memory.result as contracts.MemoryDetailView).summary.entryId;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
    );
    mission = await world.ok('missions.detail', { missionId: mission.id });
    const attempt = mission.attempts[0]!;
    await call(attempt.sessionId!, 'threadhelm_work_result', {
      missionId: mission.id,
      workItemId: item.id,
      attemptId: attempt.id,
      idempotencyKey: 'completed',
      disposition: 'completion',
      explanation: 'Private report',
      evidenceRefs: [{ kind: 'artifact', id: 'report.md' }],
    });
    await call(
      supervisor.id,
      'threadhelm_mission_complete',
      decision(mission.id, { evidenceRefs: [{ kind: 'work_item', id: item.id }] }),
    );
    const preview = await world.ok<{ previewToken: string }>('missions.previewDelete', {
      missionId: mission.id,
    });
    const deleted = await world.ok<contracts.MissionDetailView>('missions.confirmDelete', {
      previewToken: preview.previewToken,
    });
    expect(deleted.state).toBe('deleted');
    expect(
      world.ctx.storage!.repositories.coordination.findHandoffById(attempt.handoffId!)!.body,
    ).toBeNull();
    expect(
      world.ctx.storage!.repositories.memory.get(entryId, { missionId: mission.id }).body,
    ).toBeNull();
    expect(deleted.attempts[0]!.explanation).toBeNull();
  });
  it('pages provider mission inspection below the bridge frame limit', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    const mission = await fixture.confirm();
    const workspaceId = fixture.workspaces[1]!;
    const items = Array.from({ length: 8 }, (_, i) =>
      supervisorFixtureWork(workspaceId, {
        title: `Report ${i}`,
        specification: 'x'.repeat(3900),
        acceptanceCriteria: 'y'.repeat(1900),
      }),
    );
    // Two bounded provider frames; eight full work items cannot fit one response frame.
    for (let i = 0; i < items.length; i += 4)
      await call(
        supervisor.id,
        'threadhelm_work_decompose',
        decision(mission.id, { items: items.slice(i, i + 4) }),
      );
    const response = await call(supervisor.id, 'threadhelm_mission_inspect', {
      missionId: mission.id,
      view: 'work_items',
      cursor: 0,
      limit: 8,
    });
    const page = response.result as { items: unknown[]; nextCursor: number | null };
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.nextCursor).not.toBeNull();
    expect(Buffer.byteLength(JSON.stringify(response))).toBeLessThan(28_000);
    expect(
      (await world.ok<contracts.MissionDetailView>('missions.detail', { missionId: mission.id }))
        .workItems,
    ).toHaveLength(8);
  });
  it('wakes a waiting authenticated supervisor only after committed mission progress', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    let mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
    );
    mission = await world.ok('missions.detail', { missionId: mission.id });
    const attempt = mission.attempts[0]!;
    let returned = false;
    const waiting = call(supervisor.id, 'threadhelm_mission_inspect', {
      missionId: mission.id,
      afterSequence: mission.sequence,
      waitMs: 15000,
    }).then((value) => {
      returned = true;
      return value;
    });
    await Promise.resolve();
    expect(returned).toBe(false);
    await call(attempt.sessionId!, 'threadhelm_work_result', {
      missionId: mission.id,
      workItemId: item.id,
      attemptId: attempt.id,
      idempotencyKey: 'wake-result',
      disposition: 'completion',
      explanation: 'Report complete',
      evidenceRefs: [{ kind: 'artifact', id: 'report.md' }],
    });
    const response = await waiting;
    expect(
      (response.result as { mission: contracts.MissionSummaryView }).mission.sequence,
    ).toBeGreaterThan(mission.sequence);
  });
  it('counts only exact authenticated deduplicated provider turns and stops at the disclosed turn bound', async () => {
    fixture = await supervisorWorld();
    const { world, bridge, call, supervisor } = fixture;
    fixture.input.workers[0]!.executionBounds.maxTurns = 2;
    bridge.setAdapters(
      world.ctx.adapters.map((adapter) => ({
        ...adapter,
        capabilities: {
          ...adapter.capabilities,
          safePointEvidence: {
            mode: 'structured_event' as const,
            exactVersions: ['1.2.3'],
            eventKinds: ['turn_completed' as const],
            maxAgeMs: 30_000,
            inputSafety: 'unknown' as const,
          },
        },
      })),
    );
    let mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
    );
    mission = await world.ok('missions.detail', { missionId: mission.id });
    const attempt = mission.attempts[0]!;
    const token = bridge.testCredential(attempt.sessionId!)!;
    const event = {
      sessionId: attempt.sessionId!,
      providerId: 'codex-cli',
      providerVersion: '1.2.3',
      eventKind: 'turn_completed',
      providerEventId: 'turn-1',
      turnId: 'turn-1',
      occurredAt: world.ctx.clock().toISOString(),
      safePoint: false,
      inputSafety: 'unknown',
    };
    await bridge.ingestLifecycleEvidence(attempt.sessionId!, token, event);
    await bridge.ingestLifecycleEvidence(attempt.sessionId!, token, event);
    expect(world.ctx.storage!.repositories.supervisor.attemptMetadata(attempt.id).turnCount).toBe(
      1,
    );
    await bridge.ingestLifecycleEvidence(attempt.sessionId!, token, {
      ...event,
      providerEventId: 'turn-2',
      turnId: 'turn-2',
    });
    expect(world.ctx.live.has(attempt.sessionId!)).toBe(false);
    expect(world.ctx.storage!.repositories.supervisor.attempt(attempt.id).disposition).toBe(
      'budget_exhausted',
    );
  });
  it('stops bounded workers on a power boundary while retaining unknown outcomes without replay', async () => {
    fixture = await supervisorWorld();
    const { world, call, supervisor } = fixture;
    let mission = await fixture.confirm();
    const binding = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const item = supervisorFixtureWork(binding.workspaceId);
    await call(supervisor.id, 'threadhelm_work_decompose', decision(mission.id, { items: [item] }));
    await call(
      supervisor.id,
      'threadhelm_work_assign',
      decision(mission.id, { workItemId: item.id, bindingId: binding.bindingId }),
    );
    mission = await world.ok('missions.detail', { missionId: mission.id });
    const worker = mission.attempts[0]!.sessionId!;
    world.ctx.supervisor!.onPowerBoundary();
    expect(world.ctx.live.has(worker)).toBe(false);
    expect(world.ctx.storage!.repositories.supervisor.attempts(mission.id)[0]!.state).toBe(
      'unknown',
    );
    expect(world.hosts).toHaveLength(2);
  });
});
