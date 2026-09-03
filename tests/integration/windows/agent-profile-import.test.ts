/**
 * T093 — failing-first Windows integration tests for reviewed agent-manifest
 * import (Feature 002, US6). `profiles.chooseFile` / `profiles.previewImport`
 * / `profiles.confirmImport` and their supporting main-process hooks do not
 * exist yet (T099/T100); every scenario below is expected to fail until then.
 *
 * Contract: specs/002-agent-mailbox-routing/contracts/agent-profiles.md
 */

import { rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import {
  MALFORMED_AGENT_MANIFEST_TEXT_FIXTURES,
  MARVEL_ROSTER_FIXTURES,
  writeAgentManifestFile,
  CHANGED_AFTER_PREVIEW_EDITED_FIXTURE,
  CHANGED_AFTER_PREVIEW_ORIGINAL_FIXTURE,
  type AgentManifestFixture,
} from '@threadhelm/test-fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupUserData, launchApp, type LaunchedApp } from '../../e2e/helpers/app.js';

type Preview = { previewToken: string; digest: string; basename: string; compatibility: string };
type Imported = { profileId: string; currentRevisionId: string; digest: string };

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

function tempDir(tag: string): string {
  const dir = mkdtempSync(join(tmpdir(), `thm-profile-${tag}-`));
  dirs.push(dir);
  return dir;
}

async function selectProfileFile(target: LaunchedApp, path: string): Promise<void> {
  await target.app.evaluate((_electron, filePath) => {
    const hooks = (
      globalThis as unknown as { __threadhelmTest: { setProfileFilePickerPath(p: string): void } }
    ).__threadhelmTest;
    return hooks.setProfileFilePickerPath(filePath);
  }, path);
}

async function importFixture(
  target: LaunchedApp,
  dir: string,
  fx: AgentManifestFixture,
): Promise<Imported> {
  writeAgentManifestFile(dir, fx.basename, fx.text);
  await selectProfileFile(target, join(dir, fx.basename));
  const chosen = await target.call<{ fileHandle: string }>('profiles.chooseFile');
  const preview = await target.call<Preview>('profiles.previewImport', {
    fileHandle: chosen.fileHandle,
  });
  const imported = await target.call<Pick<Imported, 'profileId' | 'currentRevisionId'>>(
    'profiles.confirmImport',
    {
      previewToken: preview.previewToken,
      importConfirmation: true,
    },
  );
  const detail = await target.call<{ digest: string }>('profiles.get', {
    profileId: imported.profileId,
  });
  return { ...imported, digest: detail.digest };
}

describe('reviewed agent-profile import', () => {
  it('selects one file through the picker and imports it as a new profile', async () => {
    const dir = tempDir('single');
    const fx = MARVEL_ROSTER_FIXTURES[0]!;

    const imported = await importFixture(app, dir, fx);

    expect(imported.digest).toBe(fx.digest);
    const listed = await app.call<{ profiles: { profileId: string }[] }>('profiles.list');
    expect(listed.profiles.map((p) => p.profileId)).toContain(imported.profileId);
    expect(await app.call('sessions.list')).toMatchObject({ sessions: [] });
    expect(await app.call('workspaces.list')).toEqual([]);
  });

  it('persists the imported profile revision across an app restart', async () => {
    const dir = tempDir('restart');
    const fx = MARVEL_ROSTER_FIXTURES[1]!;
    const imported = await importFixture(app, dir, fx);
    const userData = app.userData;

    await app.close();
    app = await launchApp({ userData });

    const detail = await app.call<{ digest: string; currentRevisionId: string }>('profiles.get', {
      profileId: imported.profileId,
    });
    expect(detail.digest).toBe(fx.digest);
    expect(detail.currentRevisionId).toBe(imported.currentRevisionId);
  });

  it('never stores the Downloads-style source path — only the basename — anywhere durable', async () => {
    const dir = tempDir('redaction');
    const fx = MARVEL_ROSTER_FIXTURES[2]!;
    await importFixture(app, dir, fx);

    const database = new Database(join(app.userData, 'threadhelm.sqlite'), {
      readonly: true,
      fileMustExist: true,
    });
    try {
      const profileRows = database.prepare('SELECT * FROM agent_profiles').all() as Record<
        string,
        unknown
      >[];
      const revisionRows = database
        .prepare('SELECT * FROM agent_profile_revisions')
        .all() as Record<string, unknown>[];
      for (const row of [...profileRows, ...revisionRows]) {
        for (const value of Object.values(row)) {
          if (typeof value === 'string') expect(value).not.toContain(dir);
        }
      }
    } finally {
      database.close();
    }
  });

  it('fails closed when the file changes on disk between preview and confirm', async () => {
    const dir = tempDir('changed');
    writeAgentManifestFile(
      dir,
      CHANGED_AFTER_PREVIEW_ORIGINAL_FIXTURE.basename,
      CHANGED_AFTER_PREVIEW_ORIGINAL_FIXTURE.text,
    );
    await selectProfileFile(app, join(dir, CHANGED_AFTER_PREVIEW_ORIGINAL_FIXTURE.basename));
    const chosen = await app.call<{ fileHandle: string }>('profiles.chooseFile');
    const preview = await app.call<Preview>('profiles.previewImport', {
      fileHandle: chosen.fileHandle,
    });

    writeAgentManifestFile(
      dir,
      CHANGED_AFTER_PREVIEW_EDITED_FIXTURE.basename,
      CHANGED_AFTER_PREVIEW_EDITED_FIXTURE.text,
    );
    const confirmed = await app.dispatch('profiles.confirmImport', {
      previewToken: preview.previewToken,
      importConfirmation: true,
    });

    expect(confirmed.ok).toBe(false);
    if (!confirmed.ok) expect(confirmed.error.code).toBe('PROFILE_DIGEST_CHANGED');
    const listed = await app.call<{ profiles: unknown[] }>('profiles.list');
    expect(listed.profiles).toHaveLength(0);
  });

  it('rejects every malformed manifest at preview without importing anything', async () => {
    const dir = tempDir('malformed');
    for (const [index, malformed] of MALFORMED_AGENT_MANIFEST_TEXT_FIXTURES.entries()) {
      const basename = `malformed-${index}.agent.json`;
      writeAgentManifestFile(dir, basename, malformed.text);
      await selectProfileFile(app, join(dir, basename));
      const chosen = await app.call<{ fileHandle: string }>('profiles.chooseFile');
      const rejected = await app.dispatch('profiles.previewImport', {
        fileHandle: chosen.fileHandle,
      });
      expect(rejected.ok, malformed.reason).toBe(false);
      if (!rejected.ok)
        expect(rejected.error.code, malformed.reason).toBe('PROFILE_SCHEMA_INVALID');
    }
    const listed = await app.call<{ profiles: unknown[] }>('profiles.list');
    expect(listed.profiles).toHaveLength(0);
  });

  it('imports all ten sanitized roster manifests with distinct digests and no launch or worktree', async () => {
    const dir = tempDir('roster');
    const digests = new Set<string>();

    for (const fx of MARVEL_ROSTER_FIXTURES) {
      const imported = await importFixture(app, dir, fx);
      expect(imported.digest).toBe(fx.digest);
      digests.add(imported.digest);
    }

    expect(digests.size).toBe(MARVEL_ROSTER_FIXTURES.length);
    const listed = await app.call<{ profiles: unknown[] }>('profiles.list');
    expect(listed.profiles).toHaveLength(MARVEL_ROSTER_FIXTURES.length);
    expect(await app.call('sessions.list')).toMatchObject({ sessions: [] });
    expect(await app.call('workspaces.list')).toEqual([]);
  });
});
