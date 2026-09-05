/**
 * UI-driven journeys on top of the hook harness. Hooks answer the picker and
 * swap providers for fixtures; everything else is real buttons and dialogs.
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProviderId } from '@threadhelm/contracts';
import type { FakeAgentMode } from '@threadhelm/test-fixtures';
import { cleanupUserData, launchApp, type LaunchedApp } from './app.js';

export const PROVIDER_NAME: Record<ProviderId, string> = {
  'codex-cli': 'Codex CLI',
  'claude-code': 'Claude Code',
};

export function tempWorkspace(tag = 'thm ünï 空間'): string {
  // mkdtempSync's random suffix draws per-character from [A-Za-z0-9], so it
  // occasionally lands all-uppercase (e.g. "W7KARK") and, once this path is
  // rendered in the workspace, trips assertNoRawReasonCode's raw-reason-code
  // guard (mission-focus-workspace.spec.ts), which requires every displayed
  // /^[A-Z][A-Z0-9_]{2,63}$/ token to be allowlisted UI copy. randomUUID() is
  // always lowercase hex, so build the leaf ourselves instead of lowercasing
  // mkdtempSync's output — that would also lowercase the tmpdir() prefix,
  // which on CI can hold real mixed-case path segments (e.g. RUNNER~1) that
  // must stay exactly as the OS reports them.
  const created = join(tmpdir(), `${tag}-${randomUUID()}`);
  mkdirSync(created);
  return created;
}

/** Launches the app with fixture providers and the readiness panel refreshed. */
export async function launchWithFixtures(
  modes: Partial<Record<ProviderId, FakeAgentMode>>,
  userData?: string,
): Promise<LaunchedApp> {
  const app = await launchApp(userData ? { userData } : {});
  // The renderer's initial load owns app info and the canonical readiness list.
  // Let it commit before fixture events, otherwise a fixture can make "Available"
  // visible while the startup load is still able to reorder providers and update
  // the footer during an idle-rendering assertion.
  await expect(app.page.locator('.status-bar')).toContainText('ThreadHelm v');
  await app.useFixtureAdapters(modes);
  // Readiness is fetched once at startup; re-probing emits readinessChanged
  // events that the renderer applies, so no reload is needed.
  await app.call('providers.listReadiness');
  await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(app.page.getByText('Available').first()).toBeVisible();
  await app.page.getByRole('button', { name: 'Missions', exact: true }).click();
  return app;
}

export function terminalRows(page: Page): Locator {
  return page.locator('.terminal-host:visible .xterm-rows');
}

/**
 * Brings the terminal into the window's viewport and returns its rows.
 *
 * xterm's RenderService watches the screen element with an IntersectionObserver
 * and pauses painting while it does not intersect the viewport: writes still
 * reach the buffer, but the DOM rows keep their last painted content until the
 * terminal comes back into view. The mission workspace scrolls, so a terminal
 * docked below the fold never repaints.
 *
 * Selecting a session now brings its terminal into view (TerminalPane), so a
 * spec that only selects needs nothing. This is for the specs that then scroll
 * somewhere else — clicking a session-list option, say, which Playwright scrolls
 * into view and which pushes the dock back below the fold — and still measure
 * output *appearing*. It restores what a user watching the terminal would see.
 */
export async function showTerminal(page: Page): Promise<Locator> {
  const rows = terminalRows(page);
  await rows.scrollIntoViewIfNeeded();
  return rows;
}

export function sessionOptions(page: Page): Locator {
  return page.getByRole('listbox', { name: 'Sessions' }).getByRole('option');
}

/**
 * New mission… → Skip the repo-idea screen, landing on a blank Outcome stage.
 * `keyboard` drives both steps with focus + Enter for keyboard-only journeys.
 */
export async function newMissionViaUi(page: Page, keyboard = false): Promise<void> {
  const create = page.getByRole('button', { name: 'New mission…', exact: true });
  const skip = page.getByRole('button', { name: /^Skip/ });
  if (keyboard) {
    await create.focus();
    await page.keyboard.press('Enter');
    await skip.focus();
    await page.keyboard.press('Enter');
  } else {
    await create.click();
    await skip.click();
  }
}

/** Choose folder… → Approve folder, returning the workspace's display path. */
export async function approveViaUi(app: LaunchedApp, dir: string): Promise<string> {
  const choose = app.page.getByRole('button', { name: 'Choose folder…' });
  if (!(await choose.isVisible())) {
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
  await app.setPickerPath(dir);
  await app.page.getByRole('button', { name: 'Choose folder…' }).click();
  const dialog = app.page.getByRole('dialog', { name: 'Approve this folder?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Effective folder')).toBeVisible();
  await dialog.getByRole('button', { name: 'Approve folder' }).click();
  await expect(dialog).toBeHidden();
  const workspaces =
    await app.call<{ selectedPath: string; displayPath: string }[]>('workspaces.list');
  return workspaces.find((w) => w.selectedPath === dir)!.displayPath;
}

/** Selects the "Launch in" workspace, opens the disclosure, confirms, launches. */
export async function launchViaUi(
  app: LaunchedApp,
  providerId: ProviderId,
  workspaceDisplayPath: string,
): Promise<string> {
  const page = app.page;
  const launchIn = page.getByLabel('Launch in');
  if (!(await launchIn.isVisible())) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
  await page.getByLabel('Launch in').selectOption({ label: workspaceDisplayPath });
  await page
    .getByRole('button', { name: `Launch ${PROVIDER_NAME[providerId]} in ${workspaceDisplayPath}` })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Review this launch' });
  await expect(dialog).toBeVisible();
  const checkbox = dialog.getByRole('checkbox');
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await dialog.getByRole('button', { name: 'Launch session' }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  const live = await app.liveSessions();
  return live[live.length - 1]!.id;
}

export function sessionOption(page: Page, sessionId: string): Locator {
  return page.locator(`#session-${sessionId}`);
}

export async function stopViaUi(app: LaunchedApp, sessionId: string): Promise<void> {
  await sessionOption(app.page, sessionId).click();
  await app.page.getByRole('button', { name: 'Stop…', exact: true }).click();
  const dialog = app.page.getByRole('dialog', { name: 'Stop this session?' });
  await dialog.getByRole('button', { name: 'Stop session' }).click();
  await expect(sessionOption(app.page, sessionId)).toContainText('Stopped', { timeout: 30_000 });
}

export async function teardown(app: LaunchedApp, ...dirs: string[]): Promise<void> {
  await app.close();
  cleanupUserData(app.userData);
  for (const dir of dirs) cleanupUserData(dir);
}
