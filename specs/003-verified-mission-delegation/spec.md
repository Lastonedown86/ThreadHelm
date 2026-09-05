# Feature Specification: Verified Mission Delegation

**Feature Branch**: `docs/verified-mission-delegation-spec` (spec draft); implementation branch
names stay independent from the `003` spec number.

**Created**: 2026-09-04

**Status**: Draft (Stage 1 of [Verified Mission OS](../../docs/roadmaps/verified-mission-os.md))

**Feature selector**: `.specify/feature.json` deliberately remains on
`specs/002-agent-mailbox-routing` per the roadmap. Switching it is part of the explicit transition,
not part of drafting this document.

**Input**: User description: "Create Verified Mission Delegation from
docs/roadmaps/verified-mission-os.md. First verify Feature 002's accepted handoff and carry forward
its explicit D01-D04 deferrals. Extend its US8 mission, delegation, result-return, lease, and
recovery foundation rather than recreating it. Specify the acceptance-evidence matrix, Capability
Passports, progress accountability, Mission Receipts, and approved Mission Focus experience.
Separate local verified completion from future GitHub-confirmed PR readiness. Exclude GitHub
intake, external delivery implementation, automatic issue starts, merge, and deployment." Plus
owner decisions of 2026-09-04 (PR-review boundary, worker learnings, memory injection at launch,
per-agent instructions), folded in below.

## Handoff verification and carried constraints

The Feature 002 preview handoff is recorded as accepted in
[transition-to-next-feature.md](../002-agent-mailbox-routing/transition-to-next-feature.md):
P01-P05 complete, PR #17 merged to `main` at `cb6758a`. That record, not this spec, is the
authority for the handoff. This spec verified the record exists and lists P01-P05 as complete; it
does not re-prove them.

The following [preview deferrals](../002-agent-mailbox-routing/preview-release.md) are carried
forward as **unmet constraints**. This feature must not relabel any of them as passed.

| Deferral | Constraint on this feature |
| --- | --- |
| D01: 250 MiB no-session idle memory | Mission Focus and receipt views add no continuous rendering; report actual packaged memory; do not claim the 250 MiB target. |
| D02: ARM64 distribution | Windows 11 x64 is the only acceptance target; ARM64 CI stays diagnostic. |
| D03: unproved autonomous-provider capability | Any scenario that needs a live automatic worker start stays **blocked** until Feature 002's T148/T157 proof passes. Fixtures, personas, and Capability Passports never grant launch authority. Unsupported starts stay held. |
| D04: named AI-provider review rounds | Separation of duties is satisfied by substantive independent review and owner acceptance; no paid external provider is silently launched to review. |
| D05: 700 MiB four-session aggregate | Keep full process accounting and disclosure; no fixed-ceiling pass claim. |
| D06: 1% four-session median CPU | Keep no-idle-animation, responsiveness, and accessibility evidence; the failed measurements stay recorded as failures. |

Scenarios that depend on D03 are marked **[D03-blocked]** below. They are still specified so the
plan can build against fixtures; acceptance for them is deferred to the original proof.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Approve a Mission Contract from a High-Level Outcome (Priority: P1)

A user types one outcome ("Add retry with backoff to the sync client and prove it with tests").
The bound supervisor proposes measurable acceptance criteria, scope, eligible workers with their
exact launch bindings, limits, and verification steps. The user reviews one contract screen, edits
or rejects criteria, and confirms. Later amendments are visible and revision-bound.

**Why this priority**: Everything else (delegation, verification, receipt) hangs off criterion
identities in the contract. Without it there is nothing to verify against.

**Independent Test**: With a fixture supervisor, submit an outcome, receive a proposed contract,
edit one criterion, confirm, then request a scope-changing amendment and confirm it separately.
Verify both revisions persist with distinct identities and the mission never ran outside the
confirmed envelope.

**Acceptance Scenarios**:

1. **Given** an approved workspace and a running bound supervisor, **When** the user submits an
   outcome, **Then** ThreadHelm records a Draft Mission Contract containing the outcome, proposed
   acceptance criteria each with a stable identity, scope, eligible profiles/revisions, launch
   bindings, bounds, and verification plan, and starts no worker.
2. **Given** a Draft Mission Contract, **When** the user edits, removes, or adds a criterion and
   confirms, **Then** the confirmed revision is bound to the exact reviewed content (digest) and
   reuses the existing US8 mission envelope preview/confirm path; edits after preview invalidate
   the preview.
