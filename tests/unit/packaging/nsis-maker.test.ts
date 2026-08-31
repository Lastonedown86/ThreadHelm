import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { MakerOptions } from '@electron-forge/maker-base';
import { AppInfo } from 'app-builder-lib/out/appInfo.js';
import type { Packager } from 'app-builder-lib/out/packager.js';
import { getWindowsInstallationDirName } from 'app-builder-lib/out/targets/targetUtil.js';
import {
  installerDirectory,
  installerGuid,
} from '../../../apps/desktop/src/packaging/installer-identity.js';

const mocks = vi.hoisted(() => ({ build: vi.fn() }));
vi.mock('electron-builder', () => ({
  build: mocks.build,
  Arch: { x64: 1, arm64: 3 },
  Platform: { WINDOWS: { createTarget: () => new Map() } },
}));
vi.mock('app-builder-lib/out/codeSign/windowsSignToolManager.js', () => ({
  WindowsSignToolManager: class {},
}));
import { MakerNsis } from '../../../apps/desktop/src/packaging/nsis-maker.js';

const directories: string[] = [];
afterEach(() => {
  mocks.build.mockReset();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'threadhelm-nsis-maker-'));
  directories.push(root);
  const dir = join(root, 'app');
  mkdirSync(join(dir, 'resources'), { recursive: true });
  writeFileSync(join(dir, 'ThreadHelm.exe'), 'audited executable');
  writeFileSync(join(dir, 'resources', 'app.asar'), 'audited archive');
  return { dir, makeDir: join(root, 'make'), targetArch: 'x64' } as MakerOptions;
}
describe('NSIS installer preserves the Forge trust boundary', () => {
  it('retains audited bytes, records the exact helper, and disables publishing/elevation/implicit launch', async () => {
    const options = fixture();
    mocks.build.mockImplementation(async (request) => {
      expect(request.prepackaged).toBe(options.dir);
      expect(request.publish).toBe('never');
      expect(request.config.publish).toBeNull();
      // Exercise the pinned builder's real naming rule with the actual package metadata.
      // ProductName is not the one-click per-user installation directory.
      const appInfo = new AppInfo(
        {
          metadata: JSON.parse(readFileSync('apps/desktop/package.json', 'utf8')),
          config: request.config,
        } as Packager,
        undefined,
        request.config.win,
      );
      expect(
        getWindowsInstallationDirName(
          appInfo,
          !request.config.nsis.oneClick || request.config.nsis.perMachine,
        ),
      ).toBe(installerDirectory);
      expect(request.config.nsis).toMatchObject({
        guid: installerGuid,
        oneClick: true,
        perMachine: false,
        allowElevation: false,
        packElevateHelper: false,
        runAfterFinish: false,
        deleteAppDataOnUninstall: false,
      });
      const helper = join(
        request.config.directories.output,
        'ThreadHelm-Setup-x64.__uninstaller.exe',
      );
      writeFileSync(helper, 'generated helper');
      await request.config.win.signtoolOptions.sign({ path: helper });
      return [];
    });
    const maker = new MakerNsis({});
    await maker.prepareConfig('x64');
    const artifacts = await maker.make(options);
    const identity = JSON.parse(readFileSync(artifacts[0]!, 'utf8'));
    expect(identity.uninstallerSha256).toBe(
      createHash('sha256').update('generated helper').digest('hex'),
    );
    expect(identity.executableSha256).toBe(
      createHash('sha256').update('audited executable').digest('hex'),
    );
  });
  it.each(['missing helper', 'changed archive'])(
    'rejects unproved installer provenance: %s',
    async (failure) => {
      const options = fixture();
      mocks.build.mockImplementation(async (request) => {
        if (failure === 'changed archive') {
          const helper = join(
            request.config.directories.output,
            'ThreadHelm-Setup-x64.__uninstaller.exe',
          );
          writeFileSync(helper, 'generated helper');
          await request.config.win.signtoolOptions.sign({ path: helper });
          writeFileSync(join(options.dir, 'resources', 'app.asar'), 'unexpected replacement');
        }
        return [];
      });
      const maker = new MakerNsis({});
      await maker.prepareConfig('x64');
      await expect(maker.make(options)).rejects.toThrow(
        failure === 'missing helper'
          ? 'INSTALLER_HELPER_IDENTITY_MISSING'
          : 'PREPACKAGED_APPLICATION_CHANGED',
      );
    },
  );
});
