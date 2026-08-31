# Data Model: Durable Hive Coordination

**Feature**: [spec.md](spec.md)

**Plan**: [plan.md](plan.md)

## Model principles

1. Electron main is the only durable-state writer.
2. Session identity is stable and never inferred from a display name, process ID, terminal text, or
   provider-supplied sender field.
3. Delivery state and work outcome are orthogonal.
4. External terminal dispatch is at-most-once automatically; uncertainty is a durable state.
5. Message content is intentionally durable but isolated from lifecycle logs and broad events.
6. Deletion removes content while preserving a content-free causal and lifecycle record.
7. Every automatic continuation is bounded and can only reduce, never broaden, existing authority.
8. Shared knowledge is revisioned, scoped, and attributable; search relevance is not truth or authority.
9. The supervisor is an ordinary participant role; main owns mission policy, leases, and effects.
10. Mission-envelope bounds are durable and monotonic unless the user approves a revision.
11. Recovery never replays an uncertain action or silently replaces or resumes a supervisor.
12. Hire manifests are untrusted, revisioned profile data; names, goals, and capabilities are never authority.
13. Templates and wizard drafts are non-executable scaffolds; generation must end in the same strict reviewed manifest contract.

## Enumerations

### ConversationState

- `open`: accepts reviewed handoffs and allowed structured replies.
- `paused`: no handoff is automatically presented; held items remain visible.
- `resolved`: the requested work has a recorded terminal outcome; content remains readable/deletable.
- `closed`: terminal coordination state; later arrivals are held and cannot reopen it implicitly.

### HandoffKind

- `request`: asks the recipient to perform already reviewed work; requires a response.
- `query`: asks for information; always held for user review in automatic mode.
- `proposal`: suggests changing approach or scope; always held for user review in automatic mode.
- `inform`: supplies context and does not obligate a response.
- `response`: answers an existing request or query without creating new authority.
- `completion`: reports work complete; terminal unless the user reopens with a new handoff.
- `refusal`: reports that work will not be performed; terminal.
- `failure`: reports that work could not be completed; terminal.

### HandoffOrigin

- `user`: created through a renderer disclosure and explicit confirmation.
- `provider_bridge`: created through a structured bridge call authenticated to one agent session.
- `threadhelm`: a fixed, content-free lifecycle item; never used for user or provider prose.

### DeliveryState

- `queued`: durable and eligible for a future presentation decision.
- `held`: blocked by conversation state, reply/loop/failure bound, message kind, or authority policy.
- `manual_actionable`: user action is required because automation is unavailable, failed safely, or
  has an unknown external outcome.
- `presenting`: one persisted delivery attempt is being submitted to the session control queue.
- `delivered`: the session host confirmed that the complete envelope was applied to the PTY.
- `acknowledged`: the authenticated recipient bridge acknowledged the handoff.
- `failed`: a known failure occurred before any possible PTY write and no attempt is active.
- `cancelled`: the user cancelled before a possible successful presentation.

### DeliveryAttemptState

- `prepared`: persisted before entering the external control queue.
- `dispatching`: main submitted the attempt and is awaiting host acknowledgement.
- `applied`: host confirmed the input control was applied.
- `failed_before_write`: evidence proves the payload was not written.
- `unknown`: main cannot prove whether the payload was written; automatic resend is prohibited.

### WorkOutcome

- `pending`: no terminal work result recorded.
- `completed`: recipient reports completion.
- `refused`: recipient explicitly declines.
- `failed`: recipient reports failure.
- `cancelled`: user cancels the requested work.
- `escalated`: work cannot safely progress without user direction.

### EscalationKind

- `reply_depth`
- `equivalent_message_loop`
- `repeated_delivery_failure`
- `conflicting_instruction`
- `authority_required`
- `target_ambiguous`
- `storage_limit`
- `unknown_delivery`

### EscalationState

- `open`
- `continued`
- `redirected`
- `closed`

### MemoryKind

- `fact`, `decision`, `constraint`, `artifact`, or `lesson`.

### MemoryStatus

- `active`, `contested`, `superseded`, `retracted`, `expired`, or `deleted`.

Only `active` and, when explicitly requested, `contested` content appears in normal search. Deleted
status retains content-free lineage only.

### AgentProfileState

- `pending_review`, `active`, `disabled`, `incompatible`, `superseded`, or `deleted`.

Only an `active` profile revision may be selected for a new session or mission. Existing missions pin
their reviewed revision and do not follow a later import automatically.

### AgentTemplateState

- `active`, `disabled`, `superseded`, or `deleted`.

### AgentDraftState

- `editing`, `invalid`, `ready_for_review`, `completed`, or `deleted`.

