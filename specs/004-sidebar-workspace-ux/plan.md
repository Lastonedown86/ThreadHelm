# Implementation Plan: Edit preservation and navigation consistency

Current sequence: [completion roadmap](completion-roadmap.md), based on merged PR #50. Slices 1-19 are merged; slices 20-24 are merged; slice 25 is locally verified pending merge; slices 26-33 are pending. Historical checkpoints below retain their original scope.

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

## Slice 6: Memory pagination selection (MEM-004)

Owner accepted the recommended MEM-004 slice via "start on the next recommended". Baseline main 17fac62 (merged PR #35), branch codex/memory-paging-selection. Appending results must preserve the current selected detail because previous rows remain in the accumulated inventory. Failed paging retains existing results, selection and cursor so Load more can retry. Replacement searches reconcile against their replacement inventory using current selection; query/scope/filter changes retain existing context invalidation. No IPC, persistence, dependencies, authority or provider changes. Constitution check PASS; requirements checklist 16/16; Feature 002 selector preserved and no hooks configured.

Red-first Electron test seeds 21 memories, selects a first-page item, injects a failed page request, retries and checks 21 results plus exact selected entry/body against main readback. Query change clears obsolete detail. Existing Memory E2E, build/typecheck/lint and artifact checks verify the bounded renderer change. Automatic PR creation remains authorized.

## Slice 7: temporary Memory reading list (MEM-002)

Owner accepted the recommended temporary-list design via "Lets go with recommended". Baseline main 15355c4 (PR #36), branch codex/temporary-memory-reading-list. Preserve exact edition membership across section navigation in the renderer store for the current app session only; no localStorage or durable mission association. Store only entry/revision/scope references. Render each edition through a scoped revision-specific main read, projecting only title/status for display; do not cache bodies in reading-list state. On memory events, return navigation or approval-state changes, hide stale metadata while refreshing. A single expiry-deadline timer triggers an authoritative refresh while the list is visible; no periodic polling. Failed/revoked reads show unavailable with retry/remove, without old title/body. Deleted entries show content-free identity and deleted status. Retracted, expired and superseded editions carry lifecycle warnings. Rename mission-packet copy to Temporary selection, state that restart clears membership, and replace body-byte totals with edition count.

Tests: red-first lifecycle/return UI regression, exact revision retention after supersession, deletion and independent readback, remove/dedup, restart clears list but durable deletion persists. Existing memory suites preserve main authority. No schema/IPC/dependencies or provider execution. Constitution PASS; Feature 002 selector preserved; no hooks configured. Open PR after verified completion.

## Slice 8: recovery selection (ATT-001)

Owner accepted ATT-001 via "next slice". Baseline c32f255, audit 723789e on open PR #38. Extend that PR with the accepted fix. Preserve any still-unresolved selected record. When it disappears, select the next surviving record in prior queue order, then the previous surviving record, then a new first record or empty state. Reconcile from current unresolved inventory; an asynchronous dismiss completion must not reset a newer selection. Failure keeps selection and record. Existing main resolution and launch authority unchanged. No schema/dependencies/IPC changes. Constitution PASS; Feature 004 checklist remains 16/16; Feature 002 selector restored byte-for-byte; no hooks configured.

Red-first Electron proof: real isolated fixture crash produces five recovery records. Select third, dismiss second, inject failure, hold another dismissal while selecting a newer target, then verify deterministic neighbor/empty behavior and authoritative session transitions. Restart must preserve resolution. Existing recovery and scope tests retain reviewed replacement/no-replay checks.

## Slice 9: explicit recovery scope and mission return (ATT-002)

Owner instruction "merged next" continues the proposed Attention sequence after ATT-001. Baseline 51d0cc8 (PR #38 merged), branch codex/attention-recovery-scope. Choose the bounded scope clarification option from A07: retain global Attention and recovery authority, change Cross-mission attention to Session recovery, explicitly describe recovery-only badge and queue, and provide Open selected mission through the existing guarded App selection callback. Without selection, Open Missions uses existing guarded destination navigation. The page explains that mission decisions are reviewed in Missions; it does not imply an aggregated decision count or resolve mission work through recovery. No new queue, IPC, persistence, dependencies or execution authority. Constitution PASS; Feature 002 selector preserved; no hooks.

Red-first E2E verifies an escalated mission is absent from recovery records but has a clear exact return route, retains its escalation and live process IDs after navigation, and no-selection entry opens Missions. Existing recovery/selection/scope regressions protect prior behavior.

## Slice 10: Attention reflow (ATT-003)

Owner accepted the next task after PR #39 merged at efb90d6. Keep the existing desktop layout, cap the medium-width sidebar relative to viewport width, allow recovery tracks and long exact identifiers to wrap, and stack evidence labels/values in constrained workspaces. No truncation of recovery identity or changes to resolution authority. CSS-only product change; rollback is a stylesheet revert. ATT-004 semantics and A08/A09 remain open. Constitution check PASS; requirements checklist 16/16; Feature 002 selector preserved; no hooks configured.

Red-first Electron verification uses real isolated fixture crash/restart records with long Windows paths. Check horizontal containment at standard, medium and narrow widths with normal/200% root text; select and dismiss at enlarged text and independently read the exact saved resolution. Existing recovery and mission-return tests retain functional coverage.

## Slice 11: ATT-004 recovery accessibility

Owner approved ATT-004 after PR #40 merged at 63fd09b. The shell owns the single main landmark; the HTML mount is a div and destination roots become named sections. Recovery selection uses aria-current on native buttons with aria-controls pointing to the detail. Retain native Tab/Enter/Space behavior rather than inventing a listbox with nested actions. When an inventory update removes the focused record, restore focus to the surviving selected row or empty heading only if focus still belongs to that record (or its removed element). Never steal focus from a newer target. No new persistence, IPC or provider authority. Constitution PASS; checklist 16/16, selector preserved, no hooks.

Red-first Electron tests cover one main in all six destinations, keyboard selection, row/detail dismissal and final empty focus. Independent sessions.list verifies exact resolution; delayed dismissal verifies that focus moved elsewhere is preserved. Existing selection, recovery, scope and layout regressions remain checks.

## Slice 12: SET-001 pending folder approval

Owner accepted recommended SET-001 via Next slice on open PR #42. Baseline ca2c620, audit 97a6184. Use a synchronous single-flight guard plus rendered Approving state. Retain the exact candidate disclosure until response; disable repeat approval and Cancel, and ignore Escape during the write. Before submission Cancel/Escape still close with no approval. Success closes and shows saved workspace; failure closes with the existing actionable error and requires a fresh folder choice/token. Clear old errors before submission. No shared modal, main, IPC or persistence change. Constitution PASS; checklist 16/16, Feature 002 selector preserved, no hooks.

Red-first Electron regression holds approval responses, checks duplicate activation, Cancel/Escape protection, exact candidate identity, failure/fresh choice, saved readback and restart. Existing launch/recon regressions retain authority coverage. Update open PR #42 after verification; other SET findings remain proposed.

## Slice 13: SET-002 roster read recovery

Owner accepted next slice after PR #42 merged at 29ef3a5. Separate roster loading, ready, error and collection-waiting states. Initial failure never claims an empty roster. Retry re-reads the exact workspace and retains clearly labeled last-known run data while pending; obsolete responses after cleanup cannot update the current view. Keep the five-read/300ms collection budget; catch rejection, cancel timers and expose Retry when exhausted. An ended session must not be labeled running. Gate Run recon and proposal Review until the read is ready, and prevent a second Run recon while current outcome is pending. No IPC, persistence, dependencies or automatic execution. Constitution PASS; checklist 16/16, Feature 002 selector preserved, no hooks.

Red-first real Electron fixtures cover initial read failure, held retry, late response after section exit, bounded collection exhaustion/rejection and exact run/proposal preservation. Main readback and session IDs establish that retry never launches or imports. Existing recon and approval/launch tests retain authority coverage.

## Slice 14: SET-003 provider readiness recheck

Owner accepted next slice after PR #43 merged at a834317. Rename the Agents heading to Provider readiness. Add single-flight Check again with checking/success/failure feedback and each provider's probedAt timestamp. Preserve workspace selection. Checking and request failure disable launch from this panel until successful recheck; per-provider availability remains independently authoritative. The existing listReadiness operation emits readiness events; ignore local completion after unmount and reject older probedAt events in the shared store. No install, sign-in, launch, IPC or persistence changes. Constitution PASS; checklist 16/16, selector preserved, no hooks.

Verify red-first through the UI with local fixtures: duplicate recheck, held failure/retry, exact workspace preservation, updated per-provider evidence, obsolete completion after navigation and unchanged sessions/workspaces. Timestamp ordering gets a focused regression. Existing launch/recon tests retain authority coverage.

## Slice 15: SET-004 Settings reflow

Owner accepted next slice after PR #44 merged at bbf80a9. Scope inner Settings sizing: shrinkable cards/grid children, wrapped exact paths and actions, stacked health/disclosure facts when constrained. Preserve shared sidebar behavior and all approval/launch/recon authority. Product changes are scoped CSS; no persistence/IPC/dependencies. Constitution PASS; checklist 16/16; selector preserved, no hooks.

Red-first Electron geometry checks cover 1264/960/680 widths with 100%/200% text, long folder identity, approval and recon dialogs. Verify keyboard approval/readiness/cancellation against exact saved workspace and zero sessions; retain existing approval, recheck, recon and launch regressions. Inspect captures before PR.

## Slice 16: SET-005 temporary recon lifetime

Owner accepted the recommended lifetime-clarification slice after PR #45 merged at b3b0a1b. Explain before confirmation and in the roster that unaccepted proposals last only for the current app session; exiting/restarting or starting another recon clears/replaces them. Review/import is the existing deliberate keep path; imported profiles are saved in Agents. Loaded-empty wording states that no recon run is loaded rather than implying no roster has ever existed. No new export, persistence, recovery, confirmation or provider authority. Constitution PASS; checklist 16/16, selector preserved, no hooks.

Red-first Electron lifecycle regression verifies disclosure before launch, reviewed import of one exact proposal, preservation through cancelled replacement, and restart: imported profile ID remains while getRun is null and no sessions restart. Existing recon, read-retry and enlarged-text checks retain functional/layout coverage. Durable proposal recovery remains a separately deferred capability decision.

## Slice 17: MIS-003 existing-session runtime truth

Owner accepted the A09 recommendation via "merged next slice" after PR #47 merged at 5641268. Existing worker sessions expose fixed recorded model, effort, permission and limits; explicit Switch to new session enables editing without authorizing automatic startup. Older mismatched drafts require deliberate Use recorded settings; unavailable or incompatible sessions identify the exact worker and retain its saved identity for repair. Review refreshes eligibility and points to Crew for repair, while main preview/confirmation stays authoritative against races. No IPC/schema/provider-authority change. Constitution PASS; requirements 16/16; Feature 002 selector preserved; no hooks.

Red-first Electron regression seeds an older invalid draft, proves main rejects it and shows fixed controls/repair; verifies exact saved tuple, reopen, new-session edit/reselect, safe preview and unchanged live IDs/PIDs. Ended-session review must identify the worker with no mission/process creation. Run composer/navigation and static checks; preserve historical audit captures and open PR.

## Slice 18: MIS-004 shared-folder access

Owner accepted the next A09 slice after PR #48 merged at 2916702. Separate worker folder assignment from one access group per bound folder. Each group names the exact folder and every affected member, including supervisor; Read/Write changes the folder-level mission rule for all listed members. Moving a worker preserves the chosen mode on any folder still used by the supervisor or another worker and removes unused entries through existing derivation. Supervisor-only groups remain directly editable from Review's Access return. Do not silently upgrade access or change live session runtime/workspace authority. Missing approval/membership gets explicit unavailable guidance. Existing main review/confirmation stays authoritative. No IPC/schema/dependency changes. Constitution PASS; requirements 16/16, Feature 002 selector preserved, no hooks.

Red-first Electron proof reproduces shared-mode propagation and the missing supervisor-only control, verifies one control per folder, retained modes after worker moves, held supervisor review and direct repair, exact saved/preview readback and unchanged live IDs/PIDs. Restart readback verifies durable modes without claiming live process resumption. Run existing composer/runtime/navigation regressions and static checks; open PR.

## Slice 19: SES-004 launch review recovery

Owner accepted the next A09 slice after PR #49 merged at 6a28030. Expired or rejected launch reviews disable their old confirmation and offer Refresh review, preserving all form values. Fresh recovery review requires renewed boundary confirmation. Ordinary input changes retain the existing automatic-preview interaction and boundary acknowledgement; they do not introduce another gate. Current input identity, deadline and main disposition gate launch. Single-flight launch prevents duplicate activation; inputs and Escape/cancel stay blocked during submitted launch. Preview cancellation discards obsolete responses. Main token consumption and authority remain unchanged. No IPC/schema/dependency changes. Constitution PASS; requirements 16/16, selector preserved, no hooks.

Red-first Electron recovery test injects a rejected token, verifies no records/processes, then refreshes and reconfirms exact settings before one launch. Additional scenarios cover real wall-clock expiry, failed/held refresh and late completion after cancel, plus existing launch/runtime checks. Record injection separately from real main expiry evidence and open PR.

## Completion roadmap checkpoint

Owner requested a numbered roadmap after PR #50 merged at `42ff10b`. The roadmap maps 18 remaining finding IDs to 12 implementation/revalidation slices and two final verification slices. T001-T098 remain complete; future granular tasks will be added when each bounded slice starts. This documentation checkpoint performs no product implementation. Next: slice 20, TPL-002.

## Slice 20: TPL-002 deletion review recovery

Owner accepted the next roadmap slice after PR #51 merged at `44de3ef`. Failed deletion consumes/invalidate its renderer review and disables confirmation. Refresh deletion review reads the current revision of the same template, displays a fresh review and requires another explicit Confirm delete template. Keep template/Escape dismiss when idle; pending operations block dismissal and repeated submission. Error guidance names deletion and dependent drafts. Existing main token consumption, revision checks and dependency denial remain authoritative. No IPC/schema/dependency changes. Constitution PASS; requirements 16/16; selector preserved; no hooks. Red-first Electron proof covers real dependent-draft denial, refreshed retry, independent template/draft readback, cancellation, expiry and delayed/failed refresh as applicable.

## Slice 21: SES-002 ended-session inventory

Owner requested the next slice; PR #52 already merged at `3b71d9f`. One shared inventory derivation drives list, tabs and dock within the current scope. Show/Hide applies to stopped, failed and recovery-required records. A selected ended record reveals ended inventory; explicit Hide selects the first live scoped record or null before collapse. All-ended collapsed scope retains Show and clear empty guidance. Scope changes preserve a visible selection or choose the first visible record; external ended selection reveals it. Attention uses the same list policy. No lifecycle, persistence, IPC or process-authority changes. Constitution PASS; requirements 16/16; selector restored; no extension hooks. Use red-first UI proof with independent lifecycle/PID/readback plus scope/recovery regressions. PR #52 CI formatting failure names tests/e2e/mission-folder-access.spec.ts; include its formatting-only repair and full formatter check.

## Slice 22: SES-003 and remaining SES-005

Owner accepted next slice after PR #53 merged at `dc60e3a`. Tabs show provider, workspace leaf and short session ID with full path/ID accessible context. Roving tab stop, Left/Right wrapping and Home/End update exact selection and retain focus. Each tab controls an exact named terminal panel; mounted inactive terminals remain hidden. Terminal host/heading IDs include session ID in loaded and lazy states. Preserve single-main and ended-inventory fixes. No process, IPC, schema or dependency changes. Constitution PASS; requirements checklist 16/16; selector restored; no hooks. Add red-first Electron identity/keyboard/ID test and run terminal/scope/ended regressions with independent lifecycle readback. CI carry-forward: PR #53 installer/CodeQL passed but full E2E failed; repair the evidenced short-path assumption in the owned ended-inventory test and record other failures separately.

## Slice 23: Mission draft identity and management

Owner requested the next slice after PR #54 merged at 3e3accc. MIS-007/015 and NAV-004: derive a bounded saved objective title in the existing draft summary contract, show short IDs for duplicates, selected state, stage and save time. Add row discard through existing version-bound preview/confirm operations in a native modal; flush active edits first, block duplicate submission, retain failures and require fresh review. Cancel writes nothing. Deleting the active draft leaves its editor only after success. Cap guidance focuses the existing draft inventory. Bound mission/draft lists and the narrow rail so 50 missions plus 20 drafts cannot displace the workspace entirely. No migration, dependency, polling, process authority or external provider run. Constitution PASS; checklist 16/16; selector restored to Feature 002; no hooks.

Verify red-first identity and cap recovery, exact deleted/saved IDs and restart, duplicates/long names, stale/failed/pending/cancelled requests, keyboard navigation and narrow/200% layout. Use main-owned fixture contracts for seeding and independent readback.

## Slice 24: saved agent draft identity (TPL-001)

Owner requested the next slice after PR #55 merged at 38aee7b. Add an explicit bounded displayName to AgentWizardDraftSummaryView, derived from the saved name and shared by list/detail receipts. Renderer uses the saved name or Unnamed agent, human step labels, last-updated time and secondary short/full identity. Preserve all draft types, exact-ID resume, version guards, open-draft cap and content-free events. No bulk detail fetch, migration, dependency, polling or provider run. Constitution PASS; requirements 16/16; selector remains Feature 002; no hooks. Verify duplicates, blank/incomplete and long names, exact resumed fields, save/rename, cancellation and restart through real UI/main readback.

## Slice 25: repository ideas and source context (MIS-006)

Owner requested next slice after PR #56 merged at 0d82f8e. Bind ideas to exact workspace/provider inputs; invalidate on changes/revocation and ignore late results/unmount. Keep one generation request in flight; changing selection does not claim to cancel a provider process. Label automatic provider and provider-default model/effort accurately. Picking saves bounded repoIdeaSource context (workspace ID/path, provider ID and idea title) alongside editable objective/proof. Show that context in Outcome on resume/restart; it grants no folder access and is omitted from the mission authority envelope. No migration, dependency, polling, provider execution or permission changes. Constitution PASS; requirements 16/16; Feature 002 selector preserved; no hooks.

Test baseline stale selection, controlled delayed generation/input changes, saved source readback/restart, revoked folder and unchanged mission preview/confirmation authority. External provider execution is replaced with isolated test hooks.

## Slice 26: Mission flow hierarchy

Owner authorizes sequential continuation after PR creation, including dependent PRs while awaiting owner merges. Baseline main 8b9d549 (PR #57). MIS-005/009/010: share entry/composer frame and preparatory context; successful Close saves once and exits with feedback; failed close retains explicit unsaved choices. Put final Start/Apply beside Close/Back in the sticky action area with pending protection; successful confirmation lands on the exact Mission overview, with details available deliberately. No schema, provider, process or permission changes. Requirements 16/16; constitution PASS; no hooks; Feature 002 selector preserved. Verify red-first direct close, saved state, failed save recovery, ready/expired review and exact overview landing.
