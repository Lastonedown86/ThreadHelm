/**
 * Recon service: honest disclosure, bounded collection, distinct outcomes,
 * and no reading of session output.
 *
 * The harness drives the real coordinator: real storage, the real session
 * preview/launch path, the real terminal-lifecycle teardown, and a real
 * output directory on disk. Only the OS boundary (native supervisor, host
 * process) is faked, exactly as the neighbouring contract suites do.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RECON_NO_AUTO_HIRE_STATEMENT,
  type LaunchPreviewView,
  type MainToHostMessage,
  type ReconRunView,
} from '@threadhelm/contracts';
import { MAX_MANIFEST_BYTES, MAX_RECON_FILES } from '@threadhelm/domain';
import { RECON_PROPOSAL_FIXTURES } from '@threadhelm/test-fixtures';
import type { ReconService } from '../../../apps/desktop/src/main/coordination/recon.js';
import { createWorld, identity, type FakeWorld } from '../../contract/helpers/fake-context.js';

const TERMINAL = { columns: 120, rows: 30 };

interface ReconHarness {
  world: FakeWorld;
  service: ReconService;
  workspaceId: string;
  workspacePath: string;
  /** The exact LaunchPreviewView the session preview path returns. */
  launchPreview(): Promise<LaunchPreviewView>;
  outputDirOf(runId: string): string;
  /** Drives the session to a terminal lifecycle state and lets collection run. */
  completeSession(runId: string, opts: { ownerStopped: boolean }): Promise<void>;
}

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

function tempDir(prefix: string): string {
  // mkdtemp appends its random suffix to the prefix, so only the leaf is new.
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

async function buildReconHarness(
  options: { gitInit?: boolean } = {},
): Promise<ReconHarness & { headCommit: string | null }> {
  const workspacePath = tempDir('recon-ws-');
  const reconRoot = tempDir('recon-root-');
  let headCommit: string | null = null;
  if (options.gitInit) headCommit = initGitRepository(workspacePath);

  const world = createWorld({ reconRoot });
  // The native supervisor is faked, so the canonical form is synthesised from
  // the real path; displayPath (the git cwd) is the Win32 form of the same dir.
  world.addDir(workspacePath, identity(7));
  const workspace = await world.approve(workspacePath);
  const service = world.ctx.recon!;

  const runningSessionId = (): string => {
    const ids = [...world.ctx.live.keys()];
    if (ids.length !== 1) throw new Error(`expected one live session, saw ${ids.length}`);
    return ids[0]!;
  };

  return {
    world,
    service,
    workspaceId: workspace.id,
    workspacePath,
    headCommit,
    launchPreview: () =>
      world.ok<LaunchPreviewView>('sessions.previewLaunch', {
        workspaceId: workspace.id,
        providerId: 'claude-code',
        terminal: TERMINAL,
      }),
    outputDirOf: (runId) => join(reconRoot, workspace.id, runId),
    async completeSession(runId, opts) {
      const sessionId = runningSessionId();
      if (opts.ownerStopped) {
        const stop = await world.ok<{ stopToken: string }>('sessions.requestStop', { sessionId });
        await world.ok('sessions.confirmStop', { stopToken: stop.stopToken });
      } else {
        world.hosts.find((host) => host.sessionId === sessionId)!.providerExits(0);
      }
      await world.until(() => !world.ctx.live.has(sessionId));
      await service.whenCollected(runId);
    },
  };
}

function initGitRepository(cwd: string): string {
  const git = (...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });
  git('init', '--quiet');
  git('config', 'user.email', 'recon@example.test');
  git('config', 'user.name', 'Recon Fixture');
  git('config', 'commit.gpgsign', 'false');
  writeFileSync(join(cwd, 'README.md'), '# fixture\n', 'utf8');
  git('add', '.');
  git('commit', '--quiet', '-m', 'fixture');
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
}

