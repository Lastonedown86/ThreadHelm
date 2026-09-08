# Tasks: Mission Recipes

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [interface contract](contracts/mission-recipes.md), [interaction proposal](contracts/interaction-design.md), [starters](contracts/starters.md), [quickstart](quickstart.md).

**Branch**: `codex/mission-recipes`. **Generated**: 2026-09-07. **Status**: implementation delivered; 47/50 tasks completed. T046 accessibility acceptance, T047 retained working-set performance, and T049 human usability remain open. See validation.md.

**Tests**: Included because the spec explicitly requires persistence failure, Windows, authority-boundary and acceptance validation, and the constitution requires automated transition/IPC coverage. Write focused tests before the behavior they verify and establish meaningful failing evidence. No provider sessions are required; use isolated fixtures.

**Organization**: Shared foundation, then US1 (P1), US2 (P2), US3 (P2), then cross-cutting acceptance. Paths are repository-relative; proposed new files are intentional. Existing workspace/package structure is reused. No new framework, dependency upgrade, commit or push is implied.

## Format and execution rules

Every task uses `- [ ] Tnnn [P?] [USn?] description with exact file path`. `[P]` identifies independent files within the explicitly stated ready batch, not permission to ignore prerequisites. Tests and implementation touching the same file run sequentially. Story completion requires independent authoritative readback, not just renderer success messages.

UI review was approved by the owner on 2026-09-07. T003 gates renderer implementation tasks T020–T022, T032–T033 and T042; it does not gate foundation or backend work. The approval is explicit in the conversation and recorded in interaction-design.md; no repeat approval is needed.

## Phase 1: Setup

**Purpose**: Preserve checkout scope and make integration constraints reviewable.

- [X] T001 Recheck branch, dirty files, local Feature 006 selector and original checkout Feature 002 selector; record implementation baseline and unchanged Feature 002–004 deferrals in specs/006-mission-recipes/research.md without modifying unrelated files or selectors.
- [X] T002 Reconcile current schema head, schema-extension repair, main coordinator/preload registration, composer limits and test discovery with the plan; record the next available migration number and actual integration paths in specs/006-mission-recipes/plan.md before schema work.
- [X] T003 Present the existing bounded Missions list/preview/editor proposal and record explicit owner approval or requested revisions in specs/006-mission-recipes/contracts/interaction-design.md before any renderer implementation; do not infer approval from task generation.

## Phase 2: Foundational prerequisites

**Purpose**: Shared strict types, persistence layout and recovery facilities. Requires T001–T002; T003 can remain pending while these proceed.

- [X] T004 Define strict content/variable/revision/preview/editor/receipt/context schemas and safe issue codes in packages/contracts/src/mission-recipes.ts and export through packages/contracts/src/index.ts; enforce data-model bounds, reject authority keys, reuse authored-text validation and avoid cyclic imports from the contracts barrel.
- [X] T005 [P] Add schema boundary tests in tests/unit/contracts/mission-recipes-schemas.test.ts for every field/count maximum and maximum+1, forbidden keys, unsafe controls/secrets/surrogates, incomplete safe editor content, 1 MiB serialized payload bounds and metadata-only unsupported-version summaries (after T004).
- [X] T006 [P] Add migration tests in tests/unit/persistence/mission-recipes-migration.test.ts for fresh DB, current v5 upgrade, repeated startup, extension repair convergence, migration rollback and preservation of existing records and unsupported recipe bytes (after T002/T004).
- [X] T007 Add the reconciled forward migration and extension definitions in packages/persistence/src/schema.ts and packages/persistence/src/migrate.ts for recipes, immutable revisions, editor buffers, independent draft contexts and content-free receipts; retain existing SQLite durability and 65,536-byte mission field_values cap (after T005–T006).
- [X] T008 Establish repository row mapping, transaction participation, optimistic identity/editor versions, bounded JSON validation and receipt lookup/conflict helpers in packages/persistence/src/repositories/mission-recipes.ts; export through packages/persistence/src/repositories/index.ts and packages/persistence/src/index.ts without adopting agent-template quotas (after T007).
- [X] T009 Add isolated temporary-database and main-service fixture helpers in tests/integration/helpers/mission-recipes.ts, including controlled write/commit barriers and independent readback; never use the operator database or real provider adapters (after T008).
- [X] T010 Verify T005–T009 tests and shared schema exports; record foundation results and any unresolved migration/contract dependencies in specs/006-mission-recipes/quickstart.md; do not mark a gate passed from source inspection alone.

