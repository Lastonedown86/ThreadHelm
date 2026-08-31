import type { MissionEnvelopeInput, OperationResponse } from '@threadhelm/contracts';
import type { LaunchedApp } from './app.js';

export async function missionProfile(
  app: LaunchedApp,
  name: string,
  runtime: { provider: 'codex' | 'claude'; model: string } = {
    provider: 'codex',
    model: 'gpt-5.6-terra',
  },
) {
  const sources = await app.call<OperationResponse<'agentTemplates.list'>>(
    'agentTemplates.list',
    {},
  );
  let draft = await app.call<OperationResponse<'agentWizard.createDraft'>>(
    'agentWizard.createDraft',
    {
      source: { kind: 'template', templateRevisionId: sources.templates[0]!.currentRevisionId },
    },
  );
  draft = await app.call('agentWizard.updateStep', {
    draftId: draft.draftId,
    version: draft.version,
    step: 'identity',
    fields: { name, description: 'A generic fixture specialist', author: 'Test owner' },
  });
  draft = await app.call('agentWizard.updateStep', {
    draftId: draft.draftId,
    version: draft.version,
    step: 'runtime',
    fields: { ...runtime, isolate: false, tokenCap: 250_000 },
  });
  const preview = await app.call<OperationResponse<'agentWizard.previewCompletion'>>(
    'agentWizard.previewCompletion',
    {
      draftId: draft.draftId,
      version: draft.version,
      action: 'profile',
    },
  );
  return app.call<OperationResponse<'agentWizard.confirmProfile'>>('agentWizard.confirmProfile', {
    completionToken: preview.completionToken,
    profileConfirmation: true,
  });
}

export async function missionSession(app: LaunchedApp, dir: string) {
  await app.setPickerPath(dir);
  const picked = await app.call<OperationResponse<'workspaces.choose'>>('workspaces.choose');
  const workspace = await app.call<OperationResponse<'workspaces.approve'>>('workspaces.approve', {
    candidateToken: picked.candidateToken,
  });
  const preview = await app.call<OperationResponse<'sessions.previewLaunch'>>(
    'sessions.previewLaunch',
    {
      workspaceId: workspace.id,
      providerId: 'codex-cli',
      terminal: { columns: 100, rows: 30 },
      runtimeSelection: { model: 'gpt-5.6-terra', effort: null },
      executionBounds: {
        maxElapsedMs: 1_800_000,
        maxTurns: 64,
        maxNoProgressMs: 300_000,
        maxOutputBytes: 8_388_608,
        maxConcurrentProcesses: 8,
      },
    },
  );
  return app.call<OperationResponse<'sessions.launch'>>('sessions.launch', {
    previewToken: preview.previewToken,
    boundaryConfirmation: true,
  });
}

/** Use genuine approved profiles, sessions and launch snapshots; never inject mission rows. */
export async function prepareFixtureMission(
  app: LaunchedApp,
  directories: string[],
): Promise<MissionEnvelopeInput> {
  const profiles: OperationResponse<'agentWizard.confirmProfile'>[] = [];
  const sessions: OperationResponse<'sessions.launch'>[] = [];
  for (const [index, directory] of directories.entries()) {
    profiles.push(await missionProfile(app, `Mission specialist ${index}`));
    sessions.push(await missionSession(app, directory));
  }
  const eligible = await app.call<OperationResponse<'missions.eligibleSessions'>>(
    'missions.eligibleSessions',
  );
  const snapshots = sessions.map((session) => {
    const snapshot = eligible.find((item) => item.sessionId === session.id);
    if (!snapshot) throw new Error('Newly launched fixture lacks an eligible snapshot');
    return snapshot;
  });
  return {
    objective: 'Review a bounded fixture mission',
    completionEvidence: 'A cited fixture report',
    workspaces: snapshots.map((snapshot) => ({ workspaceId: snapshot.workspaceId, mode: 'write' })),
    supervisor: {
      profileId: profiles[0]!.profileId,
      profileRevisionId: profiles[0]!.currentRevisionId,
      sessionId: sessions[0]!.id,
    },
    workers: snapshots.slice(1).map((snapshot, index) => ({
      profileId: profiles[index + 1]!.profileId,
      profileRevisionId: profiles[index + 1]!.currentRevisionId,
      workspaceId: snapshot.workspaceId,
      sessionId: snapshot.sessionId,
      role: 'worker',
      autoStart: false,
      runtimeSelection: snapshot.runtimeSelection,
      permissionSelection: snapshot.permissionSelection,
      executionBounds: snapshot.executionBounds,
    })),
    bounds: {
      maxWorkers: 4,
      maxWorkItems: 64,
      maxDepth: 8,
      maxAttempts: 3,
      maxElapsedMs: 1_800_000,
      maxTurns: 64,
      maxNoProgressMs: 300_000,
      maxOutputBytes: 8_388_608,
      maxConcurrentProcesses: 16,
      maxTokenBudget: 250_000,
    },
    permittedRoutineActions: ['decompose', 'assign', 'retry', 'reassign', 'pause', 'complete'],
    knownSafeRetryClasses: ['failed_before_effect'],
    escalationRules: ['consequential', 'unknown', 'bounds', 'supervisor_loss'],
  };
}
