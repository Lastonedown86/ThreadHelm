/** Baseline audit observations, not assertions that the discovered defects are fixed. */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { version, release } from 'node:os';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp, approveFolder, type LaunchedApp } from '../../../../tests/e2e/helpers/app.js';
import { teardown, tempWorkspace } from '../../../../tests/e2e/helpers/ui.js';

const records: Record<string, unknown>[] = [];
const capture = (name: string) =>
  fileURLToPath(new URL(`../evidence/d8a5075-${name}.png`, import.meta.url));
function record(id: string, data: Record<string, unknown>) {
  records.push({ id, ...data });
  writeFileSync(
    new URL('../evidence/d8a5075-memory.json', import.meta.url),
    JSON.stringify(records, null, 2) + '\n',
  );
}
async function seed(app: LaunchedApp, workspaceId: string, title: string, body = title) {
  const preview = await app.call<OperationResponse<'memory.previewPublish'>>(
    'memory.previewPublish',
    {
      scope: { workspaceId },
      kind: 'fact',
      title,
      body,
      confidence: 'unknown',
      sourceRefs: [],
      memoryExpiresAt: null,
    },
  );
  return app.call<OperationResponse<'memory.confirmPublish'>>('memory.confirmPublish', {
    publishToken: preview.publishToken,
    durableContentConfirmation: true,
  });
}

test('observe guided search scope and paging selection', async () => {
  const app = await launchApp();
  const dirs = [tempWorkspace('memory-audit-a'), tempWorkspace('memory-audit-b')];
  try {
    await expect(app.page.locator('.status-bar')).toContainText('ThreadHelm v');
    const a = await approveFolder(app, dirs[0]!);
    const b = await approveFolder(app, dirs[1]!);
    const first = await seed(app, a.id, 'auditneedle scope alpha');
    const second = await seed(app, b.id, 'auditneedle scope beta');
    await app.page.getByRole('button', { name: 'Memory', exact: true }).click();
    const scope = app.page.getByLabel('Memory scope');
    await expect(scope).not.toHaveValue('');
    await expect(app.page.locator('.status-bar')).toContainText('ThreadHelm v');
    record('environment', {
      baseline: 'd8a50758ec4cfbcf8333509da078427a8f73ef8f',
      os: version(),
      release: release(),
      appBuild: await app.page.locator('.status-bar').innerText(),
      viewport: await app.page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        fontSize: getComputedStyle(document.documentElement).fontSize,
      })),
      fixtures: 'isolated approved temporary workspaces; no provider launch',
    });
    const initial = await scope.inputValue();
    const selected = initial === a.id ? b.id : a.id;
    await scope.selectOption(selected);
    const search = app.page.getByRole('searchbox', { name: 'Search shared memory' });
    await search.fill('auditneedle');
    await search.press('Enter');
    const results = app.page.getByRole('list', { name: 'Shared memory results' });
    await expect(results.getByRole('listitem')).toHaveCount(1);
    const before = await results.innerText();
    const oldPanel = await app.page.locator('.memory-panel').elementHandle();
    await app.page.getByLabel('Describe what you are looking for').fill('auditneedle');
    await app.page.getByRole('button', { name: 'Search the library', exact: true }).click();
    await expect.poll(() => oldPanel!.evaluate((el) => el.isConnected)).toBe(false);
    await expect(results.getByRole('listitem')).toHaveCount(1);
    record('M01-guided-scope', {
      initial,
      selected,
      afterScope: await scope.inputValue(),
      before,
      after: await results.innerText(),
      alpha: first.summary,
      beta: second.summary,
      live: await app.liveSessions(),
    });
    await scope.scrollIntoViewIfNeeded();
    await app.page.screenshot({ path: capture('guided-scope') });
    for (let i = 0; i < 21; i++) await seed(app, a.id, `pagingmarker ${i}`);
    await scope.selectOption(a.id);
    await search.fill('pagingmarker');
    await search.press('Enter');
    await expect(results.getByRole('listitem')).toHaveCount(20);
    await results
      .getByRole('listitem')
      .first()
      .getByRole('button', { name: 'View details' })
      .click();
    await expect(app.page.getByRole('region', { name: 'Memory detail' })).toBeVisible();
    const beforeDetail = await app.page.getByRole('region', { name: 'Memory detail' }).innerText();
    await app.page.getByRole('button', { name: 'Load more memories' }).click();
    await expect(results.getByRole('listitem')).toHaveCount(21);
    record('M02-paging-detail', {
      beforeDetail,
      resultCount: await results.getByRole('listitem').count(),
      detailAfter: await app.page.getByRole('region', { name: 'Memory detail' }).count(),
      authoritative: await app.call('memory.search', {
        scope: { workspaceId: a.id },
        query: 'pagingmarker',
        limit: 20,
      }),
    });
  } finally {
    await teardown(app, ...dirs);
  }
});

