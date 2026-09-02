/**
 * Workspace Recon: one owner-confirmed assessment session per workspace whose
 * only return channel is a directory of manifest files outside the workspace.
 *
 * Design: docs/superpowers/specs/2026-09-02-workspace-recon-design.md
 *
 * Three disciplines this file exists to hold:
 *
 * 1. **Honesty.** ThreadHelm cannot enforce what a CLI agent does inside an
 *    approved folder. The prompt asks the agent to leave the workspace alone;
 *    the disclosure embeds the ordinary session boundary warning unchanged and
 *    adds no softer claim on top of it.
 * 2. **No transcript ingestion.** Nothing here reads, buffers or interprets
 *    session output. Collection is triggered by the terminal-lifecycle signal
 *    the session teardown already emits, and reads only files the run wrote to
 *    a ThreadHelm-owned directory.
 * 3. **Nothing is hired.** A collected manifest is untrusted portable data. It
 *    reaches storage only through the existing preview-then-confirm profile
 *    gate, one role at a time.
 */

import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  RECON_NO_AUTO_HIRE_STATEMENT,
  ReconLaunchPreviewView,
  ReconRunView,
  ThreadHelmError,
  type AgentManifestV1,
  type LaunchPermissionSelection,
  type LaunchRuntimeSelection,
  type OperationRequest,
  type ReconOutcome,
  type ReconProposalView,
  type ReconRejectionView,
} from '@threadhelm/contracts';
import {
  classifyReconOutcome,
  MAX_MANIFEST_BYTES,
  parseAgentManifest,
  reconRoleForBasename,
  selectReconFiles,
} from '@threadhelm/domain';
import type { Context } from '../context.js';
import { evaluateManifestCompatibility } from './profiles.js';
import { launchSession } from '../sessions/launch.js';
import { DEFAULT_PROVIDER_EXECUTION_BOUNDS } from '../sessions/launch-policy.js';
import { previewLaunch as previewSessionLaunch } from '../sessions/preview.js';
import { sendControl } from '../sessions/registry.js';
import { findWorkspace } from '../workspaces/service.js';

const execFileAsync = promisify(execFile);

/**
 * Disclosed to the owner and asked of the agent. ThreadHelm has no token
 * accounting, so this is a request in the prompt, never an enforced bound —
 * see `tokenCapReached` below.
 */
const RECON_TOKEN_CAP = 200_000;

/** `git rev-parse HEAD` is provenance, not a dependency; it fails fast or not at all. */
const GIT_TIMEOUT_MS = 2_000;

/**
 * Recon runs with no model or effort escalation and no permission selection,
 * so the provider's own default (manual approval) applies. A run that reads a
 * repository has no business asking for automatic approval of anything.
 */
const RECON_RUNTIME_SELECTION: LaunchRuntimeSelection = { model: null, effort: null };
const RECON_PERMISSION_SELECTION: LaunchPermissionSelection = {
  policy: null,
  boundedAllowlist: [],
};

/**
 * The exact text sent as the session's first input, disclosed verbatim before
 * launch. It asks for restraint in concrete terms — "write nothing inside the
 * workspace" — rather than claiming a guarantee the product cannot make.
 */
function buildReconPrompt(outputDirectory: string, tokenCap: number): string {
  return [
    'Assess this repository so ThreadHelm can propose a roster of agent roles for it.',
    '',
    'First, understand the shape of the work. Look at package and project manifests,',
    'lockfiles, workspace configuration, CI definitions, test configuration, README,',
    'CONTRIBUTING, and the directory layout.',
    '',
    'Then write one JSON file per proposed role into exactly this directory:',
    `  ${outputDirectory}`,
    '',
    'Each file is a threadhelm/agent-profile@1 manifest with these fields and no others:',
    '  spec, name, description, provider, model, capabilities, isolate, tokenCap, author, goal',
    '',
    'Rules:',
    '- Name the supervisor file exactly supervisor.agent.json. Give every other file a',
    '  short kebab-case basename ending in .agent.json.',
    '- Propose one supervisor and between three and eight specialists.',
    '- Leave every name field a placeholder such as "Unnamed specialist". The owner',
    '  types the real name when accepting the role.',
    '- Write nothing inside the workspace. Create, change and delete no file there.',
    '  Every file you write goes in the directory above.',
    `- Stay within about ${tokenCap} tokens for this assessment.`,
    '- Write the files, then stop. Do not run builds, tests, installs or migrations.',
  ].join('\n');
}

