import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { prepareFixtureMission } from './helpers/mission.js';
import { launchWithFixtures, stopViaUi, teardown, tempWorkspace } from './helpers/ui.js';

test('existing runtime is fixed and an older mismatch is explicitly repaired without launching', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('runtime-leader'), tempWorkspace('runtime-worker')];
  try {
    const envelope = await prepareFixtureMission(app, dirs);
    const worker = envelope.workers[0]!;
    const original = await app.liveSessions();
    let draft = await app.call<OperationResponse<'missionComposer.createDraft'>>(
      'missionComposer.createDraft',
    );
    draft = await app.call('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: draft.version,
      currentStage: 'crew',
      fieldValues: {
        ...envelope,
        workers: [
          {
            ...worker,
            runtimeSelection: { ...worker.runtimeSelection, model: 'invalid-audit-model' },
          },
        ],
      },
    });
    await expect(
      app.call('missionComposer.preview', { draftId: draft.draftId, version: draft.version }),
    ).rejects.toThrow();
    await app.page.reload();
    const page = app.page;
    await page.setViewportSize({ width: 1400, height: 1800 });
    await page.getByRole('button', { name: /^Resume draft/ }).click();
    const model = page.getByLabel('Worker 1 model', { exact: true });
    await page.getByRole('group', { name: 'Worker 1', exact: true }).locator('summary').click();
    await expect(model).toBeDisabled();
    await expect(model).toHaveValue(worker.runtimeSelection.model ?? '');
    await expect(
      page.getByRole('combobox', { name: 'Worker 1 effort', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('combobox', { name: 'Worker 1 permission', exact: true }),
    ).toBeDisabled();
    await page.getByRole('group', { name: 'Worker 1', exact: true }).screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-17-recorded-runtime.png',
    });
    await page
      .getByRole('button', { name: 'Use recorded settings for worker 1', exact: true })
      .click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const read = () =>
      app.call<OperationResponse<'missionComposer.getDraft'>>('missionComposer.getDraft', {
        draftId: draft.draftId,
      });
    expect((await read()).fieldValues.workers?.[0]).toEqual(worker);
    await page.getByRole('button', { name: /^Resume draft/ }).click();
    await page
      .getByRole('button', { name: 'Switch worker 1 to a new session', exact: true })
      .click();
    await page.getByRole('group', { name: 'Worker 1', exact: true }).locator('summary').click();
    await expect(model).toBeEnabled();
    await model.selectOption('__custom__');
    await page
      .getByLabel('Worker 1 custom model identifier', { exact: true })
      .fill('another-model');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const newSessionDraft = (await read()).fieldValues.workers?.[0];
    expect(newSessionDraft?.sessionId).toBeNull();
    expect(newSessionDraft?.autoStart).toBe(false);
    expect(newSessionDraft?.runtimeSelection.model).toBe('another-model');
    expect(await app.liveSessions()).toEqual(original);
    await page.getByRole('button', { name: /^Resume draft/ }).click();
    await page
      .getByRole('combobox', { name: 'Worker 1 session', exact: true })
      .selectOption(worker.sessionId!);
    await expect(model).toBeDisabled();
    await expect(model).toHaveValue(worker.runtimeSelection.model ?? '');
    await page.getByRole('button', { name: 'Continue to access and limits', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
    await expect(page.getByText('Ready to start.', { exact: true })).toBeVisible();
    expect((await read()).fieldValues.workers?.[0]).toEqual(worker);
    expect(await app.liveSessions()).toEqual(original);
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await stopViaUi(app, worker.sessionId!);
    await page.getByRole('button', { name: /^Resume draft/ }).click();
    await expect(page.getByRole('alert')).toContainText(
      "Worker 1's selected session is no longer eligible",
    );
    await page.getByRole('button', { name: 'Repair worker session', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Worker 1 session', exact: true })).toHaveValue(
      worker.sessionId!,
    );
    await expect(page.getByRole('alert')).toContainText(
      "Worker 1's selected session is no longer eligible",
    );
    await page.getByRole('group', { name: 'Worker 1', exact: true }).screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-17-unavailable-worker.png',
    });
    expect((await read()).fieldValues.workers?.[0]?.sessionId).toBe(worker.sessionId);
    expect((await app.liveSessions()).map((s) => s.id)).toEqual(
      original.filter((s) => s.id !== worker.sessionId).map((s) => s.id),
    );
    expect(await app.call<OperationResponse<'missions.list'>>('missions.list')).toHaveLength(0);
  } finally {
    await teardown(app, ...dirs);
  }
});
