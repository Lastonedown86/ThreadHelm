# T173 candidate follow-up

2026-08-31. Work follows the owner-approved order: clear stale stop status, diagnose the
keyboard-selection failure, then repeat resource evidence on the changed candidate.

## Renderer fixes and regression evidence

- `ControlBar` previously survived selected-session changes, so the previous target's pending
  stop text appeared beside another target. Keying the bar by session identity also discards
  its target-bound dialog state. Observed stopped/failed/recovery-required lifecycle states now
  clear pending status. Stop and force-stop confirmations, disabled controls and main authority
  remain unchanged.
- `TerminalPane` unconditionally focused xterm each time selection mounted a different terminal.
  A local regression reproduced focus leaving the Sessions list after Home changed selection;
  the next navigation key could therefore go to the terminal. Mount now preserves an already
  focused list, dialog or other control. A fresh launch with no focused control still focuses
  the terminal; F6 remains the keyboard exit.
- The old candidate failed the new cross-session stop-status assertion. The focused list
  regression failed with the list no longer focused after the new terminal's output was visible.
  This establishes a shared app bug relevant to the historical ARM64 failure, not definitive
  attribution of that historical execution. No timeout, retry or focus assertion was weakened.
- After the fixes: 16 affected E2E journeys passed, then the complete 43-case E2E suite passed.
  Five repetitions each of multi-session keyboard/input routing and the original keyboard handoff
  flow passed (10/10). Type checking, focused ESLint, formatting and diff checks passed. These are
  local Windows x64 results; the existing ARM64 hosted failure is not retroactively green.

## Candidate and measurement boundary

The source is based on `3c574fb19db4ea0a1af2fdffc8b8c1ee8ced3e56` plus three renderer-file changes.
Final per-file hashes are retained in `tmp/us8/t173-final-renderer-source.json`; this is a worktree candidate,
not a new committed or hosted revision. Forge/NSIS builds the ordinary unsigned x64 package with
production fuses, native architecture checks and private-persona exclusion. No host/native
authority, resource limit, test hook or security flag is changed.

Resource testing uses that packaged executable with an isolated profile and inert fixture PATH.
It does not replace the owner installation. Reports explicitly distinguish `packaged-x64` from
`installed-x64`; installer/manual acceptance remains separate. The finite normal-output workload
is identical for every launch: 60 bounded lines spaced 100 ms apart, followed by input idle.
Resource windows start after that burst; peaks are sampled steady-window peaks, not maxima over
all launch/stop transitions. The full app/host/fixture/console family is counted.

The initial (superseded) package's EXE SHA-256 is
`6197c2045f1d1179885f1a5d63b818f6a026210c2682739ebe66726dd221f365`, ASAR SHA-256 is
`c56567b3997e45405aed49174c1b340c878183cb3b5443d8ff709e47d8154265`, and Setup SHA-256 is
`fa4bc9b8f962fefff1970176aa0c8fd80833d14b85fa93c05d5257a2e7cfc062`.
EXE/ASAR identity matches the completed NSIS sidecar; Setup matches its checksum sidecar.
Six selected static artifact cases passed (the launch case was excluded and the absent
adjacent EXE checksum subcheck was skipped). The uninstaller helper hash is unchanged.
All 647 unit/contract cases also passed under Node 22.

## Resource-run authorization boundary

The prepared profile is `tmp/us8/t173-fixtures-274695431f2f4cd8b38852995d66ec85`.
Windows Computer Use rejected the first **Approve folder** action because the dialog grants
a working directory without confining the process to it and the gate did not consider the
general testing request sufficient authorization. The action was not bypassed; the dialog
was cancelled. No workspace was approved and no session started. Explicit authorization was
requested for the verified inert fixture, four exact scratch folders, manual permission and
eight-process bound. Real Codex/provider runs are not covered by this fixture request.

The initial no-session observation was deliberately interrupted after review found that a prior
interrupt result could reappear after a subsequent stop. A new regression reproduced that exact
stale result. The fix separates new interrupt outcomes from lifecycle clearing and suppresses
obsolete interactive/unresponsive outcomes after a session stops. The initial package and its
interrupted observation are not final-candidate resource evidence. Its isolated app closed
normally with no remaining packaged-app processes; the owner installation is unchanged.