### MissionState

- `draft`, `awaiting_confirmation`, `running`, `paused`, `completed`, `cancelled`, or `recovery_required`.

### WorkItemState

- `proposed`, `blocked`, `ready`, `leased`, `running`, `waiting`, `completed`, `failed`, `cancelled`,
  or `escalated`.

### SupervisorDecisionKind

- `decompose`, `assign`, `reassign`, `retry`, `pause`, `complete`, or `escalate`.

### WorkAttemptState

- `prepared`, `assigned`, `acknowledged`, `completed`, `failed_before_effect`, `unknown`, or `cancelled`.

## Entities

### CoordinationParticipant *(derived view; not a new authority table)*

Represents the currently relevant coordination identity of an existing agent session.

| Field | Type | Rules |
|---|---|---|
| `sessionId` | UUID | References exactly one `agent_sessions` row. |
| `workspaceId` | UUID | Copied from the referenced session for target disclosure. |
| `workspaceDisplayPath` | string | Renderer-safe path already exposed by `SessionView`. |
| `providerId` | `codex-cli` or `claude-code` | Product runtime providers remain unchanged by this feature. |
| `lifecycleState` | existing lifecycle enum | Only `running` is PTY-presentable. |
| `activityState` | existing activity enum | Defaults to `unknown`; never inferred for coordination. |
| `activityEvidenceKind` | safe string | Must name a proved adapter signal or `none`. |
| `coordinationMode` | `manual_only` or `structured_safe_point` | Derived from adapter/version proof and live bridge health. |
| `bridgeConnected` | boolean | Volatile; not evidence that the model is idle or has read a handoff. |

The renderer cannot assign these fields. Main joins durable session/workspace records with the live
adapter/bridge registry.

### CoordinationConversation

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `state` | ConversationState | Starts `open`. |
| `rootHandoffId` | UUID nullable | Set after the first handoff insert in the same transaction. |
| `autoContinueEnabled` | boolean | Defaults `false`; can be enabled only through explicit disclosure. |
| `autoReplyDepthLimit` | integer | Fixed at 8 for this plan. |
| `consecutiveDeliveryFailures` | integer | Non-negative; reset only after an applied delivery. |
| `pauseReasonCode` | safe code nullable | Required when `state=paused`. |
| `createdAt` | timestamp | UTC ISO-8601. |
| `updatedAt` | timestamp | Monotonic per committed mutation. |
| `resolvedAt` | timestamp nullable | Required when resolved. |
| `closedAt` | timestamp nullable | Required when closed. |
| `contentDeletedAt` | timestamp nullable | Set after all retained content fields in the conversation are nulled. |

**Validation**:

- At most 100 conversations may be `open` or `paused` together.
- `autoContinueEnabled` does not permit request/query/proposal/conflict/authority-required/unknown
  items to bypass user review.
- Closed conversations never return to open; continuing work creates a new conversation with an
  explicit causal reference in a content-free event.

### CoordinationHandoff

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Stable logical identity and primary key. |
| `conversationId` | UUID | Required foreign key. |
| `inReplyToId` | UUID nullable | Must reference an earlier handoff in the same conversation. |
| `senderSessionId` | UUID | Required existing session; main derives it for bridge-origin messages. |
| `recipientSessionId` | UUID | Required existing session; exactly one recipient. |
| `senderWorkspaceIdAtCreate` | UUID | Immutable authority/audit snapshot. |
| `recipientWorkspaceIdAtCreate` | UUID | Immutable target-review snapshot. |
| `origin` | HandoffOrigin | `provider_bridge` requires an authenticated live bridge. |
| `kind` | HandoffKind | Drives response expectation and automatic hold rules. |
| `requiresReply` | boolean | Required for request/query; false for completion/refusal/failure. |
| `purpose` | string nullable | 1–160 Unicode scalar values until content deletion. |
| `body` | string nullable | 1–16 KiB UTF-8 until content deletion. |
| `contentBytes` | integer nullable | Exact stored UTF-8 bytes; null after deletion. |
| `contentFingerprint` | 32-byte digest nullable | Deterministic normalized loop key; never emitted/logged; null after deletion. |
| `replyDepth` | integer | Root is 0; reply is parent + 1; maximum automatic depth 8. |
| `deliveryState` | DeliveryState | Starts `queued` or `held` after policy evaluation. |
| `workOutcome` | WorkOutcome | Starts `pending`; not derived from delivery state. |
| `holdReasonCode` | safe code nullable | Required for held/manual-actionable states caused by policy. |
| `createdAt` | timestamp | UTC ISO-8601. |
| `updatedAt` | timestamp | Updated with state/outcome changes. |
| `deliveredAt` | timestamp nullable | Set only with an applied attempt. |
| `acknowledgedAt` | timestamp nullable | Set only by authenticated recipient bridge or explicit user reconciliation. |
| `contentDeletedAt` | timestamp nullable | Requires purpose/body/bytes/fingerprint all null. |

