import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { prepareFixtureMission } from './helpers/mission.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('shared folder access keeps the supervisor visible and directly repairable after a worker moves', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('shared-supervisor'), tempWorkspace('separate-worker')];
  try {
    const envelope = await prepareFixtureMission(app, dirs);
    const leaderFolder = envelope.workspaces[0]!.workspaceId;
    const workerFolder = envelope.workers[0]!.workspaceId;
    const workspaces = await app.call<OperationResponse<'workspaces.list'>>('workspaces.list');
    const leaderPath = workspaces.find((w) => w.id === leaderFolder)!.displayPath;
    const workerPath = workspaces.find((w) => w.id === workerFolder)!.displayPath;
    let draft = await app.call<OperationResponse<'missionComposer.createDraft'>>(
      'missionComposer.createDraft',
    );
    draft = await app.call('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: draft.version,
      currentStage: 'access',
      fieldValues: {
        ...envelope,
        workspaces: [{ workspaceId: leaderFolder, mode: 'write' }],
        workers: [{ ...envelope.workers[0]!, sessionId: null, workspaceId: leaderFolder }],
      },
    });
    const read = () =>
      app.call<OperationResponse<'missionComposer.getDraft'>>('missionComposer.getDraft', {
        draftId: draft.draftId,
      });
    const live = await app.liveSessions();
    const page = app.page;
    await page.reload();
    await page.setViewportSize({ width: 1400, height: 1200 });
    await page.getByRole('button', { name: /^Resume draft/ }).click();
    const leader = page.getByRole('group', { name: `Folder access: ${leaderPath}`, exact: true });
    await expect(leader).toContainText('Supervisor');
    await expect(leader).toContainText('Worker 1');
    await expect(page.getByRole('radio', { name: 'Read', exact: true })).toHaveCount(1);
    await leader.getByRole('radio', { name: 'Read', exact: true }).check();
    await page
      .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
      .selectOption(workerFolder);
    const other = page.getByRole('group', { name: `Folder access: ${workerPath}`, exact: true });
    await expect(leader).toContainText('Supervisor');
    await expect(leader).not.toContainText('Worker 1');
    await expect(leader.getByRole('radio', { name: 'Read', exact: true })).toBeChecked();
    await expect(other).toContainText('Worker 1');
    await page
      .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
      .selectOption(leaderFolder);
    await expect(page.getByRole('radio', { name: 'Read', exact: true })).toHaveCount(1);
    await expect(leader.getByRole('radio', { name: 'Read', exact: true })).toBeChecked();
    await page
      .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
      .selectOption(workerFolder);
    await expect(page.getByRole('radio', { name: 'Read', exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
    await expect(page.getByText('Setup incomplete.', { exact: true })).toBeVisible();
    const held = await app.call<OperationResponse<'missionComposer.preview'>>(
      'missionComposer.preview',
      { draftId: draft.draftId, version: (await read()).version },
    );
    expect(held.envelope.bindings.find((b) => b.role === 'supervisor')?.mode).toBe('read');
    expect(held.envelope.bindings.find((b) => b.role === 'supervisor')?.launchDisposition).toBe(
      'held',
    );
    await page
      .getByRole('button', { name: 'Go to access and limits', exact: true })
      .first()
      .click();
    await leader.getByRole('radio', { name: 'Write', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(leader.getByRole('radio', { name: 'Write', exact: true })).toBeChecked();
    await page.locator('[aria-labelledby="composer-access-heading"]').screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-18-folder-access.png',
    });
    await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
    await expect(page.getByText('Ready to start.', { exact: true })).toBeVisible();
    const saved = (await read()).fieldValues.workspaces;
    expect(saved).toEqual([
      { workspaceId: leaderFolder, mode: 'write' },
      { workspaceId: workerFolder, mode: 'write' },
    ]);
    const ready = await app.call<OperationResponse<'missionComposer.preview'>>(
      'missionComposer.preview',
      { draftId: draft.draftId, version: (await read()).version },
    );
    expect(ready.envelope.bindings.find((b) => b.role === 'supervisor')?.launchDisposition).toBe(
      'ready',
    );
    expect(await app.liveSessions()).toEqual(live);
    expect(await app.call('missions.list')).toEqual([]);
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    expect((await read()).fieldValues.workspaces).toEqual(saved);
    expect(await app.liveSessions()).toEqual([]);
    expect(await app.call('missions.list')).toEqual([]);
  } finally {
    await teardown(app, ...dirs);
  }
});
