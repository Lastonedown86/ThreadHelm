import { expect, test, type Locator, type Page } from '@playwright/test';
import { approveFolder, launchFixtureSession, type LaunchedApp } from './helpers/app.js';
import { approveViaUi, launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

async function press(locator: Locator, key = 'Enter'): Promise<void> {
  await locator.focus();
  await locator.page().keyboard.press(key);
}

async function openMemory(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  const toggle = page.getByRole('button', { name: 'Shared memory' });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await press(toggle);
}

test('keyboard-only shared-memory flow publishes, searches, inspects, retracts, and deletes', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const workspaceDir = tempWorkspace('memory-e2e');
  const page = app.page;
  try {
    await approveViaUi(app, workspaceDir);
    await openMemory(page);
    const region = page.getByRole('region', { name: 'Shared memory' });
    await expect(region).toBeVisible();

    await press(region.getByRole('button', { name: 'Publish memory…' }));
    const composer = page.getByRole('dialog', { name: 'Publish shared memory' });
    await expect(composer).toBeVisible();
    expect(await composer.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(composer).toBeHidden();
    await press(region.getByRole('button', { name: 'Publish memory…' }));
    await composer.getByLabel('Kind').selectOption('decision');
    await composer.getByLabel('Title').fill('Use deterministic retrieval');
    await composer
      .getByLabel('Body')
      .fill('ThreadHelm uses local FTS5 before any semantic retrieval upgrade.');
    await composer.getByLabel('Source reference').fill('research.md');
    await composer.getByLabel('Confidence').selectOption('high');
    await press(composer.getByRole('button', { name: 'Review publication' }));

    const review = page.getByRole('dialog', { name: 'Review durable memory publication' });
    await expect(review).toContainText('does not grant authority');
    await expect(review).toContainText('local FTS5');
    await press(review.getByRole('checkbox'), 'Space');
    await press(review.getByRole('button', { name: 'Publish memory' }));
    await expect(review).toBeHidden();

    const search = region.getByRole('searchbox', { name: 'Search shared memory' });
    await search.fill('deterministic retrieval');
    await search.press('Enter');
    const item = region
      .getByRole('list', { name: 'Shared memory results' })
      .getByRole('listitem')
      .first();
    await expect(item).toContainText('Use deterministic retrieval');
    await press(item.getByRole('button', { name: 'View details' }));

    const detail = page.getByRole('region', { name: 'Memory detail' });
    await expect(detail).toContainText('research.md');
    await expect(detail).toContainText('Confidence: High');
    await press(detail.getByRole('button', { name: 'Retract…' }));
    const retract = page.getByRole('dialog', { name: 'Retract memory revision' });
    await retract.getByLabel('Reason').fill('Owner withdrew this decision');
    await press(retract.getByRole('button', { name: 'Retract revision' }));
    await expect(detail).toContainText('Retracted');

    await press(detail.getByRole('button', { name: 'Delete content…' }));
    const deletion = page.getByRole('dialog', { name: 'Delete shared memory content' });
    await expect(deletion).toContainText('content-free lineage remains');
    await press(deletion.getByRole('checkbox'), 'Space');
    await press(deletion.getByRole('button', { name: 'Delete permanently' }));
    await expect(detail).toContainText('Content deleted');
    await search.fill('deterministic retrieval');
    await search.press('Enter');
    await expect(
      region.getByRole('list', { name: 'Shared memory results' }).getByRole('listitem'),
    ).toHaveCount(0);
  } finally {
    await teardown(app, workspaceDir);
  }
});

test('shared-memory conflict is superseded with both citations and resolved through the UI', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const workspaceDir = tempWorkspace('memory-conflict-e2e');
  try {
    const workspace = await approveFolder(app, workspaceDir);
    const session = await launchFixtureSession(app, workspace.id, 'codex-cli');
    const base = {
      kind: 'decision' as const,
      title: 'Conflict fixture subject',
      confidence: 'medium' as const,
    };
    await app.proposeProviderMemory(session.id, {
      ...base,
      body: 'The conflict fixture selects option alpha.',
      sourceRefs: [],
    });
    await app.proposeProviderMemory(session.id, {
      ...base,
      body: 'The conflict fixture selects option beta.',
      sourceRefs: [],
    });

    const page = app.page;
    await openMemory(page);
    const region = page.getByRole('region', { name: 'Shared memory' });
    await region.getByRole('checkbox', { name: 'Include contested' }).check();
    const search = region.getByRole('searchbox', { name: 'Search shared memory' });
    await search.fill('Conflict fixture subject');
    await search.press('Enter');
    const results = region
      .getByRole('list', { name: 'Shared memory results' })
      .getByRole('listitem');
    await expect(results).toHaveCount(2);
    await results.first().getByRole('button', { name: 'View details' }).click();

    const detail = page.getByRole('region', { name: 'Memory detail' });
    await expect(detail).toContainText('Contested');
    await detail.getByRole('button', { name: 'Supersede…' }).click();
    const supersede = page.getByRole('dialog', { name: 'Supersede shared memory' });
    await supersede.getByLabel('Body').fill('The cited resolution selects option gamma.');
    await supersede.getByRole('button', { name: 'Review supersession' }).click();
    await supersede.getByRole('button', { name: 'Append revision' }).click();
    await expect(detail).toContainText('Contested');
    await detail.getByRole('button', { name: 'Supersede…' }).click();
    const refreshedSupersede = page.getByRole('dialog', { name: 'Supersede shared memory' });
    await expect(refreshedSupersede.getByLabel('Body')).toHaveValue(
      'The cited resolution selects option gamma.',
    );
    await page.keyboard.press('Escape');
    await expect(refreshedSupersede).toBeHidden();
    await detail.getByRole('button', { name: 'Resolve with current cited revision' }).click();
    await expect(detail.getByText('Active', { exact: true })).toBeVisible();
    await expect(detail.getByText('Open conflicts')).toHaveCount(0);
    await expect(results).toHaveCount(1);
  } finally {
    await teardown(app, workspaceDir);
  }
});

