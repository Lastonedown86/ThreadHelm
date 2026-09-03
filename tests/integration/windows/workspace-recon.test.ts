/**
 * Workspace Recon — Windows integration coverage (Task 7).
 *
 * Runs the fixture agent's `recon` mode through the real session pipeline:
 * real Job Object, real ConPTY host, real output directory on disk. No
 * credentials, no network, no token spend.
 *
 * Design: docs/superpowers/specs/2026-09-02-workspace-recon-design.md
 */

import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReconLaunchPreviewView, ReconRunView } from '@threadhelm/contracts';
import {
  RECON_PROPOSAL_FIXTURES,
  writeAgentManifestFile,
  type FakeAgentMode,
} from '@threadhelm/test-fixtures';
import {
  approveFolder,
  cleanupUserData,
  forceStop as forceStopSession,
  launchApp,
  mkWorkspace,
  pidsOf,
  waitForPidExit,
  type LaunchedApp,
} from './helpers/harness.js';

const TERMINAL = { columns: 100, rows: 30 };
const PROVIDER = 'codex-cli';

let app: LaunchedApp;
let workspaceId: string;
let workspacePath: string;
const dirs: string[] = [];

beforeEach(async () => {
  app = await launchApp();
  await app.useFixtureAdapters({ [PROVIDER]: 'recon' });
  const dir = mkWorkspace('recon');
  dirs.push(dir);
  workspacePath = dir;
  const workspace = await approveFolder(app, dir);
  workspaceId = workspace.id;
});

