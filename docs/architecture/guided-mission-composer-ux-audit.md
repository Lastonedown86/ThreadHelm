# Guided mission composer: friendliness audit

**Date:** 2026-09-03

This audit walks the eight friendliness gates (`docs/superpowers/plans/2026-09-03-guided-mission-composer.md`,
"Friendliness gates" section) across all four composer stages — Outcome, Crew,
Access & limits, Review — and cites the concrete evidence (file:line, test
name, or screenshot) that each gate holds. Screenshots were captured with
`PARITY_SHOTS=1 pnpm exec playwright test tests/e2e/parity-screenshots.spec.ts`
and are written to `artifacts/parity/`:

- `10-composer-outcome.png`
- `11-composer-crew.png`
- `12-composer-access.png`
- `13-composer-review-ready.png`

Gates, verbatim from the plan:

1. The stage asks one question at a time; the heading is a plain sentence, not a noun label.
2. Every control has a visible label in ordinary words; units and defaults are stated in words next to the control, not only as raw numbers.
3. The continue button names where it goes, and when disabled the readiness line says exactly what is missing.
4. An empty prerequisite never shows an empty dropdown; it shows a sentence and one button that goes to the fix.
5. Advanced fields sit under a collapsed `<details>` whose summary states the current defaults in words.
6. Nothing is lost on Close, Back, navigation, or app restart (autosave), and the receipt says so.
7. Errors sit next to the control; the first invalid control gets focus on a blocked continue.
8. No reason code, UUID, or JSON on screen outside the exact-authority disclosure.

## The three modal problems the owner named

| Problem                        | Fixed by                                                                 | Evidence                                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redundant "Create mission" and dialog-based entry | Single "New mission…" entry point opening the composer in the workspace, no dialog | `tests/e2e/mission-composer.spec.ts:12` — `expect(page.getByRole('button', { name: 'Create mission', exact: true })).toHaveCount(0)`; `:15` — `expect(page.getByRole('dialog')).toHaveCount(0)` |
| Raw numeric limits shown unconditionally | Bounds and runtime collapse under `<details>` with a words summary; raw number inputs only appear once expanded | `apps/desktop/src/renderer/features/mission-composer/AccessStage.tsx:144-161`; `composer-fields.ts:165-173` (`limitsSummary`); `tests/e2e/mission-composer.spec.ts:200-202` — summary reads "Stops after 30 minutes, 64 turns…" with `Elapsed limit (ms)` hidden until expanded |
| Empty dropdowns when no profile/session/folder exists | Every stage checks its own prerequisite before rendering a `<select>` and substitutes a sentence (with a fix button, except one parked case — see Gaps) | `apps/desktop/src/renderer/features/mission-composer/CrewStage.tsx:33-64`; `AccessStage.tsx:64-74` (`workers.map` returns `null` per row when `approved.length === 0`, so no empty `<select>` ever renders); `tests/e2e/mission-composer.spec.ts:65` — `expect(page.getByRole('combobox')).toHaveCount(0)` |

## Gate-by-gate evidence

### Outcome

