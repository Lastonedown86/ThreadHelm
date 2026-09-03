import { expect, test, type Locator } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARVEL_ROSTER_FIXTURES, writeAgentManifestFile } from '@threadhelm/test-fixtures';
import { launchApp, type LaunchedApp } from './helpers/app.js';
import { teardown, tempWorkspace } from './helpers/ui.js';

test.setTimeout(60_000);

async function press(locator: Locator, key = 'Enter') {
  await expect(locator).toBeEnabled();
  await locator.focus();
  await locator.page().keyboard.press(key);
}

type WizardStep =
  'Start' | 'Identity' | 'Role and goal' | 'Capabilities' | 'Runtime requests' | 'Review';

async function navigate(
  wizard: Locator,
  from: WizardStep,
  to: WizardStep,
  direction: 'Next' | 'Back' = 'Next',
) {
  await expect(wizard.getByRole('heading', { name: from, exact: true })).toBeVisible();
  await press(wizard.getByRole('button', { name: direction, exact: true }));
  // The same Next/Back button survives async saves. Wait for the actual step
  // and its keyboard focus transfer before issuing another navigation action.
  const heading = wizard.getByRole('heading', { name: to, exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
}

async function openQuality(app: LaunchedApp) {
  await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
  await press(app.page.getByRole('button', { name: 'Create agent…', exact: true }));
  const wizard = app.page.getByRole('dialog', { name: 'Create agent', exact: true });
  await wizard
    .getByLabel('Start from', { exact: true })
    .selectOption({ label: 'Quality specialist (bundled)' });
  await navigate(wizard, 'Start', 'Identity');
  return wizard;
}

async function openAgents(app: LaunchedApp) {
  await app.page.getByRole('button', { name: 'Agents', exact: true }).click();
}

async function review(wizard: Locator, name: string) {
  await wizard.getByLabel('Name', { exact: true }).fill(name);
  await navigate(wizard, 'Identity', 'Role and goal');
  await navigate(wizard, 'Role and goal', 'Capabilities');
  await navigate(wizard, 'Capabilities', 'Runtime requests');
  await navigate(wizard, 'Runtime requests', 'Review');
  await expect(wizard.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
  await expect(wizard.getByLabel('Exact manifest JSON')).toContainText(name);
}

test('keyboard wizard reviews exact JSON and saves one profile without launching', async () => {
  const app = await launchApp();
  try {
    const wizard = await openQuality(app);
    await review(wizard, 'Quality Guide');
    await expect(wizard).toContainText('Permission mode');
    await expect(wizard).toContainText('resolved separately');
    await press(wizard.getByRole('checkbox', { name: 'I reviewed this exact manifest' }), 'Space');
    await press(wizard.getByRole('button', { name: 'Save profile', exact: true }));
    await expect(wizard).toBeHidden();
    await expect(app.page.getByRole('list', { name: 'Reviewed agent profiles' })).toContainText(
      'Quality Guide',
    );
    expect(
      await app.page.getByRole('listbox', { name: 'Sessions' }).getByRole('option').count(),
    ).toBe(0);
  } finally {
    await teardown(app);
  }
});

test('invalid fields stay visible and a cancelled draft resumes with Back and Delete controls', async () => {
  const app = await launchApp();
  try {
    const wizard = await openQuality(app);
    await wizard.getByLabel('Name', { exact: true }).fill('');
    await press(wizard.getByRole('button', { name: 'Next', exact: true }));
    await expect(wizard.getByRole('alert')).toContainText('Name');
    await expect(wizard.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible();
    await wizard.getByLabel('Name', { exact: true }).fill('Resumable quality');
    await navigate(wizard, 'Identity', 'Role and goal');
    await navigate(wizard, 'Role and goal', 'Identity', 'Back');
    await expect(wizard.getByLabel('Name', { exact: true })).toHaveValue('Resumable quality');
    await press(wizard.getByRole('button', { name: 'Save draft and close', exact: true }));
    await expect(wizard).toBeHidden();
    await press(app.page.getByRole('button', { name: /^Resume draft/ }).first());
    await expect(wizard.getByLabel('Name', { exact: true })).toHaveValue('Resumable quality');
    await press(wizard.getByRole('button', { name: 'Delete draft', exact: true }));
    await press(wizard.getByRole('button', { name: 'Confirm delete draft', exact: true }));
    await expect(wizard).toBeHidden();
    await expect(app.page.getByRole('button', { name: /^Resume draft/ })).toHaveCount(0);
  } finally {
    await teardown(app);
  }
});

test('a declared identity variable is reachable before Identity advances', async () => {
  const app = await launchApp();
  try {
    await openAgents(app);
    const starters = await app.call<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
      { state: 'active', limit: 50 },
    );
    const seed = await app.call<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: starters.templates[0]!.currentRevisionId },
    });
    await app.call('agentTemplates.saveRevision', {
      source: { kind: 'draft', draftId: seed.draftId, version: seed.version },
      key: 'identity-variable-starter',
      name: 'Identity variable starter',
      variables: [{ name: 'identity', type: 'text', maxLength: 64, defaultValue: 'Seed' }],
    });
    await press(app.page.getByRole('button', { name: 'Create agent…', exact: true }));
    const wizard = app.page.getByRole('dialog', { name: 'Create agent', exact: true });
    await wizard
      .getByLabel('Start from', { exact: true })
      .selectOption({ label: 'Identity variable starter (local)' });
    await navigate(wizard, 'Start', 'Identity');
    await wizard.getByLabel('Name', { exact: true }).fill('{{identity}}');
    await wizard.getByLabel('Variable: identity', { exact: true }).fill('');
    await press(wizard.getByRole('button', { name: 'Next', exact: true }));
    await expect(wizard.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible();
    await expect(wizard.getByRole('alert')).toContainText('Name');
    await wizard.getByLabel('Variable: identity', { exact: true }).fill('Resolved identity');
    await navigate(wizard, 'Identity', 'Role and goal');
    await navigate(wizard, 'Role and goal', 'Capabilities');
    await navigate(wizard, 'Capabilities', 'Runtime requests');
    await navigate(wizard, 'Runtime requests', 'Review');
    await expect(wizard.getByLabel('Exact manifest JSON')).toContainText('Resolved identity');
  } finally {
    await teardown(app);
  }
});

test('export discloses the selected target and requires explicit overwrite consent', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('wizard-export');
  try {
    const target = join(dir, 'quality.agent.json');
    writeFileSync(target, 'existing file');
    await app.app.evaluate((_electron, path) => {
      (
        globalThis as unknown as {
          __threadhelmTest: { setAgentExportPickerPath(path: string): void };
        }
      ).__threadhelmTest.setAgentExportPickerPath(path);
    }, target);
    const wizard = await openQuality(app);
    await review(wizard, 'Export quality');
    await press(wizard.getByRole('checkbox', { name: 'I reviewed this exact manifest' }), 'Space');
    await press(wizard.getByRole('button', { name: 'Export…', exact: true }));
    await expect(wizard).toContainText(target);
    await expect(
      wizard.getByRole('button', { name: 'Confirm export', exact: true }),
    ).toBeDisabled();
    expect(readFileSync(target, 'utf8')).toBe('existing file');
    await press(wizard.getByRole('checkbox', { name: 'Replace this existing file' }), 'Space');
    await press(wizard.getByRole('button', { name: 'Confirm export', exact: true }));
    await expect(wizard).toBeHidden();
    const manifest = JSON.parse(readFileSync(target, 'utf8')) as Record<string, unknown>;
    expect(manifest.name).toBe('Export quality');
    expect(manifest).not.toHaveProperty('permissionMode');
    expect(
      await app.page.getByRole('listbox', { name: 'Sessions' }).getByRole('option').count(),
    ).toBe(0);
  } finally {
    await teardown(app, dir);
  }
});

