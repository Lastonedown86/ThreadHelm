import { expect, test } from '@playwright/test';
import type { OperationResponse } from '@threadhelm/contracts';
import { launchApp } from './helpers/app.js';
import { teardown } from './helpers/ui.js';

test('agent drafts show saved names and resume exact duplicate and incomplete drafts after restart', async () => {
  let app = await launchApp();
  try {
    const ids: string[] = [];
    const longName = 'Long saved agent name '.repeat(9);
    for (const name of ['Duplicate agent', 'Duplicate agent', '', longName]) {
      const draft = await app.call<OperationResponse<'agentWizard.createDraft'>>(
        'agentWizard.createDraft',
        { source: { kind: 'blank' } },
      );
      ids.push(draft.draftId);
      await app.call('agentWizard.updateStep', {
        draftId: draft.draftId,
        version: draft.version,
        step: 'identity',
        fields: { name, description: `Identity ${ids.length}`, author: 'Test owner' },
      });
    }
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    const list = app.page.getByRole('list', { name: 'Saved agent drafts' });
    await expect(list.getByText('Duplicate agent', { exact: true })).toHaveCount(2);
    await expect(list.getByText('Unnamed agent', { exact: true })).toBeVisible();
    const target = ids[1]!;
    const row = app.page.locator(`#agent-draft-${target}`);
    await row.getByRole('button', { name: /^Resume draft/ }).focus();
    await app.page.keyboard.press('Enter');
    const wizard = app.page.getByRole('dialog', { name: 'Create agent', exact: true });
    await expect(wizard.getByLabel('Description', { exact: true })).toHaveValue('Identity 2');
    await wizard.getByLabel('Name', { exact: true }).fill('Renamed saved agent');
    await wizard.getByRole('button', { name: 'Save draft and close', exact: true }).click();
    await expect(wizard).toBeHidden();
    await expect(row).toContainText('Renamed saved agent');
    expect(
      (
        await app.call<OperationResponse<'agentWizard.getDraft'>>('agentWizard.getDraft', {
          draftId: target,
        })
      ).fieldValues.name,
    ).toBe('Renamed saved agent');
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
    await expect(app.page.locator(`#agent-draft-${target}`)).toContainText('Renamed saved agent');
    await app.page
      .locator(`#agent-draft-${ids[0]!}`)
      .getByRole('button', { name: /^Resume draft/ })
      .click();
    const reopened = app.page.getByRole('dialog', { name: 'Create agent', exact: true });
    await expect(reopened.getByLabel('Description', { exact: true })).toHaveValue('Identity 1');
    await app.page.keyboard.press('Escape');
    await expect(reopened).toBeHidden();
    await app.page
      .locator(`#agent-draft-${ids[2]!}`)
      .getByRole('button', { name: /^Resume draft/ })
      .click();
    await expect(reopened.getByLabel('Name', { exact: true })).toHaveValue('');
    await app.page.keyboard.press('Escape');
    await expect(reopened).toBeHidden();
    const longRow = app.page.locator(`#agent-draft-${ids[3]!}`);
    await expect(longRow.locator('strong')).toHaveText(longName.trim());
    await expect(longRow.locator('time')).toHaveAttribute('datetime', /T/);
    await longRow.getByRole('button', { name: /^Resume draft/ }).click();
    await expect(reopened.getByLabel('Name', { exact: true })).toHaveValue(longName);
    await app.page.keyboard.press('Escape');
    await expect(reopened).toBeHidden();
    expect(
      (
        await app.call<OperationResponse<'agentWizard.listDrafts'>>('agentWizard.listDrafts', {
          limit: 20,
        })
      ).drafts
        .map((d) => d.draftId)
        .sort(),
    ).toEqual(ids.sort());
    expect(await app.liveSessions()).toHaveLength(0);
    await app.page.screenshot({
      path: 'specs/004-sidebar-workspace-ux/audits/evidence/slice-24-agent-drafts.png',
    });
  } finally {
    await teardown(app);
  }
});
