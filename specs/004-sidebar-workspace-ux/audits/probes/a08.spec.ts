/** Baseline audit observations; not post-fix acceptance assertions. */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { version, release } from 'node:os';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp, launchFixtureSession } from '../../../../tests/e2e/helpers/app.js';
import {
  approveViaUi,
  launchWithFixtures,
  teardown,
  tempWorkspace,
  stopViaUi,
} from '../../../../tests/e2e/helpers/ui.js';
const evidence: Record<string, unknown>[] = [];
function record(id: string, data: Record<string, unknown>) {
  evidence.push({ id, ...data });
  writeFileSync(
    new URL('../evidence/ca2c620-settings.json', import.meta.url),
    JSON.stringify(evidence, null, 2) + '\n',
  );
}
const capture = (name: string) =>
  fileURLToPath(new URL(`../evidence/ca2c620-settings-${name}.png`, import.meta.url));

test('observe Settings approval, cancellation, revocation, reflow and pending approval', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [
    tempWorkspace('settings-audit-long-workspace-identity'),
    tempWorkspace('settings-pending'),
  ];
  try {
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    record('environment', {
      baseline: 'ca2c62015008fc29e71761a9a8e17b5dd5387f86',
      os: version(),
      release: release(),
      footer: await app.page.locator('.status-bar').innerText(),
      viewport: app.page.viewportSize(),
      fixtures: 'isolated local echo/recon adapters',
    });
    const choose = app.page.getByRole('button', { name: 'Choose folder…' });
    await app.setPickerPath(dirs[0]!);
    await choose.click();
    const modal = app.page.getByRole('dialog', { name: 'Approve this folder?' });
    await app.page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    record('S01-cancel', {
      saved: await app.call('workspaces.list'),
      focusReturned: await choose.evaluate((el) => el === document.activeElement),
      live: await app.liveSessions(),
    });
    await approveViaUi(app, dirs[0]!);
    const first = (await app.call<OperationResponse<'workspaces.list'>>('workspaces.list'))[0]!;
    await choose.click();
    await expect(modal.getByText('Effective folder', { exact: true })).toBeVisible();
    await modal.getByRole('button', { name: 'Approve folder' }).click();
    await expect(modal).toBeHidden();
    record('S02-duplicate-approval', {
      saved: await app.call('workspaces.list'),
      expectedId: first.id,
    });
    await app.page.setViewportSize({ width: 960, height: 800 });
    await app.page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const geometry = await app.page
      .locator('.guided-setup, .setup-check, .setup-evidence, .roster')
      .evaluateAll((nodes) =>
        nodes.map((el) => ({
          name: el.className,
          client: el.clientWidth,
          scroll: el.scrollWidth,
          right: el.getBoundingClientRect().right,
        })),
      );
    await app.page.screenshot({ path: capture('narrow') });
    record('S03-reflow', { width: 960, font: '200%', geometry });
    await app.page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
    await app.page.setViewportSize({ width: 1264, height: 800 });
    const liveSession = await launchFixtureSession(app, first.id, 'codex-cli');
    const liveBefore = await app.liveSessions();
    await app.page
      .getByRole('button', { name: `Revoke approval for ${first.displayPath}` })
      .click();
    await expect(
      app.page.getByRole('status').filter({ hasText: /session is still active/i }),
    ).toBeVisible();
    record('S04-live-revoke-denied', {
      saved: await app.call('workspaces.list'),
      liveBefore,
      liveAfter: await app.liveSessions(),
      notice: await app.page.getByRole('status').allTextContents(),
    });
    await app.page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await stopViaUi(app, liveSession.id);
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    await app.page
      .getByRole('button', { name: `Revoke approval for ${first.displayPath}` })
      .click();
    await expect(app.page.getByText('No folder approved yet.')).toBeVisible();
    record('S05-revoked', {
      saved: await app.call('workspaces.list'),
      live: await app.liveSessions(),
    });
    await app.setPickerPath(dirs[1]!);
    await choose.click();
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        releaseApproval?: () => void;
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
      };
      ipcMain.removeHandler('op:workspaces.approve');
      ipcMain.handle('op:workspaces.approve', async (_event, p: unknown) => {
        await new Promise<void>((resolve) => {
          g.releaseApproval = resolve;
        });
        return g.__threadhelmTest.dispatch('workspaces.approve', p);
      });
    });
    await modal.getByRole('button', { name: 'Approve folder' }).click();
    await expect
      .poll(() =>
        app.app.evaluate(() =>
          Boolean((globalThis as unknown as { releaseApproval?: () => void }).releaseApproval),
        ),
      )
      .toBe(true);
    const pending = {
      approveEnabled: await modal.getByRole('button', { name: 'Approve folder' }).isEnabled(),
      cancelEnabled: await modal.getByRole('button', { name: 'Cancel', exact: true }).isEnabled(),
    };
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toBeHidden();
    await app.app.evaluate(() =>
      (globalThis as unknown as { releaseApproval: () => void }).releaseApproval(),
    );
    await expect(
      app.page.getByRole('button', { name: `Revoke approval for ${dirs[1]}` }),
    ).toBeVisible();
    record('S06-pending-cancel', {
      pending,
      dialogClosed: true,
      savedAfterCancel: await app.call('workspaces.list'),
    });
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    record('S07-restart', {
      saved: await app.call('workspaces.list'),
      live: await app.liveSessions(),
    });
  } finally {
    await teardown(app, ...dirs);
  }
});