async function publishFixtureMemory(
  app: LaunchedApp,
  workspaceId: string,
  body: string,
  memoryExpiresAt: string | null = null,
): Promise<void> {
  const preview = await app.call<{ publishToken: string }>('memory.previewPublish', {
    scope: { workspaceId },
    kind: 'fact',
    title: body,
    body,
    sourceRefs: [],
    confidence: 'unknown',
    memoryExpiresAt,
  });
  await app.call('memory.confirmPublish', {
    publishToken: preview.publishToken,
    durableContentConfirmation: true,
  });
}

test('shared-memory UI paginates explicitly and production reads expire due entries', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const workspaceDir = tempWorkspace('memory-pagination-e2e');
  try {
    const workspace = await approveFolder(app, workspaceDir);
    for (let index = 0; index < 21; index += 1) {
      await publishFixtureMemory(app, workspace.id, `pagination fixture marker ${index}`);
    }
    await publishFixtureMemory(
      app,
      workspace.id,
      'ephemeral production expiry marker',
      new Date(Date.now() + 500).toISOString(),
    );
    await new Promise((resolve) => setTimeout(resolve, 650));
    const expiredSearch = await app.call<{ items: unknown[] }>('memory.search', {
      scope: { workspaceId: workspace.id },
      query: 'ephemeral production expiry marker',
    });
    expect(expiredSearch.items).toEqual([]);

    const page = app.page;
    await openMemory(page);
    const region = page.getByRole('region', { name: 'Shared memory' });
    await expect(region.getByRole('checkbox', { name: 'Include contested' })).not.toBeChecked();
    const search = region.getByRole('searchbox', { name: 'Search shared memory' });
    await search.fill('pagination fixture marker');
    await search.press('Enter');
    const results = region
      .getByRole('list', { name: 'Shared memory results' })
      .getByRole('listitem');
    await expect(results).toHaveCount(20);
    await region.getByRole('checkbox', { name: 'Include contested' }).check();
    await expect(region.getByRole('button', { name: 'Load more memories' })).toHaveCount(0);
    await region.getByRole('checkbox', { name: 'Include contested' }).uncheck();
    await search.press('Enter');
    await expect(results).toHaveCount(20);
    await region.getByRole('button', { name: 'Load more memories' }).click();
    await expect(results).toHaveCount(21);
    await expect(region.getByRole('button', { name: 'Load more memories' })).toHaveCount(0);
  } finally {
    await teardown(app, workspaceDir);
  }
});

test('shared-memory presentation is a calm accessible list/detail surface without graph or animation', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  try {
    await openMemory(app.page);
    const region = app.page.getByRole('region', { name: 'Shared memory' });
    await expect(region).toBeVisible();
    await expect(region.locator('svg, canvas, [data-memory-graph]')).toHaveCount(0);
    const animated = await region.locator('*').evaluateAll(
      (elements) =>
        elements.filter((element) => {
          const style = getComputedStyle(element);
          return style.animationName !== 'none' || style.animationDuration !== '0s';
        }).length,
    );
    expect(animated).toBe(0);
  } finally {
    await teardown(app);
  }
});
