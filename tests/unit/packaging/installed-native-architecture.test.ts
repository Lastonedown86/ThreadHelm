import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assertInstalledNativeArchitecture } from '../../acceptance/helpers/installed-native-architecture.js';

function pe(machine: number): Buffer {
  const bytes = Buffer.alloc(256);
  bytes.write('MZ');
  bytes.writeUInt32LE(128, 60);
  bytes.write('PE\0\0', 128);
  bytes.writeUInt16LE(machine, 132);
  return bytes;
}
describe('installed maker updater architecture exception', () => {
  it('requires this build NSIS helper digest and never extends its exception to application files', () => {
    const temp = mkdtempSync(join(tmpdir(), 'threadhelm-installed-nsis-'));
    try {
      const helper = pe(0x14c);
      const digest = createHash('sha256').update(helper).digest('hex');
      writeFileSync(join(temp, 'ThreadHelm.exe'), pe(0x8664));
      writeFileSync(join(temp, 'Uninstall ThreadHelm.exe'), helper);
      expect(() => assertInstalledNativeArchitecture(temp, 'x64', '')).toThrow(
        'UNINSTALLER_IDENTITY_MISMATCH',
      );
      expect(assertInstalledNativeArchitecture(temp, 'x64', '', digest).uninstallerSha256).toBe(
        digest,
      );
      writeFileSync(
        join(temp, 'Uninstall ThreadHelm.exe'),
        Buffer.concat([helper, Buffer.from('changed')]),
      );
      expect(() => assertInstalledNativeArchitecture(temp, 'x64', '', digest)).toThrow(
        'UNINSTALLER_IDENTITY_MISMATCH',
      );
      writeFileSync(join(temp, 'Uninstall ThreadHelm.exe'), helper);
      writeFileSync(join(temp, 'ThreadHelm.exe'), helper);
      expect(() => assertInstalledNativeArchitecture(temp, 'x64', '', digest)).toThrow(
        'architecture',
      );
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
  it('accepts only an exact root updater matching this build maker bytes while app payload stays strict', () => {
    const temp = mkdtempSync(join(tmpdir(), 'threadhelm-installed-pe-'));
    try {
      const app = join(temp, 'app');
      mkdirSync(app);
      const vendor = join(temp, 'Squirrel.exe');
      writeFileSync(vendor, pe(0x14c));
      writeFileSync(join(app, 'ThreadHelm.exe'), pe(0x8664));
      writeFileSync(join(app, 'squirrel.exe'), pe(0x14c));
      expect(assertInstalledNativeArchitecture(app, 'x64', vendor).updaterSha256).toMatch(
        /^[a-f0-9]{64}$/,
      );
      writeFileSync(join(app, 'squirrel.exe'), Buffer.concat([pe(0x14c), Buffer.from('changed')]));
      expect(() => assertInstalledNativeArchitecture(app, 'x64', vendor)).toThrow(
        'UPDATER_IDENTITY_MISMATCH',
      );
      writeFileSync(join(app, 'squirrel.exe'), pe(0x14c));
      writeFileSync(join(app, 'ThreadHelm.exe'), pe(0x14c));
      expect(() => assertInstalledNativeArchitecture(app, 'x64', vendor)).toThrow('architecture');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
  it.each(['squirrel.exe', 'other.exe', 'module.node', 'terminal.dll'])(
    'does not permit a nested or app-owned x86 payload named %s',
    (name) => {
      const temp = mkdtempSync(join(tmpdir(), 'threadhelm-installed-pe-'));
      try {
        const app = join(temp, 'app');
        mkdirSync(app);
        mkdirSync(join(app, 'resources'));
        const vendor = join(temp, 'vendor.exe');
        writeFileSync(vendor, pe(0x14c));
        writeFileSync(join(app, 'resources', name), pe(0x14c));
        expect(() => assertInstalledNativeArchitecture(app, 'arm64', vendor)).toThrow(
          'architecture',
        );
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    },
  );
});
