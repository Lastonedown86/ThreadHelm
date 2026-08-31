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

    // Disclosure: effective path, agent, model, effort, version, and boundary warning.
    await page
      .getByRole('button', { name: `Launch ${PROVIDER_NAME['codex-cli']} in ${displayPath}` })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Review this launch' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(displayPath);
    await expect(dialog).toContainText('Codex CLI 1.0.0');
    const model = dialog.getByRole('combobox', { name: 'Model', exact: true });
    const effort = dialog.getByRole('combobox', { name: 'Effort', exact: true });
    const workType = dialog.getByRole('combobox', { name: 'Work type', exact: true });
    await expect(model).toHaveValue('');
    await expect(model.getByRole('option', { name: 'CLI default' })).toBeAttached();
    await expect(model.getByRole('option', { name: 'GPT-5.6 Luna' })).toBeAttached();
    await expect(model.getByRole('option', { name: 'Custom model…' })).toBeAttached();
    await expect(effort).toHaveValue('');
    await expect(workType).toHaveValue('general');
    await expect(dialog).toContainText('CLI default');
    await expect(dialog).toContainText('Model source');
    await expect(dialog).toContainText('Effort source');
    const launch = dialog.getByRole('button', { name: 'Launch session' });
    const boundary = dialog.getByRole('checkbox');
    await expect(launch).toBeDisabled();
    await boundary.check();
    await expect(launch).toBeEnabled();

    await workType.selectOption('test_authoring');
    await expect(dialog).toContainText('GPT-5.6 Luna at Low');
    await effort.selectOption('high');
    const escalationReason = dialog.getByRole('textbox', { name: 'Escalation reason' });
    await expect(escalationReason).toBeVisible();
    await expect(launch).toBeDisabled();
    await escalationReason.fill('Cross-provider regression needs deeper reasoning.');
    await expect(launch).toBeEnabled();
    await effort.selectOption('low');
    await expect(escalationReason).toHaveCount(0);

    // Model/effort are direct choices: they refresh the preview without a second gate.
    await model.selectOption('gpt-5.6-luna');
    await effort.selectOption('low');
    await expect(dialog.getByRole('button', { name: 'Review model and effort' })).toHaveCount(0);
    await expect(boundary).toBeChecked();
    await expect(dialog.locator('.facts')).toContainText('gpt-5.6-luna');
    await expect(dialog.locator('.facts')).toContainText('Low');
    await expect(launch).toBeEnabled();
    await expect(dialog).toContainText(BOUNDARY_WARNING);
    const processLimit = dialog.getByRole('spinbutton', {
      name: 'Contained process limit',
      exact: true,
    });
    await expect(processLimit).toHaveValue('1');
    await processLimit.fill('8');
    await expect(dialog.locator('.facts')).toContainText('8 contained processes');
    await expect(dialog.locator('.facts')).toContainText('8388608 output bytes');
    await expect(launch).toBeEnabled();
    // The starting record is emitted before a stream port exists. Hold host
    // readiness so a premature renderer subscription reliably reaches main.
    await app.delayNextHostReady(1_000);
    await launch.click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    const [live] = await app.liveSessions();
    const eligible = await app.call<
      { sessionId: string; executionBounds: { maxConcurrentProcesses: number } }[]
    >('missions.eligibleSessions');
    expect(
      eligible.find((session) => session.sessionId === live!.id)?.executionBounds
        .maxConcurrentProcesses,
    ).toBe(8);
    const option = sessionOption(page, live!.id);
    await expect(option).toContainText('Codex CLI');
    await expect(option).toContainText(displayPath);
    await expect(option).toContainText('Running');
    await expect(terminalRows(page)).toContainText('FAKE_AGENT_READY', { timeout: 30_000 });
    await expect(page.getByText(/The output stream for this session failed/)).toHaveCount(0);

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
    await expect(processLimit).toHaveValue('1');
    await expect(dialog.getByRole('button', { name: 'Launch session' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  } finally {
    await teardown(app, dir);
  }
});
