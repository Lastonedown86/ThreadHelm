# Focused validation quickstart

The scenarios below define acceptance; current executed results are recorded in validation.md. Use this isolated worktree and temporary local app data; never seed the operator's live database. Owner approved interaction-design.md on 2026-09-07. No provider sessions or workspace modifications are necessary for these tests.

## Prerequisites and commands

Recheck branch/status/selector, migration head and package/test discovery before implementation. Use existing repository Node/pnpm setup and lockfile; do not upgrade dependencies for this feature. From the repository root, after implementation:

```powershell
pnpm typecheck
pnpm lint
pnpm exec prettier --check specs/006-mission-recipes
pnpm exec vitest run --project unit tests/unit/domain/mission-recipes.test.ts tests/unit/persistence/mission-recipes.test.ts
pnpm exec vitest run --project contract tests/contract/mission-recipes.test.ts tests/contract/mission-composer.test.ts
pnpm exec vitest run --project integration tests/integration/mission-recipes.test.ts
pnpm desktop:build
pnpm exec playwright test tests/e2e/mission-recipes.spec.ts tests/e2e/mission-composer.spec.ts tests/e2e/mission-draft-management.spec.ts
```

New filenames are planned and must exist before these are runnable. Include existing draft-save-queue, template and navigation regressions when their shared code changes. Use repository-native fixture adapters and independent main/SQLite readback, not renderer success text alone. Final release checks still include repository-required formatting/static/automated/Windows checks; unrelated failures remain separately reported.

## Story acceptance and requirement coverage

| Scope | Focused proof |
|---|---|
| US1 / FR001–004,007–009 | All three starters preview exact content, create independent draft at Outcome, preserve origin and require normal crew/access/review; literal PR URL causes no fetch |
| US2 / FR005,010–011 | Nothing preselected; exact permitted source fields only; save/restart/reuse; source unchanged; no artifacts/transcripts/evidence/personas copied |
| US3 / FR006–007,010 | Duplicate, edit, disable/re-enable, delete; two independently edited drafts survive restart with exact immutable provenance and unchanged content |
| FR008–009 / SC004 | Required/optional/undeclared/malformed/escaped/repeated tokens; nonrecursive values; every field/count boundary and boundary+1; Unicode/byte/JSON caps; no truncation |
| FR002,004,005,011 / SC003 | Zero launches/provider calls/workspace writes/automatic assignments/inherited approvals; strict forbidden-key rejection and package content audit |
| FR010 / SC004 | Stale saves, database failures, unsupported schemas, lost response, restart and actual interrupted process tests |
| FR012 / SC006 | Keyboard journey, 200%, contrast/reduced motion, focus preservation and 60-second idle observation |

Validate authored credential-like fixtures without logging them; test controls/unpaired surrogates, shell-looking values, URLs, prototype keys and tokens inside values. Confirm rejected input retains other valid fields. Test source changed/deleted after extraction preview, then independent source deletion after save. Test same-name identities, unavailable roles, 20-draft cap races and late async responses. Compare exact contents/IDs before and after operations; no silent mutation permitted.

## Windows interruption and recovery

On temporary on-disk SQLite, inject faults before revision insertion, between revision insertion/head update, before commit, and after commit before acknowledgement. Repeat for draft/context/receipt creation. Use real Windows child-process termination at controlled transaction barriers, not only thrown exceptions. Reopen independently: old complete or new complete revision only, valid head, no orphan/partial draft context, exact receipt retry without duplicate draft. Reuse a request ID with changed content and expect conflict. Test disk-full/write-denied simulation, stale editor, migration failure and safe-buffer recovery. Confirm invalid unsaved input is not persisted/logged and UI never labels it saved.

Exercise fresh DB, v5 upgrade, current extension repair and repeated startup. Existing non-recipe data survives. Unsupported recipe schema remains byte-identical and unavailable. Corrupt storage/journals are preserved under existing recovery flow with explicit disclosure; no silent empty-library success. Verify logical deletion scrubs recipe revisions/editors while independent drafts remain; discarding those drafts scrubs their context. No claim of forensic deletion or of solving the inherited supervisor-confirm crash window.

