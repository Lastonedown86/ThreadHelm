/** T078 — honest recovery after a coordinator crash; no relaunch, no replay. */

import { expect, test } from '@playwright/test';
import { isPidAlive, launchApp, waitForPidExit } from './helpers/app.js';
import {
  approveViaUi,
  launchViaUi,
  launchWithFixtures,
  sessionOption,
  stopViaUi,
  teardown,
  tempWorkspace,
} from './helpers/ui.js';

test('crash → restart shows recovery records with explicit next actions', async () => {
  const first = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const dirA = tempWorkspace('thm a');
  const dirB = tempWorkspace('thm b');
  const dirC = tempWorkspace('thm c');
  let second = first;
  try {
    const pathA = await approveViaUi(first, dirA);
    const pathB = await approveViaUi(first, dirB);
    const pathC = await approveViaUi(first, dirC);
    const clean = await launchViaUi(first, 'codex-cli', pathC);
    await stopViaUi(first, clean);
    const a = await launchViaUi(first, 'codex-cli', pathA);
    const b = await launchViaUi(first, 'claude-code', pathB);
    const pids = [
      ...(await first.jobSnapshot(a))!.processIds,
      ...(await first.jobSnapshot(b))!.processIds,
    ];
    expect(pids.length).toBeGreaterThanOrEqual(4);

    // Coordinator dies with no cleanup: Windows closes the job handles.
    // A hard TerminateProcess from outside, not process.exit: the hook's
    // process.exit(137) still lets utility 'exit' events run and persist
    // `failed` (HOST_EXITED) before main dies, which is not a crash.
    // `app.process()` is Playwright's `node electron/cli.js` wrapper, so ask
    // the browser process for its own pid before terminating it.
    const mainPid = await first.app.evaluate(() => process.pid);
    process.kill(mainPid, 'SIGKILL');
    expect(await waitForPidExit(mainPid, 20_000)).toBe(true);
    for (const pid of pids) expect(await waitForPidExit(pid, 10_000), `pid ${pid}`).toBe(true);

    second = await launchApp({ userData: first.userData });
    const page = second.page;
    expect(await second.liveSessions()).toHaveLength(0);
    for (const pid of pids) expect(isPidAlive(pid)).toBe(false);

    const panel = page.getByRole('region', { name: 'Needs attention' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('ThreadHelm ended unexpectedly')).toHaveCount(2);
    await expect(panel).toContainText(pathA);
    await expect(panel).toContainText(pathB);
    await expect(sessionOption(page, a)).toContainText('Recovery required');
    await expect(sessionOption(page, b)).toContainText('Recovery required');
    await expect(sessionOption(page, clean)).toContainText('Stopped');

    // Dismiss A's record → A becomes stopped, record resolved.
    const recordA = panel.locator('li', { hasText: pathA });
    await recordA.getByRole('button', { name: 'Dismiss' }).click();
    await expect(sessionOption(page, a)).toContainText('Stopped', { timeout: 15_000 });
    await expect(panel.locator('li', { hasText: pathA })).toHaveCount(0);

    // Start new session from B's record → disclosure for the same target, then supersede.
    await second.useFixtureAdapters({ 'claude-code': 'echo' });
    await second.call('providers.listReadiness');
    await panel
      .locator('li', { hasText: pathB })
      .getByRole('button', { name: 'Start new session' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Review this launch' });
    await expect(dialog).toContainText('Claude Code');
    await expect(dialog).toContainText(pathB);
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Launch session' }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(panel).toBeHidden();
    const live = await second.liveSessions();
    expect(live).toHaveLength(1);
    expect(live[0]!.id).not.toBe(b);
    const list = await second.call<{
      sessions: { id: string; lifecycleState: string }[];
      recoveryRecords: unknown[];
    }>('sessions.list');
    expect(list.recoveryRecords).toHaveLength(0);
    expect(list.sessions.find((s) => s.id === b)?.lifecycleState).toBe('stopped');
    await stopViaUi(second, live[0]!.id);
  } finally {
    await teardown(second, dirA, dirB, dirC);
  }
});
