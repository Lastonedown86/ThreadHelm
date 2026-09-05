import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp, approveFolder } from './helpers/app.js';
import { teardown, tempWorkspace } from './helpers/ui.js';

test('guided queries retain explicit scope and ignore late search and detail responses', async () => {
  const app = await launchApp();
  const dirs = [tempWorkspace('scope-a'), tempWorkspace('scope-b')];
  try {
    await expect(app.page.locator('.status-bar')).toContainText('ThreadHelm v');
    const workspaces = [await approveFolder(app, dirs[0]!), await approveFolder(app, dirs[1]!)];
    for (const [i, w] of workspaces.entries()) {
      const p = await app.call<OperationResponse<'memory.previewPublish'>>(
        'memory.previewPublish',
        {
          scope: { workspaceId: w.id },
          kind: 'fact',
          title: `needle workspace ${i}`,
          body: `unique body ${i}`,
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
    await app.page.getByRole('button', { name: 'Memory', exact: true }).click();
    const scope = app.page.getByLabel('Memory scope');
    await expect(scope).not.toHaveValue('');
    const initial = await scope.inputValue();
    const chosen = workspaces.find((w) => w.id !== initial)!;
    await scope.selectOption(chosen.id);
    const direct = app.page.getByRole('searchbox', { name: 'Search shared memory' });
    const guided = app.page.getByLabel('Describe what you are looking for');
    const submit = app.page.getByRole('button', { name: 'Search the library', exact: true });
    const results = app.page.getByRole('list', { name: 'Shared memory results' });
    await app.page.getByLabel('Include contested').check();
    await direct.fill('needle');
    await direct.press('Enter');
    await expect(results.getByRole('listitem')).toHaveCount(1);
    const expected = await app.call<OperationResponse<'memory.search'>>('memory.search', {
      scope: { workspaceId: chosen.id },
      query: 'needle',
    });
    await guided.fill('unique');
    await submit.click();
    await expect(direct).toHaveValue('unique');
    await expect(scope).toHaveValue(chosen.id);
    await expect(app.page.getByLabel('Include contested')).toBeChecked();
    await expect(results).toContainText(expected.items[0]!.title!);
    await app.page.screenshot({
      path: fileURLToPath(
        new URL(
          '../../specs/004-sidebar-workspace-ux/audits/evidence/slice-5-memory-scope.png',
          import.meta.url,
        ),
      ),
    });
    // Main-side renderer IPC gate; independent app.call still dispatches real reads.
    await app.app.evaluate(({ ipcMain }) => {
      const g = globalThis as unknown as {
        __threadhelmTest: { dispatch(op: string, p: unknown): Promise<unknown> };
        memoryGate: { pending: Array<() => void>; hold: boolean; searches: number };
      };
      g.memoryGate = { pending: [], hold: true, searches: 0 };
      for (const op of ['memory.search', 'memory.get']) {
        ipcMain.removeHandler(`op:${op}`);
        ipcMain.handle(`op:${op}`, async (_event, p: unknown) => {
          if (op === 'memory.search') g.memoryGate.searches++;
          const result = await g.__threadhelmTest.dispatch(op, p);
          if (g.memoryGate.hold)
            await new Promise<void>((resolve) => g.memoryGate.pending.push(resolve));
          return result;
        });
      }
    });
    await results.getByRole('button', { name: 'View details' }).click();
    await submit.click();
    await expect
      .poll(() =>
        app.app.evaluate(
          () =>
            (globalThis as unknown as { memoryGate: { pending: unknown[] } }).memoryGate.pending
              .length,
        ),
      )
      .toBe(2);
    await scope.selectOption(initial);
    await app.app.evaluate(
      () => ((globalThis as unknown as { memoryGate: { hold: boolean } }).memoryGate.hold = false),
    );
    await guided.fill('needle');
    await submit.click();
    const other = await app.call<OperationResponse<'memory.search'>>('memory.search', {
      scope: { workspaceId: initial },
      query: 'needle',
    });
    await expect(results).toContainText(other.items[0]!.title!);
    await app.app.evaluate(() => {
      for (const done of (
        globalThis as unknown as { memoryGate: { pending: Array<() => void> } }
      ).memoryGate.pending.splice(0))
        done();
    });
    // A renderer round trip after releasing IPC lets the queued responses settle.
    await app.page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(scope).toHaveValue(initial);
    await expect(results).toContainText(other.items[0]!.title!);
    await expect(app.page.getByRole('region', { name: 'Memory detail' })).toHaveCount(0);
    await submit.click();
    await expect
      .poll(() =>
        app.app.evaluate(
          () => (globalThis as unknown as { memoryGate: { searches: number } }).memoryGate.searches,
        ),
      )
      .toBe(3);
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app, ...dirs);
  }
});
