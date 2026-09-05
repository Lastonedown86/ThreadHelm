import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWorld, identity } from './helpers/fake-context.js';

const uuid = '11111111-1111-4111-8111-111111111111';

const IDEAS = [
  {
    title: 'Fix the flaky CI job',
    rationale: 'Recent commits mention retries.',
    proposedObjective: 'Make CI deterministic.',
    proposedCompletionEvidence: 'Ten green runs.',
  },
  {
    title: 'Add tests for the auth module',
    rationale: 'No test file matches auth.ts.',
    proposedObjective: 'Cover the auth module with tests.',
    proposedCompletionEvidence: 'A passing test file exists.',
  },
  {
    title: 'Update the stale README section',
    rationale: 'README still describes the old CLI flags.',
    proposedObjective: 'Bring the README in line with the CLI.',
    proposedCompletionEvidence: 'README examples run as written.',
  },
];

describe('missionComposer.proposeRepoIdeas', () => {
  // A real directory: the readers walk it, and the fake native module maps it.
  let repoDir: string;
  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'repo-ideas-'));
    writeFileSync(join(repoDir, 'README.md'), '# Demo\nA small tool.');
    writeFileSync(join(repoDir, 'package.json'), '{"name":"demo"}');
  });
  afterEach(() => rmSync(repoDir, { recursive: true, force: true }));

  async function approvedWorld() {
    const world = createWorld();
    world.addDir(repoDir, { ...identity(1), canonicalPath: repoDir });
    const workspace = await world.approve(repoDir);
    return { world, workspaceId: workspace.id };
  }

  it('returns 3 candidates parsed from the structured-draft response', async () => {
    const { world, workspaceId } = await approvedWorld();
    const prompts: string[] = [];
    world.ctx.structuredDraft = {
      run: async (providerId, prompt, selection) => {
        prompts.push(`${providerId}|${selection?.model ?? ''}|${selection?.effort ?? ''}`);
        prompts.push(prompt);
        return { text: JSON.stringify({ ideas: IDEAS }) };
      },
    };
    const result = await world.ok<{ ideas: unknown[] }>('missionComposer.proposeRepoIdeas', {
      workspaceId,
      providerId: 'claude-code',
      effort: 'low',
    });
    expect(result.ideas).toEqual(IDEAS);
    expect(prompts[0]).toBe('claude-code||low');
    // Metadata only: file names, README and manifest text; never other contents.
    expect(prompts[1]).toContain('README.md');
    expect(prompts[1]).toContain('A small tool.');
    expect(prompts[1]).toContain('"name":"demo"');
  });

  it('strips a markdown fence around otherwise valid JSON', async () => {
    const { world, workspaceId } = await approvedWorld();
    world.ctx.structuredDraft = {
      run: async () => ({ text: '```json\n' + JSON.stringify({ ideas: IDEAS }) + '\n```' }),
    };
    const result = await world.ok<{ ideas: unknown[] }>('missionComposer.proposeRepoIdeas', {
      workspaceId,
    });
    expect(result.ideas).toHaveLength(3);
  });

  it('reports REPO_IDEAS_UNAVAILABLE when the structured draft is held', async () => {
    const { world, workspaceId } = await approvedWorld();
    // Default fake structuredDraft always reports held.
    const result = await world.call('missionComposer.proposeRepoIdeas', { workspaceId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPO_IDEAS_UNAVAILABLE');
  });

  it('reports REPO_IDEAS_OUTPUT_INVALID when the model returns malformed JSON', async () => {
    const { world, workspaceId } = await approvedWorld();
    world.ctx.structuredDraft = { run: async () => ({ text: 'not json' }) };
    const result = await world.call('missionComposer.proposeRepoIdeas', { workspaceId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPO_IDEAS_OUTPUT_INVALID');
  });

  it('reports REPO_IDEAS_OUTPUT_INVALID when the shape is wrong (two ideas)', async () => {
    const { world, workspaceId } = await approvedWorld();
    world.ctx.structuredDraft = {
      run: async () => ({ text: JSON.stringify({ ideas: IDEAS.slice(0, 2) }) }),
    };
    const result = await world.call('missionComposer.proposeRepoIdeas', { workspaceId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPO_IDEAS_OUTPUT_INVALID');
  });

  it('rejects an unknown or revoked workspace without calling the provider', async () => {
    const { world, workspaceId } = await approvedWorld();
    let calls = 0;
    world.ctx.structuredDraft = {
      run: async () => {
        calls += 1;
        return { text: JSON.stringify({ ideas: IDEAS }) };
      },
    };
    const unknown = await world.call('missionComposer.proposeRepoIdeas', { workspaceId: uuid });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe('WORKSPACE_NOT_FOUND');
    await world.ok('workspaces.revoke', { workspaceId });
    const revoked = await world.call('missionComposer.proposeRepoIdeas', { workspaceId });
    expect(revoked.ok).toBe(false);
    if (!revoked.ok) expect(revoked.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect(calls).toBe(0);
  });

  it('never touches a composer draft', async () => {
    const { world, workspaceId } = await approvedWorld();
    world.ctx.structuredDraft = { run: async () => ({ text: JSON.stringify({ ideas: IDEAS }) }) };
    await world.ok('missionComposer.proposeRepoIdeas', { workspaceId });
    const drafts = await world.ok<{ drafts: unknown[] }>('missionComposer.listDrafts');
    expect(drafts.drafts).toEqual([]);
  });
});
