// Run from repository root: node specs/004-sidebar-workspace-ux/audits/probes/a01-a02.mjs drafts|missions|ideas
// Observation harness, not a regression suite: records current behavior, including defects.

// Only isolated user-data and temporary approved workspaces; never real provider adapters.

import { _electron, expect } from '@playwright/test';

import { createRequire } from 'node:module';

import { mkdtempSync, writeFileSync } from 'node:fs';

import { tmpdir, version as osVersion, release } from 'node:os';

import { resolve, join } from 'node:path';

const desktop = resolve('apps/desktop');

const executablePath = createRequire(join(desktop, 'package.json'))('electron');

const mode = process.argv[2] ?? 'drafts';

if (!['drafts', 'missions', 'ideas'].includes(mode))
  throw new Error('Choose drafts, missions, or ideas.');
const userData = mkdtempSync(join(tmpdir(), 'threadhelm-audit-'));

let app, page;

const observations = [];

const result = (id, values) => {
  const row = { id, ...values };
  observations.push(row);
  console.log(JSON.stringify(row));
  writeFileSync(
    new URL(`../evidence/efcd523-${mode}.json`, import.meta.url),
    JSON.stringify(observations, null, 2) + '\n',
  );
};

async function boot(fixtures = false) {
  app = await _electron.launch({
    executablePath,
    args: [
      join(desktop, 'out/main/index.cjs'),
      '--threadhelm-test-hooks',
      `--user-data-dir=${userData}`,
    ],
    cwd: desktop,
  });

  page = await app.firstWindow();

  page.setDefaultTimeout(12000);

  await page.setViewportSize({ width: 1400, height: 860 });

  await expect(page.locator('.status-bar')).toContainText('ThreadHelm v');

  if (fixtures) {
    await hook('useFixtureAdapters', { 'codex-cli': 'echo' });
    await call('providers.listReadiness');
  }
}

async function hook(method, ...args) {
  return app.evaluate(
    (_e, { method, args }) =>
      new Promise((resolve, reject) =>
        setImmediate(() => {
          try {
            Promise.resolve(globalThis.__threadhelmTest[method](...args)).then(resolve, reject);
          } catch (e) {
            reject(e);
          }
        }),
      ),
    { method, args },
  );
}

async function call(name, payload) {
  const r = await hook('dispatch', name, payload);
  if (!r.ok) throw Error(`${name}: ${r.error.code}`);
  return r.value;
}

const button = (name) => page.getByRole('button', { name, exact: true });

const nav = (name) =>
  page.locator('.app-navigation').getByRole('button', { name, exact: true }).click();

async function newDraft() {
  await nav('Missions');
  await button('New mission…').click();
  await page.getByRole('button', { name: /^Skip/ }).click();
  await page.getByLabel('Finish line', { exact: true }).waitFor();
}

async function closeDraft() {
  await button('Close').click();
  await button('Close composer').click();
}

const draft = (id) => call('missionComposer.getDraft', { draftId: id });

async function latestDraft() {
  return (await call('missionComposer.listDrafts')).drafts[0].draftId;
}

async function profile(name) {
  const sources = await call('agentTemplates.list', {});

  let d = await call('agentWizard.createDraft', {
    source: {
      kind: 'template',
      templateRevisionId: sources.templates[0].currentRevisionId,
    },
  });

  d = await call('agentWizard.updateStep', {
    draftId: d.draftId,
    version: d.version,
    step: 'identity',
    fields: { name, description: 'Audit fixture', author: 'Audit fixture' },
  });

  d = await call('agentWizard.updateStep', {
    draftId: d.draftId,
    version: d.version,
    step: 'runtime',
    fields: {
      provider: 'codex',
      model: 'gpt-5.6-terra',
      isolate: false,
      tokenCap: 250000,
    },
  });

  const p = await call('agentWizard.previewCompletion', {
    draftId: d.draftId,
    version: d.version,
    action: 'profile',
  });

  return call('agentWizard.confirmProfile', {
    completionToken: p.completionToken,
    profileConfirmation: true,
  });
}