| Gate | Evidence (screenshot, test, file:line)                                                                                                                                                                                                                 | Result |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1 — sentence heading, one topic | `composer-fields.ts:20` `STAGE_HEADING.outcome = 'Define one finish line.'`; `10-composer-outcome.png`; `mission-composer.spec.ts:16-18` heading visible and focused | pass |
| 2 — visible labels, words not raw numbers | `OutcomeStage.tsx:19-22,35-38,50-56` — "Finish line", "Proof of completion", "Outside this mission", each with a plain-language hint; `mission-composer.spec.ts:24-32` | pass |
| 3 — continue named, missing named | `composer-fields.ts:26` `CONTINUE_LABEL.outcome = 'Continue to crew'`; `:110-113` readiness text "Add a finish line so the coordinator knows what done means." / "Say what proof shows the mission is complete."; `mission-composer.spec.ts:21-27` disabled continue + exact text visible | pass |
| 4 — empty prerequisite → sentence + fix button | N/A: Outcome has no external prerequisite (no profile, session, or folder needed to fill it in) — `stageReadiness('outcome', …)` in `composer-fields.ts:109-116` never checks `context` | pass (trivial) |
| 5 — advanced fields collapsed, defaults in words | N/A: Outcome has no advanced/runtime fields to hide — `OutcomeStage.tsx` has no `<details>` | pass (trivial) |
| 6 — nothing lost, receipt says so | `mission-composer.spec.ts:36-45` — "Draft saved" status, Close shows "Your mission draft is saved locally." / "Still off: access, permissions, launch", reopening via "Resume draft · Outcome" restores the typed finish line; `MissionComposerWorkspace.tsx:149-180` (receipt), `useDraft.ts:50-79` (autosave) | pass |
| 7 — errors next to control, focus on blocked continue | `composer-fields.ts:110-113` names `firstInvalid: 'objective'` / `'completionEvidence'`, unit-tested at `tests/unit/renderer/composer-fields.test.ts:20-30`; `OutcomeStage.tsx:29` wires `aria-invalid={invalid === 'objective'}`. **Partial — see Gap 1**: the Continue button that would trigger the focus-jump is HTML-`disabled` whenever the stage is blocked (`MissionComposerWorkspace.tsx:313`), so the jump is unreachable through any real click; verified by a forced-click reproduction (see Gap 1) | partial |
| 8 — no reason code/UUID/JSON outside disclosure | `OutcomeStage.tsx` renders no codes, IDs, or JSON; `tests/e2e/mission-focus-workspace.spec.ts` — "composer never surfaces a raw reason code at any of its four stages" (Outcome checkpoint) | pass |

### Crew

| Gate | Evidence (screenshot, test, file:line)                                                                                                                                                                                                                 | Result |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1 — sentence heading, one topic | `composer-fields.ts:21` `STAGE_HEADING.crew = 'Choose who does the work.'`; `11-composer-crew.png`; `mission-composer.spec.ts:57,71-73` heading focused | pass |
| 2 — visible labels, words not raw numbers | `CrewStage.tsx:90-142` "Supervisor profile", "Supervisor session"; `:153-257` "Worker N profile", "Worker N role", "Worker N session", "What worker N contributes", "What worker N must bring back"; runtime summary in words (`runtimeSummary`, see gate 5); `mission-composer.spec.ts:94-137` | pass |
| 3 — continue named, missing named | `composer-fields.ts:27` `CONTINUE_LABEL.crew = 'Continue to access and limits'`; `:118-140` readiness text for every missing piece ("No reviewed profile yet…", "Choose a supervisor profile.", "Add at least one worker.", "Say what worker 1 contributes.", "Add one thing worker 1 must bring back."); `mission-composer.spec.ts:69,101-116` | pass |
| 4 — empty prerequisite → sentence + fix button | `CrewStage.tsx:43-53` "No reviewed profile yet…" + **"Create agent"** button; `:54-64` "No live session can supervise yet…" + **"Launch a session"** button; `mission-composer.spec.ts:68-73` notice and button visible, routes to "Choose or create the right worker" | pass |
| 5 — advanced fields collapsed, defaults in words | `CrewStage.tsx:258-334` `<details><summary>Customize runtime · {runtimeSummary(worker)}</summary>`; `composer-fields.ts:174-186` `runtimeSummary` renders "Provider default model · provider default effort · manual permission · starts only when you launch it"; `mission-composer.spec.ts:130-135` summary text visible, `Worker 1 model` field hidden until expanded | pass |
| 6 — nothing lost, receipt says so | `mission-composer.spec.ts:74-76` — leaving to Missions and returning via "Resume draft · Crew" restores the same prerequisite notice/state; same autosave path as Outcome | pass |
| 7 — errors next to control, focus on blocked continue | `composer-fields.ts:127-139` names `firstInvalid: 'workers.0.profileId' / '.assignment' / '.requiredReturnEvidence'`, unit-tested at `tests/unit/renderer/composer-fields.test.ts:40-58`; `CrewStage.tsx` wires `aria-invalid` on each (`:94,119,157,243`) and `data-field` on the evidence `ListEditor` (`:254`); `mission-composer.spec.ts:118-122` confirms that target is a real, focusable control. **Same Gap 1 caveat**: the focus-jump itself is unreachable because Continue is disabled while blocked | partial |
| 8 — no reason code/UUID/JSON outside disclosure | `CrewStage.tsx` renders only profile display names and lowercase provider ids; `mission-focus-workspace.spec.ts` composer no-code test (Crew checkpoint, after "Add to what worker 1 must bring back") | pass |

### Access & limits

