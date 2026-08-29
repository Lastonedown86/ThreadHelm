# Contract: Bounded Autonomous Supervisor

The supervisor is one ordinary, replaceable provider session operating through typed tools. Electron
main remains the sole mission authority, persistence writer, lease manager, router, and process-control
boundary.

## Mission envelope

Before autonomy starts, the user reviews and confirms:

- exact objective and completion evidence;
- approved workspace IDs and allowed read/write modes;
- eligible provider/profile-revision/role set and supervisor profile revision;
- maximum concurrent workers, work items, decomposition depth, attempts, elapsed time, and resource use;
- permitted routine actions and known-safe retry classes;
- stop conditions and escalation rules; and
- disclosure that supervisor/model output is untrusted and cannot expand authority.

The confirmation token is one use, expires after two minutes, and binds the exact envelope version and
current workspace/profile-revision availability. Automatic changes may only reduce limits. Expansion requires a
new preview and user confirmation.

## Role capability

Only the authenticated `supervisor` session bound to a running mission may call:

- `threadhelm_mission_inspect`
- `threadhelm_work_decompose`
- `threadhelm_work_assign`
- `threadhelm_work_reassign`
- `threadhelm_work_pause`
- `threadhelm_mission_complete`
- `threadhelm_mission_escalate`

Workers cannot call these tools. The supervisor cannot read another mission, choose arbitrary session
identities, write the database, send terminal input, invoke shell/filesystem/process APIs, access
credentials, edit provider settings, or approve consequential work.

## Structured decisions

Every mutating tool includes stable mission/work IDs, decision kind, bounded rationale, source/memory
references, expected acceptance evidence, and an idempotency key. Main derives supervisor identity,
envelope version, eligible workers, workspace scope, state, attempt count, and decision fingerprint.

Main records the accepted/held/rejected decision before any handoff or process effect. Free text,
confidence, or memory search rank cannot override a policy result.

## Work decomposition and assignment

- A work item belongs to one mission, has bounded specification/acceptance criteria, and forms an
  acyclic dependency graph of at most 64 items and depth eight.
- Main validates every proposed child/dependency before insertion. Equivalent decomposition detected
  three times within the latest eight decisions pauses the affected branch.
- Assignment is allowed only to an eligible active pinned profile revision/session in an approved workspace.
- Profile persona/capability text cannot assign a role or expand the envelope; role eligibility is a
  separate user-confirmed mission field.
- A main-owned lease prevents conflicting write-capable assignments. Unknown leases fail closed.
- Main creates one addressed handoff after the decision and lease commit. The mailbox delivery contract
  remains authoritative for presentation, acknowledgement, and uncertain outcome.

## Retry, reassignment, and recovery

- At most three known-safe attempts are allowed per work item unless the confirmed envelope is lower.
- Retry/reassignment requires evidence that the prior attempt failed before external effect or a user
  disposition. An unknown attempt is escalated and never replayed automatically.
- Worker refusal, failure, or loss may trigger reassignment only inside eligible profiles/workspaces and
  remaining budgets. Every prior attempt and lease remains auditable.
- Supervisor loss, invalid structured output, envelope/budget exhaustion, decision loops, lease
  conflict, storage failure, or recovery ambiguity moves the mission/branch to paused or
  `recovery_required` and creates a content-free escalation.
- Startup launches/resumes no supervisor or worker. User action re-establishes a valid supervisor
  session and explicitly resumes the mission.

## Consequential authority

Destructive, privileged, external, spending, credential, permission-changing, workspace-expanding, and
materially scope-changing work is always held. The supervisor may describe and escalate it but cannot
approve it, split it to evade policy, or encode approval in memory or a handoff. Exact user authority
must use the existing ThreadHelm control appropriate to the action.

## Desktop operations and events

The renderer receives typed operations for mission preview/confirm, list/detail, pause/resume/cancel,
envelope-revision preview/confirm, work-item detail, and escalation disposition. List/events are
content-free; objective/specification/rationale appears only in explicit detail/disclosure views.

Views use compact tables/lists, filters, badges, text detail, and confirmations. No office floor,
avatar, topology graph, force layout, or continuous activity animation is part of this contract.

Events include monotonic mission sequence plus safe summaries for mission/work/lease/decision changes.
The supervisor loop is event-driven from committed state and proved provider safe points; renderer
polling is never a scheduler.

## Stable errors

- `MISSION_NOT_FOUND`
- `MISSION_ENVELOPE_STALE`
- `MISSION_BOUND_REACHED`
- `SUPERVISOR_NOT_BOUND`
- `SUPERVISOR_ROLE_REQUIRED`
- `WORK_ITEM_NOT_FOUND`
- `WORK_DAG_INVALID`
- `WORK_LEASE_CONFLICT`
- `WORK_ATTEMPT_UNKNOWN`
- `SUPERVISOR_DECISION_LOOP`
- `MISSION_AUTHORITY_REQUIRED`
