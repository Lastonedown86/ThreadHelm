/** Audit observations; confirmed defects are recorded rather than asserted away. */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { version, release } from 'node:os';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from '../../../../tests/e2e/helpers/app.js';
import { missionProfile } from '../../../../tests/e2e/helpers/mission.js';
import { teardown } from '../../../../tests/e2e/helpers/ui.js';

const records: Record<string, unknown>[] = [];
function record(id: string, data: Record<string, unknown>) {
  records.push({ id, ...data });
  writeFileSync(
    new URL('../evidence/a8b9483-agents-templates.json', import.meta.url),
    JSON.stringify(records, null, 2) + '\n',
  );
}
const capture = (name: string) =>
  fileURLToPath(new URL(`../evidence/a8b9483-${name}.png`, import.meta.url));

test('observe profile creation, filtered detail, template dependencies and restart', async () => {
  let app = await launchApp();
  try {
    let page = app.page;
    await expect(page.locator('.status-bar')).toContainText('ThreadHelm v');
    await page.getByRole('button', { name: 'Agents', exact: true }).click();
    const library = page.getByRole('list', { name: 'Agent templates', exact: true });
    await expect(library.getByRole('listitem')).toHaveCount(6);
    record('environment', {
      base: 'a8b94838850175ff6467e044366a9cbbe733402f',
      os: version(),
      release: release(),
      viewport: await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        fontSize: getComputedStyle(document.documentElement).fontSize,
      })),
      appBuild: await page.locator('.status-bar').innerText(),
      fixtures: 'isolated local authoring; no provider launch',
    });
    record('A04-01-empty', {
      headings: await page.getByRole('heading').allTextContents(),
      roster: await app.call('profiles.list', {}),
      live: await app.liveSessions(),
    });
    await page.screenshot({ path: capture('agents-empty') });
    await page.getByRole('button', { name: 'Create agent', exact: false }).click();
    const wizard = page.getByRole('dialog', { name: 'Create agent', exact: true });
    await wizard
      .getByLabel('Start from', { exact: true })
      .selectOption({ label: 'Quality specialist (bundled)' });
    await wizard.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(wizard.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible();
    await wizard.getByLabel('Name', { exact: true }).fill('Audit quality guide');
    for (const step of ['Role and goal', 'Capabilities', 'Runtime requests', 'Review']) {
      await wizard.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(wizard.getByRole('heading', { name: step, exact: true })).toBeVisible();
    }
    const reviewed = JSON.parse(await wizard.getByLabel('Exact manifest JSON').innerText());
    await wizard.getByLabel('I reviewed this exact manifest').check();
    await wizard.getByRole('button', { name: 'Save profile', exact: true }).click();
    await expect(wizard).toBeHidden();
    const roster = page.getByRole('list', { name: 'Reviewed agent profiles' });
    await expect(roster).toContainText('Audit quality guide');
    const saved = await app.call<OperationResponse<'profiles.list'>>('profiles.list', {});
    const profile = saved.profiles[0]!;
    const detail = await app.call<OperationResponse<'profiles.get'>>('profiles.get', {
      profileId: profile.profileId,
    });
    record('A04-02-create-readback', { reviewed, saved: detail, live: await app.liveSessions() });
    await roster.getByRole('listitem').first().click();
    await expect(page.getByRole('region', { name: 'Agent profile detail' })).toContainText(
      'Audit quality guide',
    );
    await page.locator('.profiles-panel select').selectOption('disabled');
    await expect(roster.getByRole('listitem')).toHaveCount(0);
    const visibleDetail = page.getByRole('region', { name: 'Agent profile detail' });
    record('A04-03-filtered-detail', {
      rows: await roster.getByRole('listitem').count(),
      emptyCopy: await page.getByText('No reviewed agent profiles yet.').count(),
      detail: await visibleDetail.innerText(),
      disableEnabled: await visibleDetail
        .getByRole('button', { name: 'Disable', exact: true })
        .isEnabled(),
      savedState: (
        await app.call<OperationResponse<'profiles.get'>>('profiles.get', {
          profileId: profile.profileId,
        })
      ).state,
    });
    await visibleDetail.scrollIntoViewIfNeeded();
    await page.screenshot({ path: capture('filtered-profile-detail') });
    await visibleDetail.getByRole('button', { name: 'Disable', exact: true }).click();
    await expect(visibleDetail.getByRole('button', { name: 'Enable', exact: true })).toBeVisible();
    record('A04-04-toggle-readback', {
      saved: await app.call('profiles.get', { profileId: profile.profileId }),
      live: await app.liveSessions(),
    });

    const bundled = (
      await app.call<OperationResponse<'agentTemplates.list'>>('agentTemplates.list', { limit: 50 })
    ).templates[0]!;
    await library
      .getByRole('listitem')
      .filter({ hasText: bundled.name })
      .getByRole('button', { name: 'Duplicate', exact: true })
      .click();
    const duplicate = page.getByRole('dialog', { name: 'Duplicate template' });
    await duplicate.getByLabel('Template name').fill('Audit local starter');
    await duplicate.getByLabel('Template key').fill('audit-local-starter');
    await duplicate.getByRole('button', { name: 'Confirm duplicate' }).click();
    await expect(duplicate).toBeHidden();
    const local = (
      await app.call<OperationResponse<'agentTemplates.list'>>('agentTemplates.list', { limit: 50 })
    ).templates.find((t) => t.name === 'Audit local starter')!;
    record('A05-01-duplicate', {
      source: await app.call('agentTemplates.get', { templateId: bundled.templateId }),
      copy: await app.call('agentTemplates.get', { templateId: local.templateId }),
      live: await app.liveSessions(),
    });
    const localRow = library.getByRole('listitem').filter({ hasText: 'Audit local starter' });
    await localRow.getByRole('button', { name: 'Use template', exact: true }).click();
    await wizard.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(wizard.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible();
    await wizard.getByLabel('Name', { exact: true }).fill('Audit dependent draft');
    await page.keyboard.press('Escape');
    await expect(wizard).toBeHidden();
    const drafts = await app.call<OperationResponse<'agentWizard.listDrafts'>>(
      'agentWizard.listDrafts',
      { limit: 50 },
    );
    record('A05-02-escape-save', {
      drafts,
      saved: await app.call('agentWizard.getDraft', { draftId: drafts.drafts[0]!.draftId }),
      focus: await page.evaluate(() => document.activeElement?.textContent),
    });
    await localRow.getByRole('button', { name: 'Delete', exact: true }).click();
    const deletion = page.getByRole('dialog', { name: 'Delete local template' });
    await deletion.getByRole('button', { name: 'Confirm delete template' }).click();
    await expect(deletion.getByRole('alert')).toBeVisible();
    record('A05-03-dependent-delete', {
      error: await page.getByRole('alert').allTextContents(),
      template: await app.call('agentTemplates.get', { templateId: local.templateId }),
      drafts: await app.call('agentWizard.listDrafts', { limit: 50 }),
    });
    await deletion.getByRole('button', { name: 'Confirm delete template' }).click();
    await expect(deletion.getByRole('alert')).toContainText('expired');
    record('A05-03b-delete-retry', {
      error: await deletion.getByRole('alert').innerText(),
      buttons: await deletion.getByRole('button').allTextContents(),
      saved: await app.call('agentTemplates.get', { templateId: local.templateId }),
    });
    await page.screenshot({ path: capture('template-delete-retry') });
    await deletion.getByRole('button', { name: 'Keep template' }).click();
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    page = app.page;
    await page.getByRole('button', { name: 'Agents', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Resume draft/ })).toHaveCount(1);
    record('A05-04-restart', {
      profile: await app.call('profiles.get', { profileId: profile.profileId }),
      template: await app.call('agentTemplates.get', { templateId: local.templateId }),
      draft: await app.call('agentWizard.getDraft', { draftId: drafts.drafts[0]!.draftId }),
      live: await app.liveSessions(),
    });
  } finally {
    await teardown(app);
  }
});

