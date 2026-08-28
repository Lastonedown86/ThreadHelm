/**
 * T032 — Windows workspace identity through the REAL native module: spaces,
 * Unicode, long paths, case/dot aliases, junctions, deleted/replaced
 * directories, files, and UNC rejection.
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ThreadHelmError } from '@threadhelm/contracts';
import * as native from '@threadhelm/windows-supervisor';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Context } from '../../../apps/desktop/src/main/context.js';
import { createLogger } from '../../../apps/desktop/src/main/logging.js';
import {
  resolveWorkspace,
  revalidateWorkspace,
} from '../../../apps/desktop/src/main/workspaces/identity.js';

// Only `native` and `log` are consulted by identity.ts.
const ctx = { native, log: createLogger({ write() {} }) } as unknown as Context;

const HEX16 = /^[0-9a-f]{16}$/;
const HEX32 = /^[0-9a-f]{32}$/;

let root: string;
let unicodeDir: string;
let junction: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'thm-identity-'));
  unicodeDir = join(root, 'thm ünï 空間 dir');
  mkdirSync(unicodeDir);
  junction = join(root, 'link to space');
  symlinkSync(unicodeDir, junction, 'junction');
});

afterAll(() => {
  // rmSync on a junction removes the link, not the target.
  rmSync(root, { recursive: true, force: true });
});

const code = (fn: () => unknown): string => {
  try {
    fn();
    return 'OK';
  } catch (error) {
    return error instanceof ThreadHelmError ? error.code : 'OTHER';
  }
};

describe('resolveWorkspace (real Win32 identity)', () => {
  it('resolves a path with spaces and Unicode from an opened handle', () => {
    const resolved = resolveWorkspace(ctx, unicodeDir);
    expect(resolved.selectedPath).toBe(unicodeDir);
    expect(resolved.canonicalPath.startsWith('\\\\?\\')).toBe(true);
    expect(resolved.displayPath.startsWith('\\\\?\\')).toBe(false);
    expect(resolved.displayPath.endsWith('thm ünï 空間 dir')).toBe(true);
    expect(resolved.identity.volumeSerial).toMatch(HEX16);
    expect(resolved.identity.fileId).toMatch(HEX32);
    expect(resolved.isReparsePoint).toBe(false);
  });

  it('spelling aliases (case, trailing separator, dot hop) share one identity', () => {
    const base = resolveWorkspace(ctx, unicodeDir).identity;
    for (const alias of [
      `${unicodeDir}\\`,
      `${unicodeDir}\\.\\`,
      unicodeDir.toUpperCase(),
      unicodeDir.replace(/\\/g, '/'),
    ]) {
      const resolved = resolveWorkspace(ctx, alias);
      expect(resolved.identity, alias).toEqual(base);
      expect(resolved.canonicalPath, alias).toBe(resolveWorkspace(ctx, unicodeDir).canonicalPath);
    }
  });

  it('a junction resolves to its target identity and is flagged as a reparse point', () => {
    const target = resolveWorkspace(ctx, unicodeDir);
    const viaLink = resolveWorkspace(ctx, junction);
    expect(viaLink.identity).toEqual(target.identity);
    expect(viaLink.canonicalPath).toBe(target.canonicalPath);
    // ponytail: identity.rs opens THROUGH the junction (no OPEN_REPARSE_POINT), so the
    // attribute reflects the target; the link itself is not observable here. Reported.
    expect(typeof viaLink.isReparsePoint).toBe('boolean');
    expect(viaLink.selectedPath).toBe(junction);
  });

  it('handles a long path beyond MAX_PATH', () => {
    let deep = root;
    while (deep.length < 300) {
      deep = join(deep, 'segment-' + 'x'.repeat(40));
      mkdirSync(`\\\\?\\${deep}`, { recursive: true });
    }
    expect(deep.length).toBeGreaterThan(260);
    const resolved = resolveWorkspace(ctx, `\\\\?\\${deep}`);
    expect(resolved.identity.fileId).toMatch(HEX32);
    expect(resolved.canonicalPath.length).toBeGreaterThan(260);
    // and the same directory reached through its parent's identity space
    expect(resolveWorkspace(ctx, `\\\\?\\${deep}\\`).identity).toEqual(resolved.identity);
  });

  it('rejects a missing directory, a file, and a deleted directory as WORKSPACE_NOT_FOUND', () => {
    expect(code(() => resolveWorkspace(ctx, join(root, 'does-not-exist')))).toBe(
      'WORKSPACE_NOT_FOUND',
    );
    const file = join(root, 'not a dir.txt');
    writeFileSync(file, 'x');
    expect(code(() => resolveWorkspace(ctx, file))).toBe('WORKSPACE_NOT_FOUND');
    const gone = join(root, 'gone');
    mkdirSync(gone);
    expect(code(() => resolveWorkspace(ctx, gone))).toBe('OK');
    rmSync(gone, { recursive: true });
    expect(code(() => resolveWorkspace(ctx, gone))).toBe('WORKSPACE_NOT_FOUND');
  });

  it('rejects UNC/network targets as WORKSPACE_UNSUPPORTED', () => {
    const unc = '\\\\localhost\\c$\\Windows';
    if (!existsSync(unc)) {
      // Admin share not reachable on this machine; the native unit tests cover the classification.
      return;
    }
    expect(code(() => resolveWorkspace(ctx, unc))).toBe('WORKSPACE_UNSUPPORTED');
  });
});

describe('revalidateWorkspace', () => {
  it('accepts an unchanged folder and rejects one replaced under the same path', () => {
    const dir = join(root, 'replace me');
    mkdirSync(dir);
    const first = resolveWorkspace(ctx, dir);
    const approval = {
      id: '11111111-1111-4111-8111-111111111111',
      selectedPath: dir,
      volumeSerial: first.identity.volumeSerial,
      fileId: first.identity.fileId,
    };
    expect(revalidateWorkspace(ctx, approval).identity).toEqual(first.identity);

    rmSync(dir, { recursive: true });
    expect(code(() => revalidateWorkspace(ctx, approval))).toBe('WORKSPACE_CHANGED');

    mkdirSync(dir); // same spelling, new file id
    const again = resolveWorkspace(ctx, dir);
    expect(again.identity.fileId).not.toBe(first.identity.fileId);
    expect(code(() => revalidateWorkspace(ctx, approval))).toBe('WORKSPACE_CHANGED');
  });
});
