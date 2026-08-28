/**
 * Provider readiness probing (T042).
 *
 * Builds the trusted search context (install roots and absolute PATH entries,
 * minus the workspace and the current directory), runs each adapter's bounded
 * probe, and turns the result into a sanitized view. Raw probe output is
 * consumed inside the adapter and never stored, logged, or forwarded.
 */

import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { delimiter, isAbsolute, resolve } from 'node:path';
import {
  PROBE_TIMEOUT_MS,
  ThreadHelmError,
  type ProviderId,
  type ReadinessView,
} from '@threadhelm/contracts';
import type {
  ProbeContext,
  ProbeExecResult,
  ProviderAdapter,
  ReadinessResult,
} from '@threadhelm/providers';
import { now, type Context, type ProbeRunner } from '../context.js';

const MAX_PROBE_OUTPUT = 64 * 1024;

export function isCmdExe(executable: string): boolean {
  return /[\\/]cmd\.exe$/i.test(executable);
}

function envDir(name: string): string | null {
  const value = process.env[name];
  return value && isAbsolute(value) ? resolve(value) : null;
}

/** Real probe runner: injected into the coordinator; tests replace it. */
export function createProbeRunner(): ProbeRunner {
  const cwd = process.cwd();
  return {
    context(excludedDirectories) {
      const pathEntries = (process.env.PATH ?? '')
        .split(delimiter)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && isAbsolute(entry))
        .map((entry) => resolve(entry));
      return {
        roots: {
          LOCALAPPDATA: envDir('LOCALAPPDATA'),
          APPDATA: envDir('APPDATA'),
          PROGRAMFILES: envDir('ProgramFiles'),
          USERPROFILE: envDir('USERPROFILE'),
        },
        pathEntries,
        excludedDirectories: [cwd, ...excludedDirectories],
        timeoutMs: PROBE_TIMEOUT_MS,
        fs: {
          async isFile(path) {
            try {
              return (await stat(path)).isFile();
            } catch {
              return false;
            }
          },
        },
        exec: runBounded,
      } satisfies ProbeContext;
    },
  };
}

function runBounded(
  executable: string,
  args: readonly string[],
  opts: { timeoutMs: number; signal?: AbortSignal },
): Promise<ProbeExecResult> {
  return new Promise((resolvePromise) => {
    const child = execFile(
      executable,
      [...args],
      {
        timeout: opts.timeoutMs,
        maxBuffer: MAX_PROBE_OUTPUT,
        windowsHide: true,
        shell: false,
        // A .cmd shim runs through cmd.exe /d /s /c "<already quoted>"; Node's
        // default argument escaping would wrap that in \" which cmd rejects.
        windowsVerbatimArguments: isCmdExe(executable),
        encoding: 'utf8',
        ...(opts.signal ? { signal: opts.signal } : {}),
      },
      (error, stdout, stderr) => {
        const timedOut = Boolean(
          error && 'killed' in error && error.killed && child.exitCode === null,
        );
        resolvePromise({
          stdout: String(stdout).slice(0, MAX_PROBE_OUTPUT),
          stderr: String(stderr).slice(0, MAX_PROBE_OUTPUT),
          exitCode: typeof child.exitCode === 'number' ? child.exitCode : error ? null : 0,
          timedOut,
        });
      },
    );
  });
}

export function toReadinessView(
  adapter: ProviderAdapter,
  result: ReadinessResult,
  probedAt: string,
): ReadinessView {
  return {
    providerId: adapter.id,
    displayName: adapter.displayName,
    resolvedExecutable: result.resolvedExecutable,
    version: result.version,
    availability: result.availability,
    authentication: result.authentication,
    reasonCode: result.reasonCode,
    safeSummary: result.safeSummary,
    probedAt,
  };
}

export async function probeProvider(
  ctx: Context,
  providerId: ProviderId,
  excludedDirectories: readonly string[] = [],
): Promise<{ view: ReadinessView; result: ReadinessResult }> {
  const adapter = ctx.adapters.find((candidate) => candidate.id === providerId);
  if (!adapter) throw new ThreadHelmError('PROVIDER_UNAVAILABLE', 'Unknown provider.');
  const probedAt = now(ctx);
  try {
    const result = await adapter.probe(ctx.probes.context(excludedDirectories));
    const view = toReadinessView(adapter, result, probedAt);
    ctx.log.info('provider.probed', {
      providerId,
      availability: result.availability,
      authentication: result.authentication,
      reasonCode: result.reasonCode,
    });
    return { view, result };
  } catch (error) {
    ctx.log.warn('provider.probe_threw', {
      providerId,
      errorName: error instanceof Error ? error.name : 'unknown',
    });
    throw new ThreadHelmError('PROBE_FAILED', 'The provider could not be checked.', { providerId });
  }
}

/** One provider failing never changes another's result (adapter contract 5). */
export async function listReadiness(ctx: Context): Promise<ReadinessView[]> {
  const views = await Promise.all(
    ctx.adapters.map(async (adapter) => {
      try {
        const { view } = await probeProvider(ctx, adapter.id);
        return view;
      } catch {
        return {
          providerId: adapter.id,
          displayName: adapter.displayName,
          resolvedExecutable: null,
          version: null,
          availability: 'error' as const,
          authentication: 'unknown' as const,
          reasonCode: 'PROBE_FAILED',
          safeSummary: 'The provider could not be checked.',
          probedAt: now(ctx),
        };
      }
    }),
  );
  for (const view of views) ctx.events.emit('provider.readinessChanged', view);
  return views;
}