| Gate | Evidence (screenshot, test, file:line)                                                                                                                                                                                                                 | Result |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1 — sentence heading, one topic | `composer-fields.ts:22` `STAGE_HEADING.access = 'Set where the mission may work and when it must stop.'`; `12-composer-access.png`; `mission-composer.spec.ts:141-142,208-210` heading focused | pass |
| 2 — visible labels, words not raw numbers | `AccessStage.tsx:77-92` "Worker N folder" select with "Choose an approved folder" placeholder option; `:93-117` fieldset legend "Worker N access" with "Read"/"Write" radios plus a plain-language reason (`accessReason`, `composer-fields.ts:188-192`); `mission-composer.spec.ts:189-201` | pass |
| 3 — continue named, missing named | `composer-fields.ts:28` `CONTINUE_LABEL.access = 'Continue to review'`; `:146-155` readiness text "Choose an approved folder for worker 1." / "Choose read or write for every folder."; `mission-composer.spec.ts:187-189,206-207` | pass |
| 4 — empty prerequisite → sentence + fix button | **FAIL (parked, known gap).** `AccessStage.tsx:64-69` — when no folder is approved yet, the stage shows the sentence "No approved folder yet. Go to Settings and approve a folder, then come back to choose it here." but renders **no button** to go there, unlike Crew's "Create agent"/"Launch a session" buttons for the same kind of gap. No empty `<select>` renders either way (`:70-74` returns `null` per worker row), so the "empty dropdown" symptom is still avoided, but the gate's "one button that goes to the fix" half is not met. Not covered by any e2e test (fixtures always approve a workspace first) | fail |
| 5 — advanced fields collapsed, defaults in words | `AccessStage.tsx:144-161` `<details><summary>Customize limits · {limitsSummary(bounds)}</summary>`; `mission-composer.spec.ts:200-202` summary reads "Stops after 30 minutes, 64 turns…", `Elapsed limit (ms)` field hidden until expanded | pass |
| 6 — nothing lost, receipt says so | `mission-composer.spec.ts:261-292` ("editing after preview…") — an expired review returns to Access with the same worker/folder state intact and an "approval stale" notice, nothing re-entered; same autosave path | pass |
| 7 — errors next to control, focus on blocked continue | `composer-fields.ts:146-155` names `firstInvalid: 'workers.0.workspaceId'` / `'workspaces'`, unit-tested at `tests/unit/renderer/composer-fields.test.ts:70-82`; `AccessStage.tsx:80-81,101` wire `aria-invalid`/`data-field`. **Same Gap 1 caveat** | partial |
| 8 — no reason code/UUID/JSON outside disclosure | `AccessStage.tsx` renders only display paths, "Available"/provider labels, and words-only readiness copy; `mission-focus-workspace.spec.ts` composer no-code test (Access checkpoint) | pass |

### Review

| Gate | Evidence (screenshot, test, file:line)                                                                                                                                                                                                                 | Result |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1 — sentence heading, one topic | `composer-fields.ts:23` `STAGE_HEADING.review = 'Review the exact mission before anything starts.'`; `13-composer-review-ready.png`; `mission-composer.spec.ts:208-210,224-225` heading focused | pass |
| 2 — visible labels, words not raw numbers | `ReviewStage.tsx:182-220` launch brief in prose (Outcome/Crew/Access/Limits sections as `<h3>` + sentences), `limitsSummary` for bounds; checkbox labeled "I reviewed this exact mission authority"; `mission-composer.spec.ts:239-247` | pass |
| 3 — continue named, missing named | Review has no further "continue"; the terminal action is named for what it does ("Start mission" / "Apply revision" on revision, `ReviewStage.tsx:241`) and disabled with a visible reason (unconfirmed checkbox, or not-yet-ready preview); `stageReadiness('review', …)` always reports ready with "Review the exact mission, then start it." (`composer-fields.ts:158-159`); `mission-composer.spec.ts:244-247` | pass |
| 4 — empty prerequisite → sentence + fix button | `ReviewStage.tsx:132-146` — "Setup incomplete." plus, per held binding, a **"Go to crew"/"Go to access and limits"** button naming the exact stage to fix. This is a *better* instance of gate 4 than Access's. Not exercised by an e2e test in this suite (no fixture drives a held preview to Review) — a coverage gap, not a violation | pass (untested path) |
| 5 — advanced fields collapsed, defaults in words | N/A by design: the "Exact mission authority" `<details open>` (`ReviewStage.tsx:221-224`) is the sanctioned disclosure and is intentionally left open, not collapsed defaults-in-words — see gate 8 | pass (trivial) |
| 6 — nothing lost, receipt says so | `mission-composer.spec.ts:294-319` ("revision reuses the composer…") — pausing and revising carries the mission's fields into the composer without loss, applies through the revision path | pass |
| 7 — errors next to control, focus on blocked continue | N/A: Review has a single checkbox gate, not a set of field-level validation errors; the disabled "Start mission" button is self-explanatory (unchecked box is visibly next to it) | pass (trivial) |
| 8 — no reason code/UUID/JSON outside disclosure | `MissionEnvelopeDisclosure.tsx` (`ReviewStage.tsx:222-223`) is the sanctioned exception: it alone renders `reasonCode`, `profileId`/`profileRevisionId`/`bindingId` (UUIDs), and raw JSON (`MissionEnvelopeDisclosure.tsx:36,39,67-81`). Outside it, the launch brief (`ReviewStage.tsx:182-220`) shows only profile display names and prose; `mission-focus-workspace.spec.ts` composer no-code test (Review checkpoint, `.composer-state.ready`) confirms no reason-code-shaped token leaks past the disclosure | pass |