**Checkpoint**: Foundation ready. All stories require T010; renderer work additionally requires T003.

## Phase 3: US1 — Start from a useful recipe (P1, MVP)

**Goal**: Three generic starters create previewed independent editable mission drafts without starting work.

**Independent test**: Select each starter, fill required literal values, preview and create a draft at Outcome. Independently read exact objective/evidence/roles/provenance; edit one of two copies and verify the recipe/other draft remain unchanged. Verify zero starts, assignments or inherited permissions and normal composer review remains required.

### Tests first

- [X] T011 [P] [US1] Add pure expansion/projection tests in tests/unit/domain/mission-recipes.test.ts for required/optional values, undeclared/prototype keys, escaped/malformed/repeated tokens, nonrecursive shell/URL values, 64,000-unit aggregate expansion, newline accounting, canonical trim and objective/evidence 4,000/2,000 UTF-16 AND UTF-8 limits.
- [X] T012 [P] [US1] Add list/get/preview/createDraft contract tests in tests/contract/mission-recipes.test.ts for strict sender/request/response validation, exact token binding, unsupported/disabled sources, request-ID conflicts, safe errors and no provider/supervisor/workspace effects.
- [X] T013 [P] [US1] Add atomic application tests in tests/unit/persistence/mission-recipes.test.ts for sourceMissionId=null, draft/context/receipt all-or-nothing writes, 20-open-draft cap races, lost-response retry returning one draft and recipe-independent snapshot readback.

### Implementation

- [X] T014 [US1] Implement the single-pass literal scanner, authored validation and deterministic composer projection in packages/domain/src/mission-recipe.ts; return explicit field/byte/expanded/serialized issues without truncating or executing values (after T011).
- [X] T015 [US1] Define exactly Investigate a bug, Review a PR and Prepare a release in packages/domain/src/mission-recipe-starters.ts using contracts/starters.md; use stable shipped identities/revisions and direct production exports with no private persona or fixture-barrel dependency (after T014).
- [X] T016 [US1] Implement immutable bundled seeding, 50-summary cursor pages, exact-ID reads and visibly unavailable unsupported/disabled records in packages/persistence/src/repositories/mission-recipes.ts; never overwrite changed content under an existing revision ID (after T015).
- [X] T017 [US1] Extend packages/persistence/src/repositories/mission-composer.ts and packages/contracts/src/index.ts with independent recipe-context read/update support, original snapshot immutability and context scrubbing on draft discard; create draft/context/receipt atomically with the cap check, and save editable roles under the owning draft version without adding runtime fields (after T013/T016).
- [X] T018 [US1] Implement list/get/preview/createDraft in apps/desktop/src/main/coordination/mission-recipes.ts, including main-owned tokens, revision plus availability-version rechecks, receipt-first retries and safe content-free events; explicitly allowlist authority projection in apps/desktop/src/main/coordination/mission-composer.ts so sidecar context never enters an envelope (after T014–T017).
- [X] T019 [US1] Register typed recipe operations/events in packages/contracts/src/index.ts, apps/desktop/src/main/coordinator.ts and apps/desktop/src/preload/index.ts through apps/desktop/src/main/ipc/router.ts; reuse sender validation and expose no OS/provider access (after T018).
- [X] T020 [US1] Build paged list and exact-preview literal form in apps/desktop/src/renderer/features/mission-recipes/MissionRecipeLibrary.tsx and RecipePreview.tsx with purpose/origin/revision/ID, field/byte guidance, explicit Create draft, stale refresh retaining compatible values, late-response protection and draft-cap recovery (after T003/T019).
- [X] T021 [US1] Add Missions-local recipe entry and save-aware navigation in apps/desktop/src/renderer/App.tsx; open the returned exact draft at Outcome through the existing guard and retain the current composer on save failure, without adding a global destination (after T020).
- [X] T022 [US1] Display captured origin and editable inert role suggestions in apps/desktop/src/renderer/features/mission-composer/RecipeContext.tsx and integrate with MissionComposerWorkspace.tsx and useDraft.ts; preserve versioned single-flight saves, independent copied text and normal Crew/Access/Review confirmation (after T017/T021).
- [X] T023 [US1] Add and run starter, bounds, cap, keyboard-entry and independent-two-draft Electron scenarios in tests/e2e/mission-recipes.spec.ts, plus regressions in tests/contract/mission-composer.test.ts and tests/unit/renderer/draft-save-queue.test.ts; use main-owned readback and record results in specs/006-mission-recipes/quickstart.md (after T022).

