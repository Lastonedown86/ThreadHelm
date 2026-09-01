import { expect, test } from '@playwright/test';
import { launchApp } from './helpers/app.js';
import { teardown } from './helpers/ui.js';

test('missions are the focused default and legacy destinations remain explicit', async () => {
  const app = await launchApp();
  const page = app.page;
  try {
    await expect(page.getByRole('button', { name: 'Missions', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('heading', { name: 'Start a mission', exact: true })).toBeVisible();
    await expect(page.getByText('Local coordinator · sole writer', { exact: true })).toBeVisible();
    await expect(
      page.getByText('External actions · approval required', { exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sessions', exact: true })).toBeAttached();
    await expect(page.getByText('Existing sessions controls remain unchanged')).toBeVisible();

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  } finally {
    await teardown(app);
  }
});
