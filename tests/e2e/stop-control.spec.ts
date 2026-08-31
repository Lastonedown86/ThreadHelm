/** T067 — interrupt/stop target exactness, force-stop escalation, close blocking. */

import { expect, test } from '@playwright/test';
import { FORCE_STOP_RISK } from '@threadhelm/contracts';
import {
  approveViaUi,
  launchViaUi,
  launchWithFixtures,
  sessionOption,
  teardown,
  tempWorkspace,
  terminalRows,
  stopViaUi,
} from './helpers/ui.js';

test('stop status clears on completion and never follows selection to another session', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'ignore-interrupt' });
  const dirA = tempWorkspace('stop-status-a');
  const dirB = tempWorkspace('stop-status-b');
  const page = app.page;
  try {
    const a = await launchViaUi(app, 'codex-cli', await approveViaUi(app, dirA));
    const b = await launchViaUi(app, 'claude-code', await approveViaUi(app, dirB));
    await page.getByRole('button', { name: 'Stop…', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Stop this session?' })
      .getByRole('button', { name: 'Stop session', exact: true })
      .click();
    await expect(page.locator('.control-status')).toContainText('Stop requested');
    await sessionOption(page, a).click();
    await expect(page.locator('.control-status')).toBeEmpty();
    await expect(sessionOption(page, a)).toContainText('Running');
    await expect(terminalRows(page)).toContainText('FAKE_AGENT_READY');
    await page.getByRole('button', { name: 'Interrupt', exact: true }).click();
    await expect(page.locator('.control-status')).toContainText('returned to an interactive state');
    await stopViaUi(app, a);
    await expect(page.locator('.control-status')).toBeEmpty();
    await expect(page.getByRole('button', { name: 'Stop…', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Force stop…', exact: true })).toBeDisabled();
    await expect(sessionOption(page, b)).toContainText('Stopping');
  } finally {
    await teardown(app, dirA, dirB);
  }
});

test('interrupt, stop, force stop act on the displayed target only; close is blocked', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'ignore-interrupt' });
  const dirA = tempWorkspace('thm a');
  const dirB = tempWorkspace('thm b');
  const page = app.page;
  try {
    const pathA = await approveViaUi(app, dirA);
    const pathB = await approveViaUi(app, dirB);
    const a = await launchViaUi(app, 'codex-cli', pathA);
    const b = await launchViaUi(app, 'claude-code', pathB);

    // Interrupt A: least-destructive, observed result reported, A stays running.
    await sessionOption(page, a).click();
    await expect(terminalRows(page)).toContainText('FAKE_AGENT_READY', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Interrupt' }).click();
    await expect(terminalRows(page)).toContainText('INTERRUPTED', { timeout: 15_000 });
    // Observed outcome is durable: interrupting → running with INTERRUPT_HANDLED.
    await expect
      .poll(
        async () =>
          (
            await app.call<{ reasonCode: string | null }[]>('sessions.events', { sessionId: a })
          ).map((e) => e.reasonCode),
        { timeout: 15_000 },
      )
      .toContain('INTERRUPT_HANDLED');
    await expect(page.locator('.control-status')).toContainText('returned to an interactive state');
    await expect(sessionOption(page, a)).toContainText('Running');
    await expect(sessionOption(page, b)).toContainText('Running');

    // Stop B: disclosure names B exactly.
    await sessionOption(page, b).click();
    await page.getByRole('button', { name: 'Stop…', exact: true }).click();
    const stopDialog = page.getByRole('dialog', { name: 'Stop this session?' });
    await expect(stopDialog).toContainText('Claude Code');
    await expect(stopDialog).toContainText(pathB);
    await expect(stopDialog).not.toContainText(pathA);
    await stopDialog.getByRole('button', { name: 'Stop session' }).click();
    await expect(sessionOption(page, b)).toContainText('Stopping', { timeout: 15_000 });
    await expect(sessionOption(page, b)).toContainText('force stop available', { timeout: 20_000 });

    // Force stop: separate explicit step with risk and scope size.
    await page.getByRole('button', { name: 'Force stop…' }).click();
    const forceDialog = page.getByRole('dialog', { name: 'Force stop this session?' });
    await expect(forceDialog).toContainText(FORCE_STOP_RISK);
    await expect(forceDialog).toContainText(/\d+ in the supervised scope/);
    await expect(forceDialog).toContainText(pathB);
    await forceDialog.getByRole('button', { name: 'Force stop now' }).click();
    await expect(sessionOption(page, b)).toContainText('Stopped', { timeout: 20_000 });
    await expect(page.locator('.control-status')).toBeEmpty();
    const list = await app.call<{ sessions: { id: string; stopKind: string | null }[] }>(
      'sessions.list',
    );
    expect(list.sessions.find((s) => s.id === b)?.stopKind).toBe('forced');
    await expect(sessionOption(page, a)).toContainText('Running');
    expect((await app.liveSessions()).map((s) => s.id)).toEqual([a]);

    // Close blocked while A is live: cancel keeps it open, stop-all exits.
    const blocked = await app.call<{ closing: boolean; activeSessions: { id: string }[] }>(
      'application.requestClose',
    );
    expect(blocked.closing).toBe(false);
    expect(blocked.activeSessions.map((s) => s.id)).toEqual([a]);
    const closeDialog = page.getByRole('dialog', { name: 'Sessions are still active' });
    await expect(closeDialog).toBeVisible();
    await expect(closeDialog).toContainText(pathA);
    await closeDialog.getByRole('button', { name: 'Cancel closing' }).click();
    await expect(closeDialog).toBeHidden();
    await expect(sessionOption(page, a)).toContainText('Running');

    await app.call('application.requestClose');
    await expect(closeDialog).toBeVisible();
    const closed = app.app.waitForEvent('close', { timeout: 60_000 });
    await closeDialog.getByRole('button', { name: 'Stop all sessions and exit' }).click();
    await closed;
  } finally {
    await teardown(app, dirA, dirB);
  }
});
