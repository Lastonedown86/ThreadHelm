/** Codex CLI adapter (T040). Interactive TUI in the approved cwd. */

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
  if (ctx.runtimeSelection.effort) {
    args.push('--config', `model_reasoning_effort=${ctx.runtimeSelection.effort}`);
  }
  for (const override of ctx.bridgeConfig?.codexConfigOverrides ?? []) {
    args.push('--config', override);
  }
  return args;
}

export const codexAdapter: ProviderAdapter = {
  id: 'codex-cli',
  displayName: 'Codex CLI',
  testedVersionRange: { min: '0.20.0', maxExclusive: '2.0.0' },
  capabilities: {
    interactivePty: true,
    structuredActivity: false,
    cleanStopStrategy: 'slash_exit',
    bridgeConfiguration: 'session_scoped_stdio_mcp',
    safePointEvidence: 'none',
    automaticPresentation: 'manual_only',
    memoryTools: 'unsupported',
    supervisorTools: 'unsupported',
    configurationFailureBehavior: 'manual_only',
  },
  executableCandidates: [
    { relativeTo: 'LOCALAPPDATA', subpath: 'Programs\\codex\\codex.exe', kind: 'native' },
    { relativeTo: 'USERPROFILE', subpath: '.codex\\bin\\codex.exe', kind: 'native' },
    { relativeTo: 'PATH', subpath: 'codex.exe', kind: 'native' },
    { relativeTo: 'APPDATA', subpath: 'npm\\codex.cmd', kind: 'cmd_shim' },
    { relativeTo: 'PATH', subpath: 'codex.cmd', kind: 'cmd_shim' },
  ],
  probe(ctx: ProbeContext) {
    return runProbe(this, ctx, {
      versionArgs: ['--version'],
      authArgs: ['login', 'status'],
      unauthenticatedPattern: /not\s+logged\s+in|logged\s+out/i,
    });
  },
  buildLaunch(ctx: LaunchContext): LaunchDescriptor {
    return interactiveLaunch(ctx, launchArgs(ctx));
  },
  buildCleanStop(): CleanStopAction {
    return { writes: ['/quit\r'], graceMs: 10_000 };
  },
};
