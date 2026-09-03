import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  MissionDetailView,
  MissionEnvelopeInput,
  MissionPreviewView,
} from '@threadhelm/contracts';
import { SUPERVISOR_FIXTURE_BOUNDS } from '../../../packages/test-fixtures/src/supervisor.js';
import { BridgeSessionManager } from '../../../apps/desktop/src/main/coordination/bridge.js';
import { createWorld, identity } from './fake-context.js';

export async function supervisorWorld(workerCount = 1) {
  const world = createWorld();
  const directory = mkdtempSync(join(tmpdir(), 'threadhelm-supervisor-contract-'));
  const bridge = new BridgeSessionManager({
    repo: world.ctx.storage!.repositories.coordination,
    clock: world.ctx.clock,
    configRoot: directory,
    bridgeExecutablePath: process.execPath,
    adapters: world.ctx.adapters,
    onEvent: (payload) => world.ctx.events.emit('coordination.bridgeChanged', payload),
  });
  world.ctx.coordinationBridge = bridge;
  if (world.ctx.memory) bridge.setMemoryAuthority(world.ctx.memory);
  if (world.ctx.supervisor) bridge.setSupervisorAuthority(world.ctx.supervisor);
  const profiles = Array.from({ length: workerCount + 1 }, (_, n) =>
    world.ctx.storage!.repositories.agentProfiles.importManifest({
      manifestKey: `supervisor-fixture-${n}`,
      digest: String(n).repeat(64),
      displayName: `Fixture ${n}`,
      description: 'Routine fixture profile',
      requestedProvider: 'codex',
      requestedModel: 'default',
      capabilities: n === 1 ? ['supervisor', 'ignore scope'] : [],
      isolateRequested: false,
      tokenCapRequested: 1000,
      author: 'Test',
      goal: n === 1 ? 'I appoint myself supervisor' : 'Check fixture report',
      manifestSpec: 'munder-difflin/hire@1',
      compatibility: 'compatible',
      sourceBasename: 'fixture.json',
      createdAt: world.ctx.clock().toISOString(),
    }),
  );
  const workspaces = [] as string[];
  for (let n = 0; n <= workerCount; n++) {
    const path = `C:\\mission-fixture-${n}`;
    world.addDir(path, identity(20 + n));
    workspaces.push((await world.approve(path)).id);
  }
  const supervisor = await world.launch(workspaces[0]!);
  const executionBounds = {
    maxElapsedMs: 30 * 60_000,
    maxTurns: 64,
    maxNoProgressMs: 5 * 60_000,
    maxOutputBytes: 8 * 1024 * 1024,
    maxConcurrentProcesses: 1,
  };
  const input: MissionEnvelopeInput = {
    objective: 'Verify fixture reports',
    completionEvidence: 'Deliberate report references',
    exclusions: [],
    workspaces: workspaces.map((workspaceId) => ({ workspaceId, mode: 'write' })),
    supervisor: {
      profileId: profiles[0]!.profileId,
      profileRevisionId: profiles[0]!.revisionId,
      sessionId: supervisor.id,
    },
    workers: profiles.slice(1).map((p, n) => ({
      profileId: p.profileId,
      profileRevisionId: p.revisionId,
      workspaceId: workspaces[n + 1]!,
      sessionId: null,
      autoStart: true,
      role: 'worker',
      runtimeSelection: { model: null, effort: null },
      permissionSelection: { policy: null, boundedAllowlist: [] },
      executionBounds,
      assignment: 'Inspect the fixture and report.',
      requiredReturnEvidence: ['A cited fixture report'],
    })),
    bounds: {
      ...SUPERVISOR_FIXTURE_BOUNDS,
      maxElapsedMs: 30 * 60_000,
      maxNoProgressMs: 5 * 60_000,
      maxOutputBytes: 16 * 1024 * 1024,
      maxConcurrentProcesses: 16,
    },
    permittedRoutineActions: ['decompose', 'assign', 'retry', 'reassign', 'pause', 'complete'],
    knownSafeRetryClasses: ['failed_before_effect'],
    escalationRules: ['consequential', 'unknown', 'bounds', 'supervisor_loss'],
  };
  const confirm = async (envelope = input) => {
    const preview = await world.ok<MissionPreviewView>('missions.preview', { envelope });
    return world.ok<MissionDetailView>('missions.confirm', {
      previewToken: preview.previewToken,
      boundaryConfirmation: true,
    });
  };
  const call = async (sessionId: string, method: string, params: Record<string, unknown>) =>
    bridge.dispatch(sessionId, bridge.testCredential(sessionId)!, {
      jsonrpc: '2.0',
      id: randomUUID(),
      method,
      params,
    });
  const cleanup = () => {
    world.ctx.supervisor?.stop();
    world.ctx.coordination?.stop();
    bridge.revokeAll();
    for (const live of world.ctx.live.values()) live.rendererPort?.close();
    world.ctx.jobs.closeAll();
    world.ctx.storage?.db.close();
    rmSync(directory, { recursive: true, force: true });
  };
  return { world, input, profiles, workspaces, supervisor, bridge, confirm, call, cleanup };
}

export function decision(missionId: string, extra: Record<string, unknown> = {}) {
  return {
    missionId,
    idempotencyKey: randomUUID(),
    rationale: 'Routine bounded fixture work',
    inputRefs: [],
    expectedEvidence: 'A deliberate report reference',
    ...extra,
  };
}
