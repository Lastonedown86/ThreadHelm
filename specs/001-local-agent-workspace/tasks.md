---
description: "Task list for ThreadHelm Local Agent Workspace MVP"
---

# Tasks: ThreadHelm Local Agent Workspace MVP

**Input**: Design documents from `/specs/001-local-agent-workspace/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks ARE included. The plan mandates them as release gates (Test Strategy and Release Gates 1-6), so they are not optional for this feature.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every task

## Path Conventions

pnpm workspace per plan.md "Project Structure": `apps/desktop/`, `packages/*`, `native/windows-supervisor/`, `tests/*` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Workspace, toolchain, and quality gates

- [X] T001 Create pnpm workspace root in pnpm-workspace.yaml, package.json, and tsconfig.base.json with TypeScript 7 strict settings
- [X] T002 [P] Scaffold the Electron app with electron-vite 5 and Electron Forge 7 in apps/desktop/package.json, apps/desktop/electron.vite.config.ts, and apps/desktop/forge.config.ts targeting Electron 44
- [X] T003 [P] Scaffold packages/contracts, packages/domain, packages/persistence, packages/providers, and packages/test-fixtures each with package.json and tsconfig.json
- [X] T004 [P] Scaffold the Node-API crate in native/windows-supervisor/Cargo.toml and native/windows-supervisor/src/lib.rs using napi-rs on Rust 1.98
- [X] T005 [P] Configure ESLint and Prettier with an import boundary rule that forbids Electron imports outside apps/desktop in eslint.config.js and .prettierrc
- [X] T006 [P] Configure the Vitest unit and contract projects in vitest.workspace.ts with coverage thresholds
- [X] T007 [P] Configure Rust gates in rust-toolchain.toml and .cargo/config.toml with clippy and rustfmt enforcement
- [X] T008 Add the Windows x64 and ARM64 CI workflow running format, lint, typecheck, cargo check, and all test projects in .github/workflows/ci.yml

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The native boundary, contracts, domain, persistence, and process topology every user story depends on

**CRITICAL**: No user story work can begin until this phase is complete. T014 is a plan-level architecture gate: if it fails, stop and reassess the Electron approach against a Tauri/Rust shell before continuing.

- [X] T009 [P] Define shared Zod 4 schemas, command/event names, and stable error codes in packages/contracts/src/index.ts per contracts/desktop-ipc.md
- [X] T010 [P] Implement Job Object create, assign, verify membership, terminate, and close in native/windows-supervisor/src/job.rs per contracts/windows-supervisor.md
- [X] T011 [P] Implement canonical directory identity via final path and FILE_ID_INFO, rejecting UNC, network, removable, and device-namespace targets, in native/windows-supervisor/src/identity.rs
- [X] T012 Expose the Node-API surface and generated TypeScript types in native/windows-supervisor/src/lib.rs and native/windows-supervisor/index.d.ts (depends on T010, T011)
- [X] T013 [P] Write Cargo tests for Job Object lifecycle, membership verification, and identity rejection cases in native/windows-supervisor/src/tests.rs
- [X] T014 **Architecture proof gate**: prove a dormant Electron utility process is assigned to and verified inside a KILL_ON_JOB_CLOSE Job Object before launching any descendant, in tests/integration/windows/job-object-proof.test.ts (depends on T012)
- [X] T015 [P] Implement the session lifecycle state machine with every legal and illegal transition in packages/domain/src/session-lifecycle.ts per data-model.md "Lifecycle state"
- [X] T016 [P] Implement the activity state model including the honest unknown state in packages/domain/src/activity-state.ts
- [X] T017 [P] Implement the one-writer controller lease policy keyed by canonical workspace identity in packages/domain/src/controller-lease.ts
- [X] T018 [P] Write domain unit tests for lifecycle transitions, activity states, and lease conflicts in tests/unit/domain/
- [X] T019 Create the SQLite schema and migration runner with foreign keys on, rollback journal, and synchronous FULL in packages/persistence/src/schema.ts and packages/persistence/src/migrate.ts
- [X] T020 Implement repositories for the durable entities in packages/persistence/src/repositories/index.ts (depends on T019)
- [X] T021 Implement the privacy filter that rejects raw output, input, prompts, environment values, credentials, and probe output before persistence in packages/persistence/src/sanitize.ts, with tests in tests/unit/persistence/sanitize.test.ts
- [X] T022 [P] Define the ProviderAdapter interface, ProbeContext, ReadinessResult, LaunchContext, and LaunchDescriptor types in packages/providers/src/adapter.ts per contracts/provider-adapter.md
- [X] T023 [P] Build deterministic fake terminal agents covering burst output, control sequences, ignore-interrupt, and child-spawning behavior in packages/test-fixtures/src/fake-agent.ts
- [X] T024 Implement the session host bootstrap and message protocol skeleton in apps/desktop/src/session-host/index.ts per contracts/session-host.md
- [X] T025 Implement the narrow typed preload bridge with one method per approved operation in apps/desktop/src/preload/index.ts
- [X] T026 Implement the main-process IPC router that schema-validates every request and rejects generic channels in apps/desktop/src/main/ipc/router.ts (depends on T009, T025)
- [X] T027 Apply the Electron security baseline (sandbox, context isolation, no node integration, CSP, Electron Fuses) in apps/desktop/src/main/window.ts and apps/desktop/forge.config.ts
- [X] T028 [P] Implement structured sanitized lifecycle logging in apps/desktop/src/main/logging.ts
- [X] T029 Acquire the single-instance lock before opening storage or supervision, and bootstrap userData SQLite, in apps/desktop/src/main/bootstrap.ts

**Checkpoint**: Native boundary proven, contracts and domain testable, process topology in place — user stories can begin

---

## Phase 3: User Story 1 - Approve a Workspace and Launch an Agent (Priority: P1) — MVP

**Goal**: A user selects a local folder, reviews the granted scope, picks an available agent, and gets an interactive session running in that exact workspace.

**Independent Test**: Select an accessible Windows folder, approve it, launch one available agent, and verify the session opens in the selected workspace without granting another folder.

### Tests for User Story 1

- [X] T030 [P] [US1] Contract tests for workspaces.choose/approve/list/revoke and their error codes in tests/contract/desktop-ipc-workspaces.test.ts
- [X] T031 [P] [US1] Contract tests for adapter probe and launch descriptor behavior in tests/contract/provider-adapter.test.ts
- [X] T032 [P] [US1] Windows integration tests for spaces, Unicode, long paths, reparse points, and file identity aliases in tests/integration/windows/workspace-identity.test.ts
- [X] T033 [P] [US1] Contract tests for sessions.previewLaunch and sessions.launch token flow and stale-preflight failure in tests/contract/desktop-ipc-launch.test.ts
- [X] T034 [P] [US1] End-to-end approve, disclose, launch journey in tests/e2e/launch-session.spec.ts

### Implementation for User Story 1

- [X] T035 [P] [US1] Implement the ApprovedWorkspace repository in packages/persistence/src/repositories/workspaces.ts
- [X] T036 [P] [US1] Implement AgentDefinition and AgentReadinessSnapshot repositories in packages/persistence/src/repositories/providers.ts
- [X] T037 [US1] Implement the native directory picker and short-lived candidate token, rejecting user-supplied path strings as approval, in apps/desktop/src/main/workspaces/choose.ts
- [X] T038 [US1] Resolve canonical identity and reject unsupported volumes through the native module in apps/desktop/src/main/workspaces/identity.ts (depends on T012)
- [X] T039 [US1] Implement approve, list, and revoke workspace services in apps/desktop/src/main/workspaces/service.ts (depends on T035, T037, T038)
- [X] T040 [P] [US1] Implement the Codex CLI adapter in packages/providers/src/codex.ts
- [X] T041 [P] [US1] Implement the Claude Code adapter in packages/providers/src/claude-code.ts
- [X] T042 [US1] Implement readiness probing for trusted executable resolution, supported version, and authentication state without persisting probe output in apps/desktop/src/main/providers/readiness.ts
- [X] T043 [US1] Implement previewLaunch disclosure plus revalidation that blocks stale workspace, executable, version, or auth assumptions in apps/desktop/src/main/sessions/preview.ts
- [X] T044 [US1] Implement launch orchestration: durable starting record in a transaction, Job Object creation, dormant host start, membership verification, then validated launch descriptor, in apps/desktop/src/main/sessions/launch.ts (depends on T012, T020, T024, T043)
- [X] T045 [US1] Create the single PTY with the canonical workspace as working directory and adapter-owned arguments only in apps/desktop/src/session-host/pty.ts using node-pty 1.1
- [X] T046 [P] [US1] Build the workspace approval and provider readiness screens in apps/desktop/src/renderer/features/workspaces/
- [X] T047 [P] [US1] Build the launch disclosure dialog showing effective path, agent, version, and boundary scope in apps/desktop/src/renderer/features/launch/
- [X] T048 [US1] Render live session output with xterm.js 6 in apps/desktop/src/renderer/features/session/Terminal.tsx
- [X] T049 [US1] Surface blocked-launch reasons as actionable errors in apps/desktop/src/renderer/features/launch/LaunchErrors.tsx

**Checkpoint**: One agent launches safely in an approved workspace — MVP is demoable

---

## Phase 4: User Story 2 - Supervise Multiple Live Agents (Priority: P2)

**Goal**: Multiple independent sessions stay identifiable, correctly attributed, and separately controllable.

**Independent Test**: Launch at least two sessions in approved workspaces, send distinct input to each, and verify status, input, and output stay with the correct session.

### Tests for User Story 2

- [X] T050 [P] [US2] Contract tests for sessions.sendInput, sessions.resize, and MessagePort frame ordering in tests/contract/session-stream.test.ts
- [X] T051 [P] [US2] Windows integration test running four concurrent fixture sessions with isolation assertions in tests/integration/windows/multi-session.test.ts
- [X] T052 [P] [US2] Integration test for backpressure under a large output burst with disclosure of discarded output in tests/integration/windows/backpressure.test.ts
- [X] T053 [P] [US2] End-to-end multi-session input routing and activity indicators in tests/e2e/multi-session.spec.ts

### Implementation for User Story 2

- [X] T054 [US2] Implement the per-session MessagePort transport with ordered bounded frames in apps/desktop/src/main/sessions/stream.ts
- [X] T055 [US2] Implement high/low watermark pause and resume with acknowledgement only after xterm write completes in apps/desktop/src/session-host/backpressure.ts
- [X] T056 [US2] Enforce the 10,000-line bounded scrollback and disclose discarded output in apps/desktop/src/renderer/features/session/buffer.ts
- [X] T057 [US2] Route input to the selected session only, with serialized ordering, in apps/desktop/src/main/sessions/input.ts
- [X] T058 [US2] Enforce the one-writer rule that blocks a second write-capable session on the same effective workspace in apps/desktop/src/main/sessions/lease.ts (depends on T017)
- [X] T059 [US2] Derive activity state from structured evidence and report unknown when evidence is untrustworthy in apps/desktop/src/main/sessions/activity.ts (depends on T016)
- [X] T060 [US2] Confine terminal output by disabling or explicitly gating clipboard, hyperlink, file, and OS-action escape sequences in apps/desktop/src/renderer/features/session/xterm-security.ts
- [X] T061 [US2] Build the session list with identity, state, and new-activity indicators in apps/desktop/src/renderer/features/sessions/SessionList.tsx
- [X] T062 [US2] Isolate per-session PTY and native failures into an actionable failed state without affecting other sessions in apps/desktop/src/main/sessions/failure.ts
- [X] T063 [US2] Serialize resize against concurrent input and output bursts in apps/desktop/src/session-host/resize.ts

**Checkpoint**: US1 and US2 both work independently — four sessions supervised without cross-talk

---

## Phase 5: User Story 3 - Interrupt or Stop Work Safely (Priority: P3)

**Goal**: Interrupt, stop, and force-stop act on the exact displayed target, escalate safely, and cover the whole supervised process scope.

**Independent Test**: Start two distinguishable sessions, interrupt one, stop the other, and verify each action affects only its displayed target and produces an understandable final state.

### Tests for User Story 3

- [X] T064 [P] [US3] Contract tests for interrupt, requestStop/confirmStop, and requestForceStop/confirmForceStop token binding in tests/contract/desktop-ipc-control.test.ts
- [X] T065 [P] [US3] Windows integration tests for descendant processes, ignored interrupts, force-stop, and residual process reporting in tests/integration/windows/stop-escalation.test.ts
- [X] T066 [P] [US3] Integration test that coordinator termination closes job handles and kills every supervised tree in tests/integration/windows/coordinator-death.test.ts
- [X] T067 [P] [US3] End-to-end interrupt/stop targeting and close blocking in tests/e2e/stop-control.spec.ts

### Implementation for User Story 3

- [X] T068 [US3] Send Ctrl+C to the selected ConPTY and report returned-to-interactive, exited, or unresponsive in apps/desktop/src/main/sessions/interrupt.ts
- [X] T069 [US3] Implement clean stop: block new input, request the adapter's graceful exit, drain output, and wait a bounded grace period, in apps/desktop/src/main/sessions/stop.ts
- [X] T070 [US3] Implement force stop with explicit confirmation, TerminateJobObject, and empty-scope verification in apps/desktop/src/main/sessions/force-stop.ts (depends on T012)
- [X] T071 [US3] Query and report any process still alive after the selected stop level in apps/desktop/src/main/sessions/process-scope.ts
- [X] T072 [US3] Retain every live Job Object handle for the coordinator lifetime in apps/desktop/src/main/native/job-registry.ts
- [X] T073 [US3] Implement application.requestClose that lists active sessions and requires cancel or stop-all in apps/desktop/src/main/lifecycle/close.ts
- [X] T074 [US3] Build confirmation dialogs showing the exact target, requested action, and force-stop risk in apps/desktop/src/renderer/features/control/

**Checkpoint**: Users retain full local process control across all three stories

---

## Phase 6: User Story 4 - Understand State After Restart (Priority: P4)

**Goal**: After any restart or power event, every prior session shows an honest state with no automatic relaunch or input replay.

**Independent Test**: Run multiple sessions, close ThreadHelm during activity, restart it, and verify every prior session has an honest recovery record without automatic relaunch.

### Tests for User Story 4

- [X] T075 [P] [US4] Contract tests for recovery.resolve and sessions.list recovery views in tests/contract/desktop-ipc-recovery.test.ts
- [X] T076 [P] [US4] Windows integration tests for crashes during starting, interrupting, stopping, and output in tests/integration/windows/recovery.test.ts
- [X] T077 [P] [US4] Integration tests for suspend, resume, lock, unlock reconciliation and second-instance behavior in tests/integration/windows/power-and-instance.test.ts
- [X] T078 [P] [US4] End-to-end restart recovery view with explicit next actions in tests/e2e/recovery.spec.ts

### Implementation for User Story 4

- [X] T079 [US4] Reconcile unfinished durable sessions to recovery_required at startup without PID reattachment, relaunch, or input replay, in apps/desktop/src/main/recovery/reconcile.ts
- [X] T080 [US4] Implement the RecoveryRecord repository and resolution transitions in packages/persistence/src/repositories/recovery.ts
- [X] T081 [US4] Recheck sessions on suspend, resume, lock, and unlock in apps/desktop/src/main/recovery/power-events.ts
- [X] T082 [US4] Focus the existing controller on a second launch instead of creating another one in apps/desktop/src/main/bootstrap.ts (depends on T029)
- [X] T083 [US4] Open corrupt or incompatible storage through a bounded recovery path that preserves the original for diagnosis in packages/persistence/src/recovery.ts
- [X] T084 [US4] Block new launches and durable control transitions on storage write failure while keeping live sessions visible and controllable, with a degraded-state warning, in apps/desktop/src/main/storage-health.ts
- [X] T085 [US4] Handle workspace approval revoked while associated sessions still exist in apps/desktop/src/main/workspaces/revocation.ts
- [X] T086 [US4] Build the recovery view with per-record next actions in apps/desktop/src/renderer/features/recovery/

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T087 [P] Configure signed x64 and ARM64 Windows installers with checksums, fuses, and ASAR integrity in apps/desktop/forge.config.ts
- [X] T088 Build the installed-artifact acceptance suite validating signing, fuses, ASAR integrity, native module loading, and displayed version on clean Windows systems in tests/acceptance/installed-app.test.ts
- [X] T089 [P] Build the separate non-recording credentialed provider smoke suite in tests/acceptance/provider-smoke.test.ts
- [X] T090 [P] Add accessibility gates for keyboard-only operation, focus visibility, text scaling, WCAG 2.2 AA contrast, and reduced motion in tests/e2e/accessibility.spec.ts
- [X] T091 [P] Add performance gates for recovery view within 5s, 95% of output within 1s, input acknowledged within 100ms, idle median CPU at or below 1% over 60s, and four-session memory in tests/integration/windows/performance.test.ts
- [X] T092 [P] Document install, launch, and the safety model in README.md and docs/
- [X] T093 Run the full quickstart.md validation path against a packaged build
- [X] T094 Review the implementation against the trust boundary table in plan.md and record the Windows release and workflow actually tested

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. T014 is a hard architecture gate
- **User Stories (Phases 3-6)**: All depend on Phase 2; then parallelizable across developers
- **Polish (Phase 7)**: Depends on the desired user stories being complete

### Critical Path

T001 → T003/T004 → T010/T011 → T012 → **T014 (gate)** → T019/T020 → T024/T026 → T044 → T045 → US1 complete

### User Story Dependencies

- **US1 (P1)**: Needs Phase 2 only. No dependency on other stories
- **US2 (P2)**: Needs Phase 2; reuses the US1 launch path but is independently testable with two fixture sessions
- **US3 (P3)**: Needs Phase 2; testable against fixture sessions without US2's multi-session UI
- **US4 (P4)**: Needs Phase 2 persistence; testable by crashing with any single session present

### Parallel Opportunities

- Setup: T002-T007 in parallel after T001
- Foundational: T009, T010, T011, T013 in parallel; T015-T018 in parallel; T022, T023, T028 in parallel
- Every story's test tasks are [P] with each other
- US1: T035/T036 in parallel, T040/T041 in parallel, T046/T047 in parallel
- Polish: T087, T089, T090, T091, T092 in parallel

---

## Parallel Example: User Story 1

```bash
# Tests first, all in parallel:
Task: "Contract tests for workspaces.* in tests/contract/desktop-ipc-workspaces.test.ts"
Task: "Contract tests for provider adapter in tests/contract/provider-adapter.test.ts"
Task: "Windows path identity tests in tests/integration/windows/workspace-identity.test.ts"
Task: "Launch token flow tests in tests/contract/desktop-ipc-launch.test.ts"

# Then the parallel implementation pairs:
Task: "Codex CLI adapter in packages/providers/src/codex.ts"
Task: "Claude Code adapter in packages/providers/src/claude-code.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational — **stop at T014**; if the Job Object proof fails, reassess the Electron shell before writing further code
3. Phase 3: User Story 1
4. **STOP and VALIDATE**: approve a folder, launch one agent, confirm the workspace and safety controls
5. Demo the MVP

### Incremental Delivery

1. Setup + Foundational → foundation proven
2. + US1 → launch works (MVP)
3. + US2 → four supervised sessions
4. + US3 → safe interrupt and stop
5. + US4 → honest recovery
6. + Polish → signed installers pass acceptance, accessibility, and performance gates

---

## Notes

- Tests are release gates here, not optional; write each story's tests before its implementation
- Raw terminal content, input, prompts, environment values, credentials, and probe output are never persisted — T021 enforces this and every persistence task must route through it
- T014 failure blocks the Electron plan and triggers the Tauri/Rust reassessment named in plan.md
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
