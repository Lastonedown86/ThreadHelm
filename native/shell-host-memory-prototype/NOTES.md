# Isolated memory experiment — 2026-08-31

Subsequent owner decision: reassess preview budgets before the next host experiment. The fixed
250/700 MiB preview ceilings are deferred under D01/D05 while their optimization targets and
failed measurements remain. Native-host/ConPTY work is paused, not selected for production.
See [the current scope](../../specs/002-agent-mailbox-routing/memory-budget-review.md).

Question: is Tauri/WebView2 plus native session hosts a demonstrated route to ThreadHelm's
unchanged aggregate working-set budgets on the owner's Windows machine?

**Decision: no broad Tauri port on this evidence.** The three blank-window runs already exceed
250 MiB. Native dormant hosts have a much smaller measured footprint than the installed
Electron hosts, but their fixture workload omits providers, ConPTY and the real host protocol.
This answers the first architectural question, not the production migration question.

Results, executable hashes, process accounting and limitations are recorded in
[the architectural assessment](../../docs/architecture/desktop-shell-reassessment.md#2026-08-31-isolated-memory-prototype).
The owner app was not rebuilt, reinstalled, reconfigured or connected to this prototype.

The scratch database contains one prototype row. The renderer is the existing empty-workspace
UI with a read-only, in-memory mock bridge; it is not integrated with production persistence,
coordination or providers. The visible smoke showed the NONSHIPPING title and PROTOTYPE footer.
Inspection was disconnected before subsequent resource observations.

The copied Job Object core differs only in its named tracking-job prefix; `error.rs` is unchanged.
[Provenance](src/borrowed/provenance.json) records the source commit and hashes. Normal startup
checks collisions and both-job membership for each dormant host. Normal shutdown checks host
exit zero and empty jobs. No child/grandchild, host-crash, coordinator-crash, retained-handle,
backpressure, permission, restart or production single-writer proof is claimed.

Keep this code isolated for review/reproduction, then archive or delete it. Do not merge it into
production runtime dependencies or ship the executable. A later native-host experiment must
first prove the complete containment and stream boundary with inert ConPTY fixtures. It cannot
be treated as a sufficient memory fix: the previously measured shell plus providers/helpers
already exceeded 700 MiB even without Electron host overhead.
