/** T053 — multi-session input routing, attribution, and activity indicators. */

import { expect, test } from '@playwright/test';
import {
  approveViaUi,
  launchViaUi,
  launchWithFixtures,
  sessionOption,
  sessionOptions,
  stopViaUi,
  teardown,
  tempWorkspace,
  terminalRows,
} from './helpers/ui.js';

test('two sessions keep input, output, identity, and attention isolated', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const dirA = tempWorkspace('thm a');
  const dirB = tempWorkspace('thm b');
  const page = app.page;
  try {
    const pathA = await approveViaUi(app, dirA);
    const pathB = await approveViaUi(app, dirB);
    const a = await launchViaUi(app, 'codex-cli', pathA);
    const b = await launchViaUi(app, 'claude-code', pathB);

    // Distinct identity in the list.
    await expect(sessionOption(page, a)).toContainText('Codex CLI');
    await expect(sessionOption(page, a)).toContainText(pathA);
    await expect(sessionOption(page, b)).toContainText('Claude Code');
    await expect(sessionOption(page, b)).toContainText(pathB);
    await expect(sessionOption(page, a)).toContainText('activity Unknown');
    await expect(sessionOption(page, b)).toContainText('activity Unknown');

    // Input goes only to the selected session.
    await sessionOption(page, a).click();
    await expect(terminalRows(page)).toContainText('FAKE_AGENT_READY', { timeout: 30_000 });
    await page.locator('.xterm-helper-textarea').focus();
    await page.keyboard.type('alpha');
    await page.keyboard.press('Enter');
    await expect(terminalRows(page)).toContainText('ECHO:alpha', { timeout: 15_000 });

    await sessionOption(page, b).click();
    await expect(sessionOption(page, b)).toHaveAttribute('aria-selected', 'true');
    await expect(terminalRows(page)).toContainText('FAKE_AGENT_READY', { timeout: 30_000 });
    await expect(terminalRows(page)).not.toContainText('ECHO:alpha');
    await page.locator('.xterm-helper-textarea').focus();
    await page.keyboard.type('bravo');
    await page.keyboard.press('Enter');
    await expect(terminalRows(page)).toContainText('ECHO:bravo', { timeout: 15_000 });
    await expect(terminalRows(page)).not.toContainText('ECHO:alpha');

    // Output on the non-selected session (A) raises its badge; selecting clears it.
    await app.call('sessions.select', { sessionId: a });
    await app.call('sessions.sendInput', {
      sessionId: a,
      bytes: new TextEncoder().encode('ping\r'),
    });
    await expect(sessionOption(page, a)).toContainText('new output', { timeout: 15_000 });
    await expect(sessionOption(page, b)).not.toContainText('new output');
    await sessionOption(page, a).click();
    await expect(sessionOption(page, a)).not.toContainText('new output');
    await expect(terminalRows(page)).toContainText('ECHO:ping');
    await expect(terminalRows(page)).not.toContainText('ECHO:bravo');

    // Arrow keys move the listbox selection.
    await page.getByRole('listbox', { name: 'Sessions' }).focus();
    await page.keyboard.press('End');
    const last = sessionOptions(page).last();
    await expect(last).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(sessionOptions(page).first()).toHaveAttribute('aria-selected', 'true');
    await expect(last).toHaveAttribute('aria-selected', 'false');

    await stopViaUi(app, a);
    await expect(sessionOption(page, b)).toContainText('Running');
    await stopViaUi(app, b);
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await teardown(app, dirA, dirB);
  }
});
