/** Baseline observations, not post-fix acceptance assertions. */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { version, release } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { OperationResponse, MissionDetailView } from '@threadhelm/contracts';
import {
  launchApp,
  approveFolder,
  launchFixtureSession,
  waitForPidExit,
} from '../../../../tests/e2e/helpers/app.js';
import { launchWithFixtures, teardown, tempWorkspace } from '../../../../tests/e2e/helpers/ui.js';
import { prepareFixtureMission } from '../../../../tests/e2e/helpers/mission.js';
const records: Record<string, unknown>[] = [];
const record = (id: string, data: Record<string, unknown>) => {
  records.push({ id, ...data });
  writeFileSync(
    new URL('../evidence/c32f255-attention.json', import.meta.url),
    JSON.stringify(records, null, 2) + '\n',
  );
};
const capture = (name: string) =>
  fileURLToPath(new URL(`../evidence/c32f255-${name}.png`, import.meta.url));

test('observe recovery selection, dismissal, failed update and restart', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [
    tempWorkspace('attention-a'),
    tempWorkspace('attention-b'),
    tempWorkspace('attention-c'),
  ];
  try {
    record('environment', {
      baseline: 'c32f2554ae43dd43d789f16e16b910b35893f327',
      os: version(),
      release: release(),
      footer: await app.page.locator('.status-bar').innerText(),
      viewport: await app.page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        fontSize: getComputedStyle(document.documentElement).fontSize,
      })),
      fixtures: 'isolated local echo processes; no external provider',
    });
    for (const dir of dirs) {
      const w = await approveFolder(app, dir);
      await launchFixtureSession(app, w.id, 'codex-cli');
    }
    const before = await app.liveSessions();
    const userData = app.userData;
    const pid = await app.app.evaluate(() => process.pid);
    process.kill(pid, 'SIGKILL');
    await waitForPidExit(pid, 20000);
    app = await launchApp({ userData });
    await app.page.getByRole('button', { name: 'Attention', exact: true }).click();
    const queue = app.page.getByRole('list', { name: 'Unresolved recovery records' });
    await expect(queue.locator(':scope > li')).toHaveCount(3);
    const saved = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
    record('A01-crash-recovery', { before, after: await app.liveSessions(), saved });
    const rows = queue.locator(':scope > li');
    await rows.nth(2).locator('button').first().click();
    const selectedBefore = await app.page.locator('.recovery-detail').innerText();
    const dismissedText = await rows.nth(1).innerText();
    await rows.nth(1).getByRole('button', { name: 'Dismiss', exact: true }).click();
    await expect(rows).toHaveCount(2);
    record('A02-dismiss-other-selection', {
      selectedBefore,
      dismissedText,
      selectedAfter: await app.page.locator('.recovery-detail').innerText(),
      saved: await app.call('sessions.list'),
      live: await app.liveSessions(),
    });
    await app.page.screenshot({ path: capture('attention-selection') });
    await app.app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('op:recovery.resolve');
      ipcMain.handle('op:recovery.resolve', () => ({
        ok: false,
        error: { code: 'STORAGE_DEGRADED', message: 'Audit recovery write failed', details: {} },
      }));
    });
    await rows.first().getByRole('button', { name: 'Dismiss', exact: true }).click();
    await expect(
      app.page.getByRole('status').filter({ hasText: 'Audit recovery write failed' }),
    ).toBeVisible();
    record('A03-failed-dismiss', {
      visibleError: await app.page
        .getByRole('status')
        .filter({ hasText: 'Audit recovery write failed' })
        .innerText(),
      rowCount: await rows.count(),
      saved: await app.call('sessions.list'),
      live: await app.liveSessions(),
    });
    await app.page.setViewportSize({ width: 960, height: 800 });
    await app.page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    record('A04-narrow-scale', {
      geometry: await app.page.evaluate(() => ({
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        panels: [
          ...document.querySelectorAll(
            '.recovery-attention-workspace,.recovery-attention-grid,.recovery-detail',
          ),
        ].map((e) => ({
          class: e.className,
          client: e.clientWidth,
          scroll: e.scrollWidth,
          left: e.getBoundingClientRect().left,
          right: e.getBoundingClientRect().right,
        })),
        mainCount: document.querySelectorAll('main').length,
      })),
      queueSelectionSemantics: await queue.locator('button.selected').getAttribute('aria-current'),
    });
    await app.page.screenshot({ path: capture('attention-narrow') });
    await app.close();
    app = await launchApp({ userData });
    record('A05-dismiss-restart', {
      saved: await app.call('sessions.list'),
      live: await app.liveSessions(),
    });
  } finally {
    await teardown(app, ...dirs);
  }
});

test('observe mission decision entry versus global recovery queue', async () => {
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
    const detail = await app.call<MissionDetailView>('missions.detail', { missionId: mission.id });
    record('A06-mission-decision-before', {
      detail,
      missionUi: await app.page.locator('.mission-decision').innerText(),
      attentionDescription: await app.page
        .getByRole('button', { name: 'Attention', exact: true })
        .getAttribute('aria-description'),
      live: await app.liveSessions(),
    });
    const jump = app.page.getByRole('button', { name: 'Open attention queue', exact: true });
    const jumpAvailable = await jump.count();
    if (jumpAvailable) await jump.click();
    else await app.page.getByRole('button', { name: 'Attention', exact: true }).click();
    await expect(
      app.page.getByRole('heading', { name: 'Recovery attention queue', exact: true }),
    ).toBeVisible();
    record('A07-mission-decision-queue', {
      jumpAvailable,
      queue: await app.page.locator('.recovery-attention-workspace').innerText(),
      saved: await app.call('missions.detail', { missionId: mission.id }),
      sessions: await app.call('sessions.list'),
      live: await app.liveSessions(),
    });
    await app.page.screenshot({ path: capture('attention-mission-decision') });
  } finally {
    await teardown(app, ...dirs);
  }
});
