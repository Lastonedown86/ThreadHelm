# Installing and launching ThreadHelm

## Supported platform

The approved preview target is **Windows 11 x64** within Microsoft's support lifecycle. ARM64
distribution is deferred even though its implementation and CI validation remain. Windows 10,
Windows Server and 32-bit systems are outside the client acceptance matrix. A preview may claim
only the Windows releases and workflows its acceptance run actually exercised; Windows Server
CI does not supply Windows 11 x64 installed acceptance.

The preview installer is not yet approved for distribution. See the
[approved scope, deferrals and retained checklist](../specs/002-agent-mailbox-routing/preview-release.md).

## Getting the installer

Once the retained acceptance gates pass and the owner approves distribution, the preview may
publish only `ThreadHelm-Setup-x64.exe` and its `.sha256`. Do not publish ARM64 CI artifacts as
preview downloads. Restoring ARM64 distribution requires its acceptance and a separate scope decision.

ThreadHelm is distributed **unsigned**. The installer does not establish a trusted publisher, and
Windows may display an unknown-publisher or reputation warning. Download only from the project's
release page and compare the checksum with that release's published value. A matching checksum
confirms the downloaded bytes match the published artifact; it does not replace publisher signing.

Verify before running:

```powershell
Get-FileHash .\ThreadHelm-Setup-x64.exe -Algorithm SHA256   # compare with the published .sha256
Get-AuthenticodeSignature .\ThreadHelm-Setup-x64.exe        # NotSigned is expected for unsigned releases
```

Reject an invalid signature such as `HashMismatch` or `NotTrusted`; it is not the same as an unsigned
file. A future signed artifact may report `Valid`, but signing is not required by this release policy.

ThreadHelm has no automatic updater. The About area links to the releases page; download a
newer version deliberately and verify it the same way.

The candidate uses a per-user NSIS installer at `%LOCALAPPDATA%\Programs\ThreadHelm`.
It does not require elevation or launch the app after setup. Uninstall through Windows Installed
apps; personal workspace/history data is retained. Migration from earlier development Squirrel
installations is not verified: do not install over, silently remove, or advertise an upgrade from
one. Fresh install and normal uninstall must pass before this candidate is distributed.

## Preview limitations

The owner deferred the 250 MiB idle-memory target for this preview; the latest local packaged
x64 observation is 380.324 MiB. This is a disclosed limitation, not a passing performance result.
Other CPU/resource bounds and safety checks remain required. Full US8 autonomous-provider mission
readiness is not claimed; unavailable Claude auto permission remains held, with no bypass fallback.
Private Marvel personas are never bundled. These scope deferrals do not waive installer cleanup,
Windows 11 x64 installed acceptance, independent review or owner acceptance.

A final mission-worker result ends that worker's bounded process scope. Main persists the result
and routes it to the supervisor; it cannot guarantee that the terminated worker receives a final
acknowledgement. Unknown effects remain held for inspection, even after the process stops.
Reusable worker sessions require a separately verified idle transition and are not assumed here.

## Prerequisites for launching agents

ThreadHelm launches agent tools you install and authenticate yourself:

- **Codex CLI** — installed and signed in with its own tooling.
- **Claude Code** — installed and signed in with its own tooling.

ThreadHelm searches trusted install locations (per-user program folders, npm global shims, and
absolute `PATH` entries) but never the selected workspace or the current directory. It prefers a
native `.exe` over `.cmd` shims. Versions outside the tested range are reported as unsupported
rather than launched.

## First launch

1. **Choose a folder.** Only folders on fixed local drives are accepted; network, removable, UNC,
   and device paths are rejected. The disclosure shows the path you picked and the effective path
   ThreadHelm resolved from the opened directory (they differ for junctions and links).
2. **Approve it.** Approval is per folder identity; two spellings of the same folder are one
   approval.
3. **Check readiness.** Each provider shows available / missing / unsupported / unauthenticated /
   error, its version, and a short explanation. Nothing from the probe output itself is stored.
4. **Launch.** The launch disclosure repeats the effective path, agent, version, and the boundary
   warning — ThreadHelm cannot confine the agent to the folder; it only starts it there. Tick the
   confirmation for this session and launch. The confirmation is never remembered.
5. **Work.** Type into the selected session's terminal. Switch sessions in the list (arrow keys);
   "new output" marks sessions that produced output while unselected.
6. **Interrupt / Stop / Force stop.** Interrupt sends Ctrl+C and reports whether the agent exited,
   acknowledged the interrupt, or did not respond. Stop asks the agent to exit cleanly and waits a
   bounded grace period; if it does not, Force stop becomes available and requires its own
   confirmation because it terminates every process in the session immediately.
7. **Close.** With sessions active, closing is blocked until you cancel or stop them all.

## After a restart

Sessions that were unfinished when ThreadHelm last ran appear under _Recovery_ as _recovery
required_ with a classification (interrupted start, unexpected shutdown, incomplete stop). Dismiss
the record or start a new session; ThreadHelm never relaunches an agent or replays input.

## Where data lives

`%APPDATA%\ThreadHelm\` holds `threadhelm.sqlite` (workspace approvals, sanitized session history,
recovery records) and `logs\threadhelm.log` (structured, secret-free lifecycle events). Terminal
content is memory-only and vanishes when a session or the app ends. A corrupt database is preserved
as `threadhelm.sqlite.preserved-<timestamp>` next to a fresh one — never silently discarded.
