# Desktop shell reassessment

Date: 2026-08-31. Status: owner authorized an isolated memory prototype; Electron remains the production implementation. No production migration is approved.

**Subsequent preview decision:** The owner accepted the budget reassessment after this experiment.
The original 250/700 MiB values remain optimization targets; D01/D05 now defer their fixed preview
ceilings. CPU, latency, runtime resource bounds, cleanup and exact-candidate acceptance remain
mandatory. The next native-host experiment is paused pending a cost/benefit decision independent
of those ceilings. See [the current memory-budget review](../../specs/002-agent-mailbox-routing/memory-budget-review.md).
The measurements and experimental decisions below retain their original context; none is
retroactively changed to PASS by this scope revision.

[Feature 001 research](../../specs/001-local-agent-workspace/research.md) requires a Tauri/Rust reassessment when packaged Electron still misses the idle budgets after avoidable work is removed. This document records the evidence and proposes the smallest comparison that could inform that decision. The no-session limit remains **250 MiB total working set**, with median idle CPU at or below **1% over 60 seconds**. The four-idle-session limit remains **700 MiB**. Changing the metric or weakening containment is not a remedy.

## What has actually been measured

| Configuration                                                   |       Total working set | Evidence and limitation                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ----------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packaged ThreadHelm x64 after removing the preload schema graph | **399.844 MiB maximum** | Twelve approximately five-second windows, fresh user data, no sessions or inspector, four processes; median CPU **0%**. Memory fails; CPU passes. This is packaged-app evidence, not Squirrel-installed or ARM64 proof. |
| Electron 44.0.0, one blank local window, normal graphics        |         **280.594 MiB** | One snapshot after 15 seconds; four processes including a confirmed loaded renderer. No ThreadHelm preload, coordinator, database, or application UI.                                                                   |
| Same blank Electron window, software graphics                   |         **275.121 MiB** | Same diagnostic procedure; still four processes and still above budget. This configuration was not adopted.                                                                                                             |

The packaged record is [`preload-packaged-idle-performance.json`](../../tmp/us8/preload-packaged-idle-performance.json), recorded at `2026-08-30T21:50:26-04:00`. Its executable SHA-256 is `FFFF6E1318292A29399C3A0E8AB0DA53F72DB60A0061756BEFD4C8B9AF713914`. The raw comparison is [`minimal-electron-memory-ab.json`](../../tmp/us8/minimal-electron-memory-ab.json), with the harness and validity checks in [`minimal-electron-memory-ab.ps1`](../../tmp/us8/minimal-electron-memory-ab.ps1) and [`minimal-electron-baseline.cjs.txt`](../../tmp/us8/minimal-electron-baseline.cjs.txt). These local diagnostic artifacts are not release assets.

Both blank-window samples required a `did-finish-load` marker and renderer PID. Earlier probes without a confirmed renderer, including `minimal-electron-memory-ab-invalid.json`, are excluded. These valid snapshots establish an observed blank-shell cost on this machine, **not a universal Electron memory floor or a complete 60-second acceptance run**. Their private-byte totals do not substitute for working set. Inference: further bundle-only optimization has an uncertain route to 250 MiB here; these samples do not prove that every supported Electron configuration must fail.

The fresh deferred-renderer measurement completed at `2026-08-30T22:39:19-04:00`: **380.324 MiB peak**, median CPU **0%**, twelve approximately five-second windows and four application processes. Report: [`closure2-packaged-idle-performance.json`](../../tmp/us8/closure2-packaged-idle-performance.json), executable SHA-256 `0AB3152EDED2F1855FD67C5B99D61EA4E9955A99C26140C87036F8225508A29B`. Its peak is lower than the previous 399.844 MiB observation, but a single before/after run does not attribute the entire difference to this change. The unchanged 250 MiB gate still fails. The current implementation and broader verification remain recorded in [Feature 002 execution evidence](../../specs/002-agent-mailbox-routing/execution-evidence.md).

## Feasible paths

### 2026-08-31: four real idle sessions and corrected CPU attribution

The unchanged owner-installed x64 runtime `0745294` was measured with four Codex 0.151.0
processes at their initial folder-trust prompts. No prompt or trust confirmation was submitted.
The approved manual/default-model/default-effort/eight-process launch envelope was retained.
After disconnecting the UI inspection client, twelve windows over 63.83 seconds measured
**1,427.305 MiB peak aggregate working set** and **0.588% median one-core CPU**. All sixteen
process identities stayed fixed. Report: `tmp/us8/detached-four-idle.json`.