/** Runs previewLaunch + confirmLaunch and returns the started run. */
async function startRun(harness: ReconHarness): Promise<ReconRunView> {
  const preview = await harness.service.previewLaunch({
    workspaceId: harness.workspaceId,
    providerId: 'claude-code',
    terminal: TERMINAL,
  });
  return harness.service.confirmLaunch({
    previewToken: preview.launch.previewToken,
    boundaryConfirmation: true,
  });
}

function writeFixtures(dir: string, basenames?: readonly string[]): void {
  for (const fixture of RECON_PROPOSAL_FIXTURES) {
    if (basenames && !basenames.includes(fixture.basename)) continue;
    writeFileSync(join(dir, fixture.basename), fixture.text, 'utf8');
  }
}

describe('previewLaunch', () => {
  it('carries the session boundary warning unmodified', async () => {
    const harness = await buildReconHarness();
    const preview = await harness.service.previewLaunch({
      workspaceId: harness.workspaceId,
      providerId: 'claude-code',
      terminal: TERMINAL,
    });
    const sessionPreview = await harness.launchPreview();

    expect(preview.launch.boundaryWarning).toBe(sessionPreview.boundaryWarning);
    expect(preview.autoHireStatement).toBe(RECON_NO_AUTO_HIRE_STATEMENT);
  });

  it('discloses the exact prompt it will send and never claims read-only', async () => {
    const harness = await buildReconHarness();
    const preview = await harness.service.previewLaunch({
      workspaceId: harness.workspaceId,
      providerId: 'claude-code',
      terminal: TERMINAL,
    });

    expect(preview.reconPrompt.length).toBeGreaterThan(0);
    expect(preview.reconPrompt.toLowerCase()).not.toContain('read-only');
    expect(preview.reconPrompt.toLowerCase()).not.toContain('sandbox');
    expect(preview.reconPrompt).toContain(preview.outputDirectory);
    expect(preview.reconPrompt).toContain('supervisor.agent.json');
    expect(preview.outputDirectory.toLowerCase()).not.toContain(
      harness.workspacePath.toLowerCase(),
    );
    expect(preview.tokenCap).toBeGreaterThan(0);
  });

  it('sends the disclosed prompt as the session first input', async () => {
    const harness = await buildReconHarness();
    const preview = await harness.service.previewLaunch({
      workspaceId: harness.workspaceId,
      providerId: 'claude-code',
      terminal: TERMINAL,
    });
    const run = await harness.service.confirmLaunch({
      previewToken: preview.launch.previewToken,
      boundaryConfirmation: true,
    });

    expect(run.sessionId).not.toBeNull();
    expect(run.outcome).toBeNull();
    const host = harness.world.hosts.find((h) => h.sessionId === run.sessionId)!;
    const input = host.received.find(
      (message): message is Extract<MainToHostMessage, { type: 'host.input' }> =>
        message.type === 'host.input',
    );
    expect(input).toBeDefined();
    const sent = new TextDecoder().decode(input!.bytes);
    expect(sent).toContain(preview.reconPrompt.split('\n')[0]!);
    // Input is never read back; the run only ever reads files it wrote.
    expect(harness.world.ctx.selection.selectedSessionId).toBeNull();
  });

  it('routes through the coordinator handler table', async () => {
    const harness = await buildReconHarness();
    const preview = await harness.world.ok<{ outputDirectory: string }>(
      'workspaceRecon.previewLaunch',
      { workspaceId: harness.workspaceId, providerId: 'claude-code', terminal: TERMINAL },
    );
    expect(preview.outputDirectory.length).toBeGreaterThan(0);
    expect(
      await harness.world.ok('workspaceRecon.getRun', { workspaceId: harness.workspaceId }),
    ).toBeNull();
  });
});

