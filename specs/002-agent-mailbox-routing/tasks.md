---

description: "Dependency-ordered implementation tasks for durable hive coordination"
---

# Tasks: Durable Hive Coordination

**Input**: Design documents from `specs/002-agent-mailbox-routing/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by the specification and constitution. Write each listed test first, confirm that
it fails for the intended missing behavior, and only then implement the corresponding production code.

**Organization**: Tasks are grouped by user story so every milestone has an explicit model gate,
independent acceptance test, implementation slice, and verification handoff.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its phase prerequisites because it changes different files and
  does not depend on another incomplete task in that parallel group.
- **[Story]**: Maps the task to one user story (`US1` through `US8`).
- Every checklist item names the exact file or files it changes or records evidence in.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish execution evidence, fixtures, and build surfaces shared by all six stories.

- [X] T001 Create the story model, reviewer, command, and release-gate evidence template in `specs/002-agent-mailbox-routing/execution-evidence.md`
- [X] T002 [P] Create deterministic coordination participant, clock, UUID, and event fixtures in `packages/test-fixtures/src/coordination.ts` and export them from `packages/test-fixtures/src/index.ts`
- [X] T003 [P] Register the packaged `threadhelm-coordination-bridge` binary target in `native/windows-supervisor/Cargo.toml` and create its compile-only entry point in `native/windows-supervisor/src/bin/threadhelm-coordination-bridge.rs`
- [X] T004 [P] Add shared Windows coordination test harness helpers for fixture sessions, crash boundaries, power events, and database inspection in `tests/integration/windows/helpers/coordination-harness.ts`
- [X] T005 Record the active feature pointer, Git status, baseline tool versions, and untouched unrelated changes in `specs/002-agent-mailbox-routing/execution-evidence.md`

**Checkpoint**: Shared evidence, fixture, bridge-build, and Windows-test surfaces exist without changing
the current session-host implementation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the typed, sanitized, main-owned seams that every story builds on.

**Critical**: No user-story implementation begins until these tasks pass their focused tests.

- [X] T006 [P] Write failing strict-schema, pagination, safe-error, and content-free-event tests for shared coordination primitives in `tests/contract/desktop-ipc-coordination.test.ts`
- [X] T007 [P] Write failing normalization, UTF-8 bound, control-character, credential-pattern, and safe-summary tests in `tests/unit/persistence/sanitize.test.ts`
- [X] T008 Implement shared coordination enums, branded IDs, bounded cursors, safe errors, event envelopes, and strict Zod helpers in `packages/contracts/src/index.ts`
- [X] T009 Implement deterministic coordination content normalization, validation, byte accounting, credential-pattern rejection, and safe summaries in `packages/persistence/src/sanitize.ts`
- [X] T010 [P] Add deterministic bridge request/response, provider lifecycle, memory, and supervisor fixture protocols in `packages/test-fixtures/src/coordination-bridge.ts` and export them from `packages/test-fixtures/src/index.ts`
- [X] T011 Create the main-owned coordination service container and dependency interfaces without routing behavior in `apps/desktop/src/main/coordination/service.ts` and wire it into `apps/desktop/src/main/context.ts`
- [X] T012 Implement purpose-bound, snapshot-bound, single-use two-minute coordination tokens in `apps/desktop/src/main/coordination/disclosures.ts` using `apps/desktop/src/main/tokens.ts`
- [X] T013 Add coordination service startup/shutdown composition and content-free event fan-out in `apps/desktop/src/main/coordinator.ts` without adding renderer database or terminal authority

**Checkpoint**: Contracts reject unknown fields, content sanitization is deterministic, tokens are
target-bound, and Electron main is the only coordination authority.

---

## Phase 3: User Story 1 — Send a Directed Agent Handoff (Priority: P1) — MVP

**Goal**: Let a user create, review, persist, present, cancel, or retarget exactly one addressed
handoff with honest delivery and crash-recovery state.

**Independent Test**: With two approved fixture sessions, preview and confirm one handoff, separately
confirm presentation to the selected live recipient, inject duplicates and crashes, and prove that
only the selected recipient receives at most one logical delivery.

### Model gate for User Story 1

- [X] T014 [US1] Verify OpenAI `gpt-5.6-sol` at `high`, fallback `gpt-5.6-terra` at `xhigh`, and Claude `claude-opus-5` at `high` reviewer availability; record versions, role, usage tradeoff, fallback result, and verifier responsibility in `specs/002-agent-mailbox-routing/execution-evidence.md`

### Tests for User Story 1

- [X] T015 [P] [US1] Write failing conversation, handoff, delivery-attempt, exact-recipient, state-transition, and idempotency tests in `tests/unit/domain/coordination.test.ts`
- [X] T016 [P] [US1] Write failing migration-v2, repository, quota, partial-unique-index, rollback, and unknown-attempt recovery tests in `tests/unit/persistence/coordination.test.ts`
- [X] T017 [P] [US1] Write failing preview, confirm, presentation, cancel, retarget, token-replay, target-drift, and sanitized-event contract tests in `tests/contract/desktop-ipc-coordination.test.ts`
- [X] T018 [P] [US1] Write failing selected-recipient, total-control-order, duplicate, pre-write failure, ambiguous-write, and unrelated-session Windows tests in `tests/integration/windows/coordination-delivery.test.ts`

### Implementation for User Story 1

- [X] T019 [US1] Implement coordination conversation, handoff, delivery-attempt, work-outcome, and escalation state policy in `packages/domain/src/coordination.ts` and export it from `packages/domain/src/index.ts`
- [X] T020 [US1] Add migration v2 tables, foreign keys, check constraints, event sequencing, and active/applied attempt indexes in `packages/persistence/src/schema.ts` and `packages/persistence/src/migrate.ts`
- [X] T021 [US1] Implement transactional handoff creation, attempt preparation/application/failure, cancellation, retargeting, quota, and recovery queries in `packages/persistence/src/repositories/coordination.ts` and export them from `packages/persistence/src/repositories/index.ts`
- [X] T022 [US1] Implement exact-target handoff preview/confirmation and manual-presentation disclosure flows in `apps/desktop/src/main/coordination/disclosures.ts`
- [X] T023 [US1] Implement addressed handoff orchestration, identity/workspace revalidation, cancellation, and retargeting in `apps/desktop/src/main/coordination/service.ts`
- [X] T024 [US1] Implement at-most-once handoff dispatch through the existing ordered session control API and map `host.controlApplied` to one attempt in `apps/desktop/src/main/coordination/delivery.ts`
- [X] T025 [US1] Implement startup reconciliation that converts unmatched prepared/dispatching attempts to unknown without replay in `apps/desktop/src/main/coordination/recovery.ts`
- [X] T026 [US1] Add named strict coordination IPC schemas/handlers and the least-privilege preload API in `packages/contracts/src/index.ts`, `apps/desktop/src/main/ipc/router.ts`, and `apps/desktop/src/preload/index.ts`
- [X] T027 [P] [US1] Build the keyboard-accessible handoff composer and exact durable-content preview in `apps/desktop/src/renderer/features/coordination/HandoffComposer.tsx`
- [X] T028 [P] [US1] Build the target/activity/manual-risk presentation confirmation dialogs in `apps/desktop/src/renderer/features/coordination/HandoffDisclosures.tsx`
- [X] T029 [US1] Build the calm coordination list/status surface and integrate its state/events into `apps/desktop/src/renderer/features/coordination/CoordinationPanel.tsx`, `apps/desktop/src/renderer/store.tsx`, and `apps/desktop/src/renderer/App.tsx`
- [X] T030 [US1] Add the complete keyboard-only directed-handoff, cancel, retarget, duplicate, and unknown-delivery journey in `tests/e2e/coordination.spec.ts`
- [X] T031 [US1] Run the US1 unit, persistence, contract, Windows integration, and E2E slices; capture final exits and Claude review findings in `specs/002-agent-mailbox-routing/execution-evidence.md`

**Checkpoint**: US1 is a deployable MVP with user-reviewed directed handoffs and no autonomous reply,
memory, or supervisor dependency.

---

## Phase 4: User Story 2 — Follow an Auditable Conversation (Priority: P2)

**Goal**: Add causal replies, separate work outcomes, restart continuity, deletion, and a packaged
session-scoped bridge so a conversation remains understandable without terminal history.

**Independent Test**: Complete a request/reply/outcome exchange between fixture agents, restart the
application, delete inactive content, and verify causal history, attribution, honest delivery/outcome,
and content-free lifecycle evidence.

### Model gate for User Story 2

- [X] T032 [US2] Verify Antigravity `gemini-3.7-flash-medium`, fallback `gemini-3.6-flash-medium`, and Claude `claude-sonnet-5` at `high` reviewer availability; record versions, quota tradeoff, fallback result, and verifier responsibility in `specs/002-agent-mailbox-routing/execution-evidence.md`

### Tests for User Story 2

- [X] T033 [P] [US2] Write failing bridge authentication, JSON-RPC bounds, four mailbox tools, causal reply, impersonation, rate-limit, and disconnect tests in `tests/contract/provider-coordination.test.ts`
- [X] T034 [P] [US2] Write failing restart, acknowledgement-versus-outcome, causal reply, stale event, and content-deletion tests in `tests/integration/windows/coordination-recovery.test.ts`
- [X] T035 [P] [US2] Write failing auditable-conversation, explicit-detail, deletion, and keyboard-flow scenarios in `tests/e2e/coordination.spec.ts`
- [X] T036 [P] [US2] Write failing MCP initialization, frame-size, session credential, method registry, stderr redaction, and disconnect tests in `native/windows-supervisor/src/bin/threadhelm-coordination-bridge.rs`

### Implementation for User Story 2

- [X] T037 [US2] Implement the bounded stdio MCP-to-named-pipe coordination bridge and fixed safe diagnostics in `native/windows-supervisor/src/bin/threadhelm-coordination-bridge.rs`
- [X] T038 [US2] Add bridge capability/version declarations and ephemeral per-session launch configuration contracts in `packages/providers/src/adapter.ts`
- [X] T039 [P] [US2] Implement per-process Codex bridge configuration without user/project/global edits in `packages/providers/src/codex.ts`
- [X] T040 [P] [US2] Implement per-session Claude Code `--mcp-config` configuration without user/project/global edits in `packages/providers/src/claude-code.ts`
- [X] T041 [US2] Implement session credential issuance, named-pipe authentication, mailbox method dispatch, rate limiting, and bridge teardown in `apps/desktop/src/main/coordination/bridge.ts`
- [X] T042 [US2] Implement causal provider replies, acknowledgement, work outcomes, conversation pagination, and inactive-content deletion in `apps/desktop/src/main/coordination/service.ts` and `packages/persistence/src/repositories/coordination.ts`
- [X] T043 [US2] Extend strict IPC/preload operations for conversation list/detail, pause, and deletion disclosures while keeping provider outcomes bridge-only in `packages/contracts/src/index.ts`, `apps/desktop/src/main/ipc/router.ts`, and `apps/desktop/src/preload/index.ts`
- [X] T044 [US2] Build the attributed conversation timeline with separate transport/outcome labels and explicit bounded detail loading in `apps/desktop/src/renderer/features/coordination/ConversationView.tsx`
- [X] T045 [US2] Add inactive-conversation deletion confirmation and content-free post-deletion rendering in `apps/desktop/src/renderer/features/coordination/HandoffDisclosures.tsx` and `apps/desktop/src/renderer/features/coordination/ConversationView.tsx`
- [X] T046 [US2] Package the bridge beside installed artifacts and keep it inside the existing Job Object/signing path in `apps/desktop/forge.config.ts`, `apps/desktop/electron.vite.config.ts`, and `native/windows-supervisor/package.json`
- [X] T047 [US2] Add installed bridge discovery, isolated session configuration, structured reply, and cleanup proof cases in `tests/acceptance/provider-coordination-smoke.test.ts`
- [X] T048 [US2] Run the US2 contract, Cargo, recovery, E2E, and installed-bridge slices; capture final exits and Claude review findings in `specs/002-agent-mailbox-routing/execution-evidence.md`

**Checkpoint**: US2 conversations are durable, causal, deletable, and independently understandable;
the bridge cannot impersonate, access SQLite/workspaces, or equate delivery with completion.

---

## Phase 5: User Story 3 — Receive Work at a Safe Lifecycle Point (Priority: P3)

**Goal**: Present queued work automatically only from exact-version structured safe-point evidence,
with honest manual fallback everywhere else.

**Independent Test**: Queue work for running, safe-point, unknown, stopped, failed, and
recovery-required fixtures and prove that only a version-proved safe point advances one delivery.

### Model gate for User Story 3

- [X] T049 [US3] Verify Claude `claude-opus-5` at `high`, fallback `claude-sonnet-5` at `xhigh`, and OpenAI `gpt-5.6-sol` at `max` reviewer availability; record versions, usage tradeoff, fallback result, and verifier responsibility in `specs/002-agent-mailbox-routing/execution-evidence.md`

### Tests for User Story 3

- [X] T050 [P] [US3] Write failing exact-version capability, structured-safe-point, stale/duplicate/cross-session evidence, and manual-degradation tests in `tests/contract/provider-coordination.test.ts`
- [X] T051 [P] [US3] Write failing safe-point, unknown activity, provider failure, lock/suspend/resume, crash, and no-input-replay cases in `tests/integration/windows/coordination-delivery.test.ts`
- [X] T052 [P] [US3] Write failing safe-lifecycle and visible manual-fallback journeys in `tests/e2e/coordination.spec.ts`

### Implementation for User Story 3

- [X] T053 [US3] Extend provider capability contracts with exact tested versions, structured evidence types, and fail-safe degradation in `packages/providers/src/adapter.ts` and `packages/contracts/src/index.ts`
- [X] T054 [P] [US3] Implement and sanitize the proved Claude lifecycle evidence adapter with manual-only fallback in `packages/providers/src/claude-code.ts`
- [X] T055 [P] [US3] Implement and sanitize the proved Codex lifecycle evidence adapter with manual-only fallback in `packages/providers/src/codex.ts`
- [X] T056 [US3] Authenticate, deduplicate, reject stale evidence, and persist only content-free lifecycle categories in `apps/desktop/src/main/coordination/bridge.ts`
- [X] T057 [US3] Implement one-item safe-point presentation and provider-specific manual downgrade without inferring readiness from output, silence, timers, CPU, process, or connection state in `apps/desktop/src/main/coordination/delivery.ts`
- [X] T058 [US3] Reconcile power/provider/session transitions without launch, replay, resend, or cross-session state change in `apps/desktop/src/main/coordination/recovery.ts` and `apps/desktop/src/main/recovery/power-events.ts`
- [X] T059 [US3] Add exact-version Codex and Claude lifecycle, pending-draft, manual-fallback, power, and cleanup proof scenarios in `tests/acceptance/provider-coordination-smoke.test.ts`
- [X] T060 [US3] Run US3 provider contract, Windows fault, E2E, and separate Codex/Claude proof slices; capture final exits and OpenAI fault-review findings in `specs/002-agent-mailbox-routing/execution-evidence.md`

**Checkpoint**: US3 makes safe automation capability-specific and evidence-backed; unsupported or
ambiguous sessions remain manual without affecting another provider.

---

## Phase 6: User Story 4 — Bound Coordination and Escalate Safely (Priority: P4)

**Goal**: Permit opt-in automatic continuation within deterministic reply, loop, failure, conflict,
and authority bounds, with exact human disposition for held work.

**Independent Test**: Exercise normal completion, ninth reply, third equivalent item, third delivery
failure, refusal, conflict, closed conversation, and consequential requests and verify deterministic
completion, hold, pause, or escalation.

### Model gate for User Story 4

- [X] T061 [US4] Verify OpenAI `gpt-5.6-sol` at `max`, fallback `gpt-5.6-terra` at `max`, Claude `claude-opus-5` at `xhigh`, human owner, and optional Antigravity `gemini-3.1-pro-high` reviewer availability; record the complete gate in `specs/002-agent-mailbox-routing/execution-evidence.md`

### Tests for User Story 4

- [X] T062 [P] [US4] Write failing depth-eight, exact-repeat-three-of-eight, three-failure, message-kind, pause/close, and consequential-authority tests in `tests/unit/domain/coordination.test.ts`
- [X] T063 [P] [US4] Write failing auto-continue disclosure, held-message, escalation disposition, and late-message contract/E2E cases in `tests/contract/desktop-ipc-coordination.test.ts` and `tests/e2e/coordination.spec.ts`

### Implementation for User Story 4

- [X] T064 [US4] Implement deterministic automatic-continuation, reply-depth, normalized-repeat, failure, conflict, closed-state, and authority-hold policy in `packages/domain/src/coordination.ts`
- [X] T065 [US4] Persist failure counters, open escalation uniqueness, held arrivals, and exact user dispositions transactionally in `packages/persistence/src/repositories/coordination.ts`
- [X] T066 [US4] Enforce per-conversation opt-in and evaluate every provider reply before presentation in `apps/desktop/src/main/coordination/service.ts` and `apps/desktop/src/main/coordination/delivery.ts`
- [X] T067 [US4] Add strict auto-continue preview/confirm and escalation continue/redirect/close operations in `packages/contracts/src/index.ts`, `apps/desktop/src/main/ipc/router.ts`, and `apps/desktop/src/preload/index.ts`
- [X] T068 [US4] Build the keyboard-accessible held-message and escalation disposition surface in `apps/desktop/src/renderer/features/coordination/EscalationPanel.tsx` and integrate it in `apps/desktop/src/renderer/features/coordination/ConversationView.tsx`
- [X] T069 [US4] Add sequential Windows loop, failure, conflict, authority, and closed-conversation isolation tests in `tests/integration/windows/coordination-recovery.test.ts`
- [X] T070 [US4] Run the US4 domain, contract, Windows, and E2E slices; capture final exits, Claude adversarial review, optional Antigravity review, and explicit human acceptance in `specs/002-agent-mailbox-routing/execution-evidence.md`

**Checkpoint**: US4 provides bounded coordination suitable as the deterministic safety layer for
shared memory and autonomous missions.

---

## Phase 7: User Story 5 — Build Shared Hive Memory (Priority: P5)

**Goal**: Let approved users and agents publish, search, cite, contest, supersede, retract, expire,
and delete workspace/mission-scoped shared knowledge without transcript ingestion or graphics-heavy UI.

**Independent Test**: Publish conflicting claims from two fixtures, search from a third authorized
session, resolve via a cited revision, restart, delete content, and verify attribution, scope isolation,
lineage, FTS cleanup, performance, and absence of terminal/provider ingestion.

### Model gate for User Story 5

- [X] T071 [US5] Verify Antigravity `gemini-3.1-pro-high`, fallback `gemini-3.7-flash-medium`, and Claude `claude-opus-5` at `high` reviewer availability; record versions, quota tradeoff, fallback result, and deterministic retrieval/privacy verification responsibility in `specs/002-agent-mailbox-routing/execution-evidence.md`

### Tests for User Story 5

- [X] T072 [P] [US5] Write failing memory kind/status, immutable revision, conflict, scope, source, confidence-nonauthority, and deletion transition tests in `tests/unit/domain/shared-memory.test.ts`
- [X] T073 [P] [US5] Write failing migration-v3 memory tables, FTS synchronization, quotas, cursor stability, conflict lineage, expiry, rollback, and content deletion tests in `tests/unit/persistence/shared-memory.test.ts`
- [X] T074 [P] [US5] Write failing desktop/bridge scope, strict schema, bounded excerpt, cross-scope denial, publish, supersede, retract, conflict, and deletion tests in `tests/contract/shared-memory.test.ts`
- [X] T075 [P] [US5] Write failing 10,000-revision search, restart, deletion, transcript exclusion, and unrelated-scope isolation cases in `tests/integration/windows/shared-memory.test.ts`
- [X] T076 [P] [US5] Write failing keyboard search/detail/publish/conflict/deletion and no-graph/no-animation journeys in `tests/e2e/hive-memory.spec.ts`

### Implementation for User Story 5

- [X] T077 [US5] Implement memory entry/revision/conflict state policy, source validation, and explicit lifecycle transitions in `packages/domain/src/shared-memory.ts` and export it from `packages/domain/src/index.ts`
- [X] T078 [US5] Add migration v3 memory entry/revision/conflict tables, FTS5 virtual table/triggers, scope indexes, quotas, and deletion invariants in `packages/persistence/src/schema.ts` and `packages/persistence/src/migrate.ts`
- [X] T079 [US5] Implement transactional scoped publish/search/get/supersede/contest/resolve/retract/expire/delete queries and stable pagination in `packages/persistence/src/repositories/shared-memory.ts` and export them from `packages/persistence/src/repositories/index.ts`
- [X] T080 [US5] Implement authenticated memory scope derivation, deliberate publication, conflict handling, deletion disclosures, and content-free events in `apps/desktop/src/main/coordination/memory.ts`
- [X] T081 [US5] Add versioned `memory_search`, `memory_get`, and `memory_propose_revision` bridge tools with worker scope enforcement in `apps/desktop/src/main/coordination/bridge.ts` and `native/windows-supervisor/src/bin/threadhelm-coordination-bridge.rs`
- [X] T082 [US5] Add strict memory desktop contracts, named IPC handlers, and least-privilege preload methods in `packages/contracts/src/index.ts`, `apps/desktop/src/main/ipc/router.ts`, and `apps/desktop/src/preload/index.ts`
- [X] T083 [P] [US5] Build the keyboard-accessible bounded memory search/filter/list surface without polling or graph rendering in `apps/desktop/src/renderer/features/coordination/MemoryList.tsx`
- [X] T084 [P] [US5] Build explicit memory detail, lineage, citations, conflict, supersede, retract, expiry, and deletion controls in `apps/desktop/src/renderer/features/coordination/MemoryDetail.tsx`
- [X] T085 [US5] Integrate content-free memory events and explicit detail loading into `apps/desktop/src/renderer/store.tsx`, `apps/desktop/src/renderer/features/coordination/CoordinationPanel.tsx`, and `apps/desktop/src/renderer/App.tsx`
- [X] T086 [US5] Add representative Windows FTS latency, quota, idle-cost, and deletion-index benchmarks in `tests/integration/windows/performance.test.ts` and `tests/integration/windows/shared-memory.test.ts`
- [X] T087 [US5] Extend installed provider proof with scoped memory search/publish, cross-scope denial, transcript exclusion, and role isolation in `tests/acceptance/provider-coordination-smoke.test.ts`
- [X] T088 [US5] Run the US5 domain, persistence, contract, Windows, E2E, and provider-proof slices; capture final exits, Antigravity implementation evidence, Claude review, and deterministic relevance/privacy results in `specs/002-agent-mailbox-routing/execution-evidence.md`

**Checkpoint**: US5 supplies durable shared context with explicit provenance and conflict state; no
model output is silently authoritative and no topology/office visualization is introduced.

---

## Phase 8: User Story 6 — Import a Reviewed Marvel Agent Roster (Priority: P6)

**Goal**: Import portable Marvel-themed hire manifests through an exact, digest-bound review while
keeping persona, capability, model, isolation, and token-cap data separate from authority.

**Independent Test**: Preview/import all ten supplied manifests, exercise malformed, hostile,
duplicate, revised, unavailable-model, excessive-bound, and changed-after-preview fixtures, and
verify compact roster management with no launch, settings edit, worktree creation, or role grant.

### Model gate for User Story 6

- [X] T089 [US6] Verify Claude `claude-sonnet-5` at `high`, fallback `claude-opus-5` at `high`, and OpenAI `gpt-5.6-sol` at `high` verifier availability; record schema/runtime compatibility, cost, and authority-separation ownership in `specs/002-agent-mailbox-routing/execution-evidence.md`

### Tests for User Story 6

- [X] T090 [P] [US6] Write failing strict schema, normalization, bounds, compatibility, non-authority, state, and revision tests in `tests/unit/domain/agent-profile.test.ts`
- [X] T091 [P] [US6] Write failing digest idempotency, current-revision, enable/disable/delete, rollback, and active-mission pin tests in `tests/unit/persistence/agent-profiles.test.ts`
- [X] T092 [P] [US6] Write failing preview/confirm, changed-after-preview, unknown-field, hostile-goal, unsupported-model, role-grant, token-budget, and isolation contract tests in `tests/contract/agent-profiles.test.ts`
- [X] T093 [P] [US6] Write failing Windows file-selection/import/restart/source-redaction and ten-manifest acceptance cases in `tests/integration/windows/agent-profile-import.test.ts`
- [X] T094 [P] [US6] Write failing keyboard preview/confirmation/roster/detail/disable/re-import journeys with no avatar or animation dependency in `tests/e2e/agent-roster.spec.ts`

### Implementation for User Story 6

- [X] T095 [P] [US6] Add sanitized valid, duplicate, revised, hostile-text, unavailable-model, excessive-bound, and changed-after-preview hire fixtures in `packages/test-fixtures/src/agent-profiles.ts` and export them from `packages/test-fixtures/src/index.ts`
- [X] T096 [US6] Implement `munder-difflin/hire@1` field validation, compatibility, revision, role-separation, isolation, and effective-budget policy in `packages/domain/src/agent-profile.ts` and export it from `packages/domain/src/index.ts`
- [X] T097 [US6] Extend migration v3 with agent-profile/revision/current-digest indexes and mission revision pins in `packages/persistence/src/schema.ts` and `packages/persistence/src/migrate.ts`
- [X] T098 [US6] Implement transactional profile/revision, duplicate, enable/disable, and deletion repositories in `packages/persistence/src/repositories/agent-profiles.ts` and export them from `packages/persistence/src/repositories/index.ts`
- [X] T099 [US6] Implement bounded file read, strict parse, SHA-256 preview token, changed-file recheck, compatibility evaluation, and no-launch confirmation in `apps/desktop/src/main/coordination/profiles.ts`
- [X] T100 [US6] Add strict profile views, named import/list/detail/enable/delete IPC operations, content-free events, and least-privilege preload methods in `packages/contracts/src/index.ts`, `apps/desktop/src/main/ipc/router.ts`, and `apps/desktop/src/preload/index.ts`
- [X] T101 [P] [US6] Build the compact keyboard-accessible profile list, filters, compatibility/state badges, and text-only Marvel identity in `apps/desktop/src/renderer/features/coordination/AgentProfileList.tsx`
- [X] T102 [P] [US6] Build exact-field import preview, warnings, confirmation, untrusted-goal detail, revision history, and enable/disable controls in `apps/desktop/src/renderer/features/coordination/AgentProfileDetail.tsx`
- [X] T103 [US6] Integrate content-free profile events and explicit detail loading into `apps/desktop/src/renderer/store.tsx`, `apps/desktop/src/renderer/features/coordination/CoordinationPanel.tsx`, and `apps/desktop/src/renderer/App.tsx`
- [X] T104 [US6] Add launch-time profile revision, provider/model/effort, isolation, effective token/resource budget, tool registry, and workspace disclosures without editing global/project settings in `packages/providers/src/adapter.ts`, `packages/providers/src/codex.ts`, and `packages/providers/src/claude-code.ts`
- [X] T105 [US6] Run manual acceptance against the ten user-selected Downloads manifests, record basenames/digests/results without copying their contents, and verify four Opus/six Sonnet, eight isolated/two non-isolated, and two-million token-cap requests in `specs/002-agent-mailbox-routing/execution-evidence.md`
- [X] T106 [US6] Run the US6 domain, persistence, contract, Windows, E2E, and acceptance slices; capture final exits, Claude implementation evidence, OpenAI independent review, and deterministic authority/privacy results in `specs/002-agent-mailbox-routing/execution-evidence.md`

**Checkpoint**: US6 preserves the Marvel roster as reviewed presentation/context data and supplies
stable profile revisions for later missions without making a manifest an authority source.

---

## Phase 9: User Story 7 — Create Agents from Reviewed Templates (Priority: P7)

**Goal**: Create agents through a compact, resumable wizard using generic or local user templates,
with exact strict-manifest review, save-as-profile, and collision-safe export.

**Independent Test**: Create a themed quality agent from a generic template, resume its draft after
restart, save it as a user template and reviewed profile, export it safely, and verify stale-template,
invalid-variable, overwrite, cancellation, and write-failure behavior without any session launch.

### Model gate for User Story 7

- [X] T107 [US7] Verify OpenAI `gpt-5.6-terra` at `high`, fallback `gpt-5.6-sol` at `high`, for the current implementation assignment; record wizard/template UX, schema, cost, and export-safety ownership in `specs/002-agent-mailbox-routing/execution-evidence.md`. Claude `claude-sonnet-5` at `high` remains an approval-gated independent verifier, and Antigravity is unassigned: do not start, probe, or otherwise invoke either external provider without first asking the owner.

### Tests for User Story 7

- [X] T108 [P] [US7] Write failing template/draft state, copy-on-create provenance, literal-variable, validation, bounds, and non-authority tests in `tests/unit/domain/agent-template.test.ts`
- [X] T109 [P] [US7] Write failing template revision, draft recovery, stale version, quota, deletion, and completed-draft immutability tests in `tests/unit/persistence/agent-templates.test.ts`
- [X] T110 [P] [US7] Write failing wizard step, exact JSON, save-as-profile, export token, target-change, overwrite, unknown-field, and non-executable-template contract tests in `tests/contract/agent-templates.test.ts`
- [X] T111 [P] [US7] Write failing Windows restart, atomic export, collision, write-failure, local-template, and profile-parity cases in `tests/integration/windows/agent-profile-wizard.test.ts`
- [X] T112 [P] [US7] Write failing keyboard step/back/resume/cancel/review/save/template/export journeys with visible errors and no graphics dependency in `tests/e2e/agent-profile-wizard.spec.ts`

### Implementation for User Story 7

**Dependency**: T164 and T165 MUST complete before T122. T107-T121 may proceed independently because
profiles, templates, and drafts intentionally own no runtime permission field.

- [X] T113 [P] [US7] Add versioned generic investigator, implementer, reviewer, quality, documentation, and release-gate starter fixtures without Marvel/project content in `packages/test-fixtures/src/agent-templates.ts` and export them from `packages/test-fixtures/src/index.ts`
- [X] T114 [US7] Implement template/draft state, strict field ownership, copy-on-create provenance, literal-variable substitution, validation, and completion policy in `packages/domain/src/agent-template.ts` and export it from `packages/domain/src/index.ts`
- [X] T115 [US7] Extend migration v3 with template/revision/draft/provenance/digest/current-state indexes and quotas in `packages/persistence/src/schema.ts` and `packages/persistence/src/migrate.ts`
- [X] T116 [US7] Implement transactional template revision, duplicate, enable/disable/delete, draft autosave/recovery/delete, and completion repositories in `packages/persistence/src/repositories/agent-templates.ts` and export them from `packages/persistence/src/repositories/index.ts`
- [X] T117 [US7] Implement wizard draft lifecycle, per-step/final validation, exact JSON preview tokens, save-as-profile delegation, export intent, atomic write, collision/change recheck, and safe failure evidence in `apps/desktop/src/main/coordination/profile-wizard.ts`
- [X] T118 [US7] Add strict wizard/template views, named draft/template/save/export IPC operations, content-free events, and least-privilege preload methods in `packages/contracts/src/index.ts`, `apps/desktop/src/main/ipc/router.ts`, and `apps/desktop/src/preload/index.ts`
- [X] T119 [P] [US7] Build the keyboard-accessible step shell, progress text, field ownership help, validation summary, back/resume/cancel controls, and exact JSON review in `apps/desktop/src/renderer/features/coordination/AgentProfileWizard.tsx`
- [X] T120 [P] [US7] Build the compact generic/user template library with provenance, revisions, duplicate, enable/disable, and delete controls in `apps/desktop/src/renderer/features/coordination/AgentTemplateLibrary.tsx`
- [X] T121 [US7] Integrate wizard drafts, template events, explicit detail loading, and profile completion into `apps/desktop/src/renderer/store.tsx`, `apps/desktop/src/renderer/features/coordination/CoordinationPanel.tsx`, and `apps/desktop/src/renderer/App.tsx`
- [X] T122 [US7] Add a final launch-settings disclosure handoff proving generated provider/model/effort/permission/isolation/budget/tool/workspace values remain separately resolved and no persona/template field selects permission mode in `packages/providers/src/adapter.ts` and `apps/desktop/src/main/coordination/profile-wizard.ts`
- [X] T123 [US7] Add manual acceptance that creates a local Marvel-themed template from one reviewed profile and verifies no Marvel/project content appears in bundled starters in `specs/002-agent-mailbox-routing/execution-evidence.md`
- [X] T124 [US7] Run the US7 domain, persistence, contract, Windows, E2E, and export slices; capture final exits, OpenAI implementation evidence, deterministic schema/overwrite/privacy results, and any separately owner-authorized Claude review in `specs/002-agent-mailbox-routing/execution-evidence.md`. Do not start Antigravity or Claude runs for this task without asking the owner first.
- [X] T125 [US7] Verify all bundled templates are generic, narrow, provider-neutral where possible, bounded, non-executable, and accessible, and record their exact version/digest inventory in `specs/002-agent-mailbox-routing/execution-evidence.md`

**Checkpoint**: US7 creates portable agents without hand-edited JSON while templates remain local,
versioned, non-executable scaffolds and completion never launches or authorizes an agent.

---

## Phase 10: User Story 8 — Run a Bounded Autonomous Supervisor (Priority: P8)

**Goal**: Let one ordinary supervisor agent autonomously decompose, assign, monitor, retry, reassign,
complete, and escalate routine mission work within a confirmed envelope enforced by Electron main.

**Independent Test**: Confirm a mission for one supervisor profile revision and three worker profile
revisions with one exact offline-worker automatic-start binding, complete a routine DAG, inject launch
drift, a known-safe failure, lease conflict, unknown attempt, loop, budget limit, supervisor loss, and
scope-changing request, and verify bounded autonomy and recovery.

### Model gate for User Story 8

- [X] T126 [US8] Verify OpenAI `gpt-5.6-sol` at `max`, fallback `gpt-5.6-terra` at `max`, Claude `claude-opus-5` at `xhigh`, human owner, and Antigravity `gemini-3.1-pro-high` adversarial reviewer availability; verify the exact Claude CLI/model/provider/organization auto-mode capability surface and record the complete authority/concurrency/permission gate in `specs/002-agent-mailbox-routing/execution-evidence.md`

### Tests for User Story 8

- [X] T127 [P] [US8] Write failing mission, work-DAG, profile-revision, exact automatic-start binding, runtime permission/capability evidence, dependency, lease, attempt, decision-loop, elapsed/turn/no-progress/resource bound, budget, authority, and recovery state tests in `tests/unit/domain/supervisor.test.ts`
- [X] T128 [P] [US8] Write failing mission/version, profile pin, automatic-start permission snapshot, work-item/decision/attempt/start disposition, reserved-to-active lease uniqueness, typed permission/timeout/cancel/unknown result return link, rollback, unknown recovery, and content-deletion tests in `tests/unit/persistence/supervisor.test.ts`
- [X] T129 [P] [US8] Write failing mission disclosure, exact worker automatic-start authorization, static-persona non-authority, auto capability failure, bypass exclusion, launch drift/substitution denial, supervisor-role registry, persona self-appointment, envelope escape, worker denial, idempotency, bounds, and consequential-action tests in `tests/contract/supervisor.test.ts`
- [X] T130 [P] [US8] Write failing three-worker mission, pre-authorized Claude auto worker start, permission block, unavailable-auto hold, no-bypass fallback, start failure/drift, known-safe reassignment, write-lease conflict, timeout/cancel/no-progress/budget/unknown attempt, crash, loop, power, and no-recovery-autostart cases in `tests/integration/windows/supervisor-mission.test.ts`
- [X] T131 [P] [US8] Write failing keyboard mission creation/detail/pause/resume/cancel/escalation and minimal-status UI journeys in `tests/e2e/supervisor-mission.spec.ts`

### Implementation for User Story 8

- [X] T132 [US8] Implement mission envelope, pinned-profile revision, automatic-start runtime-permission/capability binding, work-DAG, decision, typed permission/timeout/cancel/no-progress/budget/unknown attempt, lease, bound, structured result-return, and consequential-authority state policy in `packages/domain/src/supervisor.ts` and export it from `packages/domain/src/index.ts`
- [X] T133 [US8] Extend migration v3 with mission automatic-start bindings, profile-revision eligibility, work-item, dependency, supervisor-decision, work-attempt/start/result links, reservable worker leases, event-sequence, and partial-unique indexes in `packages/persistence/src/schema.ts` and `packages/persistence/src/migrate.ts`
- [X] T134 [US8] Implement transactional mission/version, profile pins/start bindings, DAG, decision, attempt/start/result links, reserved-to-active lease, event, budget, and recovery repositories in `packages/persistence/src/repositories/supervisor.ts` and export them from `packages/persistence/src/repositories/index.ts`
- [X] T135 [US8] Implement exact mission-envelope preview/confirmation and envelope-revision disclosures, including per-worker automatic-start permission policy/source/provider mapping, capability evidence, elapsed/turn/no-progress/resource bounds, bypass exclusion, and one-time target-bound tokens, in `apps/desktop/src/main/coordination/disclosures.ts`
- [X] T136 [US8] Implement mission lifecycle, supervisor binding, typed decision validation, task decomposition, assignment, pre-authorized auto/allowlist worker startup, permission/classifier/timeout/cancel/no-progress/budget outcome handling, completion, structured result return, and escalation in `apps/desktop/src/main/coordination/supervisor.ts`
- [X] T137 [US8] Implement acyclic dependency evaluation, 64-item/depth-eight limits, completion evidence, and blocked-to-ready transitions in `apps/desktop/src/main/coordination/supervisor.ts` and `packages/domain/src/supervisor.ts`
- [X] T138 [US8] Implement main-owned read/write worker leases, exact workspace/profile-revision eligibility, conflicting-write denial, expiry, release, and unknown-lease holds in `apps/desktop/src/main/sessions/lease.ts` and `apps/desktop/src/main/coordination/supervisor.ts`
- [X] T139 [US8] Implement the event-driven supervisor wake loop, structured provider progress, three-attempt known-safe retry/reassignment, three-of-eight decision-loop stop, elapsed/turn/resource/no-progress bounds, cancellation, and no-unknown-replay policy in `apps/desktop/src/main/coordination/supervisor.ts`
- [X] T140 [US8] Implement mission recovery that preserves work/memory/decisions/profile pins, moves unsafe missions/leases to recovery-required/unknown, and launches or resumes nothing in `apps/desktop/src/main/coordination/recovery.ts`
- [X] T141 [US8] Add versioned supervisor-only mission/work bridge methods and reject every worker or cross-mission invocation in `apps/desktop/src/main/coordination/bridge.ts` and `native/windows-supervisor/src/bin/threadhelm-coordination-bridge.rs`
- [X] T142 [US8] Add supervisor/worker role capability generation and exact runtime permission mapping to per-session Codex and Claude configurations, mapping supported Claude workers to real `--permission-mode auto`, holding unavailable auto, and excluding bypass without trusting persona fields, persisting mission content/permission, or editing global/project settings in `packages/providers/src/adapter.ts`, `packages/providers/src/codex.ts`, and `packages/providers/src/claude-code.ts`
- [X] T143 [US8] Add strict mission/work/lease/decision/start/result-return views, named IPC operations/events, and least-privilege preload methods in `packages/contracts/src/index.ts`, `apps/desktop/src/main/ipc/router.ts`, and `apps/desktop/src/preload/index.ts`
- [X] T144 [P] [US8] Build the compact keyboard-accessible mission list, bound/status badges, filters, and recovery states in `apps/desktop/src/renderer/features/coordination/MissionList.tsx`
- [X] T145 [P] [US8] Build mission-envelope confirmation with exact worker automatic-start permission/source/capability/bound disclosures, pinned roster, work DAG table, decision/attempt/start/result history, lease state, and exact escalation controls in `apps/desktop/src/renderer/features/coordination/MissionDetail.tsx`
- [X] T146 [US8] Integrate content-free mission events and explicit details into `apps/desktop/src/renderer/store.tsx`, `apps/desktop/src/renderer/features/coordination/CoordinationPanel.tsx`, and `apps/desktop/src/renderer/App.tsx`
- [X] T147 [US8] Add deterministic supervisor/worker fixture behaviors for valid DAGs, offline start, launch drift, structured result return, failures, refusals, loops, persona self-appointment, envelope escape, and consequential requests in `packages/test-fixtures/src/supervisor.ts` and export them from `packages/test-fixtures/src/index.ts`
- [ ] T148 [US8] Extend installed provider proof with worker-versus-supervisor registries, pinned profile revisions, one bounded mission, one disposable pre-authorized Claude auto worker start, harmless read/edit/test progress, classifier denial, unavailable-auto/no-bypass hold, timeout/cancel/no-progress result return, launch-substitution denial, known-safe reassignment, envelope denial, human escalation, crash recovery, usage evidence, and cleanup in `tests/acceptance/provider-coordination-smoke.test.ts`
- [ ] T149 [US8] Run the US8 domain, persistence, contract, Windows, E2E, and provider-proof slices; capture final exits, OpenAI implementation evidence, exact Claude auto-mode/version/usage evidence, Claude/Antigravity adversarial reviews, and explicit human acceptance in `specs/002-agent-mailbox-routing/execution-evidence.md`

**Checkpoint**: US8 provides genuine routine autonomy inside an enforceable mission envelope; the
supervisor remains replaceable intelligence with no blanket machine authority.

---

## Phase 11: Polish & Cross-Cutting Release Gates

**Purpose**: Prove privacy, accessibility, performance, packaging, provider isolation, and full
Windows readiness across the selected milestones.

- [X] T150 [P] Add malformed Unicode, ANSI/OSC, credential-like content, oversized frame/manifest/draft, unknown-field/variable, role-confusion, scope-confusion, persona self-appointment, and envelope-escape fuzz cases in `tests/contract/desktop-ipc-coordination.test.ts`, `tests/contract/provider-coordination.test.ts`, `tests/contract/agent-profiles.test.ts`, `tests/contract/agent-templates.test.ts`, `tests/contract/shared-memory.test.ts`, and `tests/contract/supervisor.test.ts`
- [X] T151 [P] Add four-worker-plus-supervisor, 100-profile, 100-template, 20-draft, 1,000-handoff retry/duplicate, 10,000-memory-revision, mission-bound, recovery-under-five-seconds, operation-under-one-second, and search-under-500-ms measurements in `tests/integration/windows/performance.test.ts`
- [X] T152 [P] Add full keyboard, visible-focus, accessible-name, text-scaling, WCAG 2.2 AA, bounded-live-region, and no-idle-polling/no-animation coverage in `tests/e2e/accessibility.spec.ts`
- [X] T153 Audit and harden content-free logging, renderer events, profile/template/draft/export handling, bridge stderr, database metadata, and crash errors in `apps/desktop/src/main/logging.ts`, `apps/desktop/src/main/coordination/service.ts`, `apps/desktop/src/main/coordination/profiles.ts`, `apps/desktop/src/main/coordination/profile-wizard.ts`, `apps/desktop/src/main/coordination/memory.ts`, and `apps/desktop/src/main/coordination/supervisor.ts`
- [ ] T154 Verify bridge packaging, the owner-approved unsigned distribution policy (reject invalid signatures; optional signing inputs remain supported), x64/ARM64 installed lookup, Job Object containment, and uninstall cleanup in `apps/desktop/forge.config.ts`, `native/windows-supervisor/package.json`, and `tests/acceptance/installed-app.test.ts`
- [X] T155 Update runnable commands, expected evidence, roster import, wizard/template/export, rollback/recovery notes, and separate local/hosted/provider status reporting in `specs/002-agent-mailbox-routing/quickstart.md`
- [X] T156 Run `pnpm format`, `pnpm lint`, `pnpm rust:fmt`, `pnpm rust:check`, `pnpm rust:test`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:contract`, `pnpm desktop:build`, `pnpm proof:windows-supervision`, `pnpm test:integration:windows`, and `pnpm test:e2e` sequentially and record every final exit/summary in `specs/002-agent-mailbox-routing/execution-evidence.md`
- [ ] T157 Run packaged installed-artifact acceptance plus separate exact-version Codex and Claude provider proofs, preserving optional/credentialed status and recording results in `specs/002-agent-mailbox-routing/execution-evidence.md`
- [ ] T158 Perform final spec/plan/contracts/tasks/constitution drift review, confirm the reviewed Marvel roster, generic/user template boundary, wizard non-authority, all adopted Munder mechanics, and minimal-graphics exclusions, and record approval or blockers in `specs/002-agent-mailbox-routing/execution-evidence.md`

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 — Setup**: Starts immediately and must preserve existing unrelated changes.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks every user story.
- **US1 / Phase 3**: Depends only on Foundational and is the suggested MVP.
- **US2 / Phase 4**: Depends on US1 because causal replies, outcomes, and the bridge extend durable handoffs.
- **US3 / Phase 5**: Depends on US2 because safe-point presentation uses the versioned provider bridge.
- **US4 / Phase 6**: Depends on US2 and US3 because bounded continuation evaluates structured replies
  and proved presentation evidence.