**Validation**:

- Sender and recipient session IDs must differ for this roadmap.
- There are at most 128 handoffs per conversation.
- The referenced parent must precede the reply and the sender/recipient pair must reverse or remain
  within the original two participants; no third participant enters through a reply.
- `provider_bridge` cannot choose `senderSessionId`; main supplies the bridge's authenticated session.
- A bridge reply recipient is derived from the parent's sender, not accepted from bridge input.
- New `request`, `query`, and `proposal` kinds are held in automatic mode.
- Completion/refusal/failure set the corresponding work outcome only after contract validation.
- Content fields must all be present or all be null after deletion.

### DeliveryAttempt

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `handoffId` | UUID | Required foreign key. |
| `attemptNumber` | integer | Starts 1; unique per handoff and monotonically increasing. |
| `recipientSessionId` | UUID | Immutable target of this attempt. |
| `recipientWorkspaceId` | UUID | Exact approved workspace snapshot at disclosure. |
| `recipientLifecycleAtReview` | lifecycle enum | Snapshot shown in presentation disclosure. |
| `activityEvidenceKindAtReview` | safe string | `none` allowed and displayed as unknown. |
| `state` | DeliveryAttemptState | Starts `prepared`. |
| `controlSequence` | integer nullable | Set when submitted to the session host. |
| `evidenceKind` | safe enum/string | Fixed evidence category, never raw provider/terminal data. |
| `reasonCode` | safe code nullable | Required for failed/unknown. |
| `createdAt` | timestamp | UTC ISO-8601. |
| `submittedAt` | timestamp nullable | Set on `dispatching`. |
| `completedAt` | timestamp nullable | Set on applied/failed/unknown. |

**Constraints**:

- Only one attempt per handoff may be `prepared` or `dispatching`.
- Only one attempt per handoff may ever be `applied`.
- An `unknown` attempt permanently blocks automatic retry to its recipient session.
- Retargeting produces a new attempt against a new exact-target disclosure; history is retained.

### CoordinationEvent

Content-free append-only evidence for user-visible history and recovery.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `conversationId` | UUID | Required foreign key. |
| `handoffId` | UUID nullable | Set when the event concerns one handoff. |
| `sequence` | integer | Strictly increasing per conversation; unique with conversation ID. |
| `kind` | safe event enum | Created, queued, held, presentation requested, dispatching, delivered, acknowledged, outcome recorded, paused, resumed, retargeted, cancelled, content deleted, recovered. |
| `actor` | `user`, `threadhelm`, or `provider` | Provider is accepted only through authenticated bridge/evidence. |
| `reasonCode` | safe code nullable | Never includes user/provider prose. |
| `safeSummary` | fixed/sanitized string | Maximum 300 characters; never body-derived beyond fixed labels/IDs. |
| `occurredAt` | timestamp | UTC ISO-8601. |

### CoordinationEscalation

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `conversationId` | UUID | Required foreign key. |
| `handoffId` | UUID nullable | Triggering handoff when applicable. |
| `kind` | EscalationKind | Deterministic trigger. |
| `state` | EscalationState | Starts `open`. |
| `reasonCode` | safe code | Required. |
| `safeSummary` | fixed/sanitized string | No raw content. |
| `openedAt` | timestamp | UTC ISO-8601. |
| `resolvedAt` | timestamp nullable | Required when not open. |
| `resolution` | `continue`, `redirect`, or `close` nullable | Exact user disposition. |

One open escalation per conversation is sufficient; another trigger appends an event while the
existing escalation remains authoritative.

### BridgeSession *(volatile only)*

| Field | Type | Rules |
|---|---|---|
| `sessionId` | UUID | Owning agent session. |
| `pipeName` | opaque local name | Never logged or emitted to renderer. |
| `credential` | opaque random token | Memory-only, session-bound, invalidated on disconnect/end. |
| `providerId` | provider enum | Must match the owning session. |
| `providerVersion` | normalized string | Must be in the tested bridge range. |
| `capability` | `manual_only` or `structured_safe_point` | Defaults/manual on any uncertainty. |
| `connectedAt` | timestamp nullable | Connection alone is not activity/readiness evidence. |

### AgentProfile