**Checkpoint**: Starter-only MVP demonstrated; no personal authoring required for this checkpoint. Windows/content-boundary release gates remain applicable.

## Phase 4: US2 — Save a reusable structure (P2)

**Goal**: Explicitly select permitted draft/mission structure, preview and durably save a personal recipe with recoverable editing.

**Independent test**: From an ordinary accessible draft or mission, select allowed fields with nothing preselected, save the preview, restart and create a new independent draft. Verify original source unchanged, forbidden source data absent and failed saves preserve valid input without success claims.

### Tests first

- [X] T024 [P] [US2] Add source-selection/editor/save contract tests in tests/contract/mission-recipe-authoring.test.ts for exact accessible source version, allowed field paths, no default selections, stale/deleted source races, prohibited text and literal URL behavior.
- [X] T025 [P] [US2] Add durable personal-save/editor tests in tests/unit/persistence/mission-recipe-authoring.test.ts for initial identity/revision/time, complete safe-buffer recovery, incomplete required fields, stale editor versions, failed saves, receipt retry and independence after source deletion.
- [X] T026 [P] [US2] Add authoring queue tests in tests/unit/renderer/recipe-save-queue.test.ts for edits during save, flush/navigation failure, obsolete replies and accurate saved versus pending state; ensure prohibited text is never submitted as a recoverable buffer.

### Implementation

- [X] T027 [US2] Implement open/get/save/discard editor and atomic personal initial-revision save in packages/persistence/src/repositories/mission-recipes.ts, writing content/head/receipt and consuming the reviewed buffer in one transaction; preserve valid edits on stale/failure and distinguish durable buffer from available recipe (after T024–T026).
- [X] T028 [US2] Implement exact-version read-only source extraction in apps/desktop/src/main/coordination/mission-recipe-source.ts for objective, newline-split completionEvidence and existing inert roles only; exclude workers/profile bodies/transcripts/artifacts/evidence/runtime settings and return selected paths only (after T027).
- [X] T029 [US2] Implement previewSource/openEditor/getEditor/saveEditor/previewSave/save/discardEditor in apps/desktop/src/main/coordination/mission-recipes.ts; bind tokens to source/editor/base versions, revalidate before commit and support deliberate independent manual editing after a stale/deleted source (after T028).
- [X] T030 [US2] Register authoring schemas/operations in packages/contracts/src/index.ts, apps/desktop/src/main/coordinator.ts and apps/desktop/src/preload/index.ts; include a bounded editor-summary listing operation for restart discoverability and document it in specs/006-mission-recipes/contracts/mission-recipes.md (after T029).
- [X] T031 [US2] Implement versioned safe-buffer single-flight saves and last-acknowledged recovery state in apps/desktop/src/renderer/features/mission-recipes/recipe-save-queue.ts using the existing queue pattern; retain invalid input only in current renderer memory and never claim unacknowledged keystrokes survive restart (after T026/T030; UI approval required if rendering is introduced).
- [X] T032 [US2] Build explicit unchecked field selection, personal content/variable editor, exact save preview and exact-ID resume list in apps/desktop/src/renderer/features/mission-recipes/RecipeEditor.tsx; retain oversized text for correction, disclose source-sensitive text and require fresh review after failures (after T003/T031).
- [X] T033 [US2] Integrate Save as recipe from drafts/missions and guarded editor exits in apps/desktop/src/renderer/App.tsx and apps/desktop/src/renderer/features/mission-recipes/MissionRecipeLibrary.tsx; flush source drafts before capture and use shared retry/discard modal conventions with focus restoration (after T032).
- [X] T034 [US2] Add and run source-selection/save/failure/restart/reuse Electron scenarios in tests/e2e/mission-recipe-authoring.spec.ts with authoritative selected-content/source-unchanged readback and update specs/006-mission-recipes/quickstart.md with US2 evidence (after T033).

