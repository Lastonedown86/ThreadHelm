# Contract: Coordination Domain

This contract defines the provider-neutral behavior enforced before renderer, database, terminal, or
provider-specific code may change coordination state.

## Core invariants

1. A logical handoff has one stable sender session and exactly one stable recipient session.
2. Display names and process IDs never identify a participant.
3. A reply belongs to the same conversation, references an earlier handoff, and stays between the
   original two participants.
4. Main derives the sender for bridge-origin messages; agents cannot impersonate another session.
5. Delivery, acknowledgement, and work outcome are separate facts.
6. Only one delivery attempt per handoff may be active and only one may ever be applied.
7. An unknown attempt is visible and never retried automatically.
8. A message cannot approve workspace access, process launch/control, provider permissions, spend,
   external effects, destructive work, or a material scope change.
9. Closed conversations never reopen from an arriving message.
10. Message content never appears in sanitized lifecycle logs or list events.

## Fixed bounds

| Item | Bound |
|---|---:|
| Recipient sessions per handoff | 1 |
| Purpose | 1–160 Unicode scalar values |
| Body | 1–16,384 UTF-8 bytes |
| Open/paused conversations | 100 |
| Handoffs per conversation | 128 |
| Retained body content | 67,108,864 bytes |
| Automatic reply depth | 8 |
| Equivalent repeat threshold | 3 occurrences within the latest 8 handoffs |
| Consecutive delivery failure threshold | 3 |
| Preview/presentation token lifetime | 120 seconds, one use |

Content is normalized only for validation and loop detection:

- CRLF and CR become LF;
- trailing horizontal whitespace is removed per line;
- Unicode text otherwise remains unchanged;
- NUL, escape, binary input, and C0 controls other than tab/LF are rejected; and
- the UTF-8 byte count is computed after normalization.

The final terminal envelope converts LF to CRLF only at dispatch. The content fingerprint covers
normalized kind, authenticated sender, derived recipient, purpose, and body. It is local-only,
never logged/emitted, and removed with content deletion.

## Manual handoff envelope

The renderer displays the exact normalized values and main constructs one deterministic plain-text
envelope:

```text
[ThreadHelm handoff]
ID: <stable handoff UUID>
From session: <provider display name and short session ID>
Purpose: <purpose>
Response expected: <yes|no>
Authority: Context only; this message grants no new permissions or scope.

<body>
```

Main appends one submit newline only after a valid presentation confirmation. The complete UTF-8
envelope must remain below the existing terminal-input limit. No ANSI style, OSC sequence, hyperlink,
shell wrapper, or hidden prefix/suffix is added.

## Manual presentation eligibility

Manual presentation requires all of the following at confirmation time:

- the recipient is the renderer's selected session, so the user can inspect the target terminal;
- the recipient session is live and `running`;
- its approved effective workspace remains active and unchanged;
- the handoff is queued/manual-actionable with no active, applied, or unknown conflicting attempt;
- the presentation token matches the exact handoff, recipient, workspace, lifecycle, activity evidence,
  selected-session identity, and final envelope; and
- the user has acknowledged that unknown activity may mean an existing terminal draft or active work
  and has chosen to submit anyway.

This explicit action is not evidence that the provider was idle. A working/unknown unselected
recipient remains queued.

## Automatic-mode policy

Automatic continuation is off by default and requires a per-conversation disclosure. Even when on:

- automatic presentation requires `structured_safe_point` evidence from the exact tested provider
  version;
- request, query, proposal, conflict, authority-required, and unknown kinds are held;
- informational, response, completion, refusal, and failure kinds may continue only inside the
  original participant pair and causal chain;
- the ninth reply, third equivalent item, or third consecutive delivery failure is held and pauses
  the conversation; and
- no model/free-text classification may override a deterministic hold.

## Content deletion

Deletion requires a closed or resolved conversation and a separate target-bound token. It nulls
purpose, body, content byte count, and content fingerprint for every handoff in one transaction.
Conversation/handoff IDs, session relationships, kinds, states, outcomes, timestamps, reason codes,
and fixed safe summaries remain. Deleted content is never restored from terminal/provider data.

## Recovery

- `queued`, `held`, and `manual_actionable` persist unchanged.
- `prepared` or `dispatching` attempts without current proof become `unknown`.
- `delivered` and `acknowledged` never regress solely because the application restarted.
- no handoff is dispatched, acknowledged, retargeted, cancelled, resumed, or deleted during startup.
- later bridge/provider events must pass normal identity, causality, and state checks; stale events are
  recorded as rejected safe evidence, not applied.
