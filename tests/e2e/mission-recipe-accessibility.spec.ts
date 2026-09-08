import { test, expect, type Page, type Locator } from '@playwright/test';
import { cleanupUserData, launchApp } from './helpers/app.js';
import type { MissionComposerDraftDetailView, MissionRecipeDetail } from '@threadhelm/contracts';
import { mkdirSync, writeFileSync } from 'node:fs';

/** Reach controls through the actual tab order, never programmatic focus. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 160; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Control unreachable by Tab: ${await target.getAttribute('aria-label')}`);
}

/** Computed sRGB text against composited solid ancestor backgrounds; no screenshot inference. */
async function contrastSamples(page: Page, state: string) {
  return page.locator('.recipe-workspace').evaluate((root, state) => {
    const rgb = (value: string) => {
      const values = value.match(/[\d.]+/g)?.map(Number);
      return values && values.length >= 3
        ? [values[0]!, values[1]!, values[2]!, values[3] ?? 1]
        : null;
    };
    const compose = (fg: number[], bg: number[]) =>
      fg.slice(0, 3).map((v, i) => v * fg[3]! + bg[i]! * (1 - fg[3]!));
    const luminance = (color: number[]) =>
      color
        .slice(0, 3)
        .map((v) => {
          const n = v / 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i]!, 0);
    return [
      ...root.querySelectorAll<HTMLElement>(
        'h1,h2,h3,h4,p,small,span,label,legend,button,input,textarea,select',
      ),
    ]
      .filter((el) => {
        const s = getComputedStyle(el);
        return (
          el.getClientRects().length > 0 &&
          s.visibility !== 'hidden' &&
          !el.matches(':disabled') &&
          !!(el.textContent?.trim() || (el as HTMLInputElement).value)
        );
      })
      .map((el) => {
        const style = getComputedStyle(el);
        const ancestors: HTMLElement[] = [];
        for (let node: HTMLElement | null = el; node; node = node.parentElement)
          ancestors.push(node);
        const unsupported = ancestors.some((node) => {
          const s = getComputedStyle(node);
          return Number(s.opacity) !== 1 || s.backgroundImage !== 'none' || s.filter !== 'none';
        });
        let background = [255, 255, 255];
        for (const node of ancestors.reverse()) {
          const color = rgb(getComputedStyle(node).backgroundColor);
          if (color) background = compose(color, background);
        }
        const foreground = rgb(style.color);
        const size = parseFloat(style.fontSize);
        const large = size >= 24 || (size >= 18.6667 && Number(style.fontWeight) >= 700);
        const a = luminance(foreground ? compose(foreground, background) : background);
        const b = luminance(background);
        return {
          state,
          element: el.tagName,
          label: (
            el.getAttribute('aria-label') ||
            el.textContent ||
            (el as HTMLInputElement).value ||
            ''
          )
            .trim()
            .slice(0, 90),
          foreground: style.color,
          background,
          fontSize: size,
          fontWeight: style.fontWeight,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          required: large ? 3 : 4.5,
          unsupported,
        };
      });
  }, state);
}

