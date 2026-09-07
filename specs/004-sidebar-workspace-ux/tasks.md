# Tasks: Slice 1 edit preservation and navigation

Current sequence: [completion roadmap](completion-roadmap.md), based on merged PR #50. Slices 1-19 are merged; slices 20-21 are merged; slice 22 is locally verified pending merge; slices 23-33 are pending. Historical checkpoints below retain their original scope.

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

## Slice 8: ATT-001 only

- [x] T039 Record owner acceptance and queue-selection contract.
- [x] T040 [US7] Add and run failing recovery selection regression in tests/e2e/recovery-selection.spec.ts.
- [x] T041 [US2] Reconcile selected recovery identity against current open records in RecoveryAttentionQueue.tsx.
- [x] T042 [US7] Verify failed/delayed dismissal, neighbor and empty selection, authoritative resolution and restart; run existing recovery regressions.
- [x] T043 Complete static checks, update verification/register and update PR #38.

Dependencies: T039 -> T040 -> T041 -> T042 -> T043. ATT-002/003/004 remain proposed.

## Slice 9: ATT-002 bounded scope clarification

- [x] T044 Record recovery-only scope and guarded mission-return design.
- [x] T045 [US7] Add and run failing attention-scope navigation regression.
- [x] T046 [US2] Add explicit recovery copy, badge description and guarded mission-return controls in App.tsx, RecoveryAttentionQueue.tsx and AppNavigation.tsx.
- [x] T047 [US7] Verify exact mission return and unchanged decision/process state plus existing recovery regressions.
- [x] T048 Finish static checks, verification/register and open PR.

Dependencies: T044 -> T045 -> T046 -> T047 -> T048. ATT-003/004 and A08/A09 remain open.

## Slice 10: ATT-003 reflow

- [x] T049 Record bounded reflow design and merged baseline.
- [x] T050 [US7] Add and run failing Attention layout regression.
- [x] T051 [US2] Correct medium sidebar and recovery content sizing.
- [x] T052 [US7] Verify reflow, exact dismissal and existing recovery/navigation behavior.
- [x] T053 Complete static checks, update evidence/register and open PR.

Dependencies: T049 -> T050 -> T051 -> T052 -> T053. ATT-004 and A08/A09 remain open.

## Slice 11: ATT-004 accessibility

- [x] T054 Record accepted semantics and focus contract.
- [x] T055 [US7] Add and run failing landmark and recovery keyboard regressions.
- [x] T056 [US2] Implement landmark ownership, current selection and conditional focus recovery.
- [x] T057 [US7] Verify independent resolution, delayed focus and existing regressions.
- [x] T058 Complete static checks, update evidence/register and open PR.

Dependencies: T054 -> T055 -> T056 -> T057 -> T058. A08/A09 remain pending.

## A08 audit checkpoint

After PR #41 merged at ca2c620, A08 Settings was audited using the shared template. [Findings and evidence](audits/a08-settings-functionality.md) propose SET-001 through SET-005. No implementation tasks are accepted yet; SET-001 is the recommended next bounded slice. A09 and explicit prior coverage gaps remain open.

## Slice 12: SET-001 pending approval

- [x] T059 Record accepted single-flight approval contract.
- [x] T060 [US7] Add and run failing pending approval regression.
- [x] T061 [US2] Guard approval/cancellation and render pending feedback in WorkspacePanel.tsx.
- [x] T062 [US7] Verify failure/fresh choice, exact persistence and existing regressions.
- [x] T063 Update findings/verification, finish static checks and update PR #42.

Dependencies: T059 -> T060 -> T061 -> T062 -> T063. SET-002 through SET-005 remain proposed.

## Slice 13: SET-002 roster read recovery

- [x] T064 Record accepted read/retry and bounded collection contract.
- [x] T065 [US7] Add and run failing roster recovery regression.
- [x] T066 [US2] Implement load/error/retry state and bounded collection recovery.
- [x] T067 [US7] Verify exact run preservation, failures/late replies and existing regressions.
- [x] T068 Complete static checks, update verification/register and open PR.

Dependencies: T064 -> T065 -> T066 -> T067 -> T068. SET-003/004/005 and A09 remain open.

## Slice 14: SET-003 readiness recheck

- [x] T069 Record accepted explicit recheck contract.
- [x] T070 [US7] Add and run failing recheck and ordering regressions.
- [x] T071 [US2] Implement checking/error feedback, timestamps and stale-evidence protection.
- [x] T072 [US7] Verify workspace and process invariants plus existing regressions.
- [x] T073 Complete static checks, evidence/register and open PR.

Dependencies: T069 -> T070 -> T071 -> T072 -> T073. SET-004/005 and A09 remain open.

## Slice 15: SET-004 Settings reflow

- [x] T074 Record accepted bounded Settings reflow design.
- [x] T075 [US7] Add and run failing Settings and disclosure layout regression.
- [x] T076 [US2] Correct Settings sizing, wrapping and constrained facts.
- [x] T077 [US7] Inspect captures and verify exact actions plus existing regressions.
- [x] T078 Complete static checks, evidence/register and open PR.

Dependencies: T074 -> T075 -> T076 -> T077 -> T078. SET-005 and A09 remain open.

