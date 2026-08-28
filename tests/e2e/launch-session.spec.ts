/** T034 — approve, disclose, launch through the real UI. */

import { expect, test } from '@playwright/test';
import { BOUNDARY_WARNING } from '@threadhelm/contracts';
import {
  sessionOption,
  stopViaUi,
  teardown,
  tempWorkspace,
  terminalRows,
  launchWithFixtures,
} from './helpers/ui.js';
import { PROVIDER_NAME } from './helpers/ui.js';

test('approve → disclose → launch journey', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace();
  const page = app.page;
  try {
    // Choose: the candidate disclosure shows selected and effective paths.
    await app.setPickerPath(dir);
    await page.getByRole('button', { name: 'Choose folder…' }).click();
    const approveDialog = page.getByRole('dialog', { name: 'Approve this folder?' });
    await expect(approveDialog).toBeVisible();
    await expect(approveDialog.getByText('Selected', { exact: true })).toBeVisible();
    await expect(approveDialog.getByText('Effective folder')).toBeVisible();
    await expect(approveDialog).toContainText(dir);
    await approveDialog.getByRole('button', { name: 'Approve folder' }).click();
    await expect(approveDialog).toBeHidden();

    const [workspace] = await app.call<{ id: string; displayPath: string }[]>('workspaces.list');
    const displayPath = workspace!.displayPath;
    await expect(
      page.getByRole('button', { name: `Revoke approval for ${displayPath}` }),
    ).toBeVisible();
    await expect(page.getByText('Available').first()).toBeVisible();

    // Disclosure: effective path, agent, version, boundary warning; Launch gated on the checkbox.
    await page
      .getByRole('button', { name: `Launch ${PROVIDER_NAME['codex-cli']} in ${displayPath}` })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Review this launch' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(displayPath);
    await expect(dialog).toContainText('Codex CLI 1.0.0');
    await expect(dialog).toContainText(BOUNDARY_WARNING);
    const launch = dialog.getByRole('button', { name: 'Launch session' });
    await expect(launch).toBeDisabled();
    await dialog.getByRole('checkbox').check();
    await expect(launch).toBeEnabled();
    await launch.click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    const [live] = await app.liveSessions();
    const option = sessionOption(page, live!.id);
    await expect(option).toContainText('Codex CLI');
    await expect(option).toContainText(displayPath);
    await expect(option).toContainText('Running');
    await expect(terminalRows(page)).toContainText('FAKE_AGENT_READY', { timeout: 30_000 });

    // One-writer rule: same effective workspace while live → WRITE_LEASE_HELD.
    await page
      .getByRole('button', { name: `Launch ${PROVIDER_NAME['codex-cli']} in ${displayPath}` })
      .click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText('WRITE_LEASE_HELD');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Revoke while active → WORKSPACE_ACTIVE.
    await page.getByRole('button', { name: `Revoke approval for ${displayPath}` }).click();
    await expect(page.getByRole('status')).toContainText(/session|folder/i);
    await expect(
      page.getByRole('button', { name: `Revoke approval for ${displayPath}` }),
    ).toBeVisible();

    await stopViaUi(app, live!.id);
    expect(await app.liveSessions()).toHaveLength(0);

    // A second launch never inherits the earlier confirmation.
    await page
      .getByRole('button', { name: `Launch ${PROVIDER_NAME['codex-cli']} in ${displayPath}` })
      .click();
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Launch session' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  } finally {
    await teardown(app, dir);
  }
});
