/// <reference types="node" />
/**
 * Provider adapter contract (T022) per contracts/provider-adapter.md.
 *
 * Adapters never spawn processes or touch the filesystem themselves: `exec`
 * and `fs` are injected through ProbeContext so contract tests are
 * deterministic and raw probe output never leaves this module.
 */

import type {
  ActivityEvidence,
  Authentication,
  Availability,
  CleanStopAction,
  LaunchDescriptor,
  LaunchPermissionResolution,
  LaunchRuntimeSelection,
  PermissionCapabilityEvidence,
  ProviderAttemptOutcomeKind,
  ProviderExecutionBounds,
  ProviderId,
  ProviderLifecycleEventKind,
  ProviderLifecycleEvidence,
  ProviderInputSafety,
  TerminalSize,
} from '@threadhelm/contracts';
import { ProviderAttemptOutcome, ThreadHelmError } from '@threadhelm/contracts';

export type ExecutableRoot = 'LOCALAPPDATA' | 'APPDATA' | 'PROGRAMFILES' | 'USERPROFILE';
export type ExecutableKind = 'native' | 'cmd_shim';

export interface ExecutableCandidate {
  readonly relativeTo: ExecutableRoot | 'PATH';
  readonly subpath: string;
  readonly kind: ExecutableKind;
}

export interface ProbeExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export interface ProbeContext {
  roots: Record<ExecutableRoot, string | null>;
  /** Absolute PATH directories only; main already excluded workspace and cwd. */
  pathEntries: readonly string[];
  excludedDirectories: readonly string[];
  timeoutMs: number;
  signal?: AbortSignal;
  fs: { isFile(path: string): Promise<boolean> };
  exec(
    executable: string,
    args: readonly string[],
    opts: { timeoutMs: number; signal?: AbortSignal },
  ): Promise<ProbeExecResult>;
}

export interface ReadinessResult {
  providerId: ProviderId;
  resolvedExecutable: string | null;
  executableKind: ExecutableKind | null;
  version: string | null;
  availability: Availability;
  authentication: Authentication;
  reasonCode: string | null;
  safeSummary: string;
}

export type BridgeConfigurationCapability = 'unsupported' | 'session_scoped_stdio_mcp';
export type AutomaticPresentationCapability = 'manual_only' | 'structured_safe_point';
export type MemoryToolsCapability = 'unsupported' | 'scoped_revisioned_memory';
export type SupervisorToolsCapability = 'unsupported' | 'worker_only' | 'bound_supervisor';

export interface SafePointEvidenceCapability {
  readonly mode: 'none' | 'structured_event';
  /** Automatic presentation is approved only for these exact proved versions. */
  readonly exactVersions: readonly string[];
  readonly eventKinds: readonly ProviderLifecycleEventKind[];
  readonly maxAgeMs: number;
  readonly inputSafety: ProviderInputSafety;
}

export interface SessionBridgeConfig {
  bridgeExecutablePath: string;
  pipeName: string;
  sessionId: string;
  /** Main-owned file read only by the bridge child; contains the session credential. */
  sessionConfigPath: string;
  /** Provider-specific ephemeral MCP configuration, when the CLI accepts a file. */
  providerConfigPath?: string;
  /** Exact per-process overrides for providers that expose no config-file option. */
  codexConfigOverrides?: readonly string[];
}

export interface LaunchContext {
  sessionId: string;
  canonicalWorkspacePath: string;
  resolvedExecutable: string;
  executableKind: ExecutableKind;
  terminal: TerminalSize;
  version: string;
  /** Exact per-process override; null fields preserve the CLI's local default. */
  runtimeSelection: LaunchRuntimeSelection;
  /** Exact main-owned resolution bound by the launch preview. */
  permissionResolution?: LaunchPermissionResolution;
  executionBounds?: ProviderExecutionBounds;
  /** Ephemeral session bridge configuration if supported */
  bridgeConfig?: SessionBridgeConfig | null;
  /** Exact reviewed profile and main-owned effective authority for this launch. */
  profileBinding?: ProfileLaunchBinding | null;
}

