/**
 * Opt-in acceptance for the user's reviewed roster. The files stay outside
 * the repository; output is limited to basenames, SHA-256 digests, and
 * compatibility/result metadata.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupUserData, launchApp, type LaunchedApp } from '../e2e/helpers/app.js';

const manifestDir = process.env.THREADHELM_PROFILE_MANIFEST_DIR;
const describeRoster = manifestDir ? describe : describe.skip;

type Preview = {
  previewToken: string;
  digest: string;
  basename: string;
  compatibility: string;
  normalized: { model: string; isolate: boolean; tokenCap: number };
};

async function selectProfileFile(app: LaunchedApp, path: string): Promise<void> {
  await app.app.evaluate((_electron, filePath) => {
    const hooks = (
      globalThis as unknown as { __threadhelmTest: { setProfileFilePickerPath(p: string): void } }
    ).__threadhelmTest;
    hooks.setProfileFilePickerPath(filePath);
  }, path);
}

describeRoster('user-selected reviewed agent-profile manifests', () => {
  let app: LaunchedApp;

  beforeAll(async () => {
    app = await launchApp();
  });

  afterAll(async () => {
    await app.close();
    cleanupUserData(app.userData);
  });

  it('imports the exact ten files with the expected bounded request distribution', async () => {
    const basenames = readdirSync(manifestDir!)
      .filter((name) => name.endsWith('.agent.json'))
      .sort();
    expect(basenames).toHaveLength(10);

    const results: Array<{
      basename: string;
      digest: string;
      model: string;
      isolate: boolean;
      tokenCap: number;
      compatibility: string;
    }> = [];

    for (const basename of basenames) {
      const path = join(manifestDir!, basename);
      const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
      await selectProfileFile(app, path);
      const chosen = await app.call<{ fileHandle: string }>('profiles.chooseFile');
      const preview = await app.call<Preview>('profiles.previewImport', {
        fileHandle: chosen.fileHandle,
      });
      expect(preview.basename).toBe(basename);
      expect(preview.digest).toBe(digest);
      const imported = await app.call<{ profileId: string }>('profiles.confirmImport', {
        previewToken: preview.previewToken,
        importConfirmation: true,
      });
      const detail = await app.call<{ digest: string }>('profiles.get', {
        profileId: imported.profileId,
      });
      expect(detail.digest).toBe(digest);
      results.push({
        basename,
        digest,
        model: preview.normalized.model,
        isolate: preview.normalized.isolate,
        tokenCap: preview.normalized.tokenCap,
        compatibility: preview.compatibility,
      });
    }

    expect(results.filter((item) => item.model === 'claude-opus-5')).toHaveLength(4);
    expect(results.filter((item) => item.model === 'claude-sonnet-5')).toHaveLength(6);
    expect(results.filter((item) => item.isolate)).toHaveLength(8);
    expect(results.filter((item) => !item.isolate)).toHaveLength(2);
    expect(results.every((item) => item.tokenCap === 2_000_000)).toBe(true);
    expect(results.every((item) => item.compatibility === 'compatible')).toBe(true);

    expect(await app.call('sessions.list')).toMatchObject({ sessions: [] });
    expect(await app.call('workspaces.list')).toEqual([]);
    for (const item of results) console.log(`${item.basename}|${item.digest}|PASS`);
  });
});