test('keyboard source selection and one-shot save failures preserve input with measured text contrast', async () => {
  const app = await launchApp();
  const page = app.page;
  const samples: Awaited<ReturnType<typeof contrastSamples>> = [];
  try {
    const source = await app.call<MissionComposerDraftDetailView>('missionComposer.createDraft');
    await app.call('missionComposer.updateDraft', {
      draftId: source.draftId,
      expectedVersion: source.version,
      currentStage: 'outcome',
      fieldValues: {
        objective: 'Keyboard selected source',
        completionEvidence: 'Excluded source checklist',
      },
    });
    // One rejected IPC request, then the real router. No live storage damage or providers.
    await app.app.evaluate(({ ipcMain }) => {
      const globals = globalThis as unknown as {
        __threadhelmTest: { dispatch(name: string, payload: unknown): unknown };
      };
      for (const name of ['missionRecipes.previewSource', 'missionRecipes.saveEditor']) {
        let fail = true;
        ipcMain.removeHandler(`op:${name}`);
        ipcMain.handle(`op:${name}`, (_event, payload: unknown) => {
          if (fail) {
            fail = false;
            return {
              ok: false,
              error: {
                code: 'STORAGE_UNAVAILABLE',
                message: 'Local fixture save failure',
                details: {},
              },
            };
          }
          return globals.__threadhelmTest.dispatch(name, payload);
        });
      }
    });
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    await tabTo(page, page.getByRole('button', { name: /Resume draft.*Keyboard selected source/ }));
    await page.keyboard.press('Enter');
    await tabTo(page, button('Save as recipe'));
    await page.keyboard.press('Enter');
    const outcome = page.getByLabel('Outcome', { exact: true });
    for (const label of ['Outcome', 'Acceptance checklist', 'Inert role suggestions'])
      await expect(page.getByLabel(label, { exact: true })).not.toBeChecked();
    await expect(button('Preview selected content')).toBeDisabled();
    samples.push(...(await contrastSamples(page, 'unselected-source')));
    await tabTo(page, outcome);
    await page.keyboard.press('Space');
    await tabTo(page, button('Preview selected content'));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText('storage is unavailable');
    await expect(outcome).toBeChecked();
    samples.push(...(await contrastSamples(page, 'source-preview-failure')));
    await tabTo(page, button('Preview selected content'));
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Selected outcome')).toHaveValue('Keyboard selected source');
    await expect(page.getByLabel('Selected checklist item 1')).toHaveCount(0);
    await tabTo(page, page.getByLabel('Selected outcome'));
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Reviewed keyboard source');
    await tabTo(page, button('Use selected content'));
    await page.keyboard.press('Enter');
    const name = page.getByLabel('Recipe name');
    await tabTo(page, name);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Keyboard recovery recipe');
    await expect(page.getByText('Save failed', { exact: true })).toBeVisible();
    await expect(name).toHaveValue('Keyboard recovery recipe');
    await expect(page.getByLabel('Outcome scaffold')).toHaveValue('Reviewed keyboard source');
    samples.push(...(await contrastSamples(page, 'editor-save-failure')));
    await tabTo(page, button('Retry local save'));
    await page.keyboard.press('Enter');
    await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
    await tabTo(page, button('Preview saved recipe'));
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'Saved recipe preview', exact: true }),
    ).toBeFocused();
    samples.push(...(await contrastSamples(page, 'reviewed-save')));
    await tabTo(page, button('Save personal recipe'));
    await page.keyboard.press('Enter');
    await expect(button('Edit recipe')).toBeVisible();
    samples.push(...(await contrastSamples(page, 'saved-recipe')));
    const list = await app.call<{ items: MissionRecipeDetail[] }>('missionRecipes.list', {
      origin: 'personal',
    });
    expect(list.items).toHaveLength(1);
    const saved = await app.call<MissionRecipeDetail>('missionRecipes.get', {
      recipeId: list.items[0]!.recipeId,
    });
    expect(saved.content?.outcomeScaffold).toBe('Reviewed keyboard source');
    expect(saved.content?.acceptanceChecklist).toEqual([]);
    const unchanged = await app.call<MissionComposerDraftDetailView>('missionComposer.getDraft', {
      draftId: source.draftId,
    });
    expect(unchanged.fieldValues.objective).toBe('Keyboard selected source');
    expect(unchanged.fieldValues.completionEvidence).toBe('Excluded source checklist');
    expect(await app.liveSessions()).toEqual([]);
    expect(samples.filter((sample) => !sample.unsupported).length).toBeGreaterThan(20);
    for (const sample of samples.filter((item) => !item.unsupported))
      expect
        .soft(sample.ratio, `${sample.state}: ${sample.element} ${sample.label}`)
        .toBeGreaterThanOrEqual(sample.required);
  } finally {
    mkdirSync(test.info().outputDir, { recursive: true });
    const report = {
      samples,
      limitations: [
        'Computed solid-color text contrast only; opacity, filter and background-image cases excluded.',
        'Focus/non-text contrast, hover states, forced colors and true Windows OS scaling require separate checks.',
        'CSS text scaling is not Windows OS accessibility scaling.',
      ],
    };
    const path = test.info().outputPath('recipe-rendered-contrast.json');
    writeFileSync(path, JSON.stringify(report, null, 2));
    await test
      .info()
      .attach('recipe-rendered-contrast.json', { path, contentType: 'application/json' });
    await app.close();
    cleanupUserData(app.userData);
  }
});

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