describe('collection', () => {
  it('classifies a fixture run with one malformed file as partial', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    writeFixtures(harness.outputDirOf(run.runId));
    await harness.completeSession(run.runId, { ownerStopped: false });

    const collected = harness.service.getRun({ workspaceId: harness.workspaceId })!;
    expect(collected.outcome).toBe('partial');
    expect(collected.proposals).toHaveLength(4);
    expect(collected.rejected).toEqual([
      { sourceBasename: 'malformed.agent.json', errorCode: 'PROFILE_SCHEMA_INVALID' },
    ]);
    expect(collected.proposals.filter((p) => p.role === 'supervisor')).toHaveLength(1);
    // Supervisor first, so the review order matches the roster the owner reads.
    expect(collected.proposals[0]!.role).toBe('supervisor');
    // Recon never proposes a display name; the owner types it at acceptance.
    expect(collected.proposals[0]!.manifest.name).toBe('Unnamed supervisor');
  });

  it('reports completed when every considered file parsed', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    writeFixtures(harness.outputDirOf(run.runId), ['supervisor.agent.json', 'renderer.agent.json']);
    await harness.completeSession(run.runId, { ownerStopped: false });

    const collected = harness.service.getRun({ workspaceId: harness.workspaceId })!;
    expect(collected.outcome).toBe('completed');
    expect(collected.rejected).toEqual([]);
    expect(collected.completedAt).not.toBeNull();
  });

  it('reports unparsable_output when files were written and none parsed', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    writeFixtures(harness.outputDirOf(run.runId), ['malformed.agent.json']);
    await harness.completeSession(run.runId, { ownerStopped: false });

    expect(harness.service.getRun({ workspaceId: harness.workspaceId })!.outcome).toBe(
      'unparsable_output',
    );
  });

  it('reports no_output when the session wrote nothing', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    await harness.completeSession(run.runId, { ownerStopped: false });
    expect(harness.service.getRun({ workspaceId: harness.workspaceId })!.outcome).toBe('no_output');
  });

  it('reports stopped_by_owner even when manifests were written', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    writeFixtures(harness.outputDirOf(run.runId), ['supervisor.agent.json']);
    await harness.completeSession(run.runId, { ownerStopped: true });

    const collected = harness.service.getRun({ workspaceId: harness.workspaceId })!;
    expect(collected.outcome).toBe('stopped_by_owner');
    expect(collected.proposals).toHaveLength(1);
  });

  it('deletes the output directory once a run is collected', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    const dir = harness.outputDirOf(run.runId);
    expect(existsSync(dir)).toBe(true);
    await harness.completeSession(run.runId, { ownerStopped: false });
    expect(existsSync(dir)).toBe(false);
  });

  it('leaves the workspace tree untouched', async () => {
    const harness = await buildReconHarness();
    writeFileSync(join(harness.workspacePath, 'package.json'), '{"name":"fixture"}\n', 'utf8');
    const run = await startRun(harness);
    writeFixtures(harness.outputDirOf(run.runId));
    await harness.completeSession(run.runId, { ownerStopped: false });

    expect(readFileSync(join(harness.workspacePath, 'package.json'), 'utf8')).toBe(
      '{"name":"fixture"}\n',
    );
    expect(existsSync(join(harness.workspacePath, 'supervisor.agent.json'))).toBe(false);
  });

  it('considers at most MAX_RECON_FILES files and reports the rest as ignored', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    const dir = harness.outputDirOf(run.runId);
    // Names sort before 'supervisor.agent.json', so it is the file pushed out.
    for (let i = 0; i < MAX_RECON_FILES; i += 1) {
      writeFileSync(join(dir, `a${i}.agent.json`), RECON_PROPOSAL_FIXTURES[1]!.text, 'utf8');
    }
    writeFixtures(dir, ['supervisor.agent.json']);
    await harness.completeSession(run.runId, { ownerStopped: false });

    const collected = harness.service.getRun({ workspaceId: harness.workspaceId })!;
    expect(collected.proposals).toHaveLength(MAX_RECON_FILES);
    expect(collected.ignoredFileCount).toBe(1);
    expect(collected.proposals.some((p) => p.role === 'supervisor')).toBe(false);
  });

  it('rejects an oversized file by size rather than dropping it', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    const dir = harness.outputDirOf(run.runId);
    writeFileSync(join(dir, 'huge.agent.json'), 'x'.repeat(MAX_MANIFEST_BYTES + 1), 'utf8');
    writeFixtures(dir, ['supervisor.agent.json']);
    await harness.completeSession(run.runId, { ownerStopped: false });

    const collected = harness.service.getRun({ workspaceId: harness.workspaceId })!;
    expect(collected.rejected).toEqual([
      { sourceBasename: 'huge.agent.json', errorCode: 'PROFILE_OVERSIZED' },
    ]);
    expect(collected.outcome).toBe('partial');
  });
});