**Checkpoint**: Personal saving works independently from recipe maintenance. Restart resume is tested, not inferred from in-memory input retention.

## Phase 5: US3 — Maintain recipes without changing existing work (P2)

**Goal**: Duplicate, revision-edit, disable/enable and explicitly delete personal recipes while preserving existing draft content and provenance.

**Independent test**: Create two drafts, edit them differently, revise/disable/delete their personal recipe and restart. Exact draft copies and origin revisions remain unchanged; stale previews cannot create; bundled originals remain intact.

### Tests first

- [X] T035 [P] [US3] Add maintenance/token contract tests in tests/contract/mission-recipe-maintenance.test.ts for bundled denials, duplicate revision selection, edit conflicts, disable/re-enable invalidation, delete cancellation/failure/fresh review and wrong-target tokens.
- [X] T036 [P] [US3] Add revision/deletion tests in tests/unit/persistence/mission-recipe-maintenance.test.ts for immutable revisions, atomic head updates, same-name identities, non-content tombstones/receipts, full source/editor scrubbing and two independent drafts surviving source maintenance/restart.

### Implementation

- [X] T037 [US3] Implement duplicate and revisioned edit saves in packages/persistence/src/repositories/mission-recipes.ts with new personal identity for copies, exact base compare-and-swap and immutable source revision attribution; never overwrite or relink existing draft snapshots (after T035–T036).
- [X] T038 [US3] Implement enable/disable version changes and explicit personal deletion in packages/persistence/src/repositories/mission-recipes.ts; scrub source revisions/buffers, preserve content-free retry tombstones and derived drafts, and deny bundled maintenance (after T037).
- [X] T039 [US3] Implement duplicate/edit preview and availability/delete tokens in apps/desktop/src/main/coordination/mission-recipes.ts; invalidate tokens on identity-version changes, recheck inside mutation transactions, resolve committed receipts before token expiry checks and emit metadata only (after T038).
- [X] T040 [US3] Register maintenance operations in packages/contracts/src/index.ts, apps/desktop/src/main/coordinator.ts and apps/desktop/src/preload/index.ts while preserving strict request/response authority boundaries (after T039).
- [X] T041 [US3] Add tested stale-value reconciliation in packages/domain/src/mission-recipe.ts and tests/unit/domain/mission-recipes.test.ts: retain compatible variable-key values, flag changed/removed declarations and require reviewed refresh after revision/disable/re-enable; never substitute another recipe after deletion (after T040).
- [X] T042 [US3] Integrate personal Edit/Duplicate/Enable/Disable and bundled Customize in apps/desktop/src/renderer/features/mission-recipes/RecipeEditor.tsx and MissionRecipeLibrary.tsx, plus exact-ID native confirmation in RecipeDeleteDialog.tsx; disclose retained copies, prevent double submits, preserve failures and return focus predictably (after T003/T041).
- [X] T043 [US3] Add and run maintenance/stale-preview/two-draft-restart Electron scenarios in tests/e2e/mission-recipe-maintenance.spec.ts, independently verify deletion scrubbing and unchanged captured provenance, and record US3 evidence in specs/006-mission-recipes/quickstart.md (after T042).

**Checkpoint**: All three stories demonstrable; final acceptance still required.

## Phase 6: Polish and cross-cutting acceptance

**Purpose**: Validate the full feature without closing unrelated roadmap obligations. Requires completed story implementations; tests below may be authored earlier but measurements need the integrated build.