test('observe reviewed editing, reading-list lifecycle and restart', async () => {
  let app = await launchApp();
  const dir = tempWorkspace('memory-audit-edit');
  try {
    const workspace = await approveFolder(app, dir);
    let page = app.page;
    await page.getByRole('button', { name: 'Memory', exact: true }).click();
    await page.getByRole('button', { name: 'Publish memory', exact: false }).click();
    const publish = page.getByRole('dialog', { name: 'Publish shared memory' });
    await publish.getByLabel('Title').fill('Audit exact memory');
    await publish.getByLabel('Body').fill('Initial audit evidence.');
    await publish.getByRole('button', { name: 'Review publication' }).click();
    const review = page.getByRole('dialog', { name: 'Review durable memory publication' });
    await review.getByRole('checkbox').check();
    await review.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(review).toBeHidden();
    let found = await app.call<OperationResponse<'memory.search'>>('memory.search', {
      scope: { workspaceId: workspace.id },
      query: 'Audit exact memory',
    });
    const entryId = found.items[0]!.entryId;
    const read = () =>
      app.call<OperationResponse<'memory.get'>>('memory.get', {
        entryId,
        scope: { workspaceId: workspace.id },
      });
    record('M03-publish-readback', { saved: await read(), live: await app.liveSessions() });
    const detail = page.getByRole('region', { name: 'Memory detail' });
    await detail.getByRole('button', { name: 'Supersede', exact: false }).click();
    const edit = page.getByRole('dialog', { name: 'Supersede shared memory' });
    await edit.getByLabel('Body').fill('Reviewed audit replacement.');
    await edit.getByRole('button', { name: 'Review supersession' }).click();
    await expect(edit.getByRole('button', { name: 'Append revision' })).toBeVisible();
    await edit.getByLabel('Body').fill('Later visible edit after review.');
    const displayedBeforeAppend = await edit.getByLabel('Body').inputValue();
    await page.screenshot({ path: capture('supersede-after-edit') });
    await edit.getByRole('button', { name: 'Append revision' }).click();
    await expect(edit).toBeHidden();
    await expect(detail).toContainText('Reviewed audit replacement.');
    record('M04-supersede-stale-review', { displayedBeforeAppend, saved: await read() });
    await page.getByRole('button', { name: 'Add exact edition to reading list' }).click();
    await page.getByRole('button', { name: 'Add exact edition to reading list' }).click();
    const reading = page.getByRole('region', { name: 'Reading list', exact: true });
    await expect(reading.getByRole('listitem')).toHaveCount(1);
    await detail.getByRole('button', { name: 'Retract', exact: false }).click();
    const retract = page.getByRole('dialog', { name: 'Retract memory revision' });
    await retract.getByLabel('Reason').fill('Audit withdrew this revision');
    await retract.getByRole('button', { name: 'Retract revision' }).click();
    await expect(detail).toContainText('Retracted');
    record('M05-reading-retracted', { reading: await reading.innerText(), saved: await read() });
    await detail.getByRole('button', { name: 'Delete content', exact: false }).click();
    const deletion = page.getByRole('dialog', { name: 'Delete shared memory content' });
    await deletion.getByRole('checkbox').check();
    await deletion.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(detail).toContainText('Content deleted');
    record('M06-reading-deleted', { reading: await reading.innerText(), saved: await read() });
    await reading.scrollIntoViewIfNeeded();
    await page.screenshot({ path: capture('reading-deleted') });
    await page.getByRole('button', { name: 'Agents', exact: true }).click();
    await page.getByRole('button', { name: 'Memory', exact: true }).click();
    record('M07-reading-return', {
      count: await reading.getByRole('listitem').count(),
      saved: await read(),
    });
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    page = app.page;
    found = await app.call('memory.search', {
      scope: { workspaceId: workspace.id },
      query: 'Audit exact memory',
    });
    record('M08-deletion-restart', {
      saved: await read(),
      searchResults: found.items,
      live: await app.liveSessions(),
    });
  } finally {
    await teardown(app, dir);
  }
});
