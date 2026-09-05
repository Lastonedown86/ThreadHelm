# Audit register and migration record

Created 2026-09-05. Feature: [Sidebar and Workspace UX Consistency](spec.md).

Current main baseline: `d8a50758ec4cfbcf8333509da078427a8f73ef8f` (merged PR #33). A06 uses this baseline; AGT-001/002 are merged in PR #33. A04/A05 retain their pre-fix `a8b9483` baseline (PR #32). A03 retains its pre-fix `83883d0` evidence; SES-001 is subsequently merged in PR #32. A01/A02 retain their pre-fix `efcd523` evidence, with MIS-001/002 subsequently implemented and merged in PR #31. Read the [merge reconciliation](audits/main-merge-reconciliation.md) before using older PR #29 evidence.

## Coverage

| Pass | Surface                                                                          | Status                                                                                                                                   | Record                                                       |
| ---- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A01  | Shared sidebar and navigation                                                    | Audit pass recorded; confirmed navigation, save-loss and narrow-inventory defects; remaining matrix gaps explicit                        | [A01 report](audits/a01-sidebar-navigation.md)               |
| A02  | Missions, New mission, drafts, workspace, detail                                 | Audit pass recorded; lifecycle and persistence independently observed; confirmed defects and remaining matrix gaps explicit              | [A02 report](audits/a02-mission-functionality.md)            |
| A03  | Sessions, launch, terminals, controls, recovery                                  | Audit pass recorded; SES-001 locally verified; four proposed findings; process/recovery safeguards observed; explicit matrix gaps remain | [A03 report](audits/a03-sessions-functionality.md)           |
| A04  | Agents, library, creation, editing, review                                       | Audit pass recorded; AGT-001/002 locally verified; AGT-003 proposed; UI and saved-state proof; matrix gaps explicit                      | [A04 report](audits/a04-agents-functionality.md)             |
| A05  | Starter/template flows inside Agents: preview, import, create-agent relationship | Audit pass recorded; two proposed findings; dependencies and restart observed; matrix gaps explicit                                      | [A05 report](audits/a05-starters-templates-functionality.md) |
| A06  | Memory, search, reading, editing, revisions, associations                        | Audit recorded; MEM-001/003/004 merged; MEM-002 locally verified; independent saved-state/restart proof; matrix gaps explicit            | [A06 report](audits/a06-memory-functionality.md)             |
| A07  | Attention, prioritization, resolution, return to item                            | Audit recorded; four proposed findings; UI/logic and independent recovery/mission readback; explicit gaps                                | [A07 report](audits/a07-attention-functionality.md)          |
| A08  | Settings, folders, providers, configuration, prerequisite return                 | Pending                                                                                                                                  | Use audit template                                           |
| A09  | Cross-section reconciliation                                                     | Pending A01–A08                                                                                                                          | Shared conventions and conflicts                             |

The Mission baseline was generated in this task from current source, a successful desktop build, a passing isolated parity screenshot workflow (1 test, 49 seconds), and direct UI probes. The workflow passing establishes capture success, not UX acceptance. It is not a full accessibility, coverage, release, or provider-autonomy proof. The Windows version was not captured by those probes and must be recorded in subsequent acceptance evidence.

## Imported findings and requirement traceability

Owner instruction "Start with recommended" accepted MIS-001/002 (NAV-001–003) as the first implementation slice. Those reproduced cases are implemented and locally verified; see [slice 1 verification](verification.md). All other improvements remain proposed and open, including MIS-015 and NAV-004. The table incorporates new evidence where identified; remaining imported findings retain their original evidence limitations.

| Finding | Source section | Observation                                                                      | Evidence classification                                                  | Requirements           | Next verification                                                              |
| ------- | -------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------ |
| MIS-001 | 1              | New mission and Resume draft fail to navigate from Settings                      | Isolated runtime reproduction plus source                                | FR-004                 | Reproduce from all six current destinations (reproduced on refreshed baseline) |
| MIS-002 | 2; A01/A02     | Composer selection disagrees; New mission and failed-save navigation lose edits  | Runtime plus saved-value/restart readback: D03, D05–06, N04              | FR-004, FR-005, FR-018 | Verify proposed unified transition; in-flight save race remains pending        |
| MIS-003 | 3; A02         | Existing session accepts impossible model edits; review rejects them generically | Runtime plus draft readback and zero mission count: M01                  | FR-006, FR-011         | Verify fixed live values and exact field repair after design acceptance        |
| MIS-004 | 4; A02         | Worker folder mode changes supervisor access and leaves indirect repair          | Runtime plus saved workspace map and review hold: M00, M01               | FR-006, FR-013         | Verify grouped folder controls including supervisor                            |
| MIS-005 | 5              | Repo entry frame and context differ from composer                                | Fresh screenshot plus source                                             | FR-004, FR-009         | Empty and configured entry at desktop widths                                   |
| MIS-006 | 6; A02         | Repo change leaves stale ideas selectable; chosen draft lacks repo context       | Runtime plus draft readback: I01–02; label remains source-confirmed      | FR-010                 | Verify input invalidation and retained source context                          |
| MIS-007 | 7              | Draft rows lack meaningful identity and management                               | Isolated runtime reproduction plus source                                | FR-008                 | Multiple drafts, duplicate names, discard recovery                             |
| MIS-008 | 8              | Sidebar omits actionable mission state distinctions                              | Fresh screenshot plus source                                             | FR-007, FR-008         | Decision, unknown, paused and completed inventory                              |
| MIS-009 | 9; A02         | Saved close requires a receipt and another close                                 | Normal close and restart preserve exact values: D01–02; friction remains | FR-005, FR-009         | Verify one successful close and explicit failure choices                       |
| MIS-010 | 10             | Review footer and post-start landing disrupt hierarchy                           | Fresh review screenshot; post-start behavior source-only                 | FR-009, FR-013         | Ready/held/expired review and successful start                                 |
| MIS-011 | 11             | Runtime choices, startup intent and prerequisite fixes differ                    | Source plus fresh crew screenshot                                        | FR-006, FR-009, FR-011 | Compare session launch and new/existing worker paths                           |
| MIS-012 | 12             | Continue cannot activate its invalid-field focus branch                          | Current source; older repository audit has runtime evidence              | FR-011, FR-012         | Keyboard validation in each form stage                                         |
| MIS-013 | 13             | Selection loading may retain stale mission identity                              | Source-confirmed                                                         | FR-004, FR-011         | Delayed/failing item load after selection change                               |
| MIS-014 | 14             | Landmarks, discard dialog and navigation focus differ                            | Nested landmarks observed in probe; remaining claims source-only         | FR-012                 | Keyboard navigation, modal dismissal, landmark inspection                      |
| MIS-015 | A02            | At 20 drafts, cap error recommends deletion without normal discard access        | Runtime plus authoritative count and limit rejection: N02                | FR-008, FR-011, FR-018 | Design normal management/discard; later verify deletion and restart            |
| NAV-004 | A01            | Expanded 20-draft list pushes main content below a narrow viewport               | Runtime geometry and retained screenshot: N03                            | FR-008, FR-009, FR-012 | Verify compact bounded inventory at narrow widths and keyboard access          |

Numbered source sections refer to `audits/missions.md`. Stable MIS IDs are assigned here without rewriting the original evidence report. MIS-001/002 now have a locally verified slice disposition below. The table preserves their pre-fix observations; other entries are not marked fixed.

## Durable evidence policy

The imported prose report is retained in Git. Its source paths and screenshot filenames describe the baseline; screenshots initially lived in ignored local `artifacts/parity` and are not presumed available to another checkout. Later audits must record artifacts in an agreed durable review location or record the precise recapture procedure and limitations. Never report missing screenshots as inspected by a later reviewer.

Capture baseline: `pnpm desktop:build`, then `PARITY_SHOTS=1 pnpm exec playwright test tests/e2e/parity-screenshots.spec.ts` (set the variable using the current shell's syntax). These use isolated fixture data; inspect the current harness before reusing them. Full suite was not run for the initial audit.

## Next stages

1. Continue A07–A08 using [the shared template](audits/template.md); close the explicit A01–A03 matrix gaps without treating source-only checks as runtime passes.
2. Reconcile A09, update requirements if new evidence warrants, and record findings as accepted, amended, deferred, or rejected with reasons.
3. Present the shared interaction design and section-specific deviations for owner review. The present spec is a draft, not that approval.
4. Run Spec Kit clarification if material questions remain, then planning in an isolated worktree targeting Feature 004. The normal `SPECIFY_FEATURE_DIRECTORY` override persists `.specify/feature.json`; do not run it in the shared checkout as though it were read-only. Use the read-only resolution below for inspection and exclude any selector change from this audit PR.
5. Generate dependency-ordered tasks only after the plan defines accepted slices, verification, and capability boundaries. Do not manufacture implementation tasks for unaudited sections.
6. Implement approved slices and verify each accepted finding using its linked scenario, then reconcile cross-section behavior and record remaining limitations.

The original migration generated no implementation plan. The owner subsequently accepted the bounded first slice; [plan.md](plan.md) and [tasks.md](tasks.md) now cover only that work. Feature 002 and Feature 003 artifacts remain unchanged.

## Read-only Spec Kit target check

Verified against the current PowerShell resolver. This command resolves paths without persisting the selector and does not require a plan to exist:

```powershell
$env:SPECIFY_FEATURE_DIRECTORY = 'specs/004-sidebar-workspace-ux'
try {
    . ./.specify/scripts/powershell/common.ps1
    Get-FeaturePathsEnv -NoPersist
} finally {
    Remove-Item Env:SPECIFY_FEATURE_DIRECTORY
}
```

Run in a dedicated shell with no pre-existing feature override. Before later planning, create an isolated worktree, select Feature 004 there, and verify the generated paths. Whole-feature planning remains pending the section audit and design gates. The owner-authorized MIS-001/002 slice has its own bounded plan and ledger; it does not approve other findings.

## Required logic and functional observation by section

Owner scope clarification: every pass includes presentation, decision logic, and actual functionality. FR-016–019, US7 and SC-009–011 make this mandatory. The following is a minimum guide; each pass inventories all reachable controls rather than limiting itself to these examples.

| Pass | Required functional observations                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A01  | Navigation and selection transitions, pending edits, stale content, badge counts and exact targets                                            |
| A02  | Draft save/readback/reopen, validation, crew eligibility, shared access, preview/confirmation, start/pause/revise and recovery rules          |
| A03  | Launch and terminal attachment, input/interrupt/stop target, actual lifecycle result, ended-session disclosure, recovery and restart behavior |
| A04  | Profile creation/edit/revision, persistence, eligibility and binding effects, confirmation and cancellation                                   |
| A05  | Template preview/import/duplicate, validation, draft creation, saved profile provenance and absence of unintended launch effects              |
| A06  | Memory, search, reading, editing, revisions, associations                                                                                     | Audit recorded; MEM-001/003/004 merged; MEM-002 locally verified; independent saved-state/restart proof; matrix gaps explicit | [A06 report](audits/a06-memory-functionality.md) |
| A07  | Queue inclusion/counting, underlying unresolved state, exact resolution target, actual resolution, retry and return navigation                |
| A08  | Folder approval/revocation, provider availability, effective configuration, recon stop/collection behavior and prerequisite return            |
| A09  | Consistency between originating control, destination, authoritative result and restored state across sections                                 |

The historical Mission audit remains partial; the new A01/A02 reports supply separate current evidence. Successful close now has exact saved-value and restart readback. Live-session mismatch, shared-access repair, save interruption, start/pause/resume/revise/cancel/delete and selected crash/unknown-effect safeguards were observed. These results do not retroactively upgrade the historical report or establish real-provider autonomy.

Remaining A01/A02 gaps include badge reconciliation, 50-mission inventory, delayed item loading, conflict/retry/discard effects, save concurrency, all numeric/provider combinations and detailed keyboard paths. Each report distinguishes visual, logic and runtime verdicts. The pre-fix defects remain recorded as observed; only the separately verified first-slice cases have changed disposition. A completed observation run is not blanket UX acceptance.

## Current reproducible evidence

Windows 11 Home x64, OS release 10.0.26200. Fresh `pnpm desktop:build` passed. Selected E2E verification passed **32 tests**: 28 across mission-composer, mission-focus-workspace, supervisor-mission and accessibility, plus 4 repo-idea-generation tests. The full suite was not run.

Run from the repository root after building the audited baseline:

```powershell
pnpm exec playwright test tests/e2e/mission-composer.spec.ts tests/e2e/mission-focus-workspace.spec.ts tests/e2e/supervisor-mission.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/repo-idea-generation.spec.ts
node specs/004-sidebar-workspace-ux/audits/probes/a01-a02.mjs drafts
node specs/004-sidebar-workspace-ux/audits/probes/a01-a02.mjs missions
node specs/004-sidebar-workspace-ux/audits/probes/a01-a02.mjs ideas
```

The observation modes use isolated temporary app data and fixture providers, record defects as observations, and overwrite their corresponding baseline evidence files. Recheck the baseline before recapture. Durable outputs: [drafts](audits/evidence/efcd523-drafts.json), [missions](audits/evidence/efcd523-missions.json), [ideas](audits/evidence/efcd523-ideas.json), [narrow draft inventory](audits/evidence/efcd523-narrow-drafts.png). No external provider was run; no application implementation changed.

## Slice 1 disposition — 2026-09-05

Accepted scope: edit preservation and navigation consistency (MIS-001/002, NAV-001–003). Owner direction authorizes this bounded implementation before the other section audits; it does not waive their evidence requirements.

| Finding           | Disposition                                        | Independent proof                                                                                                                              | Remaining limits                                                                                                                              |
| ----------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| MIS-001 / NAV-001 | Implemented and locally verified                   | New mission and Resume draft from all six destinations; selected destination and saved fields agree                                            | Other destination internals belong to A03–A08                                                                                                 |
| MIS-002 / NAV-002 | Implemented and locally verified for audited exits | Immediate New mission save/restart, failed destination and New mission exits, explicit unsaved exit/restart, draft isolation, conflict choices | In-flight save draining has deterministic unit proof; renderer/IPC latency stress and unsubmitted list-item buffers remain outside this slice |
| MIS-002 / NAV-003 | Implemented and locally verified                   | Mission selection replaces composer, preserves outgoing fields, selects exact mission and leaves live fixture sessions unchanged               | Delayed mission-detail identity (MIS-013) remains a separate open finding                                                                     |

The save queue acknowledges only the submitted snapshot and drains newer edits before navigation; a failed request cancels pending debounce retry. A native unsaved-changes dialog offers Keep editing, Retry and Leave without saving. Draft loading gates editing and draft ID changes remount local state. [Verification](verification.md) records exact test scope and [the dialog capture](audits/evidence/slice-1-save-failure.png). Other findings remain proposed. No merge, release, real-provider capability or whole-feature completion is asserted.

## A03 Sessions disposition — 2026-09-05

A03 audit pass recorded at main `83883d0`. Its [report](audits/a03-sessions-functionality.md) inventories UI controls, logic and independent functional observations. At audit capture all five findings were proposed and no app code changed. The owner subsequently accepted SES-001 via "Recommended"; its bounded implementation and verification are tracked below. SES-002 through SES-005 remain proposed.

| Finding | Priority | Observation                                                                                     | Requirements       | Next decision/verification                                                                                  |
| ------- | -------- | ----------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------- |
| SES-001 | High     | Mission-only Sessions hides a newly launched unrelated live session and overrides its selection | FR-004/006/013/017 | Implemented and locally verified in slice 2; see verification.md; A01/A02/A08 broader coverage remains open |
| SES-002 | Medium   | Hide ended cannot hide selected-ended inventory; collapsed list still exposes ended tabs        | FR-007/008/009     | Agree one inventory/selection policy, including selected ended item                                         |
| SES-003 | Medium   | Same-provider tabs have identical names and incomplete keyboard/tab semantics                   | FR-008/012         | Review named session selection and consistent keyboard model                                                |
| SES-004 | Medium   | Expired preview leaves Launch enabled with the invalid token; repeated click fails again        | FR-010/011/018     | Review in-place Refresh review preserving settings and confirmation rules                                   |
| SES-005 | Medium   | Nested main landmarks and duplicate terminal IDs                                                | FR-009/012         | Reconcile shared shell landmarks and unique terminal naming with A01                                        |

Evidence: [11 recorded observations](audits/evidence/83883d0-sessions.json), three inspected captures, and two completed audit scenarios (2.3m). Fresh build plus 21 existing E2E tests passed: launch, input isolation, stop/force-stop, recovery/restart, directed coordination, terminal visibility and sampled accessibility. Passing safeguards do not negate the observed UI defects. Full suite and external providers were not run.

SES-001 is accepted for slice 2; T008-T012 extend the ledger without reopening completed MIS-001/002 tasks. Remaining A03 matrix gaps and A04–A09 work stay open; queue/setup internals remain owned by A07/A08.

### SES-001 implementation disposition

Owner accepted SES-001 via "Recommended". Implemented explicit All sessions / Selected mission, global reset, exact launch landing and mission terminal entry. [Slice 2 verification](verification.md#slice-2-ses-001-explicit-scope) records UI, logic and independent functional evidence, including unchanged live IDs/PIDs through navigation. T008-T012 complete this bounded slice locally; no PR or hosted CI claim. Original A03 evidence remains pre-fix. SES-002 through SES-005 and outstanding A03 matrix gaps remain open.

## A04/A05 disposition - 2026-09-05

PR #32 verified merged at `a8b9483`; main fast-forwarded and audit branch `codex/audit-agents-templates` created. Product source unchanged. The selector remains Feature 002. A04/A05 audit records distinguish observed outcomes, source-only concerns and pending matrix cases.

| Finding | Priority | Proposed improvement                                                                 | Disposition                                   |
| ------- | -------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| AGT-001 | High     | Load every saved roster profile through bounded pagination; preserve exact selection | Implemented and locally verified in slice 3   |
| AGT-002 | Medium   | Reconcile filtered roster and actionable detail; use accurate empty/loading copy     | Implemented and locally verified in slice 3   |
| AGT-003 | Medium   | Keep inner workspace readable at 960px / 200% text; reconcile shared sidebar width   | Proposed, shared A01/A09 concern              |
| TPL-001 | Medium   | Resume drafts by saved name with step/update metadata and secondary ID               | Proposed, summary contract change required    |
| TPL-002 | Medium   | Recover blocked/expired template deletion with dependency guidance and fresh review  | Proposed, retain authoritative deletion guard |

Owner accepted AGT-001 + AGT-002 via "Lets do the next slice"; slice 3 extends the existing plan and tasks (T013-T018). A06 Memory was subsequently audited on merged PR #33; A07/A08 and cross-section reconciliation remain open.

Verification: fresh desktop build passed; 12 existing Agents/wizard E2E passed (35.2s); 5 focused persistence/contract/Windows integration files with 79 tests passed (20.38s). Two direct observation scenarios retain 15 unique records, including reviewed-versus-saved field equality, template content equality, blocked mutation, actual restart and empty live-process inventory. Screenshot captures inspected. A draft-pagination suspicion was rejected after verifying the enforced 20-open-draft limit; roster pagination was independently reproduced at 51 profiles. Full-suite, audit-branch hosted CI, real-provider execution and release completion are not claimed.

Final direct observation run: 2 scenarios completed (15.9s), 15 unique records. Both probe files lint clean; five changed text files pass formatting; 32 local documentation links resolve; diff whitespace check passes; scoped Gitleaks reports no leaks. No product-source changes or implementation tests added.

### Slice 3 implementation disposition

AGT-001/002 implemented in the renderer: complete bounded roster paging, selection preservation, filtered-empty state/reset, exact import landing, identity-safe detail loading and explicit retries. Main-owned readback verifies eligibility, identity and restart outcomes; controlled delayed/failed reads verify stale-response exclusion and retry behavior. Original A04/A05 captures remain pre-fix. See [verification](verification.md#slice-3-agt-001002-roster-access-and-selection). AGT-003, TPL-001/002 and A06-A09 work remain open. No merge/release or audit-branch hosted CI claim.

## A06 Memory disposition - 2026-09-05

PR #33 verified merged at `d8a5075`; main fast-forwarded before branch `codex/audit-memory-functionality`. AGT-001/002 are merged; original A04/A05 evidence remains pre-fix. [A06 report](audits/a06-memory-functionality.md) records four proposed findings and the complete action inventory with explicit gaps:

| Finding | Priority | Proposed improvement                                                                               | Disposition                                 |
| ------- | -------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| MEM-001 | High     | Invalidate supersession review after title/body edits; commit the exact newly reviewed content     | Implemented and locally verified in slice 4 |
| MEM-002 | High     | Temporary session reading list with refreshed exact-edition lifecycle and deleted-content clearing | Implemented and locally verified in slice 7 |
| MEM-003 | High     | Preserve selected workspace through guided search                                                  | Implemented and locally verified in slice 5 |
| MEM-004 | Medium   | Preserve selected detail across pagination append                                                  | Implemented and locally verified in slice 6 |

Validation: fresh build; 4 existing Memory E2E tests and 32 focused unit/contract/integration tests passed. Two direct audit scenarios completed with 9 retained observations and 3 inspected screenshots. Publication and lifecycle outcomes were read independently; deletion survives restart with null body and no search result. Reading-list stale state is a renderer defect, not evidence of failed durable deletion. No product edits or new implementation tasks. A07 Attention is next unaudited; A08/A09 and prior matrix gaps remain open. Full suite, hosted CI, provider execution and release readiness are not asserted.

### Slice 4 implementation disposition

Owner accepted MEM-001 via "next slice" on 2026-09-05. Title/body edits now invalidate review; exact reviewed content is visible; pending operations are guarded; cancelled responses cannot revive review; append rejection retains edits and offers fresh review inside the dialog. Implemented and locally verified; see [slice 4 evidence](verification.md#slice-4-mem-001-exact-supersession-review). Original A06 captures remain pre-fix. MEM-002/003/004 remain proposed; A07-A09 and matrix gaps remain open. No PR/hosted CI/release completion is claimed.

### Slice 5 MEM-003 disposition

PR #34 verified merged at 9d99ac6; MEM-001 is merged. Owner accepted MEM-003 via "Next slicew". Guided search now preserves the selected workspace and contested filter; repeat requests run without remounting; obsolete search/detail responses cannot restore old context. Implemented and locally verified in [slice 5](verification.md#slice-5-mem-003-stable-guided-search-scope). Original A06 evidence remains pre-fix. MEM-002/004 remain proposed; A07-A09 and prior matrix gaps remain open. Automatic PR creation is authorized at verified slice completion; merging remains owner-controlled.

### Slice 6 MEM-004 disposition

PR #35 verified merged at 17fac62; MEM-003 is merged. Owner accepted MEM-004. Appending results now retains the selected detail; failed paging retains results/detail/cursor for retry, while changed query context still clears obsolete detail. [Slice 6 verification](verification.md#slice-6-mem-004-paging-selection) records red-first failure and 8 passing Memory E2E tests with independent saved-state comparison. MEM-002 reading-list lifecycle/ownership remains proposed and requires a lifetime/association decision. A07-A09 and earlier matrix gaps remain open.

### Slice 7 MEM-002 disposition

Owner accepted the recommended temporary session list. Membership survives section navigation, exact editions retain authoritative lifecycle status, deleted content is cleared from display, failed reads offer Retry edition, and restart clears membership. No saved mission association. See [slice 7 verification](verification.md#slice-7-mem-002-temporary-reading-list-lifecycle). MEM-001/003/004 are merged; MEM-002 is locally implemented. All four confirmed A06 findings have bounded implementation evidence; this does not close the remaining A06 matrix gaps or A07-A09. A07 Attention is the next unaudited destination.

## A07 Attention disposition - 2026-09-05

PR #37 verified merged at c32f255; main synchronized before branch codex/audit-attention-functionality. All four confirmed Memory fixes are merged, while A06 matrix gaps remain. [A07 report](audits/a07-attention-functionality.md) inventories every reachable action and distinguishes runtime observations from source-only and pending cases.

| Finding | Priority | Proposed improvement                                                         | Disposition                               |
| ------- | -------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| ATT-001 | Medium   | Preserve selected recovery detail when dismissing another record             | Proposed; recommended first bounded slice |
| ATT-002 | Medium   | Clarify recovery-only Attention scope and route to pending mission decisions | Proposed; scope design decision           |
| ATT-003 | Medium   | Resolve narrow/200% text overflow with shared sidebar and detail sizing      | Proposed; shared A01/A09 concern          |
| ATT-004 | Medium   | Expose selected recovery state and reconcile nested main landmarks           | Proposed; shared accessibility concern    |

Fresh build passed; 3 existing E2E passed; 24 focused recovery tests passed with 1 explicit locked-database startup skip. Two observation scenarios completed with 8 retained records and 3 inspected captures. Dismissal survives restart, failure does not mutate saved state, and existing replacement proof uses a distinct reviewed session. No product edits or newly accepted tasks. A08 Settings is next unaudited; A09 and prior matrix gaps remain open.
