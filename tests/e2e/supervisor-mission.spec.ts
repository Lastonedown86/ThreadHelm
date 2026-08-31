import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { approveFolder, launchApp, type LaunchedApp } from './helpers/app.js';
import type {
  MissionDetailView,
  MissionPreviewView,
  MissionSummaryView,
} from '@threadhelm/contracts';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';
import { missionProfile, missionSession } from './helpers/mission.js';

async function createMission(app: LaunchedApp, dirs: string[]) {
  const leader = (await missionProfile(app, 'Mission coordinator')).profileId;
  const worker = (await missionProfile(app, 'Mission worker')).profileId;
  const supervisorId = (await missionSession(app, dirs[0]!)).id;
  const workerId = (await missionSession(app, dirs[1]!)).id;
  await app.page.reload();
  const button = app.page.getByRole('button', { name: 'New mission…', exact: true });
  await button.focus();
  await app.page.keyboard.press('Enter');
  const dialog = app.page.getByRole('dialog', { name: 'Create mission', exact: true });
  await dialog.getByLabel('Objective', { exact: true }).fill('Review a bounded local change.');
  await dialog
    .getByLabel('Completion evidence', { exact: true })
    .fill('A cited report and focused tests.');
  await dialog
    .getByRole('combobox', { name: 'Supervisor profile', exact: true })
    .selectOption(leader);
  await dialog
    .getByRole('combobox', { name: 'Supervisor session', exact: true })
    .selectOption(supervisorId);
  await dialog.getByRole('button', { name: 'Add worker', exact: true }).click();
  await dialog
    .getByRole('combobox', { name: 'Worker 1 profile', exact: true })
    .selectOption(worker);
  await dialog
    .getByRole('combobox', { name: 'Worker 1 session', exact: true })
    .selectOption(workerId);
  await dialog.getByRole('button', { name: 'Review mission', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Review mission authority' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Review mission authority' })).toBeFocused();
  await expect(dialog).toContainText('No substitution');
  await expect(dialog.getByRole('button', { name: 'Start mission', exact: true })).toBeDisabled();
  const checkbox = dialog.getByRole('checkbox', {
    name: 'I confirm this exact mission and folder-access boundary',
  });
  // Chromium also tabs through scrollable exact-binding disclosures.
  for (let index = 0; index < 8; index++) {
    await app.page.keyboard.press('Tab');
    if (await checkbox.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(checkbox).toBeFocused();
  await app.page.keyboard.press('Space');
  const start = dialog.getByRole('button', { name: 'Start mission', exact: true });
  await start.focus();
  await app.page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  const detail = app.page.getByRole('dialog', { name: 'Mission detail', exact: true });
  await expect(detail).toBeVisible();
  return { detail, supervisorId };
}

test('mission creation is keyboard accessible and discloses why an empty roster cannot start', async () => {
  const app = await launchApp();
  try {
    const button = app.page.getByRole('button', { name: 'New mission…', exact: true });
    await expect(button).toBeVisible();
    await button.focus();
    await app.page.keyboard.press('Enter');
    const dialog = app.page.getByRole('dialog', { name: 'Create mission' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Objective', exact: true })).toBeFocused();
    await expect(dialog).toContainText('reviewed profile');
    await expect(
      dialog.getByRole('button', { name: 'Review mission', exact: true }),
    ).toBeDisabled();
    await app.page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  } finally {
    await teardown(app);
  }
});

test('exact mission review supports pause, explicit resume, cancellation and content deletion', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('mission-leader'), tempWorkspace('mission-worker')];
  try {
    const { detail, supervisorId } = await createMission(app, dirs);
    await expect(detail.getByRole('status')).toContainText('running');
    await detail.getByRole('button', { name: 'Pause mission', exact: true }).click();
    await expect(detail.getByRole('status')).toContainText('paused');
    await detail
      .getByRole('combobox', { name: 'Resume with supervisor', exact: true })
      .selectOption(supervisorId);
    await detail.getByRole('button', { name: 'Resume mission', exact: true }).click();
    await expect(detail.getByRole('status')).toContainText('running');
    await detail.getByRole('button', { name: 'Cancel mission…', exact: true }).click();
    await detail
      .getByRole('checkbox', { name: 'I confirm this exact mission cancellation' })
      .check();
    await detail.getByRole('button', { name: 'Confirm mission cancellation', exact: true }).click();
    await expect(detail.getByRole('status')).toContainText('cancelled');
    await detail.getByRole('button', { name: 'Delete mission content…', exact: true }).click();
    await detail.getByRole('checkbox', { name: 'I confirm this exact content deletion' }).check();
    await detail.getByRole('button', { name: 'Confirm content deletion', exact: true }).click();
    await expect(detail).toContainText('Mission content was deleted');
    await expect(detail).not.toContainText('Review a bounded local change.');
  } finally {
    await teardown(app, ...dirs);
  }
});

test('mission crash recovery restores an honest hold and launches no sessions', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('recovery-leader'), tempWorkspace('recovery-worker')];
  try {
    await createMission(app, dirs);
    const userData = app.userData;
    await app.crashCoordinator();
    app = await launchWithFixtures({ 'codex-cli': 'echo' }, userData);
    await app.page
      .getByRole('list', { name: 'Missions', exact: true })
      .getByRole('button')
      .first()
      .click();
    const detail = app.page.getByRole('dialog', { name: 'Mission detail' });
    await expect(detail.getByRole('status')).toContainText('recovery required');
    await expect(detail).toContainText('Nothing was restarted or replayed');
    expect(await app.liveSessions()).toHaveLength(0);
    await expect(
      detail.getByRole('button', { name: 'Resume mission', exact: true }),
    ).toBeDisabled();
  } finally {
    await teardown(app, ...dirs);
  }
});

