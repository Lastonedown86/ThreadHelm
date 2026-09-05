/**
 * Repo-idea generation (T-repo-idea-02). A pure read-and-propose call: it
 * never touches a composer draft. The renderer commits a chosen idea's text
 * into a draft itself, through the existing missionComposer.updateDraft.
 *
 * What the model sees is metadata only (spec 2026-09-03 §3): file paths,
 * the README, the root manifest, and recent commit subjects. No other file
 * contents, no diffs, no tools, no workspace cwd.
 */

import {
  operations,
  ThreadHelmError,
  type RepoIdeaCandidate,
  type OperationRequest,
  type OperationResponse,
} from '@threadhelm/contracts';
import type { Context } from '../context.js';
import { runStructuredDraft } from '../providers/structured-draft.js';
import { findWorkspace } from '../workspaces/service.js';
import {
  readFileTree,
  readManifest,
  readReadme,
  readRecentCommitSubjects,
} from './repo-metadata.js';

export interface RepoIdeasService {
  propose(
    request: OperationRequest<'missionComposer.proposeRepoIdeas'>,
  ): Promise<OperationResponse<'missionComposer.proposeRepoIdeas'>>;
}

const MAX_TREE_LINES = 200;

const PROMPT_INSTRUCTIONS = `You are suggesting three small, concrete engineering tasks for the repository described below. Respond with ONLY a JSON object of this exact shape and nothing else, with no prose and no markdown fences:
{"ideas":[{"title":"...","rationale":"...","proposedObjective":"...","proposedCompletionEvidence":"..."},{"title":"...","rationale":"...","proposedObjective":"...","proposedCompletionEvidence":"..."},{"title":"...","rationale":"...","proposedObjective":"...","proposedCompletionEvidence":"..."}]}
Each "title" is under 120 characters. Each "rationale" is one sentence explaining why, grounded in what you were shown below. Each "proposedObjective" is one sentence a coordinator could check off. Each "proposedCompletionEvidence" is one sentence naming the proof.`;

export function buildRepoIdeasPrompt(input: {
  fileTree: string[];
  readme: string | null;
  manifest: { filename: string; contents: string } | null;
  commitSubjects: string[];
}): string {
  const sections = [PROMPT_INSTRUCTIONS];
  sections.push(
    `File tree (${input.fileTree.length} files):\n${input.fileTree.slice(0, MAX_TREE_LINES).join('\n')}`,
  );
  if (input.readme) sections.push(`README:\n${input.readme}`);
  if (input.manifest) sections.push(`${input.manifest.filename}:\n${input.manifest.contents}`);
  if (input.commitSubjects.length > 0) {
    sections.push(`Recent commit subjects:\n${input.commitSubjects.join('\n')}`);
  }
  return sections.join('\n\n');
}

const IdeasShape = operations['missionComposer.proposeRepoIdeas'].response;

/** Untrusted output is validated the same way the mission-composer preview is: strict shape, no repair. */
export function parseRepoIdeas(text: string): RepoIdeaCandidate[] {
  // ponytail: tolerate one ```json fence around the object; anything else is invalid.
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch {
    throw new ThreadHelmError('REPO_IDEAS_OUTPUT_INVALID', 'The model response was not JSON.');
  }
  const shape = IdeasShape.safeParse(parsed);
  if (!shape.success) {
    throw new ThreadHelmError(
      'REPO_IDEAS_OUTPUT_INVALID',
      'The model response did not match the expected shape.',
    );
  }
  return shape.data.ideas;
}

export function createRepoIdeasService(ctx: Context): RepoIdeasService {
  return {
    async propose(request) {
      const workspace = findWorkspace(ctx, request.workspaceId);
      if (workspace.revokedAt) {
        throw new ThreadHelmError('WORKSPACE_NOT_FOUND', 'That workspace is not approved.');
      }
      const root = workspace.canonicalPath;
      const [fileTree, readme, manifest, commitSubjects] = await Promise.all([
        readFileTree(root),
        readReadme(root),
        readManifest(root),
        readRecentCommitSubjects(root),
      ]);
      if (fileTree.length === 0 && !readme && !manifest && commitSubjects.length === 0) {
        throw new ThreadHelmError('REPO_IDEAS_UNAVAILABLE', 'That folder has nothing to read.');
      }
      const prompt = buildRepoIdeasPrompt({ fileTree, readme, manifest, commitSubjects });
      const outcome = await runStructuredDraft(ctx, request.providerId ?? 'codex-cli', prompt, {
        model: request.model ?? null,
        effort: request.effort ?? null,
      });
      if ('held' in outcome) {
        throw new ThreadHelmError('REPO_IDEAS_UNAVAILABLE', "Couldn't generate ideas right now.", {
          reason: outcome.reasonCode,
        });
      }
      return { ideas: parseRepoIdeas(outcome.text) };
    },
  };
}