test('local themed templates come from reviewed profiles and remain separate from bundled starters', async () => {
  const app = await launchApp();
  const dir = tempWorkspace('wizard-local-template');
  try {
    await openAgents(app);
    const profile = MARVEL_ROSTER_FIXTURES[7]!;
    const path = writeAgentManifestFile(dir, profile.basename, profile.text);
    await app.app.evaluate((_electron, filePath) => {
      (
        globalThis as unknown as {
          __threadhelmTest: { setProfileFilePickerPath(path: string): void };
        }
      ).__threadhelmTest.setProfileFilePickerPath(filePath);
    }, path);
    await press(app.page.getByRole('button', { name: 'Import profile…', exact: true }));
    const imported = app.page.getByRole('dialog', { name: 'Review reviewed agent profile' });
    await press(imported.getByRole('checkbox'), 'Space');
    await press(imported.getByRole('button', { name: 'Import profile', exact: true }));
    await expect(imported).toBeHidden();
    await press(app.page.getByRole('button', { name: 'Create agent…', exact: true }));
    const wizard = app.page.getByRole('dialog', { name: 'Create agent', exact: true });
    await wizard
      .getByLabel('Start from', { exact: true })
      .selectOption({ label: 'Spider-Man (reviewed profile)' });
    await navigate(wizard, 'Start', 'Identity');
    await review(wizard, 'Spider-Man local quality');
    await press(wizard.getByRole('checkbox', { name: 'I reviewed this exact manifest' }), 'Space');
    await press(wizard.getByRole('button', { name: 'Save as template…', exact: true }));
    await press(wizard.getByRole('button', { name: 'Confirm save template', exact: true }));
    await expect(wizard.getByRole('status')).toContainText('Local template saved');
    await navigate(wizard, 'Review', 'Runtime requests', 'Back');
    await navigate(wizard, 'Runtime requests', 'Capabilities', 'Back');
    await navigate(wizard, 'Capabilities', 'Role and goal', 'Back');
    await wizard
      .getByLabel('Goal', { exact: true })
      .fill('Review this bounded local quality change.');
    await navigate(wizard, 'Role and goal', 'Capabilities');
    await navigate(wizard, 'Capabilities', 'Runtime requests');
    await navigate(wizard, 'Runtime requests', 'Review');
    await press(wizard.getByRole('checkbox', { name: 'I reviewed this exact manifest' }), 'Space');
    await press(wizard.getByRole('button', { name: 'Save as template…', exact: true }));
    await wizard
      .getByLabel('Template destination', { exact: true })
      .selectOption({ label: 'New revision of Spider-Man local quality' });
    await press(wizard.getByRole('button', { name: 'Confirm save template', exact: true }));
    await expect(wizard.getByRole('status')).toContainText('Local template saved');
    await press(wizard.getByRole('button', { name: 'Save draft and close', exact: true }));
    const library = app.page.getByRole('list', { name: 'Agent templates', exact: true });
    const local = library
      .getByRole('listitem')
      .filter({ hasText: 'Spider-Man local quality (local)' });
    await expect(local).toBeVisible();
    await expect(local).toContainText('revision 2');
    await press(local.getByRole('button', { name: 'Details', exact: true }));
    await expect(app.page.getByRole('region', { name: 'Template detail' })).toContainText(
      'From reviewed profile revision',
    );
    await press(app.page.getByRole('button', { name: 'Close template detail', exact: true }));
    await press(local.getByRole('button', { name: 'Disable', exact: true }));
    await expect(local.getByRole('button', { name: 'Use template', exact: true })).toBeDisabled();
    await press(local.getByRole('button', { name: 'Enable', exact: true }));
    await press(local.getByRole('button', { name: 'Duplicate', exact: true }));
    const duplicate = app.page.getByRole('dialog', { name: 'Duplicate template' });
    await press(duplicate.getByRole('button', { name: 'Confirm duplicate' }));
    await expect(duplicate).toBeHidden();
    const copy = library
      .getByRole('listitem')
      .filter({ hasText: 'Spider-Man local quality copy (local)' });
    await expect(copy).toBeVisible();
    await press(copy.getByRole('button', { name: 'Delete', exact: true }));
    await press(
      app.page
        .getByRole('dialog', { name: 'Delete local template' })
        .getByRole('button', { name: 'Confirm delete template' }),
    );
    await expect(copy).toHaveCount(0);
    const bundled = library.getByRole('listitem').filter({ hasText: '(bundled)' });
    await expect(bundled).toHaveCount(6);
    expect(await bundled.allTextContents()).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/Spider-Man|Marvel/)]),
    );
    expect(await library.locator('img, svg, video, canvas').count()).toBe(0);
    await app.page.screenshot({
      path: join('test-results', 'us7-local-template-acceptance.png'),
      fullPage: true,
    });
  } finally {
    await teardown(app, dir);
  }
});

