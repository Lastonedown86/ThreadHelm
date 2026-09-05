<p align="center">
  <img src="docs/assets/threadhelm-monogram.png" alt="ThreadHelm monogram" width="320" />
</p>

<h1 align="center">ThreadHelm</h1>

<p align="center"><strong>A calm command center for local AI agents.</strong></p>

ThreadHelm is a Windows-first, local-first desktop workspace for directing Codex CLI and Claude
Code without losing sight of what each process can access or do. Approve a folder, launch real
interactive sessions, supervise them side by side, and stop or recover them safely—all from one
focused workspace.

ThreadHelm is operator tooling, not a simulation. Agent processes run locally, access boundaries
are disclosed before launch, and recovery reports only what the application can prove. The
interface favors clear state and deliberate control over characters, simulated activity, or
game-like presentation.

## Design principles

- **Local by default.** ThreadHelm launches the agent tools already installed on your machine and
  keeps their terminal sessions on your machine.
- **Explicit boundaries.** Every launch identifies the selected workspace, provider, version, and
  effective executable before the process starts.
- **Calm supervision.** Concurrent sessions remain visually separate, with input and controls
  scoped to the session you selected.
- **Honest recovery.** After a crash or restart, ThreadHelm never invents continuity, relaunches an
  agent, or replays input on your behalf.

## What the current MVP does

The next distribution milestone is an **unsigned Windows 11 x64 preview**, not a completed US8
autonomy release. The owner has deferred the 250 MiB idle-memory target (latest measurement:
380.324 MiB), ARM64 distribution and unproved autonomous-provider capabilities. Claude auto
starts remain held when capability/policy proof is unavailable. ARM64 CI builds are validation
artifacts, not supported preview downloads. The preview installer is **not yet approved for
distribution**: x64 client installed acceptance, uninstall cleanup, independent review and owner
acceptance remain open. See the [approved preview scope](specs/002-agent-mailbox-routing/preview-release.md).

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
- **Compose a mission** in a guided four-step composer (Outcome → Crew → Access & limits →
  Review), optionally starting from AI-suggested ideas for an approved repo. Every suggestion lands
  on an editable screen; nothing is applied or started without your confirmation.
- **Watch a mission** in Mission Focus: one approved direction, its crew, and its sessions in a
  single frame, with the same disclosures and controls as any other session.
- **Propose a crew** with workspace recon—an ordinary owner-confirmed session whose only return
  channel is a set of proposed agent roles. Each role is reviewed and accepted one at a time; there
  is no accept-all control.

Details: [docs/safety-model.md](docs/safety-model.md), [docs/install.md](docs/install.md), the
product direction in [docs/roadmaps/verified-mission-os.md](docs/roadmaps/verified-mission-os.md),
and the feature specifications under [`specs/`](specs/):
[001 local agent workspace](specs/001-local-agent-workspace/),
[002 agent mailbox routing](specs/002-agent-mailbox-routing/), and the
[003 verified mission delegation](specs/003-verified-mission-delegation/) draft.

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

Releases are intentionally unsigned and include SHA-256 checksums. See
[installation guidance](docs/install.md) for publisher-trust limitations and verification.

```powershell
pnpm package:win                                      # x64 NSIS installer + .sha256 files
$env:THREADHELM_ARTIFACT = 'C:\path\to\ThreadHelm.exe'; pnpm test:acceptance:installed
$env:THREADHELM_PROVIDER_SMOKE = '1'; pnpm test:smoke:providers   # real Codex/Claude, non-recording
```

Optional signing is driven by `THREADHELM_SIGN_CERT` / `THREADHELM_SIGN_PASSWORD` at package time; keys are
never stored in the repository. Fixture-based tests need a `node.exe` on `PATH`.

## Development workflow

This repository uses Spec Kit. Features begin with a specification and are checked against the
project constitution ([`.specify/memory/constitution.md`](.specify/memory/constitution.md)) before
implementation. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before
opening an issue or pull request.

## License

No open-source license has been selected. The repository is publicly visible, but no permission to
copy, modify, or redistribute its contents is granted unless a license is added later.
