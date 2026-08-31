# NONSHIPPING shell/session-host memory prototype

Question: can a Rust/WebView2 desktop and small native session hosts substantially reduce
ThreadHelm's measured aggregate working set without changing the installed app or process
containment? This is a throwaway architecture measurement, not a UI proposal or migration.

The first stage is a visible 1280×800 local document with explicit renderer readiness. Its data
directory is private to each run. No live providers, owner databases, credentials, network UI,
generic frontend commands, installer, or production coordinator/provider imports are permitted. The blank stage must
be measured before adding coordinator/session responsibilities. The harness includes every
WebView2 process, even if reparented, and does not trim memory or add graphics/security switches.

This directory is not a member of the production Rust crate or pnpm workspace. Do not distribute
the executable. Keep the findings in the architectural assessment; archive or delete the runnable
prototype after the comparison and review are complete.

From the repository root with its existing Node dependencies, Rust/MSVC and WebView2 installed:

```powershell
& ./native/shell-host-memory-prototype/run.ps1 -Mode hosts
```

The command builds the local UI and release executable, then runs three fresh observations.
Use `-Mode blank` for a plain local document or `-Mode workspace` for the real empty-workspace
React renderer with a read-only mock bridge and one disposable SQLite connection. `hosts` adds
four dormant native processes; they are not displayed as sessions and never start a provider,
terminal, ConPTY helper, or child tree. `-SkipBuild` reuses the existing executable.

The runner records a readiness marker, requires a visible/non-minimized window, settles for
15 seconds, then samples the complete fixed process family twelve times over about 60 seconds.
It sends STOP, requires exit zero and verifies that no prototype processes remain. Reports and
private WebView data are under `tmp/shell-host-memory/`; no owner database is opened.

The four native processes use a separately named copy of the audited Job Object core. The
coordinator verifies containment while each host blocks on its private input pipe, rejects a
tracking-job name collision, and checks empty jobs on normal shutdown. This does **not** prove
Job-before-provider creation, descendant containment, crash cleanup, output backpressure,
single-writer compatibility or durable recovery. Those broader stages are deliberately deferred
if the blank shell already fails the unchanged memory budget.

Budget booleans compare the measured prototype footprint only. Even a result below 700 MiB in
`hosts` mode cannot establish four-provider production acceptance. Tauri/WebView2 defaults also
require an independent security review before any production adoption.