- **US5 / Phase 7**: Depends on US2 and Foundational; it may be implemented in parallel with US3/US4
  once the bridge contract is stable, but it must still pass its independent memory gates.
- **US6 / Phase 8**: Depends on Foundational and provider adapter contracts; it may proceed after US2
  stabilizes the provider seam and supplies reviewed profile revisions without launching sessions.
- **US7 / Phase 9**: Depends on US6 because its drafts/templates must reuse the reviewed profile schema,
  compatibility, revision, and confirmation path; it can be validated without mailbox or supervisor work.
- **US8 / Phase 10**: Depends on US1–US7 because it consumes addressed handoffs, structured outcomes,
  safe-point behavior, bounded escalation policy, shared memory, reviewed profiles, and workspace authority.
- **Phase 11 — Polish**: Depends on every milestone selected for the release.

### User-story dependency graph

```text
Setup → Foundational → US1 → US2 ─┬→ US3 → US4 ──────────────┐
                                  ├→ US5 ─────────────────────┼→ US8 → Polish/Release
                                  └→ US6 roster → US7 wizard ─┘
```

### Within each user story

1. Verify the primary/fallback/verifier models and stop unassigned if neither approved model is available.
2. Write the listed tests and confirm the intended red failure.
3. Implement domain policy before persistence and main-process effects.
4. Implement typed contracts/IPC before renderer integration.
5. Complete Windows/E2E/provider proof and independent review before advancing the milestone.

