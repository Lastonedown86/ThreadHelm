/**
 * Workspace Recon — keyboard-and-mouse E2E journeys (Task 7).
 *
 * Selectors below are taken verbatim from
 * .superpowers/sdd/2026-09-02-workspace-recon/task-6-report.md, which lists
 * the renderer's exact user-visible strings. See that file's "Deviations from
 * the brief" note for why the heading is scoped by role rather than by id.
 *
 * Design: docs/superpowers/specs/2026-09-02-workspace-recon-design.md
 */

import { expect, test } from '@playwright/test';
import { BOUNDARY_WARNING } from '@threadhelm/contracts';
import { approveViaUi, launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';
import type { LaunchedApp } from './helpers/app.js';

/** Approves a fresh temp workspace through the real folder-approval UI. */
async function approveFixtureWorkspace(app: LaunchedApp): Promise<string> {
  const dir = tempWorkspace('recon');
  await approveViaUi(app, dir);
  return dir;
}

/** Reads the session list through the app's own operation — no UI polling. */
async function countLaunchedSessions(app: LaunchedApp): Promise<number> {
  const list = await app.call<{ sessions: unknown[] }>('sessions.list');
  return list.sessions.length;
}

test('approve, run recon, accept two roles, and name them yourself', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'recon' });
  const page = app.page;
  const dir = await approveFixtureWorkspace(app);
  try {
    await expect(page.getByText('No roster yet.')).toBeVisible();

    await page.getByRole('button', { name: 'Run recon' }).click();
    const launchDialog = page.getByRole('dialog', { name: 'Run recon' });
    await expect(launchDialog).toBeVisible();
    // The disclosed boundary warning, verbatim — no "read-only scan" wording.
    await expect(launchDialog.getByText(BOUNDARY_WARNING, { exact: true })).toBeVisible();
    // The shared LaunchDisclosureFacts rows (the F1 fix): the recon gate must
    // disclose the same resolved facts an ordinary launch does, not the old,
    // narrower five-fact list. Execution bounds is the load-bearing row — the
    // only ceiling ThreadHelm actually enforces — so pin its real, enforced
    // numbers rather than just the row's presence.
    await expect(launchDialog.getByText('Execution bounds', { exact: true })).toBeVisible();
    await expect(launchDialog).toContainText(
      '30 min · 64 turns · 5 min without progress · 8388608 output bytes · 1 contained processes',
    );
    await expect(launchDialog.getByText('Model', { exact: true })).toBeVisible();
    await expect(launchDialog.getByText('Effort', { exact: true })).toBeVisible();
    await expect(launchDialog.getByText('Runtime permission', { exact: true })).toBeVisible();
    await launchDialog.getByRole('checkbox').check();
    await launchDialog.getByRole('button', { name: 'Start recon' }).click();
    await expect(launchDialog).toBeHidden();

    await expect(page.getByText('Some files could not be read.')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('malformed.agent.json')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review' })).toHaveCount(4);
    await expect(page.getByRole('button', { name: /accept all/i })).toHaveCount(0);

    for (const name of ['Tony Stark', 'Rhodey']) {
      await page.getByRole('button', { name: 'Review' }).first().click();
      const reviewDialog = page.getByRole('dialog', { name: 'Review reviewed agent profile' });
      await expect(reviewDialog).toBeVisible();
      await reviewDialog.getByLabel('Display name').fill(name);
      await reviewDialog.getByRole('checkbox').check();
      await reviewDialog.getByRole('button', { name: 'Import profile' }).click();
      await expect(reviewDialog).toBeHidden();
    }

    // An accepted proposal becomes an ordinary agent profile — a separate
    // panel from the workspace's recon roster, exactly like any other import.
    await page.getByRole('button', { name: 'Agents', exact: true }).click();
    await expect(page.getByText('Tony Stark')).toBeVisible();
    await expect(page.getByText('Rhodey')).toBeVisible();
    await expect(page.getByText('Unnamed supervisor')).toHaveCount(0);
  } finally {
    await teardown(app, dir);
  }
});

test('a workspace opens with no recon and no provider contact', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'recon' });
  const page = app.page;
  const dir = await approveFixtureWorkspace(app);
  try {
    await expect(page.getByText('No roster yet.')).toBeVisible();
    expect(await countLaunchedSessions(app)).toBe(0);
  } finally {
    await teardown(app, dir);
  }
});
