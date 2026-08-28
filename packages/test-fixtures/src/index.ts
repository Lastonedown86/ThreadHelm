/// <reference types="node" />
/**
 * Deterministic fake terminal agents (T023). The executable is a plain
 * CommonJS script so any Node or Electron runtime can spawn it unbuilt.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type FakeAgentMode = 'echo' | 'burst' | 'control' | 'ignore-interrupt' | 'spawn-children';

export const FAKE_AGENT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'fake-agent.cjs');

export function fakeAgentLaunch(
  mode: FakeAgentMode,
  opts: { lines?: number } = {},
): { executable: string; args: string[] } {
  const args = [FAKE_AGENT_PATH, '--mode', mode];
  if (opts.lines !== undefined) args.push('--lines', String(opts.lines));
  return { executable: process.execPath, args };
}

export { fixtureAdapter, type FixtureAdapterOptions } from './fixture-adapter.js';

/**
 * A console-subsystem runtime for the fixture. Electron's own executable is a
 * GUI-subsystem binary and never attaches console stdio inside a ConPTY, so
 * fixture sessions need a real node.exe from PATH (a documented test
 * prerequisite; the packaged acceptance suite reports when it is absent).
 */
export function resolveFixtureRuntime(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.THREADHELM_FIXTURE_NODE;
  if (explicit) return explicit;
  for (const entry of (env.PATH ?? '').split(';')) {
    const candidate = join(entry.trim(), 'node.exe');
    if (entry.trim() && existsSync(candidate)) return candidate;
  }
  return null;
}
