# ThreadHelm

ThreadHelm is a Windows-first, local-first desktop application for directing multiple
terminal-based AI agents (Codex CLI and Claude Code) from one calm workspace: approve a folder,
launch a real interactive agent process in it, supervise several sessions side by side, interrupt
or stop them safely, and get an honest picture of what happened after a restart.

The project takes inspiration from the functional core of Munder Difflin — real local agent
processes, coordination, terminal access, and centralized user control — without the animated
office, characters, pixel art, or game-like presentation.

## What the MVP does

- **Approve a workspace** through the native folder picker. Identity is taken from the opened
  directory handle (volume serial + file id), so aliases, junctions, and different spellings of the
  same folder are the same workspace. Only fixed local drives are supported.
- **Preflight and launch** Codex CLI or Claude Code from trusted install locations with a bounded
  version/authentication probe; the launch disclosure shows the effective path, agent, version, and
  the access-boundary warning, and every session requires its own confirmation.
- **Supervise** at least four concurrent sessions, each in its own utility process and ConPTY,
  each inside a `KILL_ON_JOB_CLOSE` Job Object. Input goes only to the selected session; output
  stays attributed; terminal control sequences cannot touch the clipboard, files, or the OS.
- **Interrupt, stop, force stop** with the exact target shown, bounded grace periods, and a
  separate risk-disclosing confirmation before `TerminateJobObject`. Closing the app with active
  sessions is blocked until you cancel or stop them all.
- **Recover honestly**: unfinished sessions become _recovery required_ after a restart; nothing is
  relaunched and no input is replayed. Raw terminal bytes, prompts, environment values, and
  credentials are never persisted.

Details: [docs/safety-model.md](docs/safety-model.md), [docs/install.md](docs/install.md), and
the feature specification under [`specs/001-local-agent-workspace/`](specs/001-local-agent-workspace/).

## Repository layout

```text
apps/desktop/             Electron app: main coordinator, preload bridge, React renderer, session host
packages/contracts/       Zod schemas, operation/event names, host protocol, error codes
packages/domain/          Lifecycle state machine, activity state, one-writer lease policy
packages/persistence/     SQLite schema, migrations, repositories, privacy filter
packages/providers/       Codex CLI and Claude Code adapters
packages/test-fixtures/   Deterministic fake terminal agent used by every non-credentialed test
native/windows-supervisor Rust Node-API module: Job Objects and directory identity (Win32 only)
tests/                    unit · contract · integration/windows · e2e (Playwright Electron) · acceptance
```

## Developing

Prerequisites: Windows 11, Node.js 22+, pnpm 11, Rust stable with the MSVC toolchain, and Visual
Studio Build Tools with the Desktop C++ workload (for `better-sqlite3`/`node-pty` rebuilds).

```powershell
pnpm install --frozen-lockfile
pnpm native:build          # builds native/windows-supervisor → windows-supervisor.win32-*.node
pnpm dev                   # electron-vite dev server + Electron
```

Quality gates, in the order CI runs them:

```powershell
pnpm format                # prettier --check
pnpm lint                  # eslint (Electron imports are confined to apps/desktop)
pnpm rust:fmt; pnpm rust:check; pnpm rust:test
pnpm typecheck             # TypeScript 7 native tsc, project references
pnpm test:unit; pnpm test:contract
pnpm desktop:build
pnpm proof:windows-supervision      # architecture proof gate (T014)
pnpm test:integration:windows       # real app, fixture agents, Job Objects, crash/power/recovery
pnpm test:e2e                       # Playwright Electron user journeys + accessibility
```

Packaging and installed-artifact acceptance:

```powershell
pnpm package:win                                      # x64 Squirrel installer + .sha256 files
$env:THREADHELM_ARTIFACT = 'C:\path\to\ThreadHelm.exe'; pnpm test:acceptance:installed
$env:THREADHELM_PROVIDER_SMOKE = '1'; pnpm test:smoke:providers   # real Codex/Claude, non-recording
```

Signing is driven by `THREADHELM_SIGN_CERT` / `THREADHELM_SIGN_PASSWORD` at package time; keys are
never stored in the repository. Fixture-based tests need a `node.exe` on `PATH`.

## Development workflow

This repository uses Spec Kit. Features begin with a specification and are checked against the
project constitution ([`.specify/memory/constitution.md`](.specify/memory/constitution.md)) before
implementation. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before
opening an issue or pull request.

## License

No open-source license has been selected. The repository is publicly visible, but no permission to
copy, modify, or redistribute its contents is granted unless a license is added later.
