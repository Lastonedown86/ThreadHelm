import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { approveViaUi, launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('roster retry preserves exact proposals through read failure, late reply and collection limits', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'recon' });
  const dir = tempWorkspace('roster-retry');
  try {
    await approveViaUi(app, dir);
    const workspace = (await app.call<OperationResponse<'workspaces.list'>>('workspaces.list'))[0]!;
    await app.page.getByRole('button', { name: 'Run recon', exact: true }).click();
    const launch = app.page.getByRole('dialog', { name: 'Run recon', exact: true });
    await launch.getByRole('checkbox').check();
    await launch.getByRole('button', { name: 'Start recon', exact: true }).click();
    const roster = app.page.locator('.roster');
    await expect(roster.getByRole('button', { name: 'Review', exact: true })).toHaveCount(4);
    const before = await app.call<OperationResponse<'workspaceRecon.getRun'>>(
      'workspaceRecon.getRun',
      { workspaceId: workspace.id },
    );
    const sessionsBefore = await app.call('sessions.list');
    await app.app.evaluate(({ ipcMain }, snapshot) => {
      const g = globalThis as unknown as {
        rosterMode: string;
        rosterCalls: number;
        releaseRoster?: () => void;
      };
      g.rosterMode = 'fail';
      g.rosterCalls = 0;
      ipcMain.removeHandler('op:workspaceRecon.getRun');
      ipcMain.handle('op:workspaceRecon.getRun', async () => {
        g.rosterCalls++;
        const mode = g.rosterMode;
        if (mode === 'fail' || (mode === 'pollfail' && g.rosterCalls > 1))
          return {
            ok: false,
            error: { code: 'STORAGE_DEGRADED', message: 'Fixture roster failure', details: {} },
          };
        if (mode === 'hold') {
          await new Promise<void>((resolve) => {
            g.releaseRoster = resolve;
          });
          return { ok: true, value: null };
        }
        return {
          ok: true,
          value:
            mode === 'pending' || mode === 'pollfail'
              ? { ...snapshot, outcome: null, proposals: [] }
              : snapshot,
        };
      });
    }, before);
    const reopen = async () => {
      await app.page.getByRole('button', { name: 'Missions', exact: true }).click();
      await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    };
    const mode = async (value: string) =>
      app.app.evaluate((_electron, next) => {
        const g = globalThis as unknown as { rosterMode: string; rosterCalls: number };
        g.rosterMode = next;
        g.rosterCalls = 0;
      }, value);
    await reopen();
    await expect(roster).toContainText('Could not load roster');
    await expect(roster).not.toContainText('No roster yet');
    await expect(roster.getByRole('button', { name: 'Run recon', exact: true })).toBeDisabled();
    const retry = roster.getByRole('button', { name: 'Retry roster', exact: true });
    await mode('hold');
    await retry.focus();
    await app.page.keyboard.press('Enter');
    await expect(roster).toContainText('Loading roster');
    await expect
      .poll(() =>
        app.app.evaluate(() =>
          Boolean((globalThis as unknown as { releaseRoster?: () => void }).releaseRoster),
        ),
      )
      .toBe(true);
    await mode('pass');
    await reopen();
    await expect(roster.getByRole('button', { name: 'Review', exact: true })).toHaveCount(4);
    await app.app.evaluate(() =>
      (globalThis as unknown as { releaseRoster: () => void }).releaseRoster(),
    );
    await expect(roster.getByRole('button', { name: 'Review', exact: true })).toHaveCount(4);
    for (const value of ['pending', 'pollfail']) {
      await mode(value);
      await reopen();
      await expect(retry).toBeVisible();
      await expect(roster).not.toContainText('Recon is running');
      expect(
        await app.app.evaluate(
          () => (globalThis as unknown as { rosterCalls: number }).rosterCalls,
        ),
      ).toBe(value === 'pending' ? 6 : 2);
      await expect(roster.getByRole('button', { name: 'Run recon', exact: true })).toBeDisabled();
      await mode('pass');
      await retry.click();
      await expect(roster.getByRole('button', { name: 'Review', exact: true })).toHaveCount(4);
      await expect(roster.getByRole('button', { name: 'Run recon', exact: true })).toBeEnabled();
    }
    expect(await app.call('workspaceRecon.getRun', { workspaceId: workspace.id })).toEqual(before);
    expect(await app.call('sessions.list')).toEqual(sessionsBefore);
    expect(await app.call('profiles.list', {})).toEqual({ profiles: [], nextCursor: null });
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, dir);
  }
});