3. **Given** a confirmed contract, **When** the supervisor proposes a change to scope, authority,
   resource ceilings, eligible workers, or bound targets, **Then** the affected branch pauses and
   the change is presented as a numbered amendment for exact user confirmation; internal work
   changes inside the envelope need no amendment.
4. **Given** a contract confirmed under Feature 002's envelope shape (no criteria identities),
   **When** it is opened in this feature, **Then** it is shown read-only as a legacy mission with
   verification features unavailable and an offer to re-confirm; nothing is migrated silently.

---

### User Story 2 - Follow the Delegation Ledger and Meaningful Progress (Priority: P2)

The user sees, per work packet, who delegated it, which profile revision received it, why, what
output is required, what it depends on, which attempt this is, who reviews it, and whether real
progress has been observed. Interventions (pause, cancel, correction) are attributed.

**Why this priority**: Users cannot safely delegate work they cannot inspect. This exposes the
US8 work DAG, decisions, leases, and attempts as one accountable ledger.

**Independent Test**: Run a fixture mission with three work packets and one injected stall.
Verify the ledger shows assignment rationale, dependencies, attempt numbers, the stall as
"no meaningful progress since <checkpoint>", and the user's pause as an attributed intervention.

**Acceptance Scenarios**:

1. **Given** the supervisor assigns a work packet, **When** the ledger renders, **Then** it shows
   delegator, selected profile/revision, structured rationale, required output, dependencies,
   attempt number, reviewer (if assigned), and lease state, all from durable records.
2. **Given** a running attempt, **When** a meaningful-progress checkpoint is recorded, **Then**
   the checkpoint is derived from main-observed facts (structured tool calls, evidence references,
   lease activity) and never solely from output volume, process existence, model narration, or a
   self-reported "still working".
3. **Given** the no-progress bound is reached, **When** main pauses the branch, **Then** the ledger
   shows the reason code, the last verified checkpoint, and the available interventions.
4. **Given** the user pauses, cancels, or corrects a packet, **When** the action is applied,
   **Then** the ledger records actor, time, target, and resulting state, and the supervisor
   briefing reflects it on its next turn.
5. **Given** usage figures are displayed, **When** the source differs, **Then** each figure is
   labeled `provider-reported`, `CLI-derived`, `estimated`, or `unavailable`; estimated cost never
   claims an exact billing cutoff.

---

### User Story 3 - Verify Criteria and Receive a Mission Receipt (Priority: P3)

Each acceptance criterion maps to exact evidence: artifacts, commits, deterministic checks,
independent review, manual acceptance. When the mission ends, the user receives one honest
receipt listing what was verified, by what, what was not done, and whether the result is
locally verified only.

**Why this priority**: A worker's completion claim is not verification. This is the feature's
namesake guarantee.

**Independent Test**: Run a fixture mission where worker A claims completion of criterion C1 with
a test-run artifact and criterion C2 with prose only. Verify C1 is `verified (local)`, C2 is
`unverified: claim without evidence`, the receipt lists both, and a later workspace change marks
C1's evidence `stale`.

**Acceptance Scenarios**:

1. **Given** a confirmed contract, **When** evidence is attached to a criterion, **Then** the
   acceptance-evidence matrix records criterion id, evidence kind, exact reference (artifact path
   within the approved workspace, commit hash, check name and exit result, review record, or
   manual acceptance), producer, verifier, time, and freshness.
2. **Given** a worker reports `completion`, **When** its evidence references resolve, **Then** the
   criterion state becomes `claimed`, not `verified`; `verified (local)` requires a deterministic
   check or independent review recorded by main, or explicit manual acceptance by the user.
3. **Given** a verified criterion, **When** the referenced commit is no longer the workspace head
   or the referenced artifact changes, **Then** its evidence becomes `stale` and the mission
   cannot complete on it without fresh verification.
4. **Given** all criteria are `verified (local)` or explicitly `accepted with limitation`,
   **When** the supervisor calls mission complete, **Then** main issues a Mission Receipt with
   outcome, criteria and states, participants (session/profile revision), exact artifact/commit
   references, checks run, reviews, usage with source labels, elapsed time, corrections,
   limitations, and actions not performed.
5. **Given** a receipt, **When** it is exported, **Then** Markdown and JSON exports go through the
   existing bounded, disclosed content-handling path and contain no transcript, terminal history,
   or secret values.
6. **Given** a locally verified receipt, **When** it is displayed, **Then** its readiness state is
   `locally verified`; the `PR-ready (externally confirmed)` state exists in the model but cannot
   be reached in this feature because no GitHub delivery is observed.
