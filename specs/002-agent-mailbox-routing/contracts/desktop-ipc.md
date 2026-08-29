# Contract: Coordination Desktop IPC

This extends the existing named Zod operation registry and preload bridge. It does not add a generic
channel, renderer database access, filesystem access, or terminal-input API.

## Security envelope

- Main validates bundled sender origin/frame, operation schema, payload bounds, stable identities,
  current state, workspace approval, selected recipient, and one-time token on every request.
- Request objects reject unknown fields.
- Errors use stable codes and sanitized messages; bodies, bridge credentials, pipe names, provider
  payloads, and stack traces never appear in error details.
- List results/events contain no body. Full body crosses only in an explicit handoff preview,
  conversation-detail request, or presentation disclosure.
- Renderer displays bodies as untrusted text. Links and control sequences are inert.

## Views

### `ConversationSummaryView`

`id`, state, participant session summaries, handoff count, unresolved count, open escalation summary,
auto-continue flag, created/updated/resolved/closed/content-deleted timestamps. No purpose/body.

### `HandoffView`

Stable IDs, causal parent, participant summaries, origin, kind, response expectation, delivery state,
work outcome, hold reason, timestamps, and purpose/body only when returned inside an explicit
conversation detail. Fingerprints, bridge fields, and raw delivery payloads never cross.

### `HandoffPreviewView`

One-time `previewToken`; source/recipient/workspace summaries; normalized purpose/body; response
expectation; persistence disclosure; current retained-content usage; expiry.

### `PresentationDisclosureView`

One-time `presentationToken`; exact handoff/recipient/workspace; selected-session confirmation;
lifecycle/activity state plus evidence kind/time; normalized terminal envelope; manual-risk text;
expiry. It does not claim readiness when evidence is unknown.

### `DeliveryAttemptView`

Attempt and handoff IDs, attempt number, recipient summary, state, evidence kind, safe reason code,
control sequence when safe to expose, and timestamps. No terminal bytes.

### `ConversationDetailView`

Summary plus bounded ordered `HandoffView` and content-free event pages, and an opaque next cursor.

## Request/response operations

| Operation | Request | Success result | Important failures |
|---|---|---|---|
| `coordination.previewHandoff` | source session, recipient session, kind, purpose, body, response expectation, optional conversation/parent | `HandoffPreviewView` | invalid content, target changed, causality invalid, limit reached, storage unavailable |
| `coordination.confirmHandoff` | preview token + explicit persistence confirmation | `HandoffView` in queued/held state | token expired/replayed, target changed, conversation closed, authority required |
| `coordination.listConversations` | optional state filter, opaque cursor, limit 1–100 | page of `ConversationSummaryView` | invalid cursor, storage unavailable |
| `coordination.getConversation` | conversation ID, optional opaque cursor, limit 1–128 | `ConversationDetailView` | conversation not found, invalid cursor |
| `coordination.requestPresentation` | handoff ID | `PresentationDisclosureView` | recipient not selected/live, target changed, invalid delivery state, outcome unknown |
| `coordination.confirmPresentation` | presentation token + explicit submit confirmation | `DeliveryAttemptView` | token expired/replayed, recipient not selected/live, target changed, attempt active/applied/unknown |
| `coordination.cancelHandoff` | handoff ID | updated `HandoffView` | invalid state, delivery may have occurred |
| `coordination.previewRetarget` | handoff ID + new recipient session | target-bound disclosure | target unchanged/ineligible, conversation closed, delivery may have occurred |
| `coordination.confirmRetarget` | retarget token | updated `HandoffView` | token expired/replayed, target changed, invalid state |
| `coordination.pauseConversation` | conversation ID | updated summary | conversation terminal/not found |
| `coordination.resolveEscalation` | escalation ID + `continue`, `redirect`, or `close` and target when redirecting | updated summary/escalation | target changed, escalation already resolved, authority still required |
| `coordination.requestContentDeletion` | inactive conversation ID | deletion disclosure + token | conversation active/not found |
| `coordination.confirmContentDeletion` | deletion token + explicit confirmation | updated summary | token expired/replayed, conversation active/changed |

P5 memory operations and views are defined in [shared-memory.md](shared-memory.md). P6 profile views
and import operations are defined in [agent-profiles.md](agent-profiles.md). P7 wizard/template
operations are defined in [agent-templates.md](agent-templates.md). P8 mission, work-item, lease,
decision, and escalation operations are defined in [supervisor.md](supervisor.md). They extend
this same named Zod registry and sender validation; none adds generic IPC.

Retargeting is permitted only before a known delivery. An unknown attempt cannot be automatically or
implicitly cleared; the user may cancel it or create a new logical handoff after reviewing the
uncertainty.

## Main-to-renderer events

| Event | Payload | Rule |
|---|---|---|
| `coordination.conversationChanged` | `ConversationSummaryView` + monotonic sequence | No content body. |
| `coordination.handoffChanged` | content-free handoff state/outcome summary | Body fetched only through detail. |
| `coordination.deliveryChanged` | `DeliveryAttemptView` | Unknown outcome is explicit. |
| `coordination.escalationChanged` | escalation summary | Exact user action required. |
| `coordination.bridgeChanged` | session ID, capability, connected boolean, safe reason | Connection is not readiness evidence. |
| `coordination.storageLimit` | retained bytes, limit, safe next action | No content sample. |
| `memory.changed` | content-free entry/revision/scope/status summary + monotonic sequence | Body fetched only through explicit detail. |
| `memory.conflictChanged` | content-free conflict summary | Competing content fetched only through detail. |
| `profiles.changed` | profile/revision IDs, state, compatibility codes, digest prefix | Goal and source path require explicit detail. |
| `agentWizard.draftChanged` | draft ID/version/state/step + safe validation codes | Fields require explicit draft detail. |
| `agentTemplates.changed` | template/revision IDs, state, origin, digest prefix | Scaffold/variables require explicit detail. |
| `mission.changed` | content-free mission state/bound summary + monotonic sequence | Objective fetched only through detail. |
| `mission.workChanged` | content-free work/lease/attempt summary | No work specification or rationale. |
| `mission.decisionChanged` | decision ID/kind/policy result/safe reason | Full rationale fetched only through detail. |

The renderer coalesces repeated state events by conversation/handoff sequence and uses bounded
accessible live-region announcements. It does not poll when idle.

Profile, wizard/template, memory, and mission surfaces use compact lists/tables, forms, steps, filters, badges, text details, and confirmation
dialogs. No topology graph, force layout, avatar, animated workspace, or continuous activity display
is required.

## Stable error additions

- `CONVERSATION_NOT_FOUND`
- `HANDOFF_NOT_FOUND`
- `ESCALATION_NOT_FOUND`
- `COORDINATION_CONTENT_INVALID`
- `COORDINATION_LIMIT_REACHED`
- `COORDINATION_CAUSALITY_INVALID`
- `COORDINATION_TARGET_CHANGED`
- `COORDINATION_TARGET_NOT_SELECTED`
- `COORDINATION_NOT_ELIGIBLE`
- `COORDINATION_ATTEMPT_ACTIVE`
- `COORDINATION_DELIVERY_UNKNOWN`
- `COORDINATION_BRIDGE_UNAVAILABLE`
- `COORDINATION_AUTHORITY_REQUIRED`
- `COORDINATION_CLOSED`

Existing confirmation, storage, invalid-request, unauthorized-sender, session-not-found, and
invalid-state errors are reused where their semantics are exact.
