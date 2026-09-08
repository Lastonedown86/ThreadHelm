# Bundled starter content contract

Production-only definitions in the proposed mission-recipe-starters module; stable shipped IDs/revisions, origin bundled, schemaVersion 1. No private personas, brand-specific roles, project paths, profile IDs, runtime defaults or fixture-barrel imports. Each starter is read-only and customizable by personal duplication. Validate these exact proposed texts and their package dependency graph during implementation.

| Name | Purpose | Literal inputs |
|---|---|---|
| Investigate a bug | Establish a reproducible explanation and proposed correction | `symptom` required; `context` optional |
| Review a PR | Assess a supplied change reference and report findings | `pr_reference` required; `review_focus` optional |
| Prepare a release | Assess readiness and describe remaining release work | `release_name` required; `release_scope` optional |

## Investigate a bug

Outcome: Investigate {{symptom}}. Establish reproduction steps, the likely cause and a proposed correction. Additional context: {{context}}

Checklist:

- Record reproduction steps and expected versus observed behavior.
- Explain the likely cause with supporting observations.
- Describe a correction and focused validation, including unresolved uncertainty.

Suggested roles: Investigator: analyze reproduction and cause. Reviewer: challenge the explanation and proposed validation.

## Review a PR

Outcome: Review {{pr_reference}} for correctness, regressions and missing validation. Review focus: {{review_focus}}

Checklist:

- State the reviewed scope and any unavailable material.
- Report actionable findings with supporting references, or explain that none were found.
- Identify validation performed and remaining uncertainty.

Suggested roles: Reviewer: inspect correctness and regression risks. Validation reviewer: assess coverage and evidence gaps.

## Prepare a release

Outcome: Prepare a readiness assessment for {{release_name}}. Scope: {{release_scope}}. Identify remaining checks and proposed release steps for human review.

Checklist:

- Summarize included changes and known limitations.
- Record validation evidence and unresolved release blockers.
- Describe proposed release and rollback steps requiring later authorization.

Suggested roles: Release reviewer: assess readiness and blockers. Validation reviewer: check evidence and rollback preparation.

URLs/references are literal context; no automatic fetching/authentication. Release preparation neither deploys nor merges. Starter actions never start sessions, approve workspaces or assign these suggested roles. Larger supplied values can exceed composer limits even within the 2,000-character value cap; show the resulting field error and retain values.