test('a saved draft reopens after an actual desktop restart', async () => {
  let app = await launchApp();
  try {
    const wizard = await openQuality(app);
    await wizard.getByLabel('Name', { exact: true }).fill('Restart survivor');
    await navigate(wizard, 'Identity', 'Role and goal');
    await wizard.getByLabel('Goal', { exact: true }).fill('Only inspect the reviewed scope.');
    await press(wizard.getByRole('button', { name: 'Save draft and close', exact: true }));
    await expect(wizard).toBeHidden();
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    await openAgents(app);
    await press(app.page.getByRole('button', { name: /^Resume draft/ }).first());
    const resumed = app.page.getByRole('dialog', { name: 'Create agent', exact: true });
    await expect(resumed.getByLabel('Goal', { exact: true })).toHaveValue(
      'Only inspect the reviewed scope.',
    );
    await navigate(resumed, 'Role and goal', 'Identity', 'Back');
    await expect(resumed.getByLabel('Name', { exact: true })).toHaveValue('Restart survivor');
  } finally {
    await teardown(app);
  }
});

test('blank creation preserves capability typing and a custom model through review', async () => {
  const app = await launchApp();
  try {
    await openAgents(app);
    await press(app.page.getByRole('button', { name: 'Create agent…', exact: true }));
    const wizard = app.page.getByRole('dialog', { name: 'Create agent', exact: true });
    await wizard.getByLabel('Start from', { exact: true }).selectOption('blank');
    await navigate(wizard, 'Start', 'Identity');
    await wizard.getByLabel('Name', { exact: true }).fill('Blank bounded helper');
    await wizard.getByLabel('Description', { exact: true }).fill('A local, bounded helper.');
    await wizard.getByLabel('Author', { exact: true }).fill('Local owner');
    await navigate(wizard, 'Identity', 'Role and goal');
    await wizard.getByLabel('Goal', { exact: true }).fill('Review only the approved change.');
    await navigate(wizard, 'Role and goal', 'Capabilities');
    await wizard.getByLabel('Capability labels').pressSequentially('quality_review, documentation');
    await expect(wizard.getByLabel('Capability labels')).toHaveValue(
      'quality_review, documentation',
    );
    await navigate(wizard, 'Capabilities', 'Runtime requests');
    await wizard.getByLabel('Provider', { exact: true }).selectOption('codex');
    await wizard.getByLabel('Model', { exact: true }).selectOption('__custom__');
    await wizard.getByLabel('Custom model', { exact: true }).fill('gpt-5.6-terra');
    await wizard.getByLabel('Requested token cap').fill('250000');
    await navigate(wizard, 'Runtime requests', 'Review');
    await expect(wizard.getByLabel('Exact manifest JSON')).toContainText(
      'threadhelm/agent-profile@1',
    );
    await expect(wizard.getByLabel('Exact manifest JSON')).not.toContainText('munder-difflin');
    await expect(wizard.getByLabel('Exact manifest JSON')).toContainText('documentation');
    await press(wizard.getByRole('checkbox', { name: 'I reviewed this exact manifest' }), 'Space');
    await press(wizard.getByRole('button', { name: 'Save profile', exact: true }));
    await expect(wizard).toBeHidden();
    await expect(app.page.getByRole('list', { name: 'Reviewed agent profiles' })).toContainText(
      'Blank bounded helper',
    );
    expect(await app.liveSessions()).toEqual([]);
  } finally {
    await teardown(app);
  }
});
