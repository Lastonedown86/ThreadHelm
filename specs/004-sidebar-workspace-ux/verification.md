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

## Completion roadmap planning checkpoint

Baseline remote main `42ff10bff1212940a8efc903898846778159db5d`; PR #50 verified merged. Documentation only: [completion roadmap](completion-roadmap.md) defines pending slices 20-33 and reconciles current navigation/status pointers. Mechanical validation confirmed 14 contiguous slice numbers, all 18 unresolved finding IDs assigned exactly once, and resolving relative links in changed planning documents. Product runtime tests were not rerun; this checkpoint supplies no new UI, logic or functional acceptance evidence.

## Slice 20: TPL-002 deletion review recovery

Baseline: main `44de3ef357c9b9b62ff5bef4a7aeeb5c00a6231e` (PR #51 merged), branch `codex/template-delete-review-recovery`. Windows local Electron tests with isolated user data and generic template fixtures; no external providers. Implementation is locally verified, pending PR merge.

- Before: the new Electron test reproduced a real dependent-draft rejection while Confirm delete template remained enabled. Main consumes that token before its dependency guard; historical A05 records the misleading manifest-review retry.
- After UI/UX: inspected [recovery screenshot](audits/evidence/slice-20-delete-recovery.png): exact template name, dependency guidance, Refresh deletion review, disabled confirmation and Keep template are visible. Cancellation clears stale error feedback; Sessions/Agents navigation remains usable.
- Logic/functionality: two targeted Electron tests pass. They exercise real dependency denial twice with refreshed tokens, UI draft deletion and confirmation, cancel/Escape, explicit exact-template deletion, unchanged source template, independent readback and restart inventory. Refresh alone preserves the template. An injected CONFIRMATION_EXPIRED response and failed preview verify recovery; a held preview verifies single-flight requests and pending dismissal guards, followed by keyboard confirmation and one observed delete request. No live sessions are created.
- Existing regressions: 11 wizard/roster-navigation Electron tests passed; 25 template persistence unit tests passed. Desktop build, typecheck and lint passed. Formatting/whitespace and secret checks are recorded at the PR checkpoint.
- Test development corrections: the new test initially omitted draft deletion's confirmation and expected a deleted detail instead of the actual PROFILE_NOT_FOUND contract. Corrected expectations then passed; these were test assumptions, not additional product defects.
- Limits: expiry was injected, not a new wall-clock expiry proof. Full-suite, whole-feature accessibility/performance, real-provider and release acceptance remain open. Existing main contracts/schema/dependency guards are unchanged. Recapture: build desktop, then run `pnpm exec playwright test tests/e2e/template-delete-recovery.spec.ts`.

## Slice 21: SES-002 ended-session inventory

Baseline: main `3b71d9f` (PR #52 already merged), branch `codex/ended-session-inventory`. Windows Electron, isolated user data and local echo fixtures; no external providers. Locally verified, pending PR merge.

- Before: new Electron regression failed because Hide 1 ended session left the selected stopped session in the list. A03's prior screenshot/logic evidence remains unchanged.
- UI/UX: one scoped inventory drives list, tabs and dock. Hide selects first live session or null; Show preserves an existing visible selection. The all-ended view keeps clear empty guidance and the disclosure. Selecting an ended record from Attention reveals it on Sessions return. Inspected [collapsed inventory screenshot](audits/evidence/slice-21-ended-collapsed.png).
- Logic/functionality: two new Electron tests pass. Real UI launch/stop produces mixed and all-stopped inventories; Show/Hide, keyboard activation, scope changes and Attention return verify exact list/tab/dock selection. Independent sessions.list and live-session/PID snapshots prove records and live processes are unchanged by visibility actions. Test-only failSession supplies a failed-state fixture to exercise mission-scoped disclosure and selected failure visibility; it is not a real-provider failure claim.
- Regressions: 2 session-scope, 1 multi-session isolation, 1 terminal-visibility, 2 Attention accessibility and 1 recovery-selection tests passed (9 unique selected Electron tests including the 2 new cases). Recovery regression includes restart. Desktop build, typecheck, lint and full repository Prettier check passed.
- CI carry-forward: PR #52 installer acceptance and CodeQL passed, but both Windows CI jobs failed the full formatting gate on tests/e2e/mission-folder-access.spec.ts. This slice includes only Prettier's formatting correction in that file; full local formatting now passes. Previous hosted CI is not relabeled successful.
- Scope limits: no new restart persistence policy; disclosure is renderer state. Full lifecycle/large-inventory/accessibility/performance coverage remains pending. SES-003 tab naming/keyboard and remaining SES-005 IDs belong to slice 22. Existing process/main authority and schema remain unchanged. No hooks; Feature 002 selector preserved.

Recapture: `pnpm desktop:build`, then `pnpm exec playwright test tests/e2e/ended-session-inventory.spec.ts`. Other selected tests are session-scope, multi-session, terminal-visibility, attention-accessibility and recovery-selection. Historical generated screenshots overwritten during regression execution were restored to their recorded baseline.

## Slice 22: SES-003 and remaining SES-005

Baseline main `dc60e3acd4c8a0246c75b75b95629ff37f5b1b2b` (PR #53 merged); branch `codex/session-tab-identity`. Local Windows Electron with isolated echo fixtures. Locally verified, pending PR merge.

- Before: same-provider tabs rendered only provider/state, without IDs or keyboard model; mounted terminal headings/hosts reused IDs. New regression reproduced missing identity on the baseline.
- UI/UX: tabs show provider, workspace leaf and short session ID; full path and full ID remain in accessible names/tooltips. Left/Right wrap, Home/End select endpoints, with one tab stop and retained focus. Keyboard selection keeps the focused tab in view. Inspected [session tabs screenshot](audits/evidence/slice-22-session-tabs.png), including identical workspace leaf names and distinct IDs.
- Logic/functionality: new Electron regression verifies exact returned session IDs against displayed order, arrow/end/home selection and focus, matching terminal hosts, tab-panel relationships, one exposed panel, two retained panels, no duplicate DOM IDs and unchanged live session/PID snapshot. Existing 2 ended-inventory, 2 scope, multi-session isolation and terminal-visibility tests passed: 7 unique selected tests. Terminal visibility and the new identity test reran successfully after the focus-scroll change.
- Setup corrections: two launches in one workspace are denied by existing policy, so the test uses separate approved workspaces with identical leaf names. The inventory is newest-first, so test assertions use actual ordered IDs rather than assumed launch order.
- Desktop build, typecheck, lint and full repository Prettier passed. No IPC/schema/dependencies, process authority or idle polling added. Existing single-main and ended disclosure behavior preserved. Feature 002 selector restored; requirements 16/16; no hooks.
- CI carry-forward: PR #53 installer acceptance and CodeQL passed; both Windows CI jobs reported seven E2E failures. The owned ended-inventory failure compares a short Windows temporary path (RUNNER~1) with its canonical display path (runneradmin); fixed to assert the approved display path while retaining exact-ID checks. Prior failures also include attention-layout, mission-focus-workspace, settings-layout, supervisor-mission, template-delete-recovery and workspace-approval-pending. These remain recorded CI failures, not silently passed by this slice. The template case shows a still-open dialog intercepting a later click; no unrelated fix is claimed here.
- Limits: no full suite or fresh real-provider/release acceptance. Lazy loading/failure identity was source-checked; the new runtime scenario covers loaded multiple terminals. Broad scaling/contrast and all asynchronous lifecycle cases retain their existing matrix gates.

Recapture: `pnpm desktop:build`, then `pnpm exec playwright test tests/e2e/session-tab-identity.spec.ts`. Selected regressions: ended-session-inventory, session-scope, multi-session, terminal-visibility. Historical slice-2 screenshots overwritten by regression capture were restored to their recorded baseline.

## PR #54 CI repair checkpoint

Owner requested fixing CI before slice 23. On head `7f3ca67`, Windows x64/arm64 CI run 34052041060 failed the same six E2E cases; installer acceptance and CodeQL passed. The corrections are test-only:

- Attention/Settings/workspace approval compare canonical approved/saved paths instead of raw Windows short temporary paths. Exact workspace/session IDs and persistence checks remain.
- Mission workspace assertion matches the accepted ended-inventory description from slice 21.
- Template and workspace cancellation wait for a visible, dismissible dialog before Escape, preventing a premature hidden assertion followed by a late-open dialog.
- Stale revision test waits for the original confirmable review before an external revision; it still verifies stale submission rejection and unchanged newer objective.

Baseline local run: 16 of 18 affected-file tests passed; stale copy and revision race reproduced. Corrected targeted run: all six formerly failing scenarios passed (32.3 seconds). Typecheck, lint and full repository formatting passed. No product behavior, timeout increases, retries or reduced safety assertions. Full local suite and fresh hosted CI are verified separately after pushing this checkpoint; historical failures are not retroactively relabeled.

### Follow-up: real review dependency race

The full local E2E run on 7793e32 completed with 105 passed, 1 skipped (opt-in parity capture), and 1 stale-revision test failure. Its captured UI reported a valid Codex worker as ineligible. Review mounted before the parent profile list arrived, and missing provider metadata was treated as Claude. A forced 500ms roster delay reproduced the failure deterministically before the fix.

Review worker validation now awaits fresh profile and eligible-session reads together. Missing profiles produce an explicit unavailable-profile repair message instead of an inferred provider. Main preview/confirmation and exact runtime guards remain authoritative. This is a renderer correctness fix, not just a test change. The delayed-roster stale-authority regression and all 17 composer/runtime/supervisor tests passed after the fix; desktop build, typecheck, lint and full formatting passed. Fresh hosted checks must run on the follow-up commit; the earlier full-suite failure remains historical evidence.

### Follow-up: workspace approval during startup

The full local run on 2e2845c completed with 105 passed, 1 skipped and 1 repository-ideas failure. Repeated runs showed a newly approved folder disappearing from the renderer when a slow startup snapshot finished. The persisted approval remained intact. A deterministic Electron regression holds application info until after the empty workspace snapshot and UI approval, then releases startup: before the fix the Repo selector disappears; after the fix it retains the exact selected workspace ID and the main-owned inventory is unchanged.

Each active store refresh now records workspace updates received while its reads are pending and applies them over its snapshot. Both workspace events and direct UI updates participate, and the journal is removed when the refresh settles. No polling, provider execution, timeout increases or retries added. The controlled regression plus repository-ideas and folder-approval scenarios passed (6 tests, 19.4 seconds). Fresh hosted CI is required on this follow-up commit.

Repeated repository-ideas and controlled-startup coverage passed all 15 executions (three repetitions, 45.4 seconds). Build, typecheck, lint and full repository formatting passed. Hosted CI on prior 2e2845c passed both Windows architectures; this additional startup correction requires its own fresh checks.

## Slice 23: draft identity, capacity and bounded inventory

Baseline: PR #54 merge `3e3accc`; branch `codex/mission-draft-management`, Windows x64. The red Electron regression reproduced missing named draft identity on the built baseline. Bounded derived objective summaries now identify rows alongside stage/time/short ID; accessible names include exact full draft IDs, selected rows expose aria-current, and long titles use two visual lines with a tooltip. Normal discard uses a native confirmation showing the full saved objective and exact draft ID. Reviewed token/version authority remains main-owned; no provider launches, polling, dependency or migration added.

Logic/functionality: new Electron coverage seeds 20 same-named drafts, edits the exact active draft, verifies the latest text in discard review, cancels without deletion, deletes only that ID, compares all remaining IDs, restarts and creates a replacement. A real optimistic-version change rejects stale deletion; fresh review recovers; a controlled pending confirmation disables Keep/Escape and submits once. Inventory failure injection preserves prior rows and Retry reads the new saved name. Unit/contract assertions verify bounded titles, exclusion of unrelated authored content and content-free events.

UI/density: real main-owned fixture contracts create/cancel 50 missions and save 20 long-named drafts. At 680x860 and 200% text, workspace geometry remains usable, page width fits, all six destinations activate by keyboard, the real cap rejection focuses draft management, and exact saved mission/draft IDs remain unchanged. [Inspected density screenshot](audits/evidence/slice-23-draft-inventory.png). Two fixture sessions are used for mission seeding, with no external CLI execution.

Validation: composer/navigation plus initial new scenario passed 16 tests; accessibility/mission-focus passed 12. Final four-scenario slice suite, static checks and contract results are recorded in the PR. Historical screenshot changes from regression capture are restored. Recapture: `pnpm desktop:build`, then `pnpm test:e2e tests/e2e/mission-draft-management.spec.ts`. Full hosted CI, full-feature acceptance and release readiness remain separate gates. Slice 24 follows this PR's merge.

Final slice checks: all four new Electron scenarios passed (27.9 seconds); all 306 contract tests and six focused persistence/save-queue unit tests passed; build, typecheck, lint and full repository formatting passed. Hosted checks are pending on the forthcoming PR. Later race, exhaustive matrix and release claims are not inferred from these results.

## Slice 24: TPL-001 saved agent draft identity

Baseline: PR #55 merge `38aee7b`, branch `codex/agent-draft-identity`, Windows x64. The baseline Electron regression found zero visible names for two persisted Duplicate agent drafts. Main-owned list/detail summaries now derive displayName from saved name (trim/collapse whitespace, maximum 200); renderer shows saved name or Unnamed agent, readable step/state, updated time and secondary ID. Full ID and name are in the resume button's accessible name. No extra renderer detail reads, migration, dependency, timer or provider authority.

UI/logic/functionality: exact-ID Electron regression verifies duplicate names, renamed saved draft, unnamed/incomplete resume, long names and update metadata, Escape without deletion, actual restart, unchanged draft-ID set and no live sessions. Reopening preserves exact authored whitespace while summary display normalizes it. [Inspected screenshot](audits/evidence/slice-24-agent-drafts.png). The initial 10-test wizard/template suite passed (33.8 seconds); the expanded final identity test passed (4.8 seconds). All 307 contract tests and 25 persistence tests passed, including consistent list/detail names, 200-character names, unrelated authored-field exclusion and content-free events. Build/typecheck/lint/formatting and secret-scan results are included in the PR.

Recapture: `pnpm desktop:build`, then `pnpm test:e2e tests/e2e/agent-draft-identity.spec.ts tests/e2e/agent-profile-wizard.spec.ts tests/e2e/template-delete-recovery.spec.ts`. Restore historical slice-20 screenshot output after regression capture. Broad Agents reflow remains slice 31; exhaustive asynchronous/coverage reconciliation remains slice 32. No full local E2E, hosted CI or release acceptance claim. After merge: slice 25, MIS-006; nine roadmap slices remain.

## Slice 25: MIS-006 repository ideas and saved context

Baseline: PR #56 merge `0d82f8e`, branch `codex/repo-idea-context`, Windows x64. Red-first Electron reproduction showed all three repo A ideas still selectable after switching to repo B. Results now require matching repository/provider identity and request sequence; input changes and approval revocation hide stale ideas, and late responses are ignored. One request remains in flight at a time; changed-input progress accurately says the prior result will be ignored. The provider picker now names the generation provider and automatic choice, with default model/effort explained separately.

Logic/functionality: new Electron cases verify immediate and delayed input changes, provider changes, revoked folder, exact source workspace ID/path/provider/idea title, edited objective, save through navigation and actual restart. Main readback confirms draft source and objective, while no fixture flow launches external providers or live sessions. Existing generation failure/Skip/empty-folder and startup-approval regressions pass. The optional repoIdeaSource field remains inert saved JSON; a contract test with deliberately unrelated source ID/path verifies successful mission preview/confirmation excludes this context from authority while retaining it on the draft.

Validation: seven focused generation/context/startup scenarios passed; 17 composer/navigation/context regressions passed (1.2 minutes); final two source-context scenarios rerun after presentation refinement. All 307 contract tests, six persistence/save-queue unit tests, build, typecheck, lint and repository formatting passed. [Inspected saved source screenshot](audits/evidence/slice-25-idea-source.png). No schema migration, new dependency, polling, auto-access or real provider execution. Recapture: `pnpm desktop:build`, then `pnpm test:e2e tests/e2e/repo-idea-context.spec.ts tests/e2e/repo-idea-generation.spec.ts tests/e2e/workspace-startup.spec.ts`.

Limits: source metadata records suggestion inputs, not proof of current repository contents or a source revision. No full local E2E, hosted CI or release acceptance claim. Broad asynchronous matrix closure remains slice 32. Next after merge: slice 26, Mission entry/close/review hierarchy; eight roadmap slices remain.

## Slice 26: Mission flow hierarchy

Baseline: PR #57 merge `8b9d549`, branch `codex/mission-flow-hierarchy`, Windows x64. Red-first Electron reproduction retained the saved receipt after one Close. Successful Close now saves once and returns directly to the Mission workspace; failed saves retain explicit Keep editing/Close without saving choices. Entry shares the composer width and context rail. Review places Start/Apply in the shared footer, and disables footer/stage navigation during confirmation. Successful start selects the exact mission overview; history opens only on request. Confirmation authority is unchanged.

UI/logic/functionality: the 27-test composer, hierarchy, repo-entry, accessibility and supervisor suite passed. Expanded regressions verify latest draft objective through main readback, failed-close unsaved edits, one created mission with exact objective and visible overview, and Start in the shared footer. Existing expired/changed review and stale-revision scenarios passed. No real external provider runs; mission execution uses fixture sessions. All 307 contract tests, desktop build, typecheck, lint and repository formatting passed. Recapture: build then run `pnpm test:e2e tests/e2e/mission-flow-hierarchy.spec.ts tests/e2e/mission-composer.spec.ts`. Full coverage and enlarged-text acceptance remain slices 32/33; hosted CI and owner merge remain separate.

Owner authorized continuous sequential slices. Next: slice 27, state distinctions, based on this branch if its PR remains open.


## Slice 27: MIS-008 mission inventory states

Baseline 57d7312, PR #58 dependency; Windows x64. Red Electron fixture showed a decision-held mission only as paused. Rows and compact picker now retain lifecycle and add Needs your decision or Outcome uncertain from the same presentation logic as the workspace. Existing detail reads supply statuses, keyed by sequence; unavailable/loading details are explicit. No new API, process authority or aggregation.

All six focused Mission Electron scenarios passed, covering exact-ID selection, decision/unknown/paused/completed state, evidence actions, terminal target, cross-section navigation and crash recovery. Main bridge fixtures produced real persisted states; no real external providers executed. Thirteen existing presentation unit tests passed; additional lifecycle/attention mapping regression added. Build, typecheck and lint passed. Recapture: build then `pnpm test:e2e tests/e2e/mission-focus-workspace.spec.ts`. Hosted CI and owner merge remain separate. Next: slice 28.


## Slice 28: MIS-011 runtime and prerequisite consistency

Baseline c7f632e, dependent on PR #59; Windows x64. Red-first Electron observation found automatic-start authorization hidden in collapsed runtime controls. Worker startup now appears beside session selection with its false default retained. Session launch and Mission use the same provider-specific model picker and option inventory. CLI default/custom identifiers remain available; Mission effort limits and existing-session immutability remain explicit. Choosing a session prerequisite routes to Settings for deliberate folder/provider selection instead of automatically opening the first folder with Codex.

Prerequisite navigation now uses the existing shell save guard and retains the exact draft/stage. Settings and Agents show Return to mission draft. Main draft readback verifies custom model, startup authorization and Access stage after repair navigation; live fixture session IDs remain unchanged. Existing-runtime regression verifies recorded settings remain fixed and explicit repair/new-session conversion preserve exact values. Initial regression exposed a shared-control label association issue, corrected with explicit stable ID/label wiring before final checks. No process, permission, migration or default-authority changes. Recapture: build, then mission-runtime-consistency, mission-existing-runtime, mission-composer, launch-session and launch-review-recovery E2E files. Full matrix/scale acceptance remains slices 32/33; hosted CI and owner merges remain separate.

Final slice 28 checks: all 15 Electron scenarios passed (3.2 minutes), including real token expiry, cancelled late preview, exact runtime repair and prerequisite return. Build, typecheck, lint, full formatting and secret scan passed. Historical capture outputs restored.


## Slice 29: MIS-013 selected Mission identity

Baseline cbff13b, dependent on PR #60; Windows x64. A held renderer read reproduced the first mission's title and Pause action remaining visible after selecting the second mission. Selected detail/presentation now gate synchronously on ID, list and detail requests own independent loading/error state, obsolete responses are ignored, and loading/error show the exact requested ID. Retry refreshes the inventory and selected detail. Heading focus follows loading completion only while the user has not moved elsewhere.

The controlled Electron test exercises held detail, switching back before release, late response exclusion, failed read, Memory round-trip, explicit Retry and exact main readback with unchanged fixture process identities. Initial broad run exposed focus loss; the fix passed all seven Mission focus/selection cases (40.4 seconds). The six navigation cases also passed, including failed saves, stale-save conflict, exact outgoing draft and restart. Build passed; static checks recorded below. No main contract or process changes. Recapture: build then mission-selection-loading, mission-focus-workspace and mission-navigation E2E files. Hosted CI and final acceptance remain separate.


## Slice 30: MIS-012/014 keyboard repair and discard modal

Baseline 2a12603, dependent on PR #61; Windows x64. Red-first Electron reproduction found no reachable repair action while Continue was disabled. Fix missing field now focuses the exact invalid control, connects the readiness message, expands enclosing disclosures and scrolls the target into view. When prerequisite fields do not exist, the available prerequisite action receives focus. Continue and final authority checks remain blocked as before.

The failure-path discard prompt now uses shared native ModalDialog, with Escape/focus restoration and single-flight confirmation. Keyboard tests at 960x800/200% root text exercise Outcome/proof/Crew repair and collapsed invalid limits. Injected renderer save failure leaves main storage intact: native discard cancellation preserves the saved ID, held confirmation blocks Escape/repeated Enter, one dispatch deletes exactly that draft and no sessions launch. Existing 15 accessibility/composer scenarios passed, including stage/review and sticky-focus checks; new two-scenario final result recorded below. Fixture coverage is distinct from real storage failure tests in slice 26. Build/typecheck/lint/format passed. Recapture: mission-keyboard-repair, accessibility and mission-composer E2E files. Cross-section exhaustive keyboard/scale acceptance remains slice 33.

Final slice 30: both expanded keyboard/discard scenarios passed (11.3 seconds); no pending local failures. Hosted CI and owner acceptance remain separate.


## Slice 31: AGT-003 inner reflow revalidation

Baseline 4a8a19d, dependent on PR #62; Windows x64. The historical 960x800/200% overflow no longer reproduces with current merged layout. Inner workspace, library and long-name profile detail pass width checks at 680/960/1280 pixels, each at 100% and 200% root text scale. Saved draft editor fits at 960/200%; keyboard open/save preserves exact description and ID through main readback. Shared Sessions setup also fits, with no provider/session execution. No CSS or product change was needed.

All 12 Agents reflow/wizard/roster Electron cases passed (38.3 seconds), including invalid fields, cancellation, export denial/consent, actual draft restart, roster paging, delayed/failing detail and filter recovery. [Inspected current reflow capture](audits/evidence/slice-31-agents-reflow.png). Build from slice 30 used unchanged product sources; typecheck, lint and formatting passed. Recapture: agents-reflow, agent-profile-wizard and agent-roster-navigation E2E files. This closes the sampled AGT-003 geometry defect; every dialog/state at enlarged text is not inferred from this test and remains in the final coverage/acceptance ledger.
Slice 30 acceptance follow-up: actual Tab traversal in slice 33 reproduced fields obscured by the sticky footer at 100% and 200% text. Keyboard-visible focus now accounts for the current action-bar height when scrolling a field; pointer activation of disclosures retains its position. The new natural-Tab regression and all 11 keyboard/composer scenarios pass (47.6 seconds), including exact save, revision, expiry and failure paths. Build/typecheck/lint pass. This remains MIS-012/014 scope and does not add a roadmap slice.