test('offline worker review discloses exact typed tool patterns and restores form focus', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('allowlist-leader'), tempWorkspace('allowlist-worker')];
  try {
    const leader = await missionProfile(app, 'Allowlist coordinator');
    const workerProfile = await missionProfile(app, 'Allowlist worker');
    const session = await missionSession(app, dirs[0]!);
    const workspace = await approveFolder(app, dirs[1]!);
    await app.page.reload();
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    const dialog = app.page.getByRole('dialog', { name: 'Create mission', exact: true });
    await dialog.getByLabel('Objective', { exact: true }).fill('Inspect fixture files');
    await dialog.getByLabel('Completion evidence', { exact: true }).fill('Cited observations');
    await dialog
      .getByRole('combobox', { name: 'Supervisor profile', exact: true })
      .selectOption(leader.profileId);
    await dialog
      .getByRole('combobox', { name: 'Supervisor session', exact: true })
      .selectOption(session.id);
    await dialog.getByRole('button', { name: 'Add worker', exact: true }).click();
    await dialog
      .getByRole('combobox', { name: 'Worker 1 profile', exact: true })
      .selectOption(workerProfile.profileId);
    await dialog
      .getByRole('checkbox', {
        name: 'Authorize automatic startup of worker 1 within this mission',
        exact: true,
      })
      .check();
    await dialog
      .getByRole('combobox', { name: 'Worker 1 workspace', exact: true })
      .selectOption(workspace.id);
    await dialog
      .getByRole('combobox', { name: 'Worker 1 permission', exact: true })
      .selectOption('bounded_allowlist');
    const tools = dialog.getByLabel('Worker 1 allowed tools', { exact: true });
    await tools.pressSequentially('Read, Glob');
    await expect(tools).toHaveValue('Read, Glob');
    await dialog.getByRole('button', { name: 'Review mission', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Review mission authority' })).toBeFocused();
    const worker = dialog.getByRole('group').filter({ has: dialog.page().getByText(/worker ·/) });
    await expect(worker.locator('pre')).toContainText('"boundedAllowlist": [');
    await expect(worker.locator('pre')).toContainText('"Read"');
    await expect(worker.locator('pre')).toContainText('"Glob"');
    await dialog.getByRole('button', { name: 'Back to mission', exact: true }).click();
    await expect(dialog.getByRole('textbox', { name: 'Objective', exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: 'Add worker', exact: true }).click();
    await dialog
      .getByRole('combobox', { name: 'Worker 2 permission', exact: true })
      .selectOption('bounded_allowlist');
    await dialog.getByLabel('Worker 2 allowed tools', { exact: true }).pressSequentially('Write');
    await dialog.getByRole('button', { name: 'Remove worker 1', exact: true }).click();
    await expect(dialog.getByLabel('Worker 1 allowed tools', { exact: true })).toHaveValue('Write');
    expect(await app.liveSessions()).toHaveLength(1);
  } finally {
    await teardown(app, ...dirs);
  }
});

test('revision editor cannot submit stale fields against a refreshed mission version', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('revision-leader'), tempWorkspace('revision-worker')];
  try {
    const { detail } = await createMission(app, dirs);
    await detail.getByRole('button', { name: 'Pause mission', exact: true }).click();
    await expect(detail.getByRole('status')).toContainText('paused');
    const [summary] = await app.call<MissionSummaryView[]>('missions.list', {});
    const original = await app.call<MissionDetailView>('missions.detail', {
      missionId: summary!.id,
    });
    await detail.getByRole('button', { name: 'Revise envelope…', exact: true }).click();
    const editor = app.page.getByRole('dialog', { name: 'Revise mission envelope', exact: true });
    await editor
      .getByRole('textbox', { name: 'Objective', exact: true })
      .fill('Stale draft objective');
    const newer = await app.call<MissionPreviewView>('missions.previewRevision', {
      missionId: original.id,
      expectedVersion: original.version,
      envelope: { ...original.input!, objective: 'Newer reviewed objective' },
    });
    await app.call('missions.confirmRevision', {
      previewToken: newer.previewToken,
      boundaryConfirmation: true,
    });
    await editor.getByRole('button', { name: 'Review mission', exact: true }).click();
    await expect(editor.getByRole('alert')).toBeVisible();
    await expect(editor.getByRole('heading', { name: 'Review mission authority' })).toHaveCount(0);
    expect(
      (await app.call<MissionDetailView>('missions.detail', { missionId: original.id })).envelope!
        .objective,
    ).toBe('Newer reviewed objective');
  } finally {
    await teardown(app, ...dirs);
  }
});

