/**
 * Installed-artifact acceptance (T088).
 *
 * Runs against a PACKAGED ThreadHelm, never the dev tree:
 *   pnpm test:acceptance:installed            (THREADHELM_ARTIFACT=<path to packaged ThreadHelm.exe>)
 *
 * Validates: Authenticode status under the owner-approved unsigned policy, published
 * checksum, production fuses, ASAR integrity, native module loading through a
 * real launch, and the displayed version. Records the Windows release and
 * architecture actually exercised so a report can only claim what it tested.
 * This launches an unpacked package or installed app; it does not install a Setup executable
 * or prove Squirrel uninstall behavior.
 */

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { FuseV1Options, getCurrentFuseWire } from '@electron/fuses';
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { cleanupUserData, makeUserData } from '../e2e/helpers/app.js';
import {
  assertNoPrivatePersonaFile,
  assertProductionPersonaBoundary,
} from '../../apps/desktop/src/packaging/release-personas.js';
import { assertInstalledNativeArchitecture } from './helpers/installed-native-architecture.js';
import { acceptanceFailure } from './helpers/acceptance-failure.js';
import { assertReleaseSignatureStatus } from '../../apps/desktop/src/packaging/signature-policy.js';

const artifact = process.env.THREADHELM_ARTIFACT;
const describeInstalled = artifact ? describe : describe.skip;

function logEvent(text: string, event: string): Record<string, unknown> | undefined {
  for (const line of text.split('\n')) {
    try {
      const value: unknown = JSON.parse(line);
      if (value && typeof value === 'object' && 'event' in value && value.event === event) {
        return value as Record<string, unknown>;
      }
    } catch {
      // A final line may still be flushing; wait for the next bounded observation.
    }
  }
  return undefined;
}

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
  const literalExe = `'${exe.replaceAll("'", "''")}'`;
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
  const failedTests: ReturnType<typeof acceptanceFailure>[] = [];
  report.failedTests = failedTests;
  beforeEach(() => {
    onTestFailed(({ task }) => {
      if (failedTests.length < 16)
        failedTests.push(acceptanceFailure(task.name, task.result?.errors, dirname(exe)));
    });
  });

  beforeAll(() => {
    expect(existsSync(exe), `artifact not found: ${exe}`).toBe(true);
  });

  afterAll(() => {
    report.finishedAt = new Date().toISOString();
    writeFileSync(
      process.env.THREADHELM_ARTIFACT_REPORT ??
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

  it('accepts unsigned distribution and rejects invalid signatures on the app and native payload', () => {
    const status = powershell(`(Get-AuthenticodeSignature -LiteralPath ${literalExe}).Status`);
    report.signatureStatus = status;
    report.distributionPolicy = 'unsigned';
    report.trustedPublisherVerified = status === 'Valid';
    const unsigned: string[] = [];
    const check = (file: string, signature: string) => {
      assertReleaseSignatureStatus(signature, file);
      if (signature === 'NotSigned') unsigned.push(file);
    };
    check(exe, status);
    const nativeRoot = join(dirname(exe), 'resources', 'app.asar.unpacked');
    expect(existsSync(nativeRoot)).toBe(true);
    const natives = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const file = join(directory, entry.name);
        return entry.isDirectory()
          ? natives(file)
          : /\.(?:exe|dll|node)$/i.test(entry.name)
            ? [file]
            : [];
      });
    const files = natives(nativeRoot);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const literal = `'${file.replaceAll("'", "''")}'`;
      check(file, powershell(`(Get-AuthenticodeSignature -LiteralPath ${literal}).Status`));
    }
    report.unsignedNativeOrAppFiles = unsigned;
    report.signaturePolicyPassed = true;
    scenarios.signature = unsigned.length
      ? `unsigned distribution policy passed: ${unsigned.length} unsigned files; publisher trust not established for these files`
      : `valid artifact and ${files.length} unpacked native signatures`;
  });

  it('has production fuses set', () => {
    // Electron writes the fuse wire into the binary; @electron/fuses reads it back.
    // FuseState values (constants.d.ts): DISABLE = 48, ENABLE = 49.
    const FuseState = { DISABLE: 48, ENABLE: 49 } as const;
    return getCurrentFuseWire(exe).then((wire) => {
      const config = wire as unknown as Record<number, number>;
      expect(config[FuseV1Options.RunAsNode]).toBe(FuseState.DISABLE);
      expect(config[FuseV1Options.EnableCookieEncryption]).toBe(FuseState.ENABLE);
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
    expect(existsSync(join(unpacked, 'out', 'main', 'threadhelm-coordination-bridge.exe'))).toBe(
      true,
    );
    const terminalNative = join(
      unpacked,
      'node_modules',
      'node-pty',
      'prebuilds',
      `win32-${process.arch}`,
    );
    for (const name of [
      'conpty.node',
      'conpty_console_list.node',
      'conpty/conpty.dll',
      'conpty/OpenConsole.exe',
    ]) {
      expect(
        existsSync(join(terminalNative, name)),
        `missing unpacked terminal dependency ${name}`,
      ).toBe(true);
    }
    scenarios.asar = 'present with app.asar.unpacked';
  });

  it('excludes private persona content from the actual packaged archive and unpacked runtime', () => {
    const resources = join(dirname(exe), 'resources');
    const archive = join(resources, 'app.asar');
    // ASAR stores its header and files without compression; scan the actual archive,
    // not a source tree whose imports may differ from the bundled module graph.
    assertNoPrivatePersonaFile(archive);
    assertProductionPersonaBoundary(join(resources, 'app.asar.unpacked'));
    scenarios.privatePersonas = 'absent from packaged archive and unpacked text assets';
  });

  it('contains native files matching the tested Windows architecture', () => {
    const desktopRequire = createRequire(
      resolve(import.meta.dirname, '../../apps/desktop/package.json'),
    );
    const makerRequire = createRequire(desktopRequire.resolve('@electron-forge/maker-squirrel'));
    const vendor = join(
      dirname(makerRequire.resolve('electron-winstaller/package.json')),
      'vendor',
      'Squirrel.exe',
    );
    const updaterIdentity = assertInstalledNativeArchitecture(dirname(exe), process.arch, vendor);
    report.installerUpdaterIdentity = updaterIdentity;
    scenarios.nativeArchitecture = updaterIdentity.updaterSha256
      ? `Application native files match ${process.arch}; maker updater separately byte-verified`
      : `Application native files match ${process.arch}; no maker updater present`;
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
      windowsHide: true,
      detached: false,
    });
    try {
      const log = await waitForLog(
        logFile,
        (text) => Boolean(logEvent(text, 'provider.probed') && logEvent(text, 'app.starting')),
        60_000,
      );
      const starting = logEvent(log, 'app.starting')!;
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
  throw new Error(
    `Log condition not met within ${timeoutMs}ms (${Buffer.byteLength(text)} bytes recorded; content omitted).`,
  );
}
