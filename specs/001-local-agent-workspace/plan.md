# Implementation Plan: ThreadHelm Local Agent Workspace MVP

**Branch**: `main` | **Active feature**: `001-local-agent-workspace` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-local-agent-workspace/spec.md`

## Summary

Build a Windows-first desktop application that lets a user approve a local workspace, preflight and
launch Codex CLI or Claude Code, supervise at least four isolated interactive sessions, route input
and output without cross-session confusion, stop the complete process scope safely, and present
honest recovery state after restart. The implementation uses a sandboxed Electron/React interface,
an Electron main-process coordinator, one utility process and ConPTY per agent session, SQLite for
sanitized durable state, and a narrow Rust Node-API module for Windows Job Objects and directory
identity. Raw terminal content remains memory-only.

## Technical Context

**Language/Version**: TypeScript 7 on Electron 44/embedded Node 24; Rust 1.98 for the Windows-native boundary

**Primary Dependencies**: React 19, Vite 8, electron-vite 5, xterm.js 6, Microsoft node-pty 1.1, Electron Forge 7, better-sqlite3 13, Zod 4, Electron Fuses

**Storage**: Local SQLite database in Electron `userData`; rollback journal, foreign keys enabled, synchronous `FULL`; raw terminal input/output, prompts, environment values, credentials, and probe output are never persisted

**Testing**: Vitest unit and contract suites, Cargo tests, Windows integration fixtures, Playwright Electron end-to-end tests, installed-artifact acceptance tests, and separate credentialed provider smoke tests

**Target Platform**: Current Microsoft-supported Windows 11 client releases; x64 and ARM64 installers

**Project Type**: Single-window Windows desktop application with a native support module

**Performance Goals**: Recovery view usable within 5 seconds; 95% of normal output visible within 1 second; selected-session input acknowledged within 100 ms under normal load; no-session idle median CPU at or below 1% over 60 seconds

**Constraints**: Local-first and offline-capable after provider installation/authentication; at least four concurrent sessions; no continuous idle animation; no unbounded terminal buffers; renderer has no direct OS, shell, database, or process authority

**Scale/Scope**: One controlling application instance, a small set of approved local workspaces, two built-in provider adapters, at least four live sessions, and 10,000 terminal scrollback lines per session; excludes routing, memory, scheduling, remote control, `.agent` definitions, `.hires`, and elaborate customization

## Constitution Check

*GATE: Passed before Phase 0 research and passed again after Phase 1 design.*

| Constitutional obligation | Design evidence | Result |
|---|---|---|
| Windows-first, local-first | ConPTY, Job Objects, file identity, Windows installers, and installed Windows acceptance tests are first-class design elements; no hosted control plane is required. | PASS |
| Orchestration over visual theater | Scope is limited to real process launch, supervision, terminal control, and recovery; no characters, scenery, pixel effects, or simulated status. | PASS |
| Restrained, adaptable interface | Renderer uses replaceable lists, panels, status labels, controls, and terminals; domain and process contracts are presentation-independent; idle rendering is budgeted. | PASS |
| Explicit and safe local control | Approved canonical workspaces, per-launch disclosure, trusted executable resolution, one-writer enforcement, exact-target controls, Job Object containment, and renderer isolation are specified. | PASS |
| Observable, testable, recoverable work | Sanitized lifecycle events are durable, raw content is not; state machines, Windows boundaries, IPC, restart reconciliation, and installed packages have automated gates. | PASS |
| Accessibility and performance constraints | Keyboard operation, visible focus, text scaling, WCAG 2.2 AA targets, reduced motion, bounded buffers, and measurable CPU/memory/latency budgets are release gates. | PASS |
| Provider isolation | Codex CLI and Claude Code implement a common adapter contract; one unavailable provider does not corrupt application state. | PASS |

No constitutional exception is required.

## Architecture

### Runtime topology

```text
Sandboxed React renderer
        │ typed preload API + per-session MessagePort
        ▼
Electron main coordinator ─── SQLite durable metadata
        │
        ├── Rust Node-API boundary ─── Windows Job Objects + directory identity
        │
        └── one dormant utility process per session
                    │ assigned to verified Job Object before launch
                    ▼
                 node-pty / ConPTY ─── Codex CLI or Claude Code
