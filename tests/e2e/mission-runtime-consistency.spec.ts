import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { prepareFixtureMission } from './helpers/mission.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('new worker runtime and startup choices survive prerequisite repair without launching', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('runtime-choice-leader'), tempWorkspace('runtime-choice-worker')];
  try {
    const envelope = await prepareFixtureMission(app, dirs);
    const before = await app.liveSessions();
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
            ...envelope.workers[0]!,
            sessionId: null,
            autoStart: false,
            runtimeSelection: { model: null, effort: null },
          },
        ],
      },
    });
    const page = app.page;
    await page.reload();
    await page.getByRole('button', { name: /^Resume draft/ }).click();
    const startup = page.getByLabel('Authorize automatic startup of worker 1 within this mission', {
      exact: true,
    });
    await expect(startup).toBeVisible();
    await expect(startup).not.toBeChecked();
    await startup.check();
    await page.getByRole('group', { name: 'Worker 1', exact: true }).locator('summary').click();
    const model = page.getByRole('combobox', { name: 'Worker 1 model', exact: true });
    await expect(model.getByRole('option', { name: 'CLI default', exact: true })).toHaveCount(1);
    await model.selectOption('gpt-5.6-luna');
    await model.selectOption('__custom__');
    await page
      .getByLabel('Worker 1 custom model identifier', { exact: true })
      .fill('custom-runtime');
    await page.getByRole('button', { name: 'Continue to access and limits', exact: true }).click();
    await page.getByRole('button', { name: 'Fix prerequisites in Settings…', exact: true }).click();
    const saved = await app.call<OperationResponse<'missionComposer.getDraft'>>(
      'missionComposer.getDraft',
      { draftId: draft.draftId },
    );
    expect(saved.currentStage).toBe('access');
    expect(saved.fieldValues.workers![0]!.runtimeSelection.model).toBe('custom-runtime');
    expect(saved.fieldValues.workers![0]!.autoStart).toBe(true);
    await page.getByRole('button', { name: 'Return to mission draft', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Set where the mission may work and when it must stop.' }),
    ).toBeVisible();
    expect(await app.liveSessions()).toEqual(before);
  } finally {
    await teardown(app, ...dirs);
  }
});