export interface ProfileLaunchBinding {
  profileId: string;
  profileRevisionId: string;
  workspaceId: string;
  requestedIsolation: boolean;
  effectiveIsolation: boolean;
  requestedTokenCap: number;
  effectiveTokenBudget: number;
  effectiveResourceBudget: {
    maxElapsedMs: number;
    maxConcurrentProcesses: number;
  };
  /** Main-owned closed registry; manifest capability labels never populate it. */
  toolRegistry: readonly string[];
}

export interface ProviderLaunchDisclosure {
  providerId: ProviderId;
  profileId: string;
  profileRevisionId: string;
  workspaceId: string;
  canonicalWorkspacePath: string;
  model: string | null;
  effort: LaunchRuntimeSelection['effort'];
  requestedIsolation: boolean;
  effectiveIsolation: boolean;
  requestedTokenCap: number;
  effectiveTokenBudget: number;
  effectiveResourceBudget: ProfileLaunchBinding['effectiveResourceBudget'];
  toolRegistry: readonly string[];
  configurationScope: 'process_only';
}

export interface StopContext {
  sessionId: string;
}

export interface VersionRange {
  min: string;
  maxExclusive: string;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly testedVersionRange: VersionRange;
  readonly capabilities: {
    interactivePty: true;
    structuredActivity: boolean;
    cleanStopStrategy: 'slash_exit' | 'ctrl_d';
    bridgeConfiguration?: BridgeConfigurationCapability;
    safePointEvidence?: SafePointEvidenceCapability;
    automaticPresentation?: AutomaticPresentationCapability;
    memoryTools?: MemoryToolsCapability;
    supervisorTools?: SupervisorToolsCapability;
    configurationFailureBehavior?: 'manual_only';
    supervisorConfigurationFailureBehavior?: 'held';
    permissionPolicies?: readonly LaunchPermissionResolution['policy'][];
  };
  readonly executableCandidates: readonly ExecutableCandidate[];
  probe(ctx: ProbeContext): Promise<ReadinessResult>;
  buildLaunch(ctx: LaunchContext): LaunchDescriptor;
  buildLaunchDisclosure(ctx: LaunchContext): ProviderLaunchDisclosure | null;
  buildCleanStop(ctx: StopContext): CleanStopAction;
  parseStructuredActivity?(event: Uint8Array): ActivityEvidence | null;
  /** Raw provider payloads are reduced or rejected inside the adapter. */
  parseLifecycleEvidence?(event: unknown): ProviderLifecycleEvidence | null;
  /** Returns only externally proved, exact, unexpired capability evidence. */
  permissionCapabilityEvidence?(input: {
    providerVersion: string;
    model: string | null;
    observedAt: string;
  }): PermissionCapabilityEvidence | null;
}

export interface CreateProviderOutcomeInput {
  attemptId: string;
  sessionId: string;
  kind: ProviderAttemptOutcomeKind;
  occurredAt: string;
  reasonCode?: string | null;
}

/** Reduce provider-specific terminal states to the closed main-owned outcome vocabulary. */
export function createProviderOutcome(input: CreateProviderOutcomeInput): ProviderAttemptOutcome {
  const retryDisposition =
    input.kind === 'unknown' || input.kind === 'completed' || input.kind === 'refused'
      ? 'prohibited'
      : 'user_action_required';
  return ProviderAttemptOutcome.parse({
    attemptId: input.attemptId,
    sessionId: input.sessionId,
    kind: input.kind,
    retryDisposition,
    reasonCode: input.reasonCode ?? null,
    occurredAt: input.occurredAt,
  });
}

/**
 * Build the safe, renderer-facing launch disclosure from main-owned policy.
 * It is never serialized into provider configuration, and therefore cannot
 * grant tools or mutate global/project settings.
 */
