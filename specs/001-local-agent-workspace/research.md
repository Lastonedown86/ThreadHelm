# Research: ThreadHelm Local Agent Workspace MVP

**Feature**: `001-local-agent-workspace`
**Date**: 2026-08-28

All technical unknowns from the feature specification are resolved below. Versions are the stable
baselines observed at planning time; implementation must pin exact versions in lockfiles and refresh
the supported Windows and provider matrices before each release.

## Decision 1: Desktop stack

**Decision**: Use Electron 44 with TypeScript 7, React 19, Vite 8/electron-vite 5, and xterm.js 6.
Use Rust 1.98 only for a narrow Windows-native Node-API module that owns Job Objects and directory
file identity. Use Node 24 as embedded by Electron.

**Rationale**:

- Microsoft `node-pty` provides the shortest proven route from Node to Windows ConPTY, while
  xterm.js supplies a mature terminal parser and renderer. ThreadHelm therefore does not have to
  build a terminal emulator.
- Electron supports isolated utility processes. One utility process per agent limits a native PTY
  crash or output-pressure failure to that session instead of the coordinator or other sessions.
- TypeScript keeps the domain, provider adapters, contracts, main process, preload bridge, utility
  host, and renderer in one primary language. Rust is limited to Win32 capabilities that cannot be
  implemented with equivalent guarantees in JavaScript.
- Electron's Chromium cost is acceptable for a single-window, terminal-first application only with
  explicit idle CPU/memory budgets, bounded buffers, no animation loop, and installed-build tests.

**Alternatives considered**:

- **Tauri 2 + Rust + React**: smaller baseline and an excellent native Win32 boundary, but no
  official PTY abstraction. It would require implementing the complete ConPTY host before validating
  the product. Reconsider if Electron cannot meet idle or packaging budgets.
- **C#/.NET with WinUI or WPF**: strong Windows APIs and accessibility, but no supported production
  terminal control. Embedding WebView2 plus xterm.js creates a mixed bridge without improving the
  terminal layer.
- **Electron main process owning all PTYs**: simpler but one native failure could lose all sessions.

**Sources**:

- [Electron release schedule](https://releases.electronjs.org/schedule)
- [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron utility processes](https://www.electronjs.org/docs/latest/api/utility-process)
- [Microsoft node-pty](https://github.com/microsoft/node-pty)
- [xterm.js documentation](https://xtermjs.org/docs/)
- [Rust 1.98](https://blog.rust-lang.org/2026/08/20/Rust-1.98.0/)
- [Rust for Windows](https://learn.microsoft.com/windows/dev-environment/rust/rust-for-windows)

## Decision 2: Per-session Windows supervision

**Decision**: The Electron main process creates one Job Object per session through the Rust native
module, sets `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, starts a dormant utility process, assigns that
utility process to the Job Object, verifies membership, and only then authorizes it to launch the
provider through `node-pty`. Launch fails closed if any containment step fails.

The utility process owns one ConPTY, the provider process, per-session input/output queues, and PTY
resize. The Electron main process owns policy, persistence, session state, Job Object handles, and
user decisions. The renderer owns no process or filesystem authority.

**Rationale**:

- A provider spawned after its parent utility process is assigned inherits Job Object membership,
  avoiding the child-creation race caused by assigning a running provider afterward.
- Closing the last kill-on-close Job Object handle terminates the contained process tree if the main
  process crashes.
- Each utility process isolates `node-pty`, which documents that it is not thread-safe.
- Job membership, not a recursive PID walk, is the authoritative process-scope check.

**Required architecture proof**: Before general UI work, a packaged Windows spike must prove that an
Electron utility process can join the per-session nested Job Object, launch both fixture descendants
and a ConPTY child, report membership, and be terminated when the controlling handle closes. Failure
of this proof blocks the Electron stack and triggers the Tauri/Rust fallback review.

**Stop semantics**:

- **Interrupt** writes Ctrl+C to the selected ConPTY input queue and keeps the session alive.
- **Stop** rejects new ordinary input, requests an adapter-approved clean exit, drains remaining
  output, and waits a bounded grace period for the session scope to empty.
- **Force Stop** is separately confirmed, terminates the Job Object, verifies the process scope is
  empty, and reports `recovery_required` instead of `stopped` when evidence conflicts.

**Alternatives considered**:

- `taskkill /T /F` is an emergency diagnostic fallback, not process ownership.
- Closing ConPTY alone does not prove that descendants exited.
- One shared PTY host would make one native crash affect all sessions.

**Sources**:

- [Windows Job Objects](https://learn.microsoft.com/windows/win32/procthread/job-objects)
- [AssignProcessToJobObject](https://learn.microsoft.com/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject)
- [TerminateJobObject](https://learn.microsoft.com/windows/win32/api/jobapi2/nf-jobapi2-terminatejobobject)
- [Creating a Pseudoconsole session](https://learn.microsoft.com/windows/console/creating-a-pseudoconsole-session)
- [ClosePseudoConsole](https://learn.microsoft.com/windows/console/closepseudoconsole)

## Decision 3: Provider discovery, readiness, and launch

**Decision**: Implement built-in, versioned provider adapters for `codex-cli` and `claude-code`.
The renderer chooses only a provider ID. The adapter resolves and validates an executable, constructs
fixed arguments, normalizes readiness evidence, and owns interrupt/clean-stop behavior.

Preflight must:

1. Search trusted user/system executable locations without including the selected workspace or
   current directory.
2. Prefer an absolute native `.exe` over PowerShell, extensionless, or batch shims.
3. run bounded, noninteractive version and authentication probes;
4. normalize only availability, version, authentication state, and actionable error information;
5. discard raw probe output immediately and never log it because it may contain account metadata;
6. re-resolve and revalidate immediately before launch; and
7. pass the workspace as the process working directory, never through `cd` or a shell-composed line.

The local planning machine demonstrated why resolution must not use PowerShell's first match:
PowerShell resolves Codex to a script shim even though a native Codex executable is available later
in the installation paths. Claude is currently available as a native executable. No account values
from readiness probes may enter artifacts, logs, or recovery records.

If only an npm `.cmd` shim exists, the adapter may invoke the already-resolved absolute shim through
absolute `cmd.exe /d /s /c` with a dedicated tested quoting routine and only fixed adapter-owned
arguments. Arbitrary user flags, prompts, workspace text, `shell: true`, and PATH re-resolution are
not allowed in the MVP.

Provider versions outside the release's tested compatibility range are reported unsupported rather
than silently treated as ready. Installation, authentication, updates, and credentials remain owned
by the provider tools and user.

**Alternatives considered**:

- User-supplied commands are deferred with portable `.agent` profiles.
- Terminal-text readiness inference is not reliable enough for a launch gate.
- Headless JSON/provider SDK modes would change the normal interactive CLI experience.

**Sources**:

- [Windows CreateProcess security guidance](https://learn.microsoft.com/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw)
- [Node child-process rules for Windows batch files](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows)
- [Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage)
- [Claude Code Windows setup](https://docs.anthropic.com/en/docs/claude-code/getting-started)

## Decision 4: Workspace authority and identity

**Decision**: Approve and compare workspaces using Windows directory identity, not normalized path
text. The Rust module opens the directory, resolves the final path, reads `FILE_ID_INFO`, and returns
`(volume serial number, file ID)` as the effective identity.

ThreadHelm shows selected and resolved paths when they differ. It reopens the directory immediately
before every launch and requires reapproval if identity changes. The one-writer rule keys on the
effective file identity. Device namespace, UNC/network, removable, and unsupported filesystem paths
are excluded from the MVP; supported workspaces are directories on fixed local volumes.

Workspace approval is an explicit launch boundary, not a claim that the external agent is
filesystem-sandboxed. The per-session disclosure remains required when the provider cannot be
confined.

**Alternatives considered**:

- Lowercased path strings, prefix comparisons, and `GetFullPathName` do not defeat junction, symlink,
  mount-point, alias, or time-of-check/time-of-use problems.

**Sources**:

- [Obtaining a handle to a directory](https://learn.microsoft.com/windows/win32/fileio/obtaining-a-handle-to-a-directory)
- [GetFinalPathNameByHandleW](https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew)
- [FILE_ID_INFO](https://learn.microsoft.com/windows/win32/api/winbase/ns-winbase-file_id_info)
- [Windows reparse points](https://learn.microsoft.com/windows/win32/fileio/reparse-points)

## Decision 5: Terminal transport, buffering, and containment

**Decision**: Use an ordered, acknowledged stream per session. The utility host emits bounded output
frames carrying session ID, monotonically increasing sequence, and bytes. The renderer acknowledges
a frame only from xterm's write callback after parsing. High/low watermarks pause and resume the PTY
reader, and protocol-bound violations fail the affected session without exhausting application
memory.

Input, interrupt, and resize share one serialized per-session host queue. Input is rejected after the
session leaves an input-eligible state. Resize calls are coalesced. Defaults are 10,000 xterm
scrollback lines and an 8 MiB maximum unacknowledged output budget per session; both values are
configuration constants with stress tests, not user customization in the MVP.

All terminal bytes are untrusted:

- no clipboard or web-links addon;
- terminal hyperlinks and requested window/clipboard operations are inert;
- proposed xterm APIs remain disabled;
- terminal titles never become trusted DOM or application state;
- surrounding UI never uses `innerHTML` with terminal-derived data; and
- raw PTY input/output is memory-only and discarded at session/app end.

**Alternatives considered**:

- Unbounded per-chunk IPC has no useful memory or ordering contract.
- XON/XOFF interception can consume Ctrl+S/Ctrl+Q used by the CLI; explicit pause/resume is clearer.
- Persisted scrollback conflicts with the MVP privacy boundary.

**Sources**:

- [xterm.js flow control](https://xtermjs.org/docs/guides/flowcontrol/)
- [xterm.js security](https://xtermjs.org/docs/guides/security/)
- [xterm.js link handling](https://xtermjs.org/docs/guides/link-handling/)
- [node-pty flow control](https://github.com/microsoft/node-pty#flow-control)

## Decision 6: Evidence-backed status

**Decision**: Keep lifecycle state and activity evidence separate. Process and supervisor events may
produce `starting`, `running`, `interrupting`, `stopping`, `stopped`, `failed`, and
`recovery_required`. Activity defaults to `unknown`.

`working`, `idle`, or `awaiting_user` may only be shown when a version-compatible provider adapter
supplies a documented structured signal. Silence, output timing, ANSI text, prompt regexes, and quiet
timers are never authoritative. Each persisted state event records its evidence category and time,
not raw evidence payloads.

MVP interactive sessions remain normal provider TUIs. Codex app-server and Claude hooks are seams for
later structured integrations, not hidden MVP dependencies.

**Alternatives considered**:

- Terminal heuristics look detailed but create false operational claims.
- Installing hooks changes user/provider configuration and expands the MVP trust boundary.

**Sources**:

- [Codex app-server](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)

## Decision 7: Persistence and recovery

**Decision**: Use SQLite through `better-sqlite3`, owned only by Electron main under the
ThreadHelm-specific user-data directory. Enable foreign keys, `synchronous=FULL`, transactional
migrations, and default rollback journaling. Add WAL only if measured concurrency requires it.

Persist workspace identities and approvals, agent definitions, readiness snapshots, sessions,
sanitized lifecycle events, and recovery records. Never persist prompt text, terminal input/output,
environment values, credentials, provider transcripts, or raw authentication/version output.

Before starting an OS process, write the `starting` transition transactionally. On startup, convert
unfinished persisted states to `recovery_required`, reconcile the native supervisor evidence, and
never reattach or relaunch solely from a PID because Windows can reuse PIDs.

**Alternatives considered**:

- Atomic JSON is adequate for settings but makes cross-record transitions, migrations, and recovery
  consistency custom infrastructure.
- Node's built-in SQLite remains release-candidate and is coupled to Electron's embedded Node.
- WAL side files are unnecessary for one main-process writer.

**Sources**:

- [SQLite transactional guarantees](https://www.sqlite.org/transactional.html)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Node SQLite stability](https://nodejs.org/api/sqlite.html)

## Decision 8: IPC and renderer boundary

**Decision**: Load only bundled local UI. Enable renderer sandboxing and context isolation, disable
Node integration, deny navigation/new windows/permissions, and enforce a restrictive Content
Security Policy. Expose one typed preload method per user operation; never expose generic IPC,
filesystem, environment, executable, or shell APIs.

Validate sender origin, schema, payload size, session ownership, lifecycle eligibility, provider ID,
and workspace identity again in main. Use request/response IPC for low-rate controls and a dedicated
MessagePort for each validated terminal subscription. Terminal output never broadcasts to other
sessions or windows.

**Alternatives considered**:

- A generic `invoke(channel, payload)` bridge turns renderer compromise into broad authority.
- A local WebSocket adds a network listener and violates the local-only MVP boundary.
- Remote UI and webviews are unnecessary attack surfaces.

**Sources**:

- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Electron MessagePortMain](https://www.electronjs.org/docs/latest/api/message-port-main)

## Decision 9: Packaging, integrity, and Windows support

**Decision**: Package with Electron Forge 7 and Squirrel.Windows as x64 and ARM64 per-user
installers. Package code in ASAR, unpack only required native artifacts, enable ASAR integrity, and
set production Electron fuses to disable RunAsNode, `NODE_OPTIONS`, CLI inspection, and loading code
outside the verified ASAR.

Public releases require Authenticode signing of the application and installer plus published
SHA-256 checksums. Signing keys remain outside the repository. Automatic update checks and installs
are deferred; the About surface links to the signed releases page so users can obtain a newer
version deliberately.

Release acceptance re-resolves Microsoft's live support matrix. At planning time, Windows 11 Home
and Pro 24H2, 25H2, and hardware-specific 26H1 remain relevant. Validate broadly deployed x64 builds
on 24H2 and 25H2 and ARM64/26H1 on representative hardware before claiming all-current-release
support. Windows 10, Server, and 32-bit builds remain out of scope.

**Alternatives considered**:

- An unsigned public installer does not provide sufficient publisher identity.
- Automatic updating adds a privileged network and signing path that is not required by the MVP.
- Development-build-only acceptance misses native module, PATH, signing, and permission failures.

**Sources**:

- [Electron Forge Squirrel.Windows](https://www.electronforge.io/config/makers/squirrel.windows)
- [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [Electron ASAR integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity)
- [Electron Forge Windows signing](https://www.electronforge.io/guides/code-signing/code-signing-windows)
- [Windows 11 Home and Pro lifecycle](https://learn.microsoft.com/lifecycle/products/windows-11-home-and-pro)
- [Windows 11 26H1 release health](https://learn.microsoft.com/windows/release-health/status-windows-11-26h1)

## Decision 10: Testing and performance budgets

**Decision**: Use Vitest for TypeScript unit/contract tests, Cargo tests for the Rust boundary,
deterministic fixture agents for Windows integration tests, and Playwright Electron for renderer and
end-to-end flows. Real Codex and Claude tests are separate credentialed smoke tests; CI correctness
does not depend on live provider accounts.

Installed-artifact acceptance must cover native module loading, four concurrent sessions, Unicode
and long paths, aliases/junctions, native and npm-shim providers, input ordering, output floods,
inert control sequences, child/grandchild cleanup, interrupt/stop/force-stop, main-process crash,
single instance, lock/suspend/resume/unlock, and database privacy.

Planning budgets on representative Windows hardware:

- recovery view ready within 5 seconds;
- 95% of received output visible within 1 second;
- selected-session input acknowledgment within 100 ms under normal load;
- no-session idle median CPU at or below 1% over 60 seconds;
- no-session installed-app working set at or below 250 MiB;
- four idle sessions working set at or below 700 MiB;
- no continuous animation or user-visible idle state changes; and
- bounded 10,000-line scrollback and 8 MiB unacknowledged bytes per session.

If the packaged Electron application cannot meet the idle budgets after removing avoidable work,
the plan requires a Tauri/Rust shell reassessment rather than weakening the constitution.

**Sources**:

- [Playwright Electron](https://playwright.dev/docs/api/class-electron)
- [Electron performance guidance](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Electron native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