async function session(folder) {
  await hook('setPickerPath', folder);

  const chosen = await call('workspaces.choose');

  const w = await call('workspaces.approve', {
    candidateToken: chosen.candidateToken,
  });

  const preview = await call('sessions.previewLaunch', {
    workspaceId: w.id,
    providerId: 'codex-cli',
    terminal: { columns: 100, rows: 30 },
    runtimeSelection: { model: 'gpt-5.6-terra', effort: null },
    executionBounds: {
      maxElapsedMs: 1800000,
      maxTurns: 64,
      maxNoProgressMs: 300000,
      maxOutputBytes: 8388608,
      maxConcurrentProcesses: 8,
    },
  });

  return call('sessions.launch', {
    previewToken: preview.previewToken,
    boundaryConfirmation: true,
  });
}

try {
  result('environment', { os: osVersion(), release: release(), mode });

  await boot(mode === 'missions');

  if (mode === 'drafts') {
    await newDraft();

    const id = await latestDraft();

    await page.getByLabel('Finish line', { exact: true }).fill('Saved audit objective');

    await page.getByLabel('Proof of completion', { exact: true }).fill('Saved evidence');

    await closeDraft();

    result('D01-close-readback', {
      fields: (await draft(id)).fieldValues,
      liveSessions: (await hook('liveSessions')).length,
    });

    await app.close();
    await boot();

    result('D02-restart-readback', {
      fields: (await draft(id)).fieldValues,
      liveSessions: (await hook('liveSessions')).length,
    });

    for (const destination of [
      'Missions',
      'Sessions',
      'Agents',
      'Memory',
      'Attention',
      'Settings',
    ]) {
      await page.reload();
      await expect(page.locator('.status-bar')).toContainText('ThreadHelm v');

      await nav(destination);
      await button('New mission…').click();

      const newMission = await page.locator('.repo-idea-entry').count();

      await page.reload();
      await expect(page.locator('.status-bar')).toContainText('ThreadHelm v');

      await nav(destination);
      await page.getByRole('button', { name: /^Resume draft/ }).click();

      if (destination === 'Missions') await page.locator('.composer').waitFor();

      result('N01-global-entry', {
        destination,
        newMission: !!newMission,
        resumeDraft: !!(await page.locator('.composer').count()),
        selected: await page.locator('.app-navigation [aria-current]').innerText(),
      });
    }

    await nav('Missions');
    await page.getByLabel('Finish line', { exact: true }).waitFor();

    await page.getByLabel('Finish line', { exact: true }).fill('Unsaved edit before new mission');

    await button('New mission…').click();

    await page.waitForTimeout(1000); // exceeds the production 800ms autosave window

    result('D03-new-entry-save-loss', {
      actualObjective: (await draft(id)).fieldValues.objective,
      expectedObjective: 'Unsaved edit before new mission',
      entryVisible: !!(await page.locator('.repo-idea-entry').count()),
    });

    await page.reload();
    await expect(page.locator('.status-bar')).toContainText('ThreadHelm v');

    await page.getByRole('button', { name: /^Resume draft/ }).click();

    await page.getByLabel('Finish line', { exact: true }).fill('Ordinary destination switch saved');

    await nav('Agents');

    result('D04-destination-flush', {
      actualObjective: (await draft(id)).fieldValues.objective,
    });

    await nav('Missions');

    await page.getByLabel('Finish line', { exact: true }).waitFor();

    await hook('breakStorage');

    await page.getByLabel('Finish line', { exact: true }).fill('Edit after storage failure');

    await nav('Agents');

    await page.locator('.agent-library-workspace').waitFor();

    result('D05-failed-save-navigation', {
      destinationChanged: true,
      composerVisible: !!(await page.locator('.composer').count()),
      dialogs: await page.getByRole('dialog').count(),
      notice: await page.locator('.banner').allTextContents(),
    });

    await app.close();
    await boot();

    result('D06-failure-restart', {
      actualObjective: (await draft(id)).fieldValues.objective,
      expectedLatestEdit: 'Edit after storage failure',
    });

    let limitError = null;

    for (let i = 0; i < 21; i++) {
      try {
        await call('missionComposer.createDraft');
      } catch (e) {
        limitError = e.message;
        break;
      }
    } // setup for inventory limit

    await page.reload();
    await expect(page.locator('.mission-rail-drafts summary')).toContainText('20');

    result('N02-draft-inventory', {
      limitError,
      listed: (await call('missionComposer.listDrafts')).drafts.length,
      originalStillReadable: (await draft(id)).fieldValues.objective,
      railSummary: await page.locator('.mission-rail-drafts summary').innerText(),
    });

    await button('New mission\u2026').click();

    await page.getByRole('button', { name: /^Skip/ }).click();

    await expect(page.locator('.banner')).toContainText('Too many drafts');

    result('N02-cap-ui', {
      notice: await page.locator('.banner').innerText(),
      discardButtons: await page.getByRole('button', { name: /Discard draft/ }).count(),
    });

    await page.setViewportSize({ width: 680, height: 860 });

    await page.screenshot({
      path: resolve('specs/004-sidebar-workspace-ux/audits/evidence/efcd523-narrow-drafts.png'),
    });

    result(
      'N03-narrow-inventory',
      await page.evaluate(() => ({
        viewport: innerHeight,
        railHeight: document.querySelector('.mission-shell-rail').getBoundingClientRect().height,
        mainTop: document.querySelector('#mission-workspace').getBoundingClientRect().top,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      })),
    );
  } else if (mode === 'missions') {
    const leader = await profile('Audit coordinator'),
      worker = await profile('Audit worker');

    const folder = mkdtempSync(join(tmpdir(), 'audit-shared-'));

    const supervisor = await session(folder);

    try {
      await session(folder);
    } catch (e) {
      result('M00-write-lease', { rejection: e.message });
    }

    const workerSession = await session(mkdtempSync(join(tmpdir(), 'audit-worker-')));

    await page.reload();
    await newDraft();

    const id = await latestDraft();

    await page.getByLabel('Finish line', { exact: true }).fill('Audit mission lifecycle');

    await page
      .getByLabel('Proof of completion', { exact: true })
      .fill('Independent state readback');

    await button('Continue to crew').click();

    await page
      .getByRole('combobox', { name: 'Supervisor profile', exact: true })
      .selectOption(leader.profileId);

    await page
      .getByRole('combobox', { name: 'Supervisor session', exact: true })
      .selectOption(supervisor.id);

    await button('Add worker').click();

    await page
      .getByRole('combobox', { name: 'Worker 1 profile', exact: true })
      .selectOption(worker.profileId);

    await page
      .getByRole('combobox', { name: 'Worker 1 session', exact: true })
      .selectOption(workerSession.id);

    await page
      .getByLabel('What worker 1 contributes', { exact: true })
      .fill('Inspect fixture output');

    await page.getByLabel('What worker 1 must bring back', { exact: true }).fill('Readback');

    await page
      .getByRole('button', {
        name: 'Add to what worker 1 must bring back',
        exact: true,
      })
      .click();

    await page.locator('summary').filter({ hasText: 'Customize runtime' }).click();

    await page.getByLabel('Worker 1 model', { exact: true }).fill('invalid-audit-model');

    await button('Continue to access and limits').click();

    await page
      .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
      .selectOption(supervisor.workspaceId);

    await page.getByRole('radio', { name: 'Read', exact: true }).check();

    await button('Back').click();

    result('M00-shared-access', {
      modes: (await draft(id)).fieldValues.workspaces,
      workerUsesSupervisorFolder:
        (await draft(id)).fieldValues.workers[0].workspaceId === supervisor.workspaceId,
    });

    await button('Continue to access and limits').click();

    await page
      .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
      .selectOption(workerSession.workspaceId);

    await page.getByRole('radio', { name: 'Write', exact: true }).check();

    await button('Continue to review').click();

    await page.locator('.composer-state.failed').waitFor();

    result('M01-impossible-edit', {
      review: await page.locator('.composer-state.failed').innerText(),
      savedModel: (await draft(id)).fieldValues.workers[0].runtimeSelection.model,
      missionCount: (await call('missions.list', { limit: 100 })).length,
      sharedModes: (await draft(id)).fieldValues.workspaces,
    });

    await button('Crew').click();

    await page.locator('summary').filter({ hasText: 'Customize runtime' }).click();

    await page.getByLabel('Worker 1 model', { exact: true }).fill('gpt-5.6-terra');

    await button('Continue to access and limits').click();

    await page.getByRole('radio', { name: 'Write', exact: true }).check();

    await button('Continue to review').click();

    await page
      .locator('.composer-state.ready, .composer-state.failed, .composer-state.held')
      .waitFor();

    result('M01-repair-diagnostic', {
      review: await page.locator('.composer-state').innerText(),
      workers: (await draft(id)).fieldValues.workers.map((w) => ({
        model: w.runtimeSelection,
        permission: w.permissionSelection,
        bounds: w.executionBounds,
      })),
      live: (await call('missions.eligibleSessions')).map((w) => ({
        model: w.runtimeSelection,
        permission: w.permissionSelection,
        bounds: w.executionBounds,
      })),
    });

    if (await page.locator('.composer-state.held').count()) {
      await button('Go to access and limits').click();

      await page
        .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
        .selectOption(supervisor.workspaceId);

      await page.getByRole('radio', { name: 'Write', exact: true }).check();

      await page
        .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
        .selectOption(workerSession.workspaceId);

      await button('Continue to review').click();
    }

    await page.locator('.composer-state.ready').waitFor();

    result('M02-before-confirm', {
      startDisabled: await button('Start mission').isDisabled(),
      missionCount: (await call('missions.list', { limit: 100 })).length,
      liveSessions: (await hook('liveSessions')).length,
    });

    await page
      .getByRole('checkbox', {
        name: 'I reviewed this exact mission authority',
      })
      .check();

    await button('Start mission').click();

    const dialog = page.getByRole('dialog', {
      name: 'Mission detail',
      exact: true,
    });

    await dialog.waitFor();

    const missionId = (await call('missions.list', { limit: 100 }))[0].id;

    const read = () => call('missions.detail', { missionId });

    let m = await read();

    result('M03-confirm-readback', {
      state: m.state,
      objective: m.envelope.objective,
      bindings: m.envelope.bindings.length,
      drafts: (await call('missionComposer.listDrafts')).drafts.length,
      liveSessions: (await hook('liveSessions')).length,
    });

    await dialog.getByRole('button', { name: 'Pause mission', exact: true }).click();

    await expect.poll(async () => (await read()).state).toBe('paused');

    result('M04-pause-readback', {
      state: (await read()).state,
      liveSessions: (await hook('liveSessions')).length,
    });

    await dialog
      .getByRole('combobox', { name: 'Resume with supervisor', exact: true })
      .selectOption(supervisor.id);

    await dialog.getByRole('button', { name: 'Resume mission', exact: true }).click();

    await expect.poll(async () => (await read()).state).toBe('running');

    result('M05-resume-readback', {
      state: (await read()).state,
      supervisorMatches: (await read()).supervisorSessionId === supervisor.id,
    });

    await dialog.getByRole('button', { name: 'Pause mission', exact: true }).click();

    await expect.poll(async () => (await read()).state).toBe('paused');

    await dialog.getByRole('button', { name: 'Revise envelope…', exact: true }).click();

    await button('Outcome').click();

    await page.getByLabel('Finish line', { exact: true }).fill('Revised audit mission');

    await button('Review').click();

    await page.locator('.composer-state.ready').waitFor();

    await page
      .getByRole('checkbox', {
        name: 'I reviewed this exact mission authority',
      })
      .check();

    await button('Apply revision').click();
    await dialog.waitFor();

    result('M06-revision-readback', {
      objective: (await read()).envelope.objective,
      state: (await read()).state,
      missionCount: (await call('missions.list', { limit: 100 })).length,
    });

    await page.keyboard.press('Escape');
    await newDraft();

    await page.getByLabel('Finish line', { exact: true }).fill('Draft above selected mission');

    await page.getByRole('listbox', { name: 'Missions', exact: true }).getByRole('option').click();

    result('N04-mission-selection', {
      composerVisible: !!(await page.locator('.composer').count()),
      selectedRow: await page.getByRole('option', { selected: true }).first().innerText(),
      heading: await page.locator('#mission-workspace h1').innerText(),
    });

    await closeDraft();

    await button('Resume mission…').click();
    await dialog.waitFor();

    await dialog.getByRole('button', { name: 'Cancel mission…', exact: true }).click();

    const before = (await read()).state;

    await dialog.getByRole('button', { name: 'Keep mission', exact: true }).click();

    result('M07-cancel-abort', { before, after: (await read()).state });

    await dialog.getByRole('button', { name: 'Cancel mission…', exact: true }).click();

    await dialog
      .getByRole('checkbox', {
        name: 'I confirm this exact mission cancellation',
      })
      .check();

    await dialog
      .getByRole('button', {
        name: 'Confirm mission cancellation',
        exact: true,
      })
      .click();

    await expect.poll(async () => (await read()).state).toBe('cancelled');

    result('M08-cancel-readback', { state: (await read()).state });

    await dialog.getByRole('button', { name: 'Delete mission content…', exact: true }).click();

    await dialog.getByRole('checkbox', { name: 'I confirm this exact content deletion' }).check();

    await dialog.getByRole('button', { name: 'Confirm content deletion', exact: true }).click();

    await expect.poll(async () => (await read()).state).toBe('deleted');

    result('M09-delete-readback', {
      state: (await read()).state,
      envelope: (await read()).envelope,
    });

    await app.close();
    await boot();

    result('M10-restart-readback', {
      state: (await read()).state,
      envelope: (await read()).envelope,
      liveSessions: (await hook('liveSessions')).length,
    });
  } else if (mode === 'ideas') {
    const workspaces = [];
    for (let i = 0; i < 2; i++) {
      await hook('setPickerPath', mkdtempSync(join(tmpdir(), 'audit-ideas-')));
      const choice = await call('workspaces.choose');
      workspaces.push(
        await call('workspaces.approve', {
          candidateToken: choice.candidateToken,
        }),
      );
    }
    await hook(
      'fakeRepoIdeas',
      [1, 2, 3].map((n) => ({
        title: `Repo A idea ${n}`,
        rationale: 'Fixture only',
        proposedObjective: `Repo A objective ${n}`,
        proposedCompletionEvidence: 'Fixture proof',
      })),
    );
    await page.reload();
    await button('New mission…').click();
    await page.getByRole('combobox', { name: 'Repo', exact: true }).selectOption(workspaces[0].id);
    await button('Generate ideas').click();
    await page.locator('.repo-idea-card').first().waitFor();
    await page.getByRole('combobox', { name: 'Repo', exact: true }).selectOption(workspaces[1].id);
    result('I01-stale-ideas', {
      repoSelectionChanged: true,
      titles: await page.locator('.repo-idea-card h2').allTextContents(),
    });
    await page.getByRole('button', { name: 'Use this idea', exact: true }).first().click();
    await page.getByLabel('Finish line', { exact: true }).waitFor();
    const id = await latestDraft();
    await closeDraft();
    const fields = (await draft(id)).fieldValues;
    result('I02-picked-readback', {
      objective: fields.objective,
      proof: fields.completionEvidence,
      retainedWorkspaces: fields.workspaces ?? null,
      liveSessions: (await hook('liveSessions')).length,
    });
  } else throw Error('Expected drafts, missions or ideas');
} finally {
  if (app) await app.close().catch(() => {});
}
