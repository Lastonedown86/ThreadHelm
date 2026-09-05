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

## Findings

For each finding record:

- Stable section-prefixed ID and priority (high: wrong target/data loss/impossible control; medium: workflow/identity friction; low: polish):
- Trigger and observed behavior:
- Expected user outcome and impact:
- Evidence type, exact source location or reproducible steps, and artifact:
- Proposed improvement and any alternatives/tradeoffs:
- Linked FR and acceptance scenario:
- Cross-section implications and owning capability feature:
- Disposition: proposed / accepted / amended / deferred / rejected; decision date and reason:
- Verification: not implemented / implemented-unverified / verified with evidence:

## Proposed interaction design

Show the short user flow, page/action hierarchy, save/close and return behavior, applicable authority facts, and error/keyboard handling. Separate common conventions from justified section differences.

## Verification and handoff

Record commands actually run and terminal outcomes. Separate source inspection, fixture behavior, live local behavior, owner approval and release readiness. Link accepted findings to plan/tasks only when those artifacts exist.
