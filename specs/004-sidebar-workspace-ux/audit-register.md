# Audit register and migration record

Created 2026-09-05. Feature: [Sidebar and Workspace UX Consistency](spec.md).

Current main baseline: `8f41aae4ec65b52c4c6d7abb1c0c608fe666ec26`, merged PR #29. Read the [merge reconciliation](audits/main-merge-reconciliation.md) before using the historical Mission report.

## Coverage

| Pass | Surface | Status | Record |
| --- | --- | --- | --- |
| A01 | Shared sidebar and navigation | Pending full audit; cross-cutting Mission observations exist | Use audit template |
| A02 | Missions, New mission, drafts, workspace, detail | Initial audit imported and reconciled with PR #29; findings proposed; coverage expansion still required | [Mission baseline](audits/missions.md) |
| A03 | Sessions, launch, terminals, controls, recovery | Pending full audit; include newly collapsed ended sessions | Use audit template |
| A04 | Agents, library, creation, editing, review | Pending | Use audit template |
| A05 | Starter/template flows inside Agents: preview, import, create-agent relationship | Pending nested-flow audit; separate sidebar destination removed by PR #29 | Use audit template |
| A06 | Memory, search, reading, editing, revisions, associations | Pending | Use audit template |
| A07 | Attention, prioritization, resolution, return to item | Pending | Use audit template |
| A08 | Settings, folders, providers, configuration, prerequisite return | Pending | Use audit template |
| A09 | Cross-section reconciliation | Pending A01–A08 | Shared conventions and conflicts |

The Mission baseline was generated in this task from current source, a successful desktop build, a passing isolated parity screenshot workflow (1 test, 49 seconds), and direct UI probes. The workflow passing establishes capture success, not UX acceptance. It is not a full accessibility, coverage, release, or provider-autonomy proof. The Windows version was not captured by those probes and must be recorded in subsequent acceptance evidence.

## Imported findings and requirement traceability

All improvements are **proposed**. MIS-001–014 remain open after PR #29; individual evidence and partial presentation changes are recorded in the reconciliation. No owner design acceptance or implementation by this feature is recorded. Evidence labels in the imported table refer to the original baseline unless the reconciliation explicitly refreshes them.

| Finding | Source section | Observation | Evidence classification | Requirements | Next verification |
| --- | --- | --- | --- | --- | --- |
| MIS-001 | 1 | New mission and Resume draft fail to navigate from Settings | Isolated runtime reproduction plus source | FR-004 | Reproduce from all six current destinations (reproduced on refreshed baseline) |
| MIS-002 | 2 | Composer selection and navigation/save transitions disagree | Source-confirmed control flow; failure effects not runtime reproduced | FR-004, FR-005 | Switching, pending-save and failed-save scenarios |
| MIS-003 | 3 | Existing session settings remain editable despite fixed launch | Source plus backend rejection conditions | FR-006 | Edit live-session settings and test supported alternative |
| MIS-004 | 4 | Per-worker labels conceal shared folder access | Source-confirmed | FR-006, FR-013 | Shared worker/supervisor folder scenario |
| MIS-005 | 5 | Repo entry frame and context differ from composer | Fresh screenshot plus source | FR-004, FR-009 | Empty and configured entry at desktop widths |
| MIS-006 | 6 | Generation label, stale ideas and lost repo context | Source-confirmed | FR-010 | Change generation inputs while results exist |
| MIS-007 | 7 | Draft rows lack meaningful identity and management | Isolated runtime reproduction plus source | FR-008 | Multiple drafts, duplicate names, discard recovery |
| MIS-008 | 8 | Sidebar omits actionable mission state distinctions | Fresh screenshot plus source | FR-007, FR-008 | Decision, unknown, paused and completed inventory |
| MIS-009 | 9 | Saved close requires a receipt and another close | Isolated runtime reproduction plus source | FR-005, FR-009 | Successful close, pending save and save failure |
| MIS-010 | 10 | Review footer and post-start landing disrupt hierarchy | Fresh review screenshot; post-start behavior source-only | FR-009, FR-013 | Ready/held/expired review and successful start |
| MIS-011 | 11 | Runtime choices, startup intent and prerequisite fixes differ | Source plus fresh crew screenshot | FR-006, FR-009, FR-011 | Compare session launch and new/existing worker paths |
| MIS-012 | 12 | Continue cannot activate its invalid-field focus branch | Current source; older repository audit has runtime evidence | FR-011, FR-012 | Keyboard validation in each form stage |
| MIS-013 | 13 | Selection loading may retain stale mission identity | Source-confirmed | FR-004, FR-011 | Delayed/failing item load after selection change |
| MIS-014 | 14 | Landmarks, discard dialog and navigation focus differ | Nested landmarks observed in probe; remaining claims source-only | FR-012 | Keyboard navigation, modal dismissal, landmark inspection |