### Parallel opportunities

- Setup fixture, native target, and Windows harness tasks T002–T004 can run in parallel.
- Foundational test tasks T006–T007 and fixture task T010 can run in parallel before their implementations.
- Test files marked `[P]` inside each story can be authored concurrently before production code.
- Provider-specific Codex and Claude adapter work T039–T040 and T054–T055 can run in parallel.
- Independent renderer components T027–T028, T083–T084, T101–T102, T119–T120, and T144–T145 can run in parallel after their
  story contracts are stable.
- US5 and US6 may proceed alongside US3/US4 after US2; US7 follows US6; US8 waits for all branches.
- Cross-cutting security, performance, and accessibility tasks T150–T152 can run in parallel after
  the selected story implementations stabilize.

---

## Parallel Examples

### User Story 1

```text
T015 domain tests | T016 persistence tests | T017 IPC tests | T018 Windows delivery tests
T027 composer UI | T028 disclosure UI
```

### User Story 2

```text
T033 bridge contracts | T034 recovery tests | T035 E2E tests | T036 Rust bridge tests
T039 Codex configuration | T040 Claude configuration
```

### User Story 3

```text
T050 provider contracts | T051 Windows lifecycle tests | T052 E2E fallback tests
T054 Claude lifecycle adapter | T055 Codex lifecycle adapter
```

