// tests/e2e/parity-screenshots.spec.ts
// Opt-in: PARITY_SHOTS=1 pnpm exec playwright test tests/e2e/parity-screenshots.spec.ts
// Writes artifacts/parity/*.png for design review. Skipped in the normal suite.
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import type {
  MissionDetailView,
  MissionEnvelopeInput,
  MissionPreviewView,
} from '@threadhelm/contracts';
import { launchApp, type LaunchedApp } from './helpers/app.js';
import { missionProfile, missionSession, prepareFixtureMission } from './helpers/mission.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

const OUT = 'artifacts/parity';
test.skip(!process.env['PARITY_SHOTS'], 'set PARITY_SHOTS=1 to capture');

async function confirmMission(app: LaunchedApp, envelope: MissionEnvelopeInput, objective: string) {
  const preview = await app.call<MissionPreviewView>('missions.preview', {
    envelope: { ...envelope, objective },
  });
  return app.call<MissionDetailView>('missions.confirm', {
    previewToken: preview.previewToken,
    boundaryConfirmation: true,
  });
}
async function assignWork(
  app: LaunchedApp,
  mission: MissionDetailView,
  disposition: 'completion' | 'unknown' | 'authority_required' | null,
) {
  const supervisorId = mission.supervisorSessionId!;
  const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
  const workItemId = randomUUID();
  const decision = {
    missionId: mission.id,
    rationale: 'Parity capture',
    inputRefs: [],
    expectedEvidence: 'A retained report',
  };
  await app.bridgeRequest(supervisorId, 'threadhelm_work_decompose', {
    ...decision,
    idempotencyKey: randomUUID(),
    items: [
      {
        id: workItemId,
        parentWorkItemId: null,
        workspaceId: binding.workspaceId,
        title: 'Verify browser evidence',
        specification: 'Produce one bounded result.',
        acceptanceCriteria: 'Reference the report.',
        dependencies: [],
        authorityClass: 'routine',
      },
    ],
  });
  await app.bridgeRequest(supervisorId, 'threadhelm_work_assign', {
    ...decision,
    idempotencyKey: randomUUID(),
    workItemId,
    bindingId: binding.bindingId,
  });
  if (!disposition) return;
  const detail = await app.call<MissionDetailView>('missions.detail', { missionId: mission.id });
  const attempt = detail.attempts[0]!;
  await app.bridgeRequest(attempt.sessionId!, 'threadhelm_work_result', {
    missionId: mission.id,
    workItemId,
    attemptId: attempt.id,
    idempotencyKey: randomUUID(),
    disposition,
    explanation: disposition === 'completion' ? 'Done with a report.' : 'The worker stopped here.',
    evidenceRefs: disposition === 'completion' ? [{ kind: 'artifact', id: 'report.md' }] : [],
  });
  if (disposition === 'completion')
    await app.bridgeRequest(supervisorId, 'threadhelm_mission_complete', {
      ...decision,
      idempotencyKey: randomUUID(),
      evidenceRefs: [{ kind: 'work_item', id: workItemId }],
    });
}

