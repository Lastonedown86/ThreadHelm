/**
 * Workspace Recon policy: bounded collection and honest outcome
 * classification. Pure functions only — no filesystem, no session access.
 *
 * Design: docs/superpowers/specs/2026-09-02-workspace-recon-design.md
 */

/** A run considers a bounded number of files so a hostile run cannot fan out. */
export const MAX_RECON_FILES = 12;

/** The one filename a run may use to propose the supervisor role. */
export const SUPERVISOR_BASENAME = 'supervisor.agent.json';

export interface ReconSelection {
  readonly considered: readonly string[];
  readonly ignoredForCount: readonly string[];
}

/**
 * Orders by name and takes the first `MAX_RECON_FILES`, so the same output
 * directory always yields the same selection.
 *
 * Selection deliberately takes names alone. Size is not consulted here: the
 * bounded read re-checks it against the open handle and reports
 * `PROFILE_OVERSIZED` itself, so a size read from a directory listing could
 * only ever be a staler copy of a fact the read already establishes — and a
 * file dropped on the strength of a metadata read that failed is a file the
 * run wrote and ThreadHelm then failed to report.
 */
export function selectReconFiles(names: readonly string[]): ReconSelection {
  const ordered = [...names].sort((a, b) => a.localeCompare(b, 'en-US'));
  return {
    considered: ordered.slice(0, MAX_RECON_FILES),
    ignoredForCount: ordered.slice(MAX_RECON_FILES),
  };
}

export type ReconOutcome =
  | 'completed'
  | 'partial'
  | 'no_output'
  | 'unparsable_output'
  | 'stopped_by_owner'
  // Not produced by main today: ThreadHelm has no token accounting. Reachable
  // once a provider reports usage labelled provider-reported or CLI-derived.
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
