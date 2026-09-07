import { test, expect, type Locator, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { cpus, totalmem, release, arch } from 'node:os';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { prepareFixtureMission } from './helpers/mission.js';
import { launchWithFixtures, teardown, tempWorkspace, terminalRows } from './helpers/ui.js';

test.setTimeout(180_000);
const destinations = ['Settings', 'Sessions', 'Agents', 'Memory', 'Attention', 'Missions'];

// Traverse the browser's real tab order. No locator.focus(), click(), fill() or
// selectOption() is used for the journeys below. F6 is the documented PTY exit.
async function reach(target: Locator) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  const page = target.page();
  for (let step = 0; step < 240; step++) {
    if (await target.evaluate((el) => el === document.activeElement)) {
      const geometry = await target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2));
        const y = Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2));
        const top = document.elementFromPoint(x, y);
        return {
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          top: top?.outerHTML.slice(0, 200),
          visible:
            r.top >= -1 &&
            r.bottom <= innerHeight + 1 &&
            r.left >= -1 &&
            r.right <= innerWidth + 1 &&
            (top === el || el.contains(top)),
        };
      });
      if (!geometry.visible)
        await page.screenshot({ path: test.info().outputPath('focus-obscured.png') });
      expect(
        geometry.visible,
        `Focused control obscured ${JSON.stringify(geometry)}: ${(await target.getAttribute('aria-label')) ?? (await target.textContent())}`,
      ).toBe(true);
      return;
    }
    if (
      await page.evaluate(() => document.activeElement?.classList.contains('xterm-helper-textarea'))
    ) {
      await page.keyboard.press('F6');
    } else await page.keyboard.press('Tab');
  }
  throw new Error(`Not reachable by Tab: ${target}`);
}
async function activate(target: Locator, key = 'Enter') {
  await reach(target);
  await target.page().keyboard.press(key);
}
async function enter(target: Locator, value: string) {
  await reach(target);
  await target.page().keyboard.press('Control+A');
  await target.page().keyboard.insertText(value);
}
async function select(target: Locator, value: string, byLabel = false) {
  const index = await target.evaluate(
    (el, wanted) =>
      [...(el as HTMLSelectElement).options].findIndex(
        (o) => (wanted.byLabel ? o.label : o.value) === wanted.value,
      ),
    { value, byLabel },
  );
  expect(index).toBeGreaterThanOrEqual(0);
  await reach(target);
  await target.page().keyboard.press('Home');
  for (let i = 0; i < index; i++) await target.page().keyboard.press('ArrowDown');
  await target.page().keyboard.press('Tab');
}
async function scalePage(page: Page, scale: string) {
  await page.setViewportSize({ width: 960, height: 800 });
  await page.evaluate((s) => {
    document.documentElement.style.fontSize = s;
  }, scale);
}