test('observe recon results, transient read failure, and restart', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'recon' });
  const dir = tempWorkspace('settings-recon');
  try {
    await approveViaUi(app, dir);
    const w = (await app.call<OperationResponse<'workspaces.list'>>('workspaces.list'))[0]!;
    await app.page.getByRole('button', { name: 'Run recon', exact: true }).click();
    const dialog = app.page.getByRole('dialog', { name: 'Run recon', exact: true });
    await expect(dialog.getByRole('checkbox')).toBeVisible();
    record('S08-recon-disclosure', {
      text: await dialog.innerText(),
      liveBefore: await app.liveSessions(),
    });
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Start recon', exact: true }).click();
    await expect(app.page.getByRole('button', { name: 'Review', exact: true })).toHaveCount(4, {
      timeout: 30000,
    });
    record('S09-recon-results', {
      run: await app.call('workspaceRecon.getRun', { workspaceId: w.id }),
      sessions: await app.call('sessions.list'),
      live: await app.liveSessions(),
    });
    await app.page.getByRole('button', { name: 'Review', exact: true }).first().click();
    const review = app.page.getByRole('dialog', { name: 'Review reviewed agent profile' });
    await review.getByRole('button', { name: 'Cancel', exact: true }).click();
    record('S09b-review-cancel', {
      profiles: await app.call('profiles.list', {}),
      run: await app.call('workspaceRecon.getRun', { workspaceId: w.id }),
    });
    await app.page.getByRole('button', { name: 'Review', exact: true }).first().click();
    await review.getByLabel('Display name').fill('Audit reviewed supervisor');
    await review.getByRole('checkbox').check();
    await review.getByRole('button', { name: 'Import profile', exact: true }).click();
    await expect(review).toBeHidden();
    await expect(app.page.getByRole('button', { name: 'Review', exact: true })).toHaveCount(3);
    record('S09c-reviewed-import', {
      profiles: await app.call('profiles.list', {}),
      run: await app.call('workspaceRecon.getRun', { workspaceId: w.id }),
      live: await app.liveSessions(),
    });
    await app.page.locator('.roster').scrollIntoViewIfNeeded();
    await app.page.screenshot({ path: capture('recon') });
    await app.app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('op:workspaceRecon.getRun');
      ipcMain.handle('op:workspaceRecon.getRun', () => ({
        ok: false,
        error: { code: 'STORAGE_DEGRADED', message: 'Audit roster read failed', details: {} },
      }));
    });
    await app.page.getByRole('button', { name: 'Missions', exact: true }).click();
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(app.page.locator('.roster')).toContainText('STORAGE_DEGRADED');
    record('S10-roster-read-failure', {
      text: await app.page.locator('.roster').innerText(),
      retryButtons: await app.page.getByRole('button', { name: /retry|refresh/i }).count(),
      authoritativeRun: await app.call('workspaceRecon.getRun', { workspaceId: w.id }),
    });
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    record('S11-recon-restart', {
      profiles: await app.call('profiles.list', {}),
      run: await app.call('workspaceRecon.getRun', { workspaceId: w.id }),
      text: await app.page.locator('.roster').innerText(),
      sessions: await app.call('sessions.list'),
      live: await app.liveSessions(),
    });
  } finally {
    await teardown(app, dir);
  }
});

