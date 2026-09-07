import { test, expect, type Page } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { missionProfile } from './helpers/mission.js';
import { teardown } from './helpers/ui.js';

async function fits(page: Page, selector: string) {
  const measured = await page.locator(selector).evaluate((el) => ({
    width: el.clientWidth,
    scroll: el.scrollWidth,
    overflow: [...el.querySelectorAll<HTMLElement>('*')]
      .filter((node) => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 2)
      .map((node) => ({
        tag: node.tagName,
        class: node.className,
        text: node.textContent?.slice(0, 50),
        width: node.clientWidth,
        scroll: node.scrollWidth,
      }))
      .slice(0, 12),
  }));
  expect(measured.scroll, JSON.stringify(measured)).toBeLessThanOrEqual(measured.width + 2);
}

test('Agents inventory, saved draft editor and shared Sessions setup fit at narrow enlarged text', async () => {
  const app = await launchApp();
  try {
    const profile = await missionProfile(app, 'Long named local worker '.repeat(4));
    let draft = await app.call<OperationResponse<'agentWizard.createDraft'>>(
      'agentWizard.createDraft',
      { source: { kind: 'blank' } },
    );
    draft = await app.call('agentWizard.updateStep', {
      draftId: draft.draftId,
      version: draft.version,
      step: 'identity',
      fields: {
        name: 'Long draft name '.repeat(8),
        description: 'Exact reflow draft',
        author: 'Owner',
      },
    });
    const page = app.page;
    await page.setViewportSize({ width: 960, height: 800 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.getByRole('button', { name: 'Agents', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Choose or create the right worker' }),
    ).toBeVisible();
    await fits(page, '#mission-workspace');
    await fits(page, '.agent-library-workspace');
    await page
      .getByRole('list', { name: 'Reviewed agent profiles' })
      .getByRole('listitem')
      .first()
      .focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('region', { name: 'Agent profile detail', exact: true }),
    ).toBeVisible();
    await fits(page, '#mission-workspace');
    await fits(page, '.agent-profile-detail');
    for (const width of [680, 960, 1280]) {
      for (const scale of ['100%', '200%']) {
        await page.setViewportSize({ width, height: 800 });
        await page.evaluate((value) => {
          document.documentElement.style.fontSize = value;
        }, scale);
        await fits(page, '#mission-workspace');
        await fits(page, '.agent-library-workspace');
        await fits(page, '.agent-profile-detail');
      }
    }
    await page.setViewportSize({ width: 960, height: 800 });

    await page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-31-agents-reflow.png',
    });

    const row = page.locator(`#agent-draft-${draft.draftId}`);
    await row.getByRole('button', { name: /^Resume draft/ }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Create agent', exact: true });
    await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue(
      'Exact reflow draft',
    );
    await fits(page, 'dialog[open]');
    await dialog.getByRole('button', { name: 'Save draft and close', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    expect(
      (
        await app.call<OperationResponse<'agentWizard.getDraft'>>('agentWizard.getDraft', {
          draftId: draft.draftId,
        })
      ).fieldValues.description,
    ).toBe('Exact reflow draft');
    expect(
      (
        await app.call<OperationResponse<'profiles.get'>>('profiles.get', {
          profileId: profile.profileId,
        })
      ).profileId,
    ).toBe(profile.profileId);
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await fits(page, '#mission-workspace');
    expect(await app.liveSessions()).toHaveLength(0);
  } finally {
    await teardown(app);
  }
});
