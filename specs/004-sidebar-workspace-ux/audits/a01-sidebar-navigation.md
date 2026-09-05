# A01 — Shared sidebar and navigation audit

**Later disposition:** this is the retained pre-fix audit. The owner subsequently accepted MIS-001/002; see [slice 1 implementation verification](../verification.md) for current fix status. Other proposals remain open.

**Date:** 2026-09-05. **Baseline:** `efcd523f898f8353ad1975614f1953b94a5656d4` (latest fetched main, PR #30). **Branch:** `codex/audit-sidebar-mission-functionality`.
**Environment:** Windows 11 Home x64, OS release 10.0.26200; current desktop build. Primary probes 1400 × 860; draft inventory 680 × 860; existing selected tests cover medium/narrow layout, keyboard and 200% scaling.
**Scope:** six destinations; New mission; mission list and narrow picker; draft group/resume; selected state; badges; context panel/toggle; notices; cross-section selection and edit preservation. Destination internals belong to A03–A08 except where exercised as a navigation target.

## Evidence and method

[Observation harness](probes/a01-a02.mjs) operates the built Electron UI with isolated user data. Hooks only seed fixtures, approve temporary folders, induce storage failure, and independently read authoritative operation results. Product handlers and state are not replaced. No external agents ran. Read [draft observations](evidence/efcd523-drafts.json) and [mission observations](evidence/efcd523-missions.json). IDs below refer to those records. Harness exit success means observations completed, not that every observed behavior passed.

The final draft probe follows a clean close/reopen and a storage-failure close/reopen. Original fixtures and temp directories are left outside the checkout for inspection; the script never opens existing user data. Full 50-mission load, delayed selection response, and cross-destination badge reconciliation remain pending.

## Coverage matrix

O = observed; S = source-only; P = pending; N/A = not applicable. O can be a pass or defect; see verdicts below.

| Flow                       | Normal                 | Empty | Loading | Error/prerequisite | Recovery                | Keyboard/focus           | Narrow/scale     | Evidence                                         |
| -------------------------- | ---------------------- | ----- | ------- | ------------------ | ----------------------- | ------------------------ | ---------------- | ------------------------------------------------ |
| Six destination buttons    | O                      | O     | S       | O save failure     | O draft restart         | O selected tests         | O selected tests | N01, D04–06; App.tsx:93–105                      |
| New mission / Resume draft | O defect               | O     | S       | O draft cap        | O saved draft           | O selected tests         | O 20 drafts      | N01, D01–03, N02–03                              |
| Mission rows / selection   | O defect with composer | O     | S       | S                  | O crash suite           | O selected tests         | O mission suite  | N04; MissionRail.tsx:16–65                       |
| Draft group / disclosure   | O                      | O     | S       | O cap              | O readback              | S disclosure             | O defect         | N02–03; MissionRail.tsx:135–154                  |
| Context / attention toggle | O selected tests       | O     | S       | O decision fixture | O recovery fixture      | S full focus loop        | O medium fixture | ContextToggle.tsx; mission-focus-workspace tests |
| Notice / Dismiss           | O notice               | N/A   | N/A     | O save rejection   | S dismissal persistence | S                        | S                | D05; App.tsx:197–204                             |
| Unread / Attention badges  | S                      | O     | S       | S                  | S                       | S accessible description | S                | App.tsx:219–223; store.tsx:245–257               |

## Logic and functionality inventory

| Action                          | Preconditions / rule / target                           | Requested effect                          | Actual outcome and independent evidence                                           | Boundary / persistence                                                                           | Verdict                                              |
| ------------------------------- | ------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Select destination              | Supported destination; flush current composer first     | Open section, retain saved edits          | Successful switch saves exact text (D04)                                          | Failed flush still switches; restart restores only older text (D05–06)                           | Pass normal; fail on save error                      |
| New mission                     | Any destination; set pickingRepo                        | Open repo entry                           | Works only from Missions; other destinations remain visible (N01)                 | Replaces mounted composer before pending save (D03)                                              | Fail                                                 |
| Resume draft                    | Existing draft ID; flush then set composer ID           | Open that draft                           | Only Missions mounts it (N01); other destinations defer it                        | Saved draft readback survives restart (D02)                                                      | Fail navigation; pass saved storage                  |
| Select mission row              | Existing mission ID; flush then select mission          | Open selected mission                     | Row says Revised audit mission while content remains Define one finish line (N04) | No composer ID reset                                                                             | Fail                                                 |
| Arrow/Home/End selection        | Mission list owns keyboard; selected ID determines next | Move active option                        | Existing keyboard suite passes its sample                                         | No explicit scrollIntoView; async focus scheduled before flush finishes                          | Sample pass; large-list scroll and slow load pending |
| Narrow mission picker           | Select mission at width ≤700px                          | Same selection transition                 | Same handler as rows by source                                                    | Does not solve draft-list height                                                                 | Source; same transition concern                      |
| Expand/collapse Drafts          | Native details, open by default                         | Show/hide draft rows                      | 20 saved drafts displayed; group cap is real (N02)                                | At 680px rail exceeds first screen (N03)                                                         | Storage cap pass; layout fail                        |
| Draft capacity                  | Max 20 editing drafts                                   | Reject creation above cap                 | MISSION_DRAFT_LIMIT; no record silently hidden (N02)                              | UI says complete or delete; no normal discard button (N02-cap-ui)                                | Guard pass; recovery UX fail                         |
| Context toggle / Close / Escape | Medium-width context; local open state                  | Show context; close restores button focus | Selected tests show attention control at medium width                             | Detailed keyboard entry/focus containment still source-only                                      | Partial                                              |
| Sessions badge                  | Number of unread session flags, not running sessions    | Signal new output                         | Source counts unread; selection clears selected session flag                      | Full lifecycle/count runtime reconciliation deferred to A03                                      | Source-only                                          |
| Attention badge                 | Count unresolved recovery records                       | Signal recovery items                     | Source excludes generic mission decision count                                    | Verify agreement with queue in A07; do not call missing mission decisions a confirmed defect yet | Source-only                                          |
| Dismiss notice                  | Notice exists                                           | Clear transient notice                    | Handler clears notice only; does not restore lost edits                           | No rollback effect                                                                               | Source-confirmed                                     |

## Findings and proposals

All proposals remain unapproved and unimplemented. Shared findings reference the existing MIS IDs rather than duplicating ownership.

| Finding                     | Priority / category          | Trigger, impact, evidence                                                                                                                         | Proposed improvement                                                                                                                       | Requirement / scenario                   |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| NAV-001 → MIS-001           | High; logic/functionality    | New mission and Resume draft from any of the five non-Missions destinations do not open the requested screen; N01                                 | One destination-aware open action; highlight and mount the requested item together                                                         | FR-004, FR-016–017; US2.1                |
| NAV-002 → MIS-002           | High; data preservation      | Pending edit then New mission loses the edit after autosave window; save failure then Agents abandons latest text without a decision; D03, D05–06 | All exits use the same save-aware transition; failure keeps edits and offers Retry / Stay / explicitly leave unsaved                       | FR-005, FR-018; US2.2–3                  |
| NAV-003 → MIS-002           | High; selection logic        | Mission row becomes selected but composer stays visible; N04                                                                                      | Separate explicit mission/entry/draft view states; clear obsolete state only after successful transition                                   | FR-004; US2.2, 2.5                       |
| NAV-004                     | Medium; layout/functionality | At 680 × 860 with 20 drafts, rail height pushes main below first viewport; N03                                                                    | Compact the draft list at narrow width, preserve access to its expansion, and bound inventory scrolling so current content stays reachable | FR-008–009, FR-012; US4.3, US6.4; SC-006 |
| NAV-005 → MIS-007 / MIS-015 | Medium; identity/recovery    | Rows give only stage/time. At cap, complete/delete guidance lacks a normal delete action; N02                                                     | Named draft rows with selected state and a menu offering discard with confirmation; show capacity and direct management action at cap      | FR-008, FR-011; US4.1; US7.3             |

NAV-004 is a new confirmed condition. MIS-015 is the new draft-cap recovery finding detailed in A02. Styling, source-only badge questions, and untested scrolling hypotheses are not added as confirmed defects.

## Proposed interaction design

From any section, New mission and Resume draft open their intended item directly. Selecting a mission saves the outgoing draft, then displays that mission. A failed save keeps the current editor and its values available, with one explicit leave-without-saving alternative. The selected row and context always describe the displayed content.

Named draft rows show stage and save state. On narrow windows, their list is compact and expandable within a bounded area; section navigation and the workspace remain reachable. At capacity, the error offers Manage drafts. Actions that change only the view do not stop, restart, or grant authority to any session.

## Acceptance summary

- **Visual/interaction:** defects confirmed in item identity and narrow inventory layout. Existing sample focus/reflow tests pass; 50-mission and every-focus-target coverage pending.
- **Logic:** normal destination selection and badge rules traced; global item opening and failed-save transitions are incorrect.
- **Functionality:** save/readback/restart baseline works. Two edit-loss paths and composer/mission mismatch are independently observed.
- **Pending:** full badge count comparison, 50-mission scrolling, injected slow item loading, every context/disclosure keyboard path. Continue those scenarios before claiming complete A01 acceptance.
- **Owner handoff:** approve or amend the interaction design above before UI implementation. A01 audit pass is recorded with coverage gaps; it is not an all-green completion.
