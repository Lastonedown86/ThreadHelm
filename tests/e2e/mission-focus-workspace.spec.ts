import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type {
  MissionDetailView,
  MissionEnvelopeInput,
  MissionPreviewView,
} from '@threadhelm/contracts';
import { launchApp, type LaunchedApp } from './helpers/app.js';
import { prepareFixtureMission } from './helpers/mission.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

async function confirmMission(app: LaunchedApp, envelope: MissionEnvelopeInput, objective: string) {
  const preview = await app.call<MissionPreviewView>('missions.preview', {
    envelope: { ...envelope, objective },
  });
  return app.call<MissionDetailView>('missions.confirm', {
    previewToken: preview.previewToken,
    boundaryConfirmation: true,
  });
}

function workDecision(missionId: string) {
  return {
    missionId,
    rationale: 'Exercise the approved mission presentation',
    inputRefs: [],
    expectedEvidence: 'A retained browser fixture report',
  };
}

async function addWork(
  app: LaunchedApp,
  mission: MissionDetailView,
  authorityClass: 'routine' | 'consequential' = 'routine',
) {
  const supervisorId = mission.supervisorSessionId!;
  const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
  const workItemId = randomUUID();
  await app.bridgeRequest(supervisorId, 'threadhelm_work_decompose', {
    ...workDecision(mission.id),
    idempotencyKey: randomUUID(),
    items: [
      {
        id: workItemId,
        parentWorkItemId: null,
        workspaceId: binding.workspaceId,
        title: authorityClass === 'routine' ? 'Verify browser evidence' : 'Await owner decision',
        specification: 'Produce one bounded result for the mission workspace.',
        acceptanceCriteria: 'Reference the retained fixture report.',
        dependencies: [],
        authorityClass,
      },
    ],
  });
  return { supervisorId, binding, workItemId };
}