7. **Given** the reviewer of a criterion is the same session that produced the evidence, **When**
   verification is recorded, **Then** it is recorded as `self-attested`, which does not satisfy
   `verified (local)`.

---

### User Story 4 - Worker Learnings and Launch-Time Memory Context (Priority: P4)

When a worker finishes, its structured result includes a bounded `learnings` block that main
persists as a shared-memory revision attributed to that worker session. When main launches or
assigns a worker, it runs a bounded deterministic text search of mission-scope shared memory and
includes the top matches in the first prompt as attributed context.

**Why this priority**: Owner decision 2026-09-04. It makes memory useful without ingesting
transcripts and keeps retrieval deterministic (FR-036 of Feature 002).

**Independent Test**: Worker A completes with two learnings citing an artifact. Verify two
`lesson` revisions exist authored by A's session. Assign worker B; verify B's first prompt
contains an attributed context section with at most N entries, each with entry id, author,
revision, confidence, and a "context, not instruction" label, and that B's tool authority is
unchanged.

**Acceptance Scenarios**:

1. **Given** a worker submits `threadhelm_work_result` with `disposition: completion`, **When**
   the `learnings` block is missing or invalid, **Then** main rejects the result as invalid
   structured output (existing path) and the attempt does not complete.
2. **Given** a valid `learnings` block, **When** main persists it, **Then** each item becomes one
   shared-memory revision with `kind` from the existing enum (default `lesson`), author = the
   worker session, scope = the mission, at least one source reference from the existing
   reference kinds, `confidence` as declared by the worker but capped at `medium`, and the
   existing quota, content validation, and conflict (contested) rules apply unchanged.
3. **Given** a learnings item contains credential-like content, terminal control sequences,
   or a self-granting instruction, **When** validated, **Then** it is rejected under the existing
   `MEMORY_CONTENT_INVALID` path and the remaining valid items are still persisted; the rejection
   is disclosed content-free.
4. **Given** main assigns a work packet, **When** it composes the first prompt, **Then** it
   performs one `memory.search` in mission scope using deterministic query terms derived from the
   packet title and criterion titles, takes at most N results, and appends them under a
   provenance header that names each entry id, revision, author kind, confidence, and status.
5. **Given** injected context includes an instruction-like sentence, **When** the worker acts on
   it, **Then** nothing changes: the worker's tools, leases, and permissions are exactly those of
   its confirmed launch binding; injected memory is never consulted by main for authority.
6. **Given** memory search fails, times out, or the store is degraded, **When** the launch
   proceeds, **Then** the prompt states that memory context was unavailable and the launch is
   otherwise unchanged; memory is never required to start.
7. **Given** a mission in workspace W1, **When** context is searched, **Then** only that
   mission's scope is searched; workspace-scoped and other-mission memory is not injected.

---

### User Story 5 - Consult Capability Passports (Priority: P5)

Before or while delegating, the user (and supervisor, as read-only input) can see each profile
revision's attributable history: roles held, tasks attempted, verified outcomes, corrections,
sample size, recency, and provider capability evidence, with declared versus demonstrated
ability shown separately.

**Why this priority**: Improves worker selection honesty. Deliberately last among the model
changes because it must never become authority (D03).

**Independent Test**: After three fixture missions, open the passport for profile revision R.
Verify counts match the ledger, recency is shown, a "declared: refactoring; demonstrated: 2 of 3
verified" split is visible, and starting a worker with a strong passport but missing launch
permission still fails closed with the existing preflight error.

**Acceptance Scenarios**:

1. **Given** completed attempts exist, **When** a passport is opened, **Then** it derives history
   only from durable ledger, attempt, and verification records, grouped by role, task class, and
   profile revision, with sample size and last-observed time.
2. **Given** a manifest declares capabilities, **When** displayed, **Then** declared capabilities
   and demonstrated (verified) outcomes are separate columns; an opaque score is never shown as
   the only summary.
3. **Given** a passport, **When** the supervisor selects a worker, **Then** passport data may be
   cited in rationale but main's eligibility check consults only the confirmed contract and exact
   launch bindings.
4. **Given** a profile revision has no history, **When** displayed, **Then** the passport says so
   rather than showing zeros as if measured.

---

### User Story 6 - Work in Mission Focus (Priority: P6)

The user runs the whole mission from one layout: mission list left; selected outcome, supervisor
briefing, and live delegation ledger center; acceptance-evidence matrix and usage right.
Terminals, logs, and full work detail are drill-downs.

