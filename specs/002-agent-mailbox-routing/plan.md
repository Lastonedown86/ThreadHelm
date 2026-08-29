# Implementation Plan: Durable Hive Coordination

**Branch**: `002-agent-mailbox-routing` | **Date**: 2026-08-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-agent-mailbox-routing/spec.md`

## Summary

Add a durable local hive coordination plane to ThreadHelm: addressed mailboxes, auditable replies,
shared memory, a reviewed portable agent roster, a compact agent/template wizard, and a bounded autonomous supervisor, without Munder Difflin's office simulation or
graphics-heavy memory graph. Electron main remains the sole router, policy authority, lease manager,
and persistence writer. An ordinary replaceable supervisor agent may decompose, assign, monitor,
retry, and reassign routine work only inside a user-approved mission envelope. Shared memory is
revisioned, provenance-rich, and scope-filtered in SQLite with deterministic text retrieval; it does
not ingest transcripts. Provider agents interact through session-scoped typed tools, while uncertain
delivery and consequential authority continue to fail closed.

## Technical Context

**Language/Version**: TypeScript 7 on Node.js 22+; React 19; Rust stable/MSVC for the existing native
Windows package and its packaged coordination helper binary

**Primary Dependencies**: Electron 44, electron-vite 5, Zod 4, better-sqlite3 13, node-pty 1.1,
xterm.js 6, existing `@threadhelm/*` workspace packages; provider CLIs remain Codex CLI and Claude
Code

**Storage**: Existing main-owned SQLite database under ThreadHelm user data; migration v2 adds
conversations, handoffs, delivery attempts, coordination events, and escalations, and migration v3
adds memory entries/revisions/links, agent profiles/revisions/templates/drafts, plus missions/work items/decisions/leases. SQLite FTS5 indexes
active shared-memory text. No Git hive, project files, provider transcript, or terminal scrollback is
used as coordination storage.

**Testing**: Vitest unit/contract/property tests, deterministic memory relevance/scope fixtures,
sequential Windows mission/fault integration tests with fixture agents and bridge, Playwright
Electron end-to-end tests, Cargo tests for the packaged bridge, and separate credentialed
Codex/Claude smoke tests

**Target Platform**: Supported Windows 11 client releases, x64 and ARM64 installed artifacts

**Project Type**: Windows desktop application with typed renderer/main IPC, one utility process and
PTY per agent session, a main-owned local database, and a small session-scoped native stdio bridge

**Performance Goals**: With four sessions and 100 queued handoffs, 95% of user operations receive a
visible acknowledgement within one second; 95% of bounded searches across 10,000 memory revisions
return within 500 ms; coordination/mission recovery is visible within five seconds; 1,000 duplicate
or retry attempts produce zero duplicate logical deliveries; idle coordination UI does not poll or
render continuously

**Constraints**: Local-only; one recipient per handoff; explicit target, persistence, memory, and
mission-envelope disclosure; no raw terminal/transcript capture; no recovery-time auto-restart,
replay, or uncertain resend; no readiness inference from silence, terminal text, timers, CPU, or
process existence; supervisor and renderer receive no generic IPC, database, filesystem, credential,
terminal, or process authority; concurrent write-capable workspace leases remain enforced

**Scale/Scope**: One Windows user, four or more concurrent sessions, up to 100 open conversations,
128 handoffs per conversation, 16 KiB UTF-8 per handoff body, 64 MiB retained coordination content,
10,000 active memory revisions per workspace/mission, 100 imported/created agent profiles, 100 user templates, 20 drafts, four concurrent missions, 64 work items per
mission, four workers per mission by default, reply/decomposition depth eight, and exactly one
recipient per logical handoff

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

| Constitutional obligation | Plan evidence | Gate |
|---|---|---|
| Windows-first, local-first | SQLite, named pipes, ConPTY/session hosts, packaged helper, and Windows lifecycle tests remain local; no hosted plane or external broker is introduced. | PASS |
| Orchestration over visual theater | The feature delivers addressed work, shared knowledge, mission decomposition, assignment, recovery, and escalation. No avatar, office, topology graph, scenery, or decorative-motion work is planned. | PASS |
| Restrained, adaptable interface | Coordination uses compact panels, wizard steps/forms, tables/lists, status badges, text detail, filters, confirmation dialogs, and accessible timelines. Domain contracts do not depend on renderer layout. | PASS |
| Explicit and safe local control | Short-lived tokens bind manual dispatch and mission creation to exact scope. Main validates every supervisor tool against the approved envelope; messages, memory, and supervisor prose grant no new authority. | PASS |
| Observable, testable, recoverable work | State machines, attempts, memory revisions, mission decisions/leases, sanitized events, unknown-delivery recovery, loop bounds, deletion, and Windows fault cases have unit, contract, integration, and end-to-end coverage. | PASS |
| Provider isolation | Provider coordination is capability-gated behind an adapter contract; one unavailable or unproven provider degrades to manual delivery without affecting other sessions. | PASS |
| Privacy and secret handling | Only deliberately confirmed handoff/memory content and explicitly saved profile/template/draft fields are durable. Terminal input/output, environment values, transcripts, hook payloads, credentials, export paths, and raw errors are excluded from broad logs/events. Known credential-like content is blocked before confirmation. | PASS |
| Accessibility and rendering cost | Every primary action is keyboard operable with visible focus and accessible names; live regions are bounded; mission/memory status uses text and tables with no topology graph, idle polling, or animation. | PASS |

### Post-design re-check

Phase 1 keeps orchestration-domain state in `packages/domain`, storage in `packages/persistence`, and
authority in Electron main. The renderer remains replaceable. Profile/template/wizard flows are
named main-owned operations and expose no provider tool. The session-scoped bridge exposes a closed
set of mailbox, memory, and supervisor operations, has no database or workspace access, and is
authenticated to one live session/role. The supervisor is autonomous only within an exact mission
envelope, so no constitutional exception or amendment is required.

## Architecture

### Runtime topology

```text
Renderer command center (compact lists, tables, text detail)
  │ named, schema-validated operations and sanitized events
  ▼
Electron main — sole coordination authority and SQLite writer
  ├── coordination state machines + quota/loop/authority policy
  ├── durable conversations/handoffs/attempts/events
  ├── revisioned shared memory + FTS index
  ├── reviewed agent-profile registry + immutable revisions
  ├── versioned template library + resumable wizard drafts
  ├── mission/work-item/decision/lease policy
  ├── short-lived disclosure and presentation tokens
  ├── explicit delivery ──► existing ordered session control queue ──► PTY
  └── session-scoped named pipe
          ▲
          │ bounded authenticated bridge protocol
packaged coordination bridge (one provider-spawned stdio MCP process per session)
          ▲
          │ mailbox · memory · mission/supervisor tools
Codex CLI or Claude Code workers + one ordinary supervisor session
```

The renderer never sends terminal bytes directly for a handoff. It requests a preview, confirms the
durable artifact, requests a presentation disclosure, and confirms presentation. Main revalidates
the recipient, workspace approval, lifecycle, content bounds, delivery state, and token snapshot
before entering the existing per-session control queue.

The local coordination bridge is introduced for P2. It is a small binary built from the existing
Rust native package and configured per session through provider-supported launch settings. It speaks
bounded JSON-RPC/MCP over provider stdio and a session-scoped Windows named pipe to main. The bridge
has no direct SQLite, filesystem, shell, terminal, credential, or cross-session access. Main derives
sender identity from the authenticated session; the agent cannot assert another sender.

P5 extends the same bridge with scoped memory query/publish operations. P6 adds reviewed local hire
profiles without adding provider tools. P7 adds local templates and a creation wizard, also without
provider tools. P8 adds supervisor-only typed
mission operations. Main authenticates the session role and validates each operation against the
mission envelope; the supervisor never becomes a second router, writer, process controller, or
authority source.

### Milestone delivery

| Milestone | Technical slice | Exit gate |
|---|---|---|
| P1 — Directed handoffs | Domain state, migration v2, typed IPC, confirmation UI, manual presentation through the ordered session-control path, crash-safe attempt ledger, cancellation/retargeting, and fixture coverage | One recipient only; exact target revalidation; no duplicate dispatch after retry/crash; uncertain dispatch held for user action; installed Windows flow passes |
| P2 — Auditable conversations | Causal reply/outcome records, conversation view, content deletion, packaged session-scoped coordination bridge, and provider launch configuration for Codex/Claude | Structured reply is bound to authenticated session and original handoff; transport and work outcome remain separate; restart/deletion/accessibility gates pass |
| P3 — Lifecycle-aware delivery | Provider capability contract plus version-specific lifecycle adapters; safe-point nudge/drain and manual fallback | No timer, prompt-regex, output-text, CPU, or process-existence readiness claims; each supported automatic path has a provider-version proof; every unsupported path remains manual |
| P4 — Bounded coordination | Per-conversation opt-in, reply-depth/equivalent-message/repeated-failure bounds, held-message policy, escalation disposition, and consequential-action pause | Depth eight, exact normalized-repeat threshold three, repeated failure threshold three, and authority-required message kinds pause before presentation; human acceptance is mandatory |
| P5 — Shared hive memory | Migration v3 memory entries/revisions/links, scoped deterministic FTS, typed bridge/IPC operations, conflict/supersede/retract/expire/delete policy, and compact search/detail views | Cross-scope leakage is zero; every result is attributable; conflicts are preserved; transcript/secret ingestion is absent; 10,000-revision performance and restart/deletion gates pass |
| P6 — Reviewed agent roster | Strict `munder-difflin/hire@1` preview/import, digest-bound confirmation, compatibility/revision state, enable/disable controls, sanitized fixtures, and compact roster UI | Ten supplied Marvel profiles import exactly; malformed/changed inputs fail closed; unsupported profiles remain disabled; import grants no authority and launches nothing |
| P7 — Agent wizard and templates | Versioned generic/user templates, resumable drafts, step validation, exact JSON/compatibility review, save-as-profile, and collision-safe export | 90% create a valid agent within five minutes; every result passes import validation; restart/stale-template/write failure is honest; no wizard action launches or grants authority |
| P8 — Autonomous supervisor | Mission envelopes, supervisor role/capability, work-item DAG, reviewed-profile selection, write leases, structured decisions, event-driven loop, known-safe retry/reassignment, and mission/task status views | 100% of assignments stay within envelope and approved profile revision; conflicting leases and equivalent-decision loops stop; uncertain actions never replay; consequential branches require exact human approval |

### Delivery and recovery protocol

1. `previewHandoff` validates source/recipient sessions, active approvals, one-recipient scope,
   content/retention bounds, and credential-like content; it returns a two-minute disclosure token.
2. `confirmHandoff` revalidates the snapshot and transactionally creates the conversation/handoff in
   `queued`; it performs no terminal side effect.
3. `requestPresentation` returns a second disclosure bound to the recipient's current lifecycle,
   workspace identity, activity evidence, exact normalized envelope, and delivery risk.
4. `confirmPresentation` transactionally records a `prepared` attempt, advances it to `dispatching`,
   and submits one ordered `host.input` control carrying the stable handoff ID and normalized body.
5. `host.controlApplied` advances the attempt to `applied` and the handoff to `delivered`. A provider
   bridge acknowledgement may later advance it to `acknowledged`; neither state means work completed.
6. A known pre-write failure may return the same logical handoff to `manual_actionable`. A crash or
   lost acknowledgement while `dispatching` becomes `unknown`/`manual_actionable` at recovery and is
   never automatically resent to that session.
7. A structured provider outcome updates the separate work outcome. Retargeting preserves the old
   attempt history and requires a new exact-target disclosure.

### Shared memory protocol

1. `memory_search` derives the caller's approved workspace/mission scopes, applies status/kind filters,
   executes a bounded FTS query, and returns attributed excerpts plus opaque cursors; it never searches
   deleted content or another scope.
2. `memory_propose_revision` validates deliberate content, sources, scope, quota, and credentials;
   main creates an immutable revision and either activates it, marks it contested, or holds it for
   review according to deterministic conflict rules.
3. Supersede/retract/expire/delete are explicit attributable transitions. Deletion removes content and
   its FTS row in one transaction while retaining content-free lineage and audit evidence.
4. Search ranking may help discovery but never decides truth, resolves a conflict, grants authority,
   or changes a mission/work item automatically.

### Reviewed agent-profile import protocol

1. The user selects one or more `.hire.json` files. Main reads a bounded file, parses strict
   `munder-difflin/hire@1` data, normalizes only documented fields, computes SHA-256, and returns a
   preview containing exact values, validation errors, compatibility reasons, and a two-minute token.
2. `confirmAgentProfileImport` re-reads the file, re-computes its digest, rejects changed-after-preview
   content, and transactionally stores an immutable revision plus current profile state. It launches
   no process and changes no provider, workspace, tool, role, or mission authority.
3. Goal/persona text and capability labels remain untrusted context. Provider/model, effective
   isolation, token/resource ceiling, effort, tool registry, workspace, and mission role are resolved
   separately at launch or mission confirmation; unsupported provider/model requests stay disabled.
4. Re-import creates a revision instead of overwriting history. Duplicate digests are idempotent;
   conflicting names or changed content require review. Disable/delete never mutates an active
   mission's pinned profile revision.

### Agent wizard and template protocol

1. The wizard creates a local draft from blank fields, a versioned generic starter, a user template,
   or a reviewed profile revision. Copy-on-create pins provenance; later template edits do not mutate it.
2. Identity, goal, capabilities, runtime requests, isolation/budget, and review steps validate their
   bounded fields independently. Draft autosave is main-owned, content-isolated, and recoverable after restart.
3. Templates contain only manifest field scaffolds plus declared literal text variables. Substitution
   is schema-bound and previewed; no expression, script, tool, environment, workspace, or file access exists.
4. Final review renders the exact strict manifest and compatibility result. Save-as-profile uses the
   same digest/revision confirmation path as import; export uses an explicit target, atomic write,
   collision/change recheck, and separate overwrite confirmation. Neither action launches a session.

### Autonomous supervisor loop

1. The user previews and confirms a mission envelope bound to exact objective, scopes, eligible
   profiles, limits, routine actions, stop rules, supervisor session/profile, and any per-worker
   automatic-start bindings. Each binding includes the exact pinned profile revision, workspace,
   provider/model/effort, effective isolation/resource limits, and folder-access boundary.
2. Main starts or binds one ordinary supervisor session and exposes only supervisor-role tools for
   that mission. The supervisor inspects structured mission, roster, mailbox, outcome, and memory views.
3. The supervisor proposes a bounded work DAG. Main validates depth/count/dependencies/scope and
   records each accepted decision before making work assignable.
4. Assignment reserves a main-owned worker/workspace lease, then routes one addressed handoff. If no
   matching worker session is active, the supervisor may request startup only for an exact binding
   pre-authorized by the mission envelope. Main revalidates the launch tuple, owns an idempotent
   process start, and binds the reservation to the resulting session before delivery; drift, failure,
   or unavailable capacity holds the branch with no substitution. A worker can accept, report outcome,
   publish memory, or escalate but cannot mutate the mission ledger or select a return recipient. Main
   persists each structured outcome and deliberate artifact/evidence reference and routes it to the
   bound supervisor's mission inbox for synthesis.
5. Durable events wake the supervisor at proved safe points. Main permits known-safe retry or
   reassignment only within attempt/budget bounds and never replays an unknown external action.
6. Invalid output, equivalent decisions, lease conflict, budget exhaustion, supervisor loss, or a
   consequential request pauses only the affected branch or mission and creates an exact user action.
7. Restart restores durable state but launches or resumes nothing until the user explicitly resumes
   the mission and a valid supervisor session is re-established.

### Provider coordination seam

- P1 requires no provider lifecycle hook and works through explicit user presentation.
- P2 supplies an ephemeral, app-data-owned MCP configuration at launch; no user, global, project, or
  repository configuration is edited. Provider launch disclosures identify the additional local tool.
- Through P4, the bridge exposes only `list_pending`, `acknowledge`, `reply`, and `report_outcome`. A
  reply target is derived from `inReplyTo`; there is no arbitrary recipient or broadcast tool.
- P3 automatic presentation is enabled only when a version-compatible adapter proves a structured
  turn/safe-point event. Claude `Stop` hooks and Codex lifecycle/app-server events are research-backed
  candidates, not assumed parity. Provider policy or hook failure disables automation for that
  session and surfaces the manual path.
- P4 automatic continuation is opt-in per conversation. Informational, response, completion,
  refusal, and failure acts may continue within bounds. New request, query, proposal, conflict,
  authority-required, or unknown acts are held for the user. Free text is never treated as a reliable
  authority classifier.
- P5 adds `memory_search`, `memory_get`, and `memory_propose_revision`. Main derives the caller and
  scope, rejects cross-scope access, and never imports a transcript or workspace file implicitly.
- P6 and P7 add no provider bridge capability; profile import, templates, drafts, and export are
  renderer-to-main reviewed workflows.
- P8 grants only the authenticated supervisor role `mission_inspect`, `work_decompose`,
  `work_assign`, `work_reassign`, `work_pause`, `mission_complete`, and `mission_escalate`. Main owns
  IDs, eligibility, leases, bounds, process actions, and state transitions; workers cannot invoke
  supervisor tools and the supervisor cannot bypass mailbox/memory contracts.

### Trust and privacy boundaries

- Handoff bodies are untrusted plain text. C0 controls other than tab/newline, escape sequences,
  NUL, binary data, and oversized input are rejected before preview. The displayed final envelope is
  the payload submitted.
- The coordination database stores confirmed bodies, not terminal scrollback or provider transcripts.
  Purpose/body/fingerprint/size are nulled on confirmed inactive-conversation deletion; only
  content-free IDs, types, states, timestamps, reason codes, and safe summaries remain.
- Shared memory stores only deliberately published content and source references. Superseded,
  retracted, expired, and deleted revisions are excluded from normal search; confirmed deletion
  removes content and FTS rows while retaining content-free lineage.
- Neither logs nor renderer events contain hidden bridge tokens, named-pipe names, provider raw
  payloads, body-derived hashes, message bodies outside the requested conversation view, or stack traces.
- The bridge credential is random, session-bound, short-lived, passed only to the child bridge, and
  invalidated when its session ends. Main validates it on every request and scopes all data to that
  session.
- A coordination message is context, not authority. Existing provider permission and ThreadHelm
  process/workspace controls remain authoritative. Automatic routing cannot alter workspace approval,
  change provider permissions, or execute a consequential operation. P8 alone may ask main to start
  an exact worker binding already confirmed in the mission envelope; no message or persona text grants
  that permission.
- A hire manifest is also context, not authority. Its name, goal, capabilities, provider/model,
  isolation request, and token cap cannot grant tools, expand workspace/mission scope, select a role,
  or raise a product budget. Source paths and goal text never enter broad logs or renderer events.
- A mission envelope is the supervisor's maximum authority, not a suggestion. Supervisor prose,
  memory content, model confidence, or a worker request cannot expand it. Main may start an approved
  worker during an active mission only from its exact pre-authorized profile-revision/runtime/workspace
  binding, after current-state revalidation, and must expose the target and resulting state. There is
  no model/runtime/workspace substitution, and startup recovery never launches or resumes work
  automatically.

### Fixed planning bounds

| Bound | Value | Behavior at limit |
|---|---:|---|
| Recipient count | 1 | Separate review and logical handoff required for every additional recipient |
| Purpose | 160 Unicode scalar values | Preview rejected with actionable validation error |
| Body | 16 KiB UTF-8 | Preview rejected before persistence or terminal submission |
| Open conversations | 100 | New conversation blocked; user directed to resolve/close existing work |
| Handoffs per conversation | 128 | Conversation paused and escalated |
| Retained body content | 64 MiB total | New content blocked; user directed to delete inactive conversation content |
| Automatic reply depth | 8 | Ninth automatic delivery is held and escalated |
| Equivalent-message loop | Same normalized kind/sender/recipient/body fingerprint 3 times within the latest 8 handoffs | Conversation paused before the third equivalent item is presented |
| Consecutive delivery failures | 3 | Conversation paused; no automatic retry |
| Preview/presentation token | 2 minutes, one use | Expired or replayed token requires a fresh disclosure |
| Active memory revisions | 10,000 per workspace/mission | New publish held until content is superseded, expired, or deleted |
| Memory result page | 20 entries, 4 KiB excerpt each | Caller must paginate explicitly |
| Imported agent profiles | 100 active profiles | Further import is blocked until a profile is disabled/deleted |
| User templates | 100 active templates and 32 revisions each | Further save is blocked until a template is disabled/deleted |
| Wizard drafts | 20 active drafts, one MiB total | New draft blocked until another is completed/deleted |
| Template variables | 16 declared text variables, 256 Unicode scalars each | Invalid/unknown variable or unresolved value blocks final review |
| Hire manifest/goal | 64 KiB file; 4,000 Unicode scalar values in `goal` | Preview rejects oversized input before persistence |
| Hire capabilities | 64 distinct normalized labels | Preview rejects excess or invalid labels |
| Hire token cap | Positive integer at or below schema maximum `1e10`, further reduced by product/mission policy | Import rejects invalid values; launch never raises its effective budget |
| Active missions | 4 | New mission blocked until another is completed, cancelled, or archived |
| Work items per mission | 64 | Further decomposition pauses and escalates |
| Decomposition depth | 8 | Deeper work is held for user review |
| Concurrent workers | 4 by default; user may lower within product maximum | Assignment remains queued |
| Attempts per work item | 3 known-safe attempts | Item pauses; uncertain attempts never consume an automatic replay |
| Equivalent supervisor decision | 3 matching normalized decisions within latest 8 | Mission branch pauses and escalates |
| Mission elapsed/resource budget | Required in every envelope | No new assignments after limit; running sessions remain controllable |

## Story Execution Model Decision

All assignments stay within ChatGPT/OpenAI, Anthropic Claude, and Google Antigravity. Exact account
availability is rechecked immediately before a story starts: current Codex app inventory for OpenAI,
`/model` and `/status` for Claude Code, and `agy models` for Antigravity. A missing approved model
leaves the story unassigned until its listed in-ecosystem fallback is verified; no fourth ecosystem
is substituted.

| Story | Primary owner and effort | In-ecosystem fallback | Role and rationale | Usage/cost tradeoff | Independent verification responsibility |
|---|---|---|---|---|---|
| P1 Directed handoffs | OpenAI `gpt-5.6-sol`, `high` | `gpt-5.6-terra`, `xhigh` | Own the foundational state machine, migration, idempotent dispatch, target revalidation, and confirmation UX. Sol is reserved for the highest-value foundation. | High subscription/credit use; bounded to one foundational slice. Terra is the lower-cost fallback. Luna may generate mechanical fixtures only after contracts are fixed. | Claude `claude-opus-5`, `high`, reviews state transitions, unknown-delivery recovery, privacy, exact-recipient isolation, and executable Windows evidence. |
| P2 Auditable conversations | Google Antigravity `gemini-3.7-flash-medium` | `gemini-3.6-flash-medium` | Own causal history, bridge-facing conversation workflows, deletion, renderer UX, and accessibility. Flash Medium balances broad UI/domain work with quota. | Moderate five-hour/weekly quota use; lower than Pro-class reasoning. Re-run `agy models` because account inventory is authoritative. | Claude `claude-sonnet-5`, `high`, verifies causal integrity, transport-versus-outcome semantics, restart continuity, deletion, and keyboard flow. |
| P3 Lifecycle-aware delivery | Anthropic `claude-opus-5`, `high` | `claude-sonnet-5`, `xhigh` | Own provider evidence contracts, Windows/provider races, automatic safe-point proof, and manual degradation. Opus High is the default before paying for xhigh. | High usage; Opus costs and consumes more quota than Sonnet, so it is scoped to the safety-critical lifecycle slice. | OpenAI `gpt-5.6-sol`, `max`, performs an independent fault-injection review; acceptance requires real Windows/provider evidence, not model judgment. |
| P4 Bounded coordination | OpenAI `gpt-5.6-sol`, `max` | `gpt-5.6-terra`, `max` | Own loop bounds, held-message policy, escalation, and authority invariants. Max is restricted to the highest-risk policy slice. | Highest planned OpenAI usage. Do not use `ultra` unless a later task explicitly authorizes isolated subagents; `ultra` changes execution topology. | Claude `claude-opus-5`, `xhigh`, plus the human owner, adversarially reviews depth/loop/failure/conflict/authority cases. Google `gemini-3.1-pro-high` may provide a second independent review when quota permits. |
| P5 Shared hive memory | Google Antigravity `gemini-3.1-pro-high` | `gemini-3.7-flash-medium` | Own the revision/provenance model, FTS retrieval, conflict lifecycle, deletion, and compact memory UI. Pro High is used for the architecture slice; Flash Medium is suitable once contracts are fixed. | Higher Antigravity quota use than Flash, bounded to memory architecture and acceptance. No embedding/API spend is introduced by the product design. | Claude `claude-opus-5`, `high`, reviews isolation, provenance, conflict/deletion behavior, and secret/transcript exclusion; deterministic relevance/privacy tests remain authoritative. |
| P6 Reviewed agent roster | Anthropic `claude-sonnet-5`, `high` | `claude-opus-5`, `high` | Own Munder schema compatibility, untrusted-persona boundaries, digest/revision import, and compact roster UX. Sonnet matches the supplied ecosystem while keeping Opus for difficult compatibility review. | Moderate Claude usage; deterministic schema/digest fixtures carry correctness, so Opus is only fallback/review. | OpenAI `gpt-5.6-sol`, `high`, verifies authority separation, changed-after-preview handling, and all ten manifest acceptance results. |
| P7 Agent wizard and templates | Google Antigravity `gemini-3.7-flash-medium` | `gemini-3.6-flash-medium` | Own accessible step flow, draft/template lifecycle, literal variables, exact JSON review, and safe export UX. Flash Medium fits broad but bounded UI/domain work. | Moderate Antigravity quota use; no generation API or product runtime integration is introduced. | Claude `claude-sonnet-5`, `high`, verifies schema parity, draft recovery, template provenance, overwrite safety, and keyboard completion. |
| P8 Autonomous supervisor | OpenAI `gpt-5.6-sol`, `max` | `gpt-5.6-terra`, `max` | Own mission-envelope policy, work DAG/leases, event-driven supervisor tools, bounded retry/reassignment, recovery, and human escalation. Max is justified by the authority/concurrency risk. | Highest single-story OpenAI usage; split mechanical fixture generation to lower-cost approved models only after policy contracts freeze. | Claude `claude-opus-5`, `xhigh`, the human owner, and Antigravity `gemini-3.1-pro-high` adversarially review envelope escape, loop, lease, recovery, and consequential-action cases. |

Model exclusions for this plan:

- Do not assign retiring OpenAI GPT-5.4 variants or previous-generation GPT-5.5 as primary/fallback.
- Do not make OpenAI Luna, Claude Haiku, or Google Flash Low the owner or final verifier of a safety
  story; they may perform tightly specified, mechanically checkable subtasks.
- Claude Fable 5 is not a default fallback because its quota/cost and retention tradeoffs exceed the
  needs of this roadmap. It requires explicit user approval for a genuinely unresolved P4/P8 review.
- Third-party Claude models exposed inside Antigravity count as Claude, not as the Google assignment;
  Antigravity story ownership uses the verified Gemini models.

## Project Structure

### Documentation (this feature)

```text
specs/002-agent-mailbox-routing/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── coordination-domain.md
│   ├── desktop-ipc.md
│   ├── provider-coordination.md
│   ├── agent-profiles.md
│   ├── agent-templates.md
│   ├── session-host.md
│   ├── shared-memory.md
│   └── supervisor.md
├── checklists/
│   └── requirements.md
└── tasks.md                    # dependency-ordered P1–P8 implementation ledger
```

### Source Code (repository root)

```text
packages/contracts/src/index.ts
packages/domain/src/
├── coordination.ts             # conversation, delivery, outcome, loop state machines
├── shared-memory.ts            # revision, conflict, scope, retention policy
├── agent-profile.ts            # portable hire validation, revision and compatibility policy
├── agent-template.ts           # template/draft/variable lifecycle and generation policy
├── supervisor.ts               # mission, work DAG, lease, decision and bound policy
└── index.ts
packages/persistence/src/
├── schema.ts                   # migrations v2 coordination and v3 memory/profiles/supervisor
├── sanitize.ts
└── repositories/
    ├── coordination.ts
    ├── shared-memory.ts
    ├── agent-profiles.ts
    ├── agent-templates.ts
    ├── supervisor.ts
    └── index.ts
packages/providers/src/
├── adapter.ts                  # capability + per-session coordination launch seam
├── codex.ts
└── claude-code.ts
native/windows-supervisor/
├── Cargo.toml
└── src/bin/
    └── threadhelm-coordination-bridge.rs
apps/desktop/src/
├── main/
│   ├── context.ts
│   ├── coordinator.ts
│   └── coordination/
│       ├── service.ts
│       ├── delivery.ts
│       ├── bridge.ts
│       ├── memory.ts
│       ├── profiles.ts
│       ├── profile-wizard.ts
│       ├── supervisor.ts
│       ├── recovery.ts
│       └── disclosures.ts
├── preload/index.ts
└── renderer/
    ├── store.tsx
    └── features/coordination/
        ├── CoordinationPanel.tsx
        ├── HandoffComposer.tsx
        ├── HandoffDisclosures.tsx
        ├── ConversationView.tsx
        ├── EscalationPanel.tsx
        ├── MemoryList.tsx
        ├── MemoryDetail.tsx
        ├── AgentProfileList.tsx
        ├── AgentProfileDetail.tsx
        ├── AgentProfileWizard.tsx
        ├── AgentTemplateLibrary.tsx
        ├── MissionList.tsx
        └── MissionDetail.tsx
packages/test-fixtures/src/      # deterministic bridge/lifecycle fixture behavior
tests/
├── unit/domain/coordination.test.ts
├── unit/persistence/coordination.test.ts
├── unit/domain/shared-memory.test.ts
├── unit/domain/agent-profile.test.ts
├── unit/domain/agent-template.test.ts
├── unit/domain/supervisor.test.ts
├── unit/persistence/shared-memory.test.ts
├── unit/persistence/agent-profiles.test.ts
├── unit/persistence/agent-templates.test.ts
├── unit/persistence/supervisor.test.ts
├── contract/desktop-ipc-coordination.test.ts
├── contract/provider-coordination.test.ts
├── contract/shared-memory.test.ts
├── contract/agent-profiles.test.ts
├── contract/agent-templates.test.ts
├── contract/supervisor.test.ts
├── integration/windows/coordination-delivery.test.ts
├── integration/windows/coordination-recovery.test.ts
├── integration/windows/shared-memory.test.ts
├── integration/windows/agent-profile-import.test.ts
├── integration/windows/agent-profile-wizard.test.ts
├── integration/windows/supervisor-mission.test.ts
├── e2e/coordination.spec.ts
├── e2e/hive-memory.spec.ts
├── e2e/agent-roster.spec.ts
├── e2e/agent-profile-wizard.spec.ts
├── e2e/supervisor-mission.spec.ts
└── acceptance/provider-coordination-smoke.test.ts
```

**Structure Decision**: Extend the existing package boundaries rather than making the supervisor a
second orchestrator. Domain owns pure coordination/memory/mission policy; contracts own all wire
schemas; persistence owns durable records and FTS; Electron main owns authority, routing, leases, and
process effects; the supervisor is replaceable intelligence behind typed tools; providers describe
only supported configuration/evidence; the renderer owns compact presentation. The helper binary
remains inside the existing native package so packaging, signing, and Job Object containment reuse
the established Windows path. No graph-rendering package is introduced.

## Test Strategy and Release Gates

1. **Pure domain gates**: Exhaustive legal/illegal coordination, memory, mission, work-item, lease,
   profile validation/revision/compatibility and supervisor-decision transitions; reply/decomposition depth; duplicate/loop/failure/budget
   thresholds; authority holds; and deterministic content/scope bounds.
2. **Persistence gates**: Migrations v1→v2→v3, foreign keys/partial uniqueness, transaction rollback,
   unknown-attempt recovery, memory revision/conflict lineage, FTS synchronization, quotas, and
   deletion that removes content/index rows from ordinary queries.
3. **Contract gates**: Every operation/event/bridge frame rejects wrong session/role/scope, stale
   tokens/leases, wrong causal links, unknown fields, oversized frames, envelope escape, cross-scope
   memory access, and raw errors. Generated provider launch configuration contains no prompt/credential.
4. **Windows integration gates**: Four workers plus supervisor, 100 queued handoffs, 10,000 memory
   revisions, ordered presentation, lease contention, mission bounds, crashes around dispatch/decision
   boundaries, storage lock/corruption, lock/suspend/resume/unlock, Job Object cleanup, and no uncertain replay.
5. **Renderer/E2E gates**: Keyboard-only handoff/memory/mission flows, exact-target/envelope
   disclosures, honest unknown/conflict state, retarget/cancel/delete/escalate flows, screen-reader
   announcements, WCAG 2.2 AA contrast, text scaling, and no graph, idle animation, or polling.
6. **Provider proof gates**: Credentialed smoke tests record CLI version, configuration surface,
   bridge startup, safe-point evidence, manual fallback, and outcome behavior separately for Codex
   and Claude. One provider passing does not imply parity. Hosted CI and local evidence remain separate.
7. **Release gates**: `pnpm format`, `pnpm lint`, Rust format/check/test, TypeScript typecheck, unit,
   contract, desktop build, Windows supervision proof, sequential Windows integration, E2E, packaged
   installed-artifact acceptance, and optional credentialed provider smoke tests. A gate is not passed
   until its process exits successfully with the final summary captured.

## Phase Outputs

- **Phase 0**: [research.md](research.md) resolves storage, idempotency, bridge, provider evidence,
  shared memory/FTS, supervisor envelopes/leases, privacy, bounds, minimal UI/IPC, testing, upstream
  divergence, and model assignment decisions.
- **Phase 1**: [data-model.md](data-model.md), [contracts/](contracts/), and
  [quickstart.md](quickstart.md) define persistent entities, transitions, authority boundaries, wire
  operations, provider bridge behavior, memory/supervisor contracts, and end-to-end validation.
- **Phase 2**: `$speckit-tasks` converts each P1–P8 milestone and proof gate into ordered,
  independently verifiable implementation tasks without changing this plan's scope.

## Complexity Tracking

No constitution violations require justification. The coordination helper is a narrowly scoped
binary target within the existing Rust native package, not a new hosted service or second authority.
SQLite FTS and the supervisor role extend the existing single-authority design; neither introduces a
graphics subsystem, background hosted plane, or prompt-governed privilege boundary.

## Launch policy decision

Every provider CLI launch presents resolved provider/model/effort. Selecting model or effort directly refreshes the bound preview; there is no separate settings-review gate. The sole checkbox confirms the folder-access boundary and is not reset by model/effort changes. Readiness probes and app loading do not prompt. Priority is one-run override > exact agent/profile revision request > task-type/project policy > CLI default, with CLI default explicit. Automated tests use no LLM; test authoring/failure analysis recommends the lowest-cost capable approved model at low/medium effort. High-cost/high-effort requires explicit selection or recorded escalation. Planning providers are ChatGPT/OpenAI, Claude, and Google Antigravity; runtime providers are Codex CLI and Claude Code. Effort stays outside the Munder hire schema.