Current local identity and selection state for one reviewed portable hire.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key; never derived from display name. |
| `displayName` | string | Reviewed `name`; presentation metadata only. |
| `state` | AgentProfileState | `active` requires a compatible current revision and explicit confirmation. |
| `currentRevisionId` | UUID nullable | Required except after confirmed deletion. |
| `createdAt`, `updatedAt`, `disabledAt`, `deletedAt` | timestamps nullable | UTC lifecycle evidence. |

### AgentProfileRevision

Immutable digest-bound result of one confirmed import or explicit local edit.

| Field | Type | Rules |
|---|---|---|
| `id`, `profileId` | UUID | Primary key and owning profile. |
| `revision` | integer | Starts at 1; unique and monotonic per profile. |
| `manifestSpec` | `threadhelm/agent-profile@1` or legacy `munder-difflin/hire@1` | Imports preserve the original identifier; new wizard output uses the native identifier. |
| `name`, `description`, `goal`, `author` | bounded strings | Goal is untrusted context, at most 4,000 Unicode scalars. |
| `requestedProvider`, `requestedModel` | normalized strings | Availability resolved separately; no silent substitution. |
| `requestedCapabilities` | bounded string array | Labels only, never tool or role authority. |
| `requestedIsolation` | boolean | Preference; effective isolation is separately proved. |
| `requestedTokenCap` | positive integer | At most schema maximum and cannot raise product/mission budget. |
| `sourceFileName` | basename | Display only; no broad persistence of Downloads path. |
| `sourceSha256` | 32-byte digest | Unique idempotency/change-after-preview key. |
| `compatibilityState`, `compatibilityReasons` | enum + bounded safe codes | `compatible` or `incompatible`; no prose-derived authority. |
| `confirmedByUser`, `confirmedAt` | boolean + timestamp | Required for a stored current revision. |
| `predecessorRevisionId` | UUID nullable | Same-profile prior revision. |

The preview token is volatile/short-lived and binds the exact digest plus normalized values. Source
path, raw parse errors, and goal text never appear in broad logs or content-free events.

### AgentProfileTemplate

Stable identity and lifecycle for a generic shipped or local user-created scaffold.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key; never derived from display name. |
| `name`, `description` | bounded strings | Explain scaffold purpose; not agent authority. |
| `origin` | `bundled` or `user` | Bundled revisions are read-only and generic. |
| `state` | AgentTemplateState | Only active revisions may seed new drafts. |
| `currentRevisionId` | UUID | Required for non-deleted templates. |
| `createdAt`, `updatedAt`, `disabledAt`, `deletedAt` | timestamps nullable | UTC lifecycle evidence. |

### AgentProfileTemplateRevision

| Field | Type | Rules |
|---|---|---|
| `id`, `templateId` | UUID | Primary key and owner. |
| `revision` | integer | Starts at 1; unique/monotonic per template. |
| `manifestFields` | strict bounded JSON | Only supported hire fields/scaffolds; no tools or authority fields. |
| `variables` | bounded declarations | At most 16 named literal-text variables with type/length/default metadata. |
| `sourceProfileRevisionId` | UUID nullable | Provenance when saved from a reviewed profile. |
| `contentSha256` | 32-byte digest | Immutable revision identity. |
| `createdByUser`, `createdAt` | boolean + timestamp | Attribution and UTC evidence. |

### AgentProfileDraft

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `state`, `currentStep` | AgentDraftState + bounded step enum | Main-owned wizard lifecycle. |
| `fieldValues` | strict bounded JSON | Supported manifest fields only; incomplete values allowed while editing. |
| `validationIssues` | bounded safe codes | Recomputed per mutation; no raw stack/provider errors. |
| `sourceTemplateRevisionId` | UUID nullable | Immutable provenance snapshot. |
| `templateVariableValues` | bounded strings | Literal substitution only; no expressions or file/environment access. |
| `createdAt`, `updatedAt`, `completedAt`, `deletedAt` | timestamps nullable | Restart/recovery and lifecycle evidence. |

Drafts are not profiles and cannot be selected by a session or mission. Completion creates a reviewed
profile revision or export result; it does not mutate the template or launch a process.

### SharedMemoryEntry

Stable identity and scope for one evolving unit of shared knowledge.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `workspaceId` | UUID nullable | Exactly one workspace or mission scope is required. |
| `missionId` | UUID nullable | Exactly one workspace or mission scope is required. |
| `kind` | MemoryKind | Required. |
| `status` | MemoryStatus | Derived from current revision/conflict lifecycle. |
| `currentRevisionId` | UUID nullable | Null only after content deletion. |
| `createdBySessionId` | UUID nullable | Authenticated provider author; null for user. |
| `createdByUser` | boolean | Exactly one user/session author source. |
| `createdAt`, `updatedAt` | timestamps | UTC ISO-8601. |
| `expiredAt`, `contentDeletedAt` | timestamp nullable | Lifecycle evidence. |