/** What `profiles.previewImport` needs to review one proposed role. */
export interface TakenReconProposal {
  manifest: AgentManifestV1;
  digest: string;
  sourceBasename: string;
  runId: string;
  derivedFromCommit: string | null;
}

export interface ReconService {
  previewLaunch(
    request: OperationRequest<'workspaceRecon.previewLaunch'>,
  ): Promise<ReconLaunchPreviewView>;
  confirmLaunch(request: OperationRequest<'workspaceRecon.confirmLaunch'>): Promise<ReconRunView>;
  getRun(request: OperationRequest<'workspaceRecon.getRun'>): ReconRunView | null;
  /** Consumed by profiles.previewImport when the source is a proposal. */
  takeProposal(proposalId: string): TakenReconProposal | null;
  /** Resolves once collection for this run has finished. Deterministic waiting for tests. */
  whenCollected(runId: string): Promise<void>;
  /**
   * The session reached a terminal lifecycle state. Called from session
   * teardown, the one signal main already emits for every ending; recon never
   * subscribes to session output.
   */
  onSessionEnded(sessionId: string): void;
}

interface ReconPreview {
  runId: string;
  workspaceId: string;
  /** Win32 form of the approved folder, the cwd `git rev-parse` runs in. */
  workspaceDisplayPath: string;
  outputDirectory: string;
  reconPrompt: string;
}

interface ReconRun {
  runId: string;
  workspaceId: string;
  sessionId: string | null;
  outcome: ReconOutcome | null;
  derivedFromCommit: string | null;
  startedAt: string;
  completedAt: string | null;
  outputDirectory: string;
  proposals: ReconProposalView[];
  rejected: ReconRejectionView[];
  ignoredFileCount: number;
  collected: Promise<void>;
  finishCollection: () => void;
}

function toView(run: ReconRun): ReconRunView {
  return ReconRunView.parse({
    runId: run.runId,
    workspaceId: run.workspaceId,
    sessionId: run.sessionId,
    outcome: run.outcome,
    derivedFromCommit: run.derivedFromCommit,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    proposals: run.proposals,
    rejected: run.rejected,
    ignoredFileCount: run.ignoredFileCount,
  });
}

/** Provenance, best effort: absence is recorded as absence, never as a failure. */
async function headCommit(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
    });
    const head = stdout.trim();
    return /^[0-9a-f]{40}$/.test(head) ? head : null;
  } catch {
    return null;
  }
}

/**
 * A launch refused for authentication is its own outcome, not a blanket
 * failure: the preflight probe and the pre-launch revalidation both report it.
 */
function isUnauthenticated(error: unknown): boolean {
  if (!(error instanceof ThreadHelmError) || error.code !== 'PROVIDER_UNAVAILABLE') return false;
  return (
    error.details.authentication === 'unauthenticated' ||
    error.details.drift === 'AUTHENTICATION_CHANGED'
  );
}

