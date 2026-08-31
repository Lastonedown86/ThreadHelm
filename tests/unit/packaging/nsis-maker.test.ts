import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { MakerOptions } from '@electron-forge/maker-base';

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
      expect(request.config.nsis).toMatchObject({
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
