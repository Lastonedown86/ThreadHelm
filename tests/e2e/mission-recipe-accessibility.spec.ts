import { test, expect, type Page, type Locator } from '@playwright/test';
import { cleanupUserData, launchApp } from './helpers/app.js';

/** Reach controls through the actual tab order, never programmatic focus. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 160; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Control unreachable by Tab: ${await target.getAttribute('aria-label')}`);
}

for (const scale of [1, 2]) {
  test(`recipe keyboard preview, editor and modal focus at ${scale * 100}% text scale`, async () => {
    const app = await launchApp();
    const page = app.page;
    try {
      await page.setViewportSize({ width: 960, height: 800 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      // Text-only scaling exercises layout independently of viewport zoom.
      await page.addStyleTag({ content: `html { font-size: ${scale * 100}% !important; }` });
      const button = (name: string) => page.getByRole('button', { name, exact: true });
      await tabTo(page, button('Start from recipe'));
      await page.keyboard.press('Enter');
      await tabTo(page, button('Investigate a bug'));
      await page.keyboard.press('Enter');
      const symptom = page.getByLabel('Symptom (required)');
      await tabTo(page, symptom);
      await page.keyboard.type('Keyboard investigation');
      const describedBy = await symptom.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      await expect(page.locator(`[id="${describedBy}"]`)).toContainText('2,000');
      await tabTo(page, button('Preview draft'));
      await page.keyboard.press('Space');
      await expect(page.getByRole('heading', { name: 'Draft preview', exact: true })).toBeFocused();
      await tabTo(page, button('Create draft'));
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Define one finish line.' })).toBeVisible();
      await tabTo(page, button('Close'));
      await page.keyboard.press('Enter');
      await tabTo(page, button('Start from recipe'));
      await page.keyboard.press('Enter');
      await tabTo(page, button('New personal recipe'));
      await page.keyboard.press('Enter');
      const name = page.getByLabel('Recipe name', { exact: false });
      await tabTo(page, name);
      await page.keyboard.type('Keyboard personal recipe');
      await tabTo(page, page.getByLabel('Outcome scaffold', { exact: false }));
      await page.keyboard.type('Investigate the selected issue.');
      await tabTo(page, button('Preview saved recipe'));
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('heading', { name: 'Saved recipe preview', exact: true }),
      ).toBeFocused();
      await tabTo(page, button('Save personal recipe'));
      await page.keyboard.press('Enter');
      await expect(button('Edit recipe')).toBeVisible();
      await tabTo(page, button('Delete personal recipe'));
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Delete personal recipe' });
      await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
        expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(button('Delete personal recipe')).toBeFocused();
      await tabTo(page, button('Edit recipe'));
      await page.keyboard.press('Enter');
      await expect(name).toHaveValue('Keyboard personal recipe');
      await tabTo(page, name);
      const focus = await name.evaluate((el) => {
        const style = getComputedStyle(el);
        return { outline: style.outlineStyle, shadow: style.boxShadow };
      });
      expect(focus.outline !== 'none' || focus.shadow !== 'none').toBe(true);
      await page.setViewportSize({ width: 640, height: 800 });
      await tabTo(page, button('Discard editor'));
      await expect(button('Discard editor')).toBeInViewport();
      expect(
        await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      ).toBe(true);
      expect(await app.liveSessions()).toEqual([]);
      await test.info().attach(`keyboard-${scale * 100}.png`, {
        body: await page.screenshot({
          path: test.info().outputPath(`keyboard-${scale * 100}.png`),
        }),
        contentType: 'image/png',
      });
      test.info().annotations.push({
        type: 'scope',
        description:
          'Automated keyboard and text scaling only; manual contrast, OS text scaling, source selection and five-person usability study remain separate.',
      });
    } finally {
      await app.close();
      cleanupUserData(app.userData);
    }
  });
}
