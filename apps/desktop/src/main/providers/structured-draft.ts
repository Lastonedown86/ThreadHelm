/**
 * Bounded, non-interactive structured-draft calls (T-structured-draft-01).
 *
 * Mirrors providers/readiness.ts's probe runner: main resolves the
 * executable and executes the adapter's descriptor in an app-owned temporary
 * directory with a hard timeout and a byte cap, writing the prompt to stdin.
 * The adapter reduces raw output to one string or null; this module never
 * inspects that string's contents, never logs raw output, and never retries.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ThreadHelmError, type ProviderId } from '@threadhelm/contracts';
import {
  builtInAdapters,
  resolveExecutable,
  type StructuredDraftExecResult,
} from '@threadhelm/providers';
import type { Context } from '../context.js';
import { createProbeRunner, isCmdExe } from './readiness.js';

const MAX_STRUCTURED_DRAFT_OUTPUT = 256 * 1024;
export const STRUCTURED_DRAFT_TIMEOUT_MS = 120_000;

export interface StructuredDraftSelection {
  model?: string | null;
  effort?: string | null;
}

export type StructuredDraftOutcome = { text: string } | { held: true; reasonCode: string };

export interface StructuredDraftRunner {
  run(
    providerId: ProviderId,
    prompt: string,
    selection?: StructuredDraftSelection,
  ): Promise<StructuredDraftOutcome>;
}

function runBoundedExec(
  executable: string,
  args: readonly string[],
  stdin: string,
  cwd: string,
): Promise<StructuredDraftExecResult & { timedOut: boolean }> {
  return new Promise((resolvePromise) => {
    const child = execFile(
      executable,
      [...args],
      {
        cwd,
        timeout: STRUCTURED_DRAFT_TIMEOUT_MS,
        maxBuffer: MAX_STRUCTURED_DRAFT_OUTPUT,
        windowsHide: true,
        shell: false,
        windowsVerbatimArguments: isCmdExe(executable),
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        resolvePromise({
          stdout: String(stdout).slice(0, MAX_STRUCTURED_DRAFT_OUTPUT),
          stderr: String(stderr).slice(0, MAX_STRUCTURED_DRAFT_OUTPUT),
          exitCode: typeof child.exitCode === 'number' ? child.exitCode : error ? null : 0,
          timedOut: Boolean(error && 'killed' in error && error.killed && child.exitCode === null),
        });
      },
    );
    // Both CLIs read the prompt from stdin until EOF; a stdin left open hangs.
    child.stdin?.end(stdin);
  });
}

/** Real runner: injected into bootstrap; contract tests override ctx.structuredDraft directly. */
export function createStructuredDraftRunner(): StructuredDraftRunner {
  const probes = createProbeRunner();
  return {
    async run(providerId, prompt, selection = {}) {
      const adapter = builtInAdapters.find((candidate) => candidate.id === providerId);
      if (!adapter?.buildStructuredDraft || !adapter.parseStructuredDraftOutput) {
        return { held: true, reasonCode: 'STRUCTURED_DRAFT_UNSUPPORTED' };
      }
      const resolved = await resolveExecutable(adapter, probes.context([]));
      if (!resolved) return { held: true, reasonCode: 'EXECUTABLE_NOT_FOUND' };
      const descriptor = adapter.buildStructuredDraft({
        prompt,
        resolvedExecutable: resolved.path,
        executableKind: resolved.kind,
        model: selection.model ?? null,
        effort: selection.effort ?? null,
      });
      // An app-owned empty directory: no workspace, no repository, nothing to read.
      const cwd = await mkdtemp(join(tmpdir(), 'threadhelm-draft-'));
      try {
        const raw = await runBoundedExec(
          descriptor.executable,
          descriptor.args,
          descriptor.stdin,
          cwd,
        );
        if (raw.timedOut) return { held: true, reasonCode: 'STRUCTURED_DRAFT_TIMEOUT' };
        const text = adapter.parseStructuredDraftOutput(raw);
        if (text === null) return { held: true, reasonCode: 'STRUCTURED_DRAFT_OUTPUT_INVALID' };
        return { text };
      } finally {
        await rm(cwd, { recursive: true, force: true }).catch(() => undefined);
      }
    },
  };
}

/** Thin ctx-shaped wrapper, mirroring providers/readiness.ts's probeProvider. */
export async function runStructuredDraft(
  ctx: Context,
  providerId: ProviderId,
  prompt: string,
  selection?: StructuredDraftSelection,
): Promise<StructuredDraftOutcome> {
  try {
    const outcome = await ctx.structuredDraft.run(providerId, prompt, selection);
    ctx.log.info('structured_draft.completed', {
      providerId,
      held: 'held' in outcome,
      reasonCode: 'held' in outcome ? outcome.reasonCode : null,
    });
    return outcome;
  } catch (error) {
    ctx.log.warn('structured_draft.threw', {
      providerId,
      errorName: error instanceof Error ? error.name : 'unknown',
    });
    throw new ThreadHelmError(
      'STRUCTURED_DRAFT_UNAVAILABLE',
      'The structured draft request could not be completed.',
    );
  }
}
