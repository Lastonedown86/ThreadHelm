import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { approveViaUi, launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('recon explains temporary proposals before launch and distinguishes saved profiles after restart', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'recon', 'claude-code': 'echo' });
  const dir = tempWorkspace('proposal-lifetime');
  try {
    await approveViaUi(app, dir);
    const w = (await app.call<OperationResponse<'workspaces.list'>>('workspaces.list'))[0]!;
    const roster = app.page.locator('.roster');
    await expect(roster).toContainText('No recon run is loaded');
    await expect(roster).toContainText('exits or restarts');
    await app.page.getByRole('button', { name: 'Run recon', exact: true }).click();
    const launch = app.page.getByRole('dialog', { name: 'Run recon', exact: true });
    await expect(launch).toContainText('exits or restarts');
    await expect(launch).toContainText('Starting another recon run replaces');
    await expect(launch).toContainText('Imported profiles are saved in Agents');
    await launch.getByRole('checkbox').check();
    await launch.getByRole('button', { name: 'Start recon', exact: true }).click();
    await expect(roster.getByRole('button', { name: 'Review', exact: true })).toHaveCount(4);
    const before = await app.call<OperationResponse<'workspaceRecon.getRun'>>(
      'workspaceRecon.getRun',
      { workspaceId: w.id },
    );
    await roster.getByRole('button', { name: 'Review', exact: true }).first().click();
    const review = app.page.getByRole('dialog', { name: 'Review reviewed agent profile' });
    await review.getByLabel('Display name').fill('Saved lifecycle supervisor');
    await review.getByRole('checkbox').check();
    await review.getByRole('button', { name: 'Import profile', exact: true }).click();
    await expect(review).toBeHidden();
    await expect(roster.getByRole('button', { name: 'Review', exact: true })).toHaveCount(3);
    const profiles = await app.call<OperationResponse<'profiles.list'>>('profiles.list', {});
    expect(profiles.profiles).toHaveLength(1);
    expect(profiles.profiles[0]!.displayName).toBe('Saved lifecycle supervisor');
    const remaining = await app.call<OperationResponse<'workspaceRecon.getRun'>>(
      'workspaceRecon.getRun',
      { workspaceId: w.id },
    );
    expect(remaining!.runId).toBe(before!.runId);
    expect(remaining!.proposals).toHaveLength(3);
    await roster.getByRole('button', { name: 'Run recon', exact: true }).click();
    await launch.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await app.call('workspaceRecon.getRun', { workspaceId: w.id })).toEqual(remaining);
    const sessions = await app.call('sessions.list');
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(app.page.locator('.roster')).toContainText('No recon run is loaded');
    await expect(app.page.locator('.roster')).toContainText(
      'Imported profiles are saved in Agents',
    );
    expect(await app.call('workspaceRecon.getRun', { workspaceId: w.id })).toBeNull();
    expect(await app.call('profiles.list', {})).toEqual(profiles);
    expect(await app.call('sessions.list')).toEqual(sessions);
    expect(await app.liveSessions()).toEqual([]);
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    await expect(
      app.page.getByText('Saved lifecycle supervisor', { exact: true }).first(),
    ).toBeVisible();
  } finally {
    await teardown(app, dir);
  }
});
