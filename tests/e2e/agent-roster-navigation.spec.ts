import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { missionProfile } from './helpers/mission.js';
import { teardown } from './helpers/ui.js';
import type { TestHooks } from '../../apps/desktop/src/main/test-hooks.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tempWorkspace } from './helpers/ui.js';

test('import from an empty filter returns to All and reveals the exact imported profile', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('roster-filter-import');
  try {
    const templates = await app.call<OperationResponse<'agentTemplates.list'>>(
      'agentTemplates.list',
      {},
    );
    const template = await app.call<OperationResponse<'agentTemplates.get'>>('agentTemplates.get', {
      templateId: templates.templates[0]!.templateId,
    });
    const manifest = { ...JSON.parse(template.manifestJson), name: 'Exact imported worker' };
    const target = join(dir, 'exact.agent.json');
    writeFileSync(target, JSON.stringify(manifest));
    await app.app.evaluate((_electron, target) => {
      (
        globalThis as unknown as { __threadhelmTest: TestHooks }
      ).__threadhelmTest.setProfileFilePickerPath(target);
    }, target);
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    await app.page.getByLabel('Profile filter', { exact: true }).selectOption('disabled');
    await expect(app.page.getByText('No disabled profiles.', { exact: true })).toBeVisible();
    await app.page.getByRole('button', { name: 'Import profile', exact: false }).click();
    const review = app.page.getByRole('dialog', { name: 'Review reviewed agent profile' });
    await review.getByRole('checkbox').check();
    await review.getByRole('button', { name: 'Import profile', exact: true }).click();
    await expect(review).toBeHidden();
    await expect(app.page.getByLabel('Profile filter', { exact: true })).toHaveValue('');
    await expect(
      app.page
        .getByRole('region', { name: 'Agent profile detail' })
        .getByRole('heading', { level: 3 }),
    ).toHaveText('Exact imported worker');
    const saved = await app.call<OperationResponse<'profiles.list'>>('profiles.list', {});
    expect(saved.profiles).toHaveLength(1);
    expect(saved.profiles[0]!.displayName).toBe('Exact imported worker');
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, dir);
  }
});

type ReadGate = { mode: 'pass' | 'hold' | 'fail'; pending: (() => void)[] };

// Faults/delays apply only to renderer reads in this isolated app. The existing
// main test router still owns real data and supplies independent readback.
async function readGate(
  app: Awaited<ReturnType<typeof launchApp>>,
  operation: 'profiles.list' | 'profiles.get',
  mode: ReadGate['mode'],
) {
  await app.app.evaluate(
    ({ ipcMain }, { operation, mode }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: TestHooks;
        rosterReadGates?: Record<string, ReadGate>;
      };
      g.rosterReadGates ??= {};
      if (g.rosterReadGates[operation]) {
        g.rosterReadGates[operation].mode = mode;
        return;
      }
      const gate: ReadGate = { mode, pending: [] };
      g.rosterReadGates[operation] = gate;
      ipcMain.removeHandler(`op:${operation}`);
      ipcMain.handle(`op:${operation}`, async (_event, payload: unknown) => {
        if (gate.mode === 'fail')
          return {
            ok: false,
            error: { code: 'STORAGE_DEGRADED', message: 'Fixture read failure', details: {} },
          };
        const result = await g.__threadhelmTest.dispatch(operation, payload);
        if (gate.mode === 'hold') await new Promise<void>((resolve) => gate.pending.push(resolve));
        return result;
      });
    },
    { operation, mode },
  );
}

async function releaseReads(app: Awaited<ReturnType<typeof launchApp>>) {
  await app.app.evaluate(() => {
    const g = globalThis as unknown as { rosterReadGates: Record<string, ReadGate> };
    for (const gate of Object.values(g.rosterReadGates)) {
      gate.mode = 'pass';
      for (const resolve of gate.pending.splice(0)) resolve();
    }
  });
}

