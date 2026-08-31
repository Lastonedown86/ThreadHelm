/** Real NSIS install/remove; refuses local and self-hosted accounts before any effect.
 * Invocation and safety/evidence limits: .github/workflows/installed-acceptance.yml.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { installerGuid } from '../../apps/desktop/src/packaging/installer-identity.js';
import { isolatedProof } from './helpers/isolated-proof.js';
import {
  assertFreshAccount,
  assertUninstalled,
  realChild,
  installationPlan,
  signatureEvidence,
  type InstallObservation,
} from './helpers/squirrel-safety.js';

const enabled = process.env.THREADHELM_INSTALLER_ACCEPTANCE === '1';
const helperRoot = resolve(import.meta.dirname, 'helpers');
type Observation = InstallObservation & {
  registrationDetails: { key: string; version: string; uninstall: string }[];
  windows: { caption: string; build: string };
  helperProcesses: {
    processId: number;
    parentProcessId: number;
    createdAt: string;
    sha256: string | null;
  }[];
};

function observe(
  installRoot: string,
  includeTree = false,
  temporaryHelperRoot?: string,
): Observation {
  return JSON.parse(
    execFileSync(
      'pwsh.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-File',
        join(helperRoot, 'observe-installation.ps1'),
        '-InstallRoot',
        installRoot,
        '-AppGuid',
        installerGuid,
        ...(includeTree ? ['-IncludeTree'] : []),
        ...(temporaryHelperRoot ? ['-HelperRoot', temporaryHelperRoot] : []),
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30_000,
      },
    ),
  );
}

async function waitFor<T>(
  read: () => T,
  accepts: (value: T) => boolean,
  timeout = 30_000,
): Promise<T> {
  const until = Date.now() + timeout;
  let value = read();
  while (!accepts(value) && Date.now() < until) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    value = read();
  }
  return value;
}

function run(file: string, args: string[], timeout: number, env = process.env): Promise<number> {
  return new Promise((resolveExit, reject) => {
    const child = spawn(file, args, { stdio: 'ignore', windowsHide: true, env });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('CHILD_TIMEOUT'));
    }, timeout);
    child.once('error', () => {
      clearTimeout(timer);
      reject(new Error('CHILD_START_FAILED'));
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolveExit(code ?? -1);
    });
  });
}

/** The native addon is loaded only by a subprocess which must close before uninstall. */
async function nativeArtifactProof(installed: string, reportRoot: string, arch: string) {
  const unpacked = join(dirname(installed), 'resources', 'app.asar.unpacked');
  const nativeDir = join(unpacked, 'node_modules', '@threadhelm', 'windows-supervisor');
  const files = readdirSync(nativeDir).filter(
    (name) => name === `windows-supervisor.win32-${arch}-msvc.node`,
  );
  expect(files).toHaveLength(1);
  const nativeFile = realChild(unpacked, join(nativeDir, files[0]!));
  const bridge = realChild(
    unpacked,
    join(unpacked, 'out', 'main', 'threadhelm-coordination-bridge.exe'),
  );
  const proof = await isolatedProof(process.execPath, [
    join(helperRoot, 'installed-native-proof.mjs'),
    nativeFile,
    bridge,
    reportRoot,
  ]);
  expect(proof.code).toBe(0);
  expect(proof.result.passed).toBe(true);
  expect(proof.result.phases).toEqual({ terminate: true, close: true });
  return { ...proof.result, proofProcessExited: true };
}

