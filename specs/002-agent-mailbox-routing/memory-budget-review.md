# Preview memory-budget revision

Date: 2026-08-31. Owner direction: apply the recommended budget reassessment following the
isolated memory prototype. Status: preview scope revised; replacement ceiling and extended
resource evidence are not yet established. This is not release acceptance.

## Decision and rationale

Keep Electron and the current production hosts for this preview. Defer the fixed aggregate
250 MiB no-session and 700 MiB four-session ceilings under D01 and D05 respectively. Preserve
both as optimization targets and retain every measured failure. Pause the proposed next
native-host/ConPTY experiment until its benefit justifies the cost independently of those
preview ceilings. No production rewrite is authorized by this decision.

Feature 001 research described these values as planning budgets without an accompanying
benchmark derivation. Installed no-session memory was 403.934 MiB. The corrected four-session
startup-idle measurement was 1,427.305 MiB, including 430.730 MiB shell, 474.945 MiB Electron
hosts, 484.266 MiB Codex and 37.363 MiB ConPTY helpers. Providers/helpers alone left approximately
178 MiB of the old total for the app and hosts. The isolated blank Tauri shell measured about
375 MiB; its dormant native-host result is not equivalent to a production terminal workload.
See [the architectural assessment](../../docs/architecture/desktop-shell-reassessment.md).

These observations justify reconsidering the planning assumptions. They do not prove that the
current app has no leaks, performs acceptably under memory pressure or supports lower-memory
machines. No replacement ceiling such as 1.5 or 2 GiB is adopted simply to pass this observation.

## Retained preview acceptance

- Count and disclose the complete app/host/provider/helper family, exact candidate and runtime
  versions, hardware and workload. Separate ThreadHelm overhead from provider costs alongside
  the aggregate total; do not exclude provider memory from the reported user footprint.
- Preserve median idle CPU at or below 1% over 60 seconds, recovery-view readiness within
  5 seconds, normal input acknowledgement within 100 ms, and 95% of normal output visible
  within 1 second. Keep the original scenario conditions and measurement definitions.
- Preserve bounded scrollback, unacknowledged output, per-session process and mission/resource
  limits, backpressure, responsive Stop, containment and cleanup. Do not change enforcement
  constants, disable accessibility/security or trim working sets to improve a reported result.
- Before P04 acceptance, record a 15-minute idle observation and five repeated start/stop cycles
  with four inert terminal fixtures on the exact candidate. Record post-warmup baseline, per-cycle
  peaks, post-stop settled memory, CPU and remaining process identities. Investigate repeatable
  accumulating growth, hangs or surviving owned processes before acceptance; do not infer leak
  freedom from a single 60-second sample. The 2026-08-31 checkpoint completed a 15m57s installed
  idle observation and one isolated four-fixture pilot cycle; the complete five-cycle series
  remains open. See [the checkpoint](t173-resource-checkpoint.md). These observations do not
  replace applicable installed/manual workflows or live-provider evidence.
- Disclose the approximately 404 MiB no-session and 1,427 MiB four startup-idle-session historical
  observations with their limitations. A changed candidate needs fresh measurements; owner
  acceptance must identify its exact bytes and observed limitations. No automatic P04/P05 pass.

This revision authorizes documentation and planning only, not new credentialed provider starts,
installation, merge, distribution or the separate P03 host-scope exception.

## Replacement-budget calibration backlog

Feature 002 performance work owns D01/D05. Before restoring a fixed ceiling or claiming a full
release memory pass, declare the minimum supported RAM and representative workload matrix.
Measure at least three fresh launches per scenario: no sessions, four inert terminal sessions,
and separately authorized real-provider workloads with exact provider versions. Include longer
observations, repeated cycles, normal output load and representative system memory pressure.
The owner's current machine alone does not establish support for lower-memory configurations.

Retain aggregate working set for historical comparison. Add private memory/commit, available
system memory and paging observations as diagnostics. Shared resident pages can appear in
multiple process working sets, so their sum is not unique physical RAM consumption; this is a
reason to supplement the metric, not silently replace it. See
[Microsoft's working-set description](https://learn.microsoft.com/en-us/windows/win32/memory/working-set).

Propose a ceiling and headroom from the repeat distribution and acceptable responsiveness on
the declared hardware, then obtain explicit scope acceptance. Until then, report the ceiling as
uncalibrated, keep regression evidence visible and make no low-memory/full-budget compliance claim.
Native-host optimization remains a separate measured opportunity, not a prerequisite created
solely by the deferred planning target.
