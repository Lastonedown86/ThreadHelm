# Data Model: ThreadHelm Local Agent Workspace MVP

**Feature**: `001-local-agent-workspace`
**Date**: 2026-08-28

ThreadHelm persists only the minimum structured metadata needed to explain approvals, lifecycle
transitions, controls, failures, and recovery. Raw terminal input/output, prompts, environment
values, credentials, tokens, and provider probe output are never stored.

## Durable entities

### ApprovedWorkspace

Represents a user-approved effective Windows directory, identified independently of its display
spelling.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `selectedPath` | string | Path selected through the native picker; display only |
| `canonicalPath` | string | Final path obtained from an opened directory handle |
| `volumeSerial` | string | Unsigned volume serial encoded without path-derived ambiguity |
| `fileId` | string | `FILE_ID_INFO` identifier encoded as fixed-width hex |
| `driveType` | enum | MVP accepts `fixed_local` only |
| `approvedAt` | timestamp | UTC |
| `lastValidatedAt` | timestamp | Updated only after handle-based revalidation |
| `revokedAt` | timestamp nullable | Cannot be set while an associated session is active |

**Identity constraint**: unique active approval on (`volumeSerial`, `fileId`). Different path strings
that resolve to this pair represent the same effective workspace.

### AgentDefinition

Describes a built-in, application-owned provider adapter. Definitions are shipped with ThreadHelm;
user-authored `.agent` files are outside the MVP.

| Field | Type | Rules |
|---|---|---|
| `id` | enum | `codex-cli` or `claude-code` |
| `displayName` | string | User-facing provider name |
| `providerKind` | enum | Stable adapter discriminator |
| `executableCandidates` | structured list | Trusted locations/names; never supplied by renderer |
| `testedVersionRange` | version constraint | Rechecked by the adapter before launch |
| `capabilities` | structured flags | Interactive PTY, clean-stop strategy, structured activity support |

No secrets, credentials, user prompts, or arbitrary command-line arguments belong in this entity.

### AgentReadinessSnapshot

A bounded, sanitized result from a provider preflight. A launch always creates a fresh snapshot.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `providerId` | foreign key | References `AgentDefinition.id` |
| `resolvedExecutable` | string | Absolute trusted executable path; UI may abbreviate it |
| `version` | string nullable | Parsed normalized version only |
| `availability` | enum | `available`, `missing`, `unsupported`, `unauthenticated`, `error` |
| `authentication` | enum | `authenticated`, `unauthenticated`, `unknown` |
| `probedAt` | timestamp | UTC |
| `reasonCode` | enum nullable | Stable actionable classification |
| `safeSummary` | string | Adapter-created allowlisted message; never raw probe output |

### AgentSession

The durable identity and last-known state of one attempted agent run.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Generated before OS process creation |
| `workspaceId` | foreign key | Approved effective workspace |
| `definitionId` | foreign key | Built-in provider adapter |
| `readinessSnapshotId` | foreign key | Preflight used for this launch attempt |
| `accessMode` | enum | `write_capable` in MVP; retained for policy evolution |
| `lifecycleState` | enum | See lifecycle state machine |
| `activityState` | enum | `unknown`, `working`, `idle`, `awaiting_user` |
| `activityEvidenceKind` | enum | `none` or adapter-defined structured evidence |
| `activityObservedAt` | timestamp nullable | Required for any non-unknown activity |
| `hostPid` | integer nullable | Diagnostic only; never sufficient for recovery/reattach |
| `rootPid` | integer nullable | Diagnostic only; never a durable authority token |
| `columns`, `rows` | integer | Last safe terminal dimensions |
| `startedAt` | timestamp nullable | Set when supervised provider launch succeeds |
| `endedAt` | timestamp nullable | Required for a terminal lifecycle state |
| `exitCode` | integer nullable | Provider exit code when observed |
| `stopKind` | enum nullable | `clean`, `interrupted_exit`, `forced`, `crash_cleanup` |
| `truncationCount` | integer | Count of disclosed output-loss events, not raw content |
| `createdAt`, `updatedAt` | timestamp | UTC |

### SessionEvent

An append-only, human-explainable history of structured session facts.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `sessionId` | foreign key | Parent session |
| `sequence` | integer | Strictly increasing within a session |
| `kind` | enum | `launch_requested`, `launched`, `state_changed`, `interrupt_requested`, `stop_requested`, `force_stop_requested`, `output_truncated`, `reconciled`, `recovery_resolved` |
| `fromState`, `toState` | enum nullable | Required for lifecycle transitions |
| `actor` | enum | `user`, `threadhelm`, `provider`, `windows` |
| `reasonCode` | enum nullable | Stable machine-readable explanation |
| `safeSummary` | string | Allowlisted metadata only |
| `occurredAt` | timestamp | UTC |

The event model records that input or output activity occurred when operationally useful, never its
content.

### RecoveryRecord