### SharedMemoryRevision

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `entryId` | UUID | Required foreign key. |
| `revision` | integer | Starts at 1; unique and monotonic per entry. |
| `title` | string nullable | At most 160 Unicode scalars; null after deletion. |
| `body` | string nullable | At most 16 KiB UTF-8; null after deletion. |
| `sourceRefs` | bounded JSON | Stable handoff/work-item/memory/artifact references only; no raw provider payload. |
| `authorSessionId` | UUID nullable | Authenticated session author; mutually exclusive with user author. |
| `authorUser` | boolean | Marks an explicit user revision. |
| `confidence` | `unknown`, `low`, `medium`, `high` | Metadata only; never resolves truth or authority. |
| `status` | MemoryStatus | Immutable revision disposition except explicit lifecycle transition. |
| `supersedesRevisionId` | UUID nullable | Same-entry prior revision. |
| `contentBytes` | integer nullable | Quota value; null after deletion. |
| `createdAt` | timestamp | UTC ISO-8601. |

### MemoryConflict

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `leftRevisionId`, `rightRevisionId` | UUID | Different revisions in the same scope. |
| `state` | `open` or `resolved` | Open conflicts keep claims contested. |
| `reasonCode` | safe code | Deterministic or explicitly reported reason. |
| `resolvedByRevisionId` | UUID nullable | Required when resolved; resolution does not erase either claim. |
| `createdAt`, `resolvedAt` | timestamps | UTC ISO-8601. |

### SupervisorMission

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `objective` | string nullable | Deliberately confirmed, bounded text; deletable after terminal state. |
| `state` | MissionState | Starts draft/awaiting confirmation. |
| `supervisorSessionId` | UUID nullable | One ordinary eligible session while running. |
| `approvedWorkspaceIds` | bounded JSON | Exact approved workspace set. |
| `eligibleProfiles` | bounded JSON | Provider/profile identifiers approved by the user. |
| `autoStartWorkerBindings` | bounded JSON | Exact pinned profile-revision/workspace/runtime tuples the user authorized main to start during this mission; empty means active sessions only. |
| `maxWorkers`, `maxWorkItems`, `maxDepth`, `maxAttempts` | integers | Fixed by confirmed envelope and product maxima. |
| `deadlineAt`, `resourceBudget` | bounded values | Required stop conditions; never model-interpreted. |
| `permittedRoutineActions` | bounded enum set | Cannot include consequential authority classes. |
| `version` | integer | Increments only after user-confirmed envelope revision. |
| `createdAt`, `startedAt`, `pausedAt`, `completedAt` | timestamps nullable | Lifecycle evidence. |

### SupervisorWorkItem

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `missionId` | UUID | Required foreign key. |
| `parentWorkItemId` | UUID nullable | Same mission; depth at most eight. |
| `title`, `specification`, `acceptanceCriteria` | bounded strings | Deliberate mission content; no implicit transcript. |
| `state` | WorkItemState | Deterministic transition policy. |
| `assignedSessionId` | UUID nullable | Must match an active lease and eligible profile/workspace. |
| `workspaceId` | UUID | Must be in mission envelope. |
| `attemptCount` | integer | At most confirmed envelope/product maximum. |
| `createdByDecisionId` | UUID | Attributable supervisor/user decision. |
| `createdAt`, `updatedAt`, `completedAt` | timestamps nullable | UTC ISO-8601. |

### SupervisorDecision

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `missionId`, `workItemId` | UUID | Work item nullable for mission-level decisions. |
| `supervisorSessionId` | UUID | Authenticated ordinary supervisor session. |
| `kind` | SupervisorDecisionKind | Closed enum. |
| `normalizedFingerprint` | local digest | Used only for loop detection; never emitted or retained after mission deletion. |
| `rationale` | bounded string | Untrusted explanation, not authority. |
| `inputRefs`, `expectedEvidence` | bounded JSON | Stable IDs/safe evidence descriptors only. |
| `policyResult` | `accepted`, `held`, or `rejected` | Main-owned result. |
| `reasonCode` | safe code nullable | Required for held/rejected. |
| `createdAt` | timestamp | UTC ISO-8601. |