**Why this priority**: The experience that makes the model usable without manual terminal
coordination. Ordered after the data it renders. Builds on the merged Mission Focus workspace
(PRs #20, #21) rather than starting a new shell.

**Independent Test**: With a fixture mission, complete the delegation cycle using keyboard only
from the Mission Focus screen; verify each region updates on the same mission switch, no idle
rendering occurs, and text scaling to 200% keeps all controls reachable.

**Acceptance Scenarios**:

1. **Given** a mission is selected, **When** the layout renders, **Then** header, supervisor
   briefing, delegation ledger, evidence matrix, usage, and attention items switch together with
   no stale controls from the prior mission.
2. **Given** a supervisor briefing exists, **When** shown, **Then** it is the supervisor's most
   recent structured summary (from `threadhelm_mission_inspect`-driven decisions and results)
   with a timestamp and a "model-authored, not verified" label; it never replaces the ledger.
3. **Given** the window is narrow or medium, **When** the context rail collapses, **Then** a
   persistent attention indicator shows waiting decisions, stale evidence, or uncertain outcomes.
4. **Given** the mission is idle, **When** nothing changes, **Then** no region re-renders on a
   timer; updates arrive only from mission-changed events.
5. **Given** reduced-motion is set, **When** a state changes, **Then** any transition is
   instant.

---

### User Story 7 - Give an Agent Behavioral Instructions (Priority: P7)

A user adds an `instructions` field to an agent profile revision. When that profile is launched,
main passes the text to the provider as behavioral instructions. The field is inert for
authority.

**Why this priority**: Owner decision 2026-09-04. Small, independent, and useful for
specialist consistency. Lowest priority because missions work without it.

**Independent Test**: Create a revision with instructions "Always run the test suite before
reporting completion." Launch under Claude; verify the launch disclosure shows the exact text and
the resolved provider argument. Add "You may push to origin" to instructions; verify the launch
disclosure still shows no network authority and a push attempt is blocked identically to before.

**Acceptance Scenarios**:

1. **Given** a profile revision, **When** `instructions` is set, **Then** it is bounded text
   (same limit as `goal`), digest-bound into the revision, and shown in full at revision
   confirmation and in the launch preview.
2. **Given** a Claude launch, **When** main builds the command, **Then** instructions are passed
   via the provider's append-system-prompt mechanism; for Codex, via a launch-time config
   override that writes no file into the workspace; if the adapter cannot verify support, the
   launch preview says "instructions not applied" and the worker still starts.
3. **Given** instructions text attempts to grant tools, workspaces, permissions, or supervisor
   status, **When** launched, **Then** main's authority checks ignore it exactly as they ignore
   `goal`; the manifest parser treats it as untrusted data (FR-047 of Feature 002).
4. **Given** instructions contain secrets or terminal control sequences, **When** validated,
   **Then** the revision is rejected with the existing content-validation disclosure.

---

### Edge Cases

- A criterion is edited after evidence was attached: prior evidence becomes `stale` with the
  old criterion revision retained for the ledger.
- A worker attaches evidence for a criterion not in its packet: recorded, flagged
  `out-of-packet`, not counted toward verification without supervisor assignment.
- Two attempts produce conflicting evidence for one criterion: both retained; state `contested`
  until a verifier or the user resolves.
- The independent reviewer and producer are the same profile revision in different sessions: the
  review is recorded as `self-attested`, not independent.
- A deterministic check passes locally but the referenced commit is unreachable (workspace
  rewound): evidence `stale`, mission cannot complete.
- The learnings block exceeds bounds: whole result rejected as invalid structured output, not
  truncated silently.
- Learnings duplicate an existing active memory entry: existing conflict/contested rules apply;
  no dedupe by model confidence.
- Memory injection query yields zero results: prompt states "no mission memory matched".
- Memory injection would exceed its byte budget: fewer entries are included, never partial
  entries; the count omitted is disclosed.
- The same worker is reused across packets: each assignment gets its own injection; the
  learnings from its earlier packet may appear in its own later prompt, attributed.
- Passport history spans a profile revision change: history is per revision; the passport shows
  the lineage but does not merge counts across revisions.
- Receipt requested while an attempt is `unknown`: receipt cannot be issued; the mission stays
  paused with the unknown attempt listed.
- Export target path becomes unavailable between preview and confirm: existing export
  target-changed error; no partial file.
- Restart mid-verification: evidence records persist; no check is re-run automatically.
- Supervisor produces a briefing that contradicts the ledger: ledger governs; briefing keeps its
  "model-authored" label; no automatic reconciliation.
- Instructions field present on an imported legacy manifest: ignored with a normalization
  warning at import unless the user sets it in a local revision.

## Requirements *(mandatory)*

All requirements extend Feature 002's US8 records (mission, work item, attempt, decision, lease,
result handoff, shared memory) and the existing domain policies in `packages/domain/src/`
(`supervisor.ts`, `shared-memory.ts`). Where a rule already exists there, this feature reuses it
and must not introduce a second implementation.

