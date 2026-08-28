/**
 * Installed-artifact acceptance (T088).
 *
 * Runs against a PACKAGED ThreadHelm, never the dev tree:
 *   pnpm test:acceptance:installed            (THREADHELM_ARTIFACT=<path to ThreadHelm.exe or Setup exe>)
 *
 * Validates: Authenticode signature (when the artifact claims one), published
 * checksum, production fuses, ASAR integrity, native module loading through a
 * real launch, and the displayed version. Records the Windows release and
 * architecture actually exercised so a report can only claim what it tested.
 */

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { FuseV1Options, getCurrentFuseWire } from '@electron/fuses';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupUserData, makeUserData } from '../e2e/helpers/app.js';

const artifact = process.env.THREADHELM_ARTIFACT;
const describeInstalled = artifact ? describe : describe.skip;

function powershell(script: string): string {
  // Prefer PowerShell 7; Windows PowerShell 5 sometimes cannot load the
  // Security module non-interactively, so it gets an explicit import.
  const attempts: [string, string[]][] = [
    ['pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script]],
    [
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Import-Module Microsoft.PowerShell.Security; ${script}`,
      ],
    ],
  ];
  let lastError: unknown;
  for (const [file, args] of attempts) {
    try {
      return execFileSync(file, args, { encoding: 'utf8', windowsHide: true }).trim();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

describeInstalled('installed artifact acceptance', () => {
  const exe = resolve(artifact ?? '');
  const report: Record<string, unknown> = {
    artifact: exe,
    windowsRelease: release(),
    windowsBuild: powershell('(Get-CimInstance Win32_OperatingSystem).BuildNumber'),
    windowsEdition: powershell('(Get-CimInstance Win32_OperatingSystem).Caption'),
    arch: process.arch,
    startedAt: new Date().toISOString(),
    scenarios: {} as Record<string, string>,
  };
  const scenarios = report.scenarios as Record<string, string>;

  beforeAll(() => {
    expect(existsSync(exe), `artifact not found: ${exe}`).toBe(true);
  });

  afterAll(() => {
    report.finishedAt = new Date().toISOString();
    writeFileSync(
      resolve(dirname(exe), 'threadhelm-acceptance-report.json'),
      JSON.stringify(report, null, 2),
    );
  });

  it('matches its published SHA-256 checksum when one is shipped', () => {
    const checksumFile = `${exe}.sha256`;
    if (!existsSync(checksumFile)) {
      scenarios.checksum = 'skipped: no .sha256 next to artifact';
      return;
    }
    const expected = readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0];
    const actual = createHash('sha256').update(readFileSync(exe)).digest('hex');
    expect(actual).toBe(expected);
    scenarios.checksum = 'verified';
  });

  it('carries a valid Authenticode signature (or records that it is unsigned)', () => {
    const status = powershell(`(Get-AuthenticodeSignature -FilePath '${exe}').Status`);
    report.signatureStatus = status;
    if (status === 'NotSigned') {
      scenarios.signature = 'UNSIGNED — public release requires signing';
      // Unsigned builds are allowed for internal testing but the report says so loudly.
      return;
    }
    expect(status).toBe('Valid');
    scenarios.signature = `valid: ${powershell(`(Get-AuthenticodeSignature -FilePath '${exe}').SignerCertificate.Subject`)}`;
  });

  it('has production fuses set', () => {
    // Electron writes the fuse wire into the binary; @electron/fuses reads it back.
    // FuseState values (constants.d.ts): DISABLE = 48, ENABLE = 49.
    const FuseState = { DISABLE: 48, ENABLE: 49 } as const;
    return getCurrentFuseWire(exe).then((wire) => {
      const config = wire as unknown as Record<number, number>;
      expect(config[FuseV1Options.RunAsNode]).toBe(FuseState.DISABLE);
      expect(config[FuseV1Options.EnableNodeOptionsEnvironmentVariable]).toBe(FuseState.DISABLE);
      expect(config[FuseV1Options.EnableNodeCliInspectArguments]).toBe(FuseState.DISABLE);
      expect(config[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]).toBe(FuseState.ENABLE);
      expect(config[FuseV1Options.OnlyLoadAppFromAsar]).toBe(FuseState.ENABLE);
      scenarios.fuses = 'verified';
    });
  });

  it('ships an ASAR with unpacked native addons', () => {
    const resources = join(dirname(exe), 'resources');
    expect(existsSync(join(resources, 'app.asar'))).toBe(true);
    const unpacked = join(resources, 'app.asar.unpacked');
    expect(existsSync(unpacked)).toBe(true);
    scenarios.asar = 'present with app.asar.unpacked';
  });

  // Production fuses disable the inspect port Playwright attaches through, so
  // the packaged app is observed the way a user would see it: it starts, opens
  // its window, loads the native module (bootstrap imports it before the first
  // log line), probes both providers, and refuses a second controller.
  it('launches, loads the native module, probes providers, and reports its version', async () => {
    const userData = makeUserData();
    const logFile = join(userData, 'logs', 'threadhelm.log');
    const first = spawn(exe, [`--user-data-dir=${userData}`], {
      stdio: 'ignore',
      windowsHide: false,
      detached: false,
    });
    try {
      const log = await waitForLog(logFile, (text) => text.includes('provider.probed'), 60_000);
      const starting = JSON.parse(log.split('\n').find((l) => l.includes('app.starting'))!) as {
        version: string;
        arch: string;
      };
      expect(starting.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(starting.arch).toBe(process.arch);
      expect(log).toContain('recovery.reconciled');
      report.appVersion = starting.version;
      const probed = await waitForLog(
        logFile,
        (text) =>
          text.includes('"providerId":"codex-cli"') && text.includes('"providerId":"claude-code"'),
        60_000,
      );
      expect(probed).not.toMatch(/sk-|Bearer |eyJ[A-Za-z0-9_-]{10,}\./);
      expect(first.exitCode).toBeNull();

      // Single instance: a second launch must exit without becoming a controller.
      const second = spawn(exe, [`--user-data-dir=${userData}`], {
        stdio: 'ignore',
        windowsHide: true,
      });
      const secondExit = await new Promise<number | null>((resolveExit) => {
        const timer = setTimeout(() => resolveExit(null), 20_000);
        second.on('exit', (code) => {
          clearTimeout(timer);
          resolveExit(code);
        });
      });
      expect(secondExit, 'second instance must exit').not.toBeNull();
      expect(first.exitCode).toBeNull();
      scenarios.launchAndNative = `version ${starting.version}; both providers probed; second instance exited ${secondExit}`;
    } finally {
      first.kill();
      await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
      cleanupUserData(userData);
    }
  }, 180_000);
});

async function waitForLog(
  file: string,
  predicate: (text: string) => boolean,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let text = '';
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      text = readFileSync(file, 'utf8');
      if (predicate(text)) return text;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`log condition not met within ${timeoutMs}ms; log so far:\n${text.slice(-1500)}`);
}
