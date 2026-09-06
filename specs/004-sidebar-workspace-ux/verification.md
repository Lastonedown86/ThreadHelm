# Slice 1 verification — edit preservation and navigation

Date: 2026-09-05. Branch: `codex/audit-sidebar-mission-functionality`. Base: `efcd523f898f8353ad1975614f1953b94a5656d4`. Windows 11 Home x64, OS release 10.0.26200. Scope: accepted MIS-001/002, not all of Feature 004.

## Behavior and evidence

Five corrected regression cases failed against the pre-fix build for their expected reasons: global resume stayed on another destination; immediate New mission lost typed objective; failed navigation showed no decision; draft replacement lost identity/values; mission selection left the composer visible. Initial test-authoring selector mistakes were corrected before this baseline run and are not counted as product failures.

All six new Electron tests now pass. They drive visible controls and independently call the normal main-process contracts to inspect exact draft fields and mission IDs. Normal save and explicit unsaved exit include app restart readback. No external provider runs: mission targeting uses two isolated echo fixtures, and navigation leaves their process count unchanged.

- Global New mission / Resume draft: six destinations, correct destination selected, saved identity retained.
- New mission before debounce: latest objective saved and retained after restart.
- Save failure: editor values retained; Escape/Keep editing retain the editor; both Agents and New mission are blocked; Retry remains blocked under a persistent storage failure; explicit Leave without saving navigates and restart restores only the previous saved value.
- Draft replacement: exact outgoing values stored under the outgoing ID; incoming draft has independent fields.
- Mission selection: composer replaced by correct mission, outgoing draft saved, mission remains running with exactly two existing fixture sessions.
- Conflict choices: stale save retains local text and prompts; Keep my edits persists local text after accepting the fresh version; Use saved version restores the chosen saved text and permits navigation without overwriting it.

Three save-queue unit tests cover shared in-flight draining, failure without internal retry and later explicit retry, and recovery after unexpected rejection. Four existing navigation unit tests also pass. This is deterministic queue-level concurrency proof, not a measured renderer/IPC latency stress test.

## Validation results

- Fresh `pnpm desktop:build`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- Focused Vitest: 2 files, 7 tests PASS.
- Existing composer, mission-focus-workspace, accessibility, repo-idea-generation and supervisor-mission specs: 32 tests PASS (2.5m).
- New mission-navigation spec: 6 tests PASS (21.2s).
- After final debounce-failure cleanup and load-error copy adjustment: fresh build and composer plus mission-navigation rerun, 15 tests PASS (1.0m).
- Changed-file formatting and local documentation links: PASS. Diff whitespace: PASS. Gitleaks scans of feature artifacts, renderer source and E2E tests: no leaks.
- Total distinct selected E2E scenarios: 38. Full test suite and hosted CI were not run.

The [failed-save dialog capture](audits/evidence/slice-1-save-failure.png) was captured in the isolated UI run and visually inspected. Keep editing receives initial focus; the background is inert through the reused native modal. Existing keyboard/reflow tests passed their samples. The new modal was observed at the standard test viewport; a complete viewport/accessibility matrix remains A01/A02 work.

## Scope and remaining work

No IPC contract, database schema, provider behavior or process-control rule changed. No new dependencies, idle polling or recurring rendering. Keep the original 800ms debounce and one active flush queue. Draft loading hides editable fields until hydration; draft IDs key separate component lifetimes. Failed exits retain the target until retry, cancellation or explicit unsaved leave.

Unsubmitted list-item input buffers, delayed mission-detail identity (MIS-013), all prerequisite round trips, large inventories, badges, draft management and other proposed findings remain open. Successful Close still uses its existing receipt (MIS-009 is separate). Real-provider/autostart capability gates and Feature 002/003 completion are unchanged. The shared selector still points to Feature 002; plan/task setup and prerequisite resolution used an isolated planning worktree.

## Slice 2: SES-001 explicit scope

Accepted by owner instruction "Recommended" on 2026-09-05. Baseline main `83883d0`; pre-fix A03 audit commit `35a5bed`. Local Windows Electron verification uses isolated fixture processes, not external provider runs.

### Evidence and outcomes

- Red: new `session-scope.spec.ts` failed on the original build because the named Session scope selector did not exist (20.2s). The A03 S09/S10 observations separately retain the original hidden-live-session/overridden-selection defect.
- Scope and exact-target functionality: UI launch from Settings while a mission filter was selected creates one additional live session. The returned authoritative ID is the selected inventory row, its folder is the displayed terminal target, and all three tabs become available. Narrowing displays two bound sessions; a repeated global Sessions click restores three. Attention selection survives returning to Sessions. Authoritative live IDs and host/root PIDs are identical before and after these navigation operations.
- Mission link: the mission's Open terminal action enters Selected mission, displays two bound sessions, and opens the worker folder resolved from `sessions.list` using the assigned session ID. All live process IDs/PIDs remain unchanged.
- Empty state: Selected mission is disabled without a selected mission; All sessions and folder approval remain available. No process is created. Initial test incorrectly used Playwright `toBeDisabled` for an option (the trace showed `<option disabled>`); corrected to the native disabled property plus keyboard selection behavior.
- Initial selected run: 13 tests passed (1.0m), including six mission-navigation save/selection regressions. Expanded process/accessibility run: 18 passed and the above empty-state assertion failed (2.6m). Successful samples include launch disclosure, input/output isolation, exact interrupt/stop/force-stop targets, close blocking, recovery and six accessibility scenarios.