### User Story 4

```text
T062 bounded-domain tests | T063 IPC/E2E escalation tests
```

### User Story 5

```text
T072 domain tests | T073 persistence/FTS tests | T074 contracts | T075 Windows tests | T076 E2E tests
T083 memory list | T084 memory detail
```

### User Story 6

```text
T090 domain tests | T091 persistence tests | T092 contracts | T093 Windows import | T094 E2E roster
T101 profile list | T102 profile detail
```

### User Story 7

```text
T108 domain tests | T109 persistence tests | T110 contracts | T111 Windows wizard | T112 E2E wizard
T119 wizard UI | T120 template library
```

### User Story 8

```text
T127 domain tests | T128 persistence tests | T129 contracts | T130 Windows missions | T131 E2E missions
T144 mission list | T145 mission detail
```

---

## Implementation Strategy

### MVP first

1. Complete Setup and Foundational phases.
2. Complete US1 only.
3. Stop and independently validate directed handoffs on Windows.
4. Ship/demo the MVP only if its installed-artifact and unknown-delivery gates pass.

### Incremental delivery

1. **MVP — US1**: User-reviewed directed handoffs.
2. **v0.x — US2**: Auditable conversations and structured bridge.
3. **v0.x — US3**: Exact-version lifecycle-aware presentation.
4. **v1 — US4**: Bounded continuation and human escalation.
5. **v1.1 — US5**: Revisioned, scoped shared hive memory.
6. **v1.2 — US6**: Reviewed portable Marvel agent roster.
7. **v1.3 — US7**: Agent creation wizard and versioned generic/user templates.
8. **v1.4 — US8**: Bounded autonomous supervisor missions.

