# Installing and launching ThreadHelm

## Supported platform

Windows 11 client releases within Microsoft's support lifecycle, x64 and ARM64. Windows 10,
Windows Server, and 32-bit systems are outside the acceptance matrix. A release may claim only the
architectures and Windows releases its acceptance run actually exercised (see the acceptance report
that ships with each release; the MVP run is recorded in
`specs/001-local-agent-workspace/validation-report.md`).

## Getting the installer

Releases publish per-user Squirrel installers (`ThreadHelm-Setup-x64.exe`, and `-arm64` when
ARM64 hardware has been validated) together with a `.sha256` file for each artifact.

Verify before running:

```powershell
Get-FileHash .\ThreadHelm-Setup-x64.exe -Algorithm SHA256   # compare with the published .sha256
Get-AuthenticodeSignature .\ThreadHelm-Setup-x64.exe        # Status should be Valid
```

ThreadHelm has no automatic updater. The About area links to the signed releases page; download a
newer version deliberately and verify it the same way.

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
