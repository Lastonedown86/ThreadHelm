import { expect, test } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { prepareFixtureMission } from './helpers/mission.js';
import {
  approveViaUi,
  launchWithFixtures,
  sessionOption,
  teardown,
  tempWorkspace,
} from './helpers/ui.js';

test('explicit session scope reveals launches and preserves exact selections without changing live processes', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [
    tempWorkspace('scope-leader'),
    tempWorkspace('scope-worker'),
    tempWorkspace('scope-outside'),
  ];
  const page = app.page;
  try {
    const envelope = await prepareFixtureMission(app, dirs.slice(0, 2));
    const preview = await app.call<OperationResponse<'missions.preview'>>('missions.preview', {
      envelope,
    });
    await app.call('missions.confirm', {
      previewToken: preview.previewToken,
      boundaryConfirmation: true,
    });
    await app.call('providers.listReadiness');
    await page.getByRole('option').filter({ hasText: envelope.objective }).click();
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const scope = page.getByRole('combobox', { name: 'Session scope', exact: true });
    await expect(scope).toHaveValue('all');
    await scope.selectOption('mission');
    await expect(page.getByRole('tab')).toHaveCount(2);
    const before = await app.liveSessions();

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
    const after = await app.liveSessions();
    const outside = after.find((s) => !before.some((b) => b.id === s.id))!;
    await expect(scope).toHaveValue('all');
    await expect(sessionOption(page, outside.id)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#terminal-dock-heading')).toContainText(outsidePath);
    await expect(page.getByRole('tab')).toHaveCount(3);
    await page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-2-session-scope.png',
    });

    await scope.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-2-scope-control.png',
    });
    await scope.selectOption('mission');
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.locator('#terminal-dock-heading')).not.toContainText(outsidePath);
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await expect(scope).toHaveValue('all');
    await expect(page.getByRole('tab')).toHaveCount(3);
    await page.getByRole('button', { name: 'Attention', exact: true }).click();
    await sessionOption(page, outside.id).click();
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await expect(page.locator('#terminal-dock-heading')).toContainText(outsidePath);
    await expect(sessionOption(page, outside.id)).toHaveAttribute('aria-selected', 'true');
    expect(await app.liveSessions()).toEqual(after);
  } finally {
    await teardown(app, ...dirs);
  }
});

test('without a mission the global scope remains usable and mission scope is unavailable', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  try {
    await app.page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const scope = app.page.getByRole('combobox', { name: 'Session scope', exact: true });
    await expect(scope).toHaveValue('all');
    await expect(scope.locator('option[value="mission"]')).toHaveJSProperty('disabled', true);
    await scope.focus();
    await app.page.keyboard.press('ArrowDown');
    await expect(scope).toHaveValue('all');
    await expect(app.page.getByRole('heading', { name: 'No attached sessions' })).toBeVisible();
    await expect(
      app.page.getByRole('button', { name: 'Choose folder', exact: false }),
    ).toBeVisible();
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app);
  }
});