Each increment retains the previous manual path and can stop at its checkpoint without claiming a
later autonomy, memory, provider, hosted-CI, packaging, or production gate.

### Model execution policy

- Use only ChatGPT/OpenAI, Anthropic Claude, and Google Antigravity assignments listed in the plan.
- Recheck exact model names, effort controls, account access, and quota before each story.
- If both the primary and in-ecosystem fallback are unavailable, leave the story unassigned.
- A model never verifies its own safety story alone; deterministic tests and the named independent
  verifier remain required.
- Human acceptance is mandatory for US4 and US8 authority boundaries; US6 import and US7
  save/export confirmations are required but never grant mission authority.

## Notes

- `[P]` means different files or provider-specific implementations with no incomplete dependency.
- Story labels are required only inside user-story phases.
- Tests must demonstrate the intended failure before implementation.
- Do not modify `apps/desktop/src/session-host/index.ts` or `apps/desktop/src/session-host/resize.ts` for
  this feature; integrate through the existing ordered host protocol and preserve the current unrelated edits.
- Do not add a topology graph, avatar, office floor, force layout, decorative animation, hosted broker,
  Git-backed hive, transcript ingestion, or vector-memory dependency.
- Capture local, hosted CI, installed artifact, live Codex, live Claude, model review, and human approval
  as separate evidence statuses.