### Mission Contract and criteria

- **FR-001**: ThreadHelm MUST let the user create a mission from a single free-text outcome; the
  bound supervisor proposes the contract through a typed decision that main validates.
- **FR-002**: A Mission Contract MUST extend the existing mission envelope with: outcome text,
  acceptance criteria (each with stable id, title, evidence expectation, and revision), scope
  statement, verification plan, and allowed routine actions. All existing envelope fields
  (workspaces, eligible profiles, exact launch bindings, bounds, stop/escalation rules) remain
  required.
- **FR-003**: Contract confirmation and amendment MUST reuse the existing preview-token/confirm
  path (`missions.preview`/`confirm`, `previewRevision`/`confirmRevision`); the preview MUST
  display the full contract and be invalidated by any edit.
- **FR-004**: Amendments MUST be numbered, attributable, and reason-classified as scope,
  authority, resource-ceiling, bound-target, or criteria. Internal decomposition changes within
  the envelope are decisions, not amendments.
- **FR-005**: Missions confirmed before this feature MUST remain readable; verification, receipt,
  and passport features are unavailable for them until re-confirmed as a contract. No silent
  migration.

### Delegation accountability and progress

- **FR-006**: Every work packet MUST expose delegator, selected profile revision, structured
  rationale, required output, dependencies, attempt number, reviewer, lease state, and return
  path, sourced from existing decision/attempt/lease records.
- **FR-007**: Meaningful-progress checkpoints MUST be derived by main from observed structured
  events (typed tool calls, evidence attachment, lease transitions, result returns). Output
  bytes, process liveness, provider narration, or a self-reported checkpoint MUST NOT alone
  constitute progress.
- **FR-008**: The existing no-progress bound (`assessMissionBounds`) MUST use the checkpoint
  clock from FR-007; checkpoint timing and warning thresholds are planning parameters, not fixed
  promises.
- **FR-009**: User interventions (pause, resume, cancel, correction, amendment, manual
  acceptance) MUST be recorded with actor, time, target, and resulting state and surfaced in the
  ledger and receipt.
- **FR-010**: Usage figures MUST carry a source label from {provider-reported, CLI-derived,
  estimated, unavailable}. Time, turn, and process limits are enforced separately from cost
  estimates.

### Acceptance-evidence matrix and verification

- **FR-011**: ThreadHelm MUST maintain an acceptance-evidence matrix: criterion id x evidence
  record, where each record has kind {artifact, commit, deterministic_check, independent_review,
  manual_acceptance, hosted_result}, exact reference, producer, verifier, time, and freshness
  {fresh, stale, invalidated}.
- **FR-012**: Criterion states MUST be {unaddressed, claimed, self-attested, verified_local,
  accepted_with_limitation, contested, stale}. A worker's completion moves a criterion to
  `claimed` at most.
- **FR-013**: `verified_local` MUST require at least one of: a deterministic check executed by
  main within the approved workspace with recorded command, exit result, and content-free
  summary; an independent review record whose reviewer differs from the producer; or explicit
  manual acceptance by the user.
- **FR-014**: Evidence referencing a commit or artifact MUST become `stale` when main observes
  the referenced commit is no longer reachable from the workspace head or the artifact digest
  changes. If affected scope cannot be re-proved, old evidence MUST NOT be assumed to apply.
- **FR-015**: Deterministic checks MUST be listed literally in the confirmed contract's
  verification plan; adding, removing, or changing a check goes through the amendment flow
  (FR-004), never a runtime proposal. Checks run only inside approved workspaces under existing
  execution bounds and containment, and their raw output MUST NOT be sent to main or stored
  beyond a bounded content-free summary and exit result.
- **FR-016**: Independent review MUST satisfy separation of duties: the reviewer's profile
  revision MUST differ from the producer's. A different session of the same profile revision is
  `self-attested`, not independent. Human manual acceptance remains a separate evidence kind.
  Review MUST NOT silently launch a paid external provider (D04).
- **FR-017**: `hosted_result` is defined in the evidence-kind enum for Stage 2 only. This feature
  MUST NOT accept it through any path, manual entry included; attempts are rejected with a
  disclosure that hosted evidence is a GitHub Mission Intake capability.

### Mission Receipt and readiness

