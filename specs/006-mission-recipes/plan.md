# Implementation Plan: Mission Recipes

**Branch**: `codex/mission-recipes` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

## Summary

Provide three offline generic starters and personal revisioned recipes. Preview literal substitutions before atomically creating independent editable mission drafts. Main owns validation and SQLite; the existing composer retains workspace, crew, access, limits, review and confirmation authority. Recipes remain non-executable context and separate from agent profiles.

Planning complete; interaction approval, implementation and acceptance pending. This phase creates no tasks or application code.

## Technical Context

**Language/Version**: Existing TypeScript monorepo; manifests declare TypeScript ^6.0.3 and typescript7 ^7.0.2 for typecheck; Node >=22. These are repository declarations, not installed dependency verification.

**Primary Dependencies**: Existing Electron ^44, React ^19.2.8, Zod ^4.4.3, better-sqlite3 ^13.0.3. No new dependency proposed.

**Storage**: Main-owned SQLite, current schema v5. Add a forward migration for recipes, revisions, recoverable editor buffers, operation receipts and independent draft context. Recheck the next migration number immediately before implementation.

**Testing**: Vitest unit/contract/integration; Playwright Electron; Windows interruption, accessibility and usability acceptance. Only fixture provider adapters.

**Target Platform / Type**: Windows 11 x64 local desktop application.

**Performance Goals**: 19/20 list openings with 500 recipes <=1 second; 19/20 maximum compatible previews <=2 seconds. Selected representative machine is this host: Windows 11 Home 10.0.26200 x64, Ryzen 7 5700U, 33,700,167,680 bytes RAM (approximately 32 GiB). Timing/memory measurements remain pending; see quickstart.

**Constraints**: Spec limits plus tighter composer character/UTF-8 limits; no runtime/provider/model/permission bindings or assignments; no workspace writes, polling or decorative rendering. Preserve unsupported data intact.

**Scale/Scope**: Three starters; personal CRUD; 500-recipe measured inventory with 50-summary pages; existing 20-open-mission-draft cap. No import/export, remote sharing, AI generation or marketplace.

## Constitution Check

| Gate | Before research | After design |
|---|---|---|
| I Windows/local first | PASS: local storage | PASS: named Windows host and interruption protocol |
| II useful control | PASS: reusable authoring | PASS: independent drafts only |
| III restrained UI | PASS: list/form | PASS: Missions subview, no idle timers |
| IV explicit authority | PASS: no execution | PASS: strict allowlists, main validation, explicit delete |
| V observable/recoverable | PASS: revision requirement | PASS: transactions, receipts, recovery, focused tests |
| Accessibility/performance | PASS: measurable criteria | PASS: keyboard/200%/AA and memory/render budgets |
| Security/recovery design | PASS: existing validation | PASS: content-free events, scrubbing and rollback design |

Design compliance only, not runtime acceptance. No constitutional exceptions.

## Project Structure

Planning artifacts: `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/mission-recipes.md`, `contracts/interaction-design.md`, `contracts/starters.md`. Future `tasks.md` is deliberately absent.

Planned source responsibilities (new names are proposals):

- `packages/contracts/src/mission-recipes.ts`, exported through `src/index.ts`: strict recipe/editor/preview/receipt contracts.
- `packages/domain/src/mission-recipe.ts` and `mission-recipe-starters.ts`: pure expansion, compatibility and production-only generic starters.
- `packages/persistence/src/schema.ts`, `migrate.ts`, `repositories/mission-recipes.ts`: additive schema, transactions, revisions, scrubbing and recovery.
- `packages/persistence/src/repositories/mission-composer.ts`: atomic draft creation with independent context and context deletion.
- `apps/desktop/src/main/coordination/mission-recipes.ts`, existing IPC router/preload: narrow main-owned operations.
- `apps/desktop/src/renderer/features/mission-recipes/`, `App.tsx`, existing mission-composer features: guarded list/preview/editor and inert role/provenance display.
- Proposed focused tests: `tests/unit/domain/mission-recipes.test.ts`, `tests/unit/persistence/mission-recipes.test.ts`, `tests/contract/mission-recipes.test.ts`, `tests/integration/mission-recipes.test.ts`, `tests/e2e/mission-recipes.spec.ts`.

Retain existing package boundaries and renderer/domain separation.

## Implementation sequence and feature fit

1. Review the interaction contract before UI implementation. Task decomposition may proceed without treating this proposal as approved.
2. Define contracts and pure compatibility logic; implement transactional persistence and failure tests; wire main/preload operations.
3. Deliver US1 starters/preview/new draft, US2 explicit source save/recovery, US3 revisioned maintenance/stale review as independently demonstrable increments.
4. Verify focused regressions and Windows acceptance without real provider sessions.

Feature 002 owns agent templates/profiles, execution, permissions and launch resolution. Reuse validation/revision/SQLite patterns, never AgentManifestV1 or template deletion semantics. Feature 003 owns verified contracts/evidence/receipts; its directory currently has a draft spec, not a plan. Recipe checklist text is only proposed completion evidence. Feature 004 owns six-destination navigation, save-aware exits and identity/focus; use the current App guard and native modal rather than add a global destination. Preserve all existing roadmap and preview deferrals (including those carried into 003); 006 closes none of them.

## Visible dependencies and open review decisions

| Item | Chosen approach | Remaining gate |
|---|---|---|
| Interaction placement | Recipes subview within Missions | Approved 2026-09-07; implementation evidence in validation.md |
| Missing inert role/provenance storage | Independent draft context sidecar | Contract/migration implementation before US1 |
| Missing atomic recipe-create operation | Main validates preview and inserts draft/context/receipt together | Integration tests |
| Composer 4,000/2,000 limits | Show character and UTF-8 bounds; never truncate | Unicode/projection tests |
| Draft JSON 65,536-byte cap | Separate copied context; retain existing cap | Serialized-size tests |
| Migration numbering | Next available after current v5 | Recheck concurrent schema changes |
| Source extraction | Exact accessible source/version plus explicit selected snapshot | Stale/deletion race tests |
| Existing supervisor-commit/draft-conversion crash gap | Inherited composer dependency, outside 006 | Do not claim recipe atomicity solves it |
| Broader 002–004 acceptance | Preserve separate outstanding evidence | No release closure from planning |

No unresolved technical clarification blocks speckit-tasks. These dependencies must become explicit tasks, not hidden assumptions.

## Complexity Tracking

No violations. Separate context storage is necessary for deletion independence and existing JSON byte limits. No provider/model recommendation or runtime launch is part of this plan.

## Implementation reconciliation — 2026-09-07

T002 verified: schema head remains v5; use migration v6 and additive repair entries. Main operation handlers are registered in apps/desktop/src/main/coordinator.ts, typed API in apps/desktop/src/preload/index.ts, operations/names in packages/contracts/src/index.ts and protocol.ts. Vitest discovers tests/unit, tests/contract and tests/integration. Existing objective/evidence limits and mission field_values byte cap remain unchanged. Owner approved the recommended interactions on 2026-09-07; T003 is satisfied.

