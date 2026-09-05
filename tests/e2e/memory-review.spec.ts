import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp, approveFolder } from './helpers/app.js';
import { teardown, tempWorkspace } from './helpers/ui.js';

test('supersession requires fresh review for title and body and saves exact text through restart', async () => {
  let app = await launchApp();
  const dir = tempWorkspace('memory-review');
  try {
    const workspace = await approveFolder(app, dir);
    const preview = await app.call<OperationResponse<'memory.previewPublish'>>(
      'memory.previewPublish',
      {
        scope: { workspaceId: workspace.id },
        kind: 'fact',
        title: 'Review fixture',
        body: 'Original content',
        confidence: 'unknown',
        sourceRefs: [],
        memoryExpiresAt: null,
      },
    );
    const original = await app.call<OperationResponse<'memory.confirmPublish'>>(
      'memory.confirmPublish',
      { publishToken: preview.publishToken, durableContentConfirmation: true },
    );
    const read = () =>
      app.call<OperationResponse<'memory.get'>>('memory.get', {
        entryId: original.summary.entryId,
        scope: { workspaceId: workspace.id },
      });
    await app.page.getByRole('button', { name: 'Memory', exact: true }).click();
    const search = app.page.getByRole('searchbox', { name: 'Search shared memory' });
    await search.fill('Review fixture');
    await search.press('Enter');
    await app.page.getByRole('button', { name: 'View details' }).click();
    const opener = app.page.getByRole('button', { name: 'Supersede…', exact: true });
    await opener.click();
    const dialog = app.page.getByRole('dialog', { name: 'Supersede shared memory' });
    const review = dialog.getByRole('button', { name: 'Review supersession', exact: true });
    const append = dialog.getByRole('button', { name: 'Append revision', exact: true });
    await review.click();
    await expect(append).toBeVisible();
    await dialog.getByLabel('Title', { exact: true }).fill('New reviewed title');
    await expect(append).toHaveCount(0);
    await review.click();
    await expect(append).toBeVisible();
    await dialog.getByLabel('Body').fill('New reviewed body.');
    await expect(append).toHaveCount(0);
    await review.click();
    await expect(dialog.getByRole('region', { name: 'Reviewed content' })).toContainText(
      'New reviewed title',
    );
    await expect(dialog.getByRole('region', { name: 'Reviewed content' })).toContainText(
      'New reviewed body.',
    );
    await app.page.screenshot({
      path: fileURLToPath(
        new URL(
          '../../specs/004-sidebar-workspace-ux/audits/evidence/slice-4-memory-review.png',
          import.meta.url,
        ),
      ),
    });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect((await read()).summary.revisionId).toBe(original.summary.revisionId);
    await opener.click();
    await expect(append).toHaveCount(0);
    await expect(dialog.getByLabel('Body')).toHaveValue('New reviewed body.');
    await review.click();
    await append.focus();
    await app.page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    const saved = await read();
    expect(saved.summary.title).toBe('New reviewed title');
    expect(saved.body).toBe('New reviewed body.');
    expect(saved.lineage).toHaveLength(2);
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    const restored = await read();
    expect(restored.summary.revisionId).toBe(saved.summary.revisionId);
    expect(restored.body).toBe(saved.body);
    expect(restored.summary.title).toBe(saved.summary.title);
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, dir);
  }
});

// Controlled renderer IPC delay/rejection; main test dispatch remains independent.
test('cancelled late review is ignored and rejected append retains editable content for fresh review', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('memory-review-recovery');
  try {
    const workspace = await approveFolder(app, dir);
    const p = await app.call<OperationResponse<'memory.previewPublish'>>('memory.previewPublish', {
      scope: { workspaceId: workspace.id },
      kind: 'fact',
      title: 'Recovery fixture',
      body: 'Original',
      confidence: 'unknown',
      sourceRefs: [],
      memoryExpiresAt: null,
    });
    const original = await app.call<OperationResponse<'memory.confirmPublish'>>(
      'memory.confirmPublish',
      { publishToken: p.publishToken, durableContentConfirmation: true },
    );
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, payload: unknown): Promise<unknown> };
        releaseReview?: () => void;
        failAppend?: boolean;
      };
      let hold = true;
      g.failAppend = true;
      ipcMain.removeHandler('op:memory.previewSupersede');
      ipcMain.handle('op:memory.previewSupersede', async (_event, payload: unknown) => {
        const result = await g.__threadhelmTest.dispatch('memory.previewSupersede', payload);
        if (hold) {
          hold = false;
          await new Promise<void>((resolve) => {
            g.releaseReview = resolve;
          });
        }
        return result;
      });
      ipcMain.removeHandler('op:memory.confirmSupersede');
      ipcMain.handle('op:memory.confirmSupersede', (_event, payload: unknown) => {
        if (g.failAppend) {
          g.failAppend = false;
          return {
            ok: false,
            error: { code: 'TOKEN_EXPIRED', message: 'Fixture review expired', details: {} },
          };
        }
        return g.__threadhelmTest.dispatch('memory.confirmSupersede', payload);
      });
    });
    await app.page.getByRole('button', { name: 'Memory', exact: true }).click();
    const search = app.page.getByRole('searchbox', { name: 'Search shared memory' });
    await search.fill('Recovery fixture');
    await search.press('Enter');
    await app.page.getByRole('button', { name: 'View details' }).click();
    const opener = app.page.getByRole('button', { name: 'Supersede…', exact: true });
    await opener.click();
    const dialog = app.page.getByRole('dialog', { name: 'Supersede shared memory' });
    const review = dialog.getByRole('button', { name: 'Review supersession', exact: true });
    const append = dialog.getByRole('button', { name: 'Append revision', exact: true });
    await dialog.getByLabel('Body').fill('Retained recovery text');
    await review.click();
    await expect(review).toBeDisabled();
    await expect(dialog.getByLabel('Body')).toBeDisabled();
    await expect
      .poll(() =>
        app.app.evaluate(() =>
          Boolean((globalThis as unknown as { releaseReview?: () => void }).releaseReview),
        ),
      )
      .toBe(true);
    await app.page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await opener.click();
    await app.app.evaluate(() =>
      (globalThis as unknown as { releaseReview: () => void }).releaseReview(),
    );
    await expect(review).toBeEnabled();
    await review.click();
    await expect(append).toBeEnabled();
    await append.click();
    await expect(dialog.getByRole('alert')).toContainText('Review the current content again');
    await expect(append).toHaveCount(0);
    await expect(dialog.getByLabel('Body')).toHaveValue('Retained recovery text');
    const unchanged = await app.call<OperationResponse<'memory.get'>>('memory.get', {
      entryId: original.summary.entryId,
      scope: { workspaceId: workspace.id },
    });
    expect(unchanged.summary.revisionId).toBe(original.summary.revisionId);
    await review.click();
    await append.click();
    await expect(dialog).toBeHidden();
    const saved = await app.call<OperationResponse<'memory.get'>>('memory.get', {
      entryId: original.summary.entryId,
      scope: { workspaceId: workspace.id },
    });
    expect(saved.body).toBe('Retained recovery text');
    expect(saved.lineage).toHaveLength(2);
  } finally {
    await teardown(app, dir);
  }
});
