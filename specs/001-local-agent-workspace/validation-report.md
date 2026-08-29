# Validation Report: ThreadHelm Local Agent Workspace MVP

**Tasks**: T093 (quickstart validation against a packaged build), T094 (trust boundary review and
tested-platform record) | **Date**: 2026-08-28 | **Commit**: `cecf6fb` + T091/T093/T094 working tree

This report records what was actually executed. A development pass is not a packaged-build pass and
a packaged x64 pass is not ARM64 evidence; each row below says which one it is.

## Environment

| Item | Value |
|---|---|
| Windows | Microsoft Windows 11 Home 25H2, build 10.0.26200.9168, x64 |
| Hardware | AMD Ryzen 7 5700U, 31 GiB RAM (developer laptop, not a clean system) |
| Toolchain | Node 22.19.0, pnpm 11.0.8, Rust 1.98.0 (stable, MSVC), TypeScript 7 |
| Runtime | Electron 44.0.0, xterm.js 6.0.0, node-pty 1.1.0, better-sqlite3 13.0.3, Zod 4.4.3, React 19.2.8 |
| App version | 0.0.0 (`apps/desktop/package.json`) |
| Artifact | `apps/desktop/release/ThreadHelm-win32-x64/ThreadHelm.exe`; `release/make/squirrel.windows/x64/ThreadHelm-Setup-x64.exe` |
| Setup SHA-256 | `1ed9594766dd4d41a64320e29d01dda96679e912a8622f886cabb6f4b592dabc` (matches shipped `.sha256`) |
| Signing | **NotSigned** — no `THREADHELM_SIGN_CERT` on this machine; public release requires signing |
| Architectures tested | **x64 only**. No ARM64 build or ARM64 hardware was available; nothing is claimed for ARM64 |

## Quickstart gates (quickstart.md "Planned quality gates")

| Gate | Command | Result |
|---|---|---|
| Format | `pnpm format` | PASS |
| Lint | `pnpm lint` | PASS |
| Typecheck | `pnpm typecheck` | PASS |
| Unit | `pnpm test:unit` | 11 files, 70 tests PASS |
| Contract | `pnpm test:contract` | 6 files, 118 tests PASS |
| Rust format / clippy | `pnpm rust:fmt`, `pnpm rust:check` | PASS (`-D warnings`) |
| Rust tests | `pnpm rust:test` | 17 tests PASS |
| Windows integration | `pnpm test:integration:windows` | 9 files, 26 tests PASS, 1 skipped (read-only/locked database → degraded mode: the harness cannot hold a file lock across Electron startup; degraded mode itself is covered by the `breakStorage` path) |
| Architecture proof gate | `tests/integration/windows/job-object-proof.test.ts` | PASS (dev tree; packaged variant not separately re-run — production fuses disable the inspector the proof drives through) |
| Desktop end-to-end | `pnpm test:e2e` | 9 specs PASS (Playwright Electron) |
| Package | `pnpm package:win` | x64 Squirrel installer + `.sha256` produced |
| Installed acceptance | `pnpm test:acceptance:installed` (THREADHELM_ARTIFACT = packaged `ThreadHelm.exe`) | 5/5 PASS: fuses verified (RunAsNode off, NODE_OPTIONS off, CLI inspect off, ASAR integrity on, only-load-from-ASAR on); ASAR + `app.asar.unpacked` present; native module loaded through a real launch; both providers probed with no token-shaped text in the log; second instance exited 0; signature recorded as unsigned; checksum check skipped for the bare exe (checksums ship next to the Setup/nupkg artifacts and were verified with `certutil`) |
| Provider smoke | `pnpm test:smoke:providers` | **Not run** — credentialed, non-recording suite; requires a deliberate operator run |

Report file written by the acceptance suite:
`apps/desktop/release/ThreadHelm-win32-x64/threadhelm-acceptance-report.json`.