## Performance, rendering and memory

Selected machine: Windows 11 Home 10.0.26200 x64, Ryzen 7 5700U, approximately 32 GiB RAM, as read during planning. Record actual build, power mode, viewport/text scale and hardware again at measurement. Use the desktop build with isolated fixture data and providers disabled.

Seed 500 spec-valid mixed bundled/personal recipes, including duplicates, disabled and unsupported metadata rows. Measure 20 openings from user activation to actionable first summary page (50 rows), with initial cold opening reported separately; all 500 must remain reachable. Require >=19/20 <=1,000ms. Keep raw samples, not just averages.

Measure 20 maximum-compatible previews from input/preview request to complete readable result. Include 20 variables and repeated placeholders near aggregate limits while respecting objective/evidence byte caps; use roles to exercise larger valid aggregate content. Also measure maximum-authoring but incompatible inputs to prove fast explicit rejection. Require >=19/20 valid previews <=2,000ms. Do not claim an impossible spec-max outcome is composer-compatible.

Proposed additional budgets: <=50 mounted summary rows per page; single selected detail; no bulk revision bodies; recipe-view renderer working-set increase <=64 MiB over settled Missions baseline, and retained increase <=10 MiB after 20 open/close cycles and a controlled test-only GC. Record raw working-set and heap data separately; if test GC unavailable, report unverified retention rather than fabricate precision. No new preview task >100ms on the renderer main thread. During 60 settled idle seconds, zero recipe-driven polling, decorative animation or recurring DOM updates. Existing unrelated activity is identified separately. These budgets are planning targets, not passed evidence.

## Accessibility and usability

On Windows use keyboard-only Tab/Shift+Tab, Enter/Space and Escape for list, fill, preview, create, source selection/save, edit, duplicate, disable and delete. Verify visible focus, accessible names, error associations, announcements, pending states and return focus after cancellation/failure/success. Run at 100% and 200% text scale, including 960x800 and narrower stacked layout; actions and essential content remain reachable. Inspect WCAG 2.2 AA contrast and applicable target/interaction requirements and reduced motion; automated checks alone do not establish keyboard acceptance.

With five usability participants, time creation from a bundled starter; >=4/5 finish an editable draft within two minutes unaided and with zero session starts. Record failures honestly. This human study and Windows measurements remain release gates even if automated tests pass.

## Evidence and readiness

Capture build/revision, commands/results, fixture seed, Windows details, raw timings, memory data, keyboard observations and independent readback. Keep real authored content out of logs/screenshots. Artifact review proves planning only. Task decomposition and owner interaction review are complete. Consult tasks.md and validation.md for remaining acceptance gates; this document alone does not establish release readiness.

## Foundation implementation evidence — 2026-09-07

T004–T010: strict schemas, migration v6, separate main-owned repository, optimistic safe editor buffers and content-free receipts implemented. Focused unit tests: 17 passed; on-disk reopen/failure integration: 1 passed; pnpm typecheck passed. Initial schema/migration run failed 12 tests against missing schemas/v5; repository run failed 3 assertions against the missing repository before implementation. The helper uses temporary on-disk storage and SQL write barriers; actual process-kill durability remains T044, not established by this exception test. This is historical foundation evidence; owner approval is now recorded.

## US1 backend checkpoint — 2026-09-07

T011–T019 implemented and verified; see validation.md for exact test/build evidence. This historical backend checkpoint is superseded by the integrated evidence in validation.md. Preload namespace registration is generated from protocol.ts.


## Integrated implementation checkpoint — 2026-09-07

Owner approval is recorded; starter, explicit personal authoring/recovery, revision/duplicate/availability/deletion and stale-copy behaviors are implemented. See validation.md for all commands and evidence, and performance-results.json for unmodified measured targets and raw samples. The shared save queue is reused through useRecipeEditor.ts; preload methods remain generated. Task ledger is 47/50: T046 full accessibility acceptance, T047 retained working set, and T049 five-person usability are open. No real provider sessions, original-checkout selector changes, commits or pushes occurred.
