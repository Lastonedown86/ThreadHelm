import { MakerBase, type MakerOptions } from '@electron-forge/maker-base';
import type { ForgePlatform } from '@electron-forge/shared-types';
import { Arch, build, Platform } from 'electron-builder';
import { WindowsSignToolManager } from 'app-builder-lib/out/codeSign/windowsSignToolManager.js';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { installerAppId, installerGuid } from './installer-identity.js';

type Options = { certificateFile?: string; certificatePassword?: string };
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** Installer only: Forge still owns the application bytes, ASAR, native audit and fuses. */
export class MakerNsis extends MakerBase<Options> {
  name = '@threadhelm/maker-nsis';
  defaultPlatforms: ForgePlatform[] = ['win32'];
  override isSupportedOnCurrentPlatform(): boolean {
    return process.platform === 'win32';
  }

  override async make({ dir, makeDir, targetArch }: MakerOptions): Promise<string[]> {
    if (targetArch !== 'x64' && targetArch !== 'arm64') throw new Error('Unsupported NSIS target');
    const output = resolve(makeDir, 'nsis', targetArch);
    mkdirSync(output, { recursive: true });
    const original = {
      executableSha256: sha256(join(dir, 'ThreadHelm.exe')),
      asarSha256: sha256(join(dir, 'resources', 'app.asar')),
    };
    let uninstallerSha256: string | undefined;
    const artifacts = await build({
      projectDir: process.cwd(),
      prepackaged: dir,
      targets: Platform.WINDOWS.createTarget(
        ['nsis'],
        targetArch === 'x64' ? Arch.x64 : Arch.arm64,
      ),
      publish: 'never',
      config: {
        electronVersion: createRequire(import.meta.url)('electron/package.json').version,
        appId: installerAppId,
        productName: 'ThreadHelm',
        directories: { output },
        publish: null,
        npmRebuild: false,
        win: {
          executableName: 'ThreadHelm',
          requestedExecutionLevel: 'asInvoker',
          signtoolOptions: {
            signingHashAlgorithms: ['sha256'],
            // Record the exact generated helper before builder removes its staging
            // file. Unsigned mode deliberately does not sign; acceptance inspects
            // Authenticode separately and never infers trust from this callback.
            sign: async (task, packager) => {
              if (this.config.certificateFile) {
                if (!packager) throw new Error('INSTALLER_SIGNING_UNAVAILABLE');
                const manager = new WindowsSignToolManager(packager);
                const signedTask = {
                  ...task,
                  cscInfo: {
                    file: this.config.certificateFile,
                    password: this.config.certificatePassword ?? null,
                  },
                };
                // Credentials remain in this callback, never builder's serialized config.
                signedTask.computeSignToolArgs = (isWin) =>
                  manager.computeSignToolArgs(signedTask, isWin);
                await manager.doSign(signedTask, packager);
              }
              if (basename(task.path) === `ThreadHelm-Setup-${targetArch}.__uninstaller.exe`)
                uninstallerSha256 = sha256(task.path);
            },
          },
        },
        nsis: {
          guid: installerGuid,
          artifactName: `ThreadHelm-Setup-${targetArch}.exe`,
          oneClick: true,
          perMachine: false,
          allowElevation: false,
          packElevateHelper: false,
          runAfterFinish: false,
          deleteAppDataOnUninstall: false,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          differentialPackage: false,
        },
      },
    });
    if (!uninstallerSha256) throw new Error('INSTALLER_HELPER_IDENTITY_MISSING');
    if (
      original.executableSha256 !== sha256(join(dir, 'ThreadHelm.exe')) ||
      original.asarSha256 !== sha256(join(dir, 'resources', 'app.asar'))
    )
      throw new Error('PREPACKAGED_APPLICATION_CHANGED');
    const proof = join(output, `ThreadHelm-Setup-${targetArch}.exe.identity.json`);
    writeFileSync(
      proof,
      JSON.stringify(
        { schemaVersion: 1, installer: 'nsis', arch: targetArch, ...original, uninstallerSha256 },
        null,
        2,
      ),
    );
    return [...artifacts, proof];
  }
}
