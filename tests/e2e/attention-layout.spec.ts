import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { fileURLToPath } from 'node:url';
import { launchApp, approveFolder, launchFixtureSession, waitForPidExit } from './helpers/app.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('Attention reflows long recovery identities and keeps exact dismissal usable', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('attention-layout-long-unbroken-workspace-identity-for-recovery');
  try {
    const workspace = await approveFolder(app, dir);
    await launchFixtureSession(app, workspace.id, 'codex-cli');
    const userData = app.userData;
    const pid = await app.app.evaluate(() => process.pid);
    process.kill(pid, 'SIGKILL');
    expect(await waitForPidExit(pid, 20000)).toBe(true);
    app = await launchApp({ userData });
    await app.page.getByRole('button', { name: 'Attention', exact: true }).click();
    const detail = app.page.locator('.recovery-detail');
    await expect(detail).toBeVisible();
    const before = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
    const record = before.recoveryRecords[0]!;
    await expect(detail).toContainText(record.id);
    for (const [width, font] of [
      [960, 200],
      [1264, 100],
      [1264, 200],
      [680, 100],
      [680, 200],
    ]) {
      await app.page.setViewportSize({ width: width!, height: 800 });
      await app.page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}%`;
      }, font);
      const overflow = await app.page
        .locator(
          '.mission-shell-rail, .recovery-attention-workspace, .recovery-attention-grid, .recovery-detail, .recovery-queue',
        )
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            name: node.className,
            overflow: node.scrollWidth - node.clientWidth,
            right: node.getBoundingClientRect().right,
          })),
        );
      for (const item of overflow) {
        expect(item.overflow, `${width}/${font}: ${item.name}`).toBeLessThanOrEqual(1);
        expect(item.right, `${width}/${font}: ${item.name}`).toBeLessThanOrEqual(width!);
      }
      await expect(detail).toContainText(dir);
    }
    await app.page.setViewportSize({ width: 960, height: 800 });
    await app.page.locator('.mission-shell-workspace').evaluate((node) => {
      node.scrollTop = 0;
    });
    await app.page.screenshot({
      path: fileURLToPath(
        new URL(
          '../../specs/004-sidebar-workspace-ux/audits/evidence/slice-10-attention-200.png',
          import.meta.url,
        ),
      ),
    });
    const dismiss = detail.getByRole('button', { name: 'Dismiss', exact: true });
    await dismiss.scrollIntoViewIfNeeded();
    await app.page.screenshot({
      path: fileURLToPath(
        new URL(
          '../../specs/004-sidebar-workspace-ux/audits/evidence/slice-10-attention-detail-200.png',
          import.meta.url,
        ),
      ),
    });
    await dismiss.focus();
    await app.page.keyboard.press('Enter');
    await expect(detail).toHaveCount(0);
    const after = await app.call<OperationResponse<'sessions.list'>>('sessions.list');
    expect(after.recoveryRecords).toHaveLength(0);
    expect(after.sessions.find((s) => s.id === record.sessionId)?.lifecycleState).toBe('stopped');
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, dir);
  }
});