export function profileLaunchDisclosure(
  providerId: ProviderId,
  ctx: LaunchContext,
): ProviderLaunchDisclosure | null {
  const binding = ctx.profileBinding;
  if (!binding) return null;
  if (
    binding.requestedTokenCap <= 0 ||
    binding.effectiveTokenBudget <= 0 ||
    binding.effectiveTokenBudget > binding.requestedTokenCap ||
    binding.effectiveResourceBudget.maxElapsedMs <= 0 ||
    binding.effectiveResourceBudget.maxConcurrentProcesses <= 0 ||
    (binding.requestedIsolation && !binding.effectiveIsolation)
  ) {
    throw new ThreadHelmError('INVALID_REQUEST', 'Profile launch policy does not safely narrow.');
  }
  if (new Set(binding.toolRegistry).size !== binding.toolRegistry.length) {
    throw new ThreadHelmError(
      'INVALID_REQUEST',
      'Profile launch tool registry is not deterministic.',
    );
  }
  return {
    providerId,
    profileId: binding.profileId,
    profileRevisionId: binding.profileRevisionId,
    workspaceId: binding.workspaceId,
    canonicalWorkspacePath: ctx.canonicalWorkspacePath,
    model: ctx.runtimeSelection.model,
    effort: ctx.runtimeSelection.effort,
    requestedIsolation: binding.requestedIsolation,
    effectiveIsolation: binding.effectiveIsolation,
    requestedTokenCap: binding.requestedTokenCap,
    effectiveTokenBudget: binding.effectiveTokenBudget,
    effectiveResourceBudget: { ...binding.effectiveResourceBudget },
    toolRegistry: [...binding.toolRegistry],
    configurationScope: 'process_only',
  };
}

// ---------------------------------------------------------------------------
// Executable resolution
// ---------------------------------------------------------------------------

const normalize = (p: string): string => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
const isAbsoluteWin = (p: string): boolean => /^[a-zA-Z]:\\/.test(p) || p.startsWith('\\\\?\\');

function isExcluded(path: string, excluded: readonly string[]): boolean {
  const target = normalize(path);
  return excluded.some((dir) => {
    const prefix = normalize(dir);
    return target === prefix || target.startsWith(`${prefix}\\`);
  });
}

function candidatePaths(candidate: ExecutableCandidate, ctx: ProbeContext): string[] {
  if (candidate.relativeTo === 'PATH') {
    return ctx.pathEntries
      .filter(isAbsoluteWin)
      .map((dir) => `${dir.replace(/[\\/]+$/, '')}\\${candidate.subpath}`);
  }
  const root = ctx.roots[candidate.relativeTo];
  return root ? [`${root.replace(/[\\/]+$/, '')}\\${candidate.subpath}`] : [];
}

