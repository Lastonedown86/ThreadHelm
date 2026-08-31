import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { inside } from '../../acceptance/helpers/squirrel-safety.js';
import { installerGuid } from '../../../apps/desktop/src/packaging/installer-identity.js';

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
    const child = spawn(
      executable,
      [
        '-e',
        `
      process.stdin.resume();
      process.stdin.on('end', () => process.exit(0));
      setTimeout(() => process.exit(2), 45000);
      process.stdout.write(JSON.stringify({ pid: process.pid, arch: process.arch, node: process.versions.node }) + '\\n');
    `,
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(0, 4096);
    });
    const closed = new Promise<void>((resolveClose) => {
      child.once('close', () => resolveClose());
    });
    const ready = new Promise<{ pid: number; arch: string; node: string }>(
      (resolveReady, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`HELPER_READY_TIMEOUT: ${stderr}`)),
          10_000,
        );
        let stdout = '';
        child.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once('close', (code, signal) => {
          clearTimeout(timer);
          reject(
            new Error(`HELPER_EXIT_BEFORE_READY: code=${code} signal=${signal} stderr=${stderr}`),
          );
        });
        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
          if (stdout.length > 1024) {
            clearTimeout(timer);
            reject(new Error('HELPER_READY_OUTPUT_LIMIT'));
            child.kill();
          } else if (stdout.includes('\n')) {
            clearTimeout(timer);
            try {
              resolveReady(JSON.parse(stdout.trim()));
            } catch {
              reject(new Error('HELPER_READY_INVALID'));
            }
          }
        });
      },
    );
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
            '-AppGuid',
            installerGuid,
            '-HelperRoot',
            helperRoot,
          ],
          { encoding: 'utf8', windowsHide: true, timeout: 30_000 },
        ),
      );
    try {
      // A created PID does not prove the copied runtime reached JavaScript on this architecture.
      expect(await ready).toEqual({
        pid: child.pid,
        arch: process.arch,
        node: process.versions.node,
      });
      const during = observe();
      expect(during.rootEntries).toEqual([]);
      expect(during.processIds).toContain(child.pid);
      expect(during.helperProcesses).toContainEqual(
        expect.objectContaining({ processId: child.pid, sha256: digest }),
      );
      child.stdin.end();
      await closed;
      expect(child.exitCode, stderr).toBe(0);
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
