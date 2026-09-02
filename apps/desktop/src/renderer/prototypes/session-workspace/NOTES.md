# Session workspace design gate

This disposable prototype compares three structures for sessions and terminal work. It does not
import production code, persist data, or send process commands.

## Shared safety behavior

- The mission and selected session are named beside terminal input and beside controls.
- Session switching changes selection, terminal identity, content, and control target together.
- Stopped, failed, recovery-required, and new-output sessions remain visible in every variant.
- The state controls demonstrate truncation, backpressure, and rejected wrong-selection input.
- `F6` moves focus from the terminal surface to the exact session's Interrupt control.
- Collapsing Variant B's dock keeps the attached session running and names it in the collapsed bar.
- Recovery-required state describes an unknown outcome and never offers automatic retry.

## Variant A — Rail + full terminal

A persistent left session rail keeps the roster and lifecycle state visible beside one tall terminal.
It is quickest to scan when session management is the user's primary job, but it gives the session
roster substantial visual weight and separates the terminal from the approved Mission Course.

## Variant B — Mission dock

A lower dock remains inside the active mission. Compact tabs switch the exact attached session,
controls live in the dock header, and collapse keeps the mission course visible without stopping the
worker. This best preserves the approved single-focus mission flow while still exposing terminal
details on demand.

## Variant C — Inspector split

A session inspector keeps lifecycle evidence beside the terminal and controls. It makes failure and
recovery analysis strongest, but it is the densest structure and leaves less width for terminal
output.

## Review URLs

- `http://127.0.0.1:4180/?variant=A`
- `http://127.0.0.1:4180/?variant=B`
- `http://127.0.0.1:4180/?variant=C`

The recommended starting point is Variant B. Variant C's evidence inspector could later become an
explicit detail view for failed and recovery-required sessions without making every terminal view
dense.

## Approved decision

Variant B — Mission dock is approved. Session tabs and exact-target controls stay inside the active
mission, and collapsing the dock never stops its attached session. Variant C's lifecycle evidence
inspector is reserved for an explicit detail view when a session fails or requires recovery; it is
not permanently shown beside every terminal.
