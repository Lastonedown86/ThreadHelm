import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import type { TestHooks } from '../../apps/desktop/src/main/test-hooks.js';
import { launchApp } from './helpers/app.js';
import { teardown } from './helpers/ui.js';

test('template paging recovers without losing selected detail and duplicate validation preserves exact inventory', async () => {
  let app = await launchApp();
  try {
    const source = (
      await app.call<OperationResponse<'agentTemplates.list'>>('agentTemplates.list', {
        limit: 50,
      })
    ).templates[0]!;
    for (let i = 0; i < 22; i++)
      await app.call('agentTemplates.duplicate', {
        templateRevisionId: source.currentRevisionId,
        key: `matrix-${i}`,
        name: `Matrix starter ${i}`,
      });
    const before = (
      await app.call<OperationResponse<'agentTemplates.list'>>('agentTemplates.list', {
        limit: 50,
      })
    ).templates;
    const page = app.page;
    await page.getByRole('button', { name: 'Agents', exact: true }).click();
    const list = page.getByRole('list', { name: 'Agent templates', exact: true });
    await expect(list.getByRole('listitem')).toHaveCount(20);
    const first = list.getByRole('listitem').first();
    await first.getByRole('button', { name: 'Details', exact: true }).click();
    const detail = page.getByRole('region', { name: 'Template detail', exact: true });
    const title = await detail.getByRole('heading').innerText();
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as { __threadhelmTest: TestHooks; failTemplatePage: boolean };
      g.failTemplatePage = true;
      ipcMain.removeHandler('op:agentTemplates.list');
      ipcMain.handle('op:agentTemplates.list', (_e, p: { cursor?: string }) =>
        g.failTemplatePage && p.cursor
          ? {
              ok: false,
              error: { code: 'STORAGE_DEGRADED', message: 'Fixture page failure', details: {} },
            }
          : g.__threadhelmTest.dispatch('agentTemplates.list', p),
      );
    });
    await page.getByRole('button', { name: 'Load more templates', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(list.getByRole('listitem')).toHaveCount(20);
    await expect(detail.getByRole('heading')).toHaveText(title);
    await app.app.evaluate(() => {
      (globalThis as unknown as { failTemplatePage: boolean }).failTemplatePage = false;
    });
    await page.getByRole('button', { name: 'Load more templates', exact: true }).click();
    await expect(list.getByRole('listitem')).toHaveCount(before.length);
    await expect(detail.getByRole('heading')).toHaveText(title);
    await first.getByRole('button', { name: 'Duplicate', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Duplicate template', exact: true });
    await dialog.getByLabel('Template key', { exact: true }).fill('invalid key');
    await dialog.getByRole('button', { name: 'Confirm duplicate', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByLabel('Template key', { exact: true }).fill(source.key);
    await dialog.getByRole('button', { name: 'Confirm duplicate', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(
      (
        await app.call<OperationResponse<'agentTemplates.list'>>('agentTemplates.list', {
          limit: 50,
        })
      ).templates
        .map((t) => t.templateId)
        .sort(),
    ).toEqual(before.map((t) => t.templateId).sort());
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    expect(
      (
        await app.call<OperationResponse<'agentTemplates.list'>>('agentTemplates.list', {
          limit: 50,
        })
      ).templates
        .map((t) => t.templateId)
        .sort(),
    ).toEqual(before.map((t) => t.templateId).sort());
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await teardown(app);
  }
});
