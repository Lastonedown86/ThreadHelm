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

## Slice 3: roster access and selection (AGT-001/002)

Owner instruction "Lets do the next slice" accepts the recommended AGT-001 + AGT-002 interaction on 2026-09-05. Baseline main a8b9483, audit bab108b, branch codex/audit-agents-templates. US2/US4 own complete roster access and coherent selection; US7 owns exact saved-state verification. AGT-003 and TPL-001/002 remain proposed.

Reuse profiles.list cursor contract in 50-item pages with Load more profiles and a shown count. Paging preserves the selected ID. On profile events, reload all requested pages and publish them atomically, deduplicating IDs because updated profiles can move across page boundaries. This trades a small bounded number of reads per user/event refresh for coherent inventory; no polling or new dependencies. Filter changes reset paging, clear an excluded detail, and use filter-specific empty copy with Show all profiles. Import returns to All and selects the imported profile. Stale results cannot overwrite newer requests. Failed list/detail requests offer explicit retry and never claim an empty inventory. A new detail ID remounts the panel, and sequence changes hide stale actionable detail while loading.

Renderer-only changes in AgentProfileList.tsx and AgentProfileDetail.tsx; existing revision-bound eligibility mutation remains authoritative. No IPC/schema/migration or execution-authority change. Rollback reverts these renderer changes without data repair. Constitution check before/after design: PASS. Prerequisite resolution succeeded for Feature 004; all 16 requirement checklist items checked. The main selector bytes are restored to Feature 002 after resolution. No extension hooks configured.

Regression plan: red-first Electron scenarios seed 51 profiles, reach the last profile, preserve exact selection, mutate exact eligibility, reset filters and verify empty state with authoritative readback. Existing profile import/history and wizard suites remain selected regressions. Full async failure/latency matrix must be labeled according to evidence, not inferred from happy-path success.

## Slice 4: exact supersession review (MEM-001)

Owner instruction "next slice" accepts the recommended MEM-001 flow on 2026-09-05. Baseline d8a5075, audit d8623bd, branch codex/audit-memory-functionality. FR-010/011/017/018 and US7 require exact reviewed-to-saved content and independent proof. MEM-002/003/004 remain proposed.

Keep editing in the existing supersession dialog. Title/body edits invalidate the disclosure immediately; Append is available only after reviewing the current text. Display the exact reviewed title/body. Scope, revision, confidence and citations remain main-token bound. Pending review disables editing and repeated review; cancellation invalidates late responses. Pending append disables editing/cancel/repeated append. Failures retain fields, clear the rejected disclosure and offer a fresh review with an alert inside the dialog. A changed detail invalidates obsolete requests. No polling, dependencies, IPC/schema changes or provider execution. Rollback is a renderer revert. Constitution check: PASS. Prerequisites resolve Feature 004; checklist 16/16; selector restored byte-for-byte to Feature 002; no hooks configured.

Red-first Electron regression: review then independently change title and body; assert Append disappears, fresh exact disclosure and saved content match, cancellation writes no revision, restart retains exact values. Controlled IPC rejection/delay covers fresh-review recovery and late response after cancellation; existing Memory E2E and contract checks retain authority coverage.

## Slice 5: stable Memory search scope (MEM-003)

Owner accepted the recommended MEM-003 slice via "Next slicew". Baseline main 9d99ac6 (PR #34), branch codex/memory-search-scope. Keep MemoryList mounted as the single owner of selected scope and search state. Guided requests carry a new request version, including repeated identical queries, without resetting scope or contested filtering. All search paths use the selected approved workspace. Input/scope/filter changes invalidate outstanding search and detail responses immediately; newer searches supersede older responses and errors. Revoked scope falls back to an approved workspace with cleared results. No IPC, persistence, dependencies or provider authority changes. MEM-002/004 remain outside scope. Constitution check PASS; Feature 002 selector preserved; no extension hooks.

Verify red-first two-workspace UI scope continuity, repeated guided queries, and controlled late search/detail responses with main-owned exact identity readback. Run existing Memory E2E, typecheck/lint/build; open the PR automatically after passing verification as authorized.
