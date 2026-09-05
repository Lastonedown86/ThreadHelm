import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp, approveFolder } from './helpers/app.js';
import { teardown, tempWorkspace } from './helpers/ui.js';

test('paging failure and retry preserve the exact selected memory until context changes', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('memory-paging');
  try {
    await expect(app.page.locator('.status-bar')).toContainText('ThreadHelm v');
    const workspace = await approveFolder(app, dir);
    for (let i = 0; i < 21; i++) {
      const p = await app.call<OperationResponse<'memory.previewPublish'>>(
        'memory.previewPublish',
        {
          scope: { workspaceId: workspace.id },
          kind: 'fact',
          title: `paging fixture ${i}`,
          body: `exact fixture body ${i}`,
          confidence: 'unknown',
          sourceRefs: [],
          memoryExpiresAt: null,
        },
      );
      await app.call('memory.confirmPublish', {
        publishToken: p.publishToken,
        durableContentConfirmation: true,
      });
    }
    const authoritative = await app.call<OperationResponse<'memory.search'>>('memory.search', {
      scope: { workspaceId: workspace.id },
      query: 'paging',
      limit: 20,
    });
    const target = authoritative.items[0]!;
    const saved = await app.call<OperationResponse<'memory.get'>>('memory.get', {
      entryId: target.entryId,
      scope: { workspaceId: workspace.id },
    });
    await app.page.getByRole('button', { name: 'Memory', exact: true }).click();
    const query = app.page.getByRole('searchbox', { name: 'Search shared memory' });
    await query.fill('paging');
    await query.press('Enter');
    const list = app.page.getByRole('list', { name: 'Shared memory results' });
    await expect(list.getByRole('listitem')).toHaveCount(20);
    await list
      .getByRole('listitem')
      .filter({ has: app.page.getByText(target.title!, { exact: true }) })
      .getByRole('button', { name: 'View details' })
      .click();
    const detail = app.page.getByRole('region', { name: 'Memory detail' });
    await expect(detail.getByRole('heading', { level: 3 })).toHaveText(target.title!);
    await expect(detail.locator('.memory-body')).toHaveText(saved.body!);
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
      };
      let fail = true;
      ipcMain.removeHandler('op:memory.search');
      ipcMain.handle('op:memory.search', (_event, p: { cursor?: string }) => {
        if (p.cursor && fail) {
          fail = false;
          return {
            ok: false,
            error: { code: 'STORAGE_DEGRADED', message: 'Fixture page read failed', details: {} },
          };
        }
        return g.__threadhelmTest.dispatch('memory.search', p);
      });
    });
    const more = app.page.getByRole('button', { name: 'Load more memories' });
    await more.click();
    await expect(app.page.getByRole('alert')).toContainText('Fixture page read failed');
    await expect(list.getByRole('listitem')).toHaveCount(20);
    await expect(detail.getByRole('heading', { level: 3 })).toHaveText(target.title!);
    await expect(more).toBeEnabled();
    await more.focus();
    await app.page.keyboard.press('Enter');
    await expect(list.getByRole('listitem')).toHaveCount(21);
    await expect(detail.getByRole('heading', { level: 3 })).toHaveText(target.title!);
    await expect(detail.locator('.memory-body')).toHaveText(saved.body!);
    await expect(more).toHaveCount(0);
    await expect(app.page.getByRole('alert')).toHaveCount(0);
    const after = await app.call<OperationResponse<'memory.get'>>('memory.get', {
      entryId: target.entryId,
      scope: { workspaceId: workspace.id },
    });
    expect(after).toEqual(saved);
    await query.fill('no matches');
    await expect(detail).toHaveCount(0);
    await query.press('Enter');
    await expect(list.getByRole('listitem')).toHaveCount(0);
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, dir);
  }
});