test('missions are the focused default and approved destinations remain explicit', async () => {
  const app = await launchApp();
  const page = app.page;
  try {
    await expect(page.getByRole('button', { name: 'Missions', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('heading', { name: 'Start a mission', exact: true })).toBeVisible();
    await expect(page.getByText('Local coordinator · sole writer', { exact: true })).toBeVisible();
    await expect(
      page.getByText('External actions · approval required', { exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Local sessions', exact: true })).toBeVisible();
    await expect(
      page.getByText('Select a mission to narrow the dock to its exact workers.'),
    ).toBeVisible();

    await expect(page.getByText(/^sessions workspace$/)).toHaveCount(0);
    await expect(
      page.getByRole('complementary', { name: 'Mission context' }).getByRole('heading', {
        name: 'Sessions',
      }),
    ).toBeVisible();
    await expect(page.getByText(/need attention|Ready for reviewed work/)).toBeVisible();
    const padding = await page
      .locator('.mission-shell-context .mission-context-content')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(padding).toBeGreaterThan(8);

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
    for (const width of [1400, 1100]) {
      await page.setViewportSize({ width, height: 860 });
      await page.getByRole('button', { name: 'Memory', exact: true }).click();
      await expect(page.getByRole('heading', { name: /reading list/i })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
        `no horizontal overflow at ${width}px`,
      ).toBe(false);
      const clipped = await page.evaluate(() => {
        const main = document.querySelector('.mission-shell-workspace')!;
        return main.scrollWidth > main.clientWidth;
      });
      expect(clipped, `workspace column does not scroll sideways at ${width}px`).toBe(false);
      await page.getByRole('button', { name: 'Missions', exact: true }).click();
    }
  } finally {
    await teardown(app);
  }
});

test('mission course exposes selected, waiting, uncertain, completed and recovery states honestly', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const directories: string[] = [];
  const newEnvelope = async (tag: string) => {
    const pair = [tempWorkspace(`${tag}-leader`), tempWorkspace(`${tag}-worker`)];
    directories.push(...pair);
    return prepareFixtureMission(app, pair);
  };
  try {
    let completed = await confirmMission(
      app,
      await newEnvelope('completed-focus'),
      'Completed browser evidence mission',
    );
    const completedWork = await addWork(app, completed);
    await app.bridgeRequest(completedWork.supervisorId, 'threadhelm_work_assign', {
      ...workDecision(completed.id),
      idempotencyKey: randomUUID(),
      workItemId: completedWork.workItemId,
      bindingId: completedWork.binding.bindingId,
    });
    completed = await app.call('missions.detail', { missionId: completed.id });
    const completedAttempt = completed.attempts[0]!;
    await app.bridgeRequest(completedAttempt.sessionId!, 'threadhelm_work_result', {
      missionId: completed.id,
      workItemId: completedWork.workItemId,
      attemptId: completedAttempt.id,
      idempotencyKey: randomUUID(),
      disposition: 'completion',
      explanation: 'The browser fixture completed with retained evidence.',
      evidenceRefs: [{ kind: 'artifact', id: 'browser-report.md' }],
    });
    await app.bridgeRequest(completedWork.supervisorId, 'threadhelm_mission_complete', {
      ...workDecision(completed.id),
      idempotencyKey: randomUUID(),
      evidenceRefs: [{ kind: 'work_item', id: completedWork.workItemId }],
    });

    let uncertain = await confirmMission(
      app,
      await newEnvelope('uncertain-focus'),
      'Uncertain browser evidence mission',
    );
    const uncertainWork = await addWork(app, uncertain);
    await app.bridgeRequest(uncertainWork.supervisorId, 'threadhelm_work_assign', {
      ...workDecision(uncertain.id),
      idempotencyKey: randomUUID(),
      workItemId: uncertainWork.workItemId,
      bindingId: uncertainWork.binding.bindingId,
    });
    uncertain = await app.call('missions.detail', { missionId: uncertain.id });
    const uncertainAttempt = uncertain.attempts[0]!;
    await app.bridgeRequest(uncertainAttempt.sessionId!, 'threadhelm_work_result', {
      missionId: uncertain.id,
      workItemId: uncertainWork.workItemId,
      attemptId: uncertainAttempt.id,
      idempotencyKey: randomUUID(),
      disposition: 'unknown',
      explanation: 'The prior effect cannot be classified safely.',
      evidenceRefs: [],
    });

    const waiting = await confirmMission(
      app,
      await newEnvelope('waiting-focus'),
      'Waiting browser decision mission',
    );
    const waitingWork = await addWork(app, waiting);
    await app.bridgeRequest(waitingWork.supervisorId, 'threadhelm_work_assign', {
      ...workDecision(waiting.id),
      idempotencyKey: randomUUID(),
      workItemId: waitingWork.workItemId,
      bindingId: waitingWork.binding.bindingId,
    });
    const waitingDetail = await app.call<MissionDetailView>('missions.detail', {
      missionId: waiting.id,
    });
    const waitingAttempt = waitingDetail.attempts[0]!;
    await app.bridgeRequest(waitingAttempt.sessionId!, 'threadhelm_work_result', {
      missionId: waiting.id,
      workItemId: waitingWork.workItemId,
      attemptId: waitingAttempt.id,
      idempotencyKey: randomUUID(),
      disposition: 'authority_required',
      explanation: 'The worker needs an exact owner decision before continuing.',
      evidenceRefs: [],
    });
    const paused = await confirmMission(
      app,
      await newEnvelope('paused-focus'),
      'Paused browser evidence mission',
    );
    const pausedWork = await addWork(app, paused);
    await app.bridgeRequest(pausedWork.supervisorId, 'threadhelm_work_assign', {
      ...workDecision(paused.id),
      idempotencyKey: randomUUID(),
      workItemId: pausedWork.workItemId,
      bindingId: pausedWork.binding.bindingId,
    });
    await app.call('missions.pause', { missionId: paused.id });
    const running = await confirmMission(
      app,
      await newEnvelope('running-focus'),
      'Running browser evidence mission',
    );

    const list = app.page.getByRole('listbox', { name: 'Missions', exact: true });
    await expect(list.getByRole('option')).toHaveCount(5);

    const select = async (mission: MissionDetailView) => {
      const option = list.getByRole('option', { name: new RegExp(mission.id.slice(0, 8), 'i') });
      await option.click();
      await expect(app.page.locator('#mission-workspace h1')).toBeFocused();
      await expect(list.getByRole('option', { selected: true })).toHaveCount(1);
    };

    await select(running);
    await expect(app.page.getByText('Running', { exact: true })).toBeVisible();
    await expect(
      app.page.getByRole('button', { name: 'Pause mission', exact: true }),
    ).toBeVisible();
    const strip = app.page.getByRole('list', { name: 'Mission status' });
    await expect(strip).toContainText('Work continues locally');
    await expect(strip).toContainText('0 decisions pending');
    await expect(strip).toContainText('2 sessions attached');
    await expect(app.page.getByRole('button', { name: 'View full history…' })).toBeVisible();
    await expect(app.page.getByText('No verified result yet.')).toBeVisible();
    await expect(app.page.getByRole('heading', { name: 'Latest verified result' })).toHaveCount(0);

    await select(paused);
    await expect(app.page.getByText('Paused', { exact: true })).toBeVisible();
    await expect(
      app.page.getByRole('button', { name: 'Resume mission…', exact: true }),
    ).toBeVisible();
    const course = app.page.getByRole('list', { name: 'Mission course' });
    const node = course.getByRole('listitem').first();
    await expect(node).toContainText('1');
    await expect(node).toContainText('In focus');
    await expect(node.getByRole('button', { name: 'Open terminal' })).toBeVisible();

    await select(waiting);
    // A — state-tinted: nothing new in the header; the strip and node carry the state.
    await expect(app.page.locator('.mission-header')).not.toContainText('Needs your decision');
    await expect(app.page.getByRole('status').filter({ hasText: /Mission changed/ })).toContainText(
      'Mission changed: Waiting browser decision mission, Waiting for you',
    );
    await expect(
      app.page
        .getByRole('complementary', { name: 'Mission context' })
        .getByText('Needs your decision', { exact: true }),
    ).toBeVisible();
    await expect(
      app.page
        .locator('.mission-action-row')
        .getByRole('button', { name: 'Review choices…', exact: true }),
    ).toBeVisible();
    await expect(
      app.page.getByRole('list', { name: 'Mission course' }).getByRole('button', {
        name: 'Review choices…',
      }),
    ).toBeVisible();
    const rail = app.page.getByRole('complementary', { name: 'Mission context' });
    await expect(rail.locator('section').first()).toContainText('Needs your decision');
    await expect(rail.getByRole('button', { name: 'Review choices…' })).toBeVisible();
    await expect(rail.getByRole('list', { name: 'Crew' }).getByRole('listitem')).toHaveCount(2);
    await expect(rail.getByRole('list', { name: 'Crew' })).toContainText('Supervisor');
    await expect(rail.getByRole('list', { name: 'Crew' })).toContainText('failed');

    await select(uncertain);
    await expect(
      app.page.getByRole('article').getByText('Outcome uncertain', { exact: true }),
    ).toBeVisible();
    await expect(
      app.page
        .locator('.mission-action-row')
        .getByRole('button', { name: 'Inspect evidence…', exact: true }),
    ).toBeVisible();
    await expect(app.page.getByRole('button', { name: /retry/i })).toHaveCount(0);

    await select(completed);
    await expect(
      list.getByRole('option', { name: new RegExp(completed.id.slice(0, 8), 'i') }),
    ).toContainText('1/1');
    await expect(
      app.page.locator('.mission-lifecycle').getByText('Completed', { exact: true }),
    ).toBeVisible();
    await expect(
      app.page.getByRole('button', { name: 'View evidence…', exact: true }),
    ).toBeVisible();
    await expect(app.page.getByText(/artifact · browser-report\.md/)).toBeVisible();
    await expect(
      app.page.getByRole('list', { name: 'Mission course' }).getByText('Verified', { exact: true }),
    ).toBeVisible();
    await expect(app.page.getByRole('heading', { name: 'Latest verified result' })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Open evidence…' })).toBeVisible();

    const userData = app.userData;
    await app.crashCoordinator();
    app = await launchWithFixtures({ 'codex-cli': 'echo' }, userData);
    const recovered = app.page
      .getByRole('listbox', { name: 'Missions', exact: true })
      .getByRole('option', { name: new RegExp(running.id.slice(0, 8), 'i') });
    await recovered.click();
    await expect(
      app.page.locator('.mission-lifecycle').getByText('Recovery required', { exact: true }),
    ).toBeVisible();
    await expect(
      app.page
        .locator('.mission-action-row')
        .getByRole('button', { name: 'Inspect evidence…', exact: true }),
    ).toBeVisible();
    await expect(
      app.page
        .getByRole('complementary', { name: 'Mission context' })
        .getByRole('button', { name: 'Open attention queue' }),
    ).toBeVisible();
    await expect(
      app.page.getByRole('button', { name: 'Attention', exact: true }),
    ).toHaveAccessibleDescription(/needing attention/);
  } finally {
    await teardown(app, ...directories);
  }
});

test('narrow windows keep the mission heading in the first screen', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const directories = [tempWorkspace('narrow-leader'), tempWorkspace('narrow-worker')];
  try {
    const mission = await confirmMission(
      app,
      await prepareFixtureMission(app, directories),
      'Narrow window mission',
    );
    await app.page.setViewportSize({ width: 680, height: 800 });
    await app.page.getByLabel('Selected mission').selectOption(mission.id);
    const heading = app.page.locator('#mission-workspace h1');
    await expect(heading).toHaveText('Narrow window mission');
    const top = await heading.evaluate((el) => el.getBoundingClientRect().top);
    expect(top, 'mission heading inside the first viewport').toBeLessThan(400);
    const scrollers = await app.page.evaluate(
      () =>
        [...document.querySelectorAll('*')].filter((el) => {
          const s = getComputedStyle(el);
          return (
            (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight
          );
        }).length,
    );
    expect(scrollers, 'one vertical scroller').toBeLessThanOrEqual(1);
  } finally {
    await teardown(app, ...directories);
  }
});

test('medium windows keep an attention control when a decision waits', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const directories = [tempWorkspace('medium-leader'), tempWorkspace('medium-worker')];
  try {
    let mission = await confirmMission(
      app,
      await prepareFixtureMission(app, directories),
      'Medium window mission',
    );
    const work = await addWork(app, mission);
    await app.bridgeRequest(work.supervisorId, 'threadhelm_work_assign', {
      ...workDecision(mission.id),
      idempotencyKey: randomUUID(),
      workItemId: work.workItemId,
      bindingId: work.binding.bindingId,
    });
    mission = await app.call('missions.detail', { missionId: mission.id });
    await app.bridgeRequest(mission.attempts[0]!.sessionId!, 'threadhelm_work_result', {
      missionId: mission.id,
      workItemId: work.workItemId,
      attemptId: mission.attempts[0]!.id,
      idempotencyKey: randomUUID(),
      disposition: 'authority_required',
      explanation: 'An owner decision is needed.',
      evidenceRefs: [],
    });
    await app.page.setViewportSize({ width: 960, height: 800 });
    const list = app.page.getByRole('listbox', { name: 'Missions', exact: true });
    await list.getByRole('option', { name: new RegExp(mission.id.slice(0, 8), 'i') }).click();
    const toggle = app.page.getByRole('button', { name: /needs your decision/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const panel = app.page.getByRole('dialog', { name: 'Mission context' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Review choices…' })).toBeVisible();
    await app.page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
  } finally {
    await teardown(app, ...directories);
  }
});
