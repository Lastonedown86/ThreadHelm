/** Claude Code adapter (T041). Interactive TUI in the approved cwd. */

import type { CleanStopAction, LaunchDescriptor } from '@threadhelm/contracts';
import {
  assertSessionRoleLaunch,
  interactiveLaunch,
  profileLaunchDisclosure,
  runProbe,
  structuredDraftInvocation,
  type LaunchContext,
  type ProbeContext,
  type ProviderAdapter,
} from './adapter.js';

/** `claude -p --output-format json` prints one envelope; `result` is the reply (verified on 2.1.260). */
function parseClaudePrintEnvelope(stdout: string): string | null {
  let envelope: unknown;
  try {
    envelope = JSON.parse(stdout.trim());
  } catch {
    return null;
  }
  if (typeof envelope !== 'object' || envelope === null) return null;
  const { result, is_error: isError } = envelope as { result?: unknown; is_error?: unknown };
  if (isError === true || typeof result !== 'string') return null;
  return result;
}

function launchArgs(ctx: LaunchContext): string[] {
  const args: string[] = [];
  if (ctx.runtimeSelection.model) args.push('--model', ctx.runtimeSelection.model);
  if (ctx.runtimeSelection.effort) args.push('--effort', ctx.runtimeSelection.effort);
  if (ctx.bridgeConfig?.providerConfigPath) {
    args.push('--mcp-config', ctx.bridgeConfig.providerConfigPath);
  }
  const permission = ctx.permissionResolution;
  if (permission) {
    if (permission.disposition !== 'ready') {
      throw new Error('PERMISSION_POLICY_HELD');
    }
    switch (permission.providerMapping) {
      case 'provider_default':
        break;
      case 'claude_manual':
        args.push('--permission-mode', 'manual');
        break;
      case 'claude_auto':
        args.push('--permission-mode', 'auto');
        break;
      case 'claude_bounded_allowlist':
        args.push('--permission-mode', 'manual', '--allowedTools', ...permission.boundedAllowlist);
        break;
      case 'claude_bypass':
        args.push('--permission-mode', 'bypassPermissions');
        break;
      default:
        throw new Error('PERMISSION_MAPPING_MISMATCH');
    }
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
    structuredDraft: true,
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
    permissionPolicies: ['manual', 'auto', 'bounded_allowlist', 'break_glass_bypass'],
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
    assertSessionRoleLaunch('claude-code', ctx);
    return interactiveLaunch(ctx, launchArgs(ctx));
  },
  buildLaunchDisclosure(ctx: LaunchContext) {
    return profileLaunchDisclosure('claude-code', ctx);
  },
  buildCleanStop(): CleanStopAction {
    return { writes: ['/exit\r'], graceMs: 10_000 };
  },
  buildStructuredDraft(ctx) {
    // --tools "" disables every built-in tool and --strict-mcp-config keeps
    // the user's MCP servers out: a drafting call, not a session. --tools is
    // variadic, so it stays last; the prompt arrives on stdin, not argv.
    const args = ['-p', '--output-format', 'json'];
    if (ctx.model) args.push('--model', ctx.model);
    if (ctx.effort) args.push('--effort', ctx.effort);
    args.push('--tools', '', '--strict-mcp-config');
    return structuredDraftInvocation(ctx, args);
  },
  parseStructuredDraftOutput(raw) {
    if (raw.exitCode !== 0) return null;
    return parseClaudePrintEnvelope(raw.stdout);
  },
  parseLifecycleEvidence() {
    // Exact Claude Code 2.1.251 proof observed a structured Stop hook, but its
    // payload exposes no pending terminal draft or editor state. Returning null
    // is the sanitized manual-only result; raw transcript/message fields never
    // cross the adapter boundary and cannot authorize terminal input.
    return null;
  },
  permissionCapabilityEvidence({ providerVersion, model, observedAt }) {
    // The installed 2.1.251 surface proves bounded --allowedTools support, but
    // organization/account classifier availability is not inferable from
    // authentication or --help. T166 supplies that separate auto proof.
    if (providerVersion !== '2.1.251') return null;
    return {
      providerId: 'claude-code',
      providerVersion,
      model,
      providerSurface: 'claude-code',
      organizationPolicy: 'unknown',
      supportedPolicies: ['manual', 'bounded_allowlist'],
      observedAt,
      expiresAt: new Date(Date.parse(observedAt) + 5 * 60_000).toISOString(),
    };
  },
};
