import { test, expect, type Locator } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('Settings and its disclosures reflow while exact approval and recheck remain usable', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const dir = tempWorkspace('settings-layout-long-unbroken-folder-identity');
  const capture = (name: string) =>
    fileURLToPath(
      new URL(
        `../../specs/004-sidebar-workspace-ux/audits/evidence/slice-15-${name}.png`,
        import.meta.url,
      ),
    );
  const fits = async (locator: Locator, width: number) => {
    for (const box of await locator.evaluateAll((nodes) =>
      nodes.map((node) => ({
        name: node.className,
        overflow: node.scrollWidth - node.clientWidth,
        left: node.getBoundingClientRect().left,
        right: node.getBoundingClientRect().right,
      })),
    )) {
      expect(box.overflow, box.name).toBeLessThanOrEqual(1);
      expect(box.left, box.name).toBeGreaterThanOrEqual(0);
      expect(box.right, box.name).toBeLessThanOrEqual(width);
    }
  };
  try {
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    await app.setPickerPath(dir);
    await app.page.getByRole('button', { name: 'Choose folder…' }).click();
    const approve = app.page.getByRole('dialog', { name: 'Approve this folder?' });
    await approve.getByRole('button', { name: 'Approve folder', exact: true }).click();
    await expect(approve).toBeHidden();
    const saved = await app.call<OperationResponse<'workspaces.list'>>('workspaces.list');
    for (const [width, font] of [
      [960, 200],
      [1264, 100],
      [1264, 200],
      [960, 100],
      [680, 100],
      [680, 200],
    ] as const) {
      await app.page.setViewportSize({ width, height: 800 });
      await app.page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}%`;
      }, font);
      await fits(
        app.page.locator(
          '.guided-setup, .setup-check, .setup-evidence, .roster, .guided-setup .panel',
        ),
        width,
      );
      await app.page.getByRole('button', { name: 'Choose folder…' }).click();
      await expect(approve).toContainText(dir);
      await fits(approve, width);
      await fits(approve.locator('.facts, .actions'), width);
      await app.page.keyboard.press('Escape');
      await expect(approve).toBeHidden();
      await app.page.getByRole('button', { name: 'Run recon', exact: true }).click();
      const recon = app.page.getByRole('dialog', { name: 'Run recon', exact: true });
      await expect(recon.getByRole('checkbox')).toBeVisible();
      await fits(recon, width);
      await fits(recon.locator('.facts, .actions'), width);
      await recon.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    await app.page.setViewportSize({ width: 960, height: 800 });
    await app.page.locator('.mission-shell-workspace').evaluate((node) => {
      node.scrollTop = 0;
    });
    await app.page.screenshot({ path: capture('settings-200') });
    const recheck = app.page.getByRole('button', { name: 'Check again', exact: true });
    await recheck.focus();
    await app.page.keyboard.press('Enter');
    await expect(
      app.page.getByRole('status').filter({ hasText: 'Provider check complete' }),
    ).toBeVisible();
    await app.page.getByRole('button', { name: 'Choose folder…' }).click();
    await approve
      .getByRole('button', { name: 'Approve folder', exact: true })
      .scrollIntoViewIfNeeded();
    await app.page.screenshot({ path: capture('approval-200') });
    await approve.getByRole('button', { name: 'Approve folder', exact: true }).focus();
    await app.page.keyboard.press('Enter');
    await expect(approve).toBeHidden();
    const after = await app.call<OperationResponse<'workspaces.list'>>('workspaces.list');
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(saved[0]!.id);
    expect(after[0]!.displayPath).toBe(dir);
    expect((await app.call<OperationResponse<'sessions.list'>>('sessions.list')).sessions).toEqual(
      [],
    );
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, dir);
  }
});
