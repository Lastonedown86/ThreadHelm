# Feature 006 implementation evidence

Date: 2026-09-07. Baseline `f8a2c80`, branch `codex/mission-recipes`, isolated Windows worktree. Implementation is uncommitted. The owner accepted the proposed interactions before renderer work. **47/50 tasks are complete; feature acceptance is not complete.** T046, T047 and T049 remain open as detailed below.

## Delivered behavior

Three generic bundled starters offer literal inputs, an exact preview and independent editable drafts at Outcome. No workspace approvals, runtime permissions, provider/model choices, profile bodies, assignments or launch authority are copied. Existing Crew, Access & limits, Review and confirmation remain authoritative. Recipes have their own contracts and lifecycle, separate from agent-profile templates.

Personal authoring selects nothing automatically. Draft edits flush before exact-version source selection. Selected oversized text remains visible for correction before a bounded durable buffer is created. An 800ms single-flight queue reports only acknowledged saves as recoverable; exact-ID editor resume works after restart. Final save requires its own exact content preview and returns a durable receipt. Revision edits, duplicates, disable/re-enable, explicit deletion, stale refresh and deliberate independent copies preserve existing draft content and provenance.

SQLite migration v6 and extension repair cover six recipe tables: identities, immutable revisions, editor buffers, draft contexts, operation receipts and copy-origin IDs. Draft/context/receipt creation and personal revision/head/buffer/receipt changes commit atomically. The existing 65,536-byte draft JSON limit and tighter 4,000/2,000 character-and-UTF-8 composer limits remain intact. Preload methods are generated from protocol names, so no hand-written preload method was required. No dependency or lockfile update was needed.

## Verification results

| Check | Result |
|---|---|
| Unit selection: all persistence plus recipe/composer schemas, recipe/template domain, navigation, shared save queue and content guard | 192 tests passed in 22 files |
| Contract selection: recipe apply/authoring/maintenance, existing composer and agent templates | 32 tests passed in 5 files |
| Initial integration selection: recipe termination/recovery and foundation reopen | 20 tests passed in 2 files |
| Added SQLite FULL integration case | 1 passed; 19 nonmatching cases skipped in that targeted run |
| Electron composer, draft inventory and navigation regressions plus recipe stories | 28 distinct scenarios passed across runs; affected navigation/authoring/starter rerun passed 13/13; final stale-editor independent-copy test passed |
| Keyboard/reduced-motion checks | 100% and 200% text-scale runs passed; post-fix 200% screenshot inspected |
| Static checks | `pnpm lint`, `pnpm typecheck` and scoped Prettier checks passed; final diff whitespace checked |
| Windows native runtime | `pnpm native:build` passed; fixture-only Electron tests used isolated userData |
| Desktop build/content guard | `pnpm desktop:build` passed; actual `apps/desktop/out` recursively passed `assertProductionPersonaBoundary` |
| Performance acceptance | Timing, bounded rows, observed long tasks and idle checks passed; retained working-set gate FAILED |

Commands used the existing lockfile and repository tools. The initial PowerShell/pnpm array-based formatter invocation treated all filenames as one pattern and failed. Direct Node invocation of the same installed Prettier CLI with native argument splatting succeeded; final matched-file formatting and `git diff --check` passed. The main focused selections were:

```powershell
pnpm exec vitest run --project unit tests/unit/persistence tests/unit/contracts/mission-recipes-schemas.test.ts tests/unit/contracts/mission-composer-schemas.test.ts tests/unit/domain/mission-recipes.test.ts tests/unit/domain/agent-template.test.ts tests/unit/renderer/draft-save-queue.test.ts tests/unit/renderer/navigation.test.ts tests/unit/fixtures/mission-recipe-release-content.test.ts
pnpm exec vitest run --project contract tests/contract/mission-recipes.test.ts tests/contract/mission-recipe-authoring.test.ts tests/contract/mission-recipe-maintenance.test.ts tests/contract/mission-composer.test.ts tests/contract/agent-templates.test.ts
pnpm exec vitest run --project integration tests/integration/mission-recipes.test.ts tests/integration/mission-recipe-foundation.test.ts
pnpm exec playwright test tests/e2e/mission-recipes.spec.ts tests/e2e/mission-recipe-authoring.spec.ts tests/e2e/mission-recipe-maintenance.spec.ts tests/e2e/mission-composer.spec.ts tests/e2e/mission-draft-management.spec.ts tests/e2e/mission-navigation.spec.ts
pnpm exec playwright test tests/e2e/mission-recipe-accessibility.spec.ts tests/e2e/mission-recipe-performance.spec.ts
```

No full-repository test, hosted CI, installer or real-provider acceptance claim is made. Existing composer regressions use isolated fixture adapters; no real ChatGPT, Claude or Google Antigravity provider session was launched.

## Failures found and corrected

Initial foundation tests failed on missing schemas, repository operations and v5 rather than v6. Main authoring tests first failed on unknown operations. An aggregate-context regression showed objective-only edits could ignore retained role length; validation now checks retained context as well. Initial Electron launch lacked the Windows native binding; the existing native build resolved that prerequisite. The starter journey caught a missing returned role setter/state and passed after correction.

The 200% keyboard run found preview heading focus could occur before React committed the new element. Preview focus now runs after commit, and both scale tests pass. The broad regression run passed 23/25 but exposed two failures because the existing mission save-failure dialog accessible name had changed. Restoring that name for ordinary mission drafts fixed both; all six navigation scenarios passed on rerun. A delayed IPC save test additionally proves two edit snapshots drain serially before navigation with one writer and the exact latest content persisted.

## Windows durability and boundaries

The integration harness uses actual child-process termination with temporary on-disk SQLite. Eighteen cases cover bundled revision/head writes, personal create/edit transactions and draft/context/receipt creation at preinsert, intermediate, precommit and postcommit/preack barriers. Independent reopen checks complete old/new state, integrity, foreign keys, editor consumption or retention, immutable prior revision content, exact retry and no duplicate identity/revision/draft.

Readonly simulation preserves the acknowledged safe buffer. A separate real SQLite `SQLITE_FULL` result, induced through `max_page_count` on isolated storage, rolls back the complete personal save and leaves the acknowledged editor available after reopen. This does not fill the physical system drive. Migration failure rolls back v6, fresh/v5/repaired startup converges, and unsupported recipe bytes remain unchanged. No test claims forensic deletion or hardware failure coverage.

Strict schemas reject authority keys and unsafe authored content. Literal URL/shell-shaped text generates no fetch, session, workspace approval or log content. Recipe service dependencies are limited to storage, health, clock and metadata events. Starter serialization and actual built desktop files pass the existing private-persona scanner with a tested positive contamination control. No private persona is bundled by this feature. A final installer-wide acceptance run remains separate.

## Performance evidence and unresolved gate

Raw samples, machine details and original targets are in [performance-results.json](performance-results.json). Windows 10.0.26200, Ryzen 7 5700U, about 32 GiB RAM, Balanced power, 960x800. Fixture: 500 recipes, including duplicate names and disabled rows; maximum-compatible preview is 64,000 expanded units with 20 variables.

- List openings: 20/20 below 1,000ms; cold 88.69ms, range 34.86–88.69ms.
- Previews: 20/20 below 2,000ms; range 51.68–97.30ms. Incompatible rejection: 56.05ms.
- All 500 identities reached; at most 50 summaries mounted. No observed renderer long tasks.
- Sixty idle seconds: zero recipe DOM mutations and zero running animations. Source review finds no recipe polling; IPC request counts were not instrumented.
- First-open working-set increase: 6.17 MiB, below 64 MiB.
- **Retained working-set increase after 20 cycles and controlled GC: 27.32 MiB, above 10 MiB.** Used JavaScript heap increased 1.54 MiB. Working set alone does not establish a JS leak, and the budget was not relaxed.

