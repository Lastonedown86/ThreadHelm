# Quickstart and Validation: ThreadHelm Local Agent Workspace MVP

**Status**: Planning contract. The commands below become available as their implementation tasks
land; this document does not imply that the application is already scaffolded.

## Prerequisites

- A currently supported Windows 11 client release on x64 or ARM64.
- Node.js 24 and pnpm 11 for development tooling.
- Rust 1.98 with the MSVC target.
- Visual Studio 2022 Build Tools with Desktop development with C++ and a current Windows SDK.
- Optional for real-provider smoke tests only: supported Codex CLI and/or Claude Code installations
  already authenticated by their own tools. Unit, contract, integration, and most end-to-end tests
  use deterministic fixture agents and require no provider credentials.

Do not place provider credentials, tokens, account output, or terminal transcripts in `.env` files,
test fixtures, screenshots, logs, or issue attachments.

## Planned developer workflow

From the repository root in PowerShell:

```powershell
pnpm install --frozen-lockfile
pnpm native:build
pnpm dev
```

The development window must still enforce the renderer sandbox, typed preload boundary, workspace
approval, provider recheck, one-writer rule, and Job Object containment used by packaged builds.
Development-only bypasses for these controls are prohibited.

## Planned quality gates

Run the fast static and deterministic suites first:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:contract
pnpm native:test
```

Then run Windows and desktop behavior suites:

```powershell
pnpm test:integration:windows
pnpm test:e2e
```

Package and validate the actual installed artifact:

```powershell
pnpm package:win
pnpm test:acceptance:installed --artifact <absolute-installer-path>
```

The final acceptance report records exact git commit, application version, architecture, Windows
edition/release/build, installer hash, signing identity, and each executed scenario. A development
pass is not a packaged-build pass, and a packaged x64 pass is not ARM64 evidence.

## Architecture proof gate

Before broad UI implementation, run the packaged supervision proof:

```powershell
pnpm proof:windows-supervision
```

The proof must demonstrate all of the following:

1. Electron main creates a kill-on-close Job Object.
2. A dormant utility process starts without creating provider descendants.
3. Main assigns the utility PID and verifies Job Object membership.
4. Only then does the utility create a fixture agent through node-pty/ConPTY.
5. Child and grandchild fixture processes remain in the supervised process scope.
6. Clean stop, force stop, utility crash, and main crash leave no fixture descendant alive.
7. The behavior holds in a packaged build for each claimed architecture.

If assignment or cleanup cannot be proven reliably, stop Electron feature implementation and
reassess a Tauri/Rust shell. Do not weaken the process-tree guarantee.

## Manual MVP validation scenarios

### 1. Workspace approval and launch

- Choose a fixed local directory through the native picker, including a case with spaces and Unicode.
- Confirm the UI shows its effective canonical path and access-boundary disclosure.
- Approve it, select an available provider, and inspect the fresh readiness/version/auth summary.
- Confirm per-session disclosure because ThreadHelm cannot guarantee the provider stays inside the
  workspace; then launch and verify the provider starts with that effective directory as cwd.
- Replace, rename, reparse, or revoke the directory between preview and launch and confirm launch is
  blocked as stale.
- Confirm UNC, network, removable, and ambiguous junction/symlink targets fail closed in the MVP.

### 2. Provider readiness

- Test Codex CLI and Claude Code independently in available, missing, unsupported, unauthenticated,
  timeout, and immediate-exit cases.
- Confirm one provider's failure does not change another provider or running session.
- Inspect logs/database and confirm raw auth/version probe output and account metadata are absent.
- Change the executable or version after launch preview and confirm ThreadHelm requires a new review.

### 3. Multiple sessions and one-writer policy

- Launch four fixture sessions in four approved effective workspaces.
- Send distinct input and simultaneous output; verify identity, selection, input, output, resize, and
  unread indicators never cross session boundaries.
- Select a path alias to an already-active workspace and confirm a second write-capable launch is
  blocked based on file identity, with guidance to use another directory/worktree.
- Fail one fixture host and verify the other three remain interactive.

### 4. Terminal confinement and pressure

- Emit malformed UTF-8, binary-like bytes, ANSI/OSC control sequences, hyperlink, clipboard,
  window-title, and file-operation requests. Confirm they cannot affect clipboard, filesystem,
  browser, another application, or the operating system.
- Burst output while resizing and switching sessions. Confirm ordered rendering, explicit
  backpressure, at most 10,000 scrollback lines, and an accessible disclosure if output is discarded.
- Verify renderer acknowledgements occur only after xterm.js completes each write.
- Confirm raw input/output is absent from SQLite and application logs and disappears after exit.

### 5. Interrupt, stop, and force stop

- With two sessions visible, interrupt one and verify the selected target and outcome.
- Request stop on the other, confirm the target-bound disclosure, and verify new input is rejected
  while clean shutdown drains.
- Use a fixture that ignores clean stop. After the bounded grace period, confirm force stop is a
  separate explicit choice and terminates/validates the complete Job Object process tree.
- Attempt to close ThreadHelm with active sessions and verify close is blocked until the user cancels
  or stops all sessions.

### 6. Restart, power, and single instance

- Crash Electron main while fixture descendants are active and verify Windows leaves none running.
- Restart ThreadHelm and confirm unfinished sessions become `recovery_required`, with no PID-only
  reattachment, automatic relaunch, or input replay.
- Lock, suspend, resume, and unlock Windows with sessions in several lifecycle states. Confirm each
  is reconciled honestly and activity is `unknown` without structured evidence.
- Start ThreadHelm twice and verify the second launch focuses the existing controller without opening
  storage or creating a second supervisor.

### 7. Accessibility and restrained rendering

- Complete approval, provider selection, launch, session switching, input, interrupt, stop, recovery,
  and close using only the keyboard.
- Verify visible focus, meaningful accessible names/state announcements, text scaling, WCAG 2.2 AA
  contrast, and reduced-motion behavior.
- Leave the application idle with no sessions and verify no continuous visible animation/rendering.

## Performance acceptance

On representative supported Windows hardware and the installed build:

| Measure | MVP budget |
|---|---|
| Startup to usable recovery view | 5 seconds or less |
| Normal terminal output visibility | 95% within 1 second |
| Selected-session input acknowledgement | 100 ms or less under normal load |
| No-session idle median CPU | 1% or less over 60 seconds |
| No-session installed working set | 250 MiB or less |
| Four idle sessions installed working set | 700 MiB or less |
| Renderer scrollback | 10,000 lines per session maximum |
| Unacknowledged stream data | 8 MiB per session maximum |

Record measurement method, hardware, Windows build, app commit/version, architecture, sample count,
and results. If Electron misses idle budgets after avoidable work and continuous rendering are
removed, trigger the documented Tauri/Rust shell reassessment rather than silently relaxing them.

## Release checklist

- Recheck Microsoft's supported Windows 11 lifecycle and claim only tested releases.
- Build separate x64 and ARM64 per-user Squirrel installers.
- Enable ASAR integrity and production fuses; unpack only required native artifacts.
- Disable RunAsNode, `NODE_OPTIONS`, CLI inspection, and loading application code outside ASAR.
- Publish SHA-256 checksums. Per the owner's 2026-08-30 unsigned-distribution decision, accept
  `NotSigned` or `Valid` and reject invalid signatures; trusted signing is not a release prerequisite.
- Run the installed acceptance suite on every claimed Windows release/architecture combination.
- Run real Codex CLI and Claude Code smoke tests separately with recording/logging disabled.
- Confirm no auto-update, routing, long-term memory/MemPalace, scheduling, remote control, `.hires`,
  `.agent` file loading, or elaborate UI customization entered the MVP.