### WorkerLease

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `missionId`, `workItemId`, `workspaceId`, `profileRevisionId` | UUID | Exact assignment and pre-authorized worker identity. |
| `sessionId` | UUID nullable | Bound only after an active worker is selected or a reserved automatic start succeeds. |
| `mode` | `read` or `write` | Write leases conflict for the same effective workspace. |
| `state` | `reserved`, `active`, `released`, `expired`, or `unknown` | Reserved blocks conflicting launch/assignment; unknown blocks automatic reassignment to conflicting scope. |
| `acquiredAt`, `expiresAt`, `releasedAt` | timestamps nullable | Main-owned lifecycle. |

### WorkAttempt

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `workItemId`, `decisionId`, `leaseId` | UUID | Exact attempt and authority chain. |
| `sessionId` | UUID nullable | Assigned only after an active worker is selected or a pre-authorized start succeeds. |
| `attemptNumber` | integer | Unique and monotonic per work item. |
| `state` | WorkAttemptState | Unknown is terminal for automatic replay. |
| `workerStartDisposition` | `not_needed`, `started`, `held`, or `failed` | Main-owned result for the envelope-bound start request; never implies work delivery. |
| `handoffId` | UUID nullable | Addressed assignment handoff when created. |
| `resultHandoffId` | UUID nullable | Structured worker result routed by main to the bound supervisor mission inbox. |
| `reasonCode` | safe code nullable | Required for failure/unknown. |
| `createdAt`, `completedAt` | timestamps nullable | UTC ISO-8601. |

## Relationships

```text
ApprovedWorkspace 1 ── * AgentSession
AgentSession       1 ── * CoordinationHandoff (sender)
AgentSession       1 ── * CoordinationHandoff (recipient)

CoordinationConversation 1 ── 1..128 CoordinationHandoff
CoordinationHandoff      0..1 ── * CoordinationHandoff (causal replies)
CoordinationHandoff      1 ── * DeliveryAttempt
CoordinationConversation 1 ── * CoordinationEvent
CoordinationConversation 1 ── 0..1 open CoordinationEscalation

AgentSession 1 ── 0..1 BridgeSession (volatile)

AgentProfile 1 ── 1..* AgentProfileRevision
AgentProfileRevision 1 ── * AgentSession/SupervisorMission (pinned selection)
AgentProfileTemplate 1 ── 1..* AgentProfileTemplateRevision
AgentProfileTemplateRevision 1 ── * AgentProfileDraft (pinned provenance)
AgentProfileDraft 0..1 ── 1 AgentProfileRevision (confirmed completion)

ApprovedWorkspace 1 ── * SharedMemoryEntry
SupervisorMission 1 ── * SharedMemoryEntry
SharedMemoryEntry 1 ── * SharedMemoryRevision
SharedMemoryRevision * ── * MemoryConflict

SupervisorMission 1 ── * SupervisorWorkItem
SupervisorMission 1 ── * SupervisorDecision
SupervisorWorkItem 0..1 ── * SupervisorWorkItem (dependency/decomposition)
SupervisorWorkItem 1 ── * WorkAttempt
SupervisorWorkItem 0..1 ── 1 active WorkerLease
AgentSession 1 ── * WorkerLease
```

## State transitions

### Conversation

```text
open ──pause/bound/conflict/authority/unknown──► paused
open ──terminal outcome────────────────────────► resolved
open ──user close──────────────────────────────► closed
paused ──explicit continue─────────────────────► open
paused ──terminal outcome──────────────────────► resolved
paused ──explicit close────────────────────────► closed
resolved ──explicit close──────────────────────► closed
closed ───────────────────────────────────────── terminal
```

Later messages for `closed` are persisted as held evidence and never reopen it. Continued work uses
a new conversation.

### Handoff delivery

```text
queued ──policy hold────────────────────────────► held
queued ──manual required/no proved safe point──► manual_actionable
queued ──confirmed presentation────────────────► presenting
queued ──known validation/storage failure──────► failed
queued ──user cancel────────────────────────────► cancelled

held ──explicit continue────────────────────────► queued or manual_actionable
held ──user cancel──────────────────────────────► cancelled

manual_actionable ──fresh confirmed presentation► presenting
manual_actionable ──user cancel─────────────────► cancelled

presenting ──host applied────────────────────────► delivered
presenting ──known no-write failure─────────────► manual_actionable
presenting ──lost outcome/recovery──────────────► manual_actionable (unknown attempt; no auto retry)

delivered ──recipient bridge/user reconciliation► acknowledged

acknowledged, cancelled ───────────────────────── terminal delivery states
```

`failed` may return to queued only when evidence proves no write occurred and the user requests a
fresh attempt. It never retries automatically.

### Work outcome

```text
pending ──structured completion────────────────► completed
pending ──structured refusal───────────────────► refused
pending ──structured failure───────────────────► failed
pending ──user cancellation────────────────────► cancelled
pending ──bound/conflict/authority escalation──► escalated
```