T047 remains incomplete. Next work should profile retained renderer/native allocations and repeat the same controlled measurement; any proposal to change the 10 MiB target must be explicitly reviewed. Performance fixture did not include unsupported-version rows (covered functionally in unit/contract tests). Measurements preceded only the final mission-dialog-name/cap-message/recovery-control refinements; the recorded built-main hash is retained, and no timing claim is substituted for a new final-build acceptance run.

## Accessibility and usability gates

Automated keyboard traversal covers starter fill/preview/create, personal authoring/save/edit, native delete modal trap, Escape cancellation/return focus, visible focus, reduced motion and 100/200% CSS text scale including a 640px stacked viewport. The 200% screenshot was inspected; focused discard and neighboring actions remain reachable. Existing navigation tests verify all six destinations and save-failure focus behavior.

T046 remains incomplete: full source-selection/failure keyboard coverage, manual contrast acceptance and Windows OS text-scaling checks are not established by those automated tests. T049 remains pending because no five-participant study was conducted. Do not replace the required >=4/5 unaided editable drafts within two minutes and zero starts with automated results.

## Requirement reconciliation and readiness

| Requirement | Named evidence / remaining gate |
|---|---|
| FR001 starters | Production starter guard; all three starter Electron journeys; 500-row pagination |
| FR002 content-only boundary | Strict schema, guarded service, authority projection and build persona scan |
| FR003 independent drafts | Atomic repository/contract tests, exact Electron readback and two-copy restart |
| FR004 existing review authority | Composer regression suite; no recipe-created worker or permission fields |
| FR005 explicit personal selection | Source contract tests and unchecked-selection/restart Electron journey |
| FR006 maintenance | Persistence/contract maintenance tests; revision/disable/delete/two-copy Electron journey |
| FR007 stale previews | Exact token/version tests, keyed reconciliation, disable/re-enable UI reset |
| FR008 literal values | Pure scanner/schema boundary tests; literal URL journey and no-fetch guard |
| FR009 compatibility | UTF-16/UTF-8/aggregate/JSON tests; oversized correction and incompatible preview |
| FR010 durable recovery | Eighteen real process kills, SQLite FULL, readonly, migration rollback and delayed queue test |
| FR011 local lifetime | Independent sidecars, deletion scrubbing, restart and receipt tests |
| FR012 accessible idle UI | Automated subset passes; T046 manual/OS/full keyboard acceptance remains open |
| SC001 usability | T049 pending five participants |
| SC002 exact independent copies | Persistence/contract and restart readback pass |
| SC003 no execution side effects | Recipe boundary tests pass; existing fixture-only composer confirms normal flow |
| SC004 failure outcomes | Stale, unsupported, cap, invalid-buffer, readonly/FULL and interruption checks pass |
| SC005 performance | List/preview timings pass; T047 additional retained working-set budget fails |
| SC006 scaling/keyboard/idle | Automated subset passes; T046 scope remains incomplete |

Feature 002 continues to own templates/profiles, permissions and execution. Feature 003 retains future verified criteria/evidence semantics; recipe checklist text grants no verification. Feature 004's six destinations and save-aware navigation are reused. All prior Features 002–004 deferrals and the inherited supervisor-confirm/draft-conversion crash gap remain outside this work; recipe transaction tests do not close them.

Rollback requires a compatible application or explicit restoration of a pre-upgrade backup. Preserve the database and journals on corruption; use existing disclosed recovery. Never downgrade schema or reconstruct current drafts from a live recipe. Receipt retry resolves committed outcomes without resurrecting deleted content.

Local selector is still Feature 006; original checkout selector is still Feature 002. Requirements checklist remains read-only and complete (16/16). No `.specify/extensions.yml` exists, so no before/after implementation hooks are configured. No commits or pushes were made. Implementation is available for review; release acceptance remains blocked by the named gates above.

