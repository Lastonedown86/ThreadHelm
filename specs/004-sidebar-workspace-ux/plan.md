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
