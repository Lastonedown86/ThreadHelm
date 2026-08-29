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
  LaunchRuntimeSelection,
  ProviderId,
  TerminalSize,
} from '@threadhelm/contracts';
import { ThreadHelmError } from '@threadhelm/contracts';

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
  /** Ephemeral session bridge configuration if supported */
  bridgeConfig?: SessionBridgeConfig | null;
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
    structuredActivity: false;
    cleanStopStrategy: 'slash_exit' | 'ctrl_d';
    bridgeConfiguration?: BridgeConfigurationCapability;
    safePointEvidence?: 'none' | 'turn_completed';
    automaticPresentation?: AutomaticPresentationCapability;
    memoryTools?: MemoryToolsCapability;
    supervisorTools?: SupervisorToolsCapability;
    configurationFailureBehavior?: 'manual_only';
  };
  readonly executableCandidates: readonly ExecutableCandidate[];
  probe(ctx: ProbeContext): Promise<ReadinessResult>;
  buildLaunch(ctx: LaunchContext): LaunchDescriptor;
  buildCleanStop(ctx: StopContext): CleanStopAction;
  parseStructuredActivity?(event: Uint8Array): ActivityEvidence | null;
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
