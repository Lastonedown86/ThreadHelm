import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp, approveFolder } from './helpers/app.js';
import { teardown, tempWorkspace } from './helpers/ui.js';

test('temporary reading list keeps exact edition across navigation and refreshes deletion, then clears on restart', async () => {
  let app = await launchApp();
  const dir = tempWorkspace('reading-list');
  try {
    await expect(app.page.locator('.status-bar')).toContainText('ThreadHelm v');
    const w = await approveFolder(app, dir);
    const p = await app.call<OperationResponse<'memory.previewPublish'>>('memory.previewPublish', {
      scope: { workspaceId: w.id },
      kind: 'fact',
      title: 'Reading fixture',
      body: 'Private fixture body',
      confidence: 'unknown',
      sourceRefs: [],
      memoryExpiresAt: null,
    });
    const saved = await app.call<OperationResponse<'memory.confirmPublish'>>(
      'memory.confirmPublish',
      { publishToken: p.publishToken, durableContentConfirmation: true },
    );
    const open = () => app.page.getByRole('button', { name: 'Memory', exact: true }).click();
    await open();
    const search = app.page.getByRole('searchbox', { name: 'Search shared memory' });
    await search.fill('Reading fixture');
    await search.press('Enter');
    await app.page.getByRole('button', { name: 'View details' }).click();
    const add = app.page.getByRole('button', { name: 'Add exact edition to reading list' });
    await add.click();
    await add.click();
    let reading = app.page.getByRole('region', { name: 'Reading list', exact: true });
    await expect(reading.getByRole('listitem')).toHaveCount(1);
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    await open();
    await expect(reading.getByRole('listitem')).toHaveCount(1);
    await expect(reading).toContainText('Temporary selection');
    await expect(reading).toContainText(saved.summary.revisionId);
    // Mutate while away through main contracts: verifies event/return refresh of exact edition.
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    const revision = await app.call<OperationResponse<'memory.previewSupersede'>>(
      'memory.previewSupersede',
      {
        entryId: saved.summary.entryId,
        targetRevisionId: saved.summary.revisionId,
        title: 'Newer edition',
        body: 'Newer body',
        sourceRefs: [{ kind: 'memory', id: saved.summary.entryId }],
        confidence: 'unknown',
      },
    );
    await app.call('memory.confirmSupersede', { supersedeToken: revision.supersedeToken });
    await open();
    await expect(reading).toContainText('superseded');
    await expect(reading).toContainText(saved.summary.revisionId);
    await expect(reading).not.toContainText('Newer edition');
    const deletion = await app.call<OperationResponse<'memory.requestDeletion'>>(
      'memory.requestDeletion',
      { entryId: saved.summary.entryId },
    );
    await app.call('memory.confirmDeletion', {
      deletionToken: deletion.deletionToken,
      permanentDeletionConfirmation: true,
    });
    await expect(reading).toContainText('deleted');
    await expect(reading).not.toContainText('Reading fixture');
    await expect(reading).not.toContainText('Private fixture body');
    await reading.scrollIntoViewIfNeeded();
    await app.page.screenshot({
      path: fileURLToPath(
        new URL(
          '../../specs/004-sidebar-workspace-ux/audits/evidence/slice-7-reading-deleted.png',
          import.meta.url,
        ),
      ),
    });
    const removed = await app.call<OperationResponse<'memory.get'>>('memory.get', {
      entryId: saved.summary.entryId,
      revisionId: saved.summary.revisionId,
      scope: { workspaceId: w.id },
    });
    expect(removed.body).toBeNull();
    expect(removed.summary.status).toBe('deleted');
    await reading.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(reading.getByRole('listitem')).toHaveCount(0);
    // Add another edition so restart proves membership clearing, not an already empty list.
    const fresh = await app.call<OperationResponse<'memory.previewPublish'>>(
      'memory.previewPublish',
      {
        scope: { workspaceId: w.id },
        kind: 'fact',
        title: 'Restart fixture',
        body: 'Restart body',
        confidence: 'unknown',
        sourceRefs: [],
        memoryExpiresAt: null,
      },
    );
    await app.call('memory.confirmPublish', {
      publishToken: fresh.publishToken,
      durableContentConfirmation: true,
    });
    await search.fill('Restart fixture');
    await search.press('Enter');
    await app.page.getByRole('button', { name: 'View details' }).click();
    await add.click();
    await expect(reading.getByRole('listitem')).toHaveCount(1);
    await app.page
      .getByRole('region', { name: 'Memory detail' })
      .getByRole('button', { name: 'Retract', exact: false })
      .click();
    const retract = app.page.getByRole('dialog', { name: 'Retract memory revision' });
    await retract.getByLabel('Reason').fill('Reading-list lifecycle test');
    await retract.getByRole('button', { name: 'Retract revision', exact: true }).click();
    await expect(reading).toContainText('retracted');
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
        failReading: boolean;
      };
      g.failReading = true;
      ipcMain.removeHandler('op:memory.get');
      ipcMain.handle('op:memory.get', (_event, p: unknown) =>
        g.failReading
          ? {
              ok: false,
              error: { code: 'STORAGE_DEGRADED', message: 'Fixture read unavailable', details: {} },
            }
          : g.__threadhelmTest.dispatch('memory.get', p),
      );
    });
    await open();
    await expect(reading).toContainText('Edition unavailable');
    await expect(reading).not.toContainText('Restart fixture');
    await app.app.evaluate(
      () => ((globalThis as unknown as { failReading: boolean }).failReading = false),
    );
    await reading.getByRole('button', { name: 'Retry edition' }).click();
    await expect(reading).toContainText('Restart fixture');
    await expect(reading).toContainText('retracted');
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    await open();
    reading = app.page.getByRole('region', { name: 'Reading list', exact: true });
    await expect(reading.getByRole('listitem')).toHaveCount(0);
    expect(
      (
        await app.call<OperationResponse<'memory.get'>>('memory.get', {
          entryId: saved.summary.entryId,
          scope: { workspaceId: w.id },
        })
      ).body,
    ).toBeNull();
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, dir);
  }
});

