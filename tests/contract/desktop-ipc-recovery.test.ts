/** T075 — startup reconciliation, recovery.resolve, and sessions.list recovery views. */

import type { LifecycleState, RecoveryRecordView, SessionView } from '@threadhelm/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { reconcileAtStartup } from '../../apps/desktop/src/main/recovery/reconcile.js';
import { createWorld, errorCode, identity, type FakeWorld } from './helpers/fake-context.js';

const DIR = 'C:\\projects\\alpha';
const UNFINISHED: LifecycleState[] = ['starting', 'running', 'interrupting', 'stopping'];

let world: FakeWorld;
let seeded: Record<string, string>; // state → session id

/** A previous run left these behind; nothing is live in this process. */
function seed(w: FakeWorld): Record<string, string> {
  const repos = w.ctx.storage!.repositories;
  const workspace = repos.workspaces.insertApproval({
    selectedPath: DIR,
    displayPath: DIR,
    canonicalPath: `\\\\?\\${DIR}`,
    volumeSerial: identity(1).volumeSerial,
    fileId: identity(1).fileId,
    approvedAt: '2026-08-28T10:00:00.000Z',
  });
  const snapshot = repos.readiness.insert({
    providerId: 'codex-cli',
    resolvedExecutable: 'C:\\tools\\agent.exe',
    version: '1.0.0',
    availability: 'available',
    authentication: 'authenticated',
    probedAt: '2026-08-28T10:00:00.000Z',
    reasonCode: null,
    safeSummary: 'ok',
  });
  const ids: Record<string, string> = {};
  for (const [index, state] of [...UNFINISHED, 'stopped' as const].entries()) {
    const record = repos.sessions.insertStarting({
      workspaceId: workspace.id,
      definitionId: 'codex-cli',
      readinessSnapshotId: snapshot.id,
      columns: 80,
      rows: 24,
      createdAt: `2026-08-28T10:0${index}:00.000Z`,
    });
    repos.sessions.update(
      record.id,
      { lifecycleState: state, hostPid: 4242, rootPid: 4343 },
      record.createdAt,
    );
    ids[state] = record.id;
  }
  return ids;
}

beforeEach(() => {
  world = createWorld();
  world.addDir(DIR, identity(1));
  seeded = seed(world);
});

describe('startup reconciliation', () => {
  it('marks every unfinished session recovery_required with a record and an event, relaunching nothing', async () => {
    const { reconciled } = reconcileAtStartup(world.ctx);
    expect(reconciled).toBe(UNFINISHED.length);

    const list = await world.ok<{ sessions: SessionView[]; recoveryRecords: RecoveryRecordView[] }>(
      'sessions.list',
    );
    const expectedClassification = {
      starting: 'interrupted_start',
      running: 'unexpected_shutdown',
      interrupting: 'unexpected_shutdown',
      stopping: 'incomplete_stop',
    } as const;
    for (const state of UNFINISHED) {
      const id = seeded[state]!;
      const session = list.sessions.find((s) => s.id === id)!;
      expect(session.lifecycleState).toBe('recovery_required');
      expect(session.endedAt).not.toBeNull();
      const record = list.recoveryRecords.find((r) => r.sessionId === id)!;
      expect(record.classification).toBe(
        expectedClassification[state as keyof typeof expectedClassification],
      );
      expect(record.lastKnownState).toBe(state);
      expect(record.resolvedAt).toBeNull();
      const events = world.ctx.storage!.repositories.events.listBySession(id);
      expect(events.at(-1)).toMatchObject({
        kind: 'reconciled',
        fromState: state,
        toState: 'recovery_required',
        reasonCode: 'STARTUP_RECONCILIATION',
      });
    }
    // a cleanly stopped session is left alone
    expect(list.sessions.find((s) => s.id === seeded.stopped)!.lifecycleState).toBe('stopped');
    expect(list.recoveryRecords).toHaveLength(UNFINISHED.length);

    // no PID reattachment, relaunch, or replay
    expect(world.hosts).toHaveLength(0);
    expect(world.native.jobs.size).toBe(0);
    expect(world.ctx.live.size).toBe(0);
  });

  it('is idempotent across restarts', () => {
    reconcileAtStartup(world.ctx);
    const { reconciled } = reconcileAtStartup(world.ctx);
    expect(reconciled).toBe(0);
    expect(world.ctx.storage!.repositories.recovery.listUnresolved()).toHaveLength(
      UNFINISHED.length,
    );
  });
});

