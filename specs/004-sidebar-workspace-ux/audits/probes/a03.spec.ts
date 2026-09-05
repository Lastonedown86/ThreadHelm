/** Audit observations, not acceptance assertions: defects are recorded honestly. */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { release, version } from 'node:os';
import type { OperationResponse } from '@threadhelm/contracts';
import {
  launchWithFixtures,
  approveViaUi,
  launchViaUi,
  stopViaUi,
  sessionOption,
  teardown,
  tempWorkspace,
} from '../../../../tests/e2e/helpers/ui.js';
import { prepareFixtureMission } from '../../../../tests/e2e/helpers/mission.js';

const rows: Record<string, unknown>[] = [];
function record(id: string, values: Record<string, unknown>) {
  rows.push({ id, ...values });
  writeFileSync(
    new URL('../evidence/83883d0-sessions.json', import.meta.url),
    JSON.stringify(rows, null, 2) + '\n',
  );
}
const capture = (name: string) =>
  new URL(`../evidence/83883d0-${name}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

test('observe local session inventory, exact controls and launch recovery', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [
    tempWorkspace('audit-session-a'),
    tempWorkspace('audit-session-b'),
    tempWorkspace('audit-session-expiry'),
  ];
  const page = app.page;
  try {
    record('environment', {
      base: '83883d04940b32410075949bfefb7e87a85888a3',
      os: version(),
      release: release(),
      providers: 'isolated echo fixtures',
    });
    await page.setViewportSize({ width: 1400, height: 860 });
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    record('S01-empty', {
      heading: await page.locator('#session-workspace-heading').innerText(),
      emptyCopy: await page.locator('.mission-workspace-state').innerText(),
      live: await app.liveSessions(),
    });
    const a = await launchViaUi(app, 'codex-cli', await approveViaUi(app, dirs[0]!));
    const b = await launchViaUi(app, 'codex-cli', await approveViaUi(app, dirs[1]!));
    await expect(page.getByRole('tab')).toHaveCount(2);
    const tabs = page.getByRole('tab');
    await tabs.first().focus();
    const before = await page.getByRole('tab', { selected: true }).innerText();
    await page.keyboard.press('ArrowRight');
    record('S02-tab-navigation', {
      names: await tabs.allInnerTexts(),
      selectedBefore: before,
      selectedAfter: await page.getByRole('tab', { selected: true }).innerText(),
      focusStayedOnFirst: await tabs.first().evaluate((e) => e === document.activeElement),
      tabStops: await tabs.evaluateAll((es) => es.map((e) => e.getAttribute('tabindex'))),
      tabPanels: await page.getByRole('tabpanel').count(),
    });
    await sessionOption(page, a).click();
    await stopViaUi(app, a);
    const hide = page.getByRole('button', { name: 'Hide 1 ended session', exact: true });
    await expect(hide).toBeVisible();
    await hide.click();
    record('S03-hide-selected-ended', {
      expanded: await hide.getAttribute('aria-expanded'),
      endedListed: await sessionOption(page, a).count(),
      tabNames: await tabs.allInnerTexts(),
      liveIds: (await app.liveSessions()).map((s) => s.id),
    });
    await sessionOption(page, b).click();
    // A second toggle clears the latent explicit expansion set by the failed Hide click.
    const toggle = page.locator('.ended-sessions-toggle');
    if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click();
    record('S04-collapsed-inventory', {
      endedListed: await sessionOption(page, a).count(),
      expanded: await toggle.getAttribute('aria-expanded'),
      tabNames: await tabs.allInnerTexts(),
      nestedMains: await page.locator('main main').count(),
      duplicateTerminalIds: await page.locator('[id="terminal"]').count(),
    });
    await page.screenshot({ path: capture('ended-tabs') });
    const snapshot = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
    record('S05-stop-readback', {
      stoppedA: snapshot.sessions.find((s) => s.id === a)?.lifecycleState,
      runningB: snapshot.sessions.find((s) => s.id === b)?.lifecycleState,
      liveIds: (await app.liveSessions()).map((s) => s.id),
      stoppedJob: await app.jobSnapshot(a),
    });
    const expiryPath = await approveViaUi(app, dirs[2]!);
    await page.getByLabel('Launch in').selectOption({ label: expiryPath });
    await page
      .getByRole('button', { name: `Launch Codex CLI in ${expiryPath}`, exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Review this launch' });
    await dialog.getByRole('checkbox').check();
    const launch = dialog.getByRole('button', { name: 'Launch session', exact: true });
    await expect(launch).toBeEnabled();
    // Ordinary launch tokens use wall time, not the mission test clock.
    for (let i = 0; i < 3; i++) await page.waitForTimeout(41000);
    await launch.click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    record('S06-expired-preview', {
      error: await dialog.getByRole('alert').innerText(),
      launchStillEnabled: await launch.isEnabled(),
      buttons: await dialog.getByRole('button').allInnerTexts(),
      liveIds: (await app.liveSessions()).map((s) => s.id),
    });
    await launch.click();
    record('S07-repeated-expiry', {
      error: await dialog.getByRole('alert').innerText(),
      liveIds: (await app.liveSessions()).map((s) => s.id),
    });
    await page.screenshot({ path: capture('expired-launch') });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await stopViaUi(app, b);
  } finally {
    await teardown(app, ...dirs);
  }
});

test('observe mission scope hiding an unrelated newly launched session', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [
    tempWorkspace('audit-mission-leader'),
    tempWorkspace('audit-mission-worker'),
    tempWorkspace('audit-unbound-session'),
  ];
  const page = app.page;
  try {
    const envelope = await prepareFixtureMission(app, dirs.slice(0, 2));
    const preview = await app.call<OperationResponse<'missions.preview'>>('missions.preview', {
      envelope,
    });
    const mission = await app.call<OperationResponse<'missions.confirm'>>('missions.confirm', {
      previewToken: preview.previewToken,
      boundaryConfirmation: true,
    });
    await app.call('providers.listReadiness');
    await page.getByRole('option').filter({ hasText: envelope.objective }).click();
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await expect(page.getByRole('tab')).toHaveCount(2);
    record('S08-mission-scope', {
      missionId: mission.id,
      tabCount: await page.getByRole('tab').count(),
      allSessionsControls: await page
        .getByRole('button', { name: /All sessions|Clear mission|Show all sessions/i })
        .count(),
      launchButtons: await page.getByRole('button', { name: /^Launch .* in / }).count(),
      copy: await page.locator('.workspace-page-header').innerText(),
    });
    const outsidePath = await approveViaUi(app, dirs[2]!);
    await app.call('providers.listReadiness');
    await page.getByLabel('Launch in').selectOption({ label: outsidePath });
    await page
      .getByRole('button', { name: `Launch Codex CLI in ${outsidePath}`, exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Review this launch' });
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Launch session', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await app.liveSessions()).length).toBe(3);
    const bound = new Set(
      envelope.workers.map((w) => w.sessionId).concat(envelope.supervisor.sessionId),
    );
    const outside = (await app.liveSessions()).find((s) => !bound.has(s.id))!;
    await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);
    record('S09-unbound-launch', {
      outsideId: outside.id,
      liveIds: (await app.liveSessions()).map((s) => s.id),
      missionHeading: await page.locator('#session-workspace-heading').innerText(),
      outsideListRows: await page.locator(`#session-${outside.id}`).count(),
      tabCount: await page.getByRole('tab').count(),
      selectedDockShowsOutside: await page
        .locator('#terminal-dock-heading')
        .innerText()
        .then((t) => t.includes(outsidePath)),
      allSessionsControls: await page
        .getByRole('button', { name: /All sessions|Clear mission|Show all sessions/i })
        .count(),
    });
    await page.screenshot({ path: capture('mission-scope') });
    // A separate UI destination exposes the row, but returning to Sessions overrides it.
    await page.getByRole('button', { name: 'Attention', exact: true }).click();
    await sessionOption(page, outside.id).click();
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    record('S10-attention-return', {
      outsideSelected: await page
        .locator('#terminal-dock-heading')
        .innerText()
        .then((t) => t.includes(outsidePath)),
      liveIds: (await app.liveSessions()).map((s) => s.id),
    });
  } finally {
    await teardown(app, ...dirs);
  }
});