After the final interrupt/stop edge-case correction, all 16 affected E2E journeys passed again,
including the extended regression, and type checking/focused lint passed again. The earlier
43-case full suite, ten focus repetitions and 647 unit/contract results predate this final
ControlBar-only refinement. Final no-session and five-cycle results are recorded below.

Independent read-only review of the three renderer files and two E2E files found no actionable
defects after the final refinement. It verified main event ordering and the preserved focus,
input-routing and disclosure boundaries, without running tests or processes. That bounded
renderer review does not close the broader P03 safety/scope review or owner host-scope decision.

## Final packaged candidate

The rebuilt final package passed the same six selected static artifact cases, with the same
explicit launch/checksum-subcheck exclusions. Its EXE/ASAR identity matches the completed NSIS
build record and Setup matches the checksum sidecar:

- EXE: `5b2acf93baeadae29c3cad4a500f38d2cec9fc885a724cf35d9e45ea820fc358`
- ASAR: `5aae9bd88cefeb3d0054eab7247d36ad16ce209573ac3f2f326196c77c2e26fe`
- Setup: `56bece9651851b668d9efc2689f2aadda566bbb13ddc7d896c6d825b5d290f97`

The fresh no-session observation uses profile
`tmp/us8/t173-fixtures-6fe5e0a6ad684ce9998e8e134f14a0a2`, with no approved workspace/session.
The earlier authorization question names four scratch workspace folders under the original
`t173-fixtures-274695431f2f4cd8b38852995d66ec85` directory; those still exist, and a fresh
profile does not itself approve them or change that requested scope. No real provider run
is authorized by this question. The new profile has only been opened for no-session observation.

## Final no-session observation and cleanup

The final candidate completed 180 five-second sampling windows from 15:51:44 to 16:07:33 EDT
on 2026-08-31: **949.420 seconds (15m49s)**. All four app process identities remained unchanged.
Median one-core CPU was **0%**; all fifteen approximately one-minute blocks met the retained
1% median CPU limit. Aggregate working set peaked at **381.797 MiB**, changing from 381.797
to 381.258 MiB. Private committed memory changed from **231.059 to 226.371 MiB**, with no
increase above the starting value. This passes the observed idle CPU criterion; it still
fails the original 250 MiB optimization target, deferred for preview by D01.

The window was visible at the start and end; visibility/minimization was not continuously
verified. UI inspection was disconnected for sampling. No session or workspace was approved
in this profile. Normal window close then removed all four recorded candidate processes.
The owner's original PID 39356 remained running, and its installed EXE/ASAR hashes were unchanged.

[Structured evidence](t173-candidate-follow-up.json) includes exact source/artifact identities,
hardware, test counts, minute blocks, process identities, cleanup and raw-report hashes.
Raw profiles remain local under ignored `tmp/us8`; they must not be uploaded as general logs.

The five-cycle series was explicitly approved and completed on the unchanged candidate. Active-cycle
median one-core CPU was **0.88%, 1.03%, 0.44%, 1.76%, and 1.47%**; three of five cycles failed the
1% limit. Removing the first launch-adjacent sample from attribution leaves approximate aggregate
means of 0.96%, 0.91%, 0.61%, 1.55%, and 1.71%, so the last two misses are not a median-only launch
artifact. CPU-time deltas place the sustained work mainly in the Electron renderer and GPU
processes, with occasional Electron utility/session-host increments; inert fixture and console
processes were effectively idle. This attribution does not yet identify a safe production change.

Active peak working set was **993, 991, 935, 942, and 937 MiB**, above the deferred 700 MiB target.
Post-stop working set was **473, 471, 424, 427, and 430 MiB**, with every cycle's 12 session-owned
processes gone and all 20 sessions stopped cleanly with exit code 0. The series does not show
accumulating working-set growth. T173 is complete as evidence, but its CPU verdict is a P04 failure;
T174 carries the remediation and exact-candidate rerun.

The isolated candidate closed normally and the owner installation remained running unchanged.
This evidence does not establish low-memory support, P04 acceptance, new hosted CI or installed
acceptance. The app remains unsigned x64 with private Marvel personas excluded. No reinstall,
merge, distribution, host-scope approval or feature-selector transition occurred.
