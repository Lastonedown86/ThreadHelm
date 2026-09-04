# Repo-idea generation (phase 4b, part 1)

**Status:** Draft — not yet implemented.

**Builds on:** the guided mission composer (phase 4a, shipped in PR #22) and the Outcome Coach
contract (`specs/002-agent-mailbox-routing/contracts/mission-coaching.md`). This spec adds a new
operation and a new composer step; it does not modify the Outcome/Crew/Access Coach contract or
weaken any of its guarantees.

**Scope:** when a user starts a new mission, let them pick an approved repo and see a short list of
AI-suggested mission ideas for that repo, before landing on the existing Outcome stage. Picking an
idea pre-fills Outcome's fields; nothing is confirmed or applied without landing on an editable
screen, matching every other coach interaction already spec'd.

**Deferred (not in this spec):** the Outcome/Crew/Access Coach operations themselves (still
unimplemented per phase 4b), a shared provider/model setting across coach operations, browsing to an
unapproved folder from this new step, and full file-content analysis (see "Repo visibility" below —
explicitly ruled out for this iteration).

---

## 1. Problem

Starting a mission today means opening the composer to a blank Outcome stage — a beginner with an
approved repo but no clear idea what to ask for has to write the finish line and proof from scratch.
There is no path from "I have this repo open" to "here's a reasonable thing to do with it."

## 2. Flow

The composer gains a new first step. The stage strip becomes:

```
0. Pick a repo   1. Outcome   2. Crew   3. Access & limits   4. Review
```

(Step 0 is unnumbered in the UI — the existing stage strip continues to show "Step 1 of 4 · Outcome"
etc. once the user reaches Outcome, so nothing about the shipped 4-step model or its tests changes;
this is a screen *before* step 1, not a renumbering of it.)

**Entry:** clicking "New mission…" opens this screen instead of jumping straight to Outcome.

**Repo picker:** a dropdown of already-approved workspaces, identical in spirit to Access stage's
folder dropdown (real names via `state.workspaces`, never a raw path fragment or UUID). If no
workspace is approved yet, this screen reuses the existing empty-prerequisite pattern (a sentence +
"Go to Settings" button) — the same construct Crew stage already has for "no reviewed profile yet."

**Provider/model picker:** a dropdown next to the repo picker, defaulting to "Provider default
model · provider default effort" (identical wording/pattern to Crew stage's `runtimeSummary`) so a
beginner never has to touch it. Scoped only to this one operation — not shared with any other coach
call, present or future.

**Skip:** a "Skip — I'll write my own" link/button, always visible, going straight to today's blank
Outcome stage. This is not gated behind picking a repo first — a user can skip before choosing
anything.

**Generate:** picking a repo (and, optionally, a provider/model) enables a "Generate ideas" button.
On click, sends the request described in §3 and shows a loading state, then exactly 3 idea cards
(title + one-sentence rationale each) plus a "Try different ideas" button that re-runs the same
request. No limit on how many times a user can regenerate; each is a fresh, independent bounded call
(no session/conversation state carried between attempts).

**Picking an idea:** copies the idea's proposed finish line and proof text into the composer draft's
`objective`/`completionEvidence` fields (the same fields Outcome's own inputs write to) and advances
to the Outcome stage with those fields pre-filled and fully editable — no different from a user
having typed them. The repo picked here is *not* automatically bound to any worker's workspace; that
remains Access stage's job, unchanged.

**Failure:** provider unavailable, repo has no readable metadata, or the model's output fails
validation — shows "Couldn't generate ideas right now" next to the Generate button and leaves the
Skip link available. Never a dead end; the user can always proceed to a blank Outcome stage.

## 3. What the model sees (repo visibility)

This is the one place this spec deliberately diverges from the existing Outcome Coach's "no
repository content" rule — for a documented, narrow reason: an idea generator that can't see
anything about the repo can't say anything specific to it.

The new operation sends **metadata only**:

- the file tree (paths only, no contents), capped at a bounded depth/count (mirrors the byte/item
  limits already used elsewhere in the coach contracts);
- `README`/`README.md` contents, if present, up to a bounded byte limit;
- the package manifest (`package.json`, `Cargo.toml`, `pyproject.toml`, etc. — whichever is present
  at the repo root), if present;
- the subject lines (not bodies, not diffs) of the most recent N commits (bounded, e.g. 20).

It explicitly does **not** send: file contents beyond the README, diffs, credentials, tool access,
an active terminal, or memory — matching the existing coach contract's withholding list for
everything except the four items above. No provider/model runs any tool or executes anything in the
repo; this is a single structured-drafting call over the assembled metadata, exactly like the
existing Outcome Coach's call shape.

If the repo's metadata assembly fails (permissions error, empty repo, no manifest/README/commits
found), that is treated the same as any other coach failure (§2, Failure) — never a crash, never a
silent empty result presented as success.

## 4. New operation

`missionComposer.proposeRepoIdeas`

- **Request:** `{ workspaceId: Uuid, providerId?: string, model?: string, effort?: string }` — the
  approved workspace to read metadata from, and an optional provider/model override (omitted =
  provider default, matching the picker's default state).
- **Response:** `{ ideas: RepoIdeaCandidate[] }` where `RepoIdeaCandidate` is
  `{ title: string, rationale: string, proposedObjective: string, proposedCompletionEvidence: string }`
  — exactly 3 items on success.
- Untrusted output is validated the same way the Outcome Coach's is: strict keys, authored-text
  safety, byte limits, exactly-3-item shape. Invalid or unavailable generation returns a typed held
  result (`REPO_IDEAS_UNAVAILABLE` / `REPO_IDEAS_OUTPUT_INVALID` — new codes, same shape as the
  existing `MISSION_COACH_*` family), never a retry or silent substitution.
- This operation does not touch the composer draft. It is a pure read-and-propose call; nothing is
  persisted until the user picks a card, at which point the existing `missionComposer.updateDraft`
  path is used to write the chosen `objective`/`completionEvidence` — no new persistence mechanism.
- No new draft state, no new SQLite column. The picked repo/idea leaves no trace in the draft beyond
  the two text fields it pre-filled — same "list/event views carry no authored text" constraint
  applies, since these are ordinary `objective`/`completionEvidence` values once picked.

## 5. Security and authority boundaries

- The workspace must already be approved; this operation cannot approve one, and the repo picker
  only lists approved workspaces (§2).
- No file contents (beyond README), no credentials, no tool execution, no active session — matches
  the existing Outcome Coach's isolation model for everything this spec doesn't explicitly add.
- Picking an idea never binds a workspace to a worker, never selects a permission, never grants
  access — it only ever writes to the two Outcome-stage text fields a user could type themselves.
  Access stage's existing prerequisite/approval flow is completely unchanged and still runs later.
- The provider/model picker is a request parameter, not a stored setting — no new Settings surface,
  no new persisted preference. (If this needs to become a remembered default later, that is a
  separate, smaller follow-up — not part of this spec.)

## 6. Friendliness gates (unchanged framework, mapped to the new step)

1. One question — "Pick a repo to get mission ideas, or write your own." One sentence heading.
2. Visible labels — "Repo," "Provider and model," ordinary words, default stated in words.
3. Named action — "Generate ideas" names what it does; disabled state (no repo picked) says why.
4. Empty prerequisite — no approved workspace → sentence + "Go to Settings" button (reuses Crew
   stage's exact pattern — includes the fix button that Access stage's equivalent case is still
   missing, per the phase 4a audit's parked Gap 2; this new step should not repeat that gap).
5. No advanced/collapsed fields needed here — provider/model picker is already minimal and
   defaulted; nothing to hide behind a `<details>`.
6. Nothing lost — skipping or failing always leaves a path forward; picking an idea only ever
   pre-fills fields the user can still edit and the existing autosave already covers.
7. N/A — no field-level validation errors on this screen (a picker and a button, not a form).
8. No raw IDs/JSON — idea cards show only title/rationale prose; workspace names are real names via
   `state.workspaces`, never raw paths or UUIDs (the phase 4a screenshot review found one dropdown
   showing a raw temp-folder path — this step should not repeat that either).

## 7. Open questions for implementation planning

- Exact bounds for file-tree depth/count and README/commit-subject byte limits — pick values
  consistent with the existing coach contract's item/byte bounds rather than inventing new scales.
- Whether `proposeRepoIdeas` needs its own token-store/expiry pattern (like preview tokens) or is
  simple enough to be a stateless request/response with no follow-up token — current design assumes
  the latter, since nothing is committed until `updateDraft`.
- Where the provider/model list shown in the picker comes from (reuse whatever enumeration Settings
  or Access stage's runtime-readiness section already uses).