- Final fresh build and focused rerun after copy and assertion corrections: 8 tests PASS (49.1s). After applying the existing field style to the scope selector, a fresh build and both scope tests passed again (12.2s), with captures regenerated. Across selected runs, 25 distinct E2E scenarios have passing evidence.
- `pnpm desktop:build`, `pnpm typecheck`, and `pnpm lint`: PASS. Changed-file formatting, 34 local documentation links, diff whitespace and scoped secret scans: PASS.
- Visual: [scope selector](audits/evidence/slice-2-scope-control.png) and [exact launch landing](audits/evidence/slice-2-session-scope.png) captured in the final isolated run and inspected. Native selector and result count are readable at the standard viewport; existing sampled reflow/keyboard tests passed. This does not close the full accessibility matrix.

### Boundaries

Ephemeral renderer state only. No database/IPC schema, process authority, folder approval, confirmation or recovery policy changes. Identity-mismatched mission detail supplies no scope candidates; the broader delayed-detail problem MIS-013 remains open. SES-002 through SES-005 remain proposed, including duplicate terminal IDs/tab semantics and ended-session disclosure. Full suite, full accessibility/inventory matrix, real-provider runs and hosted CI remain unverified for this slice. Feature 004 and owning release gates remain open. The shared selector still points to Feature 002.

## Slice 3: AGT-001/002 roster access and selection

Owner accepted the recommended slice via "Lets do the next slice" on 2026-09-05. Baseline a8b9483 and pre-fix audit bab108b. Windows 11 Home x64 / Electron fixture runs; product changes limited to AgentProfileList.tsx and AgentProfileDetail.tsx. Selector preserved as Feature 002; Feature 004 prerequisites and all 16 requirement checklist items passed.

- Red evidence: two navigation regressions failed against the original build: missing Load more profiles, and filtered-out detail remained present (41.8s and 17.4s).
- Inventory/selection: UI reaches 51 of 51 profiles in 50-item pages and retains selected detail when loading more. Last-page profile Enable/Disable changes its exact main-owned state; event refresh does not lose or duplicate rows. Active filter clears the disabled selection; enabling the only disabled profile produces No disabled profiles and Show all profiles.
- Independent effects: all 51 profile IDs, revision IDs and final active states match the pre-navigation snapshot, both before and after an actual app restart. Live session inventory remains empty. Restart restores access to both pages.
- Failure/delay fixture: isolated renderer profiles.list/get handlers are gated using Electron's public handler API and the existing main test router; product IPC code is unchanged. Holding old responses across selection/filter changes cannot publish stale detail actions or a false empty state. Failed reads show Retry profiles / Retry profile detail; releasing the gate and retrying restores real data. Authoritative readback bypasses only the renderer fault gate, not the actual domain/persistence handlers.
- Import: UI import from Disabled with no matches returns to All, selects Exact imported worker, and persists one exact named profile without launching a process.
- Existing roster, wizard and six sampled accessibility scenarios passed on the implementation build. Initial expanded run had 19 passes plus a test-locator failure (generic heading matched both name and Goal); exact-name and level-3 heading selectors corrected the regression. Earlier typecheck caught a cursor inference issue, corrected with an explicit contract response type.
- Screenshots: [last-page exact profile](audits/evidence/slice-3-last-profile.png) and [filtered empty state](audits/evidence/slice-3-filter-empty.png) captured and visually inspected. This does not close AGT-003's scaled-layout finding.

Current renderer request identities prevent obsolete publication; page refresh is atomic and deduplicated, with no polling. Existing profile revision/eligibility authority remains unchanged. Full-suite, full accessibility matrix, failed import/slow mutation matrix, real-provider execution and hosted CI remain unverified for this slice. AGT-003 and TPL-001/002 remain proposed. Feature 004 is not complete.

Final validation: four roster navigation/import/failure/restart regressions PASS (19.9s). Together with 12 existing roster/wizard and six sampled accessibility scenarios, 22 distinct selected E2E scenarios have passing evidence. Fresh desktop build, final typecheck and full lint PASS. Twelve changed text files formatted; 40 local documentation links resolve; diff whitespace check and scoped Gitleaks scans pass. Full suite and hosted CI were not run.

## Slice 4: MEM-001 exact supersession review

Accepted via "next slice", 2026-09-05. Baseline d8a5075; A06 audit d8623bd. Changes are limited to MemoryDetail renderer state and presentation, regression tests and Feature 004 records. No persistence or IPC change.

The red-first test failed because Append remained after editing a reviewed title (expected 0 controls, actual 1). With the fix, title and body edits independently invalidate disclosure. Fresh review shows the authoritative title/body. Cancellation preserves editable fields and writes no revision; reopening requires review. Keyboard append writes the exact new fields and exactly one revision, retained after app restart. Independent main-owned get verifies outcomes; no provider sessions launched.

A controlled renderer IPC delay holds a review while Escape cancels it; reopening and a fresh review remain usable when the old response returns. A simulated TOKEN_EXPIRED rejection performs no mutation, displays correction inside the dialog, preserves body text and removes Append until fresh review succeeds. This exercises renderer rejection recovery, not real-clock token expiry. Existing Memory E2E covers keyboard publication, conflicts, expiry, pagination and sampled accessibility.

Validation: fresh desktop build passed; full TypeScript build and repository ESLint passed. Existing Memory E2E: 4 passed. New exact-review/recovery E2E: 2 passed (final run 8.0s, including review capture). Focused domain/persistence/contract Memory tests: 3 files, 27 passed (3.23s). Initial post-fix E2E attempts failed on an overly strict Body label locator; using the existing suite's label lookup resolved those harness failures.

