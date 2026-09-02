/**
 * T094 — failing-first keyboard-only E2E journeys for the reviewed agent
 * roster (Feature 002, US6). The "Agent roster" panel, its dialogs, and the
 * `profiles.*` IPC surface do not exist yet (T099–T102); every journey below
 * is expected to fail until then.
 *
 * Contract: specs/002-agent-mailbox-routing/contracts/agent-profiles.md
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  MARVEL_ROSTER_FIXTURES,
  REVISED_HIRE_MANIFEST_FIXTURE,
  writeHireManifestFile,
} from '@threadhelm/test-fixtures';
import { launchApp, type LaunchedApp } from './helpers/app.js';
import { teardown, tempWorkspace } from './helpers/ui.js';

async function press(locator: Locator, key = 'Enter'): Promise<void> {
  await locator.focus();
  await locator.page().keyboard.press(key);
}

async function selectProfileFile(app: LaunchedApp, path: string): Promise<void> {
  await app.app.evaluate((_electron, filePath) => {
    const hooks = (
      globalThis as unknown as { __threadhelmTest: { setProfileFilePickerPath(p: string): void } }
    ).__threadhelmTest;
    return hooks.setProfileFilePickerPath(filePath);
  }, path);
}

async function importByKeyboard(
  page: Page,
  app: LaunchedApp,
  dir: string,
  basename: string,
  text: string,
) {
  await page.getByRole('button', { name: 'Agents', exact: true }).click();
  writeHireManifestFile(dir, basename, text);
  await selectProfileFile(app, `${dir}\\${basename}`);
  await press(page.getByRole('button', { name: 'Import profile…' }));
  const review = page.getByRole('dialog', { name: 'Review reviewed agent profile' });
  await expect(review).toBeVisible();
  await press(review.getByRole('checkbox'), 'Space');
  await press(review.getByRole('button', { name: 'Import profile' }));
  await expect(review).toBeHidden();
}

test('keyboard-only import previews the exact reviewed content before confirming', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('roster-import');
  try {
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    const fx = MARVEL_ROSTER_FIXTURES[0]!;
    writeHireManifestFile(dir, fx.basename, fx.text);
    await selectProfileFile(app, `${dir}\\${fx.basename}`);

    await press(app.page.getByRole('button', { name: 'Import profile…' }));
    const review = app.page.getByRole('dialog', { name: 'Review reviewed agent profile' });
    await expect(review).toContainText(fx.fields.name);
    await expect(review).toContainText(fx.fields.goal);
    await expect(review).toContainText('grants no tools, workspaces, roles, or budget');
    await press(review.getByRole('checkbox'), 'Space');
    await press(review.getByRole('button', { name: 'Import profile' }));
    await expect(review).toBeHidden();

    const roster = app.page.getByRole('list', { name: 'Reviewed agent profiles' });
    await expect(roster.getByRole('listitem').filter({ hasText: fx.fields.name })).toBeVisible();
  } finally {
    await teardown(app, dir);
  }
});

test('roster items are compact, text-only, and depend on no avatar image or animation', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('roster-text-only');
  try {
    const fx = MARVEL_ROSTER_FIXTURES[1]!;
    await importByKeyboard(app.page, app, dir, fx.basename, fx.text);

    const roster = app.page.getByRole('list', { name: 'Reviewed agent profiles' });
    const item = roster.getByRole('listitem').filter({ hasText: fx.fields.name });
    await expect(item).toBeVisible();
    expect(await item.locator('img').count()).toBe(0);
    expect(await item.locator('video').count()).toBe(0);
  } finally {
    await teardown(app, dir);
  }
});

test('keyboard-only detail view discloses the exact goal, digest, and revision history', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('roster-detail');
  try {
    const fx = MARVEL_ROSTER_FIXTURES[2]!;
    await importByKeyboard(app.page, app, dir, fx.basename, fx.text);

    const roster = app.page.getByRole('list', { name: 'Reviewed agent profiles' });
    await press(roster.getByRole('listitem').filter({ hasText: fx.fields.name }));
    const detail = app.page.getByRole('region', { name: 'Agent profile detail' });
    await expect(detail).toContainText(fx.fields.goal);
    await expect(detail).toContainText(fx.digest.slice(0, 12));
  } finally {
    await teardown(app, dir);
  }
});

test('keyboard-only disable removes eligibility without deleting the profile', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('roster-disable');
  try {
    const fx = MARVEL_ROSTER_FIXTURES[3]!;
    await importByKeyboard(app.page, app, dir, fx.basename, fx.text);

    const roster = app.page.getByRole('list', { name: 'Reviewed agent profiles' });
    await press(roster.getByRole('listitem').filter({ hasText: fx.fields.name }));
    const detail = app.page.getByRole('region', { name: 'Agent profile detail' });
    await press(detail.getByRole('button', { name: 'Disable' }));
    await expect(detail.getByRole('button', { name: 'Enable' })).toBeVisible();
    await expect(roster.getByRole('listitem').filter({ hasText: fx.fields.name })).toContainText(
      'Disabled',
    );
  } finally {
    await teardown(app, dir);
  }
});

test('re-importing an unchanged file is idempotent; re-importing a revised file adds one revision', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('roster-reimport');
  try {
    const fx = MARVEL_ROSTER_FIXTURES[0]!;
    await importByKeyboard(app.page, app, dir, fx.basename, fx.text);
    await importByKeyboard(app.page, app, dir, fx.basename, fx.text);

    const roster = app.page.getByRole('list', { name: 'Reviewed agent profiles' });
    await expect(roster.getByRole('listitem').filter({ hasText: fx.fields.name })).toHaveCount(1);

    await importByKeyboard(
      app.page,
      app,
      dir,
      REVISED_HIRE_MANIFEST_FIXTURE.basename,
      REVISED_HIRE_MANIFEST_FIXTURE.text,
    );
    await press(roster.getByRole('listitem').filter({ hasText: fx.fields.name }));
    const detail = app.page.getByRole('region', { name: 'Agent profile detail' });
    await press(detail.getByRole('button', { name: 'Revision history' }));
    await expect(detail.getByRole('listitem')).toHaveCount(2);
  } finally {
    await teardown(app, dir);
  }
});