test('reading-list expiry refreshes at its deadline without replacing the edition', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('reading-expiry');
  try {
    await expect(app.page.locator('.status-bar')).toContainText('ThreadHelm v');
    const w = await approveFolder(app, dir);
    const p = await app.call<OperationResponse<'memory.previewPublish'>>('memory.previewPublish', {
      scope: { workspaceId: w.id },
      kind: 'fact',
      title: 'Expiring fixture',
      body: 'Expiring evidence',
      confidence: 'unknown',
      sourceRefs: [],
      memoryExpiresAt: new Date(Date.now() + 5000).toISOString(),
    });
    const saved = await app.call<OperationResponse<'memory.confirmPublish'>>(
      'memory.confirmPublish',
      { publishToken: p.publishToken, durableContentConfirmation: true },
    );
    await app.page.getByRole('button', { name: 'Memory', exact: true }).click();
    const query = app.page.getByRole('searchbox', { name: 'Search shared memory' });
    await query.fill('Expiring fixture');
    await query.press('Enter');
    await app.page.getByRole('button', { name: 'View details' }).click();
    await app.page.getByRole('button', { name: 'Add exact edition to reading list' }).click();
    const list = app.page.getByRole('region', { name: 'Reading list', exact: true });
    await expect(list.locator('.badge')).toHaveText('active');
    await expect(list.locator('.badge')).toHaveText('expired');
    await expect(list).toContainText(saved.summary.revisionId);
    const read = await app.call<OperationResponse<'memory.get'>>('memory.get', {
      entryId: saved.summary.entryId,
      revisionId: saved.summary.revisionId,
      scope: { workspaceId: w.id },
    });
    expect(read.summary.status).toBe('expired');
  } finally {
    await teardown(app, dir);
  }
});