test('capture parity screenshots', async () => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const shot = (app: LaunchedApp, name: string) =>
    app.page.screenshot({ path: `${OUT}/${name}.png` });
  const nav = (app: LaunchedApp, label: string) =>
    app.page.getByRole('button', { name: label, exact: true }).click();

  let app = await launchApp();
  await app.page.setViewportSize({ width: 1400, height: 860 });
  await expect(app.page.locator('.status-bar')).toContainText('ThreadHelm v');
  await shot(app, '01-missions-empty');
  for (const d of ['Sessions', 'Agents', 'Templates', 'Memory', 'Attention', 'Settings']) {
    await nav(app, d);
    await shot(app, `02-empty-${d.toLowerCase()}`);
  }
  await app.close();

  app = await launchWithFixtures({ 'codex-cli': 'echo' });
  await app.page.setViewportSize({ width: 1400, height: 860 });
  const directories: string[] = [];
  const envelope = async (tag: string) => {
    const pair = [tempWorkspace(`${tag}-leader`), tempWorkspace(`${tag}-worker`)];
    directories.push(...pair);
    return prepareFixtureMission(app, pair);
  };
  try {
    const completed = await confirmMission(
      app,
      await envelope('done'),
      'Ship cited release notes for v0.3',
    );
    await assignWork(app, completed, 'completion');
    const uncertain = await confirmMission(
      app,
      await envelope('unk'),
      'Migrate config loader to schema v2',
    );
    await assignWork(app, uncertain, 'unknown');
    const waiting = await confirmMission(
      app,
      await envelope('wait'),
      'Audit auth middleware token expiry',
    );
    await assignWork(app, waiting, 'authority_required');
    const running = await confirmMission(
      app,
      await envelope('run'),
      'Refactor session stream backpressure',
    );
    await assignWork(app, running, null);
    const list = app.page.getByRole('listbox', { name: 'Missions', exact: true });
    const select = async (m: MissionDetailView) => {
      await list.getByRole('option', { name: new RegExp(m.id.slice(0, 8), 'i') }).click();
      await app.page.waitForTimeout(300);
    };
    for (const [name, m] of [
      ['10-mission-running', running],
      ['11-mission-waiting', waiting],
      ['12-mission-uncertain', uncertain],
      ['13-mission-completed', completed],
    ] as const) {
      await select(m);
      await shot(app, name);
    }
    await select(running);
    for (const d of ['Sessions', 'Agents', 'Memory', 'Settings', 'Attention']) {
      await nav(app, d);
      await shot(app, `20-${d.toLowerCase()}`);
    }
    await nav(app, 'Missions');
    await select(waiting);
    await app.page.setViewportSize({ width: 960, height: 800 });
    await shot(app, '30-medium-waiting');
    await app.page.setViewportSize({ width: 680, height: 800 });
    await shot(app, '31-narrow-waiting');
    await app.page.setViewportSize({ width: 1400, height: 860 });
    const userData = app.userData;
    await app.crashCoordinator();
    app = await launchWithFixtures({ 'codex-cli': 'echo' }, userData);
    await app.page.setViewportSize({ width: 1400, height: 860 });
    await app.page
      .getByRole('listbox', { name: 'Missions', exact: true })
      .getByRole('option')
      .filter({ hasText: 'recovery required' })
      .first()
      .click();
    await shot(app, '17-mission-recovery');
    await nav(app, 'Attention');
    await shot(app, '25-attention-populated');
  } finally {
    await teardown(app, ...directories);
  }

  const composerApp = await launchWithFixtures({ 'codex-cli': 'echo' });
  await composerApp.page.setViewportSize({ width: 1400, height: 860 });
  const composerDirs = [tempWorkspace('composer-leader'), tempWorkspace('composer-worker')];
  try {
    const page = composerApp.page;
    const leader = await missionProfile(composerApp, 'Parity coordinator');
    const worker = await missionProfile(composerApp, 'Parity worker');
    const supervisorSession = await missionSession(composerApp, composerDirs[0]!);
    const workerSession = await missionSession(composerApp, composerDirs[1]!);
    await page.reload();
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await shot(composerApp, '10-composer-outcome');
    await page.getByLabel('Finish line', { exact: true }).fill('Review a bounded local change.');
    await page
      .getByLabel('Proof of completion', { exact: true })
      .fill('A cited report and focused tests.');
    await page.getByRole('button', { name: 'Continue to crew', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Supervisor profile', exact: true })
      .selectOption(leader.profileId);
    await page
      .getByRole('combobox', { name: 'Supervisor session', exact: true })
      .selectOption(supervisorSession.id);
    await page.getByRole('button', { name: 'Add worker', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Worker 1 profile', exact: true })
      .selectOption(worker.profileId);
    await page
      .getByRole('combobox', { name: 'Worker 1 session', exact: true })
      .selectOption(workerSession.id);
    await page.getByLabel('What worker 1 contributes', { exact: true }).fill('Inspect the change.');
    await page.getByLabel('What worker 1 must bring back', { exact: true }).fill('A cited report');
    await page
      .getByRole('button', { name: 'Add to what worker 1 must bring back', exact: true })
      .click();
    await shot(composerApp, '11-composer-crew');
    await page.getByRole('button', { name: 'Continue to access and limits', exact: true }).click();
    await shot(composerApp, '12-composer-access');
    await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
    await expect(page.locator('.composer-state.ready')).toBeVisible();
    await shot(composerApp, '13-composer-review-ready');
  } finally {
    await teardown(composerApp, ...composerDirs);
  }
});
