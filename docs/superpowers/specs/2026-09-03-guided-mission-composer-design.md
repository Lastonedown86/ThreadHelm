# Guided mission composer (phase 4a)

**Status:** Design approved in conversation on 2026-09-03; awaiting owner review of this written spec.

**Scope:** Phase 4a of the Journey UI parity sequence: the four-stage guided mission composer with
main-owned local drafts, mission-specific worker assignment and return evidence, and the approved
Review states. Phase 4b (Outcome Coach, Crew Workshop and Access Coach generation, which need a
structured CLI-drafting adapter capability) gets its own spec later.

**Reference material**

- Owner decisions in `docs/architecture/mission-focus-screen-gap-audit.md` and the prototype notes
  recovered from Git ref `7ef0ad5^` at `apps/desktop/src/renderer/prototypes/mission-create/NOTES.md`:
  D — Guided boundary with continuous coach, B — Brief + defaults crew assignment, B — Guided
  guardrails for Outcome, Access and Review, B — Local autosave, Approval expired as a fourth
  material Review state.
- Production contract: `specs/002-agent-mailbox-routing/contracts/mission-coaching.md`.
- Existing composer: `apps/desktop/src/renderer/features/coordination/MissionComposer.tsx` (modal,
  707 lines), which this phase deletes.
- Sibling draft store to copy: `agent_profile_drafts` in `packages/persistence/src/schema.ts` and
  `apps/desktop/src/main/coordination/profile-wizard.ts`.

## Why

The journey document describes mission creation as outcome, crew, access and limits, then exact
review. The shipped app opens a flat modal: objective, evidence, two dropdowns that are empty on a
fresh install, per-worker fieldsets and eight raw numeric limits in milliseconds and bytes. There is
no stage structure, no persistence, no explanation of defaults, and no prerequisite guidance. The
rail and context rail are hidden behind the dialog. Two buttons ("New mission…" in the rail and
"Create mission" in the empty state) open the same modal.

Phase 4a delivers the approved stage structure and draft persistence without model-generated
coaching. Every explanation in this phase is deterministic copy derived from the draft.

## Owner decisions recorded here

1. Phase 4 is split. 4a is this spec. 4b adds generation once a structured-drafting adapter
   capability exists. The provider capability registry (gap 6) is not in 4a.
2. The composer is a page in the main workspace region, not a modal. The mission rail and context
   rail stay visible.
3. Mission revision uses the same composer. The old modal is deleted, not kept for revision.
4. `assignment` and `requiredReturnEvidence` are mission authority: validated, pinned in the
   confirmed envelope, shown in preview, detail and the supervisor's mission inspection. Supervisor
   enforcement of return evidence at completion is deferred to its own spec.
5. Drafts are main-owned SQLite rows with expected-version writes, per the coaching contract.
   Renderer storage is not used.

## Non-goals

- No provider calls from the composer. No Outcome Coach, Crew Workshop or Access Coach generation.
- No provider capability registry. Model and effort inputs keep their current free-text and enum
  shapes under the runtime disclosure.
- No supervisor-side enforcement that worker results cite return evidence.
- No terminal dock (phase 3), no secondary destination redesign (phase 5), no legacy stylesheet
  retirement (phase 6). New rules go in `styles/mission-composer.css`.
- No change to `threadhelm/agent-profile@1`.
- No search or virtualization of drafts. At most 20 open drafts.

## 1. Placement, entry and navigation

### 1.1 One entry point

The rail button "New mission…" (`MissionRail.tsx`) is the only creation entry. The empty-state
"Create mission" button in `MissionWorkspace.tsx` is removed; the empty state keeps its heading and
one sentence pointing at the rail button. The legacy `MissionList.tsx` button is out of scope.

"New mission…" calls `missionComposer.createDraft` and opens the composer on that draft at the
Outcome stage. If `MISSION_DRAFT_LIMIT` is returned, the composer does not open; the rail shows an
inline error naming the limit and the drafts list.

