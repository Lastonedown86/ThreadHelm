import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { prepareFixtureMission } from './helpers/mission.js';
import {
  approveViaUi,
  launchViaUi,
  launchWithFixtures,
  sessionOption,
  stopViaUi,
  teardown,
  tempWorkspace,
} from './helpers/ui.js';

test('ended disclosure collapses selected records consistently across list and tabs', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('ended-a'), tempWorkspace('ended-b')];
  try {
    const a = await launchViaUi(app, 'codex-cli', await approveViaUi(app, dirs[0]!));
    const b = await launchViaUi(app, 'codex-cli', await approveViaUi(app, dirs[1]!));
    await stopViaUi(app, b);
    const page = app.page;
    const before = await app.liveSessions();
    await page.getByRole('button', { name: 'Hide 1 ended session', exact: true }).click();
    await expect(sessionOption(page, b)).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(1);
    await expect(sessionOption(page, a)).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('button', { name: 'Show 1 ended session', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(await app.liveSessions()).toEqual(before);
    await page.getByRole('button', { name: 'Show 1 ended session', exact: true }).click();
    await expect(page.getByRole('tab')).toHaveCount(2);
    await sessionOption(page, b).click();
    await expect(page.locator('#terminal-dock-heading')).toContainText(dirs[1]!);
    await stopViaUi(app, a);
    await page.getByRole('button', { name: 'Hide 2 ended sessions', exact: true }).click();
    await expect(page.getByRole('listbox', { name: 'Sessions' }).getByRole('option')).toHaveCount(
      0,
    );
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.locator('#terminal-dock-heading')).toHaveCount(0);
    await expect(page.getByText('No running sessions.', { exact: true })).toBeVisible();
    await page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-21-ended-collapsed.png',
    });
    const list = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
    expect(list.sessions).toHaveLength(2);
    expect(list.sessions.every((s) => s.lifecycleState === 'stopped')).toBe(true);
    await page.getByRole('button', { name: 'Attention', exact: true }).click();
    await page.getByRole('button', { name: 'Show 2 ended sessions', exact: true }).click();
    await sessionOption(page, b).click();
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await expect(sessionOption(page, b)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.locator('#terminal-dock-heading')).toContainText(dirs[1]!);
    expect((await app.call<OperationResponse<'sessions.list'>>('sessions.list')).sessions).toEqual(
      list.sessions,
    );
  } finally {
    await teardown(app, ...dirs);
  }
});

test('mission scope uses the same ended disclosure and reveals a failed selected session', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('ended-leader'), tempWorkspace('ended-worker')];
  try {
    const envelope = await prepareFixtureMission(app, dirs);
    const review = await app.call<OperationResponse<'missions.preview'>>('missions.preview', {
      envelope,
    });
    await app.call('missions.confirm', {
      previewToken: review.previewToken,
      boundaryConfirmation: true,
    });
    const page = app.page;
    await page.getByRole('option').filter({ hasText: envelope.objective }).click();
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const scope = page.getByRole('combobox', { name: 'Session scope', exact: true });
    await scope.selectOption('mission');
    await expect(page.getByRole('tab')).toHaveCount(2);
    const selectedPath = await page.locator('#terminal-dock-heading').innerText();
    const sessions = (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).sessions;
    const selected = sessions.find((s) => selectedPath.includes(s.workspaceDisplayPath))!;
    await app.failSession(selected.id);
    await expect(
      page.getByRole('button', { name: 'Hide 1 ended session', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { selected: true })).toContainText('Failed');
    const before = await app.liveSessions();
    const hide = page.getByRole('button', { name: 'Hide 1 ended session', exact: true });
    await hide.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab')).toHaveCount(1);
    await expect(page.getByRole('tab', { selected: true })).not.toContainText('Failed');
    await expect(page.locator('#terminal-dock-heading')).not.toContainText(
      selected.workspaceDisplayPath,
    );
    await scope.selectOption('all');
    await expect(page.getByRole('tab')).toHaveCount(1);
    await expect(sessionOption(page, selected.id)).toHaveCount(0);
    await page.getByRole('button', { name: 'Show 1 ended session', exact: true }).click();
    await sessionOption(page, selected.id).click();
    await scope.selectOption('mission');
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.getByRole('tab', { selected: true })).toContainText('Failed');
    expect(await app.liveSessions()).toEqual(before);
    expect(
      (await app.call<OperationResponse<'sessions.list'>>('sessions.list')).sessions.find(
        (s) => s.id === selected.id,
      )?.lifecycleState,
    ).toBe('failed');
  } finally {
    await teardown(app, ...dirs);
  }
});
