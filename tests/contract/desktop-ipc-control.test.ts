/** T064 — interrupt, requestStop/confirmStop, requestForceStop/confirmForceStop, close blocking. */

import {
  FORCE_STOP_RISK,
  INTERRUPT_OBSERVE_MS,
  type ForceStopDisclosureView,
  type SessionView,
  type StopDisclosureView,
} from '@threadhelm/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createWorld,
  errorCode,
  eventsNamed,
  identity,
  type FakeHost,
  type FakeWorld,
} from './helpers/fake-context.js';

const DIR_A = 'C:\\projects\\alpha';
const DIR_B = 'C:\\projects\\beta';

let world: FakeWorld;
let a: string;
let b: string;
let hostA: FakeHost;
let hostB: FakeHost;

beforeEach(async () => {
  world = createWorld();
  world.addDir(DIR_A, identity(1));
  world.addDir(DIR_B, identity(2));
  a = (await world.launch((await world.approve(DIR_A)).id, 'codex-cli')).id;
  b = (await world.launch((await world.approve(DIR_B)).id, 'claude-code')).id;
  hostA = world.hosts[0]!;
  hostB = world.hosts[1]!;
  world.events.length = 0;
});

afterEach(() => vi.useRealTimers());

const session = async (id: string): Promise<SessionView> => {
  const list = await world.ok<{ sessions: SessionView[] }>('sessions.list');
  return list.sessions.find((s) => s.id === id)!;
};
const eventsOf = (id: string) =>
  world.ctx
    .storage!.repositories.events.listBySession(id)
    .map((e) => [e.kind, e.toState, e.reasonCode]);

describe('sessions.interrupt', () => {
  it('INVALID_STATE unless running', async () => {
    hostA.cleanStop = 'silent';
    const stop = await world.ok<StopDisclosureView>('sessions.requestStop', { sessionId: a });
    await world.ok('sessions.confirmStop', { stopToken: stop.stopToken });
    expect(errorCode(await world.call('sessions.interrupt', { sessionId: a }))).toBe(
      'INVALID_STATE',
    );
    expect(
      errorCode(
        await world.call('sessions.interrupt', {
          sessionId: '11111111-1111-4111-8111-111111111111',
        }),
      ),
    ).toBe('SESSION_NOT_FOUND');
  });

  it('sends Ctrl+C and reports returned_to_interactive when the host acknowledged and the provider lives', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const accepted = await world.ok<{ lifecycleState: string }>('sessions.interrupt', {
      sessionId: a,
    });
    expect(accepted.lifecycleState).toBe('interrupting');
    expect(hostA.received.at(-1)?.type).toBe('host.interrupt');
    await vi.advanceTimersByTimeAsync(INTERRUPT_OBSERVE_MS + 10);
    expect((await session(a)).lifecycleState).toBe('running');
    expect(eventsNamed(world, 'session.interruptResult')).toEqual([
      { sessionId: a, outcome: 'returned_to_interactive' },
    ]);
    expect(eventsOf(a).slice(-2)).toEqual([
      ['interrupt_requested', 'interrupting', 'USER_INTERRUPT'],
      ['state_changed', 'running', 'INTERRUPT_HANDLED'],
    ]);
    // the other session was never touched
    expect((await session(b)).lifecycleState).toBe('running');
    expect(hostB.received.some((m) => m.type === 'host.interrupt')).toBe(false);
  });

  it('reports exited when the provider ends inside the observation window', async () => {
    await world.ok('sessions.interrupt', { sessionId: a });
    hostA.providerExits(130);
    await world.until(() => !world.ctx.live.has(a));
    const s = await session(a);
    expect(s.lifecycleState).toBe('stopped');
    expect(s.stopKind).toBe('interrupted_exit');
    expect(s.exitCode).toBe(130);
    expect(eventsNamed(world, 'session.interruptResult')).toEqual([
      { sessionId: a, outcome: 'exited' },
    ]);
  });
});

