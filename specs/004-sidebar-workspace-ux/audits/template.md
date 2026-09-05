# Section audit template

Use for one registered section. Template placeholders are intentional; this file is not a completed audit.

## Baseline and scope

- Audit ID, section, date, reviewer, branch and exact revision:
- Windows version, app build, viewport and text scale:
- Worktree state and fixtures versus real data:
- Destination, related items, pages, dialogs and cross-section entry/return paths:
- Evidence location and reproduction/recapture instructions:
- Limitations and states not exercised:

## Coverage matrix

| Flow or item | Normal | Empty | Loading | Error/prerequisite | Recovery | Keyboard/focus | Text scale/narrow width | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Add each reachable primary/secondary flow | Pending | Pending | Pending | Pending | Pending | Pending | Pending | None |

Use observed, source-only, pending, or not applicable with a reason. Do not infer a pass from a screenshot capture succeeding.

## Logic and functionality inventory

Inventory every reachable action, including secondary menus, disabled actions, and apparent no-ops. Trace the current handler and governing rules before deciding which runtime scenarios demonstrate them.

| Action / flow | Initial state and exact target | Validation / eligibility / decision rule | Requested state change and side effects | Observed UI result | Independent outcome evidence | Negative / repeated / interrupted case | Reopen / restart result | Verdict / blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Add each action; identify source locations | Pending | Pending | Pending | Pending | Saved-state readback, lifecycle event or process evidence as applicable | Pending | Pending or justified N/A | Not verified |

- Exercise primary flows through real UI controls. Identify fixture seeding and any direct calls used for setup or independent readback; those are not evidence that the UI action works.
- Verify save claims by reading saved values and reopening; verify process control against the exact session/process; verify resolve/apply claims against authoritative state, not a toast or changed label alone.
- Include applicable validation, permissions, stale state, rapid/repeated activation, failure/retry, cancellation, and partial-effect handling. Check that denied actions leave no unintended effects.
- Observe persistence and recovery after a controlled isolated restart where relevant; do not equate restoring records with resuming processes.
- Use isolated fixtures and existing permission boundaries. Provider-dependent or externally consequential cases without authorization remain blocked with a next verification step.
- Record visual/interaction, logic, and runtime functionality verdicts separately: observed pass, observed failure, source-only, pending, blocked, or justified not applicable. Screenshots and passing unrelated tests cannot upgrade a functional verdict.

## Findings

For each finding record:

- Stable section-prefixed ID and priority (high: wrong target/data loss/impossible control; medium: workflow/identity friction; low: polish):
- Category: visual/interaction, logic, functionality, or multiple:
- Trigger, initial state, exact target, and observed behavior:
- Expected user outcome and impact:
- Evidence type, exact source location or reproducible steps, and artifact:
- Proposed improvement and any alternatives/tradeoffs:
- Linked FR and acceptance scenario:
- Cross-section implications and owning capability feature:
- Disposition: proposed / accepted / amended / deferred / rejected; decision date and reason:
- Verification: not implemented / implemented-unverified / verified with evidence:

## Proposed interaction design

Show the short user flow, page/action hierarchy, save/close and return behavior, applicable authority facts, and error/keyboard handling. Separate common conventions from justified section differences.

## Section acceptance summary

- Visual/interaction verdict and evidence:
- Logic correctness verdict and traced actions:
- Runtime functionality verdict and independently checked outcomes:
- Missing or blocked scenarios, reason, and next step:
- Cross-section state consistency and owning-feature referrals:

A section can be reported as coverage-complete with explicitly documented blockers, but blocked/unexercised functionality must never be labeled verified. Documented defects may remain open until implementation; an audit's completion is distinct from a workflow passing.

## Verification and handoff

Record commands actually run and terminal outcomes. Separate source inspection, fixture behavior, live local behavior, owner approval and release readiness. Link accepted findings to plan/tasks only when those artifacts exist.
