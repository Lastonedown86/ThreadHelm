import { expect, test } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { approveViaUi, launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

const ideas = (label: string) =>
  [1, 2, 3].map((n) => ({
    title: `${label} idea ${n}`,
    rationale: 'Fixture evidence',
    proposedObjective: `${label} objective ${n}`,
    proposedCompletionEvidence: 'A focused report',
  }));

test('repository changes invalidate ideas and chosen source survives save and restart', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const dirs = [tempWorkspace('ideas-a'), tempWorkspace('ideas-b')];
  try {
    const paths = [await approveViaUi(app, dirs[0]!), await approveViaUi(app, dirs[1]!)];
    await app.fakeRepoIdeas(ideas('First'));
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    const repo = app.page.getByRole('combobox', { name: 'Repo', exact: true });
    await app.page
      .getByRole('combobox', { name: 'Generation provider', exact: true })
      .selectOption('codex-cli');
    await repo.selectOption({ label: paths[0]! });
    await app.page.getByRole('button', { name: 'Generate ideas', exact: true }).click();
    await expect(app.page.getByRole('heading', { name: 'First idea 1' })).toBeVisible();
    await repo.selectOption({ label: paths[1]! });
    const sourceId = await repo.inputValue();
    await expect(app.page.getByRole('button', { name: 'Use this idea' })).toHaveCount(0);
    await app.fakeRepoIdeas(ideas('Second'));
    await app.page.getByRole('button', { name: 'Generate ideas', exact: true }).click();
    await app.page
      .getByRole('listitem')
      .filter({ hasText: 'Second idea 1' })
      .getByRole('button', { name: 'Use this idea' })
      .click();
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Second objective 1',
    );
    await expect(app.page.getByLabel('Idea source', { exact: true })).toContainText(paths[1]!);
    await app.page.getByLabel('Finish line', { exact: true }).fill('Edited second objective');
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    const saved = (
      await app.call<OperationResponse<'missionComposer.listDrafts'>>('missionComposer.listDrafts')
    ).drafts[0]!;
    const detail = await app.call<OperationResponse<'missionComposer.getDraft'>>(
      'missionComposer.getDraft',
      { draftId: saved.draftId },
    );
    expect(detail.fieldValues.repoIdeaSource).toMatchObject({
      workspaceId: sourceId,
      providerId: 'codex-cli',
      workspacePath: paths[1],
      ideaTitle: 'Second idea 1',
    });
    expect(detail.fieldValues.objective).toBe('Edited second objective');
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    await app.page
      .locator(`#mission-draft-${saved.draftId}`)
      .getByRole('button', { name: /^Resume draft/ })
      .click();
    await expect(app.page.getByLabel('Idea source', { exact: true })).toContainText(paths[1]!);
    await expect(app.page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Edited second objective',
    );
    expect(await app.liveSessions()).toHaveLength(0);
    await app.page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-25-idea-source.png',
    });
  } finally {
    await teardown(app, ...dirs);
  }
});

test('late generation is ignored after input changes and revoked folders lose selectable ideas', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const dirs = [tempWorkspace('late-ideas-a'), tempWorkspace('late-ideas-b')];
  try {
    const paths = [await approveViaUi(app, dirs[0]!), await approveViaUi(app, dirs[1]!)];
    await app.fakeRepoIdeas(ideas('Fresh'));
    await app.app.evaluate(({ ipcMain }, value) => {
      const g = globalThis as unknown as {
        releaseIdeas: () => void;
        ideaCalls: number;
        __threadhelmTest: { dispatch(name: string, payload?: unknown): Promise<unknown> };
      };
      g.ideaCalls = 0;
      ipcMain.removeHandler('op:missionComposer.proposeRepoIdeas');
      ipcMain.handle('op:missionComposer.proposeRepoIdeas', async (_event, payload) => {
        g.ideaCalls++;
        if (g.ideaCalls === 1) {
          await new Promise<void>((resolve) => {
            g.releaseIdeas = resolve;
          });
          return { ok: true, value: { ideas: value } };
        }
        return g.__threadhelmTest.dispatch('missionComposer.proposeRepoIdeas', payload);
      });
    }, ideas('Obsolete'));
    await app.page.getByRole('button', { name: 'New mission…', exact: true }).click();
    const repo = app.page.getByRole('combobox', { name: 'Repo', exact: true });
    const provider = app.page.getByRole('combobox', { name: 'Generation provider', exact: true });
    await repo.selectOption({ label: paths[0]! });
    await provider.selectOption('codex-cli');
    const generate = app.page.getByRole('button', { name: 'Generate ideas', exact: true });
    await generate.click();
    await expect(generate).toBeDisabled();
    await repo.selectOption({ label: paths[1]! });
    await provider.selectOption('claude-code');
    await app.app.evaluate(() =>
      (globalThis as unknown as { releaseIdeas: () => void }).releaseIdeas(),
    );
    await expect(generate).toBeEnabled();
    await expect(app.page.getByRole('button', { name: 'Use this idea' })).toHaveCount(0);
    await generate.click();
    await expect(app.page.getByRole('heading', { name: 'Fresh idea 1' })).toBeVisible();
    await provider.selectOption('codex-cli');
    await expect(app.page.getByRole('button', { name: 'Use this idea' })).toHaveCount(0);
    await generate.click();
    await expect(app.page.getByRole('heading', { name: 'Fresh idea 1' })).toBeVisible();
    const selectedId = await repo.inputValue();
    await app.call('workspaces.revoke', { workspaceId: selectedId });
    await expect(app.page.getByRole('button', { name: 'Use this idea' })).toHaveCount(0);
    await expect(generate).toBeDisabled();
    expect(
      (
        await app.call<OperationResponse<'missionComposer.listDrafts'>>(
          'missionComposer.listDrafts',
        )
      ).drafts,
    ).toHaveLength(0);
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await teardown(app, ...dirs);
  }
});