### Launch policy contract tasks

- [X] T159 [P] Define the launch-resolution contract and precedence (one-run override, exact profile revision, task/project policy, CLI default), including direct model/effort selection, automatic preview refresh, one independent folder-boundary checkbox, and no prompts for readiness probing or app load, in `specs/002-agent-mailbox-routing/spec.md`, `specs/002-agent-mailbox-routing/plan.md`, `specs/002-agent-mailbox-routing/data-model.md`, and `specs/002-agent-mailbox-routing/contracts/provider-coordination.md`
- [X] T160 [P] Add failing-then-passing contract and E2E tests for explicit one-run model/effort selection, explicit CLI-default selection, preview binding, provider argument mapping, and launch confirmation in `tests/contract/provider-adapter.test.ts`, `tests/contract/desktop-ipc-launch.test.ts`, and `tests/e2e/launch-session.spec.ts`
- [X] T161 Implement preview-bound, per-process model/effort selection and confirmation for Codex CLI and Claude Code without editing provider settings; keep effort out of the Munder hire schema in `packages/contracts/src/index.ts`, `packages/providers/src/adapter.ts`, `packages/providers/src/codex.ts`, `packages/providers/src/claude-code.ts`, `apps/desktop/src/main/sessions/preview.ts`, `apps/desktop/src/main/sessions/launch.ts`, and `apps/desktop/src/renderer/features/launch/LaunchDialog.tsx`
- [X] T162 Implement persisted exact-profile, task-type, and project model/effort policy resolution ahead of CLI default; show the resolution source, add lowest-cost Low/Medium test-authoring recommendations, and require a recorded reason for high-cost/high-effort escalation in `apps/desktop/src/main/sessions/launch-policy.ts`, `apps/desktop/src/renderer/features/launch/LaunchDialog.tsx`, `tests/contract/desktop-ipc-launch.test.ts`, and `tests/e2e/launch-session.spec.ts`
- [X] T163 [P] Define the non-manifest runtime permission contract: static personas cannot select permission; Claude automatic workers use supported real `auto`; unavailable auto fails closed without bypass; break-glass bypass is isolated, exact, one-run, non-persisted, non-inherited, and excluded from missions; provider outcomes and independent usage bounds return through main to the supervisor in `specs/002-agent-mailbox-routing/spec.md`, `specs/002-agent-mailbox-routing/plan.md`, `specs/002-agent-mailbox-routing/research.md`, `specs/002-agent-mailbox-routing/data-model.md`, `specs/002-agent-mailbox-routing/contracts/provider-coordination.md`, `specs/002-agent-mailbox-routing/contracts/agent-templates.md`, and `specs/002-agent-mailbox-routing/contracts/supervisor.md`
- [X] T164 [P] Add failing runtime-permission resolution, persona non-authority, exact Claude auto mapping, unavailable-auto/manual-or-allowlist hold, bypass non-persistence, preview-binding, capability-drift, and typed provider-outcome tests in `tests/unit/domain/launch-policy.test.ts`, `tests/contract/provider-adapter.test.ts`, `tests/contract/desktop-ipc-launch.test.ts`, and `tests/integration/windows/provider-permission-policy.test.ts`
- [X] T165 Implement main-owned runtime permission resolution and source disclosure, exact provider capability evidence, per-process Claude auto mapping, bounded allowlist/manual fallback action, and isolated one-run break-glass validation requiring fresh process/filesystem containment, disposable-workspace-only writes, no unrelated credential/environment inheritance, bounded network destinations, and verified cleanup; add elapsed/turn/no-progress/resource bounds, structured progress/cancel, and typed provider outcomes without editing provider/profile/template settings in `apps/desktop/src/main/sessions/launch-policy.ts`, `apps/desktop/src/main/sessions/preview.ts`, `apps/desktop/src/main/sessions/launch.ts`, `packages/contracts/src/index.ts`, `packages/providers/src/adapter.ts`, `packages/providers/src/codex.ts`, `packages/providers/src/claude-code.ts`, and `apps/desktop/src/renderer/features/launch/LaunchDialog.tsx`
- [X] T166 Run one disposable installed Claude auto-mode compatibility proof covering harmless read/edit/test work, classifier denial, unavailable-auto/no-bypass behavior, progress, timeout/cancel/no-progress, usage accounting, fresh process/filesystem containment, disposable-workspace-only writes, bounded credential/environment/network exposure, verified cleanup, and exact CLI/model/provider evidence recorded separately from deterministic tests in `specs/002-agent-mailbox-routing/execution-evidence.md`; MUST complete before T126

