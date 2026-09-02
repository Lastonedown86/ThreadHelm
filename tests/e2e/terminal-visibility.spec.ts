/**
 * A selected session's terminal must be on screen. The mission workspace
 * scrolls, and xterm pauses its renderer while the screen element is outside
 * the viewport: a dock left below the fold keeps filling its buffer and paints
 * nothing, so the user watches a dead terminal.
 */

import { expect, test } from '@playwright/test';
import {
  approveViaUi,
  launchViaUi,
  launchWithFixtures,
  sessionOption,
  teardown,
  tempWorkspace,
  terminalRows,
} from './helpers/ui.js';

/** Short enough that the terminal dock starts below the workspace fold. */
const SHORT_WINDOW = { width: 1280, height: 620 };

test('a selected session keeps its terminal on screen on a short window', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const dirA = tempWorkspace('thm a');
  const dirB = tempWorkspace('thm b');
  const page = app.page;
  try {
    await app.app.evaluate(({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]!.setSize(size.width, size.height);
    }, SHORT_WINDOW);
    const pathA = await approveViaUi(app, dirA);
    const pathB = await approveViaUi(app, dirB);
    // The workspace must actually overflow, or the terminal cannot be below the fold.
    const overflows = await page.evaluate(() => {
      const scroller = document.querySelector('.mission-shell-workspace')!;
      return scroller.scrollHeight > scroller.clientHeight;
    });
    expect(overflows).toBe(true);

    const a = await launchViaUi(app, 'codex-cli', pathA);
    // Launching selects the new session; its terminal must be visible, not parked
    // below the fold where xterm never repaints it.
    await expect(terminalRows(page)).toBeInViewport();
    await app.call('sessions.sendInput', {
      sessionId: a,
      bytes: new TextEncoder().encode('alpha\r'),
    });
    await expect(terminalRows(page)).toContainText('ECHO:alpha', { timeout: 30_000 });

    // Selection changes, not only first mount: scroll away, then pick the other
    // session and expect its terminal to be brought back into view and painting.
    const b = await launchViaUi(app, 'claude-code', pathB);
    await page.evaluate(() => {
      document.querySelector('.mission-shell-workspace')!.scrollTop = 0;
    });
    await sessionOption(page, a).click();
    await expect(sessionOption(page, a)).toHaveAttribute('aria-selected', 'true');
    await expect(terminalRows(page)).toBeInViewport();
    await app.call('sessions.sendInput', {
      sessionId: a,
      bytes: new TextEncoder().encode('bravo\r'),
    });
    await expect(terminalRows(page)).toContainText('ECHO:bravo', { timeout: 30_000 });
    expect(b).not.toBe(a);
  } finally {
    await teardown(app, dirA, dirB);
  }
});
