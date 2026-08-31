import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertNativeArchitecture,
  assertNativeFileArchitecture,
} from '../../../apps/desktop/src/packaging/native-architecture.js';

/** Only an exact build-identified root installer helper can differ from the application's PE target. */
export function assertInstalledNativeArchitecture(
  directory: string,
  architecture: string,
  vendorSquirrel: string,
  expectedUninstallerSha256?: string,
): { updaterSha256?: string; uninstallerSha256?: string } {
  // Validate the target even for an otherwise empty directory.
  if (!['x64', 'arm64'].includes(architecture))
    throw new Error('Unsupported Windows package architecture.');
  let updaterSha256: string | undefined;
  let uninstallerSha256: string | undefined;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unresolved package native link: ${path}`);
    if (entry.isDirectory()) {
      assertNativeArchitecture(path, architecture);
      continue;
    }
    if (!/\.(?:node|exe|dll)$/i.test(entry.name)) continue;
    if (entry.name === 'Uninstall ThreadHelm.exe') {
      const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
      if (
        !/^[a-f0-9]{64}$/.test(expectedUninstallerSha256 ?? '') ||
        actual !== expectedUninstallerSha256
      )
        throw new Error('UNINSTALLER_IDENTITY_MISMATCH');
      uninstallerSha256 = actual;
      continue;
    }
    if (entry.name.toLowerCase() === 'squirrel.exe') {
      if (expectedUninstallerSha256) throw new Error('UNEXPECTED_SQUIRREL_PAYLOAD');
      const installed = readFileSync(path);
      const trusted = readFileSync(vendorSquirrel);
      if (!installed.equals(trusted)) throw new Error('UPDATER_IDENTITY_MISMATCH');
      updaterSha256 = createHash('sha256').update(installed).digest('hex');
      continue;
    }
    assertNativeFileArchitecture(path, architecture);
  }
  return {
    ...(updaterSha256 ? { updaterSha256 } : {}),
    ...(uninstallerSha256 ? { uninstallerSha256 } : {}),
  };
}