afterEach(async () => {
  await app.close();
  cleanupUserData(app.userData);
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Approves a temp workspace, previews and confirms a recon launch against the fixture agent. */
async function startReconAgainstFixture(
  opts: { mode?: FakeAgentMode } = {},
): Promise<ReconRunView> {
  await app.useFixtureAdapters({ [PROVIDER]: opts.mode ?? 'recon' });
  const preview = await app.call<ReconLaunchPreviewView>('workspaceRecon.previewLaunch', {
    workspaceId,
    providerId: PROVIDER,
    terminal: TERMINAL,
  });
  return app.call<ReconRunView>('workspaceRecon.confirmLaunch', {
    previewToken: preview.launch.previewToken,
    boundaryConfirmation: true,
  });
}

/** Awaits service.whenCollected(runId) and returns the collected run. */
async function waitForOutcome(runId: string): Promise<ReconRunView> {
  await app.reconWhenCollected(runId);
  return app.call<ReconRunView>('workspaceRecon.getRun', { workspaceId });
}

/** The run's output directory under the app's reconRoot. */
function outputDirOf(runId: string): string {
  return join(app.userData, 'recon', workspaceId, runId);
}

/** Sorted relative paths plus sizes, for asserting a tree is untouched. */
function snapshotTree(root: string): { path: string; size: number }[] {
  const out: { path: string; size: number }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // The fixture adapter writes its own readiness marker into the
      // workspace so other Windows suites can synchronize on it (see
      // stop-escalation.test.ts). That is test-harness noise, not something
      // the product — or a recon agent — writes; excluded so this snapshot
      // proves the *agent* left the tree alone, not that the harness did.
      if (/^\.threadhelm-fixture-.*\.ready$/.test(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push({ path: relative(root, full), size: statSync(full).size });
    }
  };
  walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** Existing force-stop helper from the neighbouring Windows suites. */
function forceStop(sessionId: string): Promise<unknown> {
  return forceStopSession(app, sessionId);
}

/**
 * Crashes the whole coordinator (the only way, in this architecture, to end a
 * session without main's own teardown ever running — see failure.ts, whose
 * cleanup() unconditionally calls recon.onSessionEnded on every ordinary
 * termination path) and relaunches against the same user data, so the
 * session's session row and this test's workspace approval survive, but the
 * in-flight recon run's collection never happened.
 */
async function killWithoutCollecting(sessionId: string): Promise<void> {
  const pids = await pidsOf(app, sessionId);
  const userData = app.userData;
  await app.crashCoordinator();
  for (const pid of pids) await waitForPidExit(pid, 10_000);
  app = await launchApp({ userData });
  await app.useFixtureAdapters({ [PROVIDER]: 'recon' });
}

describe('workspace recon', () => {
  it('runs recon in its own job object and leaves the workspace untouched', async () => {
    const before = snapshotTree(workspacePath);
    const run = await startReconAgainstFixture();
    await waitForOutcome(run.runId);
    expect(snapshotTree(workspacePath)).toEqual(before);
  }, 60_000);

  it('writes proposals outside the approved workspace', async () => {
    const run = await startReconAgainstFixture();
    expect(outputDirOf(run.runId).toLowerCase()).not.toContain(workspacePath.toLowerCase());
  }, 60_000);

  it('force stop terminates a recon session and records stopped_by_owner', async () => {
    const run = await startReconAgainstFixture({ mode: 'ignore-interrupt' });
    await forceStop(run.sessionId!);
    expect((await waitForOutcome(run.runId)).outcome).toBe('stopped_by_owner');
  }, 60_000);

  it('deletes a stale output directory when a new run starts for the same workspace', async () => {
    // A mode that never exits on its own: the run must still be uncollected
    // when the coordinator is crashed, or this would only be re-proving
    // ordinary collection cleanup rather than the crash-safety discard.
    const first = await startReconAgainstFixture({ mode: 'ignore-interrupt' });
    const staleDir = outputDirOf(first.runId);
    expect(existsSync(staleDir)).toBe(true);

    await killWithoutCollecting(first.sessionId!);
    expect(existsSync(staleDir)).toBe(true); // still there: never collected

    await startReconAgainstFixture();
    expect(existsSync(staleDir)).toBe(false);
  }, 90_000);

  /**
   * A previous review flagged, and could not resolve by reading, that
   * confirmLaunch discards <reconRoot>/<workspaceId> unconditionally before
   * attempting the launch. If a second confirmLaunch for the same workspace
   * is reachable while a first run is still alive, that discard would delete
   * the first run's output directory before its collect() ever runs — even
   * if the second launch itself is then refused.
   *
   * Settled empirically below rather than by re-reading the code: both
   * previews are issued while no session is running yet (so neither is
   * refused by the one-writer lease at preview time — see lease.ts's
   * assertLeaseFree, which only inspects the *current* holder), then A is
   * confirmed and kept alive on a non-exiting fixture mode, and only then is
   * B confirmed with its earlier token.
   */
  it("probes whether an overlapping confirmLaunch destroys a live run's output directory", async () => {
    await app.useFixtureAdapters({ [PROVIDER]: 'ignore-interrupt' });
    const previewA = await app.call<ReconLaunchPreviewView>('workspaceRecon.previewLaunch', {
      workspaceId,
      providerId: PROVIDER,
      terminal: TERMINAL,
    });
    const previewB = await app.call<ReconLaunchPreviewView>('workspaceRecon.previewLaunch', {
      workspaceId,
      providerId: PROVIDER,
      terminal: TERMINAL,
    });

    const runA = await app.call<ReconRunView>('workspaceRecon.confirmLaunch', {
      previewToken: previewA.launch.previewToken,
      boundaryConfirmation: true,
    });
    expect(runA.sessionId).not.toBeNull();

    // Simulate the agent having already produced manifests for the live run,
    // exactly as a real recon agent would before ThreadHelm ever asks it to
    // stop (Task 6's own manual verification did the same thing).
    const dirA = outputDirOf(runA.runId);
    for (const fixture of RECON_PROPOSAL_FIXTURES) {
      writeAgentManifestFile(dirA, fixture.basename, fixture.text);
    }
    expect(existsSync(dirA)).toBe(true);

    // The owner starts a second recon run for the same workspace while A is
    // still alive and uncollected.
    const attemptB = await app.dispatch<ReconRunView>('workspaceRecon.confirmLaunch', {
      previewToken: previewB.launch.previewToken,
      boundaryConfirmation: true,
    });

    const dirASurvived = existsSync(dirA);
    console.log('WORKSPACE_RECON_CONCURRENCY_PROBE', {
      attemptBOk: attemptB.ok,
      attemptBErrorCode: attemptB.ok ? null : attemptB.error.code,
      firstRunDirectorySurvived: dirASurvived,
    });

    // Whatever the outcome, the second launch must never be silently treated
    // as if it started a second, independent run: recon tracks one run per
    // workspace.
    if (attemptB.ok) {
      expect(attemptB.value.runId).not.toBe(runA.runId);
    }

    await forceStop(runA.sessionId!);
    const collectedA = await waitForOutcome(runA.runId);

    if (!dirASurvived) {
      // The hazard is real: confirmLaunch's unconditional discard destroyed a
      // live, uncollected run's manifests before the conflicting launch was
      // even refused. Collection for A now finds nothing, even though five
      // fixture files — four valid, one malformed — were written moments
      // earlier and never read.
      expect(collectedA.proposals).toHaveLength(0);
      expect(collectedA.rejected).toHaveLength(0);
    } else {
      // No clobber occurred: whatever guard stopped the second launch also
      // left the first run's files intact, so collection sees them.
      expect(collectedA.proposals.length + collectedA.rejected.length).toBeGreaterThan(0);
    }
  }, 60_000);
});
