# Contract: Windows Supervisor Native Module

The Rust Node-API module exposes only the Win32 operations required for stable directory identity
and complete process-scope supervision. It is callable only from Electron main.

## API

```ts
type JobToken = { readonly opaque: unique symbol };

interface WindowsSupervisor {
  resolveDirectory(selectedPath: string): DirectoryIdentity;
  createKillOnCloseJob(sessionId: string): JobToken;
  assignProcess(job: JobToken, pid: number): void;
  verifyProcessInJob(job: JobToken, pid: number): boolean;
  inspectJob(job: JobToken): JobSnapshot;
  terminateJob(job: JobToken, exitCode: number): JobSnapshot;
  closeJob(job: JobToken): void;
}
```

Opaque tokens are process-local native handles and cannot be serialized, persisted, guessed, or
created by the renderer. All functions validate types/ranges and return stable error codes without
leaking raw OS buffers.

## Directory identity

`resolveDirectory` must:

1. Open the selected directory handle using Windows directory/reparse-safe flags.
2. Obtain the final path from the opened handle and retrieve `FILE_ID_INFO` plus volume facts.
3. Normalize display prefixes without weakening the opened-handle identity.
4. Return selected path, canonical path, volume serial, file ID, drive type, reparse observation, and
   an MVP support decision.
5. Reject nonexistent/inaccessible directories and MVP-unsupported UNC, network, removable,
   device-namespace, or ambiguous reparse targets.

Approval and launch must call the function independently; an identity mismatch makes the prior
approval/preview stale. One-writer policy keys on volume serial plus file ID, not path strings.

## Job Object supervision

`createKillOnCloseJob` creates a uniquely named or unnamed Job Object and applies
`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` before returning. Main must retain its handle for the complete
session lifetime.

`assignProcess` must fail closed if Windows rejects nested-job assignment, access is denied, the PID
is invalid/stale, or assignment cannot be proven. `verifyProcessInJob` is mandatory before main
sends the provider launch descriptor.

`inspectJob` returns bounded process-count/PID diagnostics suitable for stop verification; it does
not grant handles to the renderer. `terminateJob` uses `TerminateJobObject`, then verifies a bounded
empty state. `closeJob` invalidates the token even when Windows cleanup reports an error.

## Error contract

Stable classes include:

- `DIRECTORY_NOT_FOUND`, `DIRECTORY_ACCESS_DENIED`, `DIRECTORY_UNSUPPORTED`, `DIRECTORY_AMBIGUOUS`
- `JOB_CREATE_FAILED`, `JOB_LIMIT_FAILED`, `PROCESS_ASSIGN_FAILED`, `PROCESS_NOT_IN_JOB`
- `JOB_INSPECTION_FAILED`, `JOB_TERMINATION_FAILED`, `JOB_NOT_EMPTY`, `INVALID_NATIVE_TOKEN`

Errors may include an allowlisted Win32 code for diagnostics, but not path contents beyond the
already approved display path and never arbitrary native error strings in durable logs.

## Safety and test requirements

- Rust code owns handle lifetime with RAII and contains all `unsafe` Win32 calls in small audited
  modules.
- Node-API entrypoints catch panics and never unwind across the ABI.
- Tests cover Unicode/space/long paths, aliases, junctions/symlinks, deleted/replaced directories,
  unsupported volumes, invalid PIDs, nested-job behavior, descendants, force termination, main
  crash, handle closure, concurrent sessions, and x64/ARM64 packaged loading.
- The module performs no shell execution, provider discovery, network access, logging of secrets,
  or general filesystem reads/writes.
