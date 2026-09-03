# Mission Focus parity: shell bugs and Mission Course

**Status:** Design approved in conversation on 2026-09-01; awaiting owner review of this written spec.

**Scope:** Phases 1 and 2 of the Journey UI parity sequence. Phase 3 (terminal dock), phase 4
(guided mission creation), phase 5 (secondary destinations), and phase 6 (legacy stylesheet
retirement) each get their own spec later.

**Reference material**

- Approved prototypes, recovered from Git ref `7ef0ad5^` under
  `apps/desktop/src/renderer/prototypes/`. Mission Focus direction D is the visual spec for the
  active state.
- `docs/architecture/mission-focus-workspace-design.md` for principles, primary states, responsive
  and keyboard rules.
- `docs/architecture/mission-focus-screen-gap-audit.md` for the open gap list.
- Parity audit with side-by-side screenshots (published artifact, 2026-09-01).

## Why

The journey doc records the Journey UI as "production journey implemented". The audit shows the
renderer at roughly half parity. The Mission Course, the screen a user sees most, is one card with
raw reason codes; waiting and uncertain missions both read as "Paused". Four layout bugs are
visible at ordinary window sizes. This spec closes the shared-shell bugs and brings Mission Focus
to the approved direction.

## Owner decisions recorded here

1. Un-prototyped Mission Course states (waiting for owner, uncertain, recovery required,
   completed) get a short disposable variant round before production. Two to three variants, one
   HTML file, URL-switchable, owner picks.
2. Collapsed-attention control and narrow layout are waived from the prototype gate. The prose in
   the workspace design doc is the approval.
3. Terminal dock switching behavior is decided now and implemented in phase 3: switching missions
   while a dock is open switches to the new mission's attached session; if the new mission has no
   attached session, the dock closes. No stale terminal with a mission label.

## Non-goals

- No new coordinator contracts. Every fact on screen comes from `MissionSummaryView`,
  `MissionDetailView`, store session state, and recovery records that already exist.
- No terminal dock in the mission shell (phase 3).
- No composer changes (phase 4).
- No changes to Sessions, Agents, Memory, Setup, or Recovery pages beyond the two bug fixes below.
- No removal of the legacy `styles.css` (phase 6). New rules go in `styles/*.css`.

## Phase 1: four visible bugs

Each is small, independent, and verifiable with one e2e assertion.

### 1.1 Memory library overflows horizontally

`styles/memory-library.css` sets the grid to `minmax(15rem, …) minmax(24rem, …) minmax(16rem, …)`
and breaks on viewport width. The workspace column is the viewport minus two rails (about 39rem),
so at 1400px the 55rem minimum overflows and the third column clips.

Fix: size on the container, not the viewport. Make `.mission-shell-workspace` a container
(`container-type: inline-size`) and rewrite the memory grid's breakpoints as `@container` rules.
Minimums drop to values that fit a 44rem workspace; below that the reading list moves under the
desk, then the librarian stacks. Acceptance: at 1400×860 and 1100×800 with a selected mission,
`document.documentElement.scrollWidth <= clientWidth` and the reading-list heading is fully
visible.

### 1.2 Setup attention summary has no padding

`SetupAttentionSummary` renders directly in the context aside; only `.mission-context-content`
carries padding. Fix: `App.tsx` wraps every non-mission context in a `MissionContextFrame` that
supplies the padding and heading, and the summary uses the same section styling as the mission
context sections. This also removes the literal `"{destination} workspace"` placeholder: until
phase 5 delivers per-destination content, the frame shows the destination name as a proper heading
and the setup summary beneath it on every destination, because setup readiness is relevant
everywhere.

### 1.3 Narrow width: rail takes half the viewport

At `max-width: 700px` the shell grid collapses to one column but keeps equal rows, so the rail
gets half the height. Fix: `grid-template-rows: auto minmax(0, 1fr)` at that breakpoint, the
mission list stays hidden behind the picker, and the destination nav becomes a horizontal
scrollable row. Acceptance: at 680×800 the mission heading is within the first viewport
(`getBoundingClientRect().top < 400`) and the page has one vertical scrollbar.

### 1.4 Medium width drops the context rail while a decision waits

At `max-width: 980px` the context aside is `display: none`. Fix is the collapsed-attention
control from the design doc, delivered in phase 2 section 2.5 because it depends on the new
context-rail model. Phase 1 ships only the acceptance test, marked expected-fail until 2.5 lands.

## Phase 2: Mission Course to approved direction

### 2.1 Presentation model

`mission-presentation.ts` stays the single place that turns `MissionDetailView` into screen
facts. It grows as follows. Nothing in the components computes state on its own.