export function createReconService(ctx: Context): ReconService {
  /**
   * Keyed by the session preview token so recon adds no second confirmation:
   * the owner confirms one disclosure, and `launchSession` remains the single
   * authority that consumes the token.
   */
  const pending = new Map<string, ReconPreview>();
  /** The current run per workspace. An earlier run is discarded, never merged. */
  const runs = new Map<string, ReconRun>();

  const runById = (runId: string): ReconRun | null =>
    [...runs.values()].find((run) => run.runId === runId) ?? null;

  /**
   * True when the owner asked this session to stop by any of the three
   * controls. Read from the durable event history, which teardown has already
   * written; the stop kind alone cannot tell an owner stop from a provider
   * that happened to exit cleanly on its own.
   */
  const ownerStopped = (sessionId: string | null): boolean => {
    if (!sessionId) return false;
    try {
      return (
        ctx.storage?.repositories.events
          .listBySession(sessionId)
          .some(
            (event) =>
              event.actor === 'user' &&
              (event.kind === 'stop_requested' ||
                event.kind === 'interrupt_requested' ||
                event.kind === 'force_stop_requested'),
          ) ?? false
      );
    } catch {
      return false;
    }
  };

  const discard = async (dir: string): Promise<void> => {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  };

  const collect = async (run: ReconRun): Promise<void> => {
    try {
      const entries = await readdir(run.outputDirectory, { withFileTypes: true }).catch(() => []);
      const candidates: { name: string; sizeBytes: number }[] = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const stats = await stat(join(run.outputDirectory, entry.name)).catch(() => null);
        if (stats) candidates.push({ name: entry.name, sizeBytes: stats.size });
      }
      const selection = selectReconFiles(candidates);
      for (const name of selection.considered) {
        try {
          if (selection.oversized.includes(name)) {
            throw new ThreadHelmError(
              'PROFILE_OVERSIZED',
              'Agent manifest exceeds the maximum read size.',
            );
          }
          const bytes = await readFile(join(run.outputDirectory, name));
          if (bytes.byteLength > MAX_MANIFEST_BYTES) {
            throw new ThreadHelmError(
              'PROFILE_OVERSIZED',
              'Agent manifest exceeds the maximum read size.',
            );
          }
          const manifest = parseAgentManifest(bytes.toString('utf8'));
          const compatibility = evaluateManifestCompatibility(ctx, manifest);
          run.proposals.push({
            proposalId: randomUUID(),
            role: reconRoleForBasename(name),
            sourceBasename: name,
            digest: createHash('sha256').update(bytes).digest('hex'),
            manifest,
            compatibility: compatibility.compatibility,
            compatibilityReasons: compatibility.reasons,
          });
        } catch (error) {
          // Reported with its reason, never silently dropped.
          run.rejected.push({
            sourceBasename: name,
            errorCode: error instanceof ThreadHelmError ? error.code : 'PROFILE_UNREADABLE',
          });
        }
      }
      // Supervisor first, so the review order matches the roster being proposed.
      run.proposals.sort(
        (a, b) => Number(b.role === 'supervisor') - Number(a.role === 'supervisor'),
      );
      run.ignoredFileCount = selection.ignoredForCount.length;
      run.outcome = classifyReconOutcome({
        providerUnauthenticated: false,
        ownerStopped: ownerStopped(run.sessionId),
        // ThreadHelm has no token accounting: the cap is disclosed and asked of
        // the agent, never measured. This fact stays false until a provider
        // reports usage main can observe.
        tokenCapReached: false,
        filesWritten: candidates.length,
        parsedCount: run.proposals.length,
        rejectedCount: run.rejected.length,
      });
      run.completedAt = ctx.clock().toISOString();
      ctx.log.info('recon.collected', {
        runId: run.runId,
        outcome: run.outcome,
        parsed: run.proposals.length,
        rejected: run.rejected.length,
      });
    } finally {
      // The manifests are held in memory now; the directory has no reason to
      // outlive the run, and a failed collection must not leave one behind.
      await discard(run.outputDirectory);
      run.finishCollection();
    }
  };

  return {
    async previewLaunch(request) {
      // The ordinary session disclosure, unchanged: same preflight, same
      // revalidation, same boundary warning. Recon only adds fields beside it.
      const launch = await previewSessionLaunch(
        ctx,
        request.workspaceId,
        request.providerId,
        request.terminal,
        RECON_RUNTIME_SELECTION,
        RECON_PERMISSION_SELECTION,
        // A recon run is an ordinary run: nothing about reading a repository
        // justifies looser execution bounds or a special work type.
        DEFAULT_PROVIDER_EXECUTION_BOUNDS,
        'general',
      );
      const workspace = findWorkspace(ctx, request.workspaceId);
      const runId = randomUUID();
      const outputDirectory = join(ctx.reconRoot(), request.workspaceId, runId);
      const reconPrompt = buildReconPrompt(outputDirectory, RECON_TOKEN_CAP);
      pending.set(launch.previewToken, {
        runId,
        workspaceId: request.workspaceId,
        workspaceDisplayPath: workspace.displayPath,
        outputDirectory,
        reconPrompt,
      });
      // Unconfirmed previews are bounded; the session token store remains the
      // authority on whether a token is still usable.
      while (pending.size > 16) pending.delete(pending.keys().next().value!);
      return ReconLaunchPreviewView.parse({
        launch,
        outputDirectory,
        tokenCap: RECON_TOKEN_CAP,
        reconPrompt,
        autoHireStatement: RECON_NO_AUTO_HIRE_STATEMENT,
      });
    },

    async confirmLaunch(request) {
      const preview = pending.get(request.previewToken);
      pending.delete(request.previewToken);
      if (!preview) {
        throw new ThreadHelmError('PREVIEW_EXPIRED', 'The recon preview expired. Open it again.');
      }
      // A new run replaces the previous one entirely: proposals derived from a
      // tree that has since moved are not evidence about the current tree, and
      // a directory left by a crashed run must not be read as this run's work.
      await discard(join(ctx.reconRoot(), preview.workspaceId));
      await mkdir(preview.outputDirectory, { recursive: true });
      const derivedFromCommit = await headCommit(preview.workspaceDisplayPath);
      let finishCollection!: () => void;
      const collected = new Promise<void>((resolve) => {
        finishCollection = resolve;
      });
      const run: ReconRun = {
        runId: preview.runId,
        workspaceId: preview.workspaceId,
        sessionId: null,
        outcome: null,
        derivedFromCommit,
        startedAt: ctx.clock().toISOString(),
        completedAt: null,
        outputDirectory: preview.outputDirectory,
        proposals: [],
        rejected: [],
        ignoredFileCount: 0,
        collected,
        finishCollection,
      };
      runs.set(run.workspaceId, run);

      let session;
      try {
        session = await launchSession(ctx, request.previewToken, request.boundaryConfirmation);
      } catch (error) {
        await discard(run.outputDirectory);
        if (!isUnauthenticated(error)) {
          runs.delete(run.workspaceId);
          run.finishCollection();
          throw error;
        }
        run.outcome = 'provider_unauthenticated';
        run.completedAt = ctx.clock().toISOString();
        run.finishCollection();
        return toView(run);
      }
      run.sessionId = session.id;

      // Main-owned first input, on the same serialized control channel the
      // coordination delivery path uses. The renderer selection guard governs
      // renderer-originated bytes and is left exactly as it is.
      const live = ctx.live.get(session.id);
      if (live) {
        const bytes = new TextEncoder().encode(`${preview.reconPrompt.replace(/\n/g, '\r\n')}\r\n`);
        sendControl(ctx, live, (controlSequence) => ({
          type: 'host.input',
          sessionId: session.id,
          protocolVersion: 1,
          controlSequence,
          bytes,
        }));
      }
      return toView(run);
    },

    getRun(request) {
      const run = runs.get(request.workspaceId);
      return run ? toView(run) : null;
    },

    takeProposal(proposalId) {
      for (const run of runs.values()) {
        const index = run.proposals.findIndex((p) => p.proposalId === proposalId);
        if (index < 0) continue;
        const [proposal] = run.proposals.splice(index, 1);
        return {
          manifest: proposal!.manifest,
          digest: proposal!.digest,
          sourceBasename: proposal!.sourceBasename,
          runId: run.runId,
          derivedFromCommit: run.derivedFromCommit,
        };
      }
      return null;
    },

    whenCollected(runId) {
      return runById(runId)?.collected ?? Promise.resolve();
    },

    onSessionEnded(sessionId) {
      const run = [...runs.values()].find((r) => r.sessionId === sessionId && r.outcome === null);
      // Teardown is synchronous and must never be destabilised by collection:
      // the run keeps a null outcome and the waiter is already resolved.
      if (run) {
        void collect(run).catch((error: unknown) => {
          ctx.log.warn('recon.collection_failed', {
            runId: run.runId,
            reasonCode: error instanceof ThreadHelmError ? error.code : 'RECON_COLLECTION_FAILED',
          });
        });
      }
    },
  };
}
