# Installed idle resource observation

`measure-installed-idle.ps1` is a read-only Windows observer for the normal owner-installed
unsigned x64 app. It does not install, launch, stop, send input, change accessibility settings,
or bypass the disposable-runner guards of the separate installer acceptance suite.

1. Verify the installed candidate identity and record its runtime commit. Keep the app visible.
2. For the no-session run, stop all sessions normally. For the four-session run, obtain provider
   authorization first, launch through the normal reviewed controls, and record the four native
   Codex PIDs. A folder-trust prompt is startup-idle evidence, not provider-ready mission proof.
3. Finish UI inspection and **disconnect the UI automation client** before sampling. For the
   Codex Computer Use client, reset its JavaScript kernel after the last screenshot. Merely
   refraining from further calls did not eliminate the observed accessibility/COM overhead.
   Do not disable app accessibility, screen readers, graphics, security, or containment.
4. Stop profilers, allow startup helpers to settle, and run the observer. Do not reconnect UI
   inspection until it finishes. If the process family changes, discard that attempt and rerun
   after investigating; no acceptance verdict is produced for a changing family.

```powershell
# Substitute the verified main PID and source commit; omit CodexProcessIds for no sessions.
& tests/acceptance/helpers/measure-installed-idle.ps1 `
  -RootProcessId 1234 -RuntimeCommit '<verified runtime commit>' `
  -ReportPath tmp/us8/no-session-idle.json

# Substitute the four authorized native Codex PIDs.
& tests/acceptance/helpers/measure-installed-idle.ps1 `
  -RootProcessId 1234 -CodexProcessIds 2345,3456,4567,5678 `
  -RuntimeCommit '<verified runtime commit>' -ReportPath tmp/us8/four-session-idle.json
```

The observer records twelve approximately five-second windows by default, the median CPU percentage of
one core, and peak aggregate working set. It recursively includes the main process and every
descendant, including providers and terminal helpers. It rejects unexpected executable identity,
provider/host counts, missing renderer, PID reuse, and changing membership. The report stores
process identity and resource numbers, not command lines, terminal text, or credentials.
The caller-supplied runtime commit is provenance, not a substitute for verifying installed bytes;
the executable SHA-256 is captured independently. Review JSON booleans: completion of the script
does not mean the budgets passed.

Use `-WindowCount 180` for T173's extended no-session idle observation (at least 15 minutes).
The default remains 12; accepted counts are 12 through 180. The report includes elapsed time,
the installed ASAR digest and supplementary private committed memory (`PrivatePageCount`), which
is not private resident memory or unique physical RAM. No inspection reconnect is needed to
read the observer's progress. A whole-run median does not replace reviewing the individual
one-minute blocks when assessing the retained 60-second CPU criterion.

The observer still reports the original 1% CPU, 250 MiB no-session and 700 MiB four-session
thresholds. Feature 002 D01/D05 defer the fixed aggregate memory ceilings for preview; the JSON
memory booleans remain comparisons against the original optimization targets, not preview
acceptance verdicts. CPU, bounded resources and complete reporting remain required. No exclusions,
working-set trimming, or changes to the reported thresholds are permitted.

On 2026-08-31, disconnecting inspection changed the unchanged installed app from a 39.0625%
five-second main-process CPU observation to 0%. Reconnecting restored the spike. A subsequent
uninspected four-session run at runtime `0745294` measured **0.588% median CPU** and
**1,427.305 MiB peak working set** across all sixteen processes over 63.83 seconds. CPU passed;
memory failed. This corrects the attribution of the earlier 17.464% observation, not the memory
failure or any independent release gate. Raw reports remain local under `tmp/us8/`.
