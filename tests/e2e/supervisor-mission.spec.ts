import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { approveFolder, launchApp } from './helpers/app.js';
import type {
  MissionDetailView,
  MissionPreviewView,
  MissionSummaryView,
} from '@threadhelm/contracts';
import { launchWithFixtures, newMissionViaUi, teardown, tempWorkspace } from './helpers/ui.js';
import { composeMissionViaUi, missionProfile, missionSession } from './helpers/mission.js';

test('mission creation is keyboard accessible and explains an empty roster', async () => {
  const app = await launchApp();
  try {
    await newMissionViaUi(app.page, true);
    await expect(app.page.getByRole('heading', { name: 'Define one finish line.' })).toBeFocused();
    await app.page.getByLabel('Finish line', { exact: true }).fill('x');
    await app.page.getByLabel('Proof of completion', { exact: true }).fill('y');
    await app.page.getByRole('button', { name: 'Continue to crew', exact: true }).click();
    await expect(
      app.page.locator('.composer-notice').getByText('No reviewed profile yet.'),
    ).toBeVisible();
    await expect(
      app.page.getByRole('button', { name: 'Continue to access and limits', exact: true }),
    ).toBeDisabled();
    await app.page.getByRole('button', { name: 'Close', exact: true }).click();
    await app.page.getByRole('button', { name: 'Close composer', exact: true }).click();
    await expect(app.page.getByRole('button', { name: 'New mission…', exact: true })).toBeVisible();
  } finally {
    await teardown(app);
  }
});

test('exact mission review supports pause, explicit resume, cancellation and content deletion', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('mission-leader'), tempWorkspace('mission-worker')];
  try {
    const { detail, supervisorId } = await composeMissionViaUi(app, dirs);
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
    await composeMissionViaUi(app, dirs);
    const userData = app.userData;
    await app.crashCoordinator();
    app = await launchWithFixtures({ 'codex-cli': 'echo' }, userData);
    await app.page
      .getByRole('listbox', { name: 'Missions', exact: true })
      .getByRole('option')
      .first()
      .click();
    await app.page.getByRole('button', { name: 'Inspect evidence…', exact: true }).click();
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
  const page = app.page;
  try {
    const leader = await missionProfile(app, 'Allowlist coordinator');
    const workerProfile = await missionProfile(app, 'Allowlist worker');
    const session = await missionSession(app, dirs[0]!);
    const workspace = await approveFolder(app, dirs[1]!);
    await page.reload();
    await newMissionViaUi(page);
    await page.getByLabel('Finish line', { exact: true }).fill('Inspect fixture files');
    await page.getByLabel('Proof of completion', { exact: true }).fill('Cited observations');
    await page.getByRole('button', { name: 'Continue to crew', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Supervisor profile', exact: true })
      .selectOption(leader.profileId);
    await page
      .getByRole('combobox', { name: 'Supervisor session', exact: true })
      .selectOption(session.id);
    await page.getByRole('button', { name: 'Add worker', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Worker 1 profile', exact: true })
      .selectOption(workerProfile.profileId);
    await page.getByLabel('What worker 1 contributes', { exact: true }).fill('Inspect the change.');
    await page.getByLabel('What worker 1 must bring back', { exact: true }).fill('A cited report');
    await page
      .getByRole('button', { name: 'Add to what worker 1 must bring back', exact: true })
      .click();
    const runtime = page.getByRole('group', { name: 'Worker 1' }).locator('details');
    await runtime.locator('summary').click();
    await page
      .getByRole('combobox', { name: 'Worker 1 permission', exact: true })
      .selectOption('bounded_allowlist');
    const tools = page.getByRole('textbox', { name: 'Worker 1 allowed tools', exact: true });
    const addTool = page.getByRole('button', {
      name: 'Add to worker 1 allowed tools',
      exact: true,
    });
    await tools.fill('Read');
    await addTool.click();
    await tools.fill('Glob');
    await addTool.click();
    await page
      .getByRole('checkbox', {
        name: 'Authorize automatic startup of worker 1 within this mission',
        exact: true,
      })
      .check();
    await page.getByRole('button', { name: 'Continue to access and limits', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
      .selectOption(workspace.id);
    await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review mission authority' })).toBeVisible();
    const worker = page.locator('fieldset').filter({ hasText: /^worker ·/ });
    await expect(worker.locator('pre')).toContainText('"boundedAllowlist": [');
    await expect(worker.locator('pre')).toContainText('"Read"');
    await expect(worker.locator('pre')).toContainText('"Glob"');
    await page.getByRole('button', { name: 'Crew', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Choose who does the work.' })).toBeFocused();
    expect(await app.liveSessions()).toHaveLength(1);
  } finally {
    await teardown(app, ...dirs);
  }
});

test('revision editor cannot submit stale fields against a refreshed mission version', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('revision-leader'), tempWorkspace('revision-worker')];
  const page = app.page;
  try {
    const { detail } = await composeMissionViaUi(app, dirs);
    await detail.getByRole('button', { name: 'Pause mission', exact: true }).click();
    await expect(detail.getByRole('status')).toContainText('paused');
    const [summary] = await app.call<MissionSummaryView[]>('missions.list', {});
    const original = await app.call<MissionDetailView>('missions.detail', {
      missionId: summary!.id,
    });
    await detail.getByRole('button', { name: 'Revise envelope…', exact: true }).click();
    await expect(detail).toBeHidden();
    await expect(page.getByText('Step 4 of 4 · Review · Revise mission')).toBeVisible();
    const newer = await app.call<MissionPreviewView>('missions.previewRevision', {
      missionId: original.id,
      expectedVersion: original.version,
      envelope: { ...original.input!, objective: 'Newer reviewed objective' },
    });
    await app.call('missions.confirmRevision', {
      previewToken: newer.previewToken,
      boundaryConfirmation: true,
    });
    await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
    await page.getByRole('button', { name: 'Apply revision', exact: true }).click();
    await expect(page.locator('.composer-state.changed')).toBeVisible();
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
      const { detail, supervisorId } = await composeMissionViaUi(app, dirs);
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
