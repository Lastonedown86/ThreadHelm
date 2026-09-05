# Implementation Plan: Edit preservation and navigation consistency

Branch: `codex/audit-sidebar-mission-functionality`. Date: 2026-09-05. [Specification](spec.md).

## Summary and accepted scope

Owner instruction "Start with recommended" accepts the proposed first slice: MIS-001 and MIS-002 (NAV-001–003). Implement save-aware exits and synchronized navigation, including edits made while a save is in flight. This is a bounded US2 implementation with US7 verification; other findings and section audits remain open. The original whole-feature audit-before-planning sequence is narrowed by this explicit owner direction.

## Technical Context

TypeScript / React renderer in the existing Electron Windows desktop app. SQLite remains main-process owned. Existing versioned missionComposer operations remain the only persistence API. No migrations, new dependencies, provider execution, or process-authority changes. Tests: Vitest for deterministic save ordering and Playwright Electron for UI plus authoritative readback. Supported verification environment: Windows 11 Home x64, release 10.0.26200.

Performance: retain the 800ms debounce; at most one draft save in flight; no polling or new idle timers. Navigation adds only a pending-save wait. Scope is six destinations and entry/draft/mission transitions, not large-inventory redesign. Test delayed saves using controlled promises rather than timing thresholds. Existing broad performance gates remain open.

## Constitution Check

Before research and after design: PASS. Local Windows behavior; restrained native modal; no renderer OS access; same version-bound persistence contracts; explicit unsaved exit; durable-readback regression checks. No authority or security exception. Failed navigation retains editable content. Rollback is reverting renderer changes without data migration.

## Project Structure

- `apps/desktop/src/renderer/App.tsx`: common guarded navigation and view ownership.
- `apps/desktop/src/renderer/features/mission-composer/useDraft.ts`: current snapshot and save serialization.
- `apps/desktop/src/renderer/features/mission-composer/draft-save-queue.ts`: deterministic single-flight save utility.
- `apps/desktop/src/renderer/features/mission-composer/MissionComposerWorkspace.tsx`: draft loading and flush readiness.
- `apps/desktop/src/renderer/features/mission-focus/MissionRail.tsx`: selection/focus after accepted navigation.
- `tests/unit/renderer/draft-save-queue.test.ts`: concurrent edits, failure/retry, serialization.
- `tests/e2e/mission-navigation.spec.ts`: six destinations, draft replacement, failed save and mission selection.

Planning setup ran in an isolated worktree so the main checkout selector stays on Feature 002. Generated artifacts are copied to the implementation branch. No external research uncertainty requires dispatch. No extension hooks are configured.

## Implementation strategy

Write failing regression tests, serialize saves until the latest snapshot is acknowledged, centralize navigation with a failure decision, then build and exercise the UI. Separate audit evidence (pre-fix baseline) from implementation verification. See [tasks](tasks.md), [research](research.md), [data model](data-model.md), [contract](contracts/navigation.md), and [quickstart](quickstart.md).

## Complexity Tracking

No constitutional violations. Reuse the existing native ModalDialog; no new routing framework or persistence service.

## Slice 2: explicit session scope (SES-001)

Owner instruction "Recommended" on 2026-09-05 accepts SES-001 only, following the A03 report. Branch: `codex/audit-sessions-functionality`; baseline main `83883d0`, audit commit `35a5bed`. US2/US3.3 own predictable navigation and exact-session landing; US7 owns independent process readback. Other A03 findings remain proposed.

Interaction: a native Session scope selector offers All sessions (default) and Selected mission (disabled without a selected mission), with a visible result count. The global Sessions button always returns to All sessions, even from the same destination. Mission Open terminal chooses Selected mission and its exact session. A successful local or recovery launch opens All sessions and selects the returned ID. Attention selection survives returning to Sessions. Changing filters selects the first visible session only if the current selection is excluded; returning to All sessions preserves any still-visible selection.

Implementation: renderer store holds ephemeral scope; destination navigation resets it to all, and mission terminal entry overrides it in the same event. SessionWorkspace filters only on explicit mission scope and identity-matching mission detail. Stale detail supplies no filter candidates. Reuse existing save-aware App navigation and process contracts. No migration, new dependency, timer, IPC authority or persistence change. Constitution check before/after design: PASS. Revert renderer changes to roll back; no data repair required.

Verification: add red-first Electron regressions for launches, filter reset and Attention navigation with authoritative live session/PID snapshots; extend mission terminal coverage and no-mission coverage. Build, typecheck, lint and run selected process-control/accessibility regressions. Preserve A03 baseline evidence separately. The Feature 002 selector remains unchanged.
