/// <reference types="node" />
/**
 * A ProviderAdapter backed by the deterministic fake agent, so every launch,
 * supervision, stop, and recovery test runs without Codex or Claude installed.
 * It keeps a built-in provider id (the contract enum is closed) but launches
 * `fake-agent.cjs` under the given runtime executable.
 */

import type { ActivityEvidence, LaunchDescriptor, ProviderId } from '@threadhelm/contracts';
import { join } from 'node:path';
import type {
  LaunchContext,
  ProbeContext,
  ProviderAdapter,
  ReadinessResult,
} from '@threadhelm/providers';
import { FAKE_AGENT_PATH, type FakeAgentMode } from './index.js';

export interface FixtureAdapterOptions {
  id: ProviderId;
  mode: FakeAgentMode;
  /** Absolute runtime that can execute fake-agent.cjs (node.exe or electron.exe). */
  executable: string;
  lines?: number;
  /** Force a readiness outcome instead of "available" (readiness tests). */
  readiness?: Partial<ReadinessResult>;
}

export function fixtureAdapter(options: FixtureAdapterOptions): ProviderAdapter {
  const displayName = options.id === 'codex-cli' ? 'Codex CLI' : 'Claude Code';
  const ignoresCleanStop =
    options.mode === 'ignore-interrupt' ||
    options.mode === 'spawn-children' ||
    options.mode === 'spawn-bridge';
  return {
    id: options.id,
    displayName,
    testedVersionRange: { min: '0.0.0', maxExclusive: '999.0.0' },
    capabilities: {
      interactivePty: true,
      structuredActivity: false,
      cleanStopStrategy: 'slash_exit',
    },
    executableCandidates: [],
    async probe(_ctx: ProbeContext): Promise<ReadinessResult> {
      return {
        providerId: options.id,
        resolvedExecutable: options.executable,
        executableKind: 'native',
        version: '1.0.0',
        availability: 'available',
        authentication: 'authenticated',
        reasonCode: null,
        safeSummary: `${displayName} fixture is available`,
        ...options.readiness,
      };
    },
    buildLaunch(ctx: LaunchContext): LaunchDescriptor {
      const args = [
        FAKE_AGENT_PATH,
        '--mode',
        options.mode,
        '--ready-file',
        join(ctx.canonicalWorkspacePath, `.threadhelm-fixture-${options.id}.ready`),
      ];
      if (options.lines !== undefined) args.push('--lines', String(options.lines));
      return {
        executable: ctx.resolvedExecutable,
        args,
        cwd: ctx.canonicalWorkspacePath,
        environmentPolicy: 'inherit-sanitized',
        terminal: ctx.terminal,
      };
    },
    buildCleanStop() {
      // The stubborn modes ignore '/exit' so clean stop times out and force
      // stop becomes the tested path; the cooperative modes exit on 'exit'.
      return { writes: [ignoresCleanStop ? '/exit\r' : 'exit\r'], graceMs: 3000 };
    },
    parseStructuredActivity(): ActivityEvidence | null {
      return null;
    },
  };
}
