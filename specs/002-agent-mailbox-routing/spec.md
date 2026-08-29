# Feature Specification: Durable Hive Coordination Roadmap

**Feature Branch**: `main`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "Create a roadmap for aligning ThreadHelm with Munder Difflin's
coordination mechanics, including an autonomous supervisor and hive-style shared memory, without
the extensive graphics."

## Alignment Baseline

This roadmap selects Munder Difflin's mailbox/actor routing, shared blackboard/memory, and autonomous
supervisor behaviors as the mechanical alignment target. The upstream model gives each agent an
addressed inbox, persistent memory, a shared task/plan surface, portable reviewed hire profiles with
local creation templates, and a supervisor that routes and adjudicates work. ThreadHelm will pursue those coordination outcomes without adopting Munder
Difflin's office simulation, avatars, graphics-heavy memory graph, Git/file storage layout, blanket
"god mode," remote control, or provider-specific authority shortcuts.

The upstream behavior was reviewed at upstream commit
`b91a49fc0896cb95058ff74b7910820452b3bb42` from the
[Munder Difflin repository](https://github.com/chaitanyagiri/munder-difflin) and its
[Hive design](https://github.com/chaitanyagiri/munder-difflin/blob/main/HIVE.md) on 2026-08-28.
Because upstream behavior may change, each planning cycle MUST compare its proposed milestone with
the current upstream source and record any intentional divergence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send a Directed Agent Handoff (Priority: P1 — MVP)

A user selects a source session, a recipient session, and a concise work request or information
handoff. ThreadHelm shows exactly who will send and receive it, records the handoff, and reports
whether it is queued, delivered, acknowledged, or cannot be delivered.

**Why this priority**: Explicit handoffs are the smallest useful coordination step beyond supervising
independent terminals. They improve multi-agent work without requiring autonomous delegation.

**Independent Test**: With two separately approved agent sessions, send a handoff from one to the
other and verify its sender, recipient, content, timestamps, and delivery state without typing into
the wrong terminal.

**Acceptance Scenarios**:

1. **Given** two eligible sessions, **When** the user reviews and sends a handoff, **Then** only the
   selected recipient receives it and both sessions remain independently controllable.
2. **Given** a handoff ready to send, **When** the user reviews it, **Then** ThreadHelm displays the
   source, recipient, message purpose, persistence disclosure, and expected delivery behavior.
3. **Given** a recipient that cannot currently receive a handoff, **When** the user sends it,
   **Then** ThreadHelm retains an honest queued or failed state and does not claim delivery.
4. **Given** a recipient whose identity or eligibility changes before delivery, **When** delivery is
   attempted, **Then** ThreadHelm fails closed and asks the user to review the new target.
5. **Given** duplicate submission of the same handoff, **When** ThreadHelm processes it more than
   once, **Then** the recipient receives one logical handoff and the history identifies the duplicate.

---

### User Story 2 - Follow an Auditable Conversation (Priority: P2)

A user can follow replies and results as one clearly attributed conversation rather than searching
multiple terminal streams. ThreadHelm distinguishes a reply, a completion report, a refusal, and an
informational update so the user can understand whether more work is expected.

**Why this priority**: A delivered message is not useful coordination unless the user can determine
what happened next and which requests remain unresolved.

**Independent Test**: Complete a request-and-reply exchange between two fixture agents, restart
ThreadHelm, and verify that the conversation, authorship, sequence, delivery evidence, and unresolved
state remain understandable without persisted terminal output.

**Acceptance Scenarios**:

1. **Given** a delivered request, **When** the recipient responds, **Then** the response is linked to
   the original conversation and identifies its author and the item to which it replies.
2. **Given** a conversation containing informational and action-requiring messages, **When** the
   user reviews it, **Then** ThreadHelm distinguishes which messages require a response and which are
   terminal updates.
3. **Given** a completed, refused, or failed request, **When** the recipient reports the outcome,
   **Then** ThreadHelm shows the outcome without equating message delivery with work completion.
4. **Given** ThreadHelm restarts, **When** the user opens coordination history, **Then** durable
   conversations reappear with honest last-known delivery and resolution states and no message is
   automatically resent.
5. **Given** a user deletes a conversation that is no longer active, **When** deletion completes,
   **Then** its retained message content is removed from ordinary product views while a minimal,
   content-free lifecycle record may remain for integrity and troubleshooting.

---

### User Story 3 - Receive Work at a Safe Lifecycle Point (Priority: P3)

An eligible agent can receive queued handoffs without ThreadHelm silently interrupting current work,
replaying terminal input, or pretending that provider behavior is known. The user can see whether a
handoff is waiting for the agent, has been presented to it, or needs manual intervention.

**Why this priority**: Lifecycle-aware delivery turns a mailbox from passive history into useful
coordination while preserving ThreadHelm's explicit local control boundary.

**Independent Test**: Queue handoffs for running, awaiting-attention, stopped, and recovery-required
fixture sessions and verify that each receives only the allowed behavior and an honest state.

**Acceptance Scenarios**:

1. **Given** a recipient is actively working, **When** a handoff arrives, **Then** ThreadHelm queues
   it without injecting input into the active terminal or claiming the agent has read it.
2. **Given** trustworthy evidence that a recipient can safely accept new work, **When** a handoff is
   pending, **Then** ThreadHelm presents it once and records the evidence used to advance delivery.
3. **Given** a recipient whose safe delivery point cannot be established, **When** a handoff is
   pending, **Then** ThreadHelm labels delivery as waiting for manual action rather than inferring
   readiness from silence or elapsed time.
4. **Given** a stopped, failed, or recovery-required recipient, **When** delivery is attempted,
   **Then** ThreadHelm keeps the handoff queued or marks it undeliverable, explains why, and does not
   restart the agent.
5. **Given** a queued handoff and an application restart, **When** ThreadHelm recovers, **Then** it
   preserves the handoff without automatically launching an agent, injecting terminal input, or
   changing the last observed delivery state.

---

### User Story 4 - Bound Coordination and Escalate Safely (Priority: P4 — v1)

A user can let eligible agents exchange a bounded sequence of replies while ThreadHelm prevents
ping-pong loops, surfaces refusals and conflicts, and returns unresolved or consequential decisions
to the user.

**Why this priority**: Bounded coordination establishes the deterministic safety policy that later
shared-memory and supervisor milestones must obey without weakening human authority.

**Independent Test**: Run fixture conversations that complete normally, repeat a message, exceed the
reply limit, target an unavailable session, and request a consequential scope change; verify that
ThreadHelm completes, deduplicates, pauses, or escalates each case as specified.

**Acceptance Scenarios**:

1. **Given** a conversation reaches its configured reply boundary, **When** another reply would be
   required, **Then** ThreadHelm pauses the conversation and asks the user to continue, redirect, or
   close it.
2. **Given** agents repeatedly exchange equivalent requests or errors, **When** the loop threshold
   is reached, **Then** ThreadHelm prevents further automatic delivery and surfaces the evidence.
3. **Given** a handoff asks for destructive, privileged, externally consequential, or materially
   scope-changing work, **When** ThreadHelm identifies that user authority is required, **Then** it
   pauses the handoff and presents the exact request and target for explicit user action.
4. **Given** an agent refuses, cannot answer, or reports conflicting instructions, **When** the
   conversation cannot safely progress, **Then** ThreadHelm records the outcome and escalates it
   without inventing a resolution.
5. **Given** the user pauses or closes a conversation, **When** later messages arrive for it,
   **Then** ThreadHelm retains them as held items and does not resume coordination without user action.

---

### User Story 5 - Build Shared Hive Memory (Priority: P5 — v1.1)

Eligible agents and the user can publish, find, cite, supersede, and contest durable shared knowledge
without copying terminal transcripts or silently treating model output as fact. Memory is scoped to
an approved workspace or mission, records provenance, and remains readable after restart.

**Why this priority**: A supervisor cannot coordinate reliably if every worker repeatedly rediscovers
context or if shared claims have no provenance, conflict state, or deletion boundary.

**Independent Test**: Have two fixture agents publish conflicting claims about one mission, retrieve
them from a third session, resolve the conflict through an attributable revision, restart ThreadHelm,
and verify scope, citations, status, and content retention without importing terminal output.

**Acceptance Scenarios**:

1. **Given** an approved mission or workspace, **When** an eligible participant publishes a memory
   entry, **Then** ThreadHelm stores its author, source, scope, type, revision, timestamp, and status.
2. **Given** a worker requests relevant memory, **When** ThreadHelm searches the shared store, **Then**
   results are bounded, scope-filtered, attributable, and ranked by deterministic text retrieval.
3. **Given** two incompatible active claims, **When** the conflict is detected or reported, **Then**
   neither silently overwrites the other and the conflict is visible to the supervisor and user.
4. **Given** a memory entry is superseded, retracted, expired, or deleted, **When** another agent
   searches, **Then** the stale content is excluded by default while its content-free lineage remains.
5. **Given** ThreadHelm restarts, **When** shared memory is reopened, **Then** committed revisions,
   citations, scopes, and conflict states recover without provider, terminal, or Git replay.

---

### User Story 6 - Import a Reviewed Marvel Agent Roster (Priority: P6 — v1.2)

A user imports one or more Marvel-themed `munder-difflin/hire@1` manifests, reviews every parsed
field and compatibility warning, and explicitly confirms which profiles become available to
ThreadHelm. Names and personas provide a recognizable roster while capabilities, provider/model,
isolation, and token-cap values remain preferences constrained by ThreadHelm policy.

**Why this priority**: The requested autonomous supervisor needs a deliberate roster to select from,
but a portable persona file must never self-authorize tools, workspaces, budgets, or supervisor power.

**Independent Test**: Preview and import the ten supplied Marvel manifests, verify exact field and
digest attribution, reject a malformed or altered manifest, keep an unsupported model disabled, and
confirm that no import launches an agent or changes authority.

**Acceptance Scenarios**:

1. **Given** a valid `munder-difflin/hire@1` file, **When** the user selects it, **Then** ThreadHelm
   shows its name, description, goal, provider, model, capabilities, isolation request, token cap,
   author, source digest, and all compatibility warnings before confirmation.
2. **Given** an imported Marvel roster, **When** the user views it, **Then** the character names and
   concise role descriptions are usable in a compact list/detail interface without avatars or art.
3. **Given** a manifest with unsupported provider/model data, excessive bounds, unknown fields, or
   malformed content, **When** it is reviewed, **Then** ThreadHelm rejects it or imports it disabled
   with exact reasons and performs no silent substitution.
4. **Given** persona or goal text that claims permissions or contains hostile instructions, **When**
   the profile is imported or selected, **Then** the text remains untrusted agent context and cannot
   expand tools, workspace access, mission role, isolation, budget, or consequential authority.
5. **Given** an imported profile, **When** the user enables, disables, updates, or selects it for a
   mission, **Then** revisions remain attributable and mission role/authority requires a separate
   explicit decision.

---

### User Story 7 - Create Agents from Reviewed Templates (Priority: P7 — v1.3)

A user creates an agent through a compact step-by-step wizard, starts from a safe generic or
user-saved template, customizes the agent's identity and role, reviews the exact resulting
`munder-difflin/hire@1` manifest, and then saves, exports, or imports it without launching anything.

**Why this priority**: Importing existing hires preserves the user's roster; a guided creator makes
that roster maintainable without requiring hand-edited JSON or turning persona design into authority.

**Independent Test**: Create a new themed agent from a generic quality template, resume a saved
draft, validate every wizard step, preview/export the exact manifest, save it as a reusable template,
and confirm that cancellation, overwrite conflicts, invalid values, and hostile template content all
fail safely without spawning a session.

**Acceptance Scenarios**:

1. **Given** the user opens the creation wizard, **When** they move through identity, role/goal,
   capabilities, runtime preferences, isolation/budget, and review steps, **Then** each step explains
   which values are presentation/context and which effective settings will be resolved later.
2. **Given** a generic or user-saved template, **When** the user selects it, **Then** the wizard copies
   its reviewed fields into an independent draft and shows the template name/version/provenance.
3. **Given** an incomplete or invalid draft, **When** the user advances or reviews it, **Then** the
   wizard identifies exact field errors without discarding valid input or inventing missing authority.
4. **Given** a valid draft, **When** the user reviews the final manifest, **Then** ThreadHelm displays
   the exact JSON, compatibility result, effective-setting warnings, and whether the action will save
   a draft, create a local profile, save a template, or export a file.
5. **Given** a user confirms save or export, **When** it completes, **Then** ThreadHelm creates one
   attributable revision or file, never overwrites an existing file silently, and launches no agent.

---

### User Story 8 - Run a Bounded Autonomous Supervisor (Priority: P8 — v1.4)

A user starts a mission by approving its objective, workspaces, eligible agent profiles, concurrency,
resource limits, and stop/escalation rules. An ordinary, replaceable supervisor agent may then
decompose work, select eligible workers, route handoffs, use shared memory, monitor structured
outcomes, retry known-safe failures, and escalate exceptions without waiting for routine user input.

**Why this priority**: This completes the requested hive behavior while keeping process, workspace,
and consequential authority in deterministic ThreadHelm controls rather than in a privileged prompt.

**Independent Test**: Start a fixture mission with three eligible workers and one supervisor, let it
decompose and complete routine work, inject a worker failure and a scope-changing request, and verify
automatic reassignment inside the mission envelope plus a fail-closed human escalation outside it.

**Acceptance Scenarios**:

1. **Given** an approved mission envelope, **When** the supervisor decomposes the objective, **Then**
   every work item has bounded scope, acceptance evidence, dependencies, and an attributable decision.
2. **Given** multiple eligible workers, **When** work is assignable, **Then** the supervisor selects
   only an approved profile/workspace and ThreadHelm prevents conflicting write leases.
3. **Given** a routine known-safe failure within retry limits, **When** the supervisor reassigns or
   retries it, **Then** the prior attempt remains auditable and no uncertain external action is replayed.
4. **Given** destructive, privileged, external, spending, credential, workspace-expanding, or
   materially scope-changing work, **When** it is proposed, **Then** the mission pauses that branch and
   asks the user for exact authority through ThreadHelm's normal confirmation surface.
5. **Given** the supervisor crashes, exceeds a bound, loops, or produces invalid structured output,
   **When** ThreadHelm recovers, **Then** worker processes remain controllable, mission state is honest,
   and no new work is assigned until the supervisor is safely resumed or replaced.

### Edge Cases

- A source or recipient session exits between review and delivery.
- A session is replaced or restarted and receives a new identity while an older handoff is queued.
- Two sessions share a display name but have different stable identities or workspaces.
- A message is submitted, delivered, acknowledged, or replied to more than once after a crash or retry.
- Reply links refer to a missing, deleted, malformed, or unauthorized conversation.
- A broadcast-like request would exceed the allowed number of recipients.
- A conversation crosses workspaces with different approval or write-authority boundaries.
- Message content contains terminal control sequences, links, file paths, oversized content, binary
  data, credential-like values, or instructions to bypass ThreadHelm controls.
- Durable coordination storage is full, locked, corrupt, or unavailable.
- Windows locks, suspends, resumes, or ends ThreadHelm while delivery is in progress.
- A provider offers no trustworthy lifecycle signal for safe automatic presentation.
- An agent claims completion while the related session fails or enters recovery-required state.
- A user edits or deletes a queued handoff while a delivery attempt is underway.
- A conversation reaches its reply boundary at the same time the user explicitly authorizes another
  reply.
- A handoff requests work in a workspace that is no longer approved.
- Shared memory contains contradictory, stale, low-confidence, malicious, or credential-like content.
- A memory result from another mission or workspace would cross an approval boundary.
- Two workers try to claim the same work item or overlapping write-capable workspace.
- The supervisor repeatedly decomposes equivalent work, reassigns a failing item, or loses its session.
- Mission budget, concurrency, elapsed-time, task-count, or retry bounds are reached mid-run.
- The supervisor proposes launching a provider/profile or entering a workspace outside the approved
  mission envelope.
- A hire manifest is duplicated by filename, name, or digest, or is changed after its preview.
- A hire manifest requests an unavailable model, an excessive token cap, unknown capabilities, or
  isolation behavior ThreadHelm cannot guarantee.
- Persona or goal text attempts to grant itself supervisor status, tools, workspace access, external
  authority, or permission to bypass review.
- A wizard draft is abandoned, restored after restart, or based on a template revised or deleted
  while the draft is open.
- A template contains hostile goal text, invalid placeholders, unsupported provider/model defaults,
  or settings that exceed current product bounds.
- An export target already exists, becomes unavailable, or changes between review and confirmation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: ThreadHelm MUST provide a durable, addressed handoff capability for eligible local
  agent sessions.
- **FR-002**: Every handoff MUST identify a stable sender, stable recipient, conversation, purpose,
  content, creation time, response expectation, and current delivery state.
- **FR-003**: Before a user sends a handoff, ThreadHelm MUST display the exact sender, recipient,
  workspace context, content to be retained, and delivery behavior for confirmation.
- **FR-004**: ThreadHelm MUST validate sender and recipient identity and current workspace approval
  immediately before accepting or delivering a handoff; ambiguous or changed authority MUST fail
  closed.
- **FR-005**: Each handoff MUST have exactly one addressed recipient and MUST be delivered only to
  that recipient. Sending equivalent content to multiple recipients MUST create separately reviewed,
  independently tracked handoffs.
- **FR-006**: ThreadHelm MUST represent at least queued, held, delivered, acknowledged,
  manually-actionable, failed, and cancelled delivery states, and MUST NOT use delivered or
  acknowledged as evidence that requested work completed.
- **FR-007**: ThreadHelm MUST assign each logical handoff a stable identity and MUST prevent retries,
  restarts, or duplicate events from producing more than one logical delivery.
- **FR-008**: ThreadHelm MUST preserve causal links between a conversation, a handoff, any reply, and
  the item to which that reply responds.
- **FR-009**: ThreadHelm MUST distinguish messages that require a response from informational,
  completion, refusal, and failure messages that do not automatically obligate another reply.
- **FR-010**: ThreadHelm MUST provide a human-readable conversation history with sender, recipient,
  sequence, timestamps, delivery evidence, response expectation, and resolution state.
- **FR-011**: ThreadHelm MUST persist coordination history locally across application restarts while
  continuing to exclude raw terminal input, raw terminal output, environment values, and credentials
  that were not deliberately included in the handoff.
- **FR-012**: ThreadHelm MUST disclose that handoff content is a durable orchestration artifact before
  first use and MUST allow the user to delete retained content from inactive conversations.
- **FR-013**: ThreadHelm MUST treat handoff content as untrusted and MUST NOT allow its formatting,
  links, control sequences, or instructions to trigger filesystem, clipboard, application,
  operating-system, or external side effects without the separately required authority.
- **FR-014**: ThreadHelm MUST bound message size, recipient count, retained conversation volume, and
  reply depth, and MUST present an actionable explanation when a bound is reached.
- **FR-015**: ThreadHelm MUST queue a handoff for a working recipient without silently interrupting
  that recipient or injecting unreviewed input into its active terminal.
- **FR-016**: ThreadHelm MUST advance a handoff from queued to presented only from trustworthy
  recipient evidence or an explicit user action; silence and elapsed time MUST NOT establish readiness.
- **FR-017**: When trustworthy automatic presentation is unavailable for a provider or session,
  ThreadHelm MUST preserve the handoff and offer a clearly labeled manual delivery path.
- **FR-018**: ThreadHelm MUST NOT restart an agent, replay terminal input, resend a delivered handoff,
  or resume a paused conversation automatically during application recovery.
- **FR-019**: Stopped, failed, unavailable, or recovery-required recipients MUST remain ineligible for
  automatic presentation until the user establishes a new eligible session and explicitly retargets
  or cancels the handoff.
- **FR-020**: ThreadHelm MUST cap automatically continuing reply chains. At the cap, equivalent-message
  loop threshold, conflicting-instruction state, or repeated failure threshold, it MUST pause further
  delivery and request user direction.
- **FR-021**: Requests that require destructive, privileged, externally consequential, or materially
  scope-changing authority MUST remain paused until the user explicitly approves the exact action
  through the control appropriate to that action; a message alone MUST NOT grant authority.
- **FR-022**: Pausing or closing a conversation MUST prevent later messages from automatically
  resuming it; held messages MUST remain visible for user disposition.
- **FR-023**: Delivery, acknowledgement, refusal, cancellation, escalation, retry, and recovery changes
  MUST create human-readable, attributable lifecycle events without persisting secret values.
- **FR-024**: A failure in one conversation or recipient MUST NOT alter the lifecycle, input routing,
  workspace approval, or delivery state of unrelated sessions and conversations.
- **FR-025**: Primary handoff composition, confirmation, conversation review, pause, cancel, retarget,
  deletion, and escalation workflows MUST be keyboard operable with visible focus and accessible names.
- **FR-026**: The coordination interface MUST remain calm and state-focused, MUST avoid continuous
  decorative rendering, and MUST NOT depend on characters, avatars, animated scenery, or a game-like map.
- **FR-027**: ThreadHelm MUST keep coordination local to the Windows user and MUST NOT require a hosted
  ThreadHelm service, remote worker, or external message broker.
- **FR-028**: ThreadHelm MUST preserve the existing rule that concurrent write-capable agents operate
  only in separately approved effective workspaces or worktrees; handoff delivery MUST NOT bypass that
  rule or broaden filesystem authority.
- **FR-029**: ThreadHelm MUST expose enough delivery and recovery evidence for automated Windows tests
  to distinguish accepted, queued, presented, acknowledged, completed, paused, cancelled, failed, and
  recovered coordination outcomes.
- **FR-030**: Before planning each roadmap milestone, the team MUST compare the milestone with the
  current upstream Munder Difflin behavior and record which user-visible mechanics are adopted,
  adapted, or intentionally excluded.
- **FR-031**: ThreadHelm MUST provide a local shared-memory store scoped to an approved workspace or
  mission, and Electron main MUST remain its only durable writer.
- **FR-032**: Every shared-memory entry MUST record a stable identity, scope, kind, author, source
  references, revision, status, creation/update time, and deliberately submitted content.
- **FR-033**: Shared-memory reads MUST be scope-filtered, bounded, attributable, and exclude
  superseded, retracted, expired, or deleted content by default.
- **FR-034**: Shared-memory writes MUST be append/revision based; conflicting active claims MUST be
  preserved and marked contested rather than silently overwritten or resolved by model confidence.
- **FR-035**: ThreadHelm MUST NOT populate shared memory from terminal output, reasoning traces,
  provider transcripts, environment values, secrets, or workspace files without a deliberate,
  authorized publish operation.
- **FR-036**: Initial shared-memory retrieval MUST use deterministic local text indexing and explicit
  filters. Semantic/vector retrieval MAY be added only after a separate quality, privacy, resource,
  deletion, and fallback evaluation.
- **FR-037**: The user MUST be able to supersede, retract, expire, or delete shared-memory content;
  content-free provenance and lifecycle evidence MAY remain for integrity and troubleshooting.
- **FR-038**: ThreadHelm MUST let the user create an autonomous mission only through an explicit
  envelope defining objective, approved workspaces, eligible provider/profile set, maximum workers,
  task/retry/time/resource bounds, permitted routine actions, and stop/escalation rules.
- **FR-039**: The supervisor MUST be an ordinary replaceable agent session. It MUST NOT receive direct
  database, shell, filesystem, terminal, credential, process, or unrestricted IPC authority.
- **FR-040**: The supervisor MAY decompose, sequence, assign, monitor, retry, and reassign work only
  through typed operations that main validates against the active mission envelope.
- **FR-041**: ThreadHelm MUST prevent two write-capable workers from holding conflicting workspace
  leases and MUST make every assignment, reassignment, retry, and cancellation attributable.
- **FR-042**: Supervisor decisions MUST include structured rationale, inputs/references, selected
  worker/profile, expected evidence, and resulting state; free text MUST NOT override deterministic
  policy or grant authority.
- **FR-043**: Destructive, privileged, externally consequential, spending, credential, workspace-
  expanding, provider-permission, and materially scope-changing actions MUST pause the affected work
  branch for exact user approval even when the mission is otherwise autonomous.
- **FR-044**: Mission recovery MUST preserve work, leases, memory, decisions, and honest uncertainty
  without automatically replaying an uncertain action or silently replacing the supervisor.
- **FR-045**: The supervisor loop MUST be event-driven and bounded by task count, decomposition depth,
  retries, equivalent-decision detection, concurrency, elapsed time, and resource budget.
- **FR-046**: Roster, shared-memory, and supervisor status MUST use compact lists, tables, text detail, badges,
  filters, and confirmations; topology graphs, avatars, animated workspaces, and continuous visual
  activity are not required and are outside this roadmap.
- **FR-047**: ThreadHelm MUST support reviewed import of `munder-difflin/hire@1` JSON manifests and
  MUST parse them as untrusted data without executing or obeying their goal/persona text.
- **FR-048**: Before import, ThreadHelm MUST display the exact supported fields, source filename,
  SHA-256 digest, validation result, compatibility result, normalization changes, and warnings, and
  MUST require explicit user confirmation bound to that digest.
- **FR-049**: Import MUST NOT launch a session, install a provider, create a worktree, edit provider
  or project configuration, grant tools, approve a workspace, or assign a supervisor/worker role.
- **FR-050**: ThreadHelm MUST preserve name, description, goal, provider, model, capabilities,
  isolation request, token cap, author, and manifest spec while keeping capabilities and persona
  labels non-authoritative.
- **FR-051**: Provider/model availability, reasoning effort, tool registry, effective isolation,
  workspace, and mission budget MUST be resolved and disclosed at session or mission assignment;
  unsupported provider/model values MUST never be silently substituted.
- **FR-052**: Manifest `tokenCap` MUST remain a requested ceiling and MUST NOT raise ThreadHelm's
  session or mission resource limits. Reasoning effort MUST remain runtime/session configuration
  because `munder-difflin/hire@1` does not define it.
- **FR-053**: Manifest `isolate` MUST remain a requested preference; ThreadHelm MUST report whether
  the effective workspace/session isolation satisfies it and fail closed when required isolation
  cannot be established.
- **FR-054**: Profile records MUST be local, revisioned, attributable, enable/disable capable, and
  duplicate-aware by stable identity and digest; re-import MUST not overwrite history silently.
- **FR-055**: Imported profile content MUST NOT be copied into shared memory automatically, included
  in content-free logs/events, or exposed across an unrelated workspace or mission.
- **FR-056**: Mission profile eligibility and supervisor/worker/reviewer/triage role assignment MUST
  be separate user-approved policy; no name, capability label, goal text, or theme grants a role.
- **FR-057**: ThreadHelm MUST provide a keyboard-operable step-by-step agent creation wizard covering
  identity/style, description, role/goal, capability labels, provider/model request, isolation
  request, token-cap request, author, validation, compatibility, and final review.
- **FR-058**: The wizard MUST distinguish manifest data from effective runtime settings and authority;
  it MUST NOT offer tools, workspace access, mission roles, effort, or consequential permissions as
  fields inside `munder-difflin/hire@1`.
- **FR-059**: ThreadHelm MUST provide versioned generic starter templates and local user-saved
  templates. Shipped templates MUST be provider-neutral where possible, use narrow role scaffolds,
  and MUST NOT bundle the user's Marvel names or project-specific goals as product defaults.
- **FR-060**: Applying a template MUST create an independent draft with template identity, revision,
  provenance, and compatibility warnings; later template changes MUST NOT silently mutate the draft.
- **FR-061**: Wizard drafts MUST be local, recoverable after restart, explicitly deletable, bounded,
  and excluded from shared memory, provider configuration, broad logs, and active mission rosters.
- **FR-062**: Every wizard step MUST validate its owned fields before advancement while preserving
  valid input, and the final review MUST validate the complete strict manifest and show exact JSON.
- **FR-063**: Saving a wizard result as a profile MUST use the same revision, digest, compatibility,
  confirmation, and non-authority contract as imported profiles and MUST launch no session.
- **FR-064**: Export MUST write only a user-confirmed `*.hire.json` target, MUST detect existing or
  changed targets, MUST require explicit overwrite confirmation, and MUST leave a safely reportable
  result after write failure.
- **FR-065**: Saving, editing, duplicating, disabling, or deleting a user template MUST be
  attributable and revisioned; templates referenced by active drafts MUST remain reproducible.
- **FR-066**: Template substitution, if offered, MUST use only declared bounded text variables with
  literal previewed values; templates MUST NOT execute scripts, expressions, tools, or file reads.

### Roadmap Boundaries

**Planning model decision constraint**:

- `$speckit-plan` MUST include a story-by-story execution model matrix limited to the user's three
  approved ecosystems: ChatGPT/OpenAI, Anthropic Claude, and Google Antigravity.
- For each story, the matrix MUST identify the primary model, reasoning or effort setting where the
  platform exposes one, intended role, selection rationale, expected cost or usage tradeoff,
  in-ecosystem fallback, and required verification responsibility.
- Exact model names and settings MUST be verified against current availability when planning begins;
  this specification does not freeze names that may become unavailable or change capability.
- If none of the approved ecosystems has a suitable available model for a story, the plan MUST leave
  that story unassigned and surface the gap rather than recommending another provider.
- This constraint governs the agents used to plan, implement, review, and verify the roadmap stories.
  It does not by itself expand ThreadHelm's product runtime-provider scope.

**MVP milestone — Directed handoffs (P1)**:

- User-reviewed, one-recipient handoffs between eligible sessions.
- Stable identities, honest delivery states, duplicate protection, and local persistence.
- Manual recovery and retargeting when the recipient cannot receive work.
- No automatic agent-authored replies or autonomous continuation is required for MVP acceptance.

**v0.x milestone — Auditable conversations (P2)**:

- Linked replies, response expectations, completion/refusal/failure outcomes, conversation history,
  restart continuity, and user-controlled content deletion.

**v0.x milestone — Lifecycle-aware delivery (P3)**:

- Safe-point presentation where trustworthy evidence exists.
- Explicit manual fallback where provider evidence is absent or ambiguous.
- Queue preservation across stop, failure, recovery, lock, suspend, and restart events.

**v1 milestone — Bounded coordination (P4)**:

- Reply-depth and equivalent-message loop bounds.
- Pause, hold, retarget, close, and human-escalation controls.
- Consequential requests remain governed by existing ThreadHelm authority controls.

**v1.1 milestone — Shared hive memory (P5)**:

- Mission/workspace-scoped entries with provenance, revision history, citations, and conflict states.
- Deterministic local text search with bounded results and no automatic transcript ingestion.
- Supersede, retract, expire, delete, restart recovery, quota, and privacy controls.

**v1.2 milestone — Reviewed agent roster (P6)**:

- Reviewed, digest-bound import of portable `munder-difflin/hire@1` manifests.
- Compact themed roster presentation with no avatar or graphics requirement.
- Compatibility, revision, enable/disable, non-authority, and runtime-resolution controls.
- Acceptance coverage for the ten supplied Marvel profiles without compiling their project-specific
  goals into ThreadHelm defaults.

**v1.3 milestone — Agent creation wizard and templates (P7)**:

- Compact keyboard-first wizard with resumable local drafts and exact final-manifest review.
- Versioned generic starter templates plus local user-created, duplicated, edited, and deleted templates.
- Save-as-profile and safe export flows reuse profile validation, digest, compatibility, and authority boundaries.
- Themed names and prose remain text metadata; no avatar builder, image generator, or character art is required.

**v1.4 milestone — Autonomous supervisor (P8)**:

- User-approved mission envelopes, task decomposition, eligible-worker selection, dependency tracking,
  structured progress monitoring, and bounded known-safe retry/reassignment.
- Supervisor intelligence remains an ordinary provider session; Electron main enforces policy,
  persistence, leases, process controls, and human escalation.
- Compact mission/task/memory views replace Munder Difflin's office floor and memory graph.

**Explicitly excluded from this roadmap**:

- A blanket-privileged "god" supervisor, prompt-only authority policy, or supervisor access to raw
  terminal, filesystem, process, credential, database, or unrestricted IPC surfaces.
- Automatic ingestion of transcripts/reasoning, unbounded memory, or an unvalidated vector/semantic
  memory dependency.
- Unscheduled indefinite missions, remote control, chat integrations, or hosted coordination.
- A mandated Git-backed hive, a mandated mailbox file layout, or modification of user repositories to
  implement coordination.
- Automatic worktree creation, automatic installation of provider integrations, or expanded provider
  credentials management.
- Cross-device or multi-user coordination.
- Office simulations, characters, avatars, pixel art, flying message animations, or continuous motion.

### Key Entities

- **Coordination Participant**: A stable ThreadHelm session identity eligible to send or receive a
  handoff, including its agent, workspace context, lifecycle state, and current delivery eligibility.
- **Handoff**: A durable addressed unit of work or information with a stable identity, sender,
  recipient, purpose, content, response expectation, delivery state, and timestamps.
- **Conversation**: An ordered set of causally linked handoffs and outcomes with an open, paused,
  resolved, or closed state.
- **Delivery Attempt**: Evidence that ThreadHelm tried to present one logical handoff to its intended
  recipient, including outcome, timestamp, and safe failure information.
- **Coordination Outcome**: A completion, refusal, failure, cancellation, or escalation that resolves
  a request without conflating transport success with work success.
- **Escalation**: A paused coordination item that requires an explicit user decision because a bound,
  conflict, failure, authority requirement, or ambiguous target prevents safe continuation.
- **Shared Memory Entry**: A scoped, revisioned fact, decision, constraint, artifact reference, or
  lesson with deliberate content, provenance, citations, confidence metadata, and lifecycle status.
- **Agent Profile**: A local, user-reviewed representation of one portable hire manifest, including
  its display metadata, untrusted goal, requested provider/model/capabilities/isolation/token cap,
  compatibility, enabled state, stable identity, and current revision.
- **Agent Profile Revision**: An immutable digest-bound import or edit record with its source,
  validation result, compatibility reasons, confirmation evidence, predecessor, and timestamp.
- **Agent Profile Draft**: A local, resumable wizard work item with current step, bounded field values,
  validation state, optional source-template revision, and no session or mission authority.
- **Agent Profile Template**: A versioned generic or user-created field scaffold with provenance,
  declared literal variables, compatibility hints, lifecycle state, and no executable behavior.
- **Supervisor Mission**: A user-approved objective plus the exact autonomy, workspace, provider,
  worker, time, retry, concurrency, resource, stop, and escalation envelope.
- **Supervisor Work Item**: A bounded unit of mission work with dependencies, assignee/lease,
  acceptance evidence, attempts, and an honest lifecycle state.
- **Supervisor Decision**: An attributable structured choice to decompose, assign, reassign, retry,
  pause, complete, or escalate mission work, including its evidence and policy result.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing, at least 90% of users can select two eligible sessions, review a
  handoff, and send it to the intended recipient within 60 seconds without using the recipient terminal.
- **SC-002**: Across 1,000 handoffs with injected retries and duplicate events, every logical handoff
  is presented to no more than one addressed recipient and no logical handoff is presented twice.
- **SC-003**: For 100% of handoffs, the user can distinguish transport state from work outcome and can
  identify the sender, recipient, workspace context, response expectation, and latest evidence.
- **SC-004**: With four concurrent sessions and 100 queued handoffs, 95% of user actions produce a
  visible state acknowledgement within one second and the application remains responsive to keyboard input.
- **SC-005**: After an unexpected application exit during queued, delivered, and paused conversations,
  100% reappear within five seconds of opening the coordination view with no agent launch, input replay,
  duplicate delivery, or unsupported state advancement.
- **SC-006**: In all active-recipient tests, zero handoffs silently interrupt current work or enter a
  terminal before trustworthy readiness evidence or explicit user action.
- **SC-007**: In all unavailable-provider tests, every pending handoff remains visible with a manual
  next step and none is reported as presented, acknowledged, or completed without supporting evidence.
- **SC-008**: In loop, repeated-error, conflict, and reply-limit tests, 100% of conversations pause at
  or before their configured bound and surface the triggering evidence to the user.
- **SC-009**: In consequential-request tests, zero messages independently authorize destructive,
  privileged, externally consequential, or materially scope-changing actions.
- **SC-010**: In isolation tests, failure, deletion, pause, or cancellation of one conversation causes
  zero lifecycle, input-routing, workspace-authority, or delivery changes in unrelated sessions.
- **SC-011**: 100% of primary coordination workflows can be completed using only a keyboard, with
  visible focus and accessible names for every control.
- **SC-012**: During a 60-second idle period with no delivery or user activity, the coordination view
  performs no decorative motion or continuous user-visible updates and remains immediately responsive.
- **SC-013**: Across privacy tests, no terminal transcript, environment value, provider credential, or
  unrelated workspace content is added to a handoff or coordination history automatically.
- **SC-014**: In milestone reviews, every adopted mechanic maps to at least one acceptance scenario and
  every upstream mechanic intentionally omitted from the milestone is recorded as deferred or excluded.
- **SC-015**: Across shared-memory scope tests, 100% of searches return only entries visible to the
  requesting mission/workspace and every result identifies its source, author, revision, and status.
- **SC-016**: Across conflict and stale-memory tests, zero active entries are silently overwritten or
  treated as authoritative solely because a model produced them; contested and superseded states are visible.
- **SC-017**: With 10,000 memory revisions, 95% of bounded local text searches return within 500 ms on
  representative Windows hardware and an idle memory view performs no polling or animation.
- **SC-018**: Across 100 fixture missions, every automatic assignment stays inside the approved
  provider/profile/workspace/concurrency envelope and produces an attributable supervisor decision.
- **SC-019**: In supervisor crash, loop, retry, budget, and ambiguous-outcome tests, 100% of affected
  branches pause at or before their bound with no uncertain action automatically replayed.
- **SC-020**: In consequential-action tests, zero supervisor decisions independently authorize a
  destructive, privileged, external, spending, credential, workspace-expanding, or scope-changing action.
- **SC-021**: All ten supplied Marvel manifests preview and import with exact field attribution and
  stable SHA-256 digests, while malformed, changed-after-preview, and unsupported fixtures fail closed.
- **SC-022**: Across profile authority tests, zero capability labels, persona goals, model choices,
  isolation requests, or token caps expand the effective tools, workspace, budget, or mission role.
- **SC-023**: In duplicate, re-import, disable, and delete tests, 100% of profile changes retain an
  attributable revision history and no active mission silently changes profile revision.
- **SC-024**: In usability testing, at least 90% of users can import and enable a reviewed profile
  within two minutes using only a keyboard and without interpreting a graphical avatar or topology.
- **SC-025**: In usability testing, at least 90% of users can create, review, and save a valid agent
  from a starter template within five minutes without editing JSON directly.
- **SC-026**: Across wizard/template tests, 100% of generated manifests pass the same strict validation
  as imported manifests and zero drafts/templates grant tools, workspace, role, effort, or authority.
- **SC-027**: Across restart, stale-template, cancel, duplicate, and write-failure tests, 100% of drafts
  recover or fail with an honest next step and no existing export is overwritten without confirmation.
- **SC-028**: Every shipped starter template is generic, text-only, versioned, and independently
  customizable; no user-specific Marvel persona or project goal is bundled as a product default.

## Assumptions

- The selected mechanical aspect is mailbox/actor routing because it is the narrowest meaningful
  bridge from ThreadHelm's implemented independent-session supervision to its constitutional goal of
  useful multi-agent coordination.
- The roadmap aligns user-visible behavior and safety properties, not Munder Difflin's source code,
  storage choices, branding, or provider-specific lifecycle implementation.
- The roadmap begins only after the local agent workspace MVP remains a stable baseline; it does not
  reopen that feature's process-supervision or workspace-authority decisions.
- One local Windows user remains the sole operator and authority source.
- Codex CLI and Claude Code remain the initial supported ThreadHelm runtime agents. Adding Google
  Antigravity as a product runtime integration requires its own explicit scope and safety acceptance;
  including Antigravity in the story execution model decision does not silently add that integration.
- The user's approved story-execution ecosystems are ChatGPT/OpenAI, Anthropic Claude, and Google
  Antigravity. Plans must not recommend models outside those ecosystems.
- Handoff bodies are deliberately created orchestration artifacts and are retained locally until the
  user deletes an inactive conversation or a future explicit retention policy replaces that default.
- A coordination message conveys information or requests work; it does not itself grant filesystem,
  process, network, spending, destructive-operation, or scope-change authority.
- The supervisor is autonomous for routine work only inside a user-approved mission envelope; the
  envelope is authority, while the supervisor's prompt, messages, and memory are untrusted proposals.
- Shared memory is a ThreadHelm-owned SQLite projection with deterministic full-text retrieval first;
  it is not a Git repository, a provider transcript archive, or a requirement to modify user projects.
- Concurrent write-capable work continues to require separately approved effective workspaces or
  worktrees, and users prepare those worktrees outside this roadmap.
- Default bounds for message size, recipient count, retained volume, reply depth, and loop detection
  will be selected during planning and exposed in testable policy rather than inferred by agents.
- Upstream Munder Difflin is an inspiration and comparison source, not a runtime dependency.
- The ten supplied Marvel manifests are user-owned acceptance inputs, not instructions to ThreadHelm
  or product defaults; their project-specific goals remain data visible to the user and chosen agent.
- The wizard ships generic role scaffolds; the user may create Marvel-themed local templates from
  reviewed profiles, but ThreadHelm does not ship trademarked character personas or artwork.

## Dependencies

- The ThreadHelm Local Agent Workspace MVP must provide stable session identities, isolated input
  routing, durable lifecycle events, honest recovery, and safe process control.
- Planning requires a fresh review of the current Munder Difflin repository and Hive behavior because
  upstream mechanics are version-sensitive.
- Planning requires a fresh inventory of models and relevant settings currently available through
  ChatGPT/OpenAI, Anthropic Claude, and Google Antigravity before assigning stories.
- Representative fixture agents must be able to simulate recipient readiness, duplicate delivery,
  reply chains, refusal, failure, recovery, and ambiguous provider evidence without real credentials.
- Sanitized hire fixtures must cover valid, duplicate, revised, malformed, hostile-text, unavailable-
  model, excessive-bound, and changed-after-preview cases without committing the user's Downloads files.
- Wizard/template fixtures must cover draft recovery, stale template revisions, literal variable
  substitution, exact JSON preview, save-as-profile, safe export, overwrite review, and cancellation.
- Windows acceptance must cover application crash, lock, suspend, resume, unavailable storage, and
  recipient process failure while handoffs are queued or being delivered.

## Provider launch confirmation policy

Before starting any provider CLI session, ThreadHelm shows resolved provider/model/effort. Model and effort controls are direct choices that automatically refresh the bound launch preview; they do not require a second settings-review action. One checkbox confirms only the folder-access boundary and remains independent of model/effort changes. Readiness probing and app load never prompt. Priority is one-run override > exact agent/profile revision request > task-type/project policy > CLI default; CLI default remains an explicit option. Automated tests use no LLM; routine test authoring/failure analysis recommends the lowest-cost capable approved model at low/medium effort, while high-cost/high-effort requires explicit selection or recorded escalation. Planning providers are ChatGPT/OpenAI, Claude, and Google Antigravity; runtime providers remain Codex CLI and Claude Code. Effort is launch policy, not hire-schema data.