async function installedElectronProof(installed: string, reportRoot: string) {
  const unpacked = join(dirname(installed), 'resources', 'app.asar.unpacked');
  const bridge = realChild(
    unpacked,
    join(unpacked, 'out', 'main', 'threadhelm-coordination-bridge.exe'),
  );
  const config = join(reportRoot, 'electron-bridge.json');
  const pidFile = join(reportRoot, 'electron-bridge.pid');
  const sessionId = randomUUID();
  writeFileSync(
    config,
    JSON.stringify({
      version: 1,
      pipeName: `\\\\.\\pipe\\threadhelm-installed-${sessionId}`,
      sessionId,
      credential: `disposable-proof-${randomUUID()}-${randomUUID()}`,
    }),
  );
  try {
    const result = await new Promise<{
      code: number | null;
      proof: { passed: boolean; steps: Record<string, unknown>; failure?: string };
    }>((resolveProof, reject) => {
      const child = spawn(
        installed,
        [
          '--threadhelm-proof-node',
          process.execPath,
          join(helperRoot, 'installed-session-agent.mjs'),
          '--bridge-path',
          bridge,
          '--session-config',
          config,
          '--descendant-pid-file',
          pidFile,
        ],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' },
        },
      );
      let stdout = '';
      let bytes = 0;
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('INSTALLED_ELECTRON_PROOF_TIMEOUT'));
      }, 120_000);
      const collect = (chunk: Buffer, output: boolean) => {
        bytes += chunk.length;
        if (bytes > 64 * 1024) {
          clearTimeout(timer);
          child.kill();
          reject(new Error('INSTALLED_ELECTRON_PROOF_OUTPUT_LIMIT'));
        } else if (output) stdout += chunk.toString('utf8');
      };
      child.stdout.on('data', (chunk: Buffer) => collect(chunk, true));
      child.stderr.on('data', (chunk: Buffer) => collect(chunk, false));
      child.once('error', () => {
        clearTimeout(timer);
        reject(new Error('INSTALLED_ELECTRON_PROOF_START_FAILED'));
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        try {
          const lines = stdout
            .split(/\r?\n/)
            .filter((line) => line.startsWith('THREADHELM_PROOF '));
          if (lines.length !== 1) throw new Error('INSTALLED_ELECTRON_PROOF_RESULT_MISSING');
          resolveProof({ code, proof: JSON.parse(lines[0]!.slice('THREADHELM_PROOF '.length)) });
        } catch {
          reject(new Error('INSTALLED_ELECTRON_PROOF_RESULT_INVALID'));
        }
      });
    });
    expect(result.code).toBe(0);
    expect(result.proof.passed, result.proof.failure).toBe(true);
    for (const step of [
      'dormantJobEmpty',
      'hostVerifiedInJob',
      'jobHoldsOnlyHost',
      'rootVerifiedInJob',
      'descendantVerifiedInJob',
      'scopeEmptyAfterTerminate',
      'rootDiesOnHandleClose',
      'hostDiesOnHandleClose',
      'closeDescendantVerifiedInJob',
      'descendantDiesOnHandleClose',
    ]) {
      expect(result.proof.steps[step], step).toBe(true);
    }
    return {
      scope: 'installed-electron-main-session-host-conpty-and-real-bridge',
      nodeExecutable: process.execPath,
      bridge,
      ...result.proof,
    };
  } finally {
    writeFileSync(config, '');
  }
}

