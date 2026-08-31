# T173 installed-resource checkpoint

2026-08-31. **Partial evidence, not preview acceptance.** Extended idle and an isolated
four-session pilot are complete. The full five-cycle series, accumulating-growth assessment
and broader retained P01/P04 workflows remain open. The pilot instance was closed normally;
the next repeated series must use one fresh coordinator for all five cycles.

The [candidate follow-up](t173-candidate-follow-up.md) records the subsequent renderer fixes,
new package and separate resource progress. This file preserves the earlier installed pilot;
its measurements are not relabelled as measurements of the changed candidate.

## Candidate and method

The unchanged installed x64 runtime is `0745294c08ed5bb618eb078fbb791dfbe4eac0ad`, Electron
44.0.0. Current source head `3c574fb19db4ea0a1af2fdffc8b8c1ee8ced3e56` differs only in
documentation. Installed EXE and ASAR matched the local build identity sidecar before testing.
Their hashes, complete measurement summaries and raw-report hashes are retained in
[the structured evidence](t173-resource-checkpoint.json).

The host is Windows 11 Home 26200 x64, Ryzen 7 5700U, 8 cores/16 threads, with
33,700,167,680 bytes physical RAM. No low-memory support claim follows from this machine.
The read-only observer counts all recursive app descendants and verifies stable PID/creation
identities, renderer presence and expected session-host/provider membership. Private commit
supplements aggregate working set; neither is presented as unique physical RAM consumption.
No working-set trimming, custom graphics switch or security/accessibility change was applied.
Computer Use was disconnected during every resource observation. The owner app remained open.

## Completed observations

| Scenario | Duration | Processes | Peak aggregate working set | Median one-core CPU | Final private commit |
| --- | ---: | ---: | ---: | ---: | ---: |
| Owner instance, no sessions | 957.481 s | 4 | 347.863 MiB | 0% | 256.730 MiB |
| Fixture profile, warmed pre-cycle baseline | short diagnostic | 4 | 567.988 MiB | 0% | 300.105 MiB |
| Four concurrent inert sessions, pilot | short diagnostic | 16 | 1,079.375 MiB | 0.331% | 479.609 MiB |
| After all four normal stops | short diagnostic | 4 | 571.844 MiB | 0% | 311.043 MiB |
| Later settled no-session observation | 63.984 s | 4 | 581.766 MiB | 0.148% | 311.035 MiB |

The long idle run lasted from 13:09:26 to 13:25:24 EDT. Private commit changed from
256.680 to 256.730 MiB; every one-minute block had median CPU below 0.586%. Read-only
static artifact checks ran separately during this interval. No UI inspection or app mutation
occurred during the observation. Window metadata was present, but visibility/minimization was
not continuously verified; this is not full scenario acceptance.

The pilot profile used the exact installed EXE with private user-data, APPDATA, LOCALAPPDATA,
USERPROFILE and temporary directories. Its cleared environment exposes only the Rust fixture
and Windows System32 through PATH. Each session used a distinct approved scratch folder,
manual permission, CLI-default model/effort and an explicitly reviewed eight-process bound.
The fixture's version/login responses simulate adapter readiness only: no real account, model,
provider configuration, tools or network are involved. Normal launch and stop controls exercised
the real coordinator, writer, session hosts and ConPTY. The ordinary write lease rejected a
duplicate same-folder launch. A preliminary single-session smoke is excluded from the pilot.

All four pilot sessions recorded clean stops with exit code 0. OS observation confirmed all
12 session-owned processes were gone: four hosts, four fixture roots and four console helpers.
Only the original four app processes remained. Normal final close removed the complete pilot
family; the owner's original app process was still running. The pilot's final private commit
is approximately 10.93 MiB above its pre-cycle baseline. This single difference does not
establish a leak or rule one out; repeated cycles remain necessary.

The short cycle observations do not meet the 60-second CPU criterion and leave its verdict
null. Peaks cover sampled steady windows only, not every launch/stop transition. UI inspection
occurred between samples and may affect retained allocations; these values must not be equated
with the separate uninspected owner-instance baseline. Both historical 250/700 MiB target failures
remain failures under the accepted D01/D05 preview deferrals. No replacement ceiling was invented.

## Additional controls and findings

- Fresh installed static selection: six cases passed, one launch/native-loading case was
  excluded. Production fuses, unsigned policy, native architecture, packaged ASAR and private
  persona exclusion passed. The adjacent installed-EXE checksum subcheck was internally skipped
  because no sidecar exists there; EXE/ASAR identity was independently matched to the build record.
- PR17 remains draft, review-required and blocked at the inspected head. x64 CI, CodeQL and
  x64/ARM64 installed acceptance passed. ARM64 CI run `33409084796`, job `99543863437`, failed
  one keyboard session-selection E2E assertion (41 passed). Cause is not established; ARM64
  remains diagnostic, and this is not an all-checks-green claim.
- ControlBar retains the last "Stop requested" text after a clean stop and when selecting a
  different session. Fresh UI state still reports the correct Stopped lifecycle with disabled
  Stop/Force stop controls. Record this as a display follow-up; do not mistake it for a live
  residual process. No renderer change was made in this checkpoint.
- Fixture setup initially used a working directory that caused trusted executable discovery
  to exclude the fixture, correctly failing closed. The launcher now uses its private user-data
  directory as cwd. It also creates a scratch Desktop to avoid the native picker warning.
  The observer now normalizes slash spelling before exact fixture-path comparison.

## Next retained work

Run the complete five-cycle series with one coordinator and a consistent normal-output workload,
capture per-cycle peaks/settled memory and all cleanup identities, and investigate repeatable
growth. Resolve the display follow-up and diagnose the remaining ARM64 keyboard CI failure
without weakening focus or containment assertions. Complete applicable installed/manual P01/P04
workflows, then independent review and owner acceptance. The separate P03 host-scope exception
remains unapproved. No merge, reinstall, release, live-provider start or feature-selector change
was performed. Private Marvel personas remain excluded and the app remains unsigned x64.
