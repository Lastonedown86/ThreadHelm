/** Windows-backed US7 durability: native picker target, atomic export, and restart. */

import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupUserData, launchApp, type LaunchedApp } from '../../e2e/helpers/app.js';

let app: LaunchedApp;
const dirs: string[] = [];

beforeEach(async () => {
  app = await launchApp();
});
afterEach(async () => {
  await app.close();
  cleanupUserData(app.userData);
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'thm-wizard-'));
  dirs.push(dir);
  return dir;
}
async function setExportTarget(path: string | null): Promise<void> {
  await app.app.evaluate((_electron, target) => {
    (
      globalThis as unknown as {
        __threadhelmTest: { setAgentExportPickerPath(path: string | null): void };
      }
    ).__threadhelmTest.setAgentExportPickerPath(target);
  }, path);
}
async function failNextExport(kind: 'beforeWrite' | 'afterReplace' | 'tempCleanup'): Promise<void> {
  await app.app.evaluate((_electron, failure) => {
    const hooks = (
      globalThis as unknown as {
        __threadhelmTest: {
          failNextAgentExportBeforeWrite(): void;
          failNextAgentExportAfterReplace(): void;
          failNextAgentExportTempCleanup(): void;
        };
      }
    ).__threadhelmTest;
    if (failure === 'beforeWrite') hooks.failNextAgentExportBeforeWrite();
    else if (failure === 'afterReplace') hooks.failNextAgentExportAfterReplace();
    else hooks.failNextAgentExportTempCleanup();
  }, kind);
}
async function exportDraft(target: string, overwrite = false) {
  const listed = await app.call<{ templates: { currentRevisionId: string }[] }>(
    'agentTemplates.list',
  );
  const draft = await app.call<{ draftId: string; version: number }>('agentWizard.createDraft', {
    source: { kind: 'template', templateRevisionId: listed.templates[0]!.currentRevisionId },
  });
  const completion = await app.call<{
    completionToken: string;
    manifestJson: string;
    digest: string;
  }>('agentWizard.previewCompletion', {
    draftId: draft.draftId,
    version: draft.version,
    action: 'export',
  });
  await setExportTarget(target);
  const selected = await app.call<{ targetHandle: string }>('agentWizard.chooseExportTarget');
  const preview = await app.call<{ exportToken: string; collision: boolean }>(
    'agentWizard.previewExport',
    { completionToken: completion.completionToken, targetHandle: selected.targetHandle },
  );
  const result = await app.dispatch('agentWizard.confirmExport', {
    exportToken: preview.exportToken,
    overwriteConfirmation: overwrite,
  });
  return { draft, completion, preview, result };
}