Delivery and acknowledgement do not transition work outcome.

### Delivery attempt recovery

```text
prepared ──submit control───────────────────────► dispatching
prepared ──known validation failure────────────► failed_before_write
dispatching ──host controlApplied──────────────► applied
dispatching ──proved no-write failure──────────► failed_before_write
dispatching ──main/host crash or lost evidence─► unknown
```

Startup changes every durable `prepared` or `dispatching` attempt that cannot be matched to current
live evidence to `unknown`; it does not send terminal input.

### Shared memory

```text
active ──incompatible claim────────────────────► contested
active/contested ──explicit newer revision────► superseded
active/contested ──author/user withdrawal─────► retracted
active/contested ──expiry reached─────────────► expired
active/contested/superseded/retracted/expired
       ──confirmed deletion────────────────────► deleted
```

Resolution creates a new revision and closes the conflict; it never mutates or erases the competing
revisions. Only active content is returned by default.

### Agent profile

```text
file selected ──strict parse/digest────────────────► pending_review
pending_review ──exact user confirmation───────────► active or incompatible
active/incompatible ──user disables────────────────► disabled
active/disabled/incompatible ──confirmed re-import─► new revision; prior superseded
active/disabled/incompatible/superseded ──delete───► deleted
```

A changed digest invalidates the preview token. Import, disable, re-import, and deletion never launch
or stop a session; a mission continues against its pinned revision until separately revised.

### Agent template and wizard draft

```text
template active ──edit/duplicate───────────────► new revision/template
template active ──disable──────────────────────► disabled
active/disabled ──confirmed deletion──────────► deleted

new/template/profile seed ────────────────────► draft editing
editing ──invalid step/final validation───────► invalid
editing/invalid ──valid complete manifest─────► ready_for_review
ready_for_review ──field/template change──────► editing
ready_for_review ──confirmed save/export──────► completed
editing/invalid/ready_for_review ──delete─────► deleted
```

Template revisions remain immutable while referenced by drafts. Startup restores draft fields and
validation state but triggers no finalization, export, provider configuration, or session launch.

### Supervisor mission and work

```text
draft ──preview────────────────────────────────► awaiting_confirmation
awaiting_confirmation ──user confirms─────────► running
running ──bound/conflict/authority/loss────────► paused or recovery_required
paused/recovery_required ──explicit resume─────► running
running/paused ──verified outcomes─────────────► completed
draft/awaiting/running/paused ──user cancel────► cancelled

proposed ──DAG validated───────────────────────► blocked or ready
blocked ──dependencies complete───────────────► ready
ready ──lease acquired────────────────────────► leased
leased ──assignment acknowledged──────────────► running
running ──structured result───────────────────► completed or failed
running ──needs dependency/authority──────────► waiting or escalated
failed ──known-safe bounded decision──────────► ready
unknown attempt ───────────────────────────────► escalated (no automatic replay)
```

Restart moves any running mission without a valid supervisor session to `recovery_required`, and
active/ambiguous leases to `unknown` when their safety cannot be proved. Nothing is launched/resumed.

## Transaction boundaries

1. **Create handoff**: validate quota/causality → insert conversation if needed → insert handoff →
   append event → commit.
2. **Prepare presentation**: revalidate exact target/state/content → ensure no active/applied/unknown
   conflicting attempt → insert prepared attempt → set handoff presenting → append event → commit;
   only then invoke session control.
3. **Apply acknowledgement**: match session/control sequence → mark attempt applied → mark handoff
   delivered → reset consecutive failure count → append event → commit.
4. **Known failure**: mark attempt failed-before-write → mark handoff manual-actionable → increment
   failure count → pause/escalate on third → append event(s) → commit.
5. **Bridge reply/outcome**: authenticate session → validate causal target and bounds → insert reply or
   outcome → evaluate hold/pause/resolve policy → append event → commit.
6. **Content deletion**: require inactive conversation and valid deletion token → null every content
   field/fingerprint/size → set deletion timestamps → append content-free event → commit.
7. **Memory revision**: authenticate user/session and derive scope → validate content/source/quota →
   insert immutable revision → update conflict/current status → update FTS row → append event → commit.
8. **Memory deletion**: validate exact target/token/state → null revision content/size/digest → remove
   FTS row → retain content-free lineage → append event → commit.
9. **Profile import**: re-read bounded file → verify preview digest/normalized values → insert profile
   and immutable revision or idempotently return existing digest → set compatibility/enabled state →
   append content-free event → commit; no provider/session action follows.
