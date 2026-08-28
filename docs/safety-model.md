# ThreadHelm safety model

ThreadHelm starts powerful local tools. This document states what it enforces, what it can only
disclose, and where each boundary is implemented.

## Trust boundaries

| Boundary                       | Authority                                                          | Enforced by                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer (React + xterm.js)    | Display state; issue schema-validated intents                      | Sandbox, context isolation, no Node integration, strict CSP, navigation/permission/download denial — `apps/desktop/src/main/window.ts`                                     |
| Preload                        | One named method per contract operation                            | Generated from the contract's operation table; no `ipcRenderer`, channels, or Node APIs exposed — `apps/desktop/src/preload/index.ts`                                      |
| Main coordinator               | Policy, persistence, provider preflight, lifecycle, native handles | Router validates sender frame, operation, payload, and re-parses every response against the contract — `apps/desktop/src/main/ipc/router.ts`                               |
| Session host (utility process) | Exactly one PTY and provider, an ordered stream                    | Dormant until bootstrapped and launched with a one-time secret; a second launch, identity mismatch, or bad secret ends the host — `apps/desktop/src/session-host/index.ts` |
| Rust native module             | Job Object lifecycle and directory identity                        | No shell, network, provider logic, or general filesystem access; every `unsafe` call is in `identity.rs` / `job.rs` — `native/windows-supervisor/`                         |
| Provider CLI                   | User-confirmed activity in the effective workspace                 | Started with the folder as its working directory; not confined — disclosed on every launch                                                                                 |

## Workspace authority

- Folders are chosen only through the native picker; renderer-supplied paths are never accepted.
- Identity is `(volume serial, file id)` from an opened handle (`GetFinalPathNameByHandleW` +
  `FILE_ID_INFO`). Path strings are display only. Aliases and junctions resolve to one workspace.
- Only fixed local volumes are approvable. UNC, network, removable, and device-namespace paths
  fail closed.
- Before every preview and again immediately before process creation the folder is reopened and
  its identity compared with the approval; any change blocks the launch (`WORKSPACE_CHANGED`).
- Revocation is refused while a live session uses the folder.

## Provider preflight

- Executables are resolved from trusted roots and absolute `PATH` entries, excluding the workspace
  and the current directory; native `.exe` is preferred over `.cmd` shims. A `.cmd` shim is
  invoked only through `cmd.exe /d /s /c` with a tested quoting routine and fixed tokens.
- Version and authentication probes are bounded and non-interactive; raw output is parsed in
  memory and discarded. Only availability, version, authentication, a reason code, and an
  allowlisted summary survive. Unknown or timed-out results are never treated as favourable.
- Launch re-probes and compares executable, version, and authentication with the preview; drift
  fails closed (`PROVIDER_UNAVAILABLE` / `STALE_PREFLIGHT`).

## Process containment

1. A durable `starting` record is committed before any OS process exists.
2. Main creates a `KILL_ON_JOB_CLOSE` Job Object and starts a dormant utility process.
3. The host pid is assigned to the job and membership verified; the job must contain exactly the
   host before anything else may start.
4. Only then does main send the validated launch descriptor; the host creates one ConPTY and the
   provider inherits job membership. The provider root is verified in the job.
5. Main keeps every job handle for its lifetime. If the coordinator dies, Windows closes the handles
   and terminates every supervised tree (proved by `tests/integration/windows/job-object-proof.test.ts`).
6. Force stop calls `TerminateJobObject` and then proves the scope is empty. If evidence conflicts
   the session becomes _recovery required_ with survivors reported, never _stopped_.

The one-writer rule keys on folder identity: a second write-capable session in the same effective
folder is refused with guidance to use another folder or worktree.

## Terminal confinement

- Output travels as ordered frames over a per-session `MessagePort`; the renderer acknowledges only
  after xterm has written a frame. High/low watermarks pause and resume the PTY; anything beyond the
  8 MiB unacknowledged budget is discarded and disclosed (`truncationCount`).
- xterm runs with proposed APIs off, window manipulation off, hyperlinks inert, and OSC clipboard /
  cwd / title / file requests swallowed. No clipboard, web-links, search, image, or WebGL add-ons.
- Terminal text never becomes trusted DOM or application state.

## Persistence and privacy

Persisted: workspace identities and approvals, provider ids with normalized readiness, lifecycle
states and timestamps, control kinds, exit codes, terminal dimensions, truncation counts, recovery
records, and event summaries built only from fixed templates.

Never persisted or logged: terminal input or output, prompts, environment values, credentials,
tokens, probe output. `packages/persistence/src/sanitize.ts` rejects control sequences,
credential-shaped tokens, `KEY=value` secrets, and over-long free text before any write; the main
logger redacts the same shapes.

Storage failures degrade the coordinator: new launches are blocked, live sessions stay visible and
controllable, and a warning is shown. Corrupt or incompatible databases are preserved for
diagnosis and a fresh one is opened.

## Recovery

At startup every unfinished session becomes _recovery required_ with a classification; no PID is
reattached, no agent relaunched, no input replayed. Suspend, resume, lock, and unlock trigger a
recheck of every live session against its Job Object; activity returns to _unknown_. A second
ThreadHelm launch focuses the existing controller and never opens storage or supervision.

## Test hooks

`--threadhelm-test-hooks` installs a main-process harness used by the integration, e2e, and
acceptance suites. It reuses the same router and validation as the renderer; its only extra
authority is answering the folder picker without a dialog. It is never enabled without that
explicit switch.
