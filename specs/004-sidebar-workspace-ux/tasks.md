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
