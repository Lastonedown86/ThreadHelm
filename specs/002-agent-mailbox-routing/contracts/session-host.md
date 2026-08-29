# Contract: Session Host Coordination Use

The coordination feature reuses the existing `host.input` / `host.controlApplied` wire protocol and
the single serialized per-session control queue. It does not create a second PTY writer or give the
renderer/bridge direct host access.

## Main-side authorization

Only Electron main may convert a confirmed `DeliveryAttempt` into `host.input`. Before sending, main:

1. consumes the one-time presentation token;
2. revalidates the selected recipient, lifecycle, workspace approval/identity, handoff state, and
   absence of active/applied/unknown conflicting attempts;
3. marks the attempt `dispatching` in a committed database transaction;
4. allocates the next normal session control sequence;
5. records an in-memory mapping from control sequence to attempt/handoff IDs; and
6. submits the complete bounded envelope plus one newline as one queue item.

The bridge and renderer cannot call the host or choose the control sequence.

## Ordering and selected-terminal safety

- Manual presentation is allowed only while the recipient is the selected renderer session and the
  user has reviewed the visible target terminal and manual-risk disclosure.
- Handoff input, user input, resize, interrupt, and stop remain in one total control order.
- Once a handoff queue item is accepted, no later user input may overtake it.
- Leaving `running`, changing selection before token confirmation, starting stop/interrupt, or
  backpressure rejects presentation before host submission.
- The user disclosure states that activity may be unknown and an existing provider draft cannot be
  inferred; explicit manual submission is required. Automatic delivery uses the provider safe-point
  contract instead of this visual/manual assurance.

## Acknowledgement mapping

`host.controlApplied` proves only that the PTY write call accepted the bytes associated with its
control sequence. Main uses the pending mapping to mark the attempt applied and handoff delivered.
It does not claim the provider parsed, read, acknowledged, or completed the work.

Unknown/mismatched control sequences are protocol violations for the affected session. They do not
advance a handoff.

## Failure and recovery

- Failure before `host.input` submission is `failed_before_write` and may become manual-actionable.
- A host failure explicitly tied to a rejected input before write is `failed_before_write`.
- Host/main exit, channel loss, mapping loss, or ambiguous error after submission changes the attempt
  to `unknown`; it is never resent automatically.
- Provider exit after `controlApplied` leaves delivery `delivered` and updates work outcome only from
  separate evidence.
- Application startup does not recreate pending host controls or replay any envelope.
- Stop, force stop, Job Object cleanup, stream isolation, and existing output privacy rules remain
  unchanged.

## Logging

Host logs may include fixed event name, session ID, control sequence, attempt ID, byte count, and safe
error code. They never include purpose/body, rendered envelope, bridge credential, terminal bytes, or
provider output.

## Tests

- handoff control cannot bypass selected-session or running-state checks;
- one total order with simultaneous user input/resize/stop;
- `controlApplied` maps to exactly one attempt;
- duplicate/out-of-order acknowledgements do not double-deliver;
- crash before submission is retryable only by user action;
- crash after submission is unknown and not resendable automatically; and
- unrelated sessions and controls remain unchanged.