describe('sessions.requestStop / confirmStop', () => {
  it('binds the disclosure to the exact target', async () => {
    const disclosure = await world.ok<StopDisclosureView>('sessions.requestStop', { sessionId: a });
    expect(disclosure).toMatchObject({
      action: 'stop',
      sessionId: a,
      providerDisplayName: 'Codex CLI',
      workspaceDisplayPath: DIR_A,
    });
    expect(disclosure.graceMs).toBeGreaterThan(0);
  });

  it('CONFIRMATION_EXPIRED for unknown, expired, and reused tokens', async () => {
    expect(errorCode(await world.call('sessions.confirmStop', { stopToken: 'x'.repeat(24) }))).toBe(
      'CONFIRMATION_EXPIRED',
    );
    const expired = await world.ok<StopDisclosureView>('sessions.requestStop', { sessionId: a });
    world.clock.now += 61_000;
    expect(
      errorCode(await world.call('sessions.confirmStop', { stopToken: expired.stopToken })),
    ).toBe('CONFIRMATION_EXPIRED');
    hostA.cleanStop = 'silent';
    const fresh = await world.ok<StopDisclosureView>('sessions.requestStop', { sessionId: a });
    expect((await world.call('sessions.confirmStop', { stopToken: fresh.stopToken })).ok).toBe(
      true,
    );
    expect(
      errorCode(await world.call('sessions.confirmStop', { stopToken: fresh.stopToken })),
    ).toBe('CONFIRMATION_EXPIRED');
  });

  it('TARGET_CHANGED when the session moved on between request and confirm', async () => {
    const disclosure = await world.ok<StopDisclosureView>('sessions.requestStop', { sessionId: a });
    hostA.providerExits(0);
    await world.until(() => !world.ctx.live.has(a));
    expect(
      errorCode(await world.call('sessions.confirmStop', { stopToken: disclosure.stopToken })),
    ).toBe('TARGET_CHANGED');
  });

  it('clean stop: adapter writes go to the host, exit + empty scope → stopped/clean, host shut down', async () => {
    const disclosure = await world.ok<StopDisclosureView>('sessions.requestStop', { sessionId: a });
    const accepted = await world.ok<{ lifecycleState: string }>('sessions.confirmStop', {
      stopToken: disclosure.stopToken,
    });
    expect(accepted.lifecycleState).toBe('stopping');
    const cleanStop = hostA.received.find((m) => m.type === 'host.cleanStop');
    expect(cleanStop).toMatchObject({ action: { writes: ['/exit\r'] } });
    await world.until(() => !world.ctx.live.has(a));
    const s = await session(a);
    expect(s.lifecycleState).toBe('stopped');
    expect(s.stopKind).toBe('clean');
    expect(s.endedAt).not.toBeNull();
    expect(hostA.received.some((m) => m.type === 'host.shutdown')).toBe(true);
    expect(world.native.jobs.size).toBe(1); // only B's job remains
    expect(world.ctx.leases.holderOf(identity(1))).toBeNull();
    expect(eventsOf(a)).toEqual([
      ['launch_requested', 'starting', null],
      ['launched', 'running', null],
      ['stop_requested', 'stopping', 'USER_STOP'],
      ['state_changed', 'stopped', 'CLEAN_STOP'],
    ]);
    // B untouched
    expect((await session(b)).lifecycleState).toBe('running');
    expect(eventsOf(b)).toHaveLength(2);
  });

  it('clean-stop timeout keeps the session contained and offers force stop', async () => {
    hostA.cleanStop = 'timeout';
    const disclosure = await world.ok<StopDisclosureView>('sessions.requestStop', { sessionId: a });
    await world.ok('sessions.confirmStop', { stopToken: disclosure.stopToken });
    await world.until(() => world.ctx.live.get(a)?.forceStopAvailable === true);
    const s = await session(a);
    expect(s.lifecycleState).toBe('stopping');
    expect(s.forceStopAvailable).toBe(true);
    const changed = eventsNamed(world, 'session.changed') as { reasonCode: string | null }[];
    expect(changed.some((e) => e.reasonCode === 'CLEAN_STOP_TIMEOUT')).toBe(true);
    expect(world.native.jobs.size).toBe(2);
  });
});