### 1.2 Composer in the workspace region

`App.tsx` holds `composerDraftId: string | null`. While set, the main workspace region renders
`MissionComposerWorkspace` instead of `MissionWorkspace`; `selectedDestination` stays `missions`
and the nav highlights Missions. The context rail shows the composer context (section 5). Selecting
a mission in the rail while the composer is open first runs the close flow (section 4.3); the
selection completes only after the draft save is acknowledged or the owner keeps editing.

### 1.3 Resumable drafts

Open drafts (`editing` or `ready_for_review`) appear in two places, both from
`missionComposer.listDrafts` summaries (no authored text):

- The Missions empty state lists them under "Drafts" with "Resume draft · {stage label} · {relative
  time}".
- The rail shows a "Drafts ({n})" row beneath the mission list when `n > 0`, expanding to the same
  list.

Resume opens the composer at the draft's saved `currentStage`.

### 1.4 Revision

"Revise envelope…" on a paused mission (existing entry in `MissionDetail.tsx`, which currently mounts the modal) calls
`missionComposer.createDraft({ sourceMissionId })`. Main seeds `fieldValues` from the mission's
stored `MissionEnvelopeInput` and sets `currentStage: 'review'`. The Review stage of a draft with
`sourceMissionId` calls `missions.previewRevision` and `missions.confirmRevision` through the
composer wrappers. The composer heading reads "Revise mission" instead of "Create mission".

## 2. Stages

Four stages in fixed order. The stage strip at the top of the composer shows "Step {n} of 4 ·
{label}" with the four labels Outcome, Crew, Access & limits, Review; completed stages are
clickable, later stages are not. Each stage has one continue button named by its destination:
"Continue to crew", "Continue to access and limits", "Continue to review". Review has "Start
mission" (or "Apply revision"). A "Back" button precedes the continue button on stages 2 to 4.

Stage readiness is deterministic. A stage's continue button is disabled until its required fields
validate against the contract schema; the readiness line under the fields names what is missing
("Add one proof obligation" rather than a code). Leaving a stage saves the draft first (section 4).

### 2.1 Outcome

Heading: "Define one finish line."

Fields, in order:

- **Finish line** (textarea, required, at most 4000 characters): stored as `objective`.
- **Proof of completion** (textarea, required, at most 2000): stored as `completionEvidence`.
- **Outside this mission** (list editor, optional, 0 to 8 items, each at most 500): stored as
  `exclusions`. The list editor is one text input plus "Add" and per-item "Remove"; it is reused by
  the return-evidence field in Crew.

Readiness copy when ready: "Ready to choose the crew. The coordinator can recognize completion
without interpreting a task list."

### 2.2 Crew

Heading: "Choose who does the work."

**Supervisor** region:

- Supervisor profile: combobox of reviewed active profiles.
- Supervisor session: combobox of `missions.eligibleSessions`.

**Workers** region: "Add worker" appends a worker card. At least one worker is required. Each card
has:

- Profile (combobox, reviewed active profiles).
- Role (worker / reviewer / triage, default worker).
- Session (combobox, optional; eligible sessions for that profile's provider, or "Start a new
  session at launch").
- **What this worker contributes** (textarea, required, at most 2000): `assignment`.
- **What it must bring back** (list editor, required, 1 to 8 items, each at most 500):
  `requiredReturnEvidence`.
- **Customize runtime** (disclosure, collapsed by default): model, effort, permission selection,
  isolation, token cap, auto-start. The collapsed summary line states the effective defaults in words,
  for example "Provider default model · medium effort · manual permission · starts when you launch
  it". Field shapes are unchanged from the current composer.

**Prerequisite states** replace empty comboboxes. Each is an in-page notice with one action:

| Condition                      | Notice                                                                                          | Action                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| No reviewed active profile     | "No reviewed profile yet. A profile is needed before a supervisor or worker can be chosen."     | "Create agent" selects the Agents destination; the draft is saved first |
| No eligible supervisor session | "No live session can supervise yet. Launch a session with a verified launch snapshot first."    | "Launch a session" opens the existing launch dialog                     |
| Profiles loading / load failed | "Loading profiles…" / "Profiles could not be loaded."                                           | "Retry"                                                                 |
| Storage degraded               | Composer banner (section 4.4)                                                                   | none                                                                    |

Readiness copy when ready: "Crew is covered. Every worker has one contribution and at least one
piece of return evidence."

### 2.3 Access & limits

Heading: "Set where the mission may work and when it must stop."

**Workspace access**: one row per distinct worker. Approved workspace combobox (approved workspaces
only; revoked ones are listed as unavailable) and a read / write toggle. Beneath the toggle a
deterministic reason line: "Read: this worker inspects files and reports." or "Write: this worker
changes files inside this folder only." The supervisor binds to the same workspace as its session.

**Runtime readiness**: one line per provider in use, from the existing readiness state in the
store: available / missing / unsupported / unauthenticated / error with the existing explanation
text. Nothing here probes or installs a provider.

**Limits**: a "Customize limits" disclosure, collapsed by default, whose summary states the defaults
in words: "Stops after 30 minutes, 64 turns, 5 minutes without progress or 8 MiB of output; at most
4 workers, 64 work items, depth 8, 3 attempts, 250 000 tokens." Expanding reveals the existing
numeric inputs with their existing labels and units. Values outside product maxima fail validation
inline.

**What stays off** (static copy, always shown): break-glass bypass, parent or sibling folders,
automatic startup unless chosen per worker, consequential external actions without approval,
provider or model substitution.

Readiness copy when ready: "Workspace and runtimes are ready. Continue to review the exact
mission."

### 2.4 Review

Heading: "Review the exact mission before anything starts."

On entry the composer saves the draft, then calls `missionComposer.preview({ draftId, version })`.
The stage renders:

1. **Launch brief**: outcome (finish line, proof, exclusions); crew (per participant: role, profile
   name, one-line assignment, evidence count); access (workspace path and mode per worker); limits
   summary sentence; stop and approval behavior (escalation rules and permitted routine actions in
   words); the boundary warning from the preview.
2. **Exact mission authority**: the existing `MissionEnvelopeDisclosure`, moved to
   `features/mission-composer/MissionEnvelopeDisclosure.tsx`, extended to show `assignment`,
   `requiredReturnEvidence` and `exclusions`.
3. Confirmation checkbox "I reviewed this exact mission authority" and the "Start mission" button.

Four material states, one shown at a time above the brief:

| State            | Trigger                                                                        | Behavior                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Ready            | Preview succeeded, all bindings `ready`, token unexpired                       | Checkbox enabled; Start enabled once checked                                                                   |
| Setup incomplete | Any binding `held`                                                             | Start disabled; each held binding listed with its reason label and a "Go to {stage}" link; no substitution     |
| Mission changed  | Draft `version` differs from the previewed version (edit after preview)        | Token discarded; Start disabled; "Refresh review" re-runs preview                                              |
| Approval expired | `MISSION_CONFIRMATION_EXPIRED` from confirm, or local timer passes `expiresAt` | Token discarded; draft kept; workspace rows marked "approval stale"; "Return to access and limits" focuses 2.3 |

Confirm calls `missionComposer.confirm({ draftId, version, previewToken })`. On success the composer
closes, the new mission is selected and its detail opens (the current post-confirm behavior).

### 2.5 Keyboard, focus and announcements

- On stage entry the stage heading receives focus (`tabIndex={-1}`), matching the agent wizard.
- One restrained `aria-live="polite"` region announces stage changes ("Step 2 of 4, Crew") and
  save receipts ("Draft saved"). Terminal output never goes there.
- Validation errors render adjacent to their control; on a blocked continue, the first invalid
  control receives focus.
- Disclosures are `<details>` elements; no custom toggle scripting.
- The composer never overlays: the sticky stage strip and action row must not cover focused content
  (asserted in the accessibility test at 680 by 800).

## 3. Contract, persistence and main

### 3.1 Envelope schema additions (`packages/contracts/src/index.ts`)

- `MissionWorkerInput` gains `assignment: MissionText(2000)` and
  `requiredReturnEvidence: z.array(MissionText(500)).min(1).max(8)`.
- `MissionEnvelopeInput` gains `exclusions: z.array(MissionText(500)).max(8).default([])`.
- `MissionBindingView` gains `assignment: MissionText(2000).nullable().default(null)` and
  `requiredReturnEvidence: z.array(MissionText(500)).max(8).default([])`; `MissionEnvelopeView`
  gains `exclusions: z.array(MissionText(500)).max(8).default([])`. Supervisor bindings carry
  `null` and `[]`.
- Envelopes are stored as JSON in `supervisor_envelopes`, so no mission table migration is needed.
  Missions confirmed before this change parse through the View defaults.
- `resolveMissionEnvelope` in `mission-bindings.ts` copies the three fields from input to the
  binding view. The supervisor's `threadhelm_mission_inspect` response includes the envelope view,
  so the supervisor sees each worker's assignment and evidence without a new operation.
- `MissionDetail.tsx` shows exclusions under the objective and assignment plus evidence per
  worker binding.

### 3.2 Draft table (`packages/persistence/src/schema.ts`, next schema version)

```sql
CREATE TABLE mission_composer_drafts (
  id TEXT PRIMARY KEY,
  source_mission_id TEXT REFERENCES supervisor_missions (id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK (state IN ('editing', 'ready_for_review', 'converted', 'deleted')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  current_stage TEXT NOT NULL DEFAULT 'outcome'
    CHECK (current_stage IN ('outcome', 'crew', 'access', 'review')),
  field_values TEXT NOT NULL DEFAULT '{}' CHECK (length(CAST(field_values AS BLOB)) <= 65536),
  issue_codes TEXT NOT NULL DEFAULT '[]',
  converted_mission_id TEXT REFERENCES supervisor_missions (id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  converted_at TEXT,
  deleted_at TEXT
);
CREATE INDEX mission_composer_drafts_state ON mission_composer_drafts (state, updated_at, id);
```

`field_values` is a partial `MissionEnvelopeInput` (`MissionComposerFields`, every key optional,
same element schemas) so a half-filled draft round-trips without validation. `issue_codes` is the
list of stable failure codes from the last save or preview.

Repository `packages/persistence/src/repositories/mission-composer.ts` follows the draft methods in
`agent-templates.ts`: `createDraft`, `listDrafts` (summaries only), `getDraft`,
`updateDraft(expectedVersion)`, `markConverted` (inside the confirm transaction), `deleteDraft`.
Open-draft count is enforced in `createDraft`; the 21st open draft throws `MISSION_DRAFT_LIMIT`.

### 3.3 Operations (`packages/contracts/src/protocol.ts`, `apps/desktop/src/main/coordination/mission-composer.ts`)

| Operation                        | Request                                                   | Effect                                                                                                                                                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `missionComposer.createDraft`    | `{ sourceMissionId?: Uuid }`                              | New `editing` draft; seeded from the mission input when revising.                                                                                                                                                                                                           |
| `missionComposer.listDrafts`     | `{ limit?: 1..20 }`                                       | Summaries: id, version, state, stage, issue codes, timestamps, `sourceMissionId`. No authored text.                                                                                                                                                                         |
| `missionComposer.getDraft`       | `{ draftId }`                                             | Full `fieldValues`.                                                                                                                                                                                                                                                         |
| `missionComposer.updateDraft`    | `{ draftId, expectedVersion, fieldValues, currentStage }` | Expected-version write; returns `{ draftId, version, savedAt, currentStage }`. Stale version returns `MISSION_DRAFT_STALE`.                                                                                                                                                 |
| `missionComposer.preview`        | `{ draftId, version }`                                    | Parses `fieldValues` as `MissionEnvelopeInput` (validation failure returns `INVALID_REQUEST` with field paths), then delegates to `missions.preview` or `missions.previewRevision`. Sets state `ready_for_review`. Response is the existing `MissionPreviewView` plus `draftVersion`. |
| `missionComposer.confirm`        | `{ draftId, version, previewToken }`                      | Delegates to `missions.confirm` or `missions.confirmRevision` and, in the same transaction, marks the draft `converted` with the mission id. Version mismatch returns `MISSION_DRAFT_STALE`.                                                                                  |
| `missionComposer.previewDiscard` | `{ draftId, version }`                                    | Returns a discard token (two-minute expiry) and the stage label.                                                                                                                                                                                                            |
| `missionComposer.confirmDiscard` | `{ draftId, version, discardToken }`                      | Marks `deleted`. Stale version returns `MISSION_DRAFT_DISCARD_STALE`.                                                                                                                                                                                                       |

Event `missionComposer.changed` carries `{ draftId, version, state, currentStage }` only.

Failure codes added to the shared enum: `MISSION_DRAFT_NOT_FOUND`, `MISSION_DRAFT_STALE`,
`MISSION_DRAFT_LIMIT`, `MISSION_DRAFT_SAVE_FAILED`, `MISSION_DRAFT_DISCARD_STALE`,
`MISSION_CONFIRMATION_EXPIRED` (mapped from the existing preview-token expiry path in
`missions.confirm`). Reason labels for these join `reason-labels.ts` so no code reaches the screen.

The preview and confirm wrappers reuse the existing mission service; `missions.preview` and
`missions.confirm` remain callable for tests and are not removed.

## 4. Autosave and exit

### 4.1 When main saves

The renderer calls `updateDraft`:

- 800 ms after the last edit (debounced per draft);
- before a stage change (continue, back or strip click), awaited;
- before Close, awaited;
- before leaving to a prerequisite action (Create agent, Launch a session), awaited.

Each save sends the last acknowledged `version` as `expectedVersion` and stores the returned version.

### 4.2 Stale draft

`MISSION_DRAFT_STALE` (another window saved first) keeps the renderer's field values and shows a
"Saved elsewhere" notice with "Use saved version" and "Keep my edits" (which saves again with the
new expected version). Nothing merges silently.

### 4.3 Close

"Close" in the action row awaits a save. On acknowledgement, a receipt replaces the stage: "Your
mission draft is saved locally." with resume stage, saved time and "Still off: access, permissions,
launch"; buttons "Keep editing" and "Close composer". Close returns to the mission workspace; the
draft appears under Drafts.

### 4.4 Save failure and storage degraded

`MISSION_DRAFT_SAVE_FAILED` or `state.storageDegraded` shows a persistent banner at the top of the
composer: "Your draft could not be saved. Nothing has been discarded." with "Retry", "Keep editing"
and "Discard draft…". The composer stays open with inputs intact. "Discard draft…" runs
`previewDiscard`, then a confirmation dialog naming the stage and draft age, then `confirmDiscard`.
While storage is degraded, Continue, Start and Close are disabled; Keep editing and Discard remain.

## 5. Context rail while composing

The context rail shows "Mission draft" with three cards: **Stage** (current stage and what remains),
**Crew** (participant count and roles, or "No crew chosen"), **Still off** (the static withheld list
from 2.3). The setup attention summary keeps its current behavior.

## 6. Files

New:

- `apps/desktop/src/renderer/features/mission-composer/MissionComposerWorkspace.tsx` (stage strip,
  action row, banner, live region, draft loading)
- `…/OutcomeStage.tsx`, `CrewStage.tsx`, `AccessStage.tsx`, `ReviewStage.tsx`
- `…/ListEditor.tsx` (exclusions and return evidence)
- `…/DraftExitReceipt.tsx`, `…/DraftBanner.tsx`
- `…/MissionEnvelopeDisclosure.tsx` (moved from the modal, extended)
- `…/composer-fields.ts` (`MissionComposerFields` schema, defaults, readiness functions per stage)
- `apps/desktop/src/renderer/styles/mission-composer.css` (replaces the 112-byte stub)
- `apps/desktop/src/main/coordination/mission-composer.ts`
- `packages/persistence/src/repositories/mission-composer.ts`

Modified:

- `packages/contracts/src/index.ts`, `packages/contracts/src/protocol.ts`
- `packages/persistence/src/schema.ts` (new version), `repositories/index.ts`
- `apps/desktop/src/main/coordination/mission-bindings.ts`, `service.ts` (wire operations),
  `context.ts`
- `apps/desktop/src/main/ipc/*` allow-list for the new operations
- `apps/desktop/src/renderer/App.tsx`, `store.tsx` (`composerDraftId`, drafts summaries)
- `apps/desktop/src/renderer/features/mission-focus/MissionRail.tsx`, `MissionWorkspace.tsx`
- `apps/desktop/src/renderer/features/coordination/MissionDetail.tsx`
- `apps/desktop/src/renderer/features/mission-focus/reason-labels.ts`

Deleted:

- `apps/desktop/src/renderer/features/coordination/MissionComposer.tsx`

## 7. Testing

Contract (`tests/contract/mission-composer.test.ts`):

- create, list, get, update with expected version; stale write rejected without overwrite;
  21st open draft rejected; summaries contain no authored text.
- preview of an incomplete draft fails with field paths; preview of a complete draft returns the
  envelope with assignment, evidence and exclusions; confirm converts the draft and the mission in
  one transaction; a second confirm with the same token fails; confirm with a moved version fails.
- discard requires a matching version and token.
- revision draft seeds from the mission input and confirms through the revision path.
- pre-change envelope JSON without the new keys still parses.

Acceptance (`tests/acceptance/mission-envelope-authority.test.ts`): the supervisor inspection
response includes each worker's assignment and return evidence exactly as confirmed.

E2E (`tests/e2e/mission-composer.spec.ts`, replacing the creation parts of
`supervisor-mission.spec.ts`):

- Create a mission through all four stages by keyboard; each continue button is named by its
  destination; each stage heading receives focus; the live region announces the step.
- Prerequisite states: fresh install shows "No reviewed profile yet" with "Create agent"; after a
  profile exists but no session, "Launch a session".
- Close at Crew, relaunch the app, resume from the Drafts list at Crew with values intact.
- Edit after preview shows Mission changed and disables Start until refreshed.
- Approval expired: advance the main clock past `expiresAt` through the test hooks, confirm fails,
  the draft survives, the workspace row shows the stale marker and focus lands on Access & limits.
- Storage degraded: banner shown, inputs intact, Continue disabled, Discard flow completes.
- Revision path applies through the same composer.
- The rail "New mission…" is the only creation button; the empty state has none.

Accessibility (`tests/e2e/accessibility.spec.ts`): composer at 1400 by 900 and 680 by 800 has no
horizontal overflow, the sticky action row never covers the focused control, and axe reports no
violations on each stage.

Parity screenshots (`tests/e2e/parity-screenshots.spec.ts`, opt-in): one capture per stage and per
Review state.

The phase completes only after the Windows x64 installed-artifact run of the e2e suite passes.

## 8. Sequence

1. Contract and persistence: schema fields, draft table, repository, operations, main service,
   contract tests. One PR. The old modal keeps working during this PR because it does not send the
   new worker fields yet; the modal gains the two fields as plain inputs so `MissionWorkerInput`
   can require them from the start.
2. Composer stages and workspace placement, drafts list, revision path, modal deletion, e2e
   rewrite, accessibility, parity screenshots, installed run. One PR.
3. Docs: update `docs/architecture/journey-ui-from-prototyping.md` status to name shipped phases
   and remaining phases 3, 4b, 5 and 6.
