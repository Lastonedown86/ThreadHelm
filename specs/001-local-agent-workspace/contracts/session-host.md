# Contract: Session Host

Each Electron utility process is a dormant, single-session host. It may not create a provider or PTY
until main proves the host is inside the intended Job Object and sends a validated launch message.

## Bootstrap protocol

1. Utility process starts with a random session-bound bootstrap secret delivered over Electron's
   private process channel; command-line secrets are prohibited.
2. Host sends `host.ready { sessionId, hostPid, protocolVersion }` and waits dormant.
3. Main assigns `hostPid` to the session Job Object and verifies membership through the native
   module.
4. Main sends exactly one `host.launch` descriptor and transfers a dedicated MessagePort.
5. Host validates session ID, protocol version, launch schema, executable absolute path, dimensions,
   and one-time bootstrap secret before creating node-pty.
6. Any timeout, duplicate launch, identity mismatch, or channel close exits the dormant host without
   launching a descendant.

## Main-to-host messages

| Message | Purpose |
|---|---|
| `host.launch` | Create the one allowed PTY/provider after containment verification |
| `host.input` | Write bounded bytes in serialized sequence |
| `host.resize` | Apply validated columns/rows in serialized sequence |
| `host.interrupt` | Send Ctrl+C to the ConPTY in serialized sequence |
| `host.cleanStop` | Reject new input and execute adapter-approved graceful stop |
| `host.pauseOutput` | Pause PTY reading at the application high watermark |
| `host.resumeOutput` | Resume PTY reading after low watermark acknowledgement |
| `host.shutdown` | Exit only after provider/process scope is already verified stopped |

## Host-to-main messages

| Message | Purpose |
|---|---|
| `host.ready` | Advertise dormant process identity and protocol version |
| `host.launched` | Report PTY creation and provider root PID |
| `host.output` | Ordered bounded raw output frame for the session MessagePort |
| `host.exit` | Report observed provider exit code and final drain completion |
| `host.controlApplied` | Acknowledge serialized input/resize/interrupt/stop sequence |
| `host.failure` | Report a stable error code and sanitized details |

## Ordering and isolation

- A host accepts one session ID and one provider launch in its lifetime.
- Input, resize, interrupt, and stop operations use a strictly increasing shared control sequence.
- Output uses an independent strictly increasing sequence and an 8 MiB unacknowledged byte budget.
- Message/session mismatches terminate the host and fail that session only.
- PTY stdout/stderr is never logged or persisted by the host. Debug logging uses fixed event names,
  numeric sizes/sequences, and stable error codes only.

## Exit behavior

- Normal provider exit: drain bounded pending output, report exit, and await main verification that
  the Job Object is empty before shutdown.
- Clean-stop timeout: report timeout and remain contained while main offers force stop.
- Main/channel death: the utility process exits; closing main's Job Object handle terminates all
  contained descendants.
- Native/PTY crash: process exit is classified by main as failed or recovery-required and does not
  affect other hosts.

## Proof and integration tests

The first implementation milestone must package a host and demonstrate dormant start, assignment,
membership verification, descendant inheritance, clean exit, host crash, main crash, and
`KILL_ON_JOB_CLOSE` cleanup. This proof gates the Electron architecture.
