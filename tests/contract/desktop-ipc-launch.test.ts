/** T033 — sessions.previewLaunch / sessions.launch token flow and stale-preflight failures. */

import { BOUNDARY_WARNING, LaunchPreviewView, SessionView } from '@threadhelm/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
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
  });

describe('sessions.previewLaunch', () => {
  it('discloses effective path, readiness, and the boundary warning behind a token', async () => {
    const result = await preview();
    expect(result.ok).toBe(true);
    const view = LaunchPreviewView.parse((result as { value: unknown }).value);
    expect(view.boundaryWarning).toBe(BOUNDARY_WARNING);
    expect(view.workspace.id).toBe(workspaceId);
    expect(view.readiness.availability).toBe('available');
    expect(view.readiness.resolvedExecutable).toBe(READY.resolvedExecutable);
    expect(view.terminal).toEqual(TERMINAL);
    expect(view.previewToken.length).toBeGreaterThanOrEqual(16);
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
