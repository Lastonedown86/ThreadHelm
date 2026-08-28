# Contract: Desktop IPC

This contract defines the only renderer-to-main authority exposed by the preload bridge. It is a
TypeScript/Zod contract, not a generic Electron IPC surface.

## Security envelope

- `nodeIntegration=false`, `contextIsolation=true`, renderer sandbox enabled.
- Strict local Content Security Policy; remote content, navigation, new windows, downloads, and
  permission requests are denied by default.
- Main validates the sender frame, application origin, operation name, payload schema, current
  state, and referenced identity for every request.
- Preload exposes one named method per operation. It does not expose `ipcRenderer`, filesystem,
  environment, shell, executable, database, or arbitrary channel access.
- All errors use stable codes and sanitized messages. Stack traces and raw provider/native output
  do not cross into the renderer in production.

## Request/response operations

| Method | Request | Success result | Important errors |
|---|---|---|---|
| `workspaces.choose()` | none | Candidate containing display path, canonical path, stable identity summary, support status | `SELECTION_CANCELLED`, `WORKSPACE_UNSUPPORTED`, `WORKSPACE_AMBIGUOUS` |
| `workspaces.approve(candidateToken)` | opaque short-lived token | `ApprovedWorkspaceView` | `CANDIDATE_EXPIRED`, `WORKSPACE_CHANGED`, `WORKSPACE_UNSUPPORTED` |
| `workspaces.list()` | none | Approved workspace views | `STORAGE_UNAVAILABLE` |
| `workspaces.revoke(workspaceId)` | UUID | revoked workspace view | `WORKSPACE_ACTIVE`, `WORKSPACE_NOT_FOUND` |
| `providers.listReadiness()` | none | Sanitized readiness views for built-in adapters | `PROBE_FAILED` |
| `sessions.previewLaunch(workspaceId, providerId)` | UUID + provider enum | Disclosure with refreshed effective path, readiness, and boundary warning | `WORKSPACE_CHANGED`, `PROVIDER_UNAVAILABLE`, `WRITE_LEASE_HELD` |
| `sessions.launch(previewToken, boundaryConfirmation)` | opaque token + explicit boolean | session view and stream offer | `PREVIEW_EXPIRED`, `CONFIRMATION_REQUIRED`, `SUPERVISION_FAILED` |
| `sessions.list()` | optional bounded filter | Session summaries and recovery records | `STORAGE_UNAVAILABLE` |
| `sessions.interrupt(sessionId)` | UUID | accepted transition | `INVALID_STATE`, `SESSION_NOT_FOUND` |
| `sessions.requestStop(sessionId)` | UUID | stop disclosure bound to target | `INVALID_STATE`, `SESSION_NOT_FOUND` |
| `sessions.confirmStop(stopToken)` | opaque short-lived token | accepted transition | `CONFIRMATION_EXPIRED`, `TARGET_CHANGED` |
| `sessions.requestForceStop(sessionId)` | UUID | risk disclosure bound to target | `FORCE_NOT_AVAILABLE`, `SESSION_NOT_FOUND` |
| `sessions.confirmForceStop(forceToken)` | opaque short-lived token | accepted transition | `CONFIRMATION_EXPIRED`, `TARGET_CHANGED` |
| `sessions.sendInput(sessionId, bytes)` | UUID + bounded byte payload | accepted input sequence | `NOT_SELECTED`, `INPUT_BLOCKED`, `BACKPRESSURE` |
| `sessions.resize(sessionId, columns, rows)` | UUID + safe positive dimensions | accepted control sequence | `INVALID_DIMENSIONS`, `INVALID_STATE` |
| `recovery.resolve(recordId, resolution)` | UUID + enum | updated session/recovery view | `INVALID_RESOLUTION`, `RECORD_NOT_FOUND` |
| `application.requestClose()` | none | close result or active-session list | `ACTIVE_SESSIONS` |

`sendInput` is permitted only for the renderer's currently selected session, and main rechecks that
selection token. Input, resize, interrupt, and stop controls enter one serialized per-session queue.

## Main-to-renderer events

| Event | Payload | Delivery rule |
|---|---|---|
| `workspace.changed` | approved workspace view | Sanitized metadata only |
| `provider.readinessChanged` | readiness view | No raw probe output |
| `session.changed` | session view + transition reason | Ordered by session event sequence |
| `session.activityChanged` | state + structured evidence kind/time | Defaults to `unknown`; no heuristic claims |
| `session.outputAttention` | session ID + unread flag | Contains no terminal bytes |
| `session.outputTruncated` | session ID + cumulative count | Must be visible and accessible |
| `recovery.changed` | recovery view | Explicit user action required |
| `application.powerChanged` | `lock`, `suspend`, `resume`, `unlock` + reconciliation status | Never implies automatic relaunch/replay |

## Terminal stream

A separate MessagePort is transferred for each session. Frames are discriminated and validated:

```ts
type OutputFrame = {
  kind: 'output';
  sessionId: string;
  sequence: number;
  bytes: Uint8Array;
};

type OutputAck = {
  kind: 'ack';
  sessionId: string;
  throughSequence: number;
};
```

The renderer acknowledges a frame only from the xterm.js `write` completion callback. Sequence gaps,
wrong session IDs, duplicate future acknowledgements, or oversized frames close the stream and
produce a sanitized session failure. Main/host pause at the high watermark and resume at the low
watermark; terminal software flow-control bytes are not used for application backpressure.

## Terminal rendering constraints

- Clipboard, web-link, search, image, WebGL, and OS-integration add-ons are absent unless separately
  reviewed. OSC clipboard/window/file actions are inert.
- Links are plain terminal text in the MVP; clicking provider output cannot open a URL or file.
- Terminal content is never inserted through `innerHTML` and is never copied into telemetry/logs.
- Raw output is held only in bounded memory and disappears when the session/app ends.
