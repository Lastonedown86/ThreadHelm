/**
 * Workspace Recon policy: bounded collection and honest outcome
 * classification. Pure functions only — no filesystem, no session access.
 *
 * Design: docs/superpowers/specs/2026-09-02-workspace-recon-design.md
 */

import { MAX_MANIFEST_BYTES } from './agent-profile.js';

/** A run considers a bounded number of files so a hostile run cannot fan out. */
export const MAX_RECON_FILES = 12;

/** The one filename a run may use to propose the supervisor role. */
export const SUPERVISOR_BASENAME = 'supervisor.agent.json';

export interface ReconFileCandidate {
  readonly name: string;
  readonly sizeBytes: number;
}

export interface ReconSelection {
  readonly considered: readonly string[];
  readonly oversized: readonly string[];
  readonly ignoredForCount: readonly string[];
}

/**
 * Orders by name and takes the first `MAX_RECON_FILES`, so the same output
 * directory always yields the same selection. Oversized files stay in
 * `considered` and are reported separately: a file that was too big to read
 * is a rejection with a reason, not a file that silently vanished.
 */
export function selectReconFiles(files: readonly ReconFileCandidate[]): ReconSelection {
  const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, 'en-US'));
  const considered = ordered.slice(0, MAX_RECON_FILES);
  return {
    considered: considered.map((file) => file.name),
    oversized: considered.filter((f) => f.sizeBytes > MAX_MANIFEST_BYTES).map((f) => f.name),
    ignoredForCount: ordered.slice(MAX_RECON_FILES).map((file) => file.name),
  };
}

export type ReconOutcome =
  | 'completed'
  | 'partial'
  | 'no_output'
  | 'unparsable_output'
  | 'stopped_by_owner'
  | 'token_cap_reached'
  | 'provider_unauthenticated';

export interface ReconRunFacts {
  readonly providerUnauthenticated: boolean;
  readonly ownerStopped: boolean;
  readonly tokenCapReached: boolean;
  readonly filesWritten: number;
  readonly parsedCount: number;
  readonly rejectedCount: number;
}

/**
 * Run-level explanations win over output-shaped ones, most specific first:
 * a run that never authenticated explains itself better than one that
 * happens to have written nothing. Proposals are reported separately, so a
 * stopped run that still produced usable manifests keeps them.
 */
export function classifyReconOutcome(facts: ReconRunFacts): ReconOutcome {
  if (facts.providerUnauthenticated) return 'provider_unauthenticated';
  if (facts.ownerStopped) return 'stopped_by_owner';
  if (facts.tokenCapReached) return 'token_cap_reached';
  if (facts.filesWritten === 0) return 'no_output';
  if (facts.parsedCount === 0) return 'unparsable_output';
  return facts.rejectedCount > 0 ? 'partial' : 'completed';
}

/** Role is taken from the filename; a manifest carries no role field and grants no authority. */
export function reconRoleForBasename(basename: string): 'supervisor' | 'specialist' {
  return basename.toLocaleLowerCase('en-US') === SUPERVISOR_BASENAME ? 'supervisor' : 'specialist';
}