10. **Draft mutation/template save**: validate supported fields, bounds, provenance, and literal
    variables → insert/update draft or immutable template revision → append content-free event → commit.
11. **Wizard completion**: consume exact-manifest token → revalidate draft/template revision → create
    profile revision or durable export intent → mark draft completed → append event → commit; file
    export occurs afterward and records success/failure without launching a session.
12. **Mission confirmation**: consume exact envelope token → insert/version mission and bounds → bind
   eligible supervisor profile/session → append event → commit; process launch occurs afterward.
13. **Supervisor decision/assignment**: authenticate supervisor role → validate envelope/DAG/bounds →
    insert decision → acquire non-conflicting lease → create work attempt/handoff → append events →
    commit; external dispatch occurs afterward.
14. **Work result/retry**: authenticate worker/result → close attempt/release lease → update work/DAG →
    evaluate bounds → record next accepted/held decision → commit. Unknown attempts never auto-retry.

No database transaction remains open while waiting for a provider, bridge, PTY, or renderer.

## Indexes and invariants

- Unique `(conversation_id, sequence)` for coordination events.
- Unique `(handoff_id, attempt_number)` for delivery attempts.
- Partial unique index: one `prepared`/`dispatching` attempt per handoff.
- Partial unique index: one `applied` attempt per handoff.
- Index conversations by `(state, updated_at)`.
- Index handoffs by `(conversation_id, created_at, id)` and `(recipient_session_id, delivery_state)`.
- Index attempts by `(state, created_at)` for recovery.
- Check constraints mirror contract enums and nullability rules.
- Retained-content quota is computed inside the write transaction; concurrent renderer/bridge calls
  cannot exceed it.
- Unique `(entry_id, revision)` and partial unique current revision per shared-memory entry.
- FTS rows reference only non-deleted searchable revisions and are updated in the same transaction.
- Index memory by `(workspace_id, status, updated_at)` and `(mission_id, status, updated_at)`.
- Unique normalized open conflict pair and one content-free lineage per deleted revision.
- Unique `source_sha256` per confirmed profile revision and `(profile_id, revision)`; exactly one
  current revision per non-deleted profile; missions reference immutable profile revision IDs.
- Unique `(template_id, revision)` and `content_sha256`; exactly one current revision per non-deleted
  template; drafts pin immutable source revisions and completed drafts cannot be edited.
- Unique `(mission_id, work_item_id)` identity and acyclic same-mission dependency enforcement.
- Partial unique active write lease per effective workspace; unknown leases conflict until user action.
- Unique `(work_item_id, attempt_number)` and one active attempt per work item.
- Index missions by `(state, updated_at)`, work items by `(mission_id, state, updated_at)`, and decisions
  by `(mission_id, created_at, id)`.

## Launch policy (non-manifest state)

Launch resolution records effective provider, model, effort, permission policy, provider-specific mapping,
and the source of each value before process start. Permission policy is `manual`, `auto`,
`bounded_allowlist`, or `break_glass_bypass`; it is non-manifest state and cannot be derived from
persona text. `break_glass_bypass` is valid only as an exact one-run override with a fresh container,
VM, or provider-supported sandbox runtime proving child-process containment, disposable-workspace-only
writes, no unrelated credential/environment inheritance, bounded network destinations, and verified
process/workspace/config cleanup; it is never persisted. A model/effort/permission selection directly
refreshes the bound preview and needs no separate confirmation state; the independent checkbox records
only folder-boundary confirmation. Model/effort priority is one-run override > exact agent/profile revision
request > task-type/project policy > CLI default. Permission priority is one-run selection >
task/project policy > provider default; profiles, personas, templates, and missions are excluded as
permission sources, and no persisted source may resolve to bypass. CLI default remains an explicit
model/effort option. Readiness probes and app load have no confirmation side effect. Effort and
permission policy are not part of `munder-difflin/hire@1`; automated tests are no-LLM, and test
authoring/failure analysis defaults to the lowest-cost capable approved model at low/medium effort,
with high-cost/high-effort requiring explicit selection or recorded escalation.

A supervisor automatic-start binding snapshots the resolved policy plus provider capability evidence,
isolation, workspace, tools, model/effort, elapsed/turn/no-progress/resource bounds, and resolution
sources. Claude `auto` capability evidence includes the exact CLI version, selected model/provider
surface, and organization availability. Missing or stale evidence changes the start disposition to
`held`; it never widens to bypass. Permission denial, classifier failure, timeout, cancellation,
no-progress stop, budget exhaustion, and unknown completion are distinct main-owned attempt outcomes.
- Mission envelope maxima may only stay equal or decrease automatically; expansion requires a new
  user-confirmed mission version.