```ts
export type CourseNodeState =
  | 'verified'   // completed with retained evidence
  | 'current'    // assigned or running
  | 'queued'     // ready, or blocked on dependencies
  | 'waiting'    // waiting or escalated: owner decision needed
  | 'uncertain'  // latest attempt state is unknown
  | 'held'       // completed without evidence, failed, or cancelled
export interface CourseNode {
  id: string;
  index: number;            // 1-based display order
  title: string;
  state: CourseNodeState;
  summary: string;          // one sentence, human language, never a raw code
  action: NodeAction | null;
}
export type NodeAction =
  | { kind: 'open_terminal'; sessionId: string; label: 'Open terminal' }
  | { kind: 'review'; label: 'Review choices…' }
  | { kind: 'inspect'; label: 'Inspect evidence…' };
export interface MissionPresentation {
  title: string;
  objective: string | null;
  lifecycleLabel: string;   // unchanged
  attention: MissionAttention;
  attentionLabel: string | null;   // 'Needs your decision' | 'Outcome uncertain' | 'Recovery required'
  attentionSummary: string | null; // one sentence naming the item, from the course node
  primaryAction: ActionSpec | null;   // { kind, label }
  secondaryAction: ActionSpec | null; // Pause when running
  strip: { execution: string; decisionsPending: number; sessionsAttached: number };
  course: CourseNode[];
  verifiedResult: { explanation: string; evidence: string[] } | null;
}
```

Rules:

- **Reason codes never reach the screen.** `ReasonCode` is a regex-validated string, not an
  enum, so the plan first enumerates every literal the main process emits on the mission path
  (grep `apps/desktop/src/main` and `packages` for `WORKER_*`, `MISSION_*`, `SUPERVISOR_*`,
  `STARTUP_*`, `PERMISSION_*`; 26 today) and records them in a `reasonLabel(code)` map with a
  human sentence each. Unknown codes fall back to sentence case with underscores replaced. A unit
  test asserts every literal found by that grep has a map entry, so a new code fails the test
  rather than leaking to the screen.
- **Waiting beats paused.** If any work item is `waiting` or `escalated`, or any decision is
  `held`, the lifecycle eyebrow reads "Waiting for you" and `primaryAction` is `review`, even
  when `detail.state` is `paused`. The pause/resume control moves to `secondaryAction`.
- **Uncertain beats waiting.** An attempt in state `unknown` sets attention `uncertain`, eyebrow
  "Outcome uncertain", primary `inspect`. No retry action exists anywhere.
- **Recovery** keeps "Recovery required", primary `inspect`, and the context rail links to the
  Attention destination filtered to this mission's records (query in store, no new contract).
- **Completed** shows eyebrow "Completed", primary `view_evidence`, no secondary, and the course
  renders every node verified or held.
- `strip.execution` is one of "Work continues locally", "Paused by you", "Waiting for your
  decision", "Held with uncertain outcome", "Recovery required", "Completed".
- `strip.sessionsAttached` counts distinct bound session ids in `envelope.bindings`.
- The course order stays creation order. `index` is display order. Nodes hold their index across
  state changes so the line does not renumber.
- The current node's action is `open_terminal` when `assignedSessionId` maps to a live session in
  the store, else null. Waiting nodes get `review`. Uncertain and held nodes get `inspect`.

### 2.2 Mission workspace layout (active state, from prototype D)

Top to bottom, inside `MissionWorkspace`:

1. Eyebrow: lifecycle label · "local". Heading (focus target, unchanged). Objective paragraph.
   Action row right-aligned: secondary (Pause) then primary. Labels come from the presentation.
2. Status strip: one row, hairline above and below, three facts from `strip`. State shape on the
   left reuses `.mission-state-shape`.
3. Mission Course header with "View full history" link on the right. The link opens the existing
   `MissionDetail` dialog, which already carries decision history, attempts, and leases.
4. The course line: an ordered list rendered as a horizontal sequence. Each node is a numbered
   circle on a connecting rule, then state label, title, summary, and the optional action. Circle
   fill: Verdigris for verified (check mark replaces the number), Copper for current, outlined
   Steel for queued, Copper outline with a pause glyph for waiting, Copper outline with "?" for
   uncertain, Ink outline with "–" for held. Every state also has a text label, so the shape and
   color are redundant with text as the design doc requires. At container widths under 44rem the
   list stacks vertically with the rule on the left.
5. Two-column summary: latest verified result (left, Steel left border, "Open evidence" opens the
   detail dialog) and active session summary (right, existing `MissionSessionSummary`). When there
   is no verified result yet, the left card is not rendered; the right card spans the row and a
   one-line muted note under the course says "No verified result yet."

The empty state ("Start a mission"), loading, and error states are unchanged.

