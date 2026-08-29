/** Claude Code adapter (T041). Interactive TUI in the approved cwd. */

import type { CleanStopAction, LaunchDescriptor } from '@threadhelm/contracts';
import {
  interactiveLaunch,
  runProbe,
  type LaunchContext,
  type ProbeContext,
  type ProviderAdapter,
} from './adapter.js';

function launchArgs(ctx: LaunchContext): string[] {
  const args: string[] = [];
  if (ctx.runtimeSelection.model) args.push('--model', ctx.runtimeSelection.model);
  if (ctx.runtimeSelection.effort) args.push('--effort', ctx.runtimeSelection.effort);
  if (ctx.bridgeConfig?.providerConfigPath) {
    args.push('--mcp-config', ctx.bridgeConfig.providerConfigPath);
  }
  return args;
}

export const claudeCodeAdapter: ProviderAdapter = {
  id: 'claude-code',
  displayName: 'Claude Code',
  testedVersionRange: { min: '1.0.0', maxExclusive: '3.0.0' },
  capabilities: {
    interactivePty: true,
    structuredActivity: false,
    cleanStopStrategy: 'slash_exit',
    bridgeConfiguration: 'session_scoped_stdio_mcp',
    safePointEvidence: {
      mode: 'none',
      exactVersions: [],
      eventKinds: [],
      maxAgeMs: 30_000,
      inputSafety: 'unknown',
    },
    automaticPresentation: 'manual_only',
    memoryTools: 'unsupported',
    supervisorTools: 'unsupported',
    configurationFailureBehavior: 'manual_only',
  },
  executableCandidates: [
    { relativeTo: 'LOCALAPPDATA', subpath: 'Programs\\claude\\claude.exe', kind: 'native' },
    { relativeTo: 'USERPROFILE', subpath: '.local\\bin\\claude.exe', kind: 'native' },
    { relativeTo: 'PATH', subpath: 'claude.exe', kind: 'native' },
    { relativeTo: 'APPDATA', subpath: 'npm\\claude.cmd', kind: 'cmd_shim' },
    { relativeTo: 'PATH', subpath: 'claude.cmd', kind: 'cmd_shim' },
  ],
  probe(ctx: ProbeContext) {
    return runProbe(this, ctx, {
      versionArgs: ['--version'],
      authArgs: ['auth', 'status'],
      unauthenticatedPattern: /not\s+logged\s+in|logged\s+out/i,
    });
  },
  buildLaunch(ctx: LaunchContext): LaunchDescriptor {
    return interactiveLaunch(ctx, launchArgs(ctx));
  },
  buildCleanStop(): CleanStopAction {
    return { writes: ['/exit\r'], graceMs: 10_000 };
  },
  parseLifecycleEvidence() {
    // Exact Claude Code 2.1.251 proof observed a structured Stop hook, but its
    // payload exposes no pending terminal draft or editor state. Returning null
    // is the sanitized manual-only result; raw transcript/message fields never
    // cross the adapter boundary and cannot authorize terminal input.
    return null;
  },
};