test('observe roster pagination, draft limits, labels and scaled layout', async () => {
  let app = await launchApp();
  try {
    for (let i = 0; i < 51; i++) await missionProfile(app, `Audit saved worker ${i + 1}`);
    for (let i = 0; i < 20; i++) {
      const draft = await app.call<OperationResponse<'agentWizard.createDraft'>>(
        'agentWizard.createDraft',
        { source: { kind: 'blank' } },
      );
      await app.call('agentWizard.updateStep', {
        draftId: draft.draftId,
        version: draft.version,
        step: 'identity',
        fields: { name: `Audit named draft ${i + 1}` },
      });
    }
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    await expect(app.page.getByRole('button', { name: /^Resume draft/ })).toHaveCount(20);
    const profiles = await app.call<OperationResponse<'profiles.list'>>('profiles.list', {
      limit: 100,
    });
    await expect(
      app.page.getByRole('list', { name: 'Reviewed agent profiles' }).getByRole('listitem'),
    ).toHaveCount(50);
    record('A04-05-roster-pagination', {
      authoritativeCount: profiles.profiles.length,
      visibleCount: await app.page
        .getByRole('list', { name: 'Reviewed agent profiles' })
        .getByRole('listitem')
        .count(),
      nextCursor: (await app.call<OperationResponse<'profiles.list'>>('profiles.list', {}))
        .nextCursor,
      loadMoreControls: await app.page
        .getByRole('button', { name: /more.*profile|next.*profile/i })
        .count(),
    });
    record('A05-05-draft-labels', {
      drafts: await app.call('agentWizard.listDrafts', { limit: 50 }),
      visibleNames: await app.page.getByText(/Audit named draft/).count(),
      rows: await app.page.getByRole('list', { name: 'Saved agent drafts' }).innerText(),
    });
    await app.page.getByRole('button', { name: 'Create agent', exact: false }).click();
    const wizard = app.page.getByRole('dialog', { name: 'Create agent', exact: true });
    await wizard.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(wizard.getByRole('alert')).toBeVisible();
    record('A05-06-draft-limit', {
      error: await wizard.getByRole('alert').innerText(),
      count: (
        await app.call<OperationResponse<'agentWizard.listDrafts'>>('agentWizard.listDrafts', {
          limit: 50,
        })
      ).drafts.length,
    });
    await wizard.getByRole('button', { name: 'Cancel', exact: true }).click();
    await app.page.setViewportSize({ width: 960, height: 800 });
    await app.page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    record('A04-A05-scaled', {
      overflow: await app.page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
      mainScroll: await app.page
        .locator('.mission-shell-workspace')
        .evaluate((el) => ({ width: el.clientWidth, scrollWidth: el.scrollWidth })),
      headings: await app.page.getByRole('heading').allTextContents(),
    });
    await app.page.screenshot({ path: capture('draft-inventory-scaled') });
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    await expect(app.page.getByRole('button', { name: /^Resume draft/ })).toHaveCount(20);
    record('A04-A05-inventory-restart', {
      visible: await app.page.getByRole('button', { name: /^Resume draft/ }).count(),
      authoritative: (
        await app.call<OperationResponse<'agentWizard.listDrafts'>>('agentWizard.listDrafts', {
          limit: 50,
        })
      ).drafts.length,
      live: await app.liveSessions(),
    });
  } finally {
    await teardown(app);
  }
});
