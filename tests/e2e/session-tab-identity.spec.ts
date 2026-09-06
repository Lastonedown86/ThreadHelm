import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import {
  approveViaUi,
  launchViaUi,
  launchWithFixtures,
  teardown,
  tempWorkspace,
} from './helpers/ui.js';

test('same-provider tabs identify exact sessions and support keyboard panel navigation', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('tab-a'), tempWorkspace('tab-b')];
  for (const dir of dirs) mkdirSync(join(dir, 'worker'));
  try {
    const path = await approveViaUi(app, join(dirs[0]!, 'worker'));
    const a = await launchViaUi(app, 'codex-cli', path);
    const b = await launchViaUi(
      app,
      'codex-cli',
      await approveViaUi(app, join(dirs[1]!, 'worker')),
    );
    const page = app.page;
    const tabs = page.getByRole('tablist', { name: 'All sessions' });
    const first = tabs.getByRole('tab').nth(0);
    const last = tabs.getByRole('tab').nth(1);
    const firstId = (await first.getAttribute('id'))!.replace('session-tab-', '');
    const lastId = (await last.getAttribute('id'))!.replace('session-tab-', '');
    expect(new Set([firstId, lastId])).toEqual(new Set([a, b]));
    await expect(first).toContainText(firstId.slice(0, 8));
    await expect(last).toContainText(lastId.slice(0, 8));
    await expect(tabs.locator('[tabindex="0"]')).toHaveCount(1);
    const before = await app.liveSessions();
    await last.focus();
    await page.keyboard.press('ArrowRight');
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`#terminal-${firstId} .xterm`)).toBeVisible();
    await page.keyboard.press('End');
    await expect(last).toBeFocused();
    await page.keyboard.press('Home');
    await expect(first).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(last).toBeFocused();
    await expect(last).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`#terminal-${lastId} .xterm`)).toBeVisible();
    const panelId = await last.getAttribute('aria-controls');
    await expect(page.locator(`#${panelId}`)).toHaveAttribute('role', 'tabpanel');
    await expect(page.locator(`#${panelId}`)).toHaveAttribute(
      'aria-labelledby',
      (await last.getAttribute('id')) as string,
    );
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect(page.locator('[role="tabpanel"]')).toHaveCount(2);
    expect(
      await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
        return ids.filter((id, index) => ids.indexOf(id) !== index);
      }),
    ).toEqual([]);
    await expect(last).toBeInViewport();
    await tabs.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-22-session-tabs.png',
    });
    expect(await app.liveSessions()).toEqual(before);
  } finally {
    await teardown(app, ...dirs);
  }
});