[Reviewed-content capture](audits/evidence/slice-4-memory-review.png) records the final dialog and was visually inspected. Full suite, narrow/200% text, real-clock UI expiry, interrupted append and hosted CI remain unverified. MEM-002/003/004 remain open. T019-T023 complete only MEM-001 locally. No extension hooks configured.

## Slice 5: MEM-003 stable guided-search scope

Baseline 9d99ac6, merged PR #34. Owner accepted MEM-003 via "Next slicew". Red-first Electron test failed because guided search replaced the explicitly selected workspace UUID with the default UUID. The fix keeps one MemoryList instance and uses versioned guided requests; one local selected workspace/filter governs every search. Request generations reject obsolete search/detail successes and errors after context changes.

Seven Memory E2E tests passed (36.0s): new two-workspace regression plus existing lifecycle, conflict, expiry, pagination, accessibility and MEM-001 review/recovery tests. The new test independently reads main search identities, verifies scope/contested-filter retention, holds a search and detail response from the old workspace, completes a newer scoped query, then releases old responses and verifies current results and absent stale detail. Repeating an identical guided query increments the observed IPC search count. No provider sessions launch. [Scope capture](audits/evidence/slice-5-memory-scope.png) retains the selected scope after guided search.

Fresh desktop build, full repository typecheck and ESLint passed. Formatting, local links, diff and scoped secret checks are recorded at handoff. No persistence/IPC/schema changes. Feature 004 requirements checklist 16/16; prerequisite resolution succeeded and restored Feature 002 selector bytes; no extension hooks configured. MEM-002 reading-list ownership/lifecycle and MEM-004 pagination selection remain open. Revoked-scope fallback and stale-error suppression are source-checked but not independently fault-injected in this slice; full suite, full accessibility/reflow and hosted CI remain separate.

Final focused scenario including filter retention and capture: 1 passed (3.6s); capture inspected. Nine changed text files pass formatting, 39 local links resolve, diff check passes and scoped Gitleaks reports no leaks. MEM-003 is ready for PR review; hosted results must be checked separately.

## Slice 6: MEM-004 paging selection