### Current release blocker — packaged idle memory

T151 is complete for measurement coverage, not for release performance acceptance. The fresh
x64 package measured399.844 MiB peak after the preload follow-up (413.367 and435.293 MiB on
earlier checkpoints) against the unchanged250 MiB limit on Windows11 Home26200. Median idle CPU
passed. Graphics and blank-runtime diagnostic comparisons
did not meet the memory target; no metric, budget or security boundary was relaxed. Keep this
blocker open alongside T148/T149/T154/T157/T158 until a fresh packaged measurement passes.
See the21:13 diagnosis,21:30 checkpoint and21:52 draft-PR follow-up in `execution-evidence.md`.

### Recorded implementation deviation — US8 trusted output bounds

The original host-file restriction above is retained for traceability. During the authorized
Feature 002 remainder implementation, exact per-attempt output bounds required a narrow addition
to `session-host/index.ts` and its backpressure/output-meter helper: count bytes in the trusted host,
forward only content-free usage/truncation evidence to main, and preserve raw terminal bytes on the
existing renderer stream. The scope decision is recorded in `execution-evidence.md`; it does not
permit general host refactoring or changing `resize.ts`. Existing host edits, ordered controls,
Job-before-create containment, and bootstrap behavior remain preserved. Native/host source review
and Windows regressions verify this bounded deviation; it is not an exception to permission or
process containment requirements.