describe('sessions.requestForceStop / confirmForceStop', () => {
  it('FORCE_NOT_AVAILABLE for a terminal session', async () => {
    hostA.providerExits(0);
    await world.until(() => !world.ctx.live.has(a));
    expect(errorCode(await world.call('sessions.requestForceStop', { sessionId: a }))).toBe(
      'SESSION_NOT_FOUND',
    );
  });

  it('discloses the risk, target, and process count', async () => {
    const disclosure = await world.ok<ForceStopDisclosureView>('sessions.requestForceStop', {
      sessionId: a,
    });
    expect(disclosure).toMatchObject({
      action: 'force_stop',
      sessionId: a,
      providerDisplayName: 'Codex CLI',
      workspaceDisplayPath: DIR_A,
      risk: FORCE_STOP_RISK,
      processCount: 1, // the provider root; the host itself is not counted
    });
  });

  it('CONFIRMATION_EXPIRED / TARGET_CHANGED binding', async () => {
    expect(
      errorCode(await world.call('sessions.confirmForceStop', { forceToken: 'x'.repeat(24) })),
    ).toBe('CONFIRMATION_EXPIRED');
    const disclosure = await world.ok<ForceStopDisclosureView>('sessions.requestForceStop', {
      sessionId: a,
    });
    hostA.cleanStop = 'silent';
    const stop = await world.ok<StopDisclosureView>('sessions.requestStop', { sessionId: a });
    await world.ok('sessions.confirmStop', { stopToken: stop.stopToken }); // state changed to stopping
    expect(
      errorCode(
        await world.call('sessions.confirmForceStop', { forceToken: disclosure.forceToken }),
      ),
    ).toBe('TARGET_CHANGED');
  });

  it('terminates the job and records stopped/forced', async () => {
    const disclosure = await world.ok<ForceStopDisclosureView>('sessions.requestForceStop', {
      sessionId: a,
    });
    const accepted = await world.ok<{ lifecycleState: string }>('sessions.confirmForceStop', {
      forceToken: disclosure.forceToken,
    });
    expect(accepted.lifecycleState).toBe('stopped');
    expect(world.native.calls.some((c) => c.op === 'terminateJob')).toBe(true);
    const s = await session(a);
    expect(s.stopKind).toBe('forced');
    expect(eventsOf(a).slice(-2)).toEqual([
      ['force_stop_requested', 'running', 'USER_FORCE_STOP'],
      ['state_changed', 'stopped', 'USER_FORCE_STOP'],
    ]);
    expect(world.ctx.live.has(a)).toBe(false);
    expect((await session(b)).lifecycleState).toBe('running');
    expect(world.ctx.live.has(b)).toBe(true);
  });

  it('a scope that will not die becomes recovery_required, never stopped', async () => {
    world.native.stubbornJobs.add(world.ctx.live.get(a)!.jobToken);
    const disclosure = await world.ok<ForceStopDisclosureView>('sessions.requestForceStop', {
      sessionId: a,
    });
    const accepted = await world.ok<{ lifecycleState: string }>('sessions.confirmForceStop', {
      forceToken: disclosure.forceToken,
    });
    expect(accepted.lifecycleState).toBe('recovery_required');
    const s = await session(a);
    expect(s.lifecycleState).toBe('recovery_required');
    const record = world.ctx.storage!.repositories.recovery.findUnresolvedBySession(a)!;
    expect(record.classification).toBe('incomplete_stop');
    expect(record.reasonCode).toBe('FORCE_STOP_INCOMPLETE');
    expect(eventsNamed(world, 'recovery.changed')).toHaveLength(1);
  });
});

describe('application.requestClose', () => {
  it('is blocked while sessions are active and lists every one of them', async () => {
    const result = await world.ok<{ closing: boolean; activeSessions: SessionView[] }>(
      'application.requestClose',
    );
    expect(result.closing).toBe(false);
    expect(result.activeSessions.map((s) => s.id).sort()).toEqual([a, b].sort());
    expect(eventsNamed(world, 'application.closeBlocked')).toHaveLength(1);
    expect(world.ctx.quit).not.toHaveBeenCalled();
  });

  it('stopAllAndClose clean-stops everything and quits only when all ended', async () => {
    const result = await world.ok<{ closing: boolean }>('application.stopAllAndClose');
    expect(result.closing).toBe(true);
    expect(hostA.received.some((m) => m.type === 'host.cleanStop')).toBe(true);
    expect(hostB.received.some((m) => m.type === 'host.cleanStop')).toBe(true);
    await world.until(() => world.ctx.live.size === 0);
    expect(world.ctx.quit).toHaveBeenCalledTimes(1);
  });

  it('quits immediately with no active sessions', async () => {
    for (const id of [a, b]) {
      const stop = await world.ok<StopDisclosureView>('sessions.requestStop', { sessionId: id });
      await world.ok('sessions.confirmStop', { stopToken: stop.stopToken });
    }
    await world.until(() => world.ctx.live.size === 0);
    const result = await world.ok<{ closing: boolean }>('application.requestClose');
    expect(result.closing).toBe(true);
    expect(world.ctx.quit).toHaveBeenCalled();
  });
});