- **FR-018**: On mission completion main MUST issue a Mission Receipt containing: outcome,
  contract revision, each criterion with final state and evidence references, participants
  (session ids, profile revisions, roles), exact artifact paths and commit hashes, checks run,
  reviews, usage with source labels, elapsed time, corrections and interventions, limitations,
  and actions not performed.
- **FR-019**: A receipt MUST NOT be issued while any attempt is in an `unknown` state or any
  criterion is `claimed`, `contested`, or `stale`.
- **FR-020**: Receipt readiness MUST be one of {locally_verified, pr_ready_external}. This feature
  MUST only ever produce `locally_verified`; `pr_ready_external` is defined for Stage 2 and
  requires observed GitHub delivery and final checks.
- **FR-021**: Receipt export (Markdown, JSON) MUST use the existing bounded, disclosed
  content-handling path, exclude transcripts, terminal history, environment values, and secrets,
  and require the existing target preview/confirm.

### Worker learnings (owner decision 2)

- **FR-022**: `threadhelm_work_result` MUST accept a `learnings` array. It is REQUIRED (min 1)
  when `disposition` is `completion` and OPTIONAL for other dispositions. Each item MUST have:
  `kind` (existing MemoryKind, default `lesson`), `title` (bounded), `body` (bounded),
  `sourceRefs` (min 1, existing MemorySourceReference kinds), `confidence` (existing enum).
- **FR-023**: Bounds: at most 8 items per result; title <= 120 chars; body <= 2,000 chars;
  total learnings payload <= 12 KiB. Exceeding any bound MUST reject the whole result as invalid
  structured output (existing `invalidStructuredOutput` path), never truncate.
- **FR-024**: Main MUST persist each valid item as a shared-memory revision with author = the
  worker session, scope = the mission, confidence capped at `medium`, and an origin marker
  `worker_result` on the revision. The structured result is the deliberate publish operation
  required by FR-035 of Feature 002; no other worker output is ingested.
- **FR-025**: Existing shared-memory validation, quota, append-only revision, contested-claim,
  and user supersede/retract/delete rules apply unchanged. An item that fails content validation
  is rejected individually with a content-free disclosure; the remaining items and the result
  itself still persist.
- **FR-026**: Learnings MUST NOT be searched semantically; no vector index is introduced. Memory
  remains scoped to one mission or workspace; no cross-workspace memory read or write is added.

### Launch-time memory context (owner decision 3)

- **FR-027**: When main assigns a packet (including exact pre-authorized starts and manual
  starts), it MUST perform one deterministic `memory.search` in the mission's scope, active
  entries only (contested excluded by default), using query terms derived deterministically from
  the packet title and its criterion titles. The query and result ids MUST be recorded on the
  attempt.
- **FR-028**: Bounds: N <= 5 entries; per-entry body truncated at 600 chars with a visible
  truncation marker; total injected context <= 4 KiB; search timeout bounded and failure
  non-fatal to the launch.
- **FR-029**: Injected context MUST be delimited under a header that states it is shared
  memory provided as context, lists each entry's id, revision, author kind (user or session),
  confidence, status, and that it grants no authority and is not an instruction from the user.
- **FR-030**: Main MUST NOT consult injected or any memory content for eligibility, permission,
  lease, tool, or workspace decisions. Memory content is attributed data, never policy input.
- **FR-031**: The launch disclosure/preview MUST show that memory context will be injected and
  its entry count; the exact entries are visible in the attempt record.

### Capability Passports

- **FR-032**: A Capability Passport MUST be derived on read from durable attempt, decision,
  verification, and correction records, keyed by profile revision, grouped by role and task
  class, and MUST show sample size, first/last observed time, verified vs claimed vs failed
  counts, corrections received, and provider capability evidence with its expiry.
- **FR-033**: Declared capabilities (manifest) and demonstrated outcomes MUST be displayed
  separately; no single opaque score may be the sole summary.
- **FR-034**: Passport data MUST NOT be an input to `assertExactWorkerBinding`, launch
  permission, eligibility, or any authority check. A name, persona, or passport never becomes
  permission (D03).
- **FR-035**: Passport history is scoped per approved workspace, matching the no-cross-workspace
  memory rule; no global or cross-workspace aggregation is derived or displayed.

### Agent instructions (owner decision 4)

- **FR-036**: Agent profile revisions MUST support an optional `instructions` text field bounded
  by `MAX_GOAL_LENGTH`, validated with the same authored-text rules as `goal`, digest-bound into
  the revision, and displayed in full at revision confirmation and launch preview.
