import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { inside } from '../../acceptance/helpers/squirrel-safety.js';

it.skipIf(process.platform !== 'win32')(
  'observes a relocated helper outside the empty installation until it exits',
  async () => {
    // A benign copied Node process tests observation only, never installation or deletion of an app.
    const root = mkdtempSync(join(tmpdir(), 'threadhelm-helper-observation-'));
    const helperRoot = join(root, 'temporary-helpers');
    mkdirSync(helperRoot);
    const executable = join(helperRoot, 'fixture-helper.exe');
    copyFileSync(process.execPath, executable);
    const digest = createHash('sha256').update(readFileSync(executable)).digest('hex');
    const child = spawn(executable, ['-e', 'setTimeout(() => {}, 30000)'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    const closed = new Promise<void>((resolveClose, reject) => {
      child.once('close', () => resolveClose());
      child.once('error', reject);
    });
    const observe = () =>
      JSON.parse(
        execFileSync(
          'pwsh.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-File',
            resolve('tests/acceptance/helpers/observe-installation.ps1'),
            '-InstallRoot',
            join(root, 'absent-installation'),
            '-HelperRoot',
            helperRoot,
          ],
          { encoding: 'utf8', windowsHide: true, timeout: 30_000 },
        ),
      );
    try {
      const during = observe();
      expect(during.rootEntries).toEqual([]);
      expect(during.processIds).toContain(child.pid);
      expect(during.helperProcesses).toContainEqual(
        expect.objectContaining({ processId: child.pid, sha256: digest }),
      );
      child.kill();
      await closed;
      expect(observe().helperProcesses).toEqual([]);
    } finally {
      if (child.exitCode === null && !child.killed) child.kill();
      await closed;
      inside(tmpdir(), root);
      rmSync(root, { recursive: true, force: true });
    }
  },
  60_000,
);