### 2.3 Mission context rail

`MissionContext` becomes three ordered sections driven only by the presentation:

1. **Decision** (only when `attention !== 'none'`): eyebrow is `attentionLabel`, heading is
   `attentionSummary`, then one button with the same label and handler as the workspace's primary
   action. This is the "same action label in both places" rule.
2. **Crew**: one row per binding in `envelope.bindings`: role initial in a circle, profile role
   label, provider display name, and the session lifecycle word from the store ("working",
   "stopped", "failed", "recovery required", "not running"). Replaces the "2 bound profiles /
   1 active workers" counters.
3. **Authority**: unchanged two lines.

### 2.4 Mission rail additions

- Each mission row shows title, then a second line built from `MissionSummaryView`:
  `completedWorkItemCount/workItemCount` when `workItemCount > 0`, the lifecycle word, and the
  short id. No detail fetch needed for this.
- Destination nav gets counts: Sessions shows the number of sessions with unread output; Attention
  shows open recovery records. Counts are rendered as text in a badge, with `aria-label`
  "Sessions, 2 with new output".

### 2.5 Collapsed attention at medium width

Between 700px and 980px the context aside is hidden. Replace the hide with a toggle: the workspace
header action row gains an "Attention" button showing `attentionLabel` and a Copper dot when
`attention !== 'none'`, or plain "Context" otherwise. Pressing it opens the context rail as an
overlay panel on the right (`role="dialog"`, `aria-modal="false"`, Escape closes, focus returns
to the button). At full width the button is not rendered. This satisfies the design-doc rule that
collapsing must leave an explicit indicator when a decision is waiting.

### 2.6 Un-prototyped states: variant round

Before implementing the waiting, uncertain, recovery-required, and completed layouts, build one
disposable prototype at `apps/desktop/src/renderer/prototypes/mission-focus-states/`, following
the recovered prototype's file layout, seeded from the recovered `mission-focus` D variant. It
renders the section 2.2 layout for each of the four states and offers two or three structural
variants via `?variant=`:

- **A. Same layout, state-tinted**: the course line and strip carry the state; the header stays
  identical. Cheapest, least attention-grabbing.
- **B. Attention band**: a full-width Copper band under the header naming the decision or
  uncertainty with its action, pushing the course down. Loudest.
- **C. Decision node takes the header**: for waiting and uncertain, the affected node's title and
  action replace the objective paragraph in the header; the course line follows unchanged.

The prototype carries the visible "design prototype · read only" marker, keyboard-switchable
variants, and no production imports. The owner records the pick in
`docs/architecture/mission-focus-page-decisions.md`. The prototype is deleted before the
production PR merges. Section 2.1's presentation rules apply whichever variant wins; only the
component layout changes.

### 2.7 Keyboard and announcements

- Tab order: mission rail, workspace header actions, course nodes (each action focusable), summary
  cards, context rail (or its toggle), per the design doc.
- Mission switch keeps the existing heading focus. A `role="status"` live region in the workspace
  announces "Mission changed: {title}, {lifecycle}" and, on attention change within the same
  mission, "{attentionLabel}". Terminal output never enters this region.
- Reduced motion: the only transition is the course line's node fill on mission switch, disabled
  under `prefers-reduced-motion`.

## Testing

- **Unit** (`tests/unit/renderer/mission-presentation.test.ts`): node state mapping for every
  `SupervisorWorkState` × evidence × attempt-unknown combination; waiting-beats-paused;
  uncertain-beats-waiting; reason label coverage of the full enum; strip counts; action selection.
- **E2E** (`tests/e2e/mission-focus-workspace.spec.ts`, extended): the existing five-mission
  fixture asserts, per state, the eyebrow text, primary and secondary button labels, the context
  rail's first section, and the absence of any `[A-Z]+_[A-Z_]+` token in the workspace text.
  Add the three viewport assertions from phase 1 and the medium-width toggle flow (open, Escape,
  focus return).
- **Accessibility** (`tests/e2e/accessibility.spec.ts`): existing axe pass extended to the new
  overlay and the course list.
- **Installed app**: phase completes only after the Windows installed-artifact run of the e2e
  suite passes, per the workspace design doc's verification step.

## Sequence

1. Phase 1 bugs 1.1, 1.2, 1.3 and the expected-fail test for 1.4. One PR.
2. Presentation model (2.1) with unit tests, no UI change. One PR.
3. Variant round (2.6). Owner picks. Decision recorded.
4. Active-state layout (2.2), context rail (2.3), rail additions (2.4), collapsed attention (2.5),
   keyboard and announcements (2.7), then the picked state layouts. One PR, may be split at 2.5.
5. Installed-app verification and audit re-run against the same screenshot script.
