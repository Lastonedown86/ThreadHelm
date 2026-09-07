# Feature 004 branch acceptance report

Date: 2026-09-07. Remote main baseline: `8b9d549` (PR #57). Final acceptance starts at `df04972`, with the bounded reflow repairs described below. Windows 11 Home build 26200, x64, AMD Ryzen 7 5700U, 16 logical CPUs, 31.39 GiB usable RAM. Electron 44.0.0; isolated test data and fixture Codex adapters. No real external provider was executed.

## Decision

The planned delivery sequence ends at slice 33. This report presents branch evidence and outstanding acceptance decisions; it does **not** declare the entire feature accepted or release-ready. PRs #58–65 form an ordered stack. Owner merges, latest hosted checks and the remaining coverage dispositions are separate gates.

## Primary journey evidence

`tests/e2e/audit-acceptance.spec.ts` traverses actual Tab order and uses keyboard activation, native select keys and typed input. It does not force focus, click or fill controls in these primary journeys. Focused essential controls must fit the viewport and have an unobscured center; one CSS pixel is allowed for fractional scroll rounding. Fixture preparation and native picker answers use test hooks; effect verification uses the real main-owned contract router and process inventory.

| Destination/journey                | Keyboard outcome at 100% and 200% root text, 960x800                                                     | Independent result                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Settings                           | Choose and approve a folder through the native approval dialog                                           | Exact selected path appears in main workspace inventory                                   |
| Agents and nested starter/template | Choose Quality specialist, traverse every wizard stage, review exact manifest and save                   | Exact profile display name exists; no session launches                                    |
| Memory                             | Publish with exact review, search, open the resulting detail                                             | Main scope/search identifies one entry; its stored body matches                           |
| Missions/New mission               | Enter Outcome, profiles/sessions, assignment/evidence, Access and final confirmation; open/close history | Exact objective and supervisor session binding in main mission detail                     |
| Sessions                           | Navigate the session list, enter the selected terminal, type and observe echo; use F6 to leave           | Echo comes from the fixture PTY; the two exact live session IDs remain                    |
| Attention                          | Crash/restart coordinator, navigate to recovery and dismiss one row                                      | Exactly the selected recovery ID disappears; its session is stopped; no automatic restart |

These are bounded primary workflows. They do not make every error, cancellation, provider or restart permutation pass. The original 476 state-cell dispositions remain intact in [the coverage ledger](coverage-ledger.json), with explicit final-journey associations added.

## Repairs found during acceptance

1. **MIS-012/014, owning PR #62:** native Tab scrolling placed Mission fields under the sticky footer. The composer now keeps keyboard-visible focused fields above the measured action bar. Natural-Tab and pointer-disclosure regressions plus all 11 focused composer cases passed. This fix was propagated through the dependent branches.
2. **FR-012, final Sessions reflow:** long paths at enlarged text allowed the grid's implicit minimum width to push controls outside the viewport. The workspace uses a shrinkable grid track, tabs wrap within their available width and terminal headings wrap long paths.
3. **FR-012, final Memory reflow:** the search input compressed into a narrow sliver beside its actions at enlarged text. The row now wraps and reserves a useful search width. Keyboard search and exact result/detail checks cover the repaired behavior.

The latter two are acceptance repairs within the existing reflow requirement; they introduce no new workflow or authority. No slice 34 has been added. Historical screenshots remain historical; final captures are linked below.

## FR-015 performance and visual scope

The [plan](plan.md) defines the budget before measurement: 50 cancelled missions, 20 long-name drafts, two idle fixture sessions; six destinations, three rounds each at both text scales. Measure activation through a visible primary heading and two animation frames. Warm-navigation p95 must be at most 1000 ms per scale. A settled Missions view must have zero DOM mutations and zero running animations in a five-second observation.

Raw measurements and hardware: [responsiveness JSON](audits/evidence/slice-33-responsiveness.json). Final measured values are recorded in verification. This is a bounded navigation/idle-DOM measurement, not a CPU, battery, cold-start, provider-throughput or universal hardware guarantee. Five seconds of idle DOM observation does not establish that every idle timer or render in the app is absent. Earlier performance deferrals remain separate.

Existing accessibility checks cover sampled text/border contrast, focus outlines, reduced motion, idle content and 200% reflow. These sampled checks do not constitute a complete WCAG certification. [Memory at 100%](audits/evidence/slice-33-memory-100.png) and [Memory at 200%](audits/evidence/slice-33-memory-200.png) provide final visual evidence; [Agents inner reflow](audits/evidence/slice-31-agents-reflow.png) retains its independently inspected geometry.

## Success-criterion reconciliation

| Criterion | Evidence and disposition                                                                                                                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-001    | A01–A09 inventories and evidence classes are recorded. Historical observations are not promoted to current passes.                                                                                                                     |
| SC-002    | Finding/requirement and slice mappings are retained in the register, plan and roadmap. Final acceptance of remaining limitations is pending; no blanket claim of owner approval is made.                                               |
| SC-003    | Mission navigation tests cover New/Resume across all six destinations, outgoing saves and explicit failure/conflict choices. Final keyboard Mission journey adds exact creation/readback. Broader state variants remain in the ledger. |
| SC-004    | Existing-session runtime/folder controls and prerequisite-return tests verify fixed recorded values and explicit repair. Unexecuted provider/permission combinations remain pending.                                                   |
| SC-005    | The named primary journeys above are exercised at both text sizes on Windows 11 x64. Native file picker selection and provider execution are fixtures; broader modal/fault permutations are not inferred.                              |
| SC-006    | Dense fixture has 50 missions/20 drafts, repeated prefixes and long text; navigation and exact inventory readback are verified. Existing draft-cap/recovery tests cover reaching the full inventory.                                   |
| SC-007    | Bounded fixes have targeted local evidence. Outstanding coverage, ACCEPT-001, unmerged PRs and owner acceptance prevent an unqualified feature-complete verdict.                                                                       |
| SC-008    | Slice records retain before/after, applicable negative/recovery and navigation evidence. Revalidation-only slices explicitly state when no product change was needed.                                                                  |
| SC-009    | All 120 action traces and 476 cells retain evidence or explicit pending/N/A dispositions. Source-only paths are not functionally passed. ACCEPT-001 adds a witnessed runtime limitation.                                               |
| SC-010    | Original per-section evidence and bounded later success/negative/reopen tests are reconciled. Untested combinations remain pending in the ledger rather than silently satisfying the full matrix.                                      |
| SC-011    | Saved-state, recovery, configuration and process claims cite main-owned readback or actual PTY/process results. Fixture capability is explicitly separated from live providers.                                                        |

## Open acceptance gates

- **Coverage:** 267 sampled cells retain pending remainders; 192 cells remain pending in full; 17 cells have justified N/A. These conservative dispositions are preserved from slice 32. See its eight section-specific gap lists. The owner has not accepted those exceptions.
- **ACCEPT-001 / A03-F05:** renderer-only reload while sessions are live loses their output subscription. Reproduced repeatedly: UI reports `SUBSCRIPTION_FAILED`, processes remain running, and main `sessions/stream.ts` rejects another subscription because its port was already transferred. Normal navigation without reload and coordinator restart/recovery are separate and pass their focused journeys. Reconnection needs an explicit transport/recovery design; no automatic session restart or replay was introduced. This limitation is not treated as passed or silently fixed by removing reload from the normal-flow test.
- **Harness:** locked/read-only database startup remains a skipped integration case because the harness cannot hold the lock across Electron startup. The parity screenshot test is opt-in and skipped in the standard suite.
- **Integration and authority:** ordered PR merges and fresh hosted CI are required. The owner decides feature acceptance and the scope of pending coverage/reconnection work. No release or provider-autonomy gate is closed by this audit.

Recommended review order is #58 → #59 → #60 → #61 → #62 → #63 → #64 → #65. Each PR targets its predecessor. After an owner merge, reconcile the next PR onto updated main before merging it, especially if squash merging changes ancestry.
