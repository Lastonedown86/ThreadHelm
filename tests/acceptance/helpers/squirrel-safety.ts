import { realpathSync } from 'node:fs';
import { win32 } from 'node:path';
import { installerDirectory } from '../../../apps/desktop/src/packaging/installer-identity.js';

export interface InstallObservation {
  rootEntries: string[];
  registrations: string[];
  shortcuts: string[];
  processIds: number[];
  credentialFiles: string[];
}

export function signatureEvidence(status: string): {
  status: string;
  trustedPublisherVerified: boolean;
} {
  if (status !== 'NotSigned' && status !== 'Valid') throw new Error('INVALID_ARTIFACT_SIGNATURE');
  return { status, trustedPublisherVerified: status === 'Valid' };
}

export function installationPlan(
  env: NodeJS.ProcessEnv,
  platform: string,
  arch: string,
): {
  installer: string;
  installRoot: string;
  legacyInstallRoot: string;
  reportRoot: string;
  workspace: string;
  arch: string;
} {
  if (
    env.THREADHELM_INSTALLER_ACCEPTANCE !== '1' ||
    env.GITHUB_ACTIONS !== 'true' ||
    env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
    env.RUNNER_OS !== 'Windows' ||
    platform !== 'win32'
  ) {
    throw new Error('DISPOSABLE_HOSTED_RUNNER_REQUIRED');
  }
  if (!['x64', 'arm64'].includes(arch) || env.RUNNER_ARCH?.toLowerCase() !== arch) {
    throw new Error('RUNNER_ARCH_MISMATCH');
  }
  for (const key of [
    'GITHUB_WORKSPACE',
    'RUNNER_TEMP',
    'USERPROFILE',
    'LOCALAPPDATA',
    'THREADHELM_INSTALLER',
  ]) {
    if (!env[key] || !/^[a-z]:\\/i.test(env[key]!))
      throw new Error('ABSOLUTE_RUNNER_PATH_REQUIRED');
  }
  if (!/^\d+$/.test(env.GITHUB_RUN_ID ?? '') || !/^\d+$/.test(env.GITHUB_RUN_ATTEMPT ?? '')) {
    throw new Error('RUN_ID_REQUIRED');
  }
  const workspace = win32.resolve(env.GITHUB_WORKSPACE!);
  const installer = inside(
    win32.join(workspace, 'apps', 'desktop', 'release', 'make', 'nsis', arch),
    env.THREADHELM_INSTALLER!,
  );
  if (win32.basename(installer) !== `ThreadHelm-Setup-${arch}.exe`)
    throw new Error('INSTALLER_IDENTITY_MISMATCH');
  const local = inside(env.USERPROFILE!, env.LOCALAPPDATA!);
  return {
    workspace,
    installer,
    arch,
    installRoot: win32.join(local, 'Programs', installerDirectory),
    legacyInstallRoot: win32.join(local, 'ThreadHelm'),
    reportRoot: win32.join(
      env.RUNNER_TEMP!,
      `threadhelm-install-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}-${arch}`,
    ),
  };
}

export function assertFreshAccount(state: InstallObservation): void {
  if (Object.values(state).some((values) => values.length > 0))
    throw new Error('PREEXISTING_THREADHELM_STATE');
}

export function assertUninstalled(state: InstallObservation): void {
  // NSIS has no Squirrel tombstone exception: any retained entry fails.
  if (
    state.rootEntries.length ||
    state.registrations.length ||
    state.shortcuts.length ||
    state.processIds.length ||
    state.credentialFiles.length
  ) {
    throw new Error('UNINSTALL_RESIDUE');
  }
}

export function inside(root: string, candidate: string): string {
  const resolved = win32.resolve(candidate);
  const relative = win32.relative(win32.resolve(root), resolved);
  if (!relative || relative === '..' || relative.startsWith('..\\') || win32.isAbsolute(relative)) {
    throw new Error('PATH_OUTSIDE_BOUNDARY');
  }
  return resolved;
}
export function realChild(root: string, candidate: string): string {
  inside(root, candidate);
  // A replaced root junction must not redefine which installation we may execute.
  return inside(root, realpathSync.native(candidate));
}