Explains why a prior session cannot be treated as cleanly complete after startup reconciliation.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `sessionId` | foreign key unique | One unresolved record per session |
| `lastKnownState` | lifecycle enum | State found during startup |
| `classification` | enum | `interrupted_start`, `unexpected_shutdown`, `incomplete_stop`, `storage_repair`, `observation_lost` |
| `reasonCode` | enum | Stable actionable cause |
| `safeSummary` | string | Human-readable and sanitized |
| `createdAt` | timestamp | UTC |
| `resolvedAt` | timestamp nullable | Set after explicit dismissal or replacement launch |
| `resolution` | enum nullable | `dismissed`, `superseded_by_new_session` |

## Volatile runtime models

These models are intentionally never sufficient for restart reattachment.

### ControllerLease

- Single Electron instance token obtained before database or supervisor initialization.
- Map keyed by workspace (`volumeSerial`, `fileId`) for active write-capable sessions.
- A lease is acquired atomically before `starting` and released only after verified process-scope
  termination or launch rollback.

### ProcessScope

- Session ID, opaque Job Object handle, utility PID, provider root PID, creation phase, and verified
  membership state.
- Only the Electron main process holds the Job Object handle.
- A process is considered contained only after Windows reports successful assignment and membership.

### TerminalStreamState

- Session ID, next output sequence, highest acknowledged sequence, unacknowledged byte count,
  high/low watermark state, terminal dimensions, input/control queue, and truncation indicator.
- Scrollback is capped at 10,000 lines in xterm.js.
- Unacknowledged output is capped at 8 MiB per session. Backpressure pauses and resumes the PTY;
  any unavoidable discard increments `truncationCount` and emits a disclosure event.

## Relationships

```text
ApprovedWorkspace 1 ─── * AgentSession * ─── 1 AgentDefinition
                              │
                              ├── 1 AgentReadinessSnapshot
                              ├── * SessionEvent
                              └── 0..1 unresolved RecoveryRecord
```

An `AgentReadinessSnapshot` is immutable. A new launch request must not reuse it as readiness
authority; the adapter produces a new snapshot after all launch-time rechecks.

## State machines

### Lifecycle state

Authoritative lifecycle states are:

```text
starting → running → interrupting → running
    │         │            └──────→ stopped | failed
    │         ├──→ stopping ──────→ stopped | failed
    │         ├──→ stopped
    │         └──→ failed
    └────────────→ failed

starting | running | interrupting | stopping
    └── on startup reconciliation → recovery_required

recovery_required ── explicit resolution → stopped
```

- `starting` is persisted before any process is created.
- `stopped`, `failed`, and resolved recovery records are terminal for that session identity; a retry
  creates a new session.
- `interrupting` may return to `running` when the provider remains interactive.
- `stopping` rejects further terminal input.
- Startup never infers `stopped` or `completed` from a stale PID.

### Activity state

Activity is orthogonal to lifecycle. It defaults to `unknown` and may become `working`, `idle`, or
`awaiting_user` only when a version-compatible adapter supplies documented structured evidence.
Terminal text, prompt-shaped output, quiet timers, CPU usage, and process existence are not activity
evidence. Unsupported or stale evidence returns the state to `unknown`.

## Cross-entity invariants

1. Only one active write-capable session may hold the same (`volumeSerial`, `fileId`) lease.
2. Launch requires a non-revoked workspace whose current handle-based identity matches approval.
3. Launch requires a fresh readiness snapshot with `availability = available`; authentication must
   not be `unauthenticated`.
4. Provider launch is illegal until the utility process is assigned to and verified in its Job
   Object.
5. Every lifecycle mutation and user control intent is committed atomically with its `SessionEvent`.
6. A session terminal state requires that the Job Object is observed empty or has been terminated
   and verified empty.
7. Force stop requires a distinct user confirmation bound to the displayed session identity.
8. Revocation is rejected while any non-terminal session references the workspace.
9. Renderer-supplied paths, executable names, arguments, event summaries, and state values are not
   accepted as authority.
10. Durable free-text summaries are produced only from fixed templates and allowlisted values.

## Persistence and privacy classification

| Data class | Persistence | Notes |
|---|---|---|
| Workspace identity and approval | Durable | Needed for scoped authority and alias detection |
| Provider ID, normalized version/readiness, trusted executable path | Durable | Supports explanation and stale-preflight audit |
| Lifecycle states, timestamps, exit codes, control kinds | Durable | Supports recovery and human-readable history |
| Process IDs | Durable diagnostic | Never used alone as authority after restart |
| Terminal dimensions and truncation count | Durable | Supports safe restoration/disclosure |
| Terminal output bytes and scrollback | Memory only | Cleared when the session/app ends |
| Terminal input and prompts | Memory only | Never logged or replayed |
| Environment variables and credentials | Never collected/persisted | Provider inherits only adapter-approved environment handling |
| Raw version/auth probe output | Discard immediately | Normalize to readiness enums and safe reason codes |

## Migration and startup recovery

- Main process is the sole SQLite owner. Migrations run transactionally before supervision starts.
- Foreign keys are enabled, `synchronous=FULL`, and rollback-journal recovery is checked on startup.
- An unsupported future schema version blocks writes and preserves the database unchanged.
- After migrations, all unfinished lifecycle states are transactionally changed to
  `recovery_required` with a corresponding `RecoveryRecord` and `SessionEvent`.
- Database corruption or unreadability enters an explicit recovery screen; ThreadHelm preserves the
  original file and does not silently create a clean history in its place.