```

The Electron main process owns policy, database access, provider resolution, workspace approval,
controller leases, Job Object handles, and lifecycle transitions. A sandboxed renderer can request
only typed operations exposed by the preload bridge. Each session utility process owns exactly one
PTY and provider process. The Rust module is deliberately narrow: it creates, assigns, verifies,
terminates, and closes Job Objects and resolves stable Windows directory identity.

### Launch and supervision flow

1. The renderer asks the main process to open a native directory picker; user-provided path strings
   are not accepted as workspace approval.
2. The native module opens the directory, obtains its final canonical path and `FILE_ID_INFO`, and
   rejects unsupported UNC, network, removable, or device-namespace targets.
3. Main records explicit approval and, for each launch, revalidates workspace identity, the
   one-writer lease, provider executable, supported version, and authentication readiness.
4. Main writes a durable `starting` session record in a transaction before creating OS processes.
5. Main creates a Job Object configured with `KILL_ON_JOB_CLOSE`, starts a dormant utility process,
   assigns it to the job, and verifies membership. No provider may start before this succeeds.
6. Main sends a validated launch descriptor. The utility process creates one node-pty/ConPTY with
   the canonical workspace as the process working directory and launches only the adapter-resolved
   executable and adapter-owned arguments.
7. Output travels as ordered frames over a session-specific MessagePort. Renderer acknowledgements
   occur only after xterm.js completes `write`; high/low watermarks pause and resume the PTY.
8. Main persists sanitized lifecycle and control events. Raw bytes, user input, prompts, environment
   values, credentials, and provider probe output remain memory-only.
9. Interrupt sends Ctrl+C to the selected ConPTY. Stop blocks new input, requests the adapter's
   clean exit, drains output, and waits a bounded grace period. Force stop requires explicit
   confirmation, calls `TerminateJobObject`, and verifies that the process scope is empty.
10. On restart, unfinished durable sessions become `recovery_required`; ThreadHelm does not reattach
    by PID, relaunch an agent, or replay input.

### Trust boundaries

| Boundary | Authority | Prohibited behavior |
|---|---|---|
| Renderer | Display state and issue schema-validated user intents | Direct Node, filesystem, shell, environment, database, executable, or generic IPC access |
| Preload | One narrow method per approved operation | Generic channel invocation or exposing Electron primitives |
| Main coordinator | Policy, persistence, provider preflight, session lifecycle, native handles | Persisting terminal content/secrets or allowing renderer-selected commands/arguments |
| Session utility process | One validated PTY session and ordered stream | Database access, workspace approval, provider discovery, or control of another session |
| Rust native module | Job Object lifecycle and directory identity | Provider logic, UI state, network access, or broad filesystem operations |
| Provider CLI | User-confirmed activity in the effective workspace | Being represented as confined when ThreadHelm cannot enforce that boundary |

### Failure and recovery rules

- Any ambiguous workspace identity, unsupported volume, stale approval, failed provider recheck,
  failed job assignment, or failed membership verification blocks launch closed.
- A PTY/native crash affects only its session and produces an actionable failed state; other
  sessions remain live.
- The main process retains every live Job Object handle. Unexpected coordinator termination closes
  the handles, causing Windows to terminate all supervised process trees.
- Storage write failure blocks new launches and control transitions that require a durable intent;
  current processes remain visible and controllable while a clear degraded-state warning is shown.
- Corrupt or incompatible storage is preserved for diagnosis and opened through a bounded recovery
  path; ThreadHelm does not silently discard history or assume sessions completed.
- Suspend, resume, lock, and unlock trigger reconciliation. No event automatically restarts a
  provider or replays terminal input.
- The application obtains Electron's single-instance lock before opening storage or process
  supervision. A second launch focuses the existing controller.

## Project Structure

### Documentation (this feature)

```text
specs/001-local-agent-workspace/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── desktop-ipc.md
│   ├── provider-adapter.md
│   ├── session-host.md
│   └── windows-supervisor.md
└── tasks.md                 # Created by $speckit-tasks, not by this plan
```

### Source Code (repository root)

```text
apps/desktop/
├── forge.config.ts
└── src/
    ├── main/                # Policy, lifecycle, persistence, IPC, provider orchestration
    ├── preload/             # Narrow typed renderer bridge
    ├── renderer/            # React UI and xterm.js views
    └── session-host/        # One utility process and PTY per session

packages/
├── contracts/               # Shared schemas, commands, events, error codes
├── domain/                  # State machines and policy independent of Electron/UI
├── persistence/             # SQLite schema, migrations, repositories
├── providers/               # Codex CLI and Claude Code adapters
└── test-fixtures/           # Deterministic fake terminal agents

native/windows-supervisor/
├── Cargo.toml
└── src/                     # Node-API Job Object and directory identity operations

tests/
├── unit/
├── contract/
├── integration/windows/
├── e2e/
└── acceptance/
```

**Structure Decision**: Use a pnpm workspace so the desktop runtime, presentation-independent
domain, persistence, provider adapters, shared contracts, fixture agents, and Rust native boundary
remain separately testable. Electron-specific imports are confined to `apps/desktop`; Win32 calls
are confined to `native/windows-supervisor`.

## Test Strategy and Release Gates

1. **Architecture proof gate**: A packaged proof must demonstrate that a dormant Electron utility
   process can be assigned to and verified within a kill-on-close Job Object before it launches a
   descendant. Failure blocks this Electron plan and triggers a Tauri/Rust shell reassessment.
2. **Domain and contract tests**: Cover every legal and illegal lifecycle transition, one-writer
   rule, stale-preflight failure, IPC schema, adapter behavior, backpressure, and privacy filter.
3. **Windows integration tests**: Exercise path spaces, Unicode, long paths, reparse points, file
   identity aliases, Job Object descendants, interrupt/stop/force-stop, crash cleanup, suspend/resume
   reconciliation, and single-instance behavior with deterministic fixture agents.
4. **Desktop end-to-end tests**: Exercise approval, launch disclosure, multiple sessions, selected
   input routing, honest unknown activity, terminal confinement, close blocking, and restart state.
5. **Installed-artifact acceptance**: Run on clean representative Windows x64 and ARM64 systems,
   validate signing/checksums/fuses/ASAR integrity/native loading, and record the Windows release and
   workflow. Provider credentials are used only in a separate non-recording smoke suite.
6. **Quality and UX gates**: Formatting, linting, type checking, Rust checks, automated suites,
   keyboard-only operation, focus visibility, text scaling, WCAG 2.2 AA contrast, reduced-motion,
   idle CPU/memory, four-session memory, input latency, and output latency must pass.

Current release targeting must be rechecked against Microsoft's supported Windows lifecycle before
each release; a release may claim only the architectures and Windows versions actually tested.

## Phase Outputs

- Phase 0: [research.md](./research.md) records the resolved technology, security, process,
  persistence, packaging, testing, and performance decisions.
- Phase 1: [data-model.md](./data-model.md), [contracts](./contracts/), and
  [quickstart.md](./quickstart.md) define the implementation boundaries and validation path.
- Phase 2: `$speckit-tasks` will translate this plan into dependency-ordered implementation tasks.

## Complexity Tracking

No constitutional violations or approved exceptions require tracking.