## Slice 16: SET-005 temporary proposal lifetime

- [x] T079 Record accepted lifetime wording and scope.
- [x] T080 [US7] Add and run failing lifetime/restart regression.
- [x] T081 [US2] Add pre-launch and roster guidance with honest loaded-empty wording.
- [x] T082 [US7] Verify exact imported profile, cancellation/restart and existing regressions.
- [x] T083 Complete static checks, update evidence/register and open PR.

Dependencies: T079 -> T080 -> T081 -> T082 -> T083. Durable recovery is deferred; A09 and prior matrix gaps remain open.

## A09 reconciliation checkpoint

After PR #46 merged at `560d4aa`, [A09](audits/a09-cross-section-reconciliation.md) reconciles A01-A08 and slices 1-16 with current observations and explicit gaps. T001-T083 remain complete. MIS-003 is the next proposed bounded slice; no new product implementation tasks are accepted by this audit checkpoint. Extend this ledger after owner acceptance.

## Slice 17: MIS-003 only

- [x] T084 Record accepted fixed-runtime and repair contract.
- [x] T085 [US7] Add and run failing existing-session runtime regression.
- [x] T086 [US3] Implement recorded settings, deliberate repair and exact-worker review recovery.
- [x] T087 [US7] Verify saved values, reopen, ended-session denial and existing regressions.
- [x] T088 Complete static checks, evidence/register and open PR.

Dependencies: T084 -> T085 -> T086 -> T087 -> T088. MIS-004 and remaining findings stay proposed.

## Slice 18: MIS-004 only

- [x] T089 Record accepted folder-level access design and authority boundary.
- [x] T090 [US7] Add and run failing shared-folder/supervisor repair regression.
- [x] T091 [US3] Render unique folder access groups and affected membership.
- [x] T092 [US7] Verify exact saved/review modes, moves, restart and existing regressions.
- [x] T093 Complete static checks, evidence/register and open PR.

Dependencies: T089 -> T090 -> T091 -> T092 -> T093. SES-004 is the next proposed A09 slice; other matrix gaps remain open.

## Slice 19: SES-004 only

- [x] T094 Record accepted launch review recovery and confirmation contract.
- [x] T095 [US7] Add and run failing review recovery regression.
- [x] T096 [US3] Implement invalidation, refresh and single-flight launch guards.
- [x] T097 [US7] Verify exact outcomes, expiry, failed/late refresh and existing launch regressions.
- [x] T098 Complete static checks, evidence/register and open PR.

Dependencies: T094 -> T095 -> T096 -> T097 -> T098. TPL-002 is next proposed; other audit gaps remain open.

## Completion roadmap checkpoint

Owner requested a numbered roadmap after PR #50 merged at `42ff10b`. The roadmap maps 18 remaining finding IDs to 12 implementation/revalidation slices and two final verification slices. T001-T098 remain complete; future granular tasks will be added when each bounded slice starts. This documentation checkpoint performs no product implementation. Next: slice 20, TPL-002.

## Slice 20: TPL-002 only

- [x] T099 Record accepted deletion review recovery contract and baseline.
- [x] T100 Add and run failing deletion recovery regression.
- [x] T101 Implement invalidation, fresh review and deletion-specific feedback.
- [x] T102 Verify denial, recovery, cancellation and independent saved state plus regressions.
- [x] T103 Complete static checks, evidence/register/roadmap and open PR.

Dependencies: T099 -> T100 -> T101 -> T102 -> T103. Next roadmap slice: 21, SES-002.

## Slice 21: SES-002 only

- [x] T104 Verify merged baseline and record accepted inventory/selection policy.
- [x] T105 Reproduce ineffective selected-ended collapse with an Electron regression.
- [x] T106 Share visibility between list, tabs and dock; implement deterministic collapse selection.
- [x] T107 Verify all-ended, mixed, scope, lifecycle and cross-section behavior independently.
- [x] T108 Complete checks, register/roadmap/evidence and open PR.

Dependencies: T104 -> T105 -> T106 -> T107 -> T108. Next: slice 22, SES-003 and remaining SES-005.

## Slice 22: session tabs and terminal IDs

- [x] T109 Verify merge and record bounded identity/keyboard contract.
- [x] T110 Add failing same-provider keyboard/identity/DOM regression.
- [x] T111 Implement roving tabs, panel relationships and unique terminal IDs.
- [x] T112 Verify exact selection, hidden panels, scope/disclosure and process invariants.
- [x] T113 Complete static checks, audit/roadmap/evidence and PR.

Dependencies: T109 -> T110 -> T111 -> T112 -> T113. Next: slice 23, Mission draft inventory/management.

## Slice 23: Mission draft inventory and management

- [x] T114 Verify merged baseline and record bounded draft interaction/authority contract.
- [x] T115 Reproduce missing identity and normal discard using Electron regression.
- [x] T116 Implement saved summaries, exact discard recovery and bounded rail.
- [x] T117 Verify capacity, saved/deleted IDs, restart, failure and dense layout.
- [x] T118 Complete checks, evidence/register/roadmap and open PR.

Dependencies: T114 -> T115 -> T116 -> T117 -> T118. Next: slice 24, saved template/agent draft identity.
