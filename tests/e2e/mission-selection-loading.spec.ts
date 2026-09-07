import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import type { TestHooks } from '../../apps/desktop/src/main/test-hooks.js';
import { prepareFixtureMission } from './helpers/mission.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

test('mission selection hides old identity during delayed, failed and out-of-order detail reads', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dirs = [tempWorkspace('selection-leader'), tempWorkspace('selection-worker')];
  try {
    const create = async (objective: string) => {
      const pair = [tempWorkspace('select-leader'), tempWorkspace('select-worker')];
      dirs.push(...pair);
      const envelope = await prepareFixtureMission(app, pair);
      const preview = await app.call<OperationResponse<'missions.preview'>>('missions.preview', {
        envelope: { ...envelope, objective },
      });
      return app.call<OperationResponse<'missions.confirm'>>('missions.confirm', {
        previewToken: preview.previewToken,
        boundaryConfirmation: true,
      });
    };
    const first = await create('First exact mission');
    const second = await create('Second exact mission');
    const before = await app.liveSessions();
    const page = app.page;
    const select = (id: string) => page.locator(`#mission-rail-${id}`).click();
    await select(first.id);
    await expect(page.locator('#mission-workspace h1')).toHaveText('First exact mission');
    await app.app.evaluate(({ ipcMain }, id) => {
      const g = globalThis as unknown as {
        __threadhelmTest: TestHooks;
        missionGate: { mode: string; pending: (() => void)[] };
      };
      const gate: typeof g.missionGate = { mode: 'hold', pending: [] };
      g.missionGate = gate;
      ipcMain.removeHandler('op:missions.detail');
      ipcMain.handle('op:missions.detail', async (_e, p: { missionId: string }) => {
        if (p.missionId !== id) return g.__threadhelmTest.dispatch('missions.detail', p);
        if (gate.mode === 'fail')
          return {
            ok: false,
            error: { code: 'STORAGE_DEGRADED', message: 'Fixture detail failure', details: {} },
          };
        const result = await g.__threadhelmTest.dispatch('missions.detail', p);
        if (gate.mode === 'hold') await new Promise<void>((resolve) => gate.pending.push(resolve));
        return result;
      });
    }, second.id);
    await select(second.id);
    await expect(page.locator('#mission-workspace')).not.toContainText('First exact mission');
    await expect(page.locator('#mission-workspace')).toContainText('Loading selected mission');
    await expect(page.locator('#mission-workspace')).toContainText(second.id);
    await expect(page.getByRole('button', { name: 'Pause mission', exact: true })).toHaveCount(0);
    await select(first.id);
    await expect(page.locator('#mission-workspace h1')).toHaveText('First exact mission');
    await app.app.evaluate(() => {
      const gate = (
        globalThis as unknown as { missionGate: { mode: string; pending: (() => void)[] } }
      ).missionGate;
      gate.mode = 'fail';
      for (const release of gate.pending.splice(0)) release();
    });
    await expect(page.locator('#mission-workspace h1')).toHaveText('First exact mission');
    await select(second.id);
    await expect(page.getByRole('heading', { name: 'Missions unavailable' })).toBeVisible();
    await expect(page.locator('#mission-workspace')).toContainText(second.id);
    await page.getByRole('button', { name: 'Memory', exact: true }).click();
    await page.getByRole('button', { name: 'Missions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry missions', exact: true })).toBeVisible();
    await app.app.evaluate(() => {
      (globalThis as unknown as { missionGate: { mode: string } }).missionGate.mode = 'pass';
    });
    await page.getByRole('button', { name: 'Retry missions', exact: true }).click();
    await expect(page.locator('#mission-workspace h1')).toHaveText('Second exact mission');
    expect(
      (
        await app.call<OperationResponse<'missions.detail'>>('missions.detail', {
          missionId: second.id,
        })
      ).envelope!.objective,
    ).toBe('Second exact mission');
    expect(await app.liveSessions()).toEqual(before);
  } finally {
    await teardown(app, ...dirs);
  }
});