describe('recovery.resolve', () => {
  beforeEach(() => reconcileAtStartup(world.ctx));

  const recordFor = (state: string) =>
    world.ctx.storage!.repositories.recovery.findUnresolvedBySession(seeded[state]!)!;

  it('RECORD_NOT_FOUND for unknown records', async () => {
    expect(
      errorCode(
        await world.call('recovery.resolve', {
          recordId: '11111111-1111-4111-8111-111111111111',
          resolution: 'dismissed',
        }),
      ),
    ).toBe('RECORD_NOT_FOUND');
  });

  it('dismissing ends the session as stopped with a recovery_resolved event, once', async () => {
    world.events.length = 0;
    const record = recordFor('running');
    const resolved = await world.ok<RecoveryRecordView>('recovery.resolve', {
      recordId: record.id,
      resolution: 'dismissed',
    });
    expect(resolved.resolution).toBe('dismissed');
    expect(resolved.resolvedAt).not.toBeNull();
    const list = await world.ok<{ sessions: SessionView[]; recoveryRecords: RecoveryRecordView[] }>(
      'sessions.list',
    );
    expect(list.sessions.find((s) => s.id === seeded.running)!.lifecycleState).toBe('stopped');
    expect(list.recoveryRecords.some((r) => r.id === record.id)).toBe(false);
    expect(
      world.ctx.storage!.repositories.events.listBySession(seeded.running!).at(-1),
    ).toMatchObject({
      kind: 'recovery_resolved',
      toState: 'stopped',
      reasonCode: 'RECOVERY_DISMISSED',
    });
    const names = world.events.map((e) => e.name);
    expect(names).toContain('recovery.changed');
    expect(names).toContain('session.changed');

    expect(
      errorCode(
        await world.call('recovery.resolve', { recordId: record.id, resolution: 'dismissed' }),
      ),
    ).toBe('INVALID_RESOLUTION');
  });

  it('superseded_by_new_session resolves likewise', async () => {
    const record = recordFor('stopping');
    const resolved = await world.ok<RecoveryRecordView>('recovery.resolve', {
      recordId: record.id,
      resolution: 'superseded_by_new_session',
    });
    expect(resolved.resolution).toBe('superseded_by_new_session');
    expect(
      world.ctx.storage!.repositories.sessions.findById(seeded.stopping!)!.lifecycleState,
    ).toBe('stopped');
    expect(
      world.ctx.storage!.repositories.events.listBySession(seeded.stopping!).at(-1)!.reasonCode,
    ).toBe('RECOVERY_SUPERSEDED');
  });

  it('rejects unknown resolutions at the contract', async () => {
    expect(
      errorCode(
        await world.call('recovery.resolve', {
          recordId: recordFor('starting').id,
          resolution: 'forgot',
        }),
      ),
    ).toBe('INVALID_REQUEST');
  });

  it('STORAGE_DEGRADED blocks durable resolution', async () => {
    const degraded = createWorld({ degraded: true });
    degraded.addDir(DIR, identity(1));
    const ids = seed(degraded);
    reconcileAtStartup(degraded.ctx);
    const record = degraded.ctx.storage!.repositories.recovery.findUnresolvedBySession(
      ids.running!,
    )!;
    expect(
      errorCode(
        await degraded.call('recovery.resolve', { recordId: record.id, resolution: 'dismissed' }),
      ),
    ).toBe('STORAGE_DEGRADED');
    expect(degraded.ctx.storage!.repositories.recovery.findById(record.id)!.resolvedAt).toBeNull();
  });
});