describe('agent creation wizard export', () => {
  it('uses the main-owned picker, atomically writes exact UTF-8 JSON, and preserves completion across restart', async () => {
    const dir = tempDir();
    const target = join(dir, 'reviewer.hire.json');
    const exported = await exportDraft(target);
    expect(exported.result.ok).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(exported.completion.manifestJson);
    expect(readdirSync(dir).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    const restored = await app.call<{ state: string; completedAt: string | null }>(
      'agentWizard.getDraft',
      { draftId: exported.draft.draftId },
    );
    expect(restored.state).toBe('completed');
    expect(restored.completedAt).not.toBeNull();
  });

  it('requires a distinct overwrite confirmation after an existing target is disclosed', async () => {
    const dir = tempDir();
    const target = join(dir, 'collision.hire.json');
    writeFileSync(target, 'keep-me', 'utf8');
    const listed = await app.call<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
    );
    const draft = await app.call<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: listed.templates[0]!.currentRevisionId },
    });
    const completion = await app.call<{ completionToken: string }>(
      'agentWizard.previewCompletion',
      { draftId: draft.draftId, version: draft.version, action: 'export' },
    );
    await setExportTarget(target);
    const selected = await app.call<{ targetHandle: string }>('agentWizard.chooseExportTarget');
    const preview = await app.call<{
      exportToken: string;
      collision: boolean;
      requiresOverwriteConfirmation: boolean;
    }>('agentWizard.previewExport', {
      completionToken: completion.completionToken,
      targetHandle: selected.targetHandle,
    });
    expect(preview).toMatchObject({ collision: true, requiresOverwriteConfirmation: true });
    const denied = await app.dispatch('agentWizard.confirmExport', {
      exportToken: preview.exportToken,
      overwriteConfirmation: false,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('CONFIRMATION_REQUIRED');
    expect(readFileSync(target, 'utf8')).toBe('keep-me');
  });

  it('fails closed when the selected target changes after preview', async () => {
    const dir = tempDir();
    const target = join(dir, 'changed.hire.json');
    const listed = await app.call<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
    );
    const draft = await app.call<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: listed.templates[0]!.currentRevisionId },
    });
    const completion = await app.call<{ completionToken: string }>(
      'agentWizard.previewCompletion',
      {
        draftId: draft.draftId,
        version: draft.version,
        action: 'export',
      },
    );
    await setExportTarget(target);
    const selected = await app.call<{ targetHandle: string }>('agentWizard.chooseExportTarget');
    const preview = await app.call<{ exportToken: string }>('agentWizard.previewExport', {
      completionToken: completion.completionToken,
      targetHandle: selected.targetHandle,
    });
    writeFileSync(target, 'created-after-preview', 'utf8');
    const confirmed = await app.dispatch('agentWizard.confirmExport', {
      exportToken: preview.exportToken,
      overwriteConfirmation: true,
    });
    expect(confirmed.ok).toBe(false);
    if (!confirmed.ok) expect(confirmed.error.code).toBe('TARGET_CHANGED');
    expect(readFileSync(target, 'utf8')).toBe('created-after-preview');
  });

  it('records a write failure without creating a partial target', async () => {
    const dir = tempDir();
    const target = join(dir, 'failed.hire.json');
    await failNextExport('beforeWrite');
    const exported = await exportDraft(target);
    expect(exported.result.ok).toBe(false);
    if (!exported.result.ok) expect(exported.result.error.code).toBe('STORAGE_UNAVAILABLE');
    expect(readdirSync(dir)).not.toContain('failed.hire.json');
    const db = new Database(join(app.userData, 'threadhelm.sqlite'), { readonly: true });
    try {
      expect(
        db
          .prepare('SELECT state FROM agent_profile_export_intents WHERE draft_id = ?')
          .get(exported.draft.draftId),
      ).toEqual({ state: 'failed' });
    } finally {
      db.close();
    }
  });

  it('retains an unknown post-install cleanup outcome across restart and never replays it', async () => {
    const dir = tempDir();
    const target = join(dir, 'unknown.hire.json');
    await failNextExport('tempCleanup');
    const exported = await exportDraft(target);
    expect(exported.result.ok).toBe(false);
    expect(readFileSync(target, 'utf8')).toBe(exported.completion.manifestJson);
    const userData = app.userData;
    await app.close();
    app = await launchApp({ userData });
    expect(readFileSync(target, 'utf8')).toBe(exported.completion.manifestJson);
    const db = new Database(join(app.userData, 'threadhelm.sqlite'), { readonly: true });
    try {
      expect(
        db
          .prepare('SELECT state FROM agent_profile_export_intents WHERE draft_id = ?')
          .get(exported.draft.draftId),
      ).toEqual({ state: 'unknown' });
      expect(
        db
          .prepare('SELECT COUNT(*) AS count FROM agent_profile_export_intents WHERE draft_id = ?')
          .get(exported.draft.draftId),
      ).toEqual({ count: 1 });
    } finally {
      db.close();
    }
  });

  it('produces identical reviewed JSON from a local template and the matching reviewed profile revision', async () => {
    const bundled = await app.call<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
    );
    const source = await app.call<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: bundled.templates[0]!.currentRevisionId },
    });
    const local = await app.call<{ currentRevisionId: string }>('agentTemplates.saveRevision', {
      source: { kind: 'draft', draftId: source.draftId, version: source.version },
      key: 'local-parity',
      name: 'Local parity',
    });
    const profilePreview = await app.call<{ completionToken: string }>(
      'agentWizard.previewCompletion',
      {
        draftId: source.draftId,
        version: source.version,
        action: 'profile',
      },
    );
    const profile = await app.call<{ currentRevisionId: string }>('agentWizard.confirmProfile', {
      completionToken: profilePreview.completionToken,
      profileConfirmation: true,
    });
    const fromTemplate = await app.call<{ draftId: string; version: number }>(
      'agentWizard.createDraft',
      {
        source: { kind: 'template', templateRevisionId: local.currentRevisionId },
      },
    );
    const fromProfile = await app.call<{ draftId: string; version: number }>(
      'agentWizard.createDraft',
      {
        source: { kind: 'profile', profileRevisionId: profile.currentRevisionId },
      },
    );
    const templatePreview = await app.call<{ manifestJson: string }>(
      'agentWizard.previewCompletion',
      {
        draftId: fromTemplate.draftId,
        version: fromTemplate.version,
        action: 'profile',
      },
    );
    const profileDraftPreview = await app.call<{ manifestJson: string }>(
      'agentWizard.previewCompletion',
      {
        draftId: fromProfile.draftId,
        version: fromProfile.version,
        action: 'profile',
      },
    );
    expect(templatePreview.manifestJson).toBe(profileDraftPreview.manifestJson);
    expect(await app.call('sessions.list')).toMatchObject({ sessions: [] });
  });

  it('allows only one concurrent export to an initially absent target', async () => {
    const dir = tempDir();
    const target = join(dir, 'shared.hire.json');
    const listed = await app.call<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
    );
    const prepare = async () => {
      const draft = await app.call<{ draftId: string; version: number }>(
        'agentWizard.createDraft',
        {
          source: { kind: 'template', templateRevisionId: listed.templates[0]!.currentRevisionId },
        },
      );
      const completion = await app.call<{ completionToken: string; manifestJson: string }>(
        'agentWizard.previewCompletion',
        { draftId: draft.draftId, version: draft.version, action: 'export' },
      );
      await setExportTarget(target);
      const selected = await app.call<{ targetHandle: string }>('agentWizard.chooseExportTarget');
      const preview = await app.call<{ exportToken: string }>('agentWizard.previewExport', {
        completionToken: completion.completionToken,
        targetHandle: selected.targetHandle,
      });
      return { completion, preview };
    };
    const [first, second] = await Promise.all([prepare(), prepare()]);
    const results = await Promise.all([
      app.dispatch('agentWizard.confirmExport', {
        exportToken: first.preview.exportToken,
        overwriteConfirmation: false,
      }),
      app.dispatch('agentWizard.confirmExport', {
        exportToken: second.preview.exportToken,
        overwriteConfirmation: false,
      }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(readFileSync(target, 'utf8')).toBe(
      results[0]!.ok ? first.completion.manifestJson : second.completion.manifestJson,
    );
  });
});
