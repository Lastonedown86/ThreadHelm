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