test('delayed and failed reads cannot expose stale profile actions or false empty states', async () => {
  const app = await launchApp();
  try {
    const a = await missionProfile(app, 'First exact target');
    const b = await missionProfile(app, 'Second exact target');
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    const roster = app.page.getByRole('list', { name: 'Reviewed agent profiles' });
    const row = (name: string) =>
      roster.getByRole('listitem').filter({ has: app.page.getByText(name, { exact: true }) });
    await readGate(app, 'profiles.get', 'hold');
    await row(a.displayName).click();
    await expect(app.page.getByText('Loading profile detail...', { exact: true })).toBeVisible();
    await row(b.displayName).click();
    await expect(app.page.getByRole('button', { name: 'Disable', exact: true })).toHaveCount(0);
    await releaseReads(app);
    const detail = app.page.getByRole('region', { name: 'Agent profile detail' });
    await expect(detail.getByRole('heading', { level: 3 })).toHaveText(b.displayName);
    await readGate(app, 'profiles.get', 'fail');
    await row(a.displayName).click();
    await expect(app.page.getByRole('button', { name: 'Retry profile detail' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Disable', exact: true })).toHaveCount(0);
    await readGate(app, 'profiles.get', 'pass');
    await app.page.getByRole('button', { name: 'Retry profile detail' }).click();
    await expect(detail.getByRole('heading', { level: 3 })).toHaveText(a.displayName);

    await readGate(app, 'profiles.list', 'fail');
    await app.page.getByLabel('Profile filter', { exact: true }).selectOption('active');
    await expect(
      app.page.getByRole('button', { name: 'Retry profiles', exact: true }),
    ).toBeVisible();
    await expect(app.page.getByText('No active profiles.', { exact: true })).toHaveCount(0);
    await expect(detail).toHaveCount(0);
    await readGate(app, 'profiles.list', 'pass');
    await app.page.getByRole('button', { name: 'Retry profiles', exact: true }).click();
    await expect(roster.getByRole('listitem')).toHaveCount(2);
    await readGate(app, 'profiles.list', 'hold');
    await app.page.getByLabel('Profile filter', { exact: true }).selectOption('disabled');
    await expect(app.page.getByText('Loading profiles...', { exact: true })).toBeVisible();
    await app.page.getByLabel('Profile filter', { exact: true }).selectOption('active');
    await releaseReads(app);
    await expect(roster.getByRole('listitem')).toHaveCount(2);
    await expect(app.page.getByText('No disabled profiles.', { exact: true })).toHaveCount(0);
    expect(
      (await app.call<OperationResponse<'profiles.list'>>('profiles.list', { state: 'active' }))
        .profiles,
    ).toHaveLength(2);
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app);
  }
});

test('all roster pages are reachable, preserve selection and reconcile eligibility changes', async () => {
  let app = await launchApp();
  try {
    for (let i = 0; i < 51; i++) await missionProfile(app, `Roster worker ${i + 1}`);
    const saved = await app.call<OperationResponse<'profiles.list'>>('profiles.list', {
      limit: 100,
    });
    const last = saved.profiles[50]!;
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    const roster = app.page.getByRole('list', { name: 'Reviewed agent profiles' });
    await expect(roster.getByRole('listitem')).toHaveCount(50);
    await roster.getByRole('listitem').first().click();
    const detail = app.page.getByRole('region', { name: 'Agent profile detail' });
    await expect(detail).toContainText(saved.profiles[0]!.displayName);
    await app.page.getByRole('button', { name: 'Load more profiles', exact: true }).click();
    await expect(roster.getByRole('listitem')).toHaveCount(51);
    await expect(detail).toContainText(saved.profiles[0]!.displayName);
    await expect(
      app.page.getByRole('button', { name: 'Load more profiles', exact: true }),
    ).toHaveCount(0);
    await roster
      .getByRole('listitem')
      .filter({ has: app.page.getByText(last.displayName, { exact: true }) })
      .click();
    await expect(detail.getByRole('heading', { level: 3 })).toHaveText(last.displayName);
    await detail.scrollIntoViewIfNeeded();
    await app.page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-3-last-profile.png',
    });
    await detail.getByRole('button', { name: 'Disable', exact: true }).click();
    await expect(detail.getByRole('button', { name: 'Enable', exact: true })).toBeVisible();
    expect(
      (
        await app.call<OperationResponse<'profiles.get'>>('profiles.get', {
          profileId: last.profileId,
        })
      ).state,
    ).toBe('disabled');
    await expect(roster.getByRole('listitem')).toHaveCount(51);
    await app.page.getByLabel('Profile filter', { exact: true }).selectOption('active');
    await expect(roster.getByRole('listitem')).toHaveCount(50);
    await expect(detail).toHaveCount(0);
    await app.page.getByLabel('Profile filter', { exact: true }).selectOption('disabled');
    await expect(roster.getByRole('listitem')).toHaveCount(1);
    await roster.getByRole('listitem').first().click();
    await detail.getByRole('button', { name: 'Enable', exact: true }).click();
    await expect(detail).toHaveCount(0);
    await expect(app.page.getByText('No disabled profiles.', { exact: true })).toBeVisible();
    await app.page.getByText('No disabled profiles.', { exact: true }).scrollIntoViewIfNeeded();
    await app.page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-3-filter-empty.png',
    });
    await app.page.getByRole('button', { name: 'Show all profiles', exact: true }).click();
    await expect(roster.getByRole('listitem')).toHaveCount(50);
    expect(
      (
        await app.call<OperationResponse<'profiles.get'>>('profiles.get', {
          profileId: last.profileId,
        })
      ).state,
    ).toBe('active');
    expect(await app.liveSessions()).toEqual([]);
    const after = await app.call<OperationResponse<'profiles.list'>>('profiles.list', {
      limit: 100,
    });
    const identities = (rows: typeof after.profiles) =>
      rows.map((row) => `${row.profileId}:${row.currentRevisionId}:${row.state}`).sort();
    expect(identities(after.profiles)).toEqual(identities(saved.profiles));
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    const reopened = app.page.getByRole('list', { name: 'Reviewed agent profiles' });
    await expect(reopened.getByRole('listitem')).toHaveCount(50);
    await app.page.getByRole('button', { name: 'Load more profiles', exact: true }).click();
    await expect(reopened.getByRole('listitem')).toHaveCount(51);
    expect(
      identities(
        (await app.call<OperationResponse<'profiles.list'>>('profiles.list', { limit: 100 }))
          .profiles,
      ),
    ).toEqual(identities(saved.profiles));
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app);
  }
});

test('a filter with no matches clears excluded detail and distinguishes empty inventory', async () => {
  const app = await launchApp();
  try {
    const profile = await missionProfile(app, 'Filtered active worker');
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    const roster = app.page.getByRole('list', { name: 'Reviewed agent profiles' });
    await roster.getByRole('listitem').first().click();
    await expect(app.page.getByRole('region', { name: 'Agent profile detail' })).toBeVisible();
    await app.page.locator('.profiles-panel select').selectOption('disabled');
    await expect(roster.getByRole('listitem')).toHaveCount(0);
    await expect(app.page.getByRole('region', { name: 'Agent profile detail' })).toHaveCount(0);
    await expect(app.page.getByText('No disabled profiles.', { exact: true })).toBeVisible();
    await expect(
      app.page.getByText('No reviewed agent profiles yet.', { exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await app.call<OperationResponse<'profiles.get'>>('profiles.get', {
          profileId: profile.profileId,
        })
      ).state,
    ).toBe('active');
  } finally {
    await teardown(app);
  }
});
