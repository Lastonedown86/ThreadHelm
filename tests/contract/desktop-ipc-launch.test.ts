/** T033 — sessions.previewLaunch / sessions.launch token flow and stale-preflight failures. */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BOUNDARY_WARNING, LaunchPreviewView, SessionView } from '@threadhelm/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { BridgeSessionManager } from '../../apps/desktop/src/main/coordination/bridge.js';
import { resolveLaunchRuntime } from '../../apps/desktop/src/main/sessions/launch-policy.js';
import {
  createWorld,
  errorCode,
  eventsNamed,
  identity,
  READY,
  type FakeWorld,
} from './helpers/fake-context.js';

const DIR = 'C:\\projects\\alpha';
const TERMINAL = { columns: 120, rows: 40 };

let world: FakeWorld;
let workspaceId: string;

beforeEach(async () => {
  world = createWorld();
  world.addDir(DIR, identity(1));
  workspaceId = (await world.approve(DIR)).id;
});

const preview = (providerId = 'codex-cli') =>
  world.call<LaunchPreviewView>('sessions.previewLaunch', {
    workspaceId,
    providerId,
    terminal: TERMINAL,
    runtimeSelection: { model: 'gpt-5.6-luna', effort: 'low' },
  });

describe('sessions.previewLaunch', () => {
  it('resolves model and effort independently through persisted policy precedence', () => {
    const base = {
      providerId: 'codex-cli' as const,
      taskType: 'test_authoring' as const,
      escalationReason: null,
      profileRevisionRequest: {
        reference: 'profile-revision-7',
        runtimeSelection: { model: 'gpt-5.6-terra', effort: null },
      },
      taskTypePolicy: {
        reference: 'test-authoring-policy-3',
        runtimeSelection: { model: 'gpt-5.6-luna', effort: 'low' as const },
      },
      projectPolicy: {
        reference: 'project-policy-5',
        runtimeSelection: { model: 'gpt-5.4-mini', effort: 'medium' as const },
      },
    };

    expect(resolveLaunchRuntime({ ...base, oneRunOverride: null })).toMatchObject({
      runtimeSelection: { model: 'gpt-5.6-terra', effort: 'low' },
      modelSource: { kind: 'profile_revision', reference: 'profile-revision-7' },
      effortSource: { kind: 'task_type_policy', reference: 'test-authoring-policy-3' },
    });
    expect(
      resolveLaunchRuntime({
        ...base,
        oneRunOverride: { model: null, effort: null },
      }),
    ).toMatchObject({
      runtimeSelection: { model: null, effort: null },
      modelSource: { kind: 'one_run', reference: null },
      effortSource: { kind: 'one_run', reference: null },
    });
    expect(
      resolveLaunchRuntime({
        ...base,
        oneRunOverride: null,
        profileRevisionRequest: null,
        taskTypePolicy: null,
      }),
    ).toMatchObject({
      runtimeSelection: { model: 'gpt-5.4-mini', effort: 'medium' },
      modelSource: { kind: 'project_policy', reference: 'project-policy-5' },
      effortSource: { kind: 'project_policy', reference: 'project-policy-5' },
    });
    expect(
      resolveLaunchRuntime({
        ...base,
        oneRunOverride: null,
        profileRevisionRequest: null,
        taskTypePolicy: null,
        projectPolicy: null,
      }),
    ).toMatchObject({
      runtimeSelection: { model: null, effort: null },
      modelSource: { kind: 'cli_default', reference: null },
      effortSource: { kind: 'cli_default', reference: null },
    });
  });

  it('recommends the lowest-cost test model and holds costly escalation without a reason', () => {
    const recommended = resolveLaunchRuntime({
      providerId: 'claude-code',
      taskType: 'test_authoring',
      oneRunOverride: null,
      profileRevisionRequest: null,
      taskTypePolicy: null,
      projectPolicy: null,
      escalationReason: null,
    });
    expect(recommended.recommendation).toEqual({
      model: 'sonnet',
      effort: 'low',
      reason: 'Lowest-cost capable approved option for routine test authoring.',
    });

    const held = resolveLaunchRuntime({
      providerId: 'claude-code',
      taskType: 'test_authoring',
      oneRunOverride: { model: 'opus', effort: 'high' },
      profileRevisionRequest: null,
      taskTypePolicy: null,
      projectPolicy: null,
      escalationReason: null,
    });
    expect(held).toMatchObject({
      disposition: 'held',
      reasonCode: 'RUNTIME_ESCALATION_REASON_REQUIRED',
      requiresEscalationReason: true,
    });

    expect(
      resolveLaunchRuntime({
        providerId: 'claude-code',
        taskType: 'test_authoring',
        oneRunOverride: { model: 'opus', effort: 'high' },
        profileRevisionRequest: null,
        taskTypePolicy: null,
        projectPolicy: null,
        escalationReason: 'Complex cross-provider regression requires deeper analysis.',
      }),
    ).toMatchObject({
      disposition: 'ready',
      escalationReason: 'Complex cross-provider regression requires deeper analysis.',
    });
  });

  it('binds a required high-cost escalation reason into the one-use preview', async () => {
    const held = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
      runtimeSelection: { model: 'gpt-5.6-sol', effort: 'high' },
      workType: 'failure_analysis',
    });
    expect(held.runtimeResolution).toMatchObject({
      disposition: 'held',
      requiresEscalationReason: true,
      escalationReason: null,
    });
    expect(
      errorCode(
        await world.call('sessions.launch', {
          previewToken: held.previewToken,
          boundaryConfirmation: true,
        }),
      ),
    ).toBe('INVALID_REQUEST');

    const reason = 'A cross-provider release regression requires deeper analysis.';
    const ready = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
      runtimeSelection: { model: 'gpt-5.6-sol', effort: 'high' },
      workType: 'failure_analysis',
      runtimeEscalationReason: reason,
    });
    expect(ready.runtimeResolution).toMatchObject({
      disposition: 'ready',
      escalationReason: reason,
    });
  });

  it('discloses effective path, readiness, and the boundary warning behind a token', async () => {
    const result = await preview();
    expect(result.ok).toBe(true);
    const view = LaunchPreviewView.parse((result as { value: unknown }).value);
    expect(view.boundaryWarning).toBe(BOUNDARY_WARNING);
    expect(view.workspace.id).toBe(workspaceId);
    expect(view.readiness.availability).toBe('available');
    expect(view.readiness.resolvedExecutable).toBe(READY.resolvedExecutable);
    expect(view.terminal).toEqual(TERMINAL);
    expect(view.runtimeSelection).toEqual({ model: 'gpt-5.6-luna', effort: 'low' });
    expect(view.runtimeResolution).toMatchObject({
      modelSource: { kind: 'one_run' },
      effortSource: { kind: 'one_run' },
      disposition: 'ready',
    });
    expect(view.previewToken.length).toBeGreaterThanOrEqual(16);
  });

  it('binds CLI-default model and effort choices explicitly in the preview', async () => {
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'claude-code',
      terminal: TERMINAL,
      runtimeSelection: { model: null, effort: null },
    });
    expect(view.coordinationBridge).toEqual({
      enabled: true,
      tools: ['list pending', 'acknowledge', 'reply', 'report outcome'],
      durableContent: true,
      failureBehavior: 'manual_only',
    });
    expect(view.runtimeSelection).toEqual({ model: null, effort: null });
    expect(view.runtimeResolution).toMatchObject({
      modelSource: { kind: 'one_run' },
      effortSource: { kind: 'one_run' },
    });
    expect(view.permissionResolution).toMatchObject({
      policy: 'manual',
      source: 'provider_default',
      disposition: 'ready',
      providerMapping: 'claude_manual',
    });
    expect(view.executionBounds).toMatchObject({
      maxElapsedMs: expect.any(Number),
      maxTurns: expect.any(Number),
      maxNoProgressMs: expect.any(Number),
      maxOutputBytes: expect.any(Number),
    });
  });

  it('binds exact Claude auto capability evidence and fails closed when it drifts', async () => {
    world.clock.now = Date.parse('2026-08-30T12:00:00.000Z');
    world.adapters['claude-code'].permissionEvidence = {
      providerId: 'claude-code',
      providerVersion: READY.version!,
      model: 'claude-sonnet-5',
      providerSurface: 'claude-code',
      organizationPolicy: 'allowed',
      supportedPolicies: ['manual', 'auto'],
      observedAt: '2026-08-30T11:59:00.000Z',
      expiresAt: '2026-08-30T12:04:00.000Z',
    };
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'claude-code',
      terminal: TERMINAL,
      runtimeSelection: { model: 'claude-sonnet-5', effort: 'medium' },
      permissionSelection: { policy: 'auto', boundedAllowlist: [] },
    });
    expect(view.permissionResolution).toMatchObject({
      policy: 'auto',
      source: 'one_run',
      disposition: 'ready',
      providerMapping: 'claude_auto',
      capabilityEvidence: { providerVersion: READY.version },
    });
    world.adapters['claude-code'].permissionEvidence = null;
    const result = await world.call('sessions.launch', {
      previewToken: view.previewToken,
      boundaryConfirmation: true,
    });
    expect(errorCode(result)).toBe('PROVIDER_UNAVAILABLE');
    expect(result.ok ? null : result.error.details.reason).toBe('PERMISSION_CAPABILITY_CHANGED');
    expect(world.hosts).toHaveLength(0);
  });

  it('holds unavailable auto and offers no bypass fallback', async () => {
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'claude-code',
      terminal: TERMINAL,
      permissionSelection: { policy: 'auto', boundedAllowlist: [] },
    });
    expect(view.permissionResolution).toMatchObject({
      disposition: 'held',
      fallbackActions: ['manual', 'bounded_allowlist'],
    });
    expect(JSON.stringify(view.permissionResolution)).not.toContain('bypass');
    const result = await world.call('sessions.launch', {
      previewToken: view.previewToken,
      boundaryConfirmation: true,
    });
    expect(errorCode(result)).toBe('PROVIDER_UNAVAILABLE');
    expect(world.hosts).toHaveLength(0);
  });

  it('rejects model identifiers that could become command syntax', async () => {
    const result = await world.call('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
      runtimeSelection: { model: 'gpt-5.6-luna --danger', effort: 'low' },
    });
    expect(errorCode(result)).toBe('INVALID_REQUEST');
    expect(world.hosts).toHaveLength(0);
  });

  it.each([
    ['missing', { availability: 'missing' as const, resolvedExecutable: null, version: null }],
    [
      'unauthenticated',
      { availability: 'unauthenticated' as const, authentication: 'unauthenticated' as const },
    ],
    ['unsupported', { availability: 'unsupported' as const }],
    ['auth unknown but available is still allowed', null],
  ])('readiness %s', async (_label, patch) => {
    if (patch) {
      Object.assign(world.adapters['codex-cli'].readiness, patch);
      const result = await preview();
      expect(errorCode(result)).toBe('PROVIDER_UNAVAILABLE');
      expect(result.ok ? null : result.error.details.availability).toBe(patch.availability);
    } else {
      world.adapters['codex-cli'].readiness.authentication = 'unknown';
      expect((await preview()).ok).toBe(true);
    }
  });

  it('WRITE_LEASE_HELD when an alias of an active workspace is previewed', async () => {
    await world.launch(workspaceId);
    world.addDir('C:\\PROJECTS\\alpha\\', identity(1));
    const alias = await world.approve('C:\\PROJECTS\\alpha\\');
    expect(alias.id).toBe(workspaceId);
    const result = await preview();
    expect(errorCode(result)).toBe('WRITE_LEASE_HELD');
    expect(result.ok ? null : result.error.details.holderSessionId).toBeTruthy();
  });

  it('WORKSPACE_CHANGED when the folder identity changed since approval', async () => {
    world.addDir(DIR, identity(7));
    expect(errorCode(await preview())).toBe('WORKSPACE_CHANGED');
  });
});

