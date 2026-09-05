# Developing ThreadHelm

Everything needed to build, test, package, and verify ThreadHelm locally. The
[README](../README.md) covers what the application does; this document covers how to work on it.

## Prerequisites

| Requirement               | Notes                                                                      |
| ------------------------- | -------------------------------------------------------------------------- |
| Windows 11                | The native supervisor is Win32-only; there is no cross-platform build.     |
| Node.js 22+               | Enforced by `engines` in `package.json`.                                   |
| pnpm 11                   | The workspace uses pnpm workspaces and a frozen lockfile in CI.            |
| Rust stable (MSVC)        | Builds `native/windows-supervisor` through `@napi-rs/cli`.                 |
| Visual Studio Build Tools | Desktop C++ workload, required to rebuild `better-sqlite3` and `node-pty`. |

Fixture-based tests spawn a deterministic fake agent and need a `node.exe` on `PATH`.

## First run

```powershell
pnpm install --frozen-lockfile
pnpm native:build          # native/windows-supervisor -> windows-supervisor.win32-*.node
pnpm dev                   # electron-vite dev server + Electron
```

## Quality gates

These run in this order in [CI](../.github/workflows/ci.yml), on both x64 and ARM64 runners. Run
them in the same order locally; each one assumes the previous passed.

```powershell
pnpm format                # prettier --check
pnpm lint                  # eslint (Electron imports are confined to apps/desktop)
pnpm rust:fmt              # cargo fmt --check
pnpm rust:check            # cargo clippy, warnings denied
pnpm rust:test             # cargo test
pnpm native:build          # the native module the later gates load
pnpm typecheck             # TypeScript 7 native tsc, project references
pnpm test:unit
pnpm test:contract
pnpm desktop:build
pnpm test:integration      # architecture proof, Job Objects, crash/power/recovery
pnpm test:e2e              # Playwright Electron user journeys + accessibility
```

Two narrower entry points are useful while iterating:

- `pnpm proof:windows-supervision` builds the desktop app and runs only the Job Object
  architecture proof (T014).
- `pnpm test:integration:windows` is an alias of `pnpm test:integration`.

Integration and e2e gates drive the real application against fixture agents. They are the only
gates that exercise ConPTY, Job Objects, and recovery, so a green unit run is not evidence that
supervision still works.

## Packaging

Releases are intentionally unsigned and ship with SHA-256 checksums. See
[installation guidance](install.md) for the publisher-trust limitations this creates and how to
verify a download.

```powershell
pnpm package:win           # x64 NSIS installer + .sha256 files
```

Optional signing is driven by `THREADHELM_SIGN_CERT` and `THREADHELM_SIGN_PASSWORD` at package
time. Keys are never stored in the repository.

## Installed-artifact acceptance

The packaged application is accepted separately from the source tree, against the artifact a user
would actually install:

```powershell
$env:THREADHELM_ARTIFACT = 'C:\path\to\ThreadHelm.exe'; pnpm test:acceptance:installed
```

A non-recording smoke test against the real Codex CLI and Claude Code binaries is opt-in:

```powershell
$env:THREADHELM_PROVIDER_SMOKE = '1'; pnpm test:smoke:providers
```

The [installed-acceptance workflow](../.github/workflows/installed-acceptance.yml) runs the same
acceptance pass in CI.

## Repository layout

```text
apps/desktop/             Electron app: main coordinator, preload bridge, React renderer, session host
packages/contracts/       Zod schemas, operation/event names, host protocol, error codes
packages/domain/          Lifecycle state machine, activity state, one-writer lease policy
packages/persistence/     SQLite schema, migrations, repositories, privacy filter
packages/providers/       Codex CLI and Claude Code adapters
packages/test-fixtures/   Deterministic fake terminal agent used by every non-credentialed test
native/windows-supervisor Rust Node-API module: Job Objects and directory identity (Win32 only)
tests/                    unit - contract - integration/windows - e2e (Playwright Electron) - acceptance
```

## Specification workflow

This repository uses Spec Kit. A feature begins as a specification under `specs/`, is checked
against the [project constitution](../.specify/memory/constitution.md), and only then reaches an
implementation plan and tasks. Design notes and plans that precede a formal spec live under
[`docs/superpowers/`](superpowers/).

- [`specs/001-local-agent-workspace/`](../specs/001-local-agent-workspace/) - workspace approval,
  launch, supervision, recovery.
- [`specs/002-agent-mailbox-routing/`](../specs/002-agent-mailbox-routing/) - missions, delegation,
  and the [approved preview scope](../specs/002-agent-mailbox-routing/preview-release.md).
- [`specs/003-verified-mission-delegation/`](../specs/003-verified-mission-delegation/) - the
  current draft stage of the [Verified Mission OS roadmap](roadmaps/verified-mission-os.md).

Read [CONTRIBUTING.md](../CONTRIBUTING.md) and [SECURITY.md](../SECURITY.md) before opening an
issue or pull request.