- [X] T044 [P] Add real Windows child-process termination tests in tests/integration/mission-recipes.test.ts using tests/integration/helpers/mission-recipes.ts at pre-insert, between revision/head writes, precommit and postcommit/preack barriers for revision and draft/context/receipt saves; reopen and prove old/new complete state, no duplicate retry or partial content, safe-buffer recovery and explicit storage failure outcomes.
- [X] T045 [P] Add packaged starter/content-boundary checks in tests/unit/fixtures/mission-recipe-release-content.test.ts for direct production imports, no private persona/fixture-barrel leakage, forbidden authority fields and content-free logs/events/errors; assert zero recipe-triggered provider/network/workspace/process effects with isolated fixtures.
- [ ] T046 [P] Add Windows keyboard/200%-scale/reduced-motion scenarios in tests/e2e/mission-recipe-accessibility.spec.ts covering all flows and failure modals, focused-control visibility, labels/error announcements, target reachability and six-destination navigation; include manual contrast checks per quickstart.md.
- [ ] T047 [P] Add measurable 500-recipe list and maximum-compatible preview instrumentation in tests/e2e/mission-recipe-performance.spec.ts: 20 samples each with >=19 under 1s/2s, cold sample disclosure, all pages reachable, <=50 mounted summaries, renderer task <=100ms, <=64 MiB incremental working set, <=10 MiB retained growth and zero recipe polling/decorative updates in 60 idle seconds per quickstart.md.
- [X] T048 Run focused suites, existing composer/draft/navigation/template regressions where touched, formatting, lint, typecheck and desktop build from specs/006-mission-recipes/quickstart.md on the selected Windows host; record raw timing/memory/accessibility/fault results and exact command failures in specs/006-mission-recipes/validation.md, keeping unmeasured gates open.
- [ ] T049 Conduct the five-participant starter usability check defined in specs/006-mission-recipes/quickstart.md and record results in specs/006-mission-recipes/validation.md: >=4/5 unaided editable drafts within two minutes, zero starts; leave pending if participants are unavailable rather than substituting automated evidence.
- [X] T050 Reconcile FR001–012 and SC001–006 with named evidence, owner interaction approval, rollback/recovery guidance and outstanding dependencies in specs/006-mission-recipes/validation.md and quickstart.md; preserve Feature 002–004 deferrals and the inherited supervisor-confirm crash gap, and do not claim release readiness from partial results.

## Dependencies and execution order

```text
T001 -> T002 -> T004 -> (T005 || T006) -> T007 -> T008 -> T009 -> T010
T003 owner interaction approval ---------------------------------> renderer tasks
T010 -> US1 T011–T023 -> US2 T024–T034 -> US3 T035–T043
US3 -> (T044 || T045 || T046 || T047) -> T048 -> T049 -> T050
```

T003 is an external review gate; numbering does not prohibit backend work while it is pending. Within each story follow task order except explicitly parallel test batches; dependencies in descriptions refine this order. The diagram uses `||` for different-file opportunities, not an instruction to spawn agents.

US1 has no dependency on personal authoring or maintenance. US2 uses US1 list/apply plumbing to prove saved-recipe reuse. US3 uses US2 editor/save plumbing; test setup can seed personal records directly so the maintenance behavior is independently testable. Full story implementation is deliberately sequential because repository, service, contracts and App files are shared. Do not advertise these stories as conflict-free parallel work.

### Parallel examples

- US1 after T010: T011 domain tests, T012 IPC tests and T013 repository tests can be authored concurrently in separate files. Their implementation follows after failing behavior is established.
- US2 after T023: T024 extraction/authoring contracts, T025 persistence tests and T026 queue tests can be authored concurrently. T027–T034 remain sequential integration work.
- US3 after T034: T035 maintenance contract tests and T036 persistence tests can be authored concurrently. T037–T043 share implementation files and remain sequential.
- Foundation after T004: T005 and T006 are independent test files. Final acceptance: T044–T047 are separate harnesses, but do not run performance measurement concurrently with fault injection/builds; T048 runs controlled measurements.

## Requirement traceability