- **FR-037**: At launch, main MUST pass `instructions` to the provider through a provider
  adapter capability: Claude via append-system-prompt; Codex via a launch-time config override
  that writes no file into the workspace. The implementation plan MUST verify that Codex CLI
  0.150.x actually supports that override; if support cannot be verified, the Codex launch
  disclosure MUST say "instructions not applied" and the worker still starts. Any adapter that
  declares no capability is disclosed the same way.
- **FR-038**: `instructions` MUST be inert for authority: parsed as untrusted data, never
  consulted by eligibility, permission, lease, tool, or workspace checks, exactly as `goal`.
  Content validation MUST reject secrets and control sequences.
- **FR-039**: Legacy manifests carrying an `instructions` field MUST import it as a warning,
  not as a set value, until the user confirms it in a local revision.

### Mission Focus experience

- **FR-040**: Mission Focus MUST present: mission list (left); selected outcome, supervisor
  briefing, and delegation ledger (center); acceptance-evidence matrix and usage (right).
  Terminals, logs, and full work detail are drill-downs. It extends the existing Mission Focus
  workspace shell and Mission Course; it does not introduce a second shell.
- **FR-041**: All mission-owned regions MUST switch atomically on mission selection and focus
  the new mission heading.
- **FR-042**: The supervisor briefing MUST be labeled model-authored with its timestamp and MUST
  NOT replace or reconcile ledger data.
- **FR-043**: Views MUST update only from mission-changed events; no polling timers or
  continuous rendering in idle state. Lists MUST be bounded and paginated using existing view
  limits.
- **FR-044**: Primary workflows MUST be keyboard reachable with visible focus, support 200% text
  scaling, meet WCAG 2.2 AA contrast, respect reduced motion, and announce attention changes.
- **FR-045**: Presentation MUST use lists, tables, badges, text detail, and confirmations; no
  topology graphs, avatars, or decorative motion.

### Boundaries, authority, and recovery

- **FR-046**: Missions MUST terminate at a locally verified receipt / PR-ready definition. Merge,
  deployment, spending, credential changes, workspace expansion, push, PR creation, and issue
  comments are excluded and MUST fail closed if proposed (existing FR-043 escalation path).
- **FR-047**: Electron main remains the sole validator of typed operations and the sole SQLite
  writer. The supervisor and workers gain no new direct authority; all new operations are typed
  and envelope-validated like the existing supervisor tools.
- **FR-048**: Recovery MUST preserve contracts, criteria, evidence, receipts, learnings, and
  passports; no check, worker, or mission is re-run or resumed automatically; unknown outcomes
  remain unknown (existing `WORK_ATTEMPT_UNKNOWN` handling).
- **FR-049**: No transcript, reasoning trace, terminal output, environment value, secret, or
  workspace file MAY enter memory, receipts, passports, or prompts except through the deliberate
  operations defined here (structured result learnings, contract confirmation, manual evidence
  entry).
- **FR-050**: Any scenario requiring a live automatic provider start remains blocked under D03
  until the original Feature 002 proof passes; fixtures satisfy development tests only and are
  labeled as such in evidence.

### Key Entities

- **Mission Contract**: The existing Supervisor Mission envelope plus outcome, criteria,
  scope, verification plan, allowed actions, contract revision, and amendment history.
- **Acceptance Criterion**: Stable id, title, evidence expectation, revision, and current state.
- **Contract Amendment**: Numbered, classified, attributable change to a confirmed contract with
  its own preview/confirm evidence.
- **Work Packet**: User-facing view of a Supervisor Work Item plus its assignment rationale,
  required output, reviewer, and return path.
- **Progress Checkpoint**: Main-observed structured event that advances the no-progress clock.
- **Evidence Record**: Kind, exact reference, producer, verifier, time, freshness, criterion link.
- **Verification Result**: Deterministic check run or independent review outcome bound to
  evidence, with content-free summary.
- **Mission Receipt**: Immutable completion record with readiness state and export lineage.
- **Worker Learnings**: The bounded `learnings` block of a structured result; persisted as
  shared-memory revisions with origin `worker_result`.
- **Launch Memory Context**: Recorded search query, selected entry/revision ids, and byte count
  injected into one attempt's first prompt.
- **Capability Passport**: Read-derived history for one profile revision; no stored score.
- **Agent Instructions**: Bounded, digest-bound text on a profile revision, passed as provider
  behavioral instructions, inert for authority.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from a one-sentence outcome to a confirmed Mission Contract in one
  review screen without editing JSON or a terminal.