describe('sessions.launch', () => {
  it('injects one ephemeral provider bridge config into the exact launched session', async () => {
    const root = mkdtempSync(join(tmpdir(), 'threadhelm-launch-bridge-'));
    const bridgeExecutablePath = join(root, 'threadhelm-coordination-bridge.exe');
    writeFileSync(bridgeExecutablePath, 'fixture');
    world.ctx.coordinationBridge = new BridgeSessionManager({
      repo: world.ctx.storage!.repositories.coordination,
      configRoot: root,
      bridgeExecutablePath,
    });
    try {
      const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
        workspaceId,
        providerId: 'claude-code',
        terminal: TERMINAL,
        runtimeSelection: { model: null, effort: null },
      });
      const launchResult = await world.call<SessionView>('sessions.launch', {
        previewToken: view.previewToken,
        boundaryConfirmation: true,
      });
      expect(
        launchResult.ok,
        launchResult.ok ? undefined : JSON.stringify(launchResult.error),
      ).toBe(true);
      if (!launchResult.ok) throw new Error(launchResult.error.code);
      const session = launchResult.value;
      const launch = world.hosts[0]!.received.find((message) => message.type === 'host.launch');
      expect(launch?.type).toBe('host.launch');
      if (launch?.type !== 'host.launch') throw new Error('launch descriptor missing');
      expect(launch.descriptor.args).toContain('--mcp-config');
      expect(launch.descriptor.args.join(' ')).toContain(session.id);
      world.ctx.coordinationBridge.revoke(session.id);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes the preview-bound model and effort to the provider adapter', async () => {
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'claude-code',
      terminal: TERMINAL,
      runtimeSelection: { model: 'fable', effort: 'medium' },
    });
    await world.ok('sessions.launch', {
      previewToken: view.previewToken,
      boundaryConfirmation: true,
    });
    const host = world.hosts[0]!;
    const launch = host.received.find((message) => message.type === 'host.launch') as Extract<
      (typeof host.received)[number],
      { type: 'host.launch' }
    >;
    expect(launch.descriptor.args).toEqual(['--fake', '--model', 'fable', '--effort', 'medium']);
  });

  it('PREVIEW_EXPIRED for unknown, expired, or reused tokens', async () => {
    expect(
      errorCode(
        await world.call('sessions.launch', {
          previewToken: 'nope'.repeat(5),
          boundaryConfirmation: true,
        }),
      ),
    ).toBe('PREVIEW_EXPIRED');

    const expired = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
    });
    world.clock.now += 61_000;
    expect(
      errorCode(
        await world.call('sessions.launch', {
          previewToken: expired.previewToken,
          boundaryConfirmation: true,
        }),
      ),
    ).toBe('PREVIEW_EXPIRED');

    const used = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
    });
    await world.ok('sessions.launch', {
      previewToken: used.previewToken,
      boundaryConfirmation: true,
    });
    expect(
      errorCode(
        await world.call('sessions.launch', {
          previewToken: used.previewToken,
          boundaryConfirmation: true,
        }),
      ),
    ).toBe('PREVIEW_EXPIRED');
  });

  it('CONFIRMATION_REQUIRED without the per-session confirmation, and the preview is spent', async () => {
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
    });
    expect(
      errorCode(
        await world.call('sessions.launch', {
          previewToken: view.previewToken,
          boundaryConfirmation: false,
        }),
      ),
    ).toBe('CONFIRMATION_REQUIRED');
    expect(
      errorCode(
        await world.call('sessions.launch', {
          previewToken: view.previewToken,
          boundaryConfirmation: true,
        }),
      ),
    ).toBe('PREVIEW_EXPIRED');
    expect(world.hosts).toHaveLength(0);
  });

  it('blocks a stale workspace identity between preview and launch', async () => {
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
    });
    world.addDir(DIR, identity(42));
    const result = await world.call('sessions.launch', {
      previewToken: view.previewToken,
      boundaryConfirmation: true,
    });
    expect(errorCode(result)).toBe('WORKSPACE_CHANGED');
    expect(world.hosts).toHaveLength(0);
    expect(world.native.jobs.size).toBe(0);
  });

  it.each([
    ['executable', { resolvedExecutable: 'C:\\elsewhere\\agent.exe' }, 'EXECUTABLE_CHANGED'],
    ['version', { version: '9.9.9' }, 'VERSION_CHANGED'],
    ['authentication', { authentication: 'unknown' as const }, 'AUTHENTICATION_CHANGED'],
  ])('blocks a stale %s between preview and launch', async (_what, patch, drift) => {
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
    });
    Object.assign(world.adapters['codex-cli'].readiness, patch);
    const result = await world.call('sessions.launch', {
      previewToken: view.previewToken,
      boundaryConfirmation: true,
    });
    expect(errorCode(result)).toBe('PROVIDER_UNAVAILABLE');
    expect(result.ok ? null : result.error.details).toMatchObject({
      reason: 'STALE_PREFLIGHT',
      drift,
    });
    expect(world.hosts).toHaveLength(0);
  });

  it('blocks when the provider became unauthenticated after preview', async () => {
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
    });
    Object.assign(world.adapters['codex-cli'].readiness, {
      availability: 'unauthenticated',
      authentication: 'unauthenticated',
    });
    expect(
      errorCode(
        await world.call('sessions.launch', {
          previewToken: view.previewToken,
          boundaryConfirmation: true,
        }),
      ),
    ).toBe('PROVIDER_UNAVAILABLE');
  });

  it('STORAGE_DEGRADED blocks launch while live sessions stay visible', async () => {
    const degraded = createWorld({ degraded: true });
    degraded.addDir(DIR, identity(1));
    // approve needs a writable store too
    expect(errorCode(await degraded.call('workspaces.choose'))).toBe('SELECTION_CANCELLED');
    degraded.pickerPath = DIR;
    const candidate = await degraded.ok<{ candidateToken: string }>('workspaces.choose');
    expect(
      errorCode(
        await degraded.call('workspaces.approve', { candidateToken: candidate.candidateToken }),
      ),
    ).toBe('STORAGE_DEGRADED');
    const list = await degraded.ok<{ storageDegraded: boolean }>('sessions.list');
    expect(list.storageDegraded).toBe(true);
  });

  it('happy path: durable starting record, proven containment, then running', async () => {
    world.events.length = 0;
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
    });
    const session = SessionView.parse(
      await world.ok('sessions.launch', {
        previewToken: view.previewToken,
        boundaryConfirmation: true,
      }),
    );
    expect(session.lifecycleState).toBe('running');
    expect(session.workspaceId).toBe(workspaceId);
    expect(session.providerDisplayName).toBe('Codex CLI');
    expect(session.columns).toBe(120);

    // durable state
    const repos = world.ctx.storage!.repositories;
    const record = repos.sessions.findById(session.id)!;
    expect(record.lifecycleState).toBe('running');
    expect(record.hostPid).toBe(world.hosts[0]!.pid);
    expect(record.rootPid).toBe(world.hosts[0]!.rootPid);
    expect(record.startedAt).not.toBeNull();
    const snapshot = repos.readiness.findById(record.readinessSnapshotId)!;
    expect(snapshot.resolvedExecutable).toBe(READY.resolvedExecutable);
    expect(repos.events.listBySession(session.id).map((e) => [e.kind, e.toState])).toEqual([
      ['launch_requested', 'starting'],
      ['launched', 'running'],
    ]);

    // renderer told, in order
    const changed = eventsNamed(world, 'session.changed') as {
      session: { lifecycleState: string };
    }[];
    expect(changed.map((e) => e.session.lifecycleState)).toEqual(['starting', 'running']);

    // containment before launch: assign + verify + inspect(=1) precede host.launch
    const host = world.hosts[0]!;
    const ops = world.native.calls.map((c) => c.op);
    const launchIndex = host.received.findIndex((m) => m.type === 'host.launch');
    expect(launchIndex).toBeGreaterThan(0);
    expect(host.received[0]!.type).toBe('host.bootstrap');
    expect(ops.indexOf('createKillOnCloseJob')).toBeLessThan(ops.indexOf('assignProcess'));
    expect(ops.indexOf('assignProcess')).toBeLessThan(ops.indexOf('verifyProcessInJob'));
    expect(world.native.calls.find((c) => c.op === 'assignProcess')!.args[1]).toBe(host.pid);
    // and the root is inside the same job as the host
    expect(world.native.jobOf(host.rootPid)).toBe(world.native.jobOf(host.pid));
    // descriptor came from the adapter with the canonical cwd and no user text
    const launch = host.received[launchIndex] as Extract<
      (typeof host.received)[number],
      { type: 'host.launch' }
    >;
    // main hands the provider the display form: a `\?` cwd breaks child processes
    expect(launch.descriptor.cwd).toBe(DIR);
    expect(launch.descriptor.args).toEqual(['--fake']);
    expect(launch.descriptor.executable).toBe(READY.resolvedExecutable);
    expect(host.port).toBeDefined();
  });

  it.each([
    [
      'membership cannot be verified',
      (w: FakeWorld) => (w.native.verifyResult = false),
      'PROCESS_NOT_IN_JOB',
    ],
    [
      'assignment is refused',
      (w: FakeWorld) => (w.native.assignThrows = 'PROCESS_ASSIGN_FAILED (win32=5)'),
      'PROCESS_ASSIGN_FAILED',
    ],
  ])('fails closed when %s', async (_label, arrange, reason) => {
    arrange(world);
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
    });
    const result = await world.call('sessions.launch', {
      previewToken: view.previewToken,
      boundaryConfirmation: true,
    });
    expect(errorCode(result)).toBe('SUPERVISION_FAILED');
    expect(result.ok ? null : result.error.details.reason).toBe(reason);
    const host = world.hosts[0]!;
    expect(host.received.some((m) => m.type === 'host.launch')).toBe(false);
    await assertRolledBack();
  });

  // ponytail: a failure answered to host.bootstrap (before host.ready) leaves the
  // `launched` deferred in launch.ts rejected-but-unobserved (unhandled rejection);
  // reported to the parent, so this exercises the post-ready failure path only.
  it('fails closed when the host reports a failure before launching', async () => {
    const spawn = world.ctx.hosts.spawn;
    world.ctx.hosts = {
      spawn(id) {
        const host = spawn(id) as (typeof world.hosts)[number];
        host.failOnLaunch = 'PTY_CREATE_FAILED';
        return host;
      },
    };
    const view = await world.ok<LaunchPreviewView>('sessions.previewLaunch', {
      workspaceId,
      providerId: 'codex-cli',
      terminal: TERMINAL,
    });
    const result = await world.call('sessions.launch', {
      previewToken: view.previewToken,
      boundaryConfirmation: true,
    });
    expect(errorCode(result)).toBe('SUPERVISION_FAILED');
    expect(result.ok ? null : result.error.details.reason).toBe('PTY_CREATE_FAILED');
    expect(world.hosts[0]!.sent.some((m) => m.type === 'host.launched')).toBe(false);
    await assertRolledBack();
  });

  async function assertRolledBack() {
    await world.until(() => world.ctx.live.size === 0);
    const record = world.ctx.storage!.repositories.sessions.list()[0]!;
    expect(record.lifecycleState).toBe('failed');
    expect(record.endedAt).not.toBeNull();
    expect(world.native.jobs.size).toBe(0);
    expect(world.ctx.leases.holderOf(identity(1))).toBeNull();
    // the workspace is free for another launch
    expect((await preview()).ok).toBe(true);
  }
});
