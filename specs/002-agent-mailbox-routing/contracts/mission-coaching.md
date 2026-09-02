# Contract: Mission Composer Coaching and Local Drafts

The Mission Coach turns ordinary-language intent into reviewable mission inputs. It is a drafting
surface, not a supervisor, worker, permission source, or launch authority. Electron main owns every
draft transition, structured-generation request, validation result, SQLite write, preview token, and
mission conversion. The renderer never writes drafts or invokes provider CLIs directly.

## Separation of objects

ThreadHelm keeps four objects separate:

1. **Agent profile revision** describes a reusable worker. It contains no mission assignment,
   permission, workspace, effort, role, or automatic-start authority.
2. **Mission composer draft** stores editable local wizard state and coach proposals. It is not
   selectable by a running mission and grants no authority.
3. **Confirmed mission envelope** contains the exact applied outcome, assignments, return evidence,
   profiles, workspaces, runtimes, permissions, limits, and stop behavior reviewed by the owner.
4. **Runtime mission state** records main-owned decisions, leases, attempts, results, and recovery.

Applying a coach proposal copies validated fields into the composer draft. It does not create,
confirm, start, revise, resume, or authorize a mission.

## Mission composer draft

A draft is local, versioned, owner-visible state with:

- `draftId`, monotonic `version`, `state`, `currentStage`, and timestamps;
- editable outcome statement, proof obligations, and exclusions;
- selected supervisor and proposed/applied crew-plan revision;
- proposed/applied access-plan revision and operating limits;
- bounded coach receipts and unresolved issue codes;
- the last successfully saved stage used as the resume point; and
- `convertedMissionId` only after an atomic confirmed-mission conversion.

States are `editing`, `ready_for_review`, `converted`, and `deleted`. At most 20 open drafts may
exist. A converted draft retains the applied values and content-free generation receipts needed to
explain the launch brief; unapplied alternatives and superseded provider output are removed in the
conversion transaction. Deletion is explicit and remains blocked while conversion state is unknown.

Every mutation supplies the expected version. Stale edits fail without merging or overwriting newer
state. List and event views omit authored text; details require an explicit draft read.

## Outcome Coach draft

One explicit owner action may send only the bounded rough request to a supported structured-drafting
operation. Main creates an app-owned temporary directory, supplies no mission workspace, repository
content, tools, credentials, memory, active-session transcript, or existing terminal, and requests a
strict object containing:

- one proposed outcome statement;
- one to eight proof obligations;
- zero to eight exclusions;
- zero to eight explicit assumptions;
- zero to eight follow-up candidates; and
- zero to eight material questions whose answers would change the outcome, proof, or boundary.

The result is untrusted. Main enforces strict keys, authored-text safety, byte limits, question and
item bounds, and a single-outcome shape. Invalid or unavailable generation produces a typed held
result. There is no provider/model substitution, automatic repair run, retry, or application.

Applying the proposal requires its exact draft/version and copies only the owner-reviewed outcome,
proof, and exclusion fields into the mission composer draft. Follow-up candidates remain inert text;
they never create tasks, missions, provider calls, or notifications.

## Crew plan draft

Crew planning consumes the exact applied outcome version. It matches reviewed active profile
revisions deterministically before an explicit bounded generation operation may propose missing
generic profile drafts. A plan contains at most three worker proposals. Each proposal includes:

- source kind: exact saved profile revision or unsaved new-profile draft;
- proposed mission role;
- bounded reason the worker is needed;
- one mission-specific `assignment`;
- one to eight `requiredReturnEvidence` items;
- requested provider/model/effort inputs, kept separate from resolution;
- proof-obligation IDs owned by the proposal; and
- selection state.

The plan also contains proof coverage, duplicate-role issue codes, ordered handoff stages, and owner
checkpoint count. Model confidence is never authority and is not exposed as a policy result.

Applying a crew plan pins saved profiles exactly. A new profile draft must complete the existing
reviewed profile lifecycle before it can be pinned. Application cannot save a profile implicitly,
grant workspace access, select effective permission, authorize automatic startup, or launch a
session. A changed outcome version makes the crew plan stale.

## Access plan draft

Access planning consumes the exact applied crew-plan version and current workspace/runtime
readiness. It may recommend only:

- an already approved exact workspace;
- `read` or `write` mode with a bounded assignment-derived reason;
- current provider/model/effort requirements without fallback;
- manual or already-supported bounded permission choices;
- operating limits at or below product maxima; and
- authority classes that remain withheld.

It cannot approve a workspace, install or authenticate a provider, widen a folder boundary, select
break-glass bypass, enable automatic startup, or authorize consequential external action. Applying
the plan updates only the composer draft. Changed crew, workspace identity, approval, or capability
evidence makes it stale.

## Mission assignment authority

Each confirmed mission worker binding adds:

- `assignment`: one bounded concrete contribution for this mission; and
- `requiredReturnEvidence`: one to eight bounded evidence descriptions.

These fields are mission authority and are pinned with the exact profile revision, workspace,
runtime request, permission selection, and execution bounds. They do not mutate the reusable profile.
Main copies them into the initial work item or addressed assignment only after mission confirmation.
The supervisor may decompose within this assignment but cannot erase its evidence obligations or
expand it. Completion requires deliberate references satisfying the mission-level proof obligations
and the worker binding's return evidence.

## Local autosave and exit

Local autosave is the approved default. Main saves after a meaningful edit boundary, before stage
navigation, and before Close. A successful save returns the exact draft ID, version, saved timestamp,
and resume stage. The UI may close only after receiving that acknowledgement.

Saving a draft does not confirm a workspace, profile, runtime, permission, mission, or launch.
Autosave failure keeps the composer open, preserves renderer input, emits a typed local error, and
offers Retry, Keep editing, or explicit discard. It never retries, discards, or closes silently.
Discard requires its own preview/confirmation token bound to draft ID and version.

Startup may list resumable draft summaries, but it starts no provider and resumes no mission.

## Preview, expiration, and confirmation

Mission preview remains a separate main operation over the exact applied composer version. Its
one-use confirmation token expires after two minutes and binds current workspace approval, pinned
profile revisions, sessions, runtime capability evidence, permissions, assignments, return evidence,
and bounds.

Expired approval preserves the draft and preview details but clears launch authority. Main never
refreshes an approval silently. The owner returns to the affected stage, obtains current approval,
previews the resulting exact envelope, and confirms again.

## Desktop operations and events

The production contract will expose versioned operations equivalent to:

| Operation | Effect |
|---|---|
| `missionComposer.createDraft` | Create blank local draft; no provider call. |
| `missionComposer.getDraft` / `listDrafts` | Explicit detail or content-free bounded summaries. |
| `missionComposer.updateDraft` | Expected-version local edit and stage save. |
| `missionComposer.proposeOutcome` / `applyOutcome` | Explicit structured draft, then separate apply. |
| `missionComposer.proposeCrew` / `applyCrew` | Exact outcome-version plan, then separate apply. |
| `missionComposer.proposeAccess` / `applyAccess` | Exact crew-version recommendation, then separate apply. |
| `missionComposer.preview` | Exact mission envelope disclosure and expiring token. |
| `missionComposer.confirm` | Consume current token and atomically convert/start under mission policy. |
| `missionComposer.previewDiscard` / `confirmDiscard` | Explicit destructive local-draft deletion. |

Draft events contain IDs, versions, state, stage, issue codes, and timestamps only. Rough requests,
outcomes, assignments, evidence, exclusions, model output, file paths, and provider errors require an
explicit detail view and never enter general logs or notifications.

## Stable failures

- `MISSION_DRAFT_NOT_FOUND`
- `MISSION_DRAFT_STALE`
- `MISSION_DRAFT_LIMIT`
- `MISSION_DRAFT_SAVE_FAILED`
- `MISSION_DRAFT_DISCARD_STALE`
- `MISSION_COACH_UNAVAILABLE`
- `MISSION_COACH_OUTPUT_INVALID`
- `MISSION_COACH_INPUT_TOO_BROAD`
- `MISSION_COACH_ANSWER_REQUIRED`
- `MISSION_COACH_PROPOSAL_STALE`
- `MISSION_CREW_PROFILE_REVIEW_REQUIRED`
- `MISSION_CREW_COVERAGE_INCOMPLETE`
- `MISSION_ACCESS_APPROVAL_REQUIRED`
- `MISSION_ACCESS_CAPABILITY_STALE`
- `MISSION_CONFIRMATION_EXPIRED`
