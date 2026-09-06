import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { teardown } from './helpers/ui.js';

test('template dependency denial requires fresh deletion review and preserves exact targets', async () => {
  let app = await launchApp();
  try {
    const source = (
      await app.call<OperationResponse<'agentTemplates.list'>>('agentTemplates.list', { limit: 20 })
    ).templates[0]!;
    const local = await app.call<OperationResponse<'agentTemplates.duplicate'>>(
      'agentTemplates.duplicate',
      {
        templateRevisionId: source.currentRevisionId,
        key: 'delete-recovery',
        name: 'Recovery starter',
      },
    );
    const page = app.page;
    await page.getByRole('button', { name: 'Agents', exact: true }).click();
    const row = page
      .getByRole('list', { name: 'Agent templates', exact: true })
      .getByRole('listitem')
      .filter({ hasText: 'Recovery starter' });
    await row.getByRole('button', { name: 'Use template', exact: true }).click();
    const wizard = page.getByRole('dialog', { name: 'Create agent', exact: true });
    await wizard.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(wizard.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(wizard).toBeHidden();
    const drafts = (
      await app.call<OperationResponse<'agentWizard.listDrafts'>>('agentWizard.listDrafts', {
        limit: 20,
      })
    ).drafts;
    expect(drafts).toHaveLength(1);
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete local template' });
    const confirm = dialog.getByRole('button', { name: 'Confirm delete template' });
    await confirm.click();
    await expect(dialog.getByRole('alert')).toContainText('draft');
    await expect(confirm).toBeDisabled();
    expect(
      (
        await app.call<OperationResponse<'agentTemplates.get'>>('agentTemplates.get', {
          templateId: local.templateId,
        })
      ).state,
    ).toBe('active');
    await dialog.getByRole('button', { name: 'Refresh deletion review' }).click();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(dialog.getByRole('alert')).toContainText('draft');
    await expect(dialog.getByRole('alert')).not.toContainText('manifest');
    await expect(confirm).toBeDisabled();
    await page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-20-delete-recovery.png',
    });
    await dialog.getByRole('button', { name: 'Keep template' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.getByRole('button', { name: 'Agents', exact: true }).click();
    await page
      .getByRole('button', { name: `Resume draft ${drafts[0]!.draftId.slice(0, 8)}` })
      .click();
    await wizard.getByRole('button', { name: 'Delete draft', exact: true }).click();
    await wizard.getByRole('button', { name: 'Confirm delete draft', exact: true }).click();
    await expect(wizard).toBeHidden();
    expect(
      (
        await app.call<OperationResponse<'agentWizard.listDrafts'>>('agentWizard.listDrafts', {
          limit: 20,
        })
      ).drafts,
    ).toHaveLength(0);
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(
      (
        await app.call<OperationResponse<'agentTemplates.get'>>('agentTemplates.get', {
          templateId: local.templateId,
        })
      ).state,
    ).toBe('active');
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await confirm.click();
    await expect(dialog).toBeHidden();
    expect(
      await app.dispatch('agentTemplates.get', { templateId: local.templateId }),
    ).toMatchObject({ ok: false, error: { code: 'PROFILE_NOT_FOUND' } });
    expect(
      (
        await app.call<OperationResponse<'agentTemplates.get'>>('agentTemplates.get', {
          templateId: source.templateId,
        })
      ).state,
    ).toBe('active');
    expect(await app.liveSessions()).toEqual([]);
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    expect(
      (
        await app.call<OperationResponse<'agentTemplates.list'>>('agentTemplates.list', {
          limit: 20,
        })
      ).templates.some((t) => t.templateId === local.templateId),
    ).toBe(false);
  } finally {
    await teardown(app);
  }
});

test('expired deletion recovers from failed refresh and blocks repeated pending actions', async () => {
  const app = await launchApp();
  try {
    const source = (
      await app.call<OperationResponse<'agentTemplates.list'>>('agentTemplates.list', { limit: 20 })
    ).templates[0]!;
    const local = await app.call<OperationResponse<'agentTemplates.duplicate'>>(
      'agentTemplates.duplicate',
      {
        templateRevisionId: source.currentRevisionId,
        key: 'expired-delete',
        name: 'Expired starter',
      },
    );
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    const row = app.page
      .getByRole('list', { name: 'Agent templates', exact: true })
      .getByRole('listitem')
      .filter({ hasText: 'Expired starter' });
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await app.app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('op:agentTemplates.delete');
      ipcMain.handle('op:agentTemplates.delete', () => ({
        ok: false,
        error: { code: 'CONFIRMATION_EXPIRED', message: 'Injected expiry', details: {} },
      }));
    });
    const dialog = app.page.getByRole('dialog', { name: 'Delete local template' });
    const confirm = dialog.getByRole('button', { name: 'Confirm delete template' });
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(dialog.getByRole('alert')).toContainText('expired');
    await expect(dialog.getByRole('alert')).not.toContainText('manifest');
    await app.app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('op:agentTemplates.previewDelete');
      ipcMain.handle('op:agentTemplates.previewDelete', () => ({
        ok: false,
        error: { code: 'INVALID_STATE', message: 'Injected refresh failure', details: {} },
      }));
    });
    const refresh = dialog.getByRole('button', { name: 'Refresh deletion review' });
    await refresh.click();
    await expect(refresh).toBeEnabled();
    await expect(confirm).toBeDisabled();
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
        deletionCalls: number;
        reviewCalls: number;
        releaseReview: () => void;
      };
      g.deletionCalls = 0;
      g.reviewCalls = 0;
      ipcMain.removeHandler('op:agentTemplates.previewDelete');
      ipcMain.handle('op:agentTemplates.previewDelete', async (_e, p: unknown) => {
        g.reviewCalls++;
        await new Promise<void>((resolve) => {
          g.releaseReview = resolve;
        });
        return g.__threadhelmTest.dispatch('agentTemplates.previewDelete', p);
      });
      ipcMain.removeHandler('op:agentTemplates.delete');
      ipcMain.handle('op:agentTemplates.delete', (_e, p: unknown) => {
        g.deletionCalls++;
        return g.__threadhelmTest.dispatch('agentTemplates.delete', p);
      });
    });
    await refresh.click();
    await expect(refresh).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Keep template' })).toBeDisabled();
    await app.page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await refresh.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await app.app.evaluate(() =>
      (globalThis as unknown as { releaseReview: () => void }).releaseReview(),
    );
    await expect(confirm).toBeEnabled();
    expect(
      (
        await app.call<OperationResponse<'agentTemplates.get'>>('agentTemplates.get', {
          templateId: local.templateId,
        })
      ).state,
    ).toBe('active');
    await confirm.focus();
    await app.page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    expect(
      await app.app.evaluate(() => {
        const g = globalThis as unknown as { reviewCalls: number; deletionCalls: number };
        return { reviews: g.reviewCalls, deletes: g.deletionCalls };
      }),
    ).toEqual({ reviews: 1, deletes: 1 });
    expect(
      await app.dispatch('agentTemplates.get', { templateId: local.templateId }),
    ).toMatchObject({ ok: false, error: { code: 'PROFILE_NOT_FOUND' } });
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app);
  }
});