| Requirement / criterion | Primary tasks |
|---|---|
| FR001 starters/list | T015–T016, T020, T023 |
| FR002 content-only authority | T004–T005, T012, T018–T019, T045 |
| FR003 independent previewed draft | T011–T014, T017–T023 |
| FR004 existing review/crew authority | T018, T021–T023, T045 |
| FR005 explicit personal source selection | T024, T028–T034, T045 |
| FR006 revision/duplicate/disable/delete | T035–T043 |
| FR007 stale preview | T012, T018, T020, T035, T039–T043 |
| FR008 literal bounded values | T004–T005, T011, T014, T024, T041 |
| FR009 composer/spec compatibility | T004–T005, T011, T014, T017, T020, T032 |
| FR010 durable complete recovery | T006–T010, T013, T017, T025–T031, T036–T039, T044 |
| FR011 local persistence/deletion | T007–T008, T017–T019, T028, T038, T043–T045 |
| FR012 accessibility/idle | T020–T022, T032–T033, T042, T046–T048 |
| SC001 usability | T049 |
| SC002 exact independent copies | T013, T023, T025, T034, T036, T043 |
| SC003 no runtime side effects | T012, T018, T023–T024, T045 |
| SC004 explicit failure outcomes | T005–T006, T011–T013, T024–T026, T035–T036, T044 |
| SC005 Windows performance | T047–T048 |
| SC006 keyboard/scaling/idle | T046–T048 |

## Implementation strategy

Deliver foundation plus US1 as the smallest useful MVP: three starters, exact preview and independent editable drafts. Complete its relevant authority, persistence and Windows checks before describing that increment as verified. Add US2 personal saves, then US3 maintenance, validating each independently and rerunning touched shared behavior. Finish measured Windows and human acceptance before full feature closure.

No application work was performed during task generation. No external provider runs, commits or pushes are authorized by this artifact. Unknown migration numbering is resolved by T002; missing context/atomic-create/editor-list contracts are explicit tasks rather than assumed existing APIs. Interaction approval is complete; usability participation remains an external gate.

## Generation validation

50 unchecked tasks: Setup 3; Foundation 7; US1 13; US2 11; US3 9; cross-cutting 7. Story labels appear only in story phases. Fourteen tasks have [P] markers within the ready batches above. Before/after task hooks: `.specify/extensions.yml` absent at generation, so none to dispatch. Original planning documents retain their planning-time status; this tasks artifact records the subsequent decomposition phase.





## Execution reconciliation — 2026-09-07

Owner approval completed T003. After the US1 backend checkpoint, disjoint backend authoring/maintenance files and US1 renderer integration were assigned separately; no agent concurrently edited another owner's files. Shared backend stories were implemented sequentially. Story acceptance used the integrated build before final checks. This was an explicit file-ownership refinement of the original coarse story ordering.

T026/T031 reuse `features/mission-composer/draft-save-queue.ts` and its existing unit regressions, with `useRecipeEditor.ts` owning recipe hydration, safe validation, debounce and acknowledgement state. A delayed real IPC Electron case in `mission-recipe-authoring.spec.ts` proves edits during a save drain before navigation with exactly one writer; invalid-buffer navigation/recovery is also exercised there. No duplicate queue file was needed. T023 evidence spans the starter/cap tests, maintenance two-copy restart test, accessibility keyboard test and focused domain/contract bounds checks. T030/T040 preload methods are generated from protocol names; no manual preload implementation was necessary.

T044 includes 18 real Windows termination cases, readonly failure, independent safe-buffer reopen and SQLite `SQLITE_FULL` capacity simulation with rollback. It does not fill the physical drive. T045 checks starter serialization, actual built desktop output, strict content boundaries and zero recipe-triggered authority effects; a final installer was not produced.

T046 remains open for manual contrast/OS text scaling and full source-selection/failure keyboard acceptance; automated 100/200% keyboard and reduced-motion checks pass. T047 executed and remains open because retained working-set increase was 27.32 MiB against the original 10 MiB limit, despite timing/idle checks passing. T049 is pending because five participants were unavailable. T048 records both passing checks and the known failed performance gate. T050 reconciliation is complete without claiming feature/release acceptance.

PR 66 follow-up: initial-renderer and recipe-browsing loading boundaries now pass the full contract suite. T046 source-selection/failure keyboard checks and measured text contrast now pass; actual Windows OS scaling and remaining manual checks stay open. T047 remains failed after loading fixes and untraced/DOM diagnostics. See pr-fix-evidence.md and evidence/ for captured results.
