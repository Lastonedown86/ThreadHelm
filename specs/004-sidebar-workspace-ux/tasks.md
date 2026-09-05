# Tasks: Slice 1 edit preservation and navigation

Scope: accepted MIS-001/002 only. Other Feature 004 work is not included in this completion ledger. Specification US2 owns behavior; US7 owns independent proof. Tests are required by FR-016–019 and the constitution.

## Phase 1: Setup

- [x] T001 Record accepted scope and architecture in specs/004-sidebar-workspace-ux/plan.md and contracts/navigation.md; preserve the main checkout selector.

## Phase 2: Foundation

- [x] T002 Add deterministic failing save-order tests in tests/unit/renderer/draft-save-queue.test.ts.

## Phase 3: US2 predictable navigation and preserved edits

Independent criterion: exact draft fields survive transitions, failures retain the editor, and selected mission matches rendered content.

- [x] T003 [US2] Add failing UI/readback cases in tests/e2e/mission-navigation.spec.ts.
- [x] T004 [US2] Implement serialized snapshot-aware flushing in apps/desktop/src/renderer/features/mission-composer/draft-save-queue.ts and useDraft.ts.
- [x] T005 [US2] Centralize guarded exits and failure choices in apps/desktop/src/renderer/App.tsx; remount/load drafts safely in MissionComposerWorkspace.tsx and align MissionRail.tsx selection/focus.

## Phase 4: US7 observed effects

Independent criterion: isolated Windows UI tests prove persistence/target outcomes without trusting success notices.

- [x] T006 [US7] Run new regressions and selected existing composer/workspace/accessibility specs; record outcomes in specs/004-sidebar-workspace-ux/verification.md.

## Phase 5: Polish

- [x] T007 Run build, typecheck, lint, scoped formatting and whitespace/secret checks; update specs/004-sidebar-workspace-ux/audit-register.md with exact disposition and limitations.

Dependencies: T001 -> T002/T003 -> T004 -> T005 -> T006 -> T007. T002 and T003 are independent test-authoring opportunities; execute serially in this task. Unit and static verification can run together once implementation is stable. No agent delegation required. MVP is the complete US2 slice with its US7 proof; do not generate tasks for unaudited sections.

## Slice 2: SES-001 only

Owner accepted the recommended session-scope design on 2026-09-05. Earlier T001-T007 remain the completed MIS-001/002 ledger.

- [x] T008 Record accepted SES-001 scope, state and navigation contract in specs/004-sidebar-workspace-ux/plan.md, data-model.md and contracts/navigation.md.
- [x] T009 [US3] Add and run a failing scope/launch regression in tests/e2e/session-scope.spec.ts.
- [x] T010 [US2] Implement explicit renderer scope and navigation entry behavior in apps/desktop/src/renderer/store.tsx, App.tsx and features/sessions/SessionWorkspace.tsx.
- [x] T011 [US7] Verify exact mission terminal, unrelated launch, Attention return, empty state and unchanged processes in tests/e2e/session-scope.spec.ts and mission-focus-workspace.spec.ts; run selected existing regressions.
- [x] T012 Record build/static/functional outcomes and SES-001 disposition in specs/004-sidebar-workspace-ux/verification.md and audit-register.md.

Dependencies: T008 -> T009 -> T010 -> T011 -> T012. Other SES findings remain unapproved. This slice does not close A03's remaining audit matrix or Feature 004.

## Slice 3: AGT-001/002 only

- [x] T013 Record owner acceptance and bounded roster design in specs/004-sidebar-workspace-ux/plan.md, data-model.md and contracts/navigation.md.
- [x] T014 [US7] Add and run failing pagination and filtered-selection scenarios in tests/e2e/agent-roster-navigation.spec.ts.
- [x] T015 [US4] Implement bounded pages, event refresh and selection reconciliation in apps/desktop/src/renderer/features/coordination/AgentProfileList.tsx.
- [x] T016 [US2] Add identity-safe detail loading/retry in apps/desktop/src/renderer/features/coordination/AgentProfileDetail.tsx.
- [x] T017 [US7] Run exact-state UI regressions and existing roster/wizard checks; record evidence in specs/004-sidebar-workspace-ux/verification.md.
- [x] T018 Complete static/artifact checks and update specs/004-sidebar-workspace-ux/audit-register.md dispositions.

Dependencies: T013 -> T014 -> T015/T016 -> T017 -> T018. Other audit findings remain proposed; no parallel agents required.

## Slice 4: MEM-001 only

- [x] T019 Record accepted exact-review behavior and bounded renderer design in plan.md and contracts/navigation.md.
- [x] T020 [US7] Add and run failing exact-review regression in tests/e2e/memory-review.spec.ts.
- [x] T021 [US2] Implement disclosure invalidation, pending guards and in-dialog recovery in apps/desktop/src/renderer/features/coordination/MemoryDetail.tsx.
- [x] T022 [US7] Verify exact saved values/restart, cancellation, rejected review and delayed responses; run existing Memory regressions.
- [x] T023 Record validation and disposition in verification.md and audit-register.md; complete static checks.

Dependencies: T019 -> T020 -> T021 -> T022 -> T023. Other Memory findings and A07-A09 remain open.

## Slice 5: MEM-003 only

- [x] T024 Record accepted scope and search ownership contract in plan.md and contracts/navigation.md.
- [x] T025 [US7] Add and run failing scoped guided-search regression in tests/e2e/memory-search-scope.spec.ts.
- [x] T026 [US2] Retain MemoryList instance and guard search/detail request identities in MemoryLibraryWorkspace.tsx and MemoryList.tsx.
- [x] T027 [US7] Verify two-workspace and delayed-response behavior plus existing Memory regressions.
- [x] T028 Update verification/register, complete static checks and open a PR.

Dependencies: T024 -> T025 -> T026 -> T027 -> T028. MEM-002/004 remain proposed.

## Slice 6: MEM-004 only

- [x] T029 Record accepted paging-selection design in plan.md and contracts/navigation.md.
- [x] T030 [US7] Add and run failing paging/retry regression in tests/e2e/memory-paging-selection.spec.ts.
- [x] T031 [US2] Preserve selected detail on appended results in MemoryList.tsx.
- [x] T032 [US7] Verify failed-page retry, exact selected detail and context clearing; run Memory regressions.
- [x] T033 Complete static checks, update verification/register and open a PR.

Dependencies: T029 -> T030 -> T031 -> T032 -> T033. MEM-002 and A07-A09 remain open.

## Slice 7: MEM-002 temporary reading list

- [x] T034 Record accepted temporary-list architecture and contract.
- [x] T035 [US7] Add and run failing lifecycle/navigation regression in tests/e2e/memory-reading-list.spec.ts.
- [x] T036 [US2] Store content-free edition references in store.tsx and render refreshed lifecycle in MissionReadingList.tsx; wire MemoryLibraryWorkspace.tsx.
- [x] T037 [US7] Verify exact edition, lifecycle/deletion, dedup/removal, navigation and restart; run Memory regressions.
- [x] T038 Complete static checks and evidence, update register, open PR.

Dependencies: T034 -> T035 -> T036 -> T037 -> T038. Durable mission association and A07-A09 remain outside scope.
