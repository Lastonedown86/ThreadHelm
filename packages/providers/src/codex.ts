/** Codex CLI adapter (T040). Interactive TUI in the approved cwd. */

import type { CleanStopAction, LaunchDescriptor } from '@threadhelm/contracts';
import {
  assertSessionRoleLaunch,
  interactiveLaunch,
  profileLaunchDisclosure,
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
  const permission = ctx.permissionResolution;
  if (permission) {
    if (permission.disposition !== 'ready') throw new Error('PERMISSION_POLICY_HELD');
    switch (permission.providerMapping) {
      case 'provider_default':
        break;
      case 'codex_manual':
        args.push('--ask-for-approval', 'on-request');
        break;
      case 'codex_full_auto':
        args.push('--full-auto');
        break;
      case 'codex_bypass':
        args.push('--dangerously-bypass-approvals-and-sandbox');
        break;
      default:
        throw new Error('PERMISSION_MAPPING_MISMATCH');
    }
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
    safePointEvidence: {
      mode: 'none',
      exactVersions: [],
      eventKinds: [],
      maxAgeMs: 30_000,
      inputSafety: 'unknown',
    },
    automaticPresentation: 'manual_only',
    memoryTools: 'scoped_revisioned_memory',
    supervisorTools: 'bound_supervisor',
    configurationFailureBehavior: 'manual_only',
    supervisorConfigurationFailureBehavior: 'held',
    permissionPolicies: ['manual', 'auto', 'break_glass_bypass'],
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
    assertSessionRoleLaunch('codex-cli', ctx);
    return interactiveLaunch(ctx, launchArgs(ctx));
  },
  buildLaunchDisclosure(ctx: LaunchContext) {
    return profileLaunchDisclosure('codex-cli', ctx);
  },
  buildCleanStop(): CleanStopAction {
    return { writes: ['/quit\r'], graceMs: 10_000 };
  },
  parseLifecycleEvidence() {
    // Exact Codex CLI 0.150.1 Stop/app-server schemas expose completed turns,
    // but not the interactive TUI's pending draft or editor state. Returning
    // null is the sanitized manual-only result; completion/idle notifications
    // cannot authorize terminal input into an independently owned TUI.
    return null;
  },
  permissionCapabilityEvidence() {
    // Exact account/runtime proof is intentionally not inferred from login.
    return null;
  },
};
