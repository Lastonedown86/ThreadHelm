/** Packaging-only PE check: a cross-target label cannot turn host binaries into ARM64. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function assertNativeArchitecture(directory: string, architecture: string): void {
  const expected = architecture === 'x64' ? 0x8664 : architecture === 'arm64' ? 0xaa64 : null;
  if (expected === null) throw new Error('Unsupported Windows package architecture.');
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unresolved package native link: ${path}`);
    if (entry.isDirectory()) {
      assertNativeArchitecture(path, architecture);
      continue;
    }
    if (!/\.(?:node|exe|dll)$/i.test(entry.name)) continue;
    const bytes = readFileSync(path);
    const offset = bytes.length >= 64 ? bytes.readUInt32LE(60) : 0;
    if (
      bytes.toString('ascii', 0, 2) !== 'MZ' ||
      offset < 64 ||
      offset > bytes.length - 6 ||
      bytes.toString('ascii', offset, offset + 4) !== 'PE\0\0'
    )
      throw new Error(`Invalid native PE file: ${path}`);
    if (bytes.readUInt16LE(offset + 4) !== expected) {
      throw new Error(`Native architecture does not match ${architecture}: ${path}`);
    }
  }
}
