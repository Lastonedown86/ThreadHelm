# Isolated installed terminal fixtures (T173)

This procedure uses the unmodified installed executable and its real renderer, coordinator,
SQLite writer, Electron session hosts, ConPTY and normal launch/stop controls. It does not use
Playwright's Node inspector, enable test hooks, alter fuses or patch an installed ASAR.

`prepare-installed-fixtures.ps1` compiles `inert-terminal-fixture.rs` into a fresh directory named
`t173-fixture-bin`. Its executable is named `codex.exe` solely so the existing adapter can discover
a controlled fixture. Its version and login-status responses are **simulated test inputs**, not
evidence of a Codex installation, account, authentication or autonomous-provider capability.
The fixture refuses automatic/bypass launch arguments and runs only in one of four specifically
named scratch workspaces. It supports bounded echo output and `/quit`; it reads no provider
configuration, starts no tools/children and implements no network access.

The launcher clears inherited environment variables, gives the child private APPDATA,
LOCALAPPDATA, USERPROFILE and temporary directories, and limits PATH to the fixture binary and
Windows System32. This prevents the app from discovering the owner's installed providers through
its supported search roots. A separate `--user-data-dir` prevents owner SQLite/configuration
access. Verify both isolation and the selected executable path before confirming any session.
Use CLI-default model/effort and manual permission only. No real provider fallback is allowed.
Review an explicit eight-process allowance for these fixtures; the default of one is not a
claim that console/bridge helpers are free. Approve each of the four workspaces separately:
the normal write lease correctly rejects concurrent write-capable launches in one folder.

From the repository root:

```powershell
# Prepare without starting a window, e.g. while the owner-instance idle observer is running.
& tests/acceptance/helpers/prepare-installed-fixtures.ps1 -PrepareOnly

# After that observation completes, use the exact returned directory.
& tests/acceptance/helpers/prepare-installed-fixtures.ps1 -PreparedRoot '<prepared absolute directory>'
```

The prepared directory has binary hashes and private workspaces. Reuse rejects an already-launched
profile and changed executable/ASAR/fixture bytes. The script does not install, uninstall, delete
data, grant permissions or submit UI actions. Keep scratch files local; the app may create transient
session credentials there, so do not upload the profile or raw logs.

To measure a changed candidate without replacing the owner installation, pass `-PackagedCandidate`
to both preparation/launch and the resource observer. This selects only the repository's fixed
`apps/desktop/release/ThreadHelm-win32-x64/ThreadHelm.exe` path and records `packaged-x64` in each
report. Build through Forge with production fuses and match EXE/ASAR hashes to the NSIS identity
sidecar first. This is packaged resource evidence, not installation/uninstallation acceptance.
Each fixture emits the same finite 60-line, six-second output burst before waiting for input.

`measure-fixture-phase.ps1` combines the read-only lifecycle and resource collectors. Pass the
exact `-RunRoot`, a Node 22 `-NodeExecutable`, source provenance in `-RuntimeCommit`, and
`-Phase baseline`, `cycle-1-active`, `cycle-1-stopped` through cycle 5, then `final`.
Use `-WindowCount 180` for the final no-session 15-minute observation. Every other phase defaults
to twelve five-second windows. It rejects candidate changes, wrong live counts, non-clean stops,
any surviving cycle-owned process and a no-session family that differs from baseline. Its
resource observations begin after launch/output/stop UI actions; reported peaks are steady-window
sample peaks, not continuous maxima covering those transitions.

Exercise five cycles of four concurrent sessions through the normal UI. Start the memory baseline
after warmup; for each cycle record four live host/fixture identities and a complete resource
snapshot, then stop each session normally and verify all twelve host/fixture/ConPTY processes
are gone. Record settled app memory after each cycle. Disconnect the Computer Use client before
resource sampling; UI-action windows are not idle CPU evidence.

The observer accepts `-FixtureExecutablePath '<exact fixture path>'` with the four fixture PIDs
in its legacy `-CodexProcessIds` parameter. The fixture path is verified and hashed, and the report
explicitly marks `FixtureSimulation`. A cycle snapshot may use `-SampleIntervalSeconds 2` with
12 windows; observations shorter than 60 seconds leave `CpuBudgetPassed` null and do not replace
the retained 60-second CPU criterion. The 15-minute owner-instance run supplies separate idle
CPU evidence. Report both working set and private commit without conflating them.

Use `capture-fixture-state.mjs <root> <phase>` under Node 22 for a read-only lifecycle snapshot.
The collector omits authored content and verifies resolved provider paths against the fixture.
Retain one coordinator across all five cycles; a preliminary smoke/pilot is not the repeated
series. Record sampled peaks as sampled peaks, not continuous maxima during UI-driven launches.
Confirm terminal-session cleanup independently of status text. The earlier installed candidate
retained stale "Stop requested" text; the renderer follow-up clears it on completion/selection.

Do not claim real-provider performance, authentication, mission capability, or overall installed
acceptance from fixture results. No full release or owner data changes are authorized here.