## Gaps and follow-ups

1. **Gate 7's focus-jump is unreachable through the Continue button, on every stage that has one (Outcome, Crew, Access).** `MissionComposerWorkspace.tsx`'s `advance()` (`:109-113`) only calls `focusInvalid()` when `!readiness.ready`, but the same Continue button is `disabled={!readiness.ready || blocked || draft.saving}` (`:313`) — a native `disabled` button never dispatches a click event, so `advance()`'s blocked branch cannot run through mouse or keyboard use. I confirmed this with a forced-click reproduction (`page.getByRole('button', {...}).click({ force: true })` on the disabled Continue button): `aria-invalid` never appears and focus never moves. In practice this is not a user-facing dead end — the readiness paragraph beneath the stage (gate 3) already names exactly what's missing in words, and the disabled button prevents any invalid submission — but the specific "first invalid control gets focus" behavior described by gate 7 does not fire for the primary continue flow, contrary to the "verified working" note from earlier task reviews (which checked only that `firstInvalid` paths resolve to real, focusable elements, not that the jump itself is reachable). Recommend either wiring a reachable trigger (e.g., an `onKeyDown`/`aria-disabled` pattern that still fires the handler) or accepting the readiness line as the sole gate-7 vehicle and removing the now-dead `focusInvalid` call from `advance()`.
2. **Gate 4 gap in `AccessStage.tsx` (parked, pre-existing).** When no folder is approved yet (`approved.length === 0`, `AccessStage.tsx:64-69`), the stage shows a sentence but no button to Settings, unlike Crew's equivalent prerequisite notices. No empty dropdown renders either way, so the owner-named "empty dropdowns" problem does not recur, but gate 4's "one button that goes to the fix" is not met for this specific edge case. Not covered by any e2e test since every fixture in this suite approves a workspace before reaching Access.
3. **Supervisor's own workspace access mode is hardcoded to `write` with no UI to change it** (`AccessStage.tsx:41`, `CrewStage.tsx:130`) — a real but non-security-relevant capability gap (parked from Task 10), unrelated to any of the eight gates but worth carrying forward if a future task adds supervisor-mode selection.
4. **Review's "Setup incomplete" (held binding) path has no e2e coverage** in this suite — `ReviewStage.tsx:132-146` is exercised only by contract tests that exit through main's preview response shape, not by a UI-level Playwright test that drives a held preview into Review. Recommend a follow-up e2e test if that path needs stronger UI-level assurance.

## Verification

- `pnpm desktop:build && pnpm exec playwright test tests/e2e/accessibility.spec.ts tests/e2e/mission-focus-workspace.spec.ts` — PASS (12 tests, 0 failed).
- `pnpm exec playwright test` (full suite) — PASS (63), FAIL (0), skipped (1 — `parity-screenshots.spec.ts`, opt-in via `PARITY_SHOTS=1`).
- `PARITY_SHOTS=1 pnpm exec playwright test tests/e2e/parity-screenshots.spec.ts` — PASS (1), screenshots written to `artifacts/parity/10-composer-outcome.png` through `13-composer-review-ready.png`.
