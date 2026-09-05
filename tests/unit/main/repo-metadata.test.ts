import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readFileTree,
  readManifest,
  readReadme,
  readRecentCommitSubjects,
} from '../../../apps/desktop/src/main/coordination/repo-metadata.js';

const execFileAsync = promisify(execFile);

describe('repo metadata readers', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'repo-metadata-'));
  });

  afterEach(async () => {
    // Best-effort cleanup; a leftover temp dir never fails the suite.
    await rm(root, { recursive: true, force: true }).catch(() => {});
  });

  it('lists file paths bounded by depth and entry count, skipping .git', async () => {
    await mkdir(join(root, '.git'), { recursive: true });
    await writeFile(join(root, '.git', 'HEAD'), 'ref: refs/heads/main');
    await mkdir(join(root, 'node_modules', 'dep'), { recursive: true });
    await writeFile(join(root, 'node_modules', 'dep', 'index.js'), '');
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'index.ts'), '');
    await writeFile(join(root, 'README.md'), '# hi');

    const tree = await readFileTree(root);
    expect(tree).toContain('README.md');
    expect(tree).toContain(['src', 'index.ts'].join(sep));
    expect(tree.some((p) => p.includes('.git'))).toBe(false);
    expect(tree.some((p) => p.includes('node_modules'))).toBe(false);
  });

  it('stops at the entry cap and the depth cap', async () => {
    await mkdir(join(root, 'a', 'b', 'c'), { recursive: true });
    await writeFile(join(root, 'a', 'b', 'c', 'deep.txt'), '');
    for (let i = 0; i < 5; i += 1) await writeFile(join(root, `f${i}.txt`), '');
    expect(await readFileTree(root, { maxEntries: 3 })).toHaveLength(3);
    expect(await readFileTree(root, { maxDepth: 1 })).not.toContain(
      ['a', 'b', 'c', 'deep.txt'].join(sep),
    );
  });

  it('returns an empty list for an unreadable root', async () => {
    expect(await readFileTree(join(root, 'missing'))).toEqual([]);
  });

  it('returns null when no README is present', async () => {
    expect(await readReadme(root)).toBeNull();
  });

  it('returns README contents bounded by byte limit', async () => {
    await writeFile(join(root, 'README.md'), 'x'.repeat(100));
    const readme = await readReadme(root, 10);
    expect(readme).toHaveLength(10);
  });

  it('reads a package.json manifest when present', async () => {
    await writeFile(join(root, 'package.json'), '{"name":"demo"}');
    const manifest = await readManifest(root);
    expect(manifest).toEqual({ filename: 'package.json', contents: '{"name":"demo"}' });
  });

  it('returns null for a manifest when none of the known filenames exist', async () => {
    expect(await readManifest(root)).toBeNull();
  });

  it('returns an empty list of commit subjects for a non-git directory', async () => {
    expect(await readRecentCommitSubjects(root)).toEqual([]);
  });

  it('reads recent commit subjects for a real git repo', async () => {
    await execFileAsync('git', ['init', '-q'], { cwd: root });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: root });
    await writeFile(join(root, 'file.txt'), 'a');
    await execFileAsync('git', ['add', '.'], { cwd: root });
    await execFileAsync('git', ['commit', '-q', '-m', 'first commit'], { cwd: root });
    const subjects = await readRecentCommitSubjects(root);
    expect(subjects).toEqual(['first commit']);
  });
});
