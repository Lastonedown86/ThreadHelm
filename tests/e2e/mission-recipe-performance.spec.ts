import { test, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { cpus, platform, release, totalmem } from 'node:os';
import type {
  MissionRecipeContent,
  MissionRecipeEditor,
  MissionRecipeReceipt,
} from '@threadhelm/contracts';
import { cleanupUserData, launchApp, mainEntry } from './helpers/app.js';

test('Windows recipe list, maximum-compatible preview, memory and settled idle budgets', async () => {
  test.skip(process.platform !== 'win32', 'Windows performance acceptance requires Windows.');
  test.setTimeout(300_000);
  const app = await launchApp();
  const page = app.page;
  const report: Record<string, unknown> = {
    machine: {
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model,
      ramBytes: totalmem(),
    },
    viewport: { width: 960, height: 800 },
    textScale: '100%',
    powerMode: execFileSync('powercfg.exe', ['/getactivescheme'], { encoding: 'utf8' }).trim(),
    mainBuildSha256: createHash('sha256').update(readFileSync(mainEntry)).digest('hex'),
    fixture:
      '500 total, 3 bundled and 497 personal; duplicate names and disabled rows. Unsupported-version library fixture remains separate.',
  };
  try {
    await page.setViewportSize({ width: 960, height: 800 });
    const save = async (content: MissionRecipeContent) => {
      const editor = await app.call<MissionRecipeEditor>('missionRecipes.openEditor');
      const updated = await app.call<MissionRecipeEditor>('missionRecipes.saveEditor', {
        editorId: editor.editorId,
        expectedVersion: editor.version,
        content,
      });
      const preview = await app.call<{ previewId: string }>('missionRecipes.previewSave', {
        editorId: updated.editorId,
        expectedVersion: updated.version,
      });
      return app.call<MissionRecipeReceipt>('missionRecipes.save', {
        previewId: preview.previewId,
        requestId: randomUUID(),
      });
    };
    for (let i = 0; i < 496; i++) {
      const saved = await save({
        name: `Fixture recipe ${i % 100}`,
        description: 'Local performance fixture',
        outcomeScaffold: 'Investigate the selected issue.',
        acceptanceChecklist: ['Record findings.'],
        suggestedRoles: ['Investigator'],
        variables: [],
      });
      if (i % 10 === 0)
        await app.call('missionRecipes.setEnabled', {
          recipeId: saved.targetId,
          expectedVersion: saved.version,
          enabled: false,
          requestId: randomUUID(),
        });
    }
    // 4,000 outcome + 2,000 checklist + 58,000 suggested role units = 64,000.
    await save({
      name: 'Maximum compatible fixture',
      description: 'Twenty bounded literal variables',
      outcomeScaffold: '{{v0}}{{v1}}{{v2}}{{v3}}',
      acceptanceChecklist: ['{{v4}}', '{{v5}}'],
      suggestedRoles: [
        ...Array.from({ length: 11 }, () => '{{v6}}{{v7}}{{v8}}{{v9}}{{v10}}'),
        '{{v11}}{{v12}}{{v13}}',
      ],
      variables: Array.from({ length: 20 }, (_, i) => ({
        key: `v${i}`,
        label: `Value ${i}`,
        required: true,
      })),
    });
    const cdp = await page.context().newCDPSession(page);
    const memory = async () => ({
      workingSetKiB: await app.app.evaluate(({ app: electronApp, BrowserWindow }) => {
        const pid = BrowserWindow.getAllWindows()[0]!.webContents.getOSProcessId();
        return (
          electronApp.getAppMetrics().find((m) => m.pid === pid)?.memory.workingSetSize ?? null
        );
      }),
      heap: await cdp.send('Runtime.getHeapUsage'),
    });
    await cdp.send('HeapProfiler.collectGarbage');
    const baseline = await memory();
    const openings: number[] = [];
    let firstOpenMemory: Awaited<ReturnType<typeof memory>> | undefined;
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await page.getByRole('button', { name: 'Start from recipe', exact: true }).click();
      await expect(
        page.getByRole('list', { name: 'Recipes', exact: true }).getByRole('listitem'),
      ).toHaveCount(50);
      await expect(page.getByRole('button', { name: 'Refresh list', exact: true })).toBeEnabled();
      openings.push(performance.now() - start);
      if (i === 0) firstOpenMemory = await memory();
      await page.getByRole('button', { name: 'Close recipes', exact: true }).click();
    }
    await cdp.send('HeapProfiler.collectGarbage');
    const retained = await memory();
    report.openingsMs = openings;
    report.coldFirstOpeningMs = openings[0];
    report.memory = { baseline, firstOpenMemory, retained };
    await page.getByRole('button', { name: 'Start from recipe', exact: true }).click();
    const seen: string[] = [];
    let maxMounted = 0;
    for (;;) {
      const rows = page.getByRole('list', { name: 'Recipes', exact: true }).getByRole('listitem');
      await expect(page.getByRole('button', { name: 'Refresh list', exact: true })).toBeEnabled();
      const current = await rows.allTextContents();
      maxMounted = Math.max(maxMounted, current.length);
      seen.push(...current);
      const more = page.getByRole('button', { name: 'Load more recipes', exact: true });
      if (!(await more.count())) break;
      const before = await rows.first().textContent();
      await more.click();
      await expect(rows.first()).not.toHaveText(before!);
    }
    report.pagination = { reachableRows: seen.length, uniqueRows: new Set(seen).size, maxMounted };
    await page.getByRole('button', { name: 'Refresh list', exact: true }).click();
    const maximum = page.getByRole('button', { name: 'Maximum compatible fixture', exact: true });
    while (!(await maximum.count())) {
      await page.getByRole('button', { name: 'Load more recipes', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Refresh list', exact: true })).toBeEnabled();
    }
    await maximum.click();
    for (let i = 0; i < 20; i++)
      await page.getByLabel(`Value ${i} (required)`).fill('x'.repeat(i === 5 ? 999 : 1000));
    await page.evaluate(() => {
      const target = window as unknown as { recipeLongTasks: number[] };
      target.recipeLongTasks = [];
      new PerformanceObserver((list) =>
        target.recipeLongTasks.push(...list.getEntries().map((e) => e.duration)),
      ).observe({ type: 'longtask' });
    });
    const previews: number[] = [];
    for (let i = 0; i < 20; i++) {
      await page.getByLabel('Value 19 (required)').fill((i % 2 ? 'y' : 'x').repeat(1000));
      const start = performance.now();
      await page.getByRole('button', { name: 'Preview draft', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toBeEnabled();
      await expect(page.getByRole('heading', { name: 'Draft preview', exact: true })).toBeFocused();
      previews.push(performance.now() - start);
    }
    report.previewsMs = previews;
    report.rendererLongTasksMs = await page.evaluate(
      () => (window as unknown as { recipeLongTasks: number[] }).recipeLongTasks,
    );
    // Incompatible expanded outcome is rejected without silently trimming retained values.
    await page.getByLabel('Value 0 (required)').fill('x'.repeat(2000));
    const rejectStart = performance.now();
    await page.getByRole('button', { name: 'Preview draft', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Draft preview', exact: true }).getByRole('alert'),
    ).toBeVisible();
    report.incompatiblePreviewMs = performance.now() - rejectStart;
    await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Value 0 (required)')).toHaveValue('x'.repeat(2000));
    // Observe only recipe-owned DOM; the rest of the desktop can have unrelated activity.
    await page.evaluate(() => {
      const state = window as unknown as { recipeIdleMutations: number };
      state.recipeIdleMutations = 0;
      new MutationObserver((records) => {
        state.recipeIdleMutations += records.length;
      }).observe(document.querySelector('.recipe-workspace')!, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
    });
    await page.waitForTimeout(60_000);
    const idle = await page.evaluate(() => ({
      mutations: (window as unknown as { recipeIdleMutations: number }).recipeIdleMutations,
      runningAnimations: document
        .querySelector('.recipe-workspace')!
        .getAnimations({ subtree: true })
        .filter((a) => a.playState === 'running').length,
    }));
    report.idle = {
      seconds: 60,
      ...idle,
      polling:
        'IPC polling is not instrumented by this test; requires source audit or router instrumentation.',
    };
    expect(openings.filter((ms) => ms <= 1000).length).toBeGreaterThanOrEqual(19);
    expect(previews.filter((ms) => ms <= 2000).length).toBeGreaterThanOrEqual(19);
    expect(seen).toHaveLength(500);
    expect(new Set(seen).size).toBe(500);
    expect(maxMounted).toBeLessThanOrEqual(50);
    expect(Math.max(0, ...(report.rendererLongTasksMs as number[]))).toBeLessThanOrEqual(100);
    expect(firstOpenMemory!.workingSetKiB).not.toBeNull();
    expect(firstOpenMemory!.workingSetKiB! - baseline.workingSetKiB!).toBeLessThanOrEqual(
      64 * 1024,
    );
    expect(retained.workingSetKiB! - baseline.workingSetKiB!).toBeLessThanOrEqual(10 * 1024);
    expect(idle).toEqual({ mutations: 0, runningAnimations: 0 });
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    mkdirSync(test.info().outputDir, { recursive: true });
    writeFileSync(
      test.info().outputPath('recipe-performance.json'),
      JSON.stringify(report, null, 2),
    );
    await test.info().attach('recipe-performance.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
    console.log('Recipe performance measurements:', JSON.stringify(report));
    await app.close();
    cleanupUserData(app.userData);
  }
});