describe.skipIf(!enabled)('actual NSIS installation on a disposable GitHub Windows runner', () => {
  it('installs the built Setup, exercises installed artifacts, and verifies actual uninstall cleanup', async () => {
    // This gate is before filesystem writes, process launch, or registry inspection.
    const plan = installationPlan(process.env, process.platform, process.arch);
    const report: Record<string, unknown> = {
      schemaVersion: 1,
      commit: process.env.GITHUB_SHA,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      arch: process.arch,
      startedAt: new Date().toISOString(),
      installedElectronSessionHost: 'NOT_RUN',
      distributionPolicy: 'unsigned',
      trustedPublisherVerified: false,
      providerMissionGate: 'NOT_RUN',
    };
    expect(
      existsSync(plan.installRoot),
      'never replace a pre-existing installation, even empty',
    ).toBe(false);
    expect(existsSync(plan.legacyInstallRoot), 'no implicit Squirrel migration or cleanup').toBe(
      false,
    );
    const before = observe(plan.installRoot);
    assertFreshAccount(before);
    const installer = realChild(plan.workspace, plan.installer);
    const checksum = readFileSync(`${installer}.sha256`, 'utf8').trim().split(/\s+/)[0];
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    const digest = createHash('sha256').update(readFileSync(installer)).digest('hex');
    expect(digest).toBe(checksum);
    const identityPath = realChild(plan.workspace, `${installer}.identity.json`);
    const identity = JSON.parse(readFileSync(identityPath, 'utf8'));
    expect(identity).toMatchObject({ schemaVersion: 1, installer: 'nsis', arch: plan.arch });
    expect(identity.uninstallerSha256).toMatch(/^[a-f0-9]{64}$/);
    report.installer = { path: installer, sha256: digest };
    const literal = `'${installer.replaceAll("'", "''")}'`;
    report.installerSignature = signatureEvidence(
      execFileSync(
        'pwsh.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-AuthenticodeSignature -LiteralPath ${literal}).Status.ToString()`,
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 30_000 },
      ).trim(),
    );
    report.windows = before.windows;
    mkdirSync(plan.reportRoot, { recursive: true });
    let startedInstall = false;
    let failure: unknown;
    try {
      startedInstall = true;
      report.setupExitCode = await run(installer, ['/S'], 120_000);
      expect(report.setupExitCode).toBe(0);
      const state = await waitFor(
        () => observe(plan.installRoot),
        (state) => state.registrations.length === 1 && state.processIds.length === 0,
      );
      report.installed = state;
      expect(state.registrations).toHaveLength(1);
      expect(
        state.processIds,
        'silent setup/lifecycle hooks must not leave an app running',
      ).toEqual([]);
      expect(
        state.shortcuts.length,
        'a real per-user install must create a launch shortcut',
      ).toBeGreaterThan(0);
      const installed = realChild(plan.installRoot, join(plan.installRoot, 'ThreadHelm.exe'));
      const version = JSON.parse(
        readFileSync(join(plan.workspace, 'apps', 'desktop', 'package.json'), 'utf8'),
      ).version;
      expect(state.registrationDetails[0]!.version).toBe(version);
      expect(state.registrationDetails[0]!.uninstall.toLowerCase()).toContain(
        join(plan.installRoot, 'Uninstall ThreadHelm.exe').toLowerCase(),
      );
      expect(createHash('sha256').update(readFileSync(installed)).digest('hex')).toBe(
        identity.executableSha256,
      );
      expect(
        createHash('sha256')
          .update(readFileSync(join(plan.installRoot, 'resources', 'app.asar')))
          .digest('hex'),
      ).toBe(identity.asarSha256);
      report.forgeApplicationIdentityPreserved = true;
      report.installedExe = installed;
      report.nativeArtifactProof = await nativeArtifactProof(installed, plan.reportRoot, plan.arch);
      report.installedElectronSessionHost = 'RUNNING';
      report.installedElectronSessionHost = await installedElectronProof(
        installed,
        plan.reportRoot,
      );
      // Existing production-fuse, archive, architecture, startup, native-load and second-instance checks.
      const artifactReport = join(plan.reportRoot, 'artifact-acceptance.json');
      report.artifactAcceptanceExitCode = await run(
        process.execPath,
        [
          join(plan.workspace, 'node_modules', 'vitest', 'vitest.mjs'),
          'run',
          '--project',
          'acceptance',
          'tests/acceptance/installed-app.test.ts',
        ],
        240_000,
        {
          ...process.env,
          THREADHELM_ARTIFACT: installed,
          THREADHELM_ARTIFACT_REPORT: artifactReport,
          THREADHELM_UNINSTALLER_SHA256: identity.uninstallerSha256,
        },
      );
      if (existsSync(artifactReport)) {
        const artifact = JSON.parse(readFileSync(artifactReport, 'utf8'));
        report.installedArtifactSignature = {
          status: artifact.signatureStatus,
          trustedPublisherVerified: artifact.trustedPublisherVerified === true,
        };
        report.artifactAcceptanceFailures = artifact.failedTests;
      }
      expect(report.artifactAcceptanceExitCode).toBe(0);
    } catch (error) {
      if (report.installedElectronSessionHost === 'RUNNING')
        report.installedElectronSessionHost = 'FAILED';
      failure = error;
      report.failure = error instanceof Error ? error.message.slice(0, 500) : 'ACCEPTANCE_FAILED';
    } finally {
      if (startedInstall) {
        try {
          const quiet = await waitFor(
            () => observe(plan.installRoot),
            (state) => state.processIds.length === 0,
          );
          report.beforeUninstall = quiet;
          if (quiet.processIds.length) failure ??= new Error('INSTALLED_APP_DID_NOT_EXIT');
          // Execute only the byte-verified fixed uninstaller, never a registry-provided command.
          const updater = realChild(
            plan.installRoot,
            join(plan.installRoot, 'Uninstall ThreadHelm.exe'),
          );
          expect(createHash('sha256').update(readFileSync(updater)).digest('hex')).toBe(
            identity.uninstallerSha256,
          );
          // NSIS relocates its uninstaller into TEMP. Bound that normal staging
          // location to this run and observe its processes too; the launcher's
          // exit code alone does not establish uninstaller completion.
          const helperRoot = join(plan.reportRoot, 'uninstall-temp');
          mkdirSync(helperRoot);
          const verifiedHelperRoot = realChild(plan.reportRoot, helperRoot);
          report.uninstallLauncherExitCode = await run(updater, ['/S'], 120_000, {
            ...process.env,
            TEMP: verifiedHelperRoot,
            TMP: verifiedHelperRoot,
          });
          expect(report.uninstallLauncherExitCode).toBe(0);
          const seenHelpers = new Map<number, Observation['helperProcesses'][number]>();
          const after = await waitFor(
            () => {
              const state = observe(plan.installRoot, false, verifiedHelperRoot);
              for (const helper of state.helperProcesses) {
                if (seenHelpers.size < 16) seenHelpers.set(helper.processId, helper);
              }
              return state;
            },
            (state) => {
              try {
                assertUninstalled(state);
                return true;
              } catch {
                return false;
              }
            },
            60_000,
          );
          report.afterUninstall = observe(plan.installRoot, true, verifiedHelperRoot);
          report.observedTemporaryHelpers = [...seenHelpers.values()];
          assertUninstalled(after);
          report.uninstallCleanup = 'PASSED_WITHOUT_MANUAL_DELETION';
        } catch (error) {
          report.uninstallCleanup = 'FAILED';
          report.uninstallFailure =
            error instanceof Error ? error.message.slice(0, 500) : 'UNINSTALL_FAILED';
          failure ??= error;
        }
      }
      report.finishedAt = new Date().toISOString();
      report.passed = !failure;
      writeFileSync(
        join(plan.reportRoot, 'installation-report.json'),
        JSON.stringify(report, null, 2),
      );
    }
    if (failure) throw failure;
  }, 900_000);
});
