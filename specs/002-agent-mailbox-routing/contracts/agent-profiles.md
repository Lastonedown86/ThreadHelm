# Contract: Reviewed Agent Profiles

This contract imports portable `munder-difflin/hire@1` manifests into a local roster. A manifest is
untrusted data, not an instruction to ThreadHelm, and import is never equivalent to launching or
authorizing an agent.

## Supported manifest

The strict top-level fields are `spec`, `name`, `description`, `provider`, `model`, `goal`,
`capabilities`, `isolate`, `tokenCap`, and `author`. Unknown fields, invalid types, duplicate keys,
oversized files/goals, invalid capability labels, and unsafe numeric values fail validation. The
original goal is displayed as inert text and may later be supplied as disclosed agent context.

`effort` is not part of this schema. It is selected from current provider/session settings at launch.
Capabilities are routing labels, `isolate` is a requested property, and `tokenCap` is a requested
ceiling; none grants tools, workspaces, roles, budget expansion, or consequential authority.

## Preview and confirmation

1. `profiles.previewImport` accepts a renderer file-selection handle, not arbitrary provider input.
2. Main reads at most 64 KiB, strictly parses and normalizes, checks runtime compatibility, computes
   SHA-256, and returns exact fields, warnings, compatibility codes, and a two-minute one-use token.
3. `profiles.confirmImport` re-reads the source and consumes the token only when the digest and
   normalized preview still match. Changed-after-preview files fail closed.
4. The transaction creates an immutable revision or returns the existing digest idempotently. It
   performs no provider installation/configuration, process launch, worktree creation, or role change.

Only the basename is stored for display; the Downloads path is not placed in logs, events, profiles,
or mission records. Raw parse errors are converted to stable safe codes.

## Views and operations

`AgentProfileSummaryView` contains profile ID, current revision ID, display name, concise description,
requested provider/model, compatibility, state, capability labels, isolation request, token-cap
request, author, digest prefix, and timestamps. It omits goal text.

`AgentProfileDetailView` adds the full reviewed goal, exact digest, manifest spec, all compatibility
reasons, and bounded revision history.

| Operation | Request | Result | Important failures |
|---|---|---|---|
| `profiles.previewImport` | selected file handle | normalized preview + token | invalid schema, oversized, unreadable, unsafe value |
| `profiles.confirmImport` | preview token + explicit confirmation | imported summary/revision | expired/replayed, digest changed, profile limit |
| `profiles.list` | state/compatibility filter + cursor | bounded summary page | invalid cursor, storage unavailable |
| `profiles.get` | profile ID | detail view | not found/deleted |
| `profiles.setEnabled` | profile ID + revision ID + enabled | updated summary | incompatible, stale revision, active mission pinned |
| `profiles.previewDelete` | inactive profile ID | deletion disclosure + token | active mission/session reference |
| `profiles.confirmDelete` | deletion token | content-free deleted summary | expired/replayed, state changed |

Events contain only IDs, state, compatibility codes, digest prefix, and timestamps. Goal, description,
source path, provider raw errors, and file content require an explicit detail or preview request.

## Compatibility and assignment

- A supported and currently available provider/model may be marked compatible, but availability is
  rechecked at launch. An unavailable request stays incompatible/disabled; there is no substitution.
- Effective isolation must meet the requested isolation and current ThreadHelm workspace controls.
- The effective token/resource budget is the minimum of manifest request, product limit, user session
  limit, and mission envelope. A manifest can only narrow it.
- Session/mission selection pins an exact active profile revision. Re-import never mutates that pin.
- Worker, supervisor, reviewer, or triage eligibility is a separate user-approved mapping. Marvel
  names, persona text, and capabilities do not assign roles.

### Launch confirmation

Before starting the provider CLI, ThreadHelm shows resolved provider/model/effort plus the separate
runtime permission policy and source. Model, effort, and permission selections directly refresh the
bound preview without another settings-review action; the only checkbox confirms the folder boundary.
Model/effort priority is one-run override > exact profile revision request > task-type/project policy >
CLI default. Permission priority is one-run selection > task/project policy > provider default,
excluding profile/persona/template/mission sources and persisted bypass. Readiness probing and app load
never prompt. Effort and permission policy are launch state and absent from the hire manifest.

## Acceptance roster

Manual acceptance previews/imports the ten supplied Black Panther, Captain America, Doctor Strange,
Maria Hill, Nick Fury, She-Hulk, Shuri, Spider-Man, Vision, and War Machine files and records their
digests/results without copying those user files into the repository. Sanitized repository fixtures
cover the same schema shapes plus malformed, duplicate, hostile-text, unsupported, excessive-bound,
and changed-after-preview cases.
