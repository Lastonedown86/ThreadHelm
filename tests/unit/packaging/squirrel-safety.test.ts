import { describe, expect, it } from 'vitest';
import {
  assertFreshAccount,
  assertUninstalled,
  signatureEvidence,
  inside,
  installationPlan,
  realChild,
  type InstallObservation,
} from '../../acceptance/helpers/squirrel-safety.js';

const env = {
  THREADHELM_INSTALLER_ACCEPTANCE: '1',
  GITHUB_ACTIONS: 'true',
  RUNNER_ENVIRONMENT: 'github-hosted',
  RUNNER_OS: 'Windows',
  RUNNER_ARCH: 'X64',
  GITHUB_WORKSPACE: 'D:\\a\\ThreadHelm\\ThreadHelm',
  RUNNER_TEMP: 'D:\\a\\_temp',
  USERPROFILE: 'C:\\Users\\runneradmin',
  LOCALAPPDATA: 'C:\\Users\\runneradmin\\AppData\\Local',
  THREADHELM_INSTALLER:
    'D:\\a\\ThreadHelm\\ThreadHelm\\apps\\desktop\\release\\make\\nsis\\x64\\ThreadHelm-Setup-x64.exe',
  GITHUB_RUN_ID: '123',
  GITHUB_RUN_ATTEMPT: '1',
};
const clean: InstallObservation = {
  rootEntries: [],
  registrations: [],
  shortcuts: [],
  processIds: [],
  credentialFiles: [],
};

describe('disposable NSIS acceptance safety boundary', () => {
  it.skipIf(process.platform !== 'win32')(
    'rejects a junction replacing the expected install root',
    () => {
      const temporary = mkdtempSync(join(tmpdir(), 'threadhelm-installer-boundary-'));
      const external = join(temporary, 'external');
      const install = join(temporary, 'ThreadHelm');
      try {
        mkdirSync(external);
        writeFileSync(join(external, 'Update.exe'), 'not an executable');
        symlinkSync(external, install, 'junction');
        expect(() => realChild(install, join(install, 'Update.exe'))).toThrow(
          'PATH_OUTSIDE_BOUNDARY',
        );
      } finally {
        inside(tmpdir(), temporary);
        rmSync(temporary, { recursive: true, force: true });
      }
    },
  );
  it('accepts intentional unsigned distribution without claiming a trusted publisher', () => {
    expect(signatureEvidence('NotSigned')).toEqual({
      status: 'NotSigned',
      trustedPublisherVerified: false,
    });
    expect(signatureEvidence('Valid')).toEqual({ status: 'Valid', trustedPublisherVerified: true });
  });
  it.each(['HashMismatch', 'NotTrusted', 'UnknownError', 'NotSupported', ''])(
    'rejects a damaged or untrusted signature: %s',
    (status) => {
      expect(() => signatureEvidence(status)).toThrow('INVALID_ARTIFACT_SIGNATURE');
    },
  );
  it('refuses an ordinary local account even when installation opt-in is set', () => {
    expect(() => installationPlan({ ...env, GITHUB_ACTIONS: undefined }, 'win32', 'x64')).toThrow(
      'DISPOSABLE_HOSTED_RUNNER_REQUIRED',
    );
  });
  it.each([
    { RUNNER_ENVIRONMENT: 'self-hosted' },
    { THREADHELM_INSTALLER_ACCEPTANCE: undefined },
    { RUNNER_OS: 'Linux' },
  ])('rejects unsafe runner metadata %j before any install', (patch) => {
    expect(() => installationPlan({ ...env, ...patch }, 'win32', 'x64')).toThrow(
      'DISPOSABLE_HOSTED_RUNNER_REQUIRED',
    );
  });
  it('binds install and report paths to the disposable account and exact artifact', () => {
    expect(installationPlan(env, 'win32', 'x64')).toEqual({
      installer: env.THREADHELM_INSTALLER,
      installRoot: 'C:\\Users\\runneradmin\\AppData\\Local\\Programs\\ThreadHelm',
      legacyInstallRoot: 'C:\\Users\\runneradmin\\AppData\\Local\\ThreadHelm',
      reportRoot: 'D:\\a\\_temp\\threadhelm-install-123-1-x64',
      workspace: env.GITHUB_WORKSPACE,
      arch: 'x64',
    });
  });
  it('rejects an architecture mismatch and an installer outside this checkout', () => {
    expect(() => installationPlan(env, 'win32', 'arm64')).toThrow('RUNNER_ARCH_MISMATCH');
    expect(() =>
      installationPlan(
        { ...env, THREADHELM_INSTALLER: 'C:\\Downloads\\ThreadHelm-Setup-x64.exe' },
        'win32',
        'x64',
      ),
    ).toThrow('PATH_OUTSIDE_BOUNDARY');
  });
  it.each([
    'C:\\safe',
    'C:\\safe-other\\Update.exe',
    'C:\\safe\\..\\Update.exe',
    'D:\\safe\\Update.exe',
  ])('refuses an uninstaller/path outside the exact child boundary: %s', (path) => {
    expect(() => inside('C:\\safe', path)).toThrow('PATH_OUTSIDE_BOUNDARY');
  });
  it('accepts a case-insensitive Windows child path', () => {
    expect(inside('C:\\Safe', 'c:\\safe\\Update.exe')).toBe('c:\\safe\\Update.exe');
  });
  it.each(['rootEntries', 'registrations', 'shortcuts', 'processIds', 'credentialFiles'] as const)(
    'never adopts an existing installation/account artifact: %s',
    (key) => {
      const state = { ...clean, [key]: key === 'processIds' ? [123] : ['existing'] };
      expect(() => assertFreshAccount(state)).toThrow('PREEXISTING_THREADHELM_STATE');
    },
  );
  it('rejects every retained NSIS root entry, including a legacy Squirrel tombstone', () => {
    expect(() => assertUninstalled(clean)).not.toThrow();
    expect(() => assertUninstalled({ ...clean, rootEntries: ['.dead'] })).toThrow(
      'UNINSTALL_RESIDUE',
    );
    expect(() => assertUninstalled({ ...clean, rootEntries: ['Update.exe', '.dead'] })).toThrow(
      'UNINSTALL_RESIDUE',
    );
  });
  it.each(['registrations', 'shortcuts', 'processIds', 'credentialFiles'] as const)(
    'fails cleanup for retained %s rather than removing evidence',
    (key) => {
      const state = { ...clean, [key]: key === 'processIds' ? [123] : ['residue'] };
      expect(() => assertUninstalled(state)).toThrow('UNINSTALL_RESIDUE');
    },
  );
});
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