Numbered source sections refer to `audits/missions.md`. Stable MIS IDs are assigned here without rewriting the original evidence report. No entries have been marked fixed.

## Durable evidence policy

The imported prose report is retained in Git. Its source paths and screenshot filenames describe the baseline; screenshots initially lived in ignored local `artifacts/parity` and are not presumed available to another checkout. Later audits must record artifacts in an agreed durable review location or record the precise recapture procedure and limitations. Never report missing screenshots as inspected by a later reviewer.

Capture baseline: `pnpm desktop:build`, then `PARITY_SHOTS=1 pnpm exec playwright test tests/e2e/parity-screenshots.spec.ts` (set the variable using the current shell's syntax). These use isolated fixture data; inspect the current harness before reusing them. Full suite was not run for the initial audit.

## Next stages

1. Audit A01 and A03–A08 using [the shared template](audits/template.md); expand Mission coverage where the matrix remains incomplete.
2. Reconcile A09, update requirements if new evidence warrants, and record findings as accepted, amended, deferred, or rejected with reasons.
3. Present the shared interaction design and section-specific deviations for owner review. The present spec is a draft, not that approval.
4. Run Spec Kit clarification if material questions remain, then planning in an isolated worktree targeting Feature 004. The normal `SPECIFY_FEATURE_DIRECTORY` override persists `.specify/feature.json`; do not run it in the shared checkout as though it were read-only. Use the read-only resolution below for inspection and exclude any selector change from this audit PR.
5. Generate dependency-ordered tasks only after the plan defines accepted slices, verification, and capability boundaries. Do not manufacture implementation tasks for unaudited sections.
6. Implement approved slices and verify each accepted finding using its linked scenario, then reconcile cross-section behavior and record remaining limitations.

No plan.md or tasks.md has been generated by this migration. Feature 002 and Feature 003 artifacts remain unchanged.

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

Run in a dedicated shell with no pre-existing feature override. Before later planning, create an isolated worktree, select Feature 004 there, and verify the generated paths. Planning and task generation remain pending the section audit and design gates; this documentation PR is ready for review independently of that implementation readiness.

## Required logic and functional observation by section

Owner scope clarification: every pass includes presentation, decision logic, and actual functionality. FR-016–019, US7 and SC-009–011 make this mandatory. The following is a minimum guide; each pass inventories all reachable controls rather than limiting itself to these examples.

| Pass | Required functional observations |
| --- | --- |
| A01 | Navigation and selection transitions, pending edits, stale content, badge counts and exact targets |
| A02 | Draft save/readback/reopen, validation, crew eligibility, shared access, preview/confirmation, start/pause/revise and recovery rules |
| A03 | Launch and terminal attachment, input/interrupt/stop target, actual lifecycle result, ended-session disclosure, recovery and restart behavior |
| A04 | Profile creation/edit/revision, persistence, eligibility and binding effects, confirmation and cancellation |
| A05 | Template preview/import/duplicate, validation, draft creation, saved profile provenance and absence of unintended launch effects |
| A06 | Search/filter correctness, item read/edit/revision, saved state, mission associations, permission boundaries and deletion where supported |
| A07 | Queue inclusion/counting, underlying unresolved state, exact resolution target, actual resolution, retry and return navigation |
| A08 | Folder approval/revocation, provider availability, effective configuration, recon stop/collection behavior and prerequisite return |
| A09 | Consistency between originating control, destination, authoritative result and restored state across sections |

Functional coverage of the historical Mission audit remains partial. Navigation, draft identity and the close interaction were observed, but successful close was not independently proved by saved-value readback after restart. Existing-session mismatches, shared-access semantics, save interruption, final mission effects and detailed recovery still require the new action matrix. The refreshed screenshot/accessibility tests do not fill those gaps. No finding is retroactively upgraded to a functional pass.