At the peak, the complete process family consisted of:

| Component                                       |       Working set |
| ----------------------------------------------- | ----------------: |
| Desktop main, renderer, GPU and network service |       430.730 MiB |
| Four Electron session hosts                     |       474.945 MiB |
| Four native Codex processes                     |       484.266 MiB |
| Four ConPTY helpers                             |        37.363 MiB |
| **Total**                                       | **1,427.305 MiB** |

The earlier 17.464% CPU measurement was confounded by the inspection client. A native sampled
trace showed accessibility/COM request servicing. With the same installed process and no live
sessions, disconnecting that client reduced a five-second main-process observation from
39.0625% to 0%; reconnecting restored the spike. No application accessibility, graphics,
permissions, or containment setting was disabled. This diagnoses the measurement overhead;
it does not establish the performance of every assistive-technology client. The corrected
[observer and procedure](../../tests/acceptance/helpers/measure-installed-idle.md) require
inspection/profiler disconnection and retain all process and memory accounting.

CPU no longer explains this memory failure. The observed desktop plus provider/helper cost is
already approximately 952 MiB even before the 475 MiB session-host group. Consequently,
removing only host overhead would not meet 700 MiB for this observed configuration. That is a
calculation from this run, not proof of a universal runtime floor. A credible remedy needs a
measured reduction across the shell/host architecture; bundle-size edits alone have no
demonstrated path to the required 727 MiB reduction.

At the time of this diagnosis, the staged comparison below remained the proposed next step. Extend its resource
report to budget the shell, coordinator, four dormant hosts, providers and helpers separately,
while enforcing the unchanged aggregate threshold. Retain the same per-session Job Object
ownership and Job-before-create handshake; do not combine providers into one containment
scope, make the renderer a writer, or replay uncertain work. The production host preserve-only
scope and explicit migration review remain in force. No replacement runtime was implemented
or represented as proven by this diagnostic work.

| Path                                              | Benefit                                                                                                | Cost and unresolved question                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Retain Electron and finish bounded profiling      | Preserves the proven implementation and existing tests.                                                | The latest completed package misses the budget. Further work needs a measured, specific source of avoidable allocation; indefinitely reducing JavaScript bytes is not evidence of success.                                                                         |
| Tauri 2 with a Rust coordinator and WebView2 UI   | Can render the existing React UI behind a mock bridge; native host footprint is separately measurable. | The isolated blank-shell runs below fail 250 MiB. TypeScript authority logic, persistence integration, Electron lifecycle, and the session-host launch protocol still need deliberate replacement or extraction.                                                   |
| Tauri/WebView2 with one headless Node coordinator | Could preserve more TypeScript domain logic, SQLite integration, and N-API code during a transition.   | Adds a runtime process and crash coupling. Node must remain the sole SQLite writer and Job Object owner; Rust must not become a second coordinator. Memory benefit is unmeasured, and the current Electron utility host cannot run unchanged as a plain Node host. |