for (const resolution of ['ui', 'refresh'] as const) {
  test(`cancelled unknown work has exact inspection and no replay (${resolution})`, async () => {
    const app = await launchWithFixtures({ 'codex-cli': 'echo' });
    const dirs = [tempWorkspace('unknown-leader'), tempWorkspace('unknown-worker')];
    try {
      const { detail, supervisorId } = await createMission(app, dirs);
      const [summary] = await app.call<MissionSummaryView[]>('missions.list', {});
      let mission = await app.call<MissionDetailView>('missions.detail', {
        missionId: summary!.id,
      });
      const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
      const workId = randomUUID();
      const decision = {
        missionId: mission.id,
        rationale: 'Inspect a bounded fixture',
        inputRefs: [],
        expectedEvidence: 'A cited report',
      };
      await app.bridgeRequest(supervisorId, 'threadhelm_work_decompose', {
        ...decision,
        idempotencyKey: randomUUID(),
        items: [
          {
            id: workId,
            parentWorkItemId: null,
            workspaceId: binding.workspaceId,
            title: 'Fixture inspection',
            specification: 'Read fixture report',
            acceptanceCriteria: 'A cited report',
            dependencies: [],
            authorityClass: 'routine',
          },
        ],
      });
      await app.bridgeRequest(supervisorId, 'threadhelm_work_assign', {
        ...decision,
        idempotencyKey: randomUUID(),
        workItemId: workId,
        bindingId: binding.bindingId,
      });
      mission = await app.call<MissionDetailView>('missions.detail', { missionId: mission.id });
      const attempt = mission.attempts[0]!;
      await app.bridgeRequest(attempt.sessionId!, 'threadhelm_work_result', {
        missionId: mission.id,
        workItemId: workId,
        attemptId: attempt.id,
        idempotencyKey: randomUUID(),
        disposition: 'unknown',
        explanation: 'The fixture outcome is uncertain',
        evidenceRefs: [],
      });
      await detail.getByRole('button', { name: 'Cancel mission…', exact: true }).click();
      await detail
        .getByRole('checkbox', { name: 'I confirm this exact mission cancellation' })
        .check();
      await detail
        .getByRole('button', { name: 'Confirm mission cancellation', exact: true })
        .click();
      const stop = await app.call<{ stopToken: string }>('sessions.requestStop', {
        sessionId: attempt.sessionId,
      });
      await app.call('sessions.confirmStop', { stopToken: stop.stopToken });
      await expect
        .poll(async () =>
          (await app.liveSessions()).some((session) => session.id === attempt.sessionId),
        )
        .toBe(false);
      await detail
        .getByRole('button', { name: `Inspect unknown effect ${workId.slice(0, 8)}…`, exact: true })
        .click();
      const acknowledge = detail.getByRole('button', {
        name: 'Acknowledge inspected unknown effect',
        exact: true,
      });
      await expect(acknowledge).toBeDisabled();
      await detail
        .getByRole('checkbox', {
          name: 'I inspected this work’s effects and verified the previous worker is stopped',
        })
        .check();
      if (resolution === 'ui') await acknowledge.click();
      else {
        await app.call('missions.resolveEscalation', {
          missionId: mission.id,
          workItemId: workId,
          disposition: 'acknowledge_unknown',
          expectedAttemptId: attempt.id,
          expectedLeaseId: attempt.leaseId,
        });
        await expect(acknowledge).toHaveCount(0);
        await expect(
          detail.getByRole('checkbox', {
            name: 'I inspected this work’s effects and verified the previous worker is stopped',
          }),
        ).toHaveCount(0);
      }
      await expect(detail.getByRole('status')).toContainText('cancelled');
      await expect
        .poll(
          async () =>
            (await app.call<MissionDetailView>('missions.detail', { missionId: mission.id }))
              .leases[0]!.state,
        )
        .toBe('released');
      expect(
        (await app.call<MissionDetailView>('missions.detail', { missionId: mission.id })).attempts,
      ).toHaveLength(1);
      expect(await app.liveSessions()).toHaveLength(1);
    } finally {
      await teardown(app, ...dirs);
    }
  });
}