export async function resolveExecutable(
  adapter: Pick<ProviderAdapter, 'executableCandidates'>,
  ctx: ProbeContext,
): Promise<{ path: string; kind: ExecutableKind } | null> {
  // Native first regardless of declaration order (research Decision 3).
  const ordered = [...adapter.executableCandidates].sort(
    (a, b) => Number(a.kind === 'cmd_shim') - Number(b.kind === 'cmd_shim'),
  );
  for (const candidate of ordered) {
    for (const path of candidatePaths(candidate, ctx)) {
      if (isExcluded(path, ctx.excludedDirectories)) continue;
      if (await ctx.fs.isFile(path)) return { path, kind: candidate.kind };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// cmd.exe shim invocation
// ---------------------------------------------------------------------------

// Anything cmd.exe could reinterpret is rejected outright; only adapter-owned
// fixed tokens and the already-resolved shim path ever reach this builder.
const CMD_FORBIDDEN = /["%!^&|<>\n\r\0]/;

function quoteCmdToken(token: string): string {
  if (CMD_FORBIDDEN.test(token)) {
    throw new ThreadHelmError('INVALID_REQUEST', 'Token is not safe for cmd.exe.', {
      reason: 'UNSAFE_CMD_TOKEN',
    });
  }
  return /[\s]/.test(token) ? `"${token}"` : token;
}

export function buildCmdShimInvocation(
  absoluteShimPath: string,
  fixedArgs: readonly string[],
  systemRoot = 'C:\\Windows',
): { executable: string; args: string[] } {
  if (!isAbsoluteWin(absoluteShimPath) || !/\.cmd$/i.test(absoluteShimPath)) {
    throw new ThreadHelmError('INVALID_REQUEST', 'Shim must be an absolute .cmd path.', {
      reason: 'INVALID_SHIM_PATH',
    });
  }
  const command = [absoluteShimPath, ...fixedArgs].map(quoteCmdToken).join(' ');
  return {
    executable: `${systemRoot}\\System32\\cmd.exe`,
    args: ['/d', '/s', '/c', `"${command}"`],
  };
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export function parseVersion(text: string): string | null {
  return /\b(\d+\.\d+\.\d+)\b/.exec(text)?.[1] ?? null;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export function isWithinRange(version: string, range: VersionRange): boolean {
  return (
    compareVersions(version, range.min) >= 0 && compareVersions(version, range.maxExclusive) < 0
  );
}

// ---------------------------------------------------------------------------
// Readiness summaries: fixed phrases only, never raw output
// ---------------------------------------------------------------------------

export function readinessSummary(
  availability: Availability,
  authentication: Authentication,
  version: string | null,
  range?: VersionRange,
): string {
  const v = version ? `version ${version}` : 'unknown version';
  switch (availability) {
    case 'available':
      return `Ready (${v}, ${authentication}).`;
    case 'missing':
      return 'Executable not found in trusted locations.';
    case 'unsupported':
      return range
        ? `Unsupported ${v}; tested range is ${range.min} to below ${range.maxExclusive}.`
        : `Unsupported ${v}.`;
    case 'unauthenticated':
      return `Installed (${v}) but not authenticated; sign in with the provider tool.`;
    case 'error':
      return `Readiness could not be established (${v}).`;
  }
}

// ---------------------------------------------------------------------------
// Shared probe flow: version first, auth only when version is supported.
// ---------------------------------------------------------------------------

const MAX_PROBE_OUTPUT = 64 * 1024;
const bounded = (s: string): string => s.slice(0, MAX_PROBE_OUTPUT);

export interface ProbeSpec {
  versionArgs: readonly string[];
  authArgs: readonly string[];
  /** Nonzero-exit output that positively means "logged out". */
  unauthenticatedPattern: RegExp;
}

export async function runProbe(adapter: ProviderAdapter, ctx: ProbeContext, spec: ProbeSpec) {
  const result = (
    partial: Partial<ReadinessResult> & Pick<ReadinessResult, 'availability' | 'authentication'>,
  ): ReadinessResult => {
    const version = partial.version ?? null;
    return {
      providerId: adapter.id,
      resolvedExecutable: partial.resolvedExecutable ?? null,
      executableKind: partial.executableKind ?? null,
      version,
      availability: partial.availability,
      authentication: partial.authentication,
      reasonCode: partial.reasonCode ?? null,
      safeSummary: readinessSummary(
        partial.availability,
        partial.authentication,
        version,
        adapter.testedVersionRange,
      ),
    };
  };

  const resolved = await resolveExecutable(adapter, ctx);
  if (!resolved) {
    return result({
      availability: 'missing',
      authentication: 'unknown',
      reasonCode: 'EXECUTABLE_NOT_FOUND',
    });
  }
  const base = { resolvedExecutable: resolved.path, executableKind: resolved.kind };
  const invoke = (args: readonly string[]) =>
    resolved.kind === 'cmd_shim'
      ? (() => {
          const shim = buildCmdShimInvocation(resolved.path, args);
          return ctx.exec(shim.executable, shim.args, { timeoutMs: ctx.timeoutMs, ...sig(ctx) });
        })()
      : ctx.exec(resolved.path, args, { timeoutMs: ctx.timeoutMs, ...sig(ctx) });

  let versionRun: ProbeExecResult;
  try {
    versionRun = await invoke(spec.versionArgs);
  } catch {
    return result({
      ...base,
      availability: 'error',
      authentication: 'unknown',
      reasonCode: 'PROBE_FAILED',
    });
  }
  if (ctx.signal?.aborted) {
    return result({
      ...base,
      availability: 'error',
      authentication: 'unknown',
      reasonCode: 'PROBE_CANCELLED',
    });
  }
  if (versionRun.timedOut) {
    return result({
      ...base,
      availability: 'error',
      authentication: 'unknown',
      reasonCode: 'PROBE_TIMEOUT',
    });
  }
  if (versionRun.exitCode !== 0) {
    return result({
      ...base,
      availability: 'error',
      authentication: 'unknown',
      reasonCode: 'PROBE_EXIT_NONZERO',
    });
  }
  // Raw output is parsed here and dropped; only the normalized version survives.
  const version = parseVersion(bounded(versionRun.stdout) + '\n' + bounded(versionRun.stderr));
  if (!version) {
    return result({
      ...base,
      availability: 'error',
      authentication: 'unknown',
      reasonCode: 'VERSION_UNPARSEABLE',
    });
  }
  if (!isWithinRange(version, adapter.testedVersionRange)) {
    return result({
      ...base,
      version,
      availability: 'unsupported',
      authentication: 'unknown',
      reasonCode: 'VERSION_UNSUPPORTED',
    });
  }

  let authRun: ProbeExecResult;
  try {
    authRun = await invoke(spec.authArgs);
  } catch {
    return result({
      ...base,
      version,
      availability: 'error',
      authentication: 'unknown',
      reasonCode: 'PROBE_FAILED',
    });
  }
  if (ctx.signal?.aborted) {
    return result({
      ...base,
      version,
      availability: 'error',
      authentication: 'unknown',
      reasonCode: 'PROBE_CANCELLED',
    });
  }
  if (authRun.timedOut) {
    return result({
      ...base,
      version,
      availability: 'error',
      authentication: 'unknown',
      reasonCode: 'PROBE_TIMEOUT',
    });
  }
  if (authRun.exitCode === 0) {
    return result({ ...base, version, availability: 'available', authentication: 'authenticated' });
  }
  const authText = bounded(authRun.stdout) + '\n' + bounded(authRun.stderr);
  if (spec.unauthenticatedPattern.test(authText)) {
    return result({
      ...base,
      version,
      availability: 'unauthenticated',
      authentication: 'unauthenticated',
      reasonCode: 'NOT_AUTHENTICATED',
    });
  }
  // Uncertain auth is never reported favorably.
  return result({
    ...base,
    version,
    availability: 'error',
    authentication: 'unknown',
    reasonCode: 'AUTH_UNKNOWN',
  });
}

function sig(ctx: ProbeContext): { signal?: AbortSignal } {
  return ctx.signal ? { signal: ctx.signal } : {};
}

/** Launch descriptor shared by both MVP adapters: interactive TUI, no user text. */
export function interactiveLaunch(
  ctx: LaunchContext,
  fixedArgs: readonly string[],
): LaunchDescriptor {
  const { executable, args } =
    ctx.executableKind === 'cmd_shim'
      ? buildCmdShimInvocation(ctx.resolvedExecutable, fixedArgs)
      : { executable: ctx.resolvedExecutable, args: [...fixedArgs] };
  return {
    executable,
    args,
    cwd: ctx.canonicalWorkspacePath,
    environmentPolicy: 'inherit-sanitized',
    terminal: { columns: ctx.terminal.columns, rows: ctx.terminal.rows },
  };
}