Baseline 17fac62 (PR #35 merged). Owner accepted the recommended slice via "start on the next recommended". The red-first test reached 21 results after a failed-page retry but failed to find the selected detail heading. MemoryList now preserves detail on append and reconciles current selection only for replacement results. No persistent model or authority changes.

`pnpm desktop:build` passed. `pnpm exec playwright test tests/e2e/memory-paging-selection.spec.ts tests/e2e/memory-search-scope.spec.ts tests/e2e/memory-review.spec.ts tests/e2e/hive-memory.spec.ts`: 8 passed (26.3s). The new Windows Electron test seeds 21 isolated memories via main contracts, selects a first-page item through the UI, injects one failed page read and verifies 20 retained rows/detail plus an enabled retry. Keyboard retry returns 21 rows with the exact original selected title/body; the cursor control disappears at the end and the prior error clears. Independent main get equals the original saved detail. Editing the query clears detail; the next search returns zero results. No provider sessions launched. Existing Memory tests retain review/restart, scope/late responses, conflicts, lifecycle and sampled accessibility coverage.

Remaining limits: no full-suite or hosted CI result inferred; new paging selection is ephemeral and has no restart-persistence contract. Full narrow/200% text, revoked-scope fault injection and all event/paging interleavings remain outside this slice. Historical A06 probes and prior captures remain unchanged. MEM-002 and A07-A09 remain open. Feature 004 prerequisites and 16/16 requirements checklist passed; Feature 002 selector bytes preserved; no extension hooks configured.

Final checks: repository typecheck and ESLint passed; seven changed text files formatted; 40 local links resolve; diff whitespace check passes; scoped Gitleaks found no leaks. T029-T033 complete the bounded local slice and PR handoff. Hosted CI remains separate.

## Slice 7: MEM-002 temporary reading-list lifecycle

Baseline 15355c4, merged PR #36; owner accepted the temporary-list design. Red-first regression failed on return from Agents (expected one edition, received zero). A subsequent regression exposed entry-level active status incorrectly applied to a superseded selected edition; the row now uses exact revision lineage status with deleted/expired entry overrides.

State contains only workspace/entry/revision references, with no bodies or durable mission association. Rows project title/status/expiry from scoped revision-specific reads; loading, denied and failed reads hide old metadata. Return navigation re-reads, memory events refresh, and one deadline timer requests authoritative expiry state. Current request identity and cleanup reject obsolete responses. Delete replaces title with content-free Deleted content; count reports editions rather than cached body bytes. Copy explicitly explains temporary session lifetime and restart clearing.

New Electron scenarios verify UI add/dedup, section return, exact superseded edition retention, deletion title clearing, Remove, retraction through UI, injected read failure and Retry edition, and restart clearing of a nonempty list. Main setup operations deliberately mutate supersession/deletion to test external lifecycle events; independent scoped get verifies deleted body null before/after restart. An actual expiry deadline changes the badge and is independently read back as expired. Existing Memory regressions retain publication/review, scope, paging, conflicts and sampled accessibility evidence. No providers launch. [Deleted-edition capture](audits/evidence/slice-7-reading-deleted.png) was visually inspected.

Limitations: no full-suite/hosted CI/release claim, no durable mission packet, and no full large-list/reflow/accessibility matrix. Revoked-workspace and removed-row late-response cases are source-checked, not independently fault-injected. The existing get contract returns content transiently; the reading list retains only metadata and never caches body or lineage in its state. Main remains authority for lifecycle and scope. Feature 004 prerequisites/checklist (16/16) pass; Feature 002 selector preserved; no hooks configured.

Final validation: fresh desktop build, repository typecheck and ESLint passed. Ten Memory E2E tests passed (48.4s), including both new reading-list scenarios. Baseline captures from earlier slices were preserved.

Artifact checks: ten changed text files formatted, 42 local links resolved, diff whitespace passed, and scoped Gitleaks found no leaks. T034-T038 complete the bounded slice and PR handoff.

## Slice 8: ATT-001 recovery selection

Owner accepted ATT-001 via "next slice" on open PR #38. Baseline main c32f255, audit 723789e. The red-first regression failed because dismissing a nonselected record replaced the selected third record ID with the first ID. The initial fixture lookup used CSS-transformed innerText; matching raw textContent corrected that harness issue before reproducing the product defect.

RecoveryAttentionQueue now preserves a still-unresolved selection. If it disappears, the next surviving ID in prior order wins, then the previous surviving ID, then new first/empty. Current inventory drives reconciliation; asynchronous dismiss completion no longer resets selection. Main resolution, storage guards and reviewed replacement authority are unchanged.

`pnpm desktop:build` passed. `pnpm exec playwright test tests/e2e/recovery-selection.spec.ts tests/e2e/recovery.spec.ts tests/e2e/session-scope.spec.ts`: 4 passed (32.5s). New test produces five recovery records through real isolated local-fixture crash/restart, then verifies nonselected dismissal, injected rejected dismissal with unchanged unresolved count, a held dismissal completed after a newer selection, next and previous neighbor fallbacks and final empty state. Independent sessions.list confirms exact dismissed session stopped, all final sessions stopped and zero unresolved records; restart preserves resolution and launches no sessions. Existing recovery test retains distinct reviewed replacement and no-replay proof.

Repository typecheck and ESLint passed. Typecheck initially found an untyped test accumulator; explicit recovery-record array type corrected it. This was a test typing issue, not an application failure. Feature 004 prerequisites resolved, checklist 16/16, Feature 002 selector bytes restored; no hooks configured. Previous audit captures remain pre-fix. No whole-feature, full-suite or hosted CI claim. ATT-002/003/004 and A08/A09 remain open. Full keyboard focus after deletion and high-volume queue interleavings remain outside this bounded slice.

## Slice 9: ATT-002 recovery scope and mission return

PR #38 verified merged at 51d0cc8. The next slice uses the bounded clarification option from A07: recovery-only queue/badge with a guarded mission-return route. Session recovery replaces the broad eyebrow; explanatory copy distinguishes mission decisions. Badge description now names session recovery records. Selected mission navigation invokes the existing exact-ID guard; no-selection navigation invokes the existing destination guard. No queue aggregation, decision resolution or new authority.

Red-first tests failed on absent scope label and absent Open Missions button. After implementation, `pnpm desktop:build` passed; `pnpm exec playwright test tests/e2e/attention-scope.spec.ts tests/e2e/recovery-selection.spec.ts tests/e2e/recovery.spec.ts tests/e2e/session-scope.spec.ts`: 6 passed (40.8s). Final two focused tests with keyboard mission return and capture passed (7.1s). Independent main reads confirm work items and attempts unchanged after navigation, live session IDs unchanged, and zero recovery records while the mission remains escalated. Empty/no-selection route opens Missions without launching a session. Existing tests retain ATT-001 selection and reviewed replacement behavior.

Repository typecheck and ESLint passed. [Updated scope capture](audits/evidence/slice-9-attention-scope.png) inspected. Feature 004 prerequisites resolved and Feature 002 selector bytes restored; checklist remains 16/16, no hooks configured. Historical captures remain unchanged. Full suite, hosted CI, full reflow/accessibility and removed/stale mission target recovery remain unverified. The return button identifies the current selection without claiming it represents every pending decision. ATT-003/004 and A08/A09 remain open.

## Slice 10: ATT-003 Attention reflow

PR #39 verified merged at efb90d6; branch codex/attention-layout. Baseline regression reproduced 113px horizontal overflow in Attention at 960x800 with 200% root text. Medium sidebar tracks now have a viewport ceiling; recovery grid children shrink, long identifiers wrap without truncation, evidence stacks in constrained workspaces, and actions wrap. Visual inspection then caught 28px sidebar overflow; the expanded regression reproduced it before fixing brand/header/button wrapping. No persistence, IPC or process-authority changes.

The new Electron test creates a real isolated local echo-fixture session, crashes/restarts the coordinator, and verifies the resulting long Windows workspace path and record ID. Geometry checks cover 960/200%, 1264/100%, 1264/200%, 680/100% and 680/200%, including the shared rail and recovery workspace/queue/detail. Keyboard dismissal at 960/200% is independently verified through sessions.list: zero unresolved records, exact target session stopped, no live sessions. [Enlarged text overview](audits/evidence/slice-10-attention-200.png) and [reachable recovery actions](audits/evidence/slice-10-attention-detail-200.png) were visually inspected. Scrolling remains necessary with enlarged text.

Fresh desktop build, repository typecheck and lint passed. Nine selected Electron tests passed (1.1m): layout, two scope/mission-return cases, three medium/narrow Mission cases, Mission lifecycle presentation, recovery selection, and reviewed replacement after crash. After the additional sidebar wrapping fix, the focused layout test passed again (6.6s); three shared Mission layout tests passed again (13.4s). Historical screenshots remain unchanged.

Feature 004 prerequisites/checklist pass (16/16), Feature 002 selector bytes restored, no extension hooks. This is a bounded local reflow result: no full-suite, hosted CI, release, full inventory or complete cross-section accessibility claim. ATT-004 semantics, A08 Settings and A09 reconciliation remain open.

Artifact checks: changed text formatted, 50 local links resolved, diff whitespace passed, and feature-directory Gitleaks found no leaks. T049-T053 complete this bounded slice and PR handoff.

## Slice 11: ATT-004 recovery accessibility

Baseline PR #40 merged at 63fd09b. Two red-first Electron tests reproduced duplicate main landmarks (two on Missions, with additional destination mains elsewhere) and absent current-record semantics. HTML root is now a div; AppShell retains the primary main/skip-link target and destination components use named sections. Recovery selection exposes aria-current and aria-controls. Focus tracking remembers the exact record and focused element; removed-record reconciliation moves focus only when that element still owns focus or its removal left focus on body. Detail-button reuse is covered; moving to another control invalidates focus ownership. No authority/persistence changes.

New tests traverse all six destinations and require exactly one main with the shell target ID. Four real isolated echo-fixture sessions produce recovery records through crash/restart. A held dismissal completes after focus moves to Open Missions without stealing it. Native Space selects an exact row; Tab reaches its Dismiss; Enter resolves it. Independent sessions.list verifies the exact record disappears and its session becomes stopped. Row and detail dismissal focus the surviving current button; final dismissal focuses the empty heading and leaves zero unresolved records/live sessions. Existing recovery tests retain rejected/delayed selection, restart and reviewed replacement coverage.

Feature 004 prerequisites resolved; requirements checklist 16/16, Feature 002 selector bytes preserved, no hooks configured. Screen-reader speech with NVDA/JAWS, full accessibility/performance matrix, full suite, hosted CI and release are not established by these DOM/keyboard tests. A08 Settings and A09 reconciliation remain pending.

Final validation: fresh desktop build, repository typecheck and ESLint passed. Nine selected Electron tests passed (1.4m): accessibility (2), layout (1), scope (2), selection (1), crash/replacement (1), and session scope (2). Historical captures restored; no new visual design is introduced. Changed text formatted, 51 local links resolved, diff whitespace passed and feature-directory Gitleaks found no leaks. T054-T058 complete the bounded slice and PR handoff.

## A08 Settings audit

Audited merged PR #41 at ca2c620. See [A08](audits/a08-settings-functionality.md) for full action inventory, coverage gaps and SET-001 through SET-005 proposals. Fresh desktop build passed; three final audit scenarios passed (30.2s), producing 17 independently inspectable observation records and two visually inspected captures. Three existing launch/recon E2E tests passed (22.9s); five targeted Vitest files passed all 71 tests (39.79s). Approval cancellation during a pending write, false empty roster after read failure, stale readiness without recheck, Settings overflow and temporary recon proposal loss after restart are recorded as failures/limitations. Normal approval/revoke, reviewed launch, recon owner stop, profile import and accepted-profile persistence have independent evidence. No application changes or new implementation acceptance; full matrix, external provider execution, hosted CI and release remain unverified.

## Slice 12: SET-001 pending folder approval

Owner accepted SET-001 on open PR #42; baseline main ca2c620, audit 97a6184. Red-first test failed because no disabled Approving control existed. WorkspacePanel now has a synchronous ref guard and rendered pending state; exact candidate stays visible, repeated submission is blocked, and Cancel/Escape cannot close during approval. Existing main approval/token authority remains unchanged. Rejection uses the existing error mapping and fresh-choice recovery.

New Electron regression holds rejected and successful responses, activates Approve twice in the same renderer task and verifies one request each time. Before submission Escape closes without writing and restores opener focus. During submission Cancel/Approve are disabled, status explains saving, Escape retains the exact disclosure, and independent workspaces.list stays empty while held. Rejection leaves no approval; a fresh choice then saves one exact folder and clears the error. Saved identity survives restart; no sessions launch. Initial typecheck found an optional test-hook property assigned undefined under exactOptionalPropertyTypes; deleting the property corrected the harness typing.

Feature 004 prerequisites and checklist pass (16/16); Feature 002 selector bytes preserved; no hooks configured. Original A08 evidence remains pre-fix and its observation probe intentionally reproduces baseline behavior, so it is not rerun as a post-fix acceptance test. Full-suite, real-provider, screen-reader speech and hosted CI/release claims remain outside this slice. SET-002 through SET-005 remain proposed.

Final validation: fresh desktop build, repository typecheck and ESLint passed. Four selected E2E tests passed (23.4s): pending approval, reviewed launch, recon reviewed imports and empty recon. T059-T063 complete the bounded slice and PR update.

Artifact checks: eight changed text files formatted, 64 local links resolved, scoped Gitleaks and diff whitespace passed.

## Slice 13: SET-002 roster read recovery

PR #42 verified merged at 29ef3a5. Red-first Electron regression reproduced false No roster yet after a failed getRun. WorkspaceRoster now separates loading/ready/error/waiting, retains last-loaded run data with explicit labeling and provides Retry roster. Poll errors are caught, timers are cleared on cleanup, and five-read exhaustion leaves a recoverable waiting state. An ended session is no longer labeled running while collection is pending. Run recon and proposal review require known read state; Run recon is disabled for unfinished runs. No main, IPC, schema or provider-authority changes.

New test starts one isolated real local recon fixture and reads its completed run independently. Controlled renderer IPC rejection, held old response, pending collection and second-read rejection exercise the recovery states. Keyboard Retry enters loading without false empty content. Leaving/reopening and releasing an obsolete null reply preserves four current proposals. Exhaustion produces exactly six requests including the initial read; collection failure produces two. Retry restores four proposals and enables Run recon only after fresh completed data. Main getRun and sessions.list are unchanged; profiles.list stays empty and no sessions are live. These counts are bounded-sequence evidence, not a broad performance benchmark.

Fresh desktop build, repository typecheck and lint passed. An intermediate scripted JSX edit touched a disclosure closing branch and was caught by formatting/build; it was corrected before the fresh successful build. Initial focused recovery test passed (9.4s). Feature 004 prerequisites resolve, checklist 16/16, Feature 002 selector bytes preserved; no hooks configured. Original A08 evidence remains pre-fix. Full suite, screen-reader speech, real provider behavior and hosted CI/release remain outside this slice. SET-003/004/005 and A09 remain open.

Final regression: five selected E2E tests passed (29.5s): roster read recovery, pending approval, reviewed launch, recon import and empty recon. Seven changed text files formatted, 59 local links resolved, scoped Gitleaks and diff whitespace passed. T064-T068 complete the bounded slice and PR handoff.

## Slice 14: SET-003 provider readiness recheck

PR #43 verified merged at a834317. Red-first Electron test failed on the absent Provider readiness heading. Settings now names the panel explicitly, offers Check again, shows checking/completion/failure feedback and per-provider time elements. A ref prevents duplicate requests; cleanup invalidates local completion after section exit. The component relies on existing main readiness events rather than applying a second response snapshot. Store rejects older probedAt events for the same provider. Launch is unavailable from this panel while checking or after request failure. Existing workspace choice and launch disclosure authority remain unchanged.

New regression uses two approved temporary folders and local echo adapters. It selects the second workspace, checks by keyboard, injects failed/held renderer responses, verifies two rapid activations produce one request, leaves/reopens, successfully rechecks, then releases the obsolete failure. Workspace selection remains exact through each recheck. Per-provider timestamps reflect readback. Injected ordered/out-of-order events verify older evidence is rejected and one failed provider does not hide another available provider. Independent workspaces.list is unchanged, sessions.list stays empty and live sessions stay empty. Provider error/event injection verifies UI handling, not real external authentication transitions.

Fresh desktop build and repository typecheck passed. Feature 004 prerequisites resolve; checklist 16/16, Feature 002 selector preserved, no hooks configured. Original A08 observations remain historical. Full startup-refresh interleavings, system clock rollback, real provider install/auth transitions, full suite, screen-reader speech and hosted CI/release remain unverified. SET-004/005 and A09 remain open.

Final validation: repository ESLint passed. Five selected E2E tests passed (43.2s): provider recheck, reviewed launch, roster read recovery, recon import and empty recon. Eight changed text files formatted; 60 local links resolved. T069-T073 complete the bounded slice and PR handoff.

## Slice 15: SET-004 Settings reflow

PR #44 verified merged at bbf80a9. Red-first Electron test reproduced 41px horizontal overflow at 960px/200% text. Scoped guided-setup CSS now uses a shrinkable single track, constrains child minimum widths, wraps content/actions, and stacks Settings health and modal facts in constrained workspaces. The shared sidebar and non-Settings modal styles remain unchanged.

New test approves an isolated long-path workspace, checks Settings/cards/roster/health geometry and both approval/recon disclosures at 1264/960/680 widths with 100%/200% root text. Recon is reviewed then cancelled in every case, with no execution. At 960/200%, keyboard Check again completes and keyboard approval of the existing exact folder preserves one saved ID/path. Independent sessions.list and liveSessions remain empty. [Settings capture](audits/evidence/slice-15-settings-200.png) and [reachable approval controls](audits/evidence/slice-15-approval-200.png) visually inspected; vertical scrolling remains necessary at enlarged text. Original A08 screenshots remain pre-fix.

Fresh desktop build passed; initial focused layout regression passed (6.7s). Feature 004 prerequisites/checklist pass (16/16), Feature 002 selector preserved, no hooks. Full inventory/contrast/screen-reader matrix, external-provider behavior, full suite and hosted CI/release remain unverified. SET-005 temporary proposal lifetime and A09 remain open.

Final regression: six selected E2E tests passed (45.5s), covering layout, pending approval, recheck, reviewed launch, recon import and empty recon. Repository typecheck passed. Seven changed text files formatted; 63 local links resolved. T074-T078 complete the bounded slice and PR handoff.

Repository ESLint, scoped Gitleaks and diff whitespace passed.

## Slice 16: SET-005 temporary recon proposal lifetime

PR #45 verified merged at b3b0a1b. Red-first Electron regression failed on absent honest loaded-empty wording. WorkspaceRoster now shares lifetime guidance between pre-launch disclosure and the roster: temporary proposals are cleared by exit/restart and replaced by another recon run; Review/import saves desired roles in Agents. Loaded-empty copy no longer implies recon never existed. Product change is copy only; no persistence, launch, confirmation, export or recovery behavior changes.

New regression confirms lifetime guidance before checkbox/launch, starts one isolated local recon fixture, imports one named proposal and reads its saved profile identity. Three proposals remain on the same run. Opening then cancelling replacement preserves the exact remaining run. After real app restart, main getRun is null, the imported profile inventory is identical, session history is unchanged, no live sessions exist and the saved profile appears in Agents. Replacement lifetime is additionally traced to main runs.set; interrupted replacement and real provider behavior remain outside the runtime sample.

Fresh desktop build passed. Feature 004 prerequisites/checklist pass (16/16), Feature 002 selector preserved, no hooks configured. Original A08 evidence remains historical. Durable proposal persistence/recovery is deferred as a separate capability decision; no claim of recovering unaccepted proposals. A09 and prior matrix gaps remain open.

Repository typecheck and ESLint passed. Nine changed text files formatted; 64 local links resolved. Historical screenshots restored after layout regression. T079-T083 complete the bounded slice and PR handoff.

Final regression: five selected E2E tests passed (55.2s): lifetime/restart, roster read recovery, Settings reflow, recon import and empty recon. Scoped Gitleaks and diff whitespace passed.

## A09 cross-section reconciliation

PR #46 verified merged at `560d4aa58de9134736e42f83163dff93b5a053d9`; branch started clean from fetched main. [A09 report](audits/a09-cross-section-reconciliation.md) consolidates current dispositions and proposed next slices. Register corrects the stale latest-baseline paragraph and A06 baseline attribution; original reports and evidence remain historical. No product code or spec requirements changed, no new implementation tasks accepted; Feature 002 selector preserved. Constitution reviewed for local control, independently observable outcomes and bounded authority.

Fresh `pnpm desktop:build` passed. `pnpm exec playwright test --config specs/004-sidebar-workspace-ux/audits/probes/a09.config.ts` completed one observation scenario in 2.3m, recording 14 observations. Two fixture sessions launched through UI. Exact stopped/running session readback and stopped-job absence agree. Real wall-clock preview expiry and repeated confirmation leave the same other live ID; no extra live process. SES-002/003/004 and residual SES-005 reproduce. All six destinations have exactly one main landmark. Both current captures visually inspected; viewport 1400x860, default text size, Windows 11 Home 10.0.26200. Capture/probe completion is not defect acceptance.

`pnpm exec playwright test tests/e2e/attention-accessibility.spec.ts tests/e2e/session-scope.spec.ts tests/e2e/mission-navigation.spec.ts --workers=1`: 10 passed (1.1m). Covers all-destination entry/resume, saved-draft switch/restart, failed/stale save recovery, exact global/mission session scope and unchanged live processes, recovery selection/dismissal with authoritative readback, held completion and focus. Two historical slice-2 screenshots regenerated by tests were restored.

No full suite, fresh Mission runtime/access reproduction, full scale/keyboard/screen-reader matrix, real external provider run, post-expiry saved-record restart check, hosted CI or release claim. Remaining matrix gaps are retained; MIS-003 is the next proposed bounded slice, not implemented in this audit PR.

Final audit checks: seven changed text artifacts formatted; both new TypeScript probe/config files lint with zero errors; 65 local document links resolve; scoped Gitleaks and diff whitespace pass. Repository-wide typecheck/lint were not rerun for this documentation/probe-only change.

## Slice 17: MIS-003 existing-session runtime

PR #47 verified merged at `5641268f8d41584fc940dd037b95db2c7f184024`; clean branch `codex/existing-session-runtime`. Feature 004 prerequisites resolve, requirement checklist 16/16, Feature 002 selector preserved byte-for-byte, no extension hooks. Existing ignore patterns cover generated output and local data; no setup changes required. Constitution reviewed: renderer-only display/repair, existing version-bound persistence, main-owned authority, no new execution path or automatic startup.

Red-first Electron regression used two real isolated local echo fixture sessions and an older saved draft with an invalid model. Main preview rejected it; the UI assertion failed because the invalid model was still enabled. Crew now projects recorded settings for display while preserving the saved mismatch until deliberate repair. Fixed controls include model/effort/permission/allowlist; limits are stated in text. New-session selection and ordinary session reselection share one transition, force autoStart false and preserve the existing workspace derivation. Known recorded effort/policy values are retained in their controls even when outside the normal new-session choices. Missing sessions are labeled unavailable; saved settings are not presented as current live facts.

Review obtains fresh eligibility, names the affected worker and offers Crew repair for an unavailable/mismatched tuple. A main stale-confirmation failure also attempts fresh diagnosis; main preview/confirmation remain final authority. Refreshing or rejecting a review clears its old expiry timer. Returning to Crew reloads eligible sessions. No migration, IPC contract, dependency or main-process changes.

Functional regression repairs the old tuple through UI, navigates/reopens and reads the exact saved worker. Switching to new session, editing, saving and reopening leaves sessionId null and autoStart false without changing live IDs/PIDs. Reselecting the original session restores its exact tuple; Review becomes ready. Then a real UI stop ends that worker: resumed Review identifies Worker 1, repair returns to its unavailable exact selection, saved identity persists and only the supervisor remains live. missions.list stays empty. Existing composer tests separately exercise successful reviewed start, revision and expiry; navigation tests read drafts across save failure/conflict/restart.

Evidence: [recorded settings](audits/evidence/slice-17-recorded-runtime.png), [unavailable worker](audits/evidence/slice-17-unavailable-worker.png). Isolated Windows 11 Home 10.0.26200, enlarged capture viewport 1400x1800 at default text. This is not narrow/200% layout acceptance. Full provider/model/permission matrix, runtime mismatch during confirmation, all delayed-read races, screen-reader speech and release readiness remain unverified. Shared-folder access controls remain MIS-004.

Final validation: fresh desktop build, repository typecheck and ESLint passed. `pnpm exec playwright test tests/e2e/mission-existing-runtime.spec.ts tests/e2e/mission-composer.spec.ts tests/e2e/mission-navigation.spec.ts --workers=1`: 16 passed (1.5m). Both final captures visually inspected. Ten changed text files formatted; 69 local links resolve; scoped Gitleaks and whitespace pass. T084-T088 complete this bounded slice and automatic PR handoff. Full suite and hosted CI/release are not claimed.

## Slice 18: MIS-004 shared-folder access

PR #48 verified merged at `29167024d80253e94adbce4c46188ed86378e5eb`; clean branch `codex/shared-mission-folder-access`. Feature 004 prerequisites resolve, requirements 16/16, Feature 002 selector preserved, no extension hooks. Constitution check PASS: shared rules match the existing folder-level authority, explicit controls and independent outcomes, no renderer OS access or new execution path. Existing ignore configuration remains adequate.

Red-first Electron test failed on the absent supervisor folder group on merged main. The previous UI owned access controls per worker even though saved modes are per folder. Access now renders worker folder assignments followed by unique folder groups with exact paths and affected members. Long paths wrap. Missing approval or unresolved supervisor membership is labeled unavailable; it does not invent a new live binding. Existing deriveWorkspaces keeps modes for retained membership and removes unused entries. Mode edits update in place, or add the missing entry deliberately, without reordering other folders. Access reason copy now refers to all listed members and distinguishes mission rules from OS confinement. No main/IPC/schema/dependency changes.

The isolated Windows regression starts two local echo fixtures for setup and seeds a draft with a new, non-autostart worker sharing the supervisor's folder. UI selects Read once for both, moves the worker away/back/away, verifies one radio group per bound folder and retained supervisor Read. Main preview independently shows the supervisor Read binding held. The existing Review Access link returns to the supervisor-only group; keyboard Write repairs it directly. Saved folder IDs/modes and main preview's ready supervisor agree; exact live IDs/PIDs remain unchanged and no mission exists. A real app restart retains saved modes while no processes restart. Setup/readback calls are not counted as UI actions.

Evidence: [folder access capture](audits/evidence/slice-18-folder-access.png), viewport 1400x1200 at default text, Windows 11 Home 10.0.26200. This is not full narrow/200% layout or screen-reader acceptance. Missing/revoked approval races, unavailable-supervisor UI after restart, all multi-worker/role combinations, and real provider enforcement remain outside the runtime sample. Main Read enforcement hold is retained, not bypassed. Broader audit matrices and Feature 004 remain open.

Final validation: fresh desktop build, repository typecheck and ESLint passed. `pnpm exec playwright test tests/e2e/mission-folder-access.spec.ts tests/e2e/mission-composer.spec.ts tests/e2e/mission-existing-runtime.spec.ts tests/e2e/mission-navigation.spec.ts --workers=1`: 17 passed (1.5m). Folder capture visually inspected; historical slice-17 captures regenerated by regression were restored. Ten changed text files formatted, 71 local links resolve, scoped Gitleaks and whitespace pass. T089-T093 complete the bounded slice and automatic PR handoff. Full suite, hosted CI and release are not claimed.

## Slice 19: SES-004 launch review recovery

PR #49 verified merged at `6a28030c5bd0a40f8b28135690b18f9f462f21c9`; clean branch `codex/launch-review-recovery`. Feature 004 prerequisites resolve; requirements 16/16; Feature 002 selector preserved; no hooks. Existing ignore patterns are adequate. Constitution PASS: exact current review and explicit confirmation, observable outcomes, unchanged main authority and no new execution path.

Red-first injected PREVIEW_EXPIRED regression failed because Launch remained enabled. LaunchDialog now marks failed/expired reviews unusable, clears acknowledgement and offers Refresh review. Form state is retained. Response identity covers workspace/provider/terminal and every form input plus explicit refresh version, so an older review cannot authorize newer inputs. A single deadline timer expires current review, with a deadline check in the launch handler as well. Existing cancelled-request guard rejects obsolete responses. Refs prevent duplicate refresh/launch submission; pending launch disables settings and intercepts Escape/cancel. Ordinary input-driven preview refresh still preserves its prior boundary acknowledgement, as verified by the existing launch journey. No migrations, contracts, dependencies or main changes.

Injected rejection is distinguished from main expiry: the first regression checks zero saved/live sessions after rejection, then refreshes exact model/effort/process-limit settings and requires a new checkbox. Two same-turn launch clicks produce one main call; Escape leaves the pending dialog mounted. Main saved session/workspace, eligible launch tuple and live ID agree after success. A separate test waits 123 seconds of real wall time, verifies UI expiry and submits that exact old token directly to main to prove rejection; refresh returns a different token and cancellation leaves no saved/live session. Failed preview retry and a held refresh test exercise duplicate refresh suppression, cancellation and a newer dialog protected from the old completion. Injection establishes UI recovery behavior, not actual provider/authentication failure.

Evidence: [expired review capture from the injected rejection scenario](audits/evidence/slice-19-expired-review.png), Windows 11 Home 10.0.26200, 1400x1400 at default text. No full provider/permission matrix, real-provider work, full narrow/200% or screen-reader acceptance, operating-system clock rollback, unknown transport outcome recovery, full suite or release claim. Main remains authoritative if the renderer deadline is delayed. Original A03/A09 evidence stays historical.

Final validation: fresh desktop build, repository typecheck and ESLint passed. `pnpm exec playwright test tests/e2e/launch-review-recovery.spec.ts tests/e2e/launch-session.spec.ts tests/e2e/session-scope.spec.ts --workers=1`: six passed (2.6m), including real main expiry. Expiry capture visually inspected; historical scope captures regenerated by regression restored. Seven changed text files formatted, 73 local links resolve, scoped Gitleaks and whitespace pass. T094-T098 complete the bounded slice and automatic PR handoff. Full suite and hosted CI/release are not claimed.

Final visual follow-up: expiry notice uses the standard error style. Fresh build and focused rejected-review regression passed again (5.0s); the final injected-expiry capture was inspected.