describe('provenance', () => {
  it('records the commit the run read when the workspace is a Git working tree', async () => {
    const harness = await buildReconHarness({ gitInit: true });
    const run = await startRun(harness);
    expect(run.derivedFromCommit).toBe(harness.headCommit);
    expect(run.derivedFromCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('records absence as null when the workspace is not a Git working tree', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    expect(run.derivedFromCommit).toBeNull();
  });
});

describe('repeat runs', () => {
  it('discards the previous run proposals when a new run starts', async () => {
    const harness = await buildReconHarness();
    const first = await startRun(harness);
    writeFixtures(harness.outputDirOf(first.runId), ['supervisor.agent.json']);
    await harness.completeSession(first.runId, { ownerStopped: false });
    expect(harness.service.getRun({ workspaceId: harness.workspaceId })!.proposals).toHaveLength(1);

    const second = await startRun(harness);
    const current = harness.service.getRun({ workspaceId: harness.workspaceId })!;
    expect(current.runId).toBe(second.runId);
    expect(current.proposals).toEqual([]);
  });

  it('deletes a stale directory left behind by a crash mid-run', async () => {
    const harness = await buildReconHarness();
    // A previous process died before collection could delete its directory.
    const staleDir = harness.outputDirOf('99999999-9999-4999-8999-999999999999');
    mkdirSync(staleDir, { recursive: true });
    writeFixtures(staleDir, ['supervisor.agent.json']);

    const run = await startRun(harness);
    expect(existsSync(staleDir)).toBe(false);
    await harness.completeSession(run.runId, { ownerStopped: false });
    // The stale files were never read as if they belonged to this run.
    expect(harness.service.getRun({ workspaceId: harness.workspaceId })!.outcome).toBe('no_output');
  });
});

describe('takeProposal', () => {
  it('returns a proposal once and then reports it gone', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    writeFixtures(harness.outputDirOf(run.runId), ['supervisor.agent.json']);
    await harness.completeSession(run.runId, { ownerStopped: false });

    const id = harness.service.getRun({ workspaceId: harness.workspaceId })!.proposals[0]!
      .proposalId;
    expect(harness.service.takeProposal(id)).not.toBeNull();
    expect(harness.service.takeProposal(id)).toBeNull();
  });

  it('stamps an accepted proposal with the run it came from', async () => {
    const harness = await buildReconHarness({ gitInit: true });
    const run = await startRun(harness);
    writeFixtures(harness.outputDirOf(run.runId), ['supervisor.agent.json']);
    await harness.completeSession(run.runId, { ownerStopped: false });

    const proposal = harness.service.getRun({ workspaceId: harness.workspaceId })!.proposals[0]!;
    const taken = harness.service.takeProposal(proposal.proposalId)!;
    expect(taken.runId).toBe(run.runId);
    expect(taken.derivedFromCommit).toBe(run.derivedFromCommit);
  });
});

describe('acceptance through the existing profile gate', () => {
  it('imports a proposal only after preview and confirm, stamped with its provenance', async () => {
    const harness = await buildReconHarness({ gitInit: true });
    const run = await startRun(harness);
    writeFixtures(harness.outputDirOf(run.runId), ['supervisor.agent.json']);
    await harness.completeSession(run.runId, { ownerStopped: false });
    const proposal = harness.service.getRun({ workspaceId: harness.workspaceId })!.proposals[0]!;

    const preview = await harness.world.ok<{ previewToken: string; digest: string }>(
      'profiles.previewImport',
      { proposalId: proposal.proposalId },
    );
    expect(preview.digest).toBe(proposal.digest);
    // Nothing is hired by the preview alone.
    expect(
      (await harness.world.ok<{ profiles: unknown[] }>('profiles.list', {})).profiles,
    ).toHaveLength(0);

    const summary = await harness.world.ok<{ profileId: string }>('profiles.confirmImport', {
      previewToken: preview.previewToken,
      importConfirmation: true,
    });
    const row = harness.world.ctx
      .storage!.db.prepare('SELECT recon_run_id, derived_from_commit FROM agent_profiles')
      .get() as { recon_run_id: string; derived_from_commit: string };
    expect(summary.profileId.length).toBeGreaterThan(0);
    expect(row.recon_run_id).toBe(run.runId);
    expect(row.derived_from_commit).toBe(harness.headCommit);
  });

  it('reports a proposal that was already taken as unavailable', async () => {
    const harness = await buildReconHarness();
    const run = await startRun(harness);
    writeFixtures(harness.outputDirOf(run.runId), ['supervisor.agent.json']);
    await harness.completeSession(run.runId, { ownerStopped: false });
    const proposal = harness.service.getRun({ workspaceId: harness.workspaceId })!.proposals[0]!;

    await harness.world.ok('profiles.previewImport', { proposalId: proposal.proposalId });
    const second = await harness.world.call('profiles.previewImport', {
      proposalId: proposal.proposalId,
    });
    expect(second.ok).toBe(false);
    expect(second.ok ? 'OK' : second.error.code).toBe('PROFILE_UNREADABLE');
  });

  it('leaves the file-picker import path unstamped', async () => {
    const harness = await buildReconHarness();
    const manifestPath = join(harness.workspacePath, 'picked.agent.json');
    writeFileSync(manifestPath, RECON_PROPOSAL_FIXTURES[0]!.text, 'utf8');
    harness.world.ctx.profilePicker = { pickFile: async () => manifestPath };

    const chosen = await harness.world.ok<{ fileHandle: string }>('profiles.chooseFile');
    const preview = await harness.world.ok<{ previewToken: string }>('profiles.previewImport', {
      fileHandle: chosen.fileHandle,
    });
    await harness.world.ok('profiles.confirmImport', {
      previewToken: preview.previewToken,
      importConfirmation: true,
    });

    const row = harness.world.ctx
      .storage!.db.prepare('SELECT recon_run_id, derived_from_commit FROM agent_profiles')
      .get() as { recon_run_id: string | null; derived_from_commit: string | null };
    expect(row.recon_run_id).toBeNull();
    expect(row.derived_from_commit).toBeNull();
  });
});

describe('provider authentication', () => {
  it('records provider_unauthenticated rather than a blanket failure', async () => {
    const harness = await buildReconHarness();
    const preview = await harness.service.previewLaunch({
      workspaceId: harness.workspaceId,
      providerId: 'claude-code',
      terminal: TERMINAL,
    });
    harness.world.adapters['claude-code'].readiness.authentication = 'unauthenticated';

    const run = await harness.service.confirmLaunch({
      previewToken: preview.launch.previewToken,
      boundaryConfirmation: true,
    });
    expect(run.outcome).toBe('provider_unauthenticated');
    expect(run.sessionId).toBeNull();
    expect(harness.world.ctx.live.size).toBe(0);
    expect(existsSync(harness.outputDirOf(run.runId))).toBe(false);
  });
});
