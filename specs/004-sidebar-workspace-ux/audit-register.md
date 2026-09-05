# Audit register and migration record

Created 2026-09-05. Feature: [Sidebar and Workspace UX Consistency](spec.md).

Current audit baseline: `efcd523f898f8353ad1975614f1953b94a5656d4`, latest fetched main, merged PR #30. A01/A02 refresh the historical Mission findings with UI execution and independent state readback. Read the [merge reconciliation](audits/main-merge-reconciliation.md) before using the older PR #29 evidence.

## Coverage

| Pass | Surface                                                                          | Status                                                                                                                      | Record                                            |
| ---- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| A01  | Shared sidebar and navigation                                                    | Audit pass recorded; confirmed navigation, save-loss and narrow-inventory defects; remaining matrix gaps explicit           | [A01 report](audits/a01-sidebar-navigation.md)    |
| A02  | Missions, New mission, drafts, workspace, detail                                 | Audit pass recorded; lifecycle and persistence independently observed; confirmed defects and remaining matrix gaps explicit | [A02 report](audits/a02-mission-functionality.md) |
| A03  | Sessions, launch, terminals, controls, recovery                                  | Pending full audit; include newly collapsed ended sessions                                                                  | Use audit template                                |
| A04  | Agents, library, creation, editing, review                                       | Pending                                                                                                                     | Use audit template                                |
| A05  | Starter/template flows inside Agents: preview, import, create-agent relationship | Pending nested-flow audit; separate sidebar destination removed by PR #29                                                   | Use audit template                                |
| A06  | Memory, search, reading, editing, revisions, associations                        | Pending                                                                                                                     | Use audit template                                |
| A07  | Attention, prioritization, resolution, return to item                            | Pending                                                                                                                     | Use audit template                                |
| A08  | Settings, folders, providers, configuration, prerequisite return                 | Pending                                                                                                                     | Use audit template                                |
| A09  | Cross-section reconciliation                                                     | Pending A01–A08                                                                                                             | Shared conventions and conflicts                  |

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

1. Continue A03–A08 using [the shared template](audits/template.md); close the explicit A01/A02 matrix gaps without treating source-only checks as runtime passes.
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
| A06  | Search/filter correctness, item read/edit/revision, saved state, mission associations, permission boundaries and deletion where supported     |
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