The Squirrel Setup was **not executed** on this machine (it would install into `%LocalAppData%`
and create shortcuts on the developer's system). Acceptance ran against the packaged
`ThreadHelm.exe` the installer ships, which is the same binary with the same fuses and ASAR.

## Performance acceptance (quickstart.md table)

Measurement: `tests/integration/windows/performance.test.ts` (T091) on the dev tree under
Playwright's Electron driver, plus a PowerShell sample of the **packaged** exe for the no-session
idle budgets (12 windows × 5 s, `Win32_Process` CPU time; working set via `Win32_Process` and
`Win32_PerfFormattedData_PerfProc_Process`). Samples: 50 input round-trips, 40 output round-trips,
one four-session recovery run.

| Measure | Budget | Measured | Build | Verdict |
|---|---|---|---|---|
| Startup to usable recovery view (4 crashed sessions) | ≤ 5 s | 1.02–1.14 s | dev | PASS |
| Normal output visible in terminal (MutationObserver on xterm rows) | 95% ≤ 1 s | median 16 ms, p95 17–22 ms | dev | PASS |
| Selected-session input acknowledged | ≤ 100 ms | median 2.8–3.4 ms, p95 3.9–5.1 ms | dev | PASS |
| No-session idle median CPU over 60 s | ≤ 1% of one core | 0.00% (windows: 0.00 ×8, 0.30, 0.30, 0.89, 2.38) | **packaged** | PASS |
| No-session working set | ≤ 250 MiB | **344–353 MiB** `WorkingSetSize` sum (main 103, gpu 109, network utility 46, renderer 85); **118 MiB** private working set | **packaged** | **MISS** on shared-inclusive metric; pass on private |
| Four idle sessions working set | ≤ 700 MiB | **819 MiB** `WorkingSetSize` sum; each session host utility process ≈ 105 MiB | dev (+ inspector) | **MISS** |
| Renderer scrollback | 10,000 lines max | enforced in `buffer.ts`, covered by backpressure integration test | dev | PASS |
| Unacknowledged stream data | ≤ 8 MiB per session | enforced in `backpressure.ts`, covered by backpressure integration test | dev | PASS |

### Open budget decision (not silently relaxed)

The memory budgets are missed when working set is summed as `WorkingSetSize` across Electron's
processes, which counts shared DLL pages once per process. Private working set with no sessions is
118 MiB. quickstart.md does not name the metric. Options, in order of preference:

1. Define the budget as summed **private** working set and add that column to the gate.
2. Reduce the per-session host cost (≈ 105 MiB per Electron utility process; a Node child process
   would be far smaller but would need its own Job Object proof).
3. If neither is accepted, this is the documented Electron-vs-Tauri/Rust reassessment trigger.

`THREADHELM_ENFORCE_BUDGETS=1` makes the T091 test fail on the memory rows today; release runs must
resolve this before the gate can pass.

## Manual MVP scenarios (quickstart.md 1–7)

Each scenario has an automated equivalent that passed in this run. No separate hand-driven pass of
the packaged UI was performed.

| Scenario | Automated coverage |
|---|---|
| 1 Workspace approval and launch | `desktop-ipc-workspaces`, `desktop-ipc-launch`, `workspace-identity` (spaces, Unicode, long paths, reparse points, aliases, UNC/removable rejection), `launch-session.spec` |
| 2 Provider readiness | `provider-adapter` contract tests (available, missing, unsupported, unauthenticated, timeout, immediate-exit), `sanitize` privacy filter |
| 3 Multiple sessions / one-writer | `multi-session` integration (four concurrent, isolation), `multi-session.spec`, lease contract tests |
| 4 Terminal confinement and pressure | `backpressure` integration (burst, discard disclosure, 10,000 lines), `session-stream` contract, `xterm-security` |
| 5 Interrupt, stop, force stop | `desktop-ipc-control`, `stop-escalation` (descendants, ignored interrupt, force stop, residuals), `coordinator-death`, `stop-control.spec` |
| 6 Restart, power, single instance | `recovery`, `power-and-instance`, `desktop-ipc-recovery`, `recovery.spec`; second instance also proven on the packaged exe |
| 7 Accessibility and restrained rendering | `accessibility.spec` (keyboard-only, focus, scaling, contrast, reduced motion); idle CPU 0.00% packaged |

## Trust boundary review (plan.md "Trust boundaries")

| Boundary | Evidence in the implementation | Verdict |
|---|---|---|
| Renderer — display + schema-validated intents only | No `electron`, `node:`, or `require` imports anywhere under `apps/desktop/src/renderer`; `window.ts` sets `sandbox`, `contextIsolation`, `nodeIntegration:false` (incl. workers and subframes), `webSecurity`, and a CSP header; ESLint `no-restricted-imports` forbids `electron` outside `apps/desktop` | HOLDS |
| Preload — one narrow method per approved operation | `preload/index.ts` builds one closure per `operationNames` entry pinned to `op:<name>`; the renderer chooses a method, never a channel; events are whitelisted by `eventNames`; the stream port is re-posted, never exposed; only `threadhelm` is bridged | HOLDS |
| Main coordinator — policy, persistence, preflight, lifecycle, native handles | `ipc/router.ts` rejects non-main frames and disallowed origins, `safeParse`s every request and response against contract schemas; `sanitize.ts` rejects raw output/input/prompts/env/credentials/probe output before persistence (unit-tested); launch arguments come from `LaunchDescriptor` built by adapters, not the renderer; `job-registry.ts` retains Job Object handles for the coordinator lifetime | HOLDS |
| Session utility process — one validated PTY and ordered stream | `apps/desktop/src/session-host` imports no `better-sqlite3`, `@threadhelm/persistence`, or `windows-supervisor`; only `MessagePortMain` types from Electron; one PTY per host (`pty.ts`), backpressure and resize serialization local to the host | HOLDS |
| Rust native module — Job Objects and directory identity only | Exported surface is exactly `createKillOnCloseJob`, `assignProcess`, `verifyProcessInJob`, `inspectJob`, `terminateJob`, `closeJob`, `resolveDirectory`; Cargo deps are `napi`, `napi-derive`, `windows-sys` (Foundation, Security, FileSystem, JobObjects, Threading, WindowsProgramming) — no network or broad filesystem crates | HOLDS |
| Provider CLI — user-confirmed activity in the effective workspace | Launch disclosure requires `boundaryConfirmation`; the UI states ThreadHelm cannot confine the provider (`launch-session.spec`, `accessibility.spec`) | HOLDS |

Residual notes:

- Test hooks (`--threadhelm-test-hooks`) add picker-path selection and fixture adapters only; they
  route through the same router, validation, leases, and Job Objects. Production fuses prevent the
  inspector transport they rely on, as the packaged acceptance run confirmed.
- The one-off `Launch in` locator timeout seen on the first perf run immediately after a rebuild did
  not reproduce in three subsequent runs; noted for flake tracking.

## Release claim

Based on this run ThreadHelm may claim: **Windows 11 25H2 (build 26200), x64, unsigned developer
package**. It may not claim ARM64, signed distribution, a clean-system install, or any Windows
release other than the one above until those runs are executed and recorded here.
