import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertNoPrivatePersonaText,
  assertNoPrivatePersonaFile,
  assertProductionPersonaBoundary,
} from '../../../apps/desktop/src/packaging/release-personas.js';

describe('production persona boundary', () => {
  it('scans odd-aligned UTF-16 in a fresh Windows Node process without corrupting the heap', () => {
    const directory = mkdtempSync(join(tmpdir(), 'threadhelm-persona-alignment-'));
    try {
      const path = join(directory, 'asset.bin');
      writeFileSync(path, Buffer.alloc(524026, 0x61));
      const moduleUrl = pathToFileURL(
        resolve(import.meta.dirname, '../../../apps/desktop/src/packaging/release-personas.ts'),
      ).href;
      const child = spawnSync(
        process.execPath,
        [
          '--experimental-strip-types',
          '--input-type=module',
          '-e',
          `import { assertNoPrivatePersonaFile } from ${JSON.stringify(moduleUrl)}; assertNoPrivatePersonaFile(${JSON.stringify(path)});`,
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 10000 },
      );
      expect(child.error).toBeUndefined();
      expect(child.status, child.stderr).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('rejects unresolved directory links rather than overlooking private assets', () => {
    const directory = mkdtempSync(join(tmpdir(), 'threadhelm-persona-link-'));
    try {
      mkdirSync(join(directory, 'source'));
      mkdirSync(join(directory, 'package'));
      writeFileSync(join(directory, 'source', 'private.txt'), 'Nick Fury');
      symlinkSync(join(directory, 'source'), join(directory, 'package', 'linked'), 'junction');
      expect(() => assertProductionPersonaBoundary(join(directory, 'package'))).toThrow('link');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it.each(['utf8', 'utf16le'] as const)('scans %s data across bounded file reads', (encoding) => {
    const directory = mkdtempSync(join(tmpdir(), 'threadhelm-persona-bytes-'));
    try {
      const path = join(directory, 'data.bin');
      writeFileSync(
        path,
        Buffer.concat([Buffer.alloc(1024 * 1024 - 3, 32), Buffer.from('Nick Fury', encoding)]),
      );
      expect(() => assertNoPrivatePersonaFile(path)).toThrow('private persona');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('rejects private personas in generated JavaScript but allows generic agents', () => {
    expect(() =>
      assertNoPrivatePersonaText('var roster = [{name: "Spider-Man"}];', 'main.cjs'),
    ).toThrow('private persona');
    expect(() => assertNoPrivatePersonaText('{"name":"Vision"}', 'roster.json')).toThrow(
      'private persona',
    );
    expect(() =>
      assertNoPrivatePersonaText('var MARVEL_ROSTER_FIXTURES = [];', 'main.cjs'),
    ).toThrow('private persona');
    expect(() =>
      assertNoPrivatePersonaText(
        '{"name":"Quality specialist","goal":"Review a bounded change."}',
        'main.cjs',
      ),
    ).not.toThrow();
  });

  it('checks nested built files before packaging, including stale chunks', () => {
    const directory = mkdtempSync(join(tmpdir(), 'threadhelm-persona-release-'));
    try {
      mkdirSync(join(directory, 'main', 'chunks'), { recursive: true });
      writeFileSync(join(directory, 'main', 'index.cjs'), 'generic code');
      expect(() => assertProductionPersonaBoundary(directory)).not.toThrow();
      writeFileSync(join(directory, 'main', 'chunks', 'old.cjs'), 'const name = "Nick Fury";');
      expect(() => assertProductionPersonaBoundary(directory)).toThrow('private persona');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each(['README.md', 'persona.txt', 'settings.yaml', 'local-persona', 'fixture.bin'])(
    'rejects private content in copied dependency asset %s regardless of extension',
    (name) => {
      const directory = mkdtempSync(join(tmpdir(), 'threadhelm-persona-asset-'));
      try {
        mkdirSync(join(directory, 'node_modules', 'dependency'), { recursive: true });
        writeFileSync(join(directory, 'node_modules', 'dependency', name), 'Nick Fury');
        expect(() => assertProductionPersonaBoundary(directory)).toThrow('private persona');
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
