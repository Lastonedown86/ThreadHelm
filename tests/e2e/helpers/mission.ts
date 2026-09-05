import { expect } from '@playwright/test';
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
    exclusions: [],
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
      assignment: 'Inspect the fixture and report.',
      requiredReturnEvidence: ['A cited fixture report'],
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

/** Drives the guided composer end to end; returns the mission detail dialog. */
export async function composeMissionViaUi(app: LaunchedApp, dirs: string[]) {
  const page = app.page;
  const leader = (await missionProfile(app, 'Mission coordinator')).profileId;
  const worker = (await missionProfile(app, 'Mission worker')).profileId;
  const supervisorId = (await missionSession(app, dirs[0]!)).id;
  const workerId = (await missionSession(app, dirs[1]!)).id;
  await page.reload();
  await page.getByRole('button', { name: 'New mission…', exact: true }).click();
  await page.getByLabel('Finish line', { exact: true }).fill('Review a bounded local change.');
  await page
    .getByLabel('Proof of completion', { exact: true })
    .fill('A cited report and focused tests.');
  await page.getByRole('button', { name: 'Continue to crew', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Supervisor profile', exact: true })
    .selectOption(leader);
  await page
    .getByRole('combobox', { name: 'Supervisor session', exact: true })
    .selectOption(supervisorId);
  await page.getByRole('button', { name: 'Add worker', exact: true }).click();
  await page.getByRole('combobox', { name: 'Worker 1 profile', exact: true }).selectOption(worker);
  await page
    .getByRole('combobox', { name: 'Worker 1 session', exact: true })
    .selectOption(workerId);
  await page.getByLabel('What worker 1 contributes', { exact: true }).fill('Inspect the change.');
  await page.getByLabel('What worker 1 must bring back', { exact: true }).fill('A cited report');
  await page
    .getByRole('button', { name: 'Add to what worker 1 must bring back', exact: true })
    .click();
  await page.getByRole('button', { name: 'Continue to access and limits', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
  await expect(page.locator('.composer-state.ready')).toBeVisible();
  await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
  await page.getByRole('button', { name: 'Start mission', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Mission detail', exact: true });
  await expect(detail).toBeVisible();
  return { detail, supervisorId };
}
