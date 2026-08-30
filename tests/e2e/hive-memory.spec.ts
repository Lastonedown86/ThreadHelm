import { expect, test, type Locator } from '@playwright/test';
import { approveViaUi, launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

async function press(locator: Locator, key = 'Enter'): Promise<void> {
  await locator.focus();
  await locator.page().keyboard.press(key);
}

test('keyboard-only shared-memory flow publishes, searches, inspects, retracts, and deletes', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const workspaceDir = tempWorkspace('memory-e2e');
  const page = app.page;
  try {
    await approveViaUi(app, workspaceDir);
    await press(page.getByRole('button', { name: 'Shared memory' }));
    const region = page.getByRole('region', { name: 'Shared memory' });
    await expect(region).toBeVisible();

    await press(region.getByRole('button', { name: 'Publish memory…' }));
    const composer = page.getByRole('dialog', { name: 'Publish shared memory' });
    await composer.getByLabel('Kind').selectOption('decision');
    await composer.getByLabel('Title').fill('Use deterministic retrieval');
    await composer
      .getByLabel('Body')
      .fill('ThreadHelm uses local FTS5 before any semantic retrieval upgrade.');
    await composer.getByLabel('Source reference').fill('research.md');
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

test('shared-memory presentation is a calm accessible list/detail surface without graph or animation', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  try {
    await press(app.page.getByRole('button', { name: 'Shared memory' }));
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
