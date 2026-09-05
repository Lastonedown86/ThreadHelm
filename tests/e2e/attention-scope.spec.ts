import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { MissionDetailView, OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';
import { prepareFixtureMission } from './helpers/mission.js';
test('recovery scope provides exact return to an unresolved mission decision', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('attention-leader'), tempWorkspace('attention-worker')];
  try {
    const envelope = await prepareFixtureMission(app, dirs);
    const preview = await app.call<OperationResponse<'missions.preview'>>('missions.preview', {
      envelope,
    });
    const mission = await app.call<MissionDetailView>('missions.confirm', {
      previewToken: preview.previewToken,
      boundaryConfirmation: true,
    });
    const worker = mission.envelope!.bindings.find((b) => b.role === 'worker')!;
    const workItemId = randomUUID();
    const base = {
      missionId: mission.id,
      rationale: 'Attention audit',
      inputRefs: [],
      expectedEvidence: 'A bounded report',
    };
    await app.bridgeRequest(mission.supervisorSessionId!, 'threadhelm_work_decompose', {
      ...base,
      idempotencyKey: randomUUID(),
      items: [
        {
          id: workItemId,
          parentWorkItemId: null,
          workspaceId: worker.workspaceId,
          title: 'Audit pending decision',
          specification: 'A bounded check',
          acceptanceCriteria: 'Cited evidence',
          dependencies: [],
          authorityClass: 'routine',
        },
      ],
    });
    await app.bridgeRequest(mission.supervisorSessionId!, 'threadhelm_work_assign', {
      ...base,
      idempotencyKey: randomUUID(),
      workItemId,
      bindingId: worker.bindingId,
    });
    const assigned = await app.call<MissionDetailView>('missions.detail', {
      missionId: mission.id,
    });
    const attempt = assigned.attempts[0]!;
    await app.bridgeRequest(attempt.sessionId!, 'threadhelm_work_result', {
      missionId: mission.id,
      workItemId,
      attemptId: attempt.id,
      idempotencyKey: randomUUID(),
      disposition: 'authority_required',
      explanation: 'Owner decision required for audit fixture',
      evidenceRefs: [],
    });
    await app.page
      .getByRole('listbox', { name: 'Missions', exact: true })
      .getByRole('option', { name: new RegExp(mission.id.slice(0, 8), 'i') })
      .click();
    await expect(app.page.locator('.mission-decision')).toBeVisible();
    const before = await app.call<MissionDetailView>('missions.detail', { missionId: mission.id });
    const liveBefore = await app.liveSessions();
    await app.page.getByRole('button', { name: 'Attention', exact: true }).click();
    await expect(app.page.getByRole('heading', { name: 'Recovery attention queue' })).toBeVisible();
    await expect(app.page.getByText('Session recovery', { exact: true })).toBeVisible();
    await expect(
      app.page.getByText(
        'Mission decisions are reviewed in Missions. This queue and its badge count unresolved session recovery records.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      app.page.getByRole('heading', { name: 'No recovery records need attention' }),
    ).toBeVisible();
    await app.page.screenshot({
      path: fileURLToPath(
        new URL(
          '../../specs/004-sidebar-workspace-ux/audits/evidence/slice-9-attention-scope.png',
          import.meta.url,
        ),
      ),
    });
    await app.page.getByRole('button', { name: 'Open selected mission', exact: true }).focus();
    await app.page.keyboard.press('Enter');
    await expect(app.page.getByRole('button', { name: 'Missions', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(
      app.page
        .getByRole('listbox', { name: 'Missions', exact: true })
        .getByRole('option', { name: new RegExp(mission.id.slice(0, 8), 'i') }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(app.page.locator('.mission-decision')).toContainText('Needs your decision');
    const after = await app.call<MissionDetailView>('missions.detail', { missionId: mission.id });
    expect(after.workItems).toEqual(before.workItems);
    expect(after.attempts).toEqual(before.attempts);
    expect((await app.liveSessions()).map((s) => s.id).sort()).toEqual(
      liveBefore.map((s) => s.id).sort(),
    );
    expect(
      (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).recoveryRecords,
    ).toHaveLength(0);
  } finally {
    await teardown(app, ...dirs);
  }
});

test('recovery-only empty state offers Missions when none is selected', async () => {
  const app = await launchApp();
  try {
    await app.page.getByRole('button', { name: 'Attention', exact: true }).click();
    await expect(
      app.page.getByRole('button', { name: 'Open selected mission', exact: true }),
    ).toHaveCount(0);
    await app.page.getByRole('button', { name: 'Open Missions', exact: true }).click();
    await expect(app.page.getByRole('button', { name: 'Missions', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app);
  }
});
