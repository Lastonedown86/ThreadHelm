# Contract: Shared Hive Memory

This contract adds local, scope-filtered shared knowledge to the existing typed desktop IPC and
session-scoped provider bridge. Electron main is the only durable writer and search authority.

## Memory scope and authority

- Every entry belongs to exactly one approved workspace or supervisor mission.
- Main derives provider scope from the authenticated session and active mission/lease; callers cannot
  name an arbitrary workspace, mission, author, or revision owner.
- Memory is context, not authority. Search rank, confidence, citations, or supervisor preference cannot
  approve a tool, workspace, process, external action, spend, credential use, or scope change.
- Only deliberately submitted content is stored. Terminal output/input, reasoning, transcripts, hook
  payloads, environment values, provider errors, and workspace files are never mined automatically.

## Entry and revision views

`MemorySummaryView` contains entry/revision IDs, scope summary, kind, status, bounded title, author,
source-reference summaries, confidence metadata, conflict count, and timestamps. It omits the body.

`MemoryDetailView` adds the explicitly requested body, immutable revision lineage, citations, open
conflicts, and lifecycle actions. Deleted revisions contain no title/body/digest/size.

`MemorySearchResultView` contains the summary plus a plain-text excerpt of at most 4 KiB and an
explicit FTS rank. Rank is discovery evidence only.

## Desktop operations

| Operation | Request | Success result | Important failures |
|---|---|---|---|
| `memory.search` | exact workspace/mission scope, text query, optional kind/status filters, cursor, limit 1–20 | bounded result page | scope unauthorized, query invalid, cursor invalid, storage unavailable |
| `memory.get` | entry ID and optional revision ID | `MemoryDetailView` | not found, cross-scope, deleted content |
| `memory.previewPublish` | scope, kind, title/body, source references, confidence | disclosure + one-time token | invalid content/source/scope, credential-like content, quota reached |
| `memory.confirmPublish` | token + explicit durable-content confirmation | new entry/revision view | token expired/replayed, scope changed, conflict requires review |
| `memory.previewSupersede` | entry ID, new content/sources, target revision | exact lineage/conflict disclosure | stale target, cross-scope, invalid content |
| `memory.confirmSupersede` | token | new active/contested revision | token expired/replayed, target changed |
| `memory.retract` | entry/revision ID + reason code | updated lifecycle view | unauthorized author/user action, terminal/deleted |
| `memory.resolveConflict` | conflict ID + resolving revision or explicit unresolved disposition | updated conflict/entry | stale conflict, cross-scope, invalid resolution |
| `memory.requestDeletion` | inactive entry/scope target | deletion disclosure + token | active mission dependency, not found |
| `memory.confirmDeletion` | token + explicit confirmation | content-free lineage view | token expired/replayed, target changed/in use |

## Provider bridge tools

- `threadhelm_memory_search`: searches only the authenticated session's workspace and active mission;
  accepts bounded query/filter/limit and returns attributed excerpts.
- `threadhelm_memory_get`: returns one visible entry/revision by stable ID.
- `threadhelm_memory_propose_revision`: deliberately submits bounded content, kind, sources, and
  confidence. Main derives scope/author and may return `active`, `contested`, or `held`.

Providers cannot delete memory, resolve conflicts, choose another author/scope, change mission policy,
or request vector/semantic retrieval. Worker publication does not automatically complete work.

## Retrieval and conflict policy

- Normalize query whitespace/Unicode without rewriting meaning; use SQLite FTS5 over active content.
- Default results exclude superseded, retracted, expired, and deleted revisions. Contested results are
  opt-in and visibly marked.
- Pagination is stable and bounded to 20 entries with 4 KiB excerpts.
- A deterministic exact-subject/source conflict rule or an explicit participant report can open a
  conflict. No model confidence score silently resolves it.
- Conflict resolution creates a cited revision; competing revisions remain in lineage.

## Retention, deletion, and events

- Scope quotas are enforced transactionally before publish.
- Expiry changes search visibility without deleting content; deletion requires an explicit token and
  removes content plus FTS rows in one transaction.
- Renderer events are content-free: entry/revision/scope IDs, status, kind, author summary, conflict
  count, sequence, and timestamps only.
- No idle polling is required; main emits coalescible typed events after committed transitions.

## Stable errors

- `MEMORY_NOT_FOUND`
- `MEMORY_SCOPE_UNAUTHORIZED`
- `MEMORY_CONTENT_INVALID`
- `MEMORY_SOURCE_INVALID`
- `MEMORY_QUOTA_REACHED`
- `MEMORY_CONFLICT_OPEN`
- `MEMORY_REVISION_STALE`
- `MEMORY_CONTENT_DELETED`