- **SC-002**: 100% of work packets in a fixture mission show delegator, profile revision,
  rationale, dependencies, attempt, and reviewer sourced from durable records.
- **SC-003**: 0 criteria reach `verified_local` from a worker claim alone across the test suite;
  every `verified_local` has a check, independent review, or manual acceptance record.
- **SC-004**: Invalidating a referenced commit marks dependent evidence `stale` within one
  mission-changed event and blocks completion.
- **SC-005**: Every issued receipt has readiness `locally_verified`; no code path in this feature
  can produce `pr_ready_external`.
- **SC-006**: 100% of completion results without a valid `learnings` block are rejected; 100% of
  persisted learnings have a worker-session author, mission scope, and >= 1 source reference.
- **SC-007**: Injected memory context never exceeds 5 entries / 4 KiB and is recorded on the
  attempt; a launch proceeds when the memory store is unavailable.
- **SC-008**: An attempt to gain authority via `instructions`, injected memory, or passport data
  produces identical fail-closed results to Feature 002 baseline tests.
- **SC-009**: Mission Focus completes a full fixture delegation cycle keyboard-only at 200% text
  scaling; idle CPU shows no timer-driven renders.
- **SC-010**: Windows 11 x64 installed acceptance covers contract, ledger, verification,
  receipt, learnings, injection, instructions, and Mission Focus with fixture workers; live
  provider scenarios are recorded separately and marked D03-blocked unless the original proof
  has passed.

## Assumptions

- The Feature 002 US8 typed supervisor tools, mission envelope preview/confirm, work DAG,
  leases, attempts, result handoffs, and shared memory FTS store exist on `main` and are
  extended in place.
- The Mission Focus workspace shell, Mission Course, and workspace recon (PRs #20, #21) are the
  UI base; this feature adds regions and data, not a new shell.
- Deterministic checks are commands already allowed by the workspace's approved execution bounds
  (for example the project's test runner); this feature adds no new command authority.
- `goal` is currently display-only and not passed to providers; `instructions` is the first
  profile text sent to a provider, which is why it gets its own launch disclosure.
- Provider adapters expose a declared capability for behavioral instructions; absence is a
  disclosed limitation, not an error.
- **Dependency (D03)**: `packages/providers/src/claude-code.ts` currently pins capability
  evidence to literal Claude 2.1.251 and hard-codes `organizationPolicy: 'unknown'`, so
  `assertExactWorkerBinding` holds every Claude auto binding today. Stage 1 auto-start acceptance
  depends on that being fixed and proved under Feature 002 D03 (T148/T157); this spec does not
  change the provider adapter or the preflight rule.

## Out of scope

- GitHub intake, issue sync, Draft Missions from issues, and any webhook/relay/tunnel (Stage 2).
- External delivery: managed worktree/branch creation, push, PR creation or update, issue
  comments, and the `pr_ready_external` readiness transition (Stage 2).
- Automatic issue starts, trusted triggers, quotas for auto-start (Stage 3, unauthorized).
- Merge, deployment, spending, credential changes, broader workspace access.
- Semantic or vector memory retrieval; cross-workspace memory; automatic transcript or
  reasoning ingestion.
- Recursive worker delegation, multi-user or cross-device control, agent marketplace.
- ARM64 distribution and the deferred D01/D05/D06 fixed-ceiling claims.
- New provider integrations or provider model/effort policy (belongs in the plan).
- Restoring any deferred Feature 002 task (T148, T149, T154, T157, T174); those stay on the 002
  ledger.

## Owner decisions 2026-09-04

Recorded answers to the draft's clarification questions; the requirements above encode them.

1. **Codex `instructions`**: launch-time config override, no file written into the workspace.
   The plan must verify Codex CLI 0.150.x supports it; otherwise the Codex launch disclosure says
   "instructions not applied" and the worker still starts (FR-037, US7 scenario 2).
2. **Independent reviewer**: a different profile revision than the author. Same profile,
   different session does not count. Human acceptance stays a separate evidence kind (FR-016).
3. **`hosted_result` evidence**: reserved for Stage 2; not enterable in Stage 1 by any path
   (FR-017).
4. **Capability Passports**: scoped per workspace, matching the no-cross-workspace memory rule
   (FR-035).
5. **Deterministic checks**: listed in the confirmed Mission Contract; changes go through the
   amendment flow, never runtime proposal (FR-015).

Earlier decisions of the same date, folded into the draft: PR-review boundary (FR-046);
required worker `learnings` block persisted as attributed shared memory (FR-022..026);
launch-time deterministic memory injection (FR-027..031); per-agent `instructions` field
(FR-036..039).