test('observe prerequisite return, cached readiness and owner-stopped recon', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('settings-return');
  try {
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await app.page.getByRole('button', { name: 'Go to Settings', exact: true }).click();
    await approveViaUi(app, dir);
    const w = (await app.call<OperationResponse<'workspaces.list'>>('workspaces.list'))[0]!;
    await app.page.getByRole('button', { name: 'Missions', exact: true }).click();
    record('S12-prerequisite-return', {
      text: await app.page.locator('#mission-workspace').innerText(),
      workspaceId: w.id,
      live: await app.liveSessions(),
    });
    const ready =
      await app.call<OperationResponse<'providers.listReadiness'>>('providers.listReadiness');
    await app.app.evaluate(({ ipcMain }, snapshots) => {
      const g = globalThis as unknown as { readinessReads: number };
      g.readinessReads = 0;
      ipcMain.removeHandler('op:providers.listReadiness');
      ipcMain.handle('op:providers.listReadiness', () => {
        g.readinessReads++;
        return {
          ok: true,
          value: snapshots.map((r) => ({
            ...r,
            availability: 'missing',
            safeSummary: 'Audit cached missing provider',
          })),
        };
      });
    }, ready);
    await app.page.reload();
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(app.page.getByText('Audit cached missing provider').first()).toBeVisible();
    await app.page.getByRole('button', { name: 'Missions', exact: true }).click();
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    record('S13-cached-readiness', {
      actualFixtureReadiness: ready,
      renderer: await app.page.locator('[aria-labelledby="providers-heading"]').innerText(),
      readinessReads: await app.app.evaluate(
        () => (globalThis as unknown as { readinessReads: number }).readinessReads,
      ),
      refreshControls: await app.page
        .getByRole('button', { name: /refresh|retry|recheck/i })
        .count(),
    });
    await app.call('providers.listReadiness'); // Main hook dispatch bypasses the renderer-only injected stale response.
    await expect(app.page.getByText('Available', { exact: true }).first()).toBeVisible();
    await app.page.getByRole('button', { name: 'Run recon', exact: true }).click();
    const modal = app.page.getByRole('dialog', { name: 'Run recon', exact: true });
    await modal.getByRole('checkbox').check();
    await modal.getByRole('button', { name: 'Start recon', exact: true }).click();
    await expect(modal).toBeHidden();
    const run = await app.call<OperationResponse<'workspaceRecon.getRun'>>(
      'workspaceRecon.getRun',
      { workspaceId: w.id },
    );
    await app.page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await stopViaUi(app, run!.sessionId!);
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(app.page.locator('.roster')).not.toContainText('Recon is running.');
    record('S14-owner-stop', {
      before: run,
      after: await app.call('workspaceRecon.getRun', { workspaceId: w.id }),
      sessions: await app.call('sessions.list'),
      live: await app.liveSessions(),
      text: await app.page.locator('.roster').innerText(),
    });
  } finally {
    await teardown(app, dir);
  }
});
