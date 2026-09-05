import { describe, expect, it } from 'vitest';
import { ErrorCode, RepoIdeaCandidate, operationNames, operations } from '@threadhelm/contracts';

const uuid = '11111111-1111-4111-8111-111111111111';
const ESC = String.fromCharCode(27);

describe('repo idea contract additions', () => {
  it('validates one candidate strictly', () => {
    const candidate = {
      title: 'Fix the flaky CI job',
      rationale: 'Three of the last five commits mention a retry.',
      proposedObjective: 'Make the CI job pass deterministically.',
      proposedCompletionEvidence: 'Ten consecutive green runs.',
    };
    expect(RepoIdeaCandidate.parse(candidate)).toEqual(candidate);
    expect(RepoIdeaCandidate.safeParse({ ...candidate, extra: true }).success).toBe(false);
    expect(RepoIdeaCandidate.safeParse({ ...candidate, title: '' }).success).toBe(false);
    // Model output is untrusted: terminal control sequences never reach a screen.
    expect(RepoIdeaCandidate.safeParse({ ...candidate, title: `x${ESC}[31m` }).success).toBe(false);
  });

  it('names the operation and failure codes', () => {
    expect(operationNames).toContain('missionComposer.proposeRepoIdeas');
    for (const code of ['REPO_IDEAS_UNAVAILABLE', 'REPO_IDEAS_OUTPUT_INVALID']) {
      expect(ErrorCode.safeParse(code).success).toBe(true);
    }
  });

  it('requires exactly three ideas in the response and a workspace id in the request', () => {
    const op = operations['missionComposer.proposeRepoIdeas'];
    expect(op.request.safeParse({ workspaceId: uuid }).success).toBe(true);
    expect(
      op.request.safeParse({ workspaceId: uuid, providerId: 'codex-cli', effort: 'high' }).success,
    ).toBe(true);
    expect(op.request.safeParse({ workspaceId: 'nope' }).success).toBe(false);
    expect(op.request.safeParse({ workspaceId: uuid, model: 'bad model!' }).success).toBe(false);
    const idea = {
      title: 'a',
      rationale: 'b',
      proposedObjective: 'c',
      proposedCompletionEvidence: 'd',
    };
    expect(op.response.safeParse({ ideas: [idea, idea, idea] }).success).toBe(true);
    expect(op.response.safeParse({ ideas: [idea, idea] }).success).toBe(false);
  });
});