Tauri uses a Rust core and a separate webview; Windows uses WebView2. Its use of a system webview does **not** establish lower resident memory for this application. [Tauri process model](https://v2.tauri.app/concept/process-model/)

WebView2 itself has browser, renderer, and helper processes. A process group is associated with a user-data folder and can be shared by multiple application instances. A fair comparison must use a private folder and count the entire group, not just the Rust executable or its immediate children. [Microsoft WebView2 process model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model)

## Boundaries a replacement must preserve

- **Process containment:** [`job.rs`](../../native/windows-supervisor/src/job.rs) uses an unnamed, non-inheritable outer kill-on-close Job Object plus a nested named tracking job. The sole coordinator retains ownership; dormant hosts enter and are verified in both jobs before provider creation. A child retaining a tracking handle must not prevent tree termination. Preserve collision rejection, bounded inspection, and empty-scope verification; never reattach from a PID alone. The current Rust crate is a N-API `cdylib`, not an immediately interchangeable Tauri library.
- **Durable authority:** acquire the single-instance lock before opening the writer or supervising processes. Preserve durable intent before external effects, exact workspace identity and runtime-envelope checks, transactions, leases, and unknown outcomes that never replay automatically. A migration cannot silently reset the SQLite schema, forget pins, or reopen an existing user database with competing writers.
- **Control and terminal data:** Electron currently separates validated intent IPC from ordered MessagePort terminal streams. A replacement must retain bounded queues, resize/input ordering, acknowledgements after xterm writes, backpressure, and responsive stop controls during output floods. Keep terminal transcripts and credentials out of durable coordination records; persist authored mission, handoff, and memory content only through their explicit authorized, bounded contracts. Logs and crash errors remain content-free.
- **Renderer restrictions:** keep local trusted content, isolation, navigation and permission denial, and no generic shell, filesystem, database, or IPC authority. Tauri commands/events are transports, not equivalent authorization. Custom application commands are available to all windows by default unless explicitly scoped through its application manifest; sender, operation, and session authorization still need deliberate enforcement. [Tauri IPC](https://v2.tauri.app/concept/inter-process-communication/), [Tauri capabilities](https://v2.tauri.app/security/capabilities/)
- **UI and lifecycle parity:** reuse of web components does not prove terminal behavior, accessibility, focus restoration, crash recovery, power transitions, or installation behavior. Electron utility-process APIs, preload, fuses, packaging checks, and Electron-specific tests require corresponding replacement evidence. The owner's unsigned distribution policy remains unchanged.

The current ownership and launch sequence are specified in [Feature 001 plan](../../specs/001-local-agent-workspace/plan.md) and implemented by [`bootstrap.ts`](../../apps/desktop/src/main/bootstrap.ts), [`electron-binding.ts`](../../apps/desktop/src/main/ipc/electron-binding.ts), and the [`session host`](../../apps/desktop/src/session-host/index.ts).

## Smallest useful nonshipping spike

Recommend considering a staged, timeboxed spike in an isolated branch or directory, excluded from production builds. Use a distinct application identity, private user-data folder, disposable database, and inert process fixtures. Do not touch an existing installation, provider settings, credentials, or live model sessions.

1. **Measure the shell before porting authority.** Build a release-mode Tauri/WebView2 window with the same 1280×800 visible local document and an explicit renderer-ready marker. Then measure the actual empty-workspace UI with a minimal single coordinator and open disposable SQLite database. Record runtime versions, OS, architecture, artifact hashes, and process membership. Use the existing 60-second measurement procedure over at least three fresh launches, counting every application/WebView2 process and any Node coordinator. Report maximum total working set and median CPU; private bytes are supplementary. Do not trim working sets, hide/minimize the window, disable security, or exclude helper processes to obtain a pass.
2. **Prove ownership before provider integration.** Extract or wrap only the audited Job Object core. Launch dormant fixture hosts and then one ConPTY child tree. Verify assignment before creation, child/grandchild containment, named-job collision rejection, graceful/forced stop, host-crash isolation, and coordinator-crash cleanup while a child retains a named tracking handle. A minimal prototype still needs meaningful evidence that the unnamed outer job remains authoritative.
3. **Exercise the replacement boundary.** Add the narrow validated control channel and bounded terminal stream. Demonstrate output-flood backpressure without starving stop, forbidden renderer requests, single-writer exclusion, and restart without replaying an unknown operation. Extend to four inert sessions for the existing 700 MiB budget. Do not present fixture behavior as live-provider acceptance.

If the blank-shell stage already exceeds 250 MiB, stop before a broad port unless a specific, safe allocation reduction can be demonstrated. If application memory passes but containment or authority fails, the candidate still fails. If both succeed, produce a separately reviewed migration plan covering full persistence compatibility, US8 authority/recovery, Windows x64/ARM64, accessibility, and installed acceptance. **A spike pass neither approves migration nor closes the current Electron release gate.**

The owner subsequently authorized this bounded comparison. The result below informs the next
decision; it does not select Tauri, approve production migration or relax any existing gate.

## 2026-08-31: isolated memory prototype

The owner requested the shell/session-host redesign experiment starting with an isolated memory
prototype. The throwaway executable lives in `native/shell-host-memory-prototype`, outside the
production Cargo/pnpm workspaces and packaging allowlist. It has a distinct application identity,
fresh WebView data for every run, no installer and no live providers. The installed app and owner
database were not changed. No production coordinator or session-host code was edited.

The release build uses Rust 1.98.0, Tauri 2.11.5 and WebView2 151.0.4129.107 on Windows 11 Home
26200 x64, Ryzen 7 5700U (8 cores/16 threads), 33,700,167,680 bytes of physical RAM. The observer
counts all descendants plus the private WebView process group, requires renderer readiness,
settles for 15 seconds and samples twelve approximately five-second windows. The process family
must remain fixed. UI inspection is disconnected throughout every measured run. There is no
working-set trimming or custom graphics/security switch; framework defaults are not a completed
production security assessment.

| Blank local window run | Peak total working set | Median one-core CPU | Processes | Normal exit / residual processes |
| ---------------------- | ---------------------: | ------------------: | --------: | -------------------------------- |
| 1                      |            375.480 MiB |              0.292% |         7 | Exit 0 / none                    |
| 2                      |            375.031 MiB |              0.290% |         7 | Exit 0 / none                    |
| 3                      |            375.445 MiB |              0.148% |         7 | Exit 0 / none                    |

Raw reports: `tmp/shell-host-memory/20260831-122757-blank/run-*/measurement.json`.
Blank executable SHA-256: `44EFB44386997721FF63E00B214D419A4D755930C00F1B1D34B1EFB49FB62419`.
Readiness confirms double-animation-frame rendering. This initial binary did not record the
visible/minimized fields added for the combined prototype; the normal window was also observed
through OS window metadata. The earlier visual-only probe was not a resource sample, and its
late screenshot did not establish visual rendering. The seven counted processes comprise the
Rust coordinator, WebView browser, crashpad, GPU, two utilities and renderer.

**Blank-shell verdict: fails the unchanged 250 MiB gate on all three fresh launches.** The
approximately 125 MiB overage exists before adding production authority, terminal streams or
providers. This is a result for this build/runtime/machine, not a universal WebView2 floor. It
does not justify a broad port. The only further work in this spike is a bounded measurement of
the existing empty-workspace UI, scratch SQLite connection and four dormant native hosts.

The combined release executable reuses the actual React empty-workspace renderer with a
read-only mock bridge, opens one scratch SQLite connection containing a prototype-only row,
and starts four copies of itself in dormant native-host mode. A separate visual smoke confirmed
the rendered workspace, NONSHIPPING title and PROTOTYPE footer. Its normal shutdown returned
exit zero. That inspection run is excluded from the following measurements.

| Workspace + scratch SQLite + four dormant native hosts | Peak total working set | Four hosts at peak | Median one-core CPU | Processes |
| ------------------------------------------------------ | ---------------------: | -----------------: | ------------------: | --------: |
| Run 1                                                  |            431.063 MiB |         34.832 MiB |                  0% |        11 |
| Run 2                                                  |            435.813 MiB |         34.848 MiB |              0.291% |        11 |
| Run 3                                                  |            429.637 MiB |         34.844 MiB |              0.145% |        11 |

Each measured window lasted approximately 64 seconds, retained the same process identities,
recorded a visible/non-minimized rendered window and ended with exit zero and no residual
prototype processes. Raw reports: `tmp/shell-host-memory/20260831-123948-hosts/run-*/measurement.json`.
Combined executable SHA-256: `8F657F70BB9DE23BED173BF8DD10E03E26C0448B2978B95643844A15612BF7BC`.
The actual prototype WebView executable version was independently checked as 151.0.4129.107.
[Durable results](../../native/shell-host-memory-prototype/results.json) retain all six summaries,
per-role working sets at each peak, artifact/report hashes and raw-report locations.

The coordinator owns four independent pairs of unnamed kill-on-close and named tracking jobs.
Startup rejects name collisions and verifies both-job membership while each host blocks on a
private input pipe. Shutdown verifies each host exits normally and each job becomes empty.
The borrowed core was compared against source: only the tracking-name prefix changed, while
`error.rs` is byte-identical. This is **dormant-host evidence only**: no provider/ConPTY child or
grandchild was created. Crash cleanup, retained tracking handles, host-crash isolation, output
backpressure, validated controls, persistence compatibility and restart/unknown-outcome handling
remain unimplemented and unproved in this replacement.

**Decision:** do not select Tauri or begin a broad authority/UI port. The blank-shell gate failed
consistently. Four native dormant processes cost approximately 34.8 MiB here, versus 474.9 MiB
for the earlier installed Electron host group, but those workloads are not equivalent: the
native prototype has no terminal or production protocol. This is a reason for a separate bounded
native-host/ConPTY experiment, not a demonstrated 440 MiB production saving. Host replacement
alone would still not solve the previously observed 700 MiB aggregate failure. Combining these
prototype numbers with the earlier provider footprint would be an estimate, not acceptance.

The prototype's sub-700 MiB total excludes all live providers and helpers and therefore does not
close P04. Existing preview deferrals, exact-candidate acceptance, production host restrictions,
unsigned distribution policy and private-persona exclusion remain unchanged. No production
source, dependency lockfile, installer or owner data was changed. The isolated release build,
visual smoke, six resource observations, Rust formatting, PowerShell syntax and focused artifact
checks were performed; the production unit/E2E/hosted suites were not rerun. Preserve the isolated
code for review/reproduction, then archive or delete it rather than shipping it.