for (const scale of ['100%', '200%']) {
  test(`keyboard Settings, bundled Agent and Memory publication at ${scale}`, async () => {
    const app = await launchWithFixtures({ 'codex-cli': 'echo' });
    const dir = tempWorkspace('acceptance-keyboard');
    const page = app.page;
    try {
      await scalePage(page, scale);
      await activate(page.getByRole('button', { name: 'Settings', exact: true }));
      await app.setPickerPath(dir);
      await activate(page.getByRole('button', { name: 'Choose folder…', exact: true }));
      const approval = page.getByRole('dialog', { name: 'Approve this folder?' });
      await activate(approval.getByRole('button', { name: 'Approve folder', exact: true }));
      await expect(approval).toBeHidden();
      const workspaces = await app.call<OperationResponse<'workspaces.list'>>('workspaces.list');
      const workspace = workspaces.find((w) => w.selectedPath === dir)!;
      expect(workspace).toBeTruthy();

      await activate(page.getByRole('button', { name: 'Agents', exact: true }));
      await activate(page.getByRole('button', { name: 'Create agent…', exact: true }));
      const wizard = page.getByRole('dialog', { name: 'Create agent', exact: true });
      await select(
        wizard.getByLabel('Start from', { exact: true }),
        'Quality specialist (bundled)',
        true,
      );
      for (const step of [
        'Identity',
        'Role and goal',
        'Capabilities',
        'Runtime requests',
        'Review',
      ]) {
        await activate(wizard.getByRole('button', { name: 'Next', exact: true }));
        await expect(wizard.getByRole('heading', { name: step, exact: true })).toBeFocused();
        if (step === 'Identity')
          await enter(wizard.getByLabel('Name', { exact: true }), `Keyboard quality ${scale}`);
      }
      await activate(
        wizard.getByRole('checkbox', { name: 'I reviewed this exact manifest' }),
        'Space',
      );
      await activate(wizard.getByRole('button', { name: 'Save profile', exact: true }));
      await expect(wizard).toBeHidden();
      const profiles = await app.call<OperationResponse<'profiles.list'>>('profiles.list');
      expect(profiles.profiles.some((p) => p.displayName === `Keyboard quality ${scale}`)).toBe(
        true,
      );

      await activate(page.getByRole('button', { name: 'Memory', exact: true }));
      const toggle = page.getByRole('button', { name: 'Shared memory', exact: true });
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await activate(toggle);
      await activate(page.getByRole('button', { name: 'Publish memory…', exact: true }));
      const composer = page.getByRole('dialog', { name: 'Publish shared memory' });
      await enter(composer.getByLabel('Title', { exact: true }), `Acceptance memory ${scale}`);
      await enter(
        composer.getByLabel('Body', { exact: true }),
        'Exact keyboard publication evidence',
      );
      await enter(composer.getByLabel('Source reference', { exact: true }), 'acceptance.md');
      await activate(composer.getByRole('button', { name: 'Review publication' }));
      const review = page.getByRole('dialog', { name: 'Review durable memory publication' });
      await activate(review.getByRole('checkbox'), 'Space');
      await activate(review.getByRole('button', { name: 'Publish memory', exact: true }));
      await expect(review).toBeHidden();
      const scope = { workspaceId: workspace.id };
      const found = await app.call<OperationResponse<'memory.search'>>('memory.search', {
        scope,
        query: 'Acceptance memory',
      });
      expect(found.items).toHaveLength(1);
      const saved = await app.call<OperationResponse<'memory.get'>>('memory.get', {
        scope,
        entryId: found.items[0]!.entryId,
      });
      expect(saved.body).toBe('Exact keyboard publication evidence');
      const search = page.getByRole('searchbox', { name: 'Search shared memory' });
      await enter(search, 'Acceptance memory');
      await page.keyboard.press('Enter');
      const results = page.getByRole('list', { name: 'Shared memory results' });
      await expect(results.getByRole('listitem')).toHaveCount(1);
      await activate(results.getByRole('button', { name: 'View details' }));
      await expect(page.getByRole('region', { name: 'Memory detail' })).toContainText(saved.body!);

      expect(await app.liveSessions()).toEqual([]);
      await page.screenshot({
        path: `specs/004-sidebar-workspace-ux/audits/evidence/slice-33-memory-${scale.replace('%', '')}.png`,
      });
    } finally {
      await teardown(app, dir);
    }
  });

  test(`keyboard Mission creation, Sessions and Attention recovery at ${scale}`, async () => {
    let app = await launchWithFixtures({ 'codex-cli': 'echo' });
    const dirs = [tempWorkspace('acceptance-leader'), tempWorkspace('acceptance-worker')];
    try {
      const envelope = await prepareFixtureMission(app, dirs);
      let page = app.page;
      await scalePage(page, scale);
      await activate(page.getByRole('button', { name: 'New mission…', exact: true }));
      await expect(page.locator('.repo-idea-entry h1')).toBeFocused();
      await activate(page.getByRole('button', { name: /^Skip/ }));
      await enter(page.getByLabel('Finish line', { exact: true }), `Keyboard mission ${scale}`);
      await enter(
        page.getByLabel('Proof of completion', { exact: true }),
        'A cited keyboard report',
      );
      await activate(page.getByRole('button', { name: 'Continue to crew', exact: true }));
      await select(
        page.getByRole('combobox', { name: 'Supervisor profile', exact: true }),
        envelope.supervisor.profileId,
      );
      await select(
        page.getByRole('combobox', { name: 'Supervisor session', exact: true }),
        envelope.supervisor.sessionId,
      );
      await activate(page.getByRole('button', { name: 'Add worker', exact: true }));
      await select(
        page.getByRole('combobox', { name: 'Worker 1 profile', exact: true }),
        envelope.workers[0]!.profileId,
      );
      await select(
        page.getByRole('combobox', { name: 'Worker 1 session', exact: true }),
        envelope.workers[0]!.sessionId!,
      );
      await enter(
        page.getByLabel('What worker 1 contributes', { exact: true }),
        'Inspect the fixture',
      );
      await enter(
        page.getByLabel('What worker 1 must bring back', { exact: true }),
        'Cited report',
      );
      await activate(
        page.getByRole('button', { name: 'Add to what worker 1 must bring back', exact: true }),
      );
      await activate(
        page.getByRole('button', { name: 'Continue to access and limits', exact: true }),
      );
      await activate(page.getByRole('button', { name: 'Continue to review', exact: true }));
      await expect(page.locator('.composer-state.ready')).toBeVisible();
      await activate(
        page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }),
        'Space',
      );
      await activate(page.getByRole('button', { name: 'Start mission', exact: true }));
      await expect(page.locator('#mission-workspace h1')).toHaveText(`Keyboard mission ${scale}`);
      const missions = await app.call<OperationResponse<'missions.list'>>('missions.list');
      expect(missions).toHaveLength(1);
      const detail = await app.call<OperationResponse<'missions.detail'>>('missions.detail', {
        missionId: missions[0]!.id,
      });
      expect(detail.envelope!.bindings.find((b) => b.role === 'supervisor')!.sessionId).toBe(
        envelope.supervisor.sessionId,
      );
      expect(detail.envelope!.objective).toBe(`Keyboard mission ${scale}`);
      await activate(page.getByRole('button', { name: 'View full history…', exact: true }));
      await expect(page.getByRole('dialog', { name: 'Mission detail', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await activate(page.getByRole('button', { name: 'Sessions', exact: true }));
      const list = page.getByRole('listbox', { name: 'Sessions' });
      // The list is the single tab stop; its documented arrow/Home interaction
      // chooses a row and moves focus into the selected terminal.
      await reach(list);
      await page.keyboard.press('Home');
      await page.keyboard.press('Enter');
      await expect(page.locator('.active-terminal')).toBeAttached();
      const terminal = page.locator('.active-terminal .xterm-helper-textarea');
      await expect(terminal).toBeAttached();
      for (
        let i = 0;
        i < 30 && !(await terminal.evaluate((el) => el === document.activeElement));
        i++
      )
        await page.keyboard.press('Tab');
      await expect(terminal).toBeFocused();
      await page.keyboard.type('acceptance-keyboard');
      await page.keyboard.press('Enter');
      await expect(terminalRows(page)).toContainText('ECHO:acceptance-keyboard');
      expect((await app.liveSessions()).map((s) => s.id).sort()).toEqual(
        [envelope.supervisor.sessionId, envelope.workers[0]!.sessionId!].sort(),
      );
      await page.keyboard.press('F6');
      const userData = app.userData;
      await app.crashCoordinator();
      app = await launchApp({ userData });
      page = app.page;
      await scalePage(page, scale);
      await activate(page.getByRole('button', { name: 'Attention', exact: true }));
      const before = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
      expect(before.recoveryRecords.length).toBeGreaterThan(0);
      const rows = page
        .getByRole('list', { name: 'Unresolved recovery records' })
        .locator(':scope > li');
      const targetId = await rows.first().getAttribute('data-recovery-id');
      const targetRecord = before.recoveryRecords.find((r) => r.id === targetId)!;
      expect(targetRecord).toBeTruthy();
      await activate(rows.first().getByRole('button', { name: 'Dismiss', exact: true }));
      await expect(rows).toHaveCount(before.recoveryRecords.length - 1);
      const after = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
      expect(after.recoveryRecords.map((r) => r.id).sort()).toEqual(
        before.recoveryRecords
          .filter((r) => r.id !== targetRecord.id)
          .map((r) => r.id)
          .sort(),
      );
      expect(after.sessions.find((s) => s.id === targetRecord.sessionId)?.lifecycleState).toBe(
        'stopped',
      );
      expect(await app.liveSessions()).toEqual([]);
    } finally {
      await teardown(app, ...dirs);
    }
  });
}

test('dense inventory responsiveness and idle rendering budget', async () => {
  const testInfo = test.info();
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [
    tempWorkspace('acceptance-density-leader'),
    tempWorkspace('acceptance-density-worker'),
  ];
  try {
    const envelope = await prepareFixtureMission(app, dirs);
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      const p = await app.call<OperationResponse<'missions.preview'>>('missions.preview', {
        envelope: { ...envelope, objective: `Repeated prefix mission ${i}` },
      });
      const m = await app.call<OperationResponse<'missions.confirm'>>('missions.confirm', {
        previewToken: p.previewToken,
        boundaryConfirmation: true,
      });
      ids.push(m.id);
      await app.call('missions.cancel', { missionId: m.id });
    }
    for (let i = 0; i < 20; i++) {
      const d = await app.call<OperationResponse<'missionComposer.createDraft'>>(
        'missionComposer.createDraft',
      );
      await app.call('missionComposer.updateDraft', {
        draftId: d.draftId,
        expectedVersion: d.version,
        currentStage: 'outcome',
        fieldValues: { objective: `Repeated long draft ${i} `.repeat(15) },
      });
    }
    await expect(app.page.locator('.mission-rail-list [role=option]')).toHaveCount(50);
    await expect(app.page.locator('.mission-rail-drafts li')).toHaveCount(20);
    const samples: { scale: string; destination: string; milliseconds: number }[] = [];
    for (const scale of ['100%', '200%']) {
      await scalePage(app.page, scale);
      for (let round = 0; round < 3; round++)
        for (const name of destinations) {
          const start = performance.now();
          const button = app.page.getByRole('button', { name, exact: true });
          await button.click();
          await expect(button).toHaveAttribute('aria-current', 'page');
          await expect(app.page.locator('#mission-workspace h1')).toBeVisible();
          await expect(
            app.page.getByText('The output stream for this session failed', { exact: false }),
          ).toHaveCount(0);
          await app.page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              ),
          );
          samples.push({
            scale,
            destination: name,
            milliseconds: Math.round(performance.now() - start),
          });
        }
    }
    const idle = await app.page.evaluate(
      () =>
        new Promise<{ mutations: number; animations: number }>((resolve) => {
          let mutations = 0;
          const observer = new MutationObserver((records) => {
            mutations += records.length;
          });
          observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
          setTimeout(() => {
            observer.disconnect();
            resolve({
              mutations,
              animations: document.getAnimations().filter((a) => a.playState === 'running').length,
            });
          }, 5000);
        }),
    );
    const report = {
      recordedAt: new Date().toISOString(),
      hardware: {
        cpu: cpus()[0]!.model,
        logicalCpus: cpus().length,
        ramGiB: totalmem() / 1024 ** 3,
        os: release(),
        arch: arch(),
      },
      fixture: { missions: 50, drafts: 20, idleSessions: 2 },
      budget: { p95Ms: 1000, idleMutations: 0, runningAnimations: 0 },
      samples,
      idle,
    };
    const evidence = testInfo.outputPath('responsiveness.json');
    writeFileSync(evidence, JSON.stringify(report, null, 2));
    await testInfo.attach('responsiveness', { path: evidence, contentType: 'application/json' });
    for (const scale of ['100%', '200%']) {
      const times = samples
        .filter((s) => s.scale === scale)
        .map((s) => s.milliseconds)
        .sort((a, b) => a - b);
      expect(times[Math.ceil(times.length * 0.95) - 1]).toBeLessThanOrEqual(1000);
    }
    expect(idle).toEqual({ mutations: 0, animations: 0 });
    expect(
      (await app.call<OperationResponse<'missions.list'>>('missions.list', { limit: 100 }))
        .map((m) => m.id)
        .sort(),
    ).toEqual(ids.sort());
  } finally {
    await teardown(app, ...dirs);
  }
});
