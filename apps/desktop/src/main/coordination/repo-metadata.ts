/**
 * Bounded, fail-soft repo-metadata readers (T-repo-idea-01).
 *
 * Every function here returns an empty/null result on any error: a missing
 * README, a non-git directory, or a permissions failure is provenance, not a
 * crash. Nothing here reads file contents beyond the README and manifest;
 * the file tree carries paths only.
 */

import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_TEXT_BYTES = 8_192;
const DEFAULT_COMMIT_LIMIT = 20;
const GIT_TIMEOUT_MS = 2_000;

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'build',
  'target',
  '.venv',
  '__pycache__',
]);
const README_FILENAMES = ['README.md', 'README', 'readme.md', 'README.txt'];
const MANIFEST_FILENAMES = ['package.json', 'Cargo.toml', 'pyproject.toml', 'go.mod'];

export async function readFileTree(
  root: string,
  opts: { maxDepth?: number; maxEntries?: number } = {},
): Promise<string[]> {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const paths: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (paths.length >= maxEntries || depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (paths.length >= maxEntries) return;
      // Dirent reports a symlink as neither file nor directory, so links
      // (inside or outside the workspace) are never followed.
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(join(dir, entry.name), depth + 1);
      } else if (entry.isFile()) {
        paths.push(relative(root, join(dir, entry.name)));
      }
    }
  }

  await walk(root, 0);
  return paths;
}

async function readFirst(
  root: string,
  filenames: readonly string[],
  maxBytes: number,
): Promise<{ filename: string; contents: string } | null> {
  for (const filename of filenames) {
    try {
      const contents = await readFile(join(root, filename), 'utf8');
      return { filename, contents: contents.slice(0, maxBytes) };
    } catch {
      continue;
    }
  }
  return null;
}

export async function readReadme(
  root: string,
  maxBytes = DEFAULT_TEXT_BYTES,
): Promise<string | null> {
  return (await readFirst(root, README_FILENAMES, maxBytes))?.contents ?? null;
}

export function readManifest(
  root: string,
  maxBytes = DEFAULT_TEXT_BYTES,
): Promise<{ filename: string; contents: string } | null> {
  return readFirst(root, MANIFEST_FILENAMES, maxBytes);
}

/** `git log` subjects are provenance, not a dependency: never throws, matches recon.ts's headCommit posture. */
export async function readRecentCommitSubjects(
  root: string,
  limit = DEFAULT_COMMIT_LIMIT,
): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-n', String(limit), '--format=%s'], {
      cwd: root,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
    });
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}
