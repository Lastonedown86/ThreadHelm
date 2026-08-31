import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertNativeArchitecture } from '../../../apps/desktop/src/packaging/native-architecture.js';

function executable(machine: number): Buffer {
  const bytes = Buffer.alloc(256);
  bytes.write('MZ');
  bytes.writeUInt32LE(128, 60);
  bytes.write('PE\0\0', 128);
  bytes.writeUInt16LE(machine, 132);
  return bytes;
}

describe('packaged native architecture boundary', () => {
  it('rejects unresolved directory links instead of skipping their native files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'threadhelm-native-link-'));
    try {
      mkdirSync(join(dir, 'source'));
      mkdirSync(join(dir, 'package'));
      writeFileSync(join(dir, 'source', 'wrong.node'), executable(0xaa64));
      symlinkSync(join(dir, 'source'), join(dir, 'package', 'linked'), 'junction');
      expect(() => assertNativeArchitecture(join(dir, 'package'), 'x64')).toThrow('link');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('rejects a mixed architecture native tree before an installer can be made', () => {
    const dir = mkdtempSync(join(tmpdir(), 'threadhelm-native-package-'));
    try {
      mkdirSync(join(dir, 'nested'));
      writeFileSync(join(dir, 'threadhelm-coordination-bridge.exe'), executable(0x8664));
      writeFileSync(join(dir, 'nested', 'supervisor.node'), executable(0x8664));
      writeFileSync(join(dir, 'nested', 'conpty.dll'), executable(0x8664));
      expect(() => assertNativeArchitecture(dir, 'x64')).not.toThrow();
      expect(() => assertNativeArchitecture(dir, 'arm64')).toThrow('architecture');
      writeFileSync(join(dir, 'nested', 'supervisor.node'), executable(0xaa64));
      expect(() => assertNativeArchitecture(dir, 'x64')).toThrow('architecture');
      writeFileSync(join(dir, 'nested', 'supervisor.node'), executable(0x8664));
      writeFileSync(join(dir, 'nested', 'conpty.dll'), executable(0xaa64));
      expect(() => assertNativeArchitecture(dir, 'x64')).toThrow('architecture');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects malformed native files and unsupported target architectures', () => {
    const dir = mkdtempSync(join(tmpdir(), 'threadhelm-native-invalid-'));
    try {
      writeFileSync(join(dir, 'broken.node'), 'not a native executable');
      expect(() => assertNativeArchitecture(dir, 'x64')).toThrow('PE');
      expect(() => assertNativeArchitecture(dir, 'ia32')).toThrow('architecture');
      const bytes = executable(0xaa64);
      bytes.writeUInt32LE(0xfffffff0, 60);
      writeFileSync(join(dir, 'broken.node'), bytes);
      expect(() => assertNativeArchitecture(dir, 'arm64')).toThrow('PE');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
