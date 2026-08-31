/// <reference types="node" />
/** Generic deterministic runtime helpers. Never import private roster fixtures here. */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type FakeAgentMode =
  'echo' | 'burst' | 'control' | 'ignore-interrupt' | 'spawn-children' | 'spawn-bridge';
export const FAKE_AGENT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'fake-agent.cjs');

export function fakeAgentLaunch(
  mode: FakeAgentMode,
  opts: { lines?: number } = {},
): { executable: string; args: string[] } {
  const args = [FAKE_AGENT_PATH, '--mode', mode];
  if (opts.lines !== undefined) args.push('--lines', String(opts.lines));
  return { executable: process.execPath, args };
}

/** Fixtures require a console-subsystem node.exe rather than Electron's GUI binary. */
export function resolveFixtureRuntime(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.THREADHELM_FIXTURE_NODE;
  if (explicit) return explicit;
  for (const entry of (env.PATH ?? '').split(';')) {
    const candidate = join(entry.trim(), 'node.exe');
    if (entry.trim() && existsSync(candidate)) return candidate;
  }
  return null;
}
