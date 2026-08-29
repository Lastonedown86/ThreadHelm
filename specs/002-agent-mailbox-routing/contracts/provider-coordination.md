# Contract: Provider Coordination Bridge

This contract allows an eligible provider session to receive and deliberately create coordination
artifacts without reading terminal output, opening ThreadHelm's database, or claiming another
session's identity.

## Capability declaration

Each provider adapter declares:

| Field | Meaning |
|---|---|
| `bridgeConfiguration` | `unsupported` or `session_scoped_stdio_mcp` |
| `safePointEvidence` | `none` or a named structured event contract |
| `testedVersionRange` | Exact provider versions for which bridge launch was proved |
| `automaticPresentation` | `manual_only` or `structured_safe_point` |
| `memoryTools` | `unsupported` or `scoped_revisioned_memory` |
| `supervisorTools` | `unsupported`, `worker_only`, or `bound_supervisor` |
| `configurationFailureBehavior` | Always `manual_only`; provider session may still launch after disclosure |

Unknown version, disabled hook/MCP policy, malformed configuration, bridge startup failure, lost pipe,
or rejected event changes only that session to `manual_only` and emits a safe reason. It does not fail
or reconfigure another session.

## Session configuration

### Launch disclosure and confirmation

Before starting Codex CLI or Claude Code, ThreadHelm displays resolved provider/model/effort. Selecting model or effort automatically refreshes the exact bound preview, with no separate settings-review gate; the sole checkbox confirms only the folder-access boundary. Priority is one-run override > exact agent/profile revision request > task-type/project policy > CLI default; CLI default is selectable. Readiness probing and app load do not prompt. Automated tests use no LLM; test authoring/failure analysis recommends the lowest-cost capable approved model at low/medium effort, while high-cost/high-effort requires explicit selection or recorded escalation. Planning providers are ChatGPT/OpenAI, Claude, and Google Antigravity; runtime providers remain Codex CLI and Claude Code.

- A selected agent profile pins an exact reviewed revision. Its goal may be passed only as disclosed
  untrusted context; provider/model, effort, tools, isolation, workspace, and effective budget come
  from separately validated launch policy. Importing a profile does not create this configuration.
- ThreadHelm creates configuration under its own user-data directory for one session.
- Claude Code receives an additional session config through `--mcp-config` and, only for proved
  lifecycle events, `--settings`.
- Codex receives per-process configuration overrides/profile material supported by its tested CLI
  version. ThreadHelm does not edit `~/.codex`, user profiles, or project `.codex` files.
- The launch preview discloses the local coordination tool, its four actions, durable content, and
  manual degradation behavior.
- Config contains the packaged bridge path and session-scoped connection material only; no provider
  credential, user prompt, mission objective, memory content, workspace secret, or database path.
- Session config and credential are invalidated/removed after the session ends. Failure to remove is
  reported safely and the credential remains invalid.

## Bridge transports

```text
provider CLI ⇄ MCP JSON-RPC over bridge stdin/stdout
bridge       ⇄ bounded private protocol over one session-scoped Windows named pipe
main         ⇄ coordination service and database
```

- Each JSON line/frame is at most 32 KiB.
- Unknown methods/fields, invalid JSON, oversized frames, duplicate initialization, wrong session,
  expired credential, or out-of-order request IDs fail closed.
- Bridge stderr uses fixed event names/codes and numeric sizes only; stdout is MCP protocol only.
- Main rate-limits one session to 20 bridge actions per minute and at most one in-flight mutation.
- Disconnecting the bridge never stops the provider session; pending work becomes manual.

## MCP tools

### `threadhelm_list_pending`

**Input**: optional limit 1–20.

**Output**: pending handoffs addressed to the authenticated session: ID, conversation ID, sender
summary, kind, purpose/body, response expectation, reply depth, and timestamps.

**Rules**:

- Returns only queued/delivered-unacknowledged items for that recipient.
- Content counts as deliberately requested coordination content; no transcript or unrelated session
  data is returned.
- Listing does not acknowledge or advance delivery/work outcome.

### `threadhelm_acknowledge`

**Input**: handoff ID.

**Output**: handoff ID, resulting `acknowledged` state, timestamp.

**Rules**:

- Caller must be the addressed recipient.
- Requires delivered state and is idempotent for the same recipient.
- Acknowledgement is not completion.

### `threadhelm_reply`

**Input**: `inReplyTo`, kind (`response`, `inform`, `query`, `proposal`, `completion`, `refusal`, or
`failure`), purpose, body, response expectation, and explicit `authorityRequired` boolean.

**Output**: new stable handoff ID, derived recipient, delivery state (`queued` or `held`), and safe
hold reason.

**Rules**:

- Main derives conversation, sender, recipient, parent, and reply depth.
- `request` cannot be created through reply; new work requires user creation.
- Query/proposal, `authorityRequired=true`, unknown/conflicting kinds, and any bound trigger are held.
- Purpose/body use the same validation, quota, content, and deletion rules as user handoffs.
- The provider cannot request automatic delivery directly.

### `threadhelm_report_outcome`

**Input**: handoff ID, outcome (`completed`, `refused`, or `failed`), optional bounded safe reason code.

**Output**: resulting work outcome and conversation state.

**Rules**:

- Caller must be the addressed recipient.
- Outcome is idempotent when identical and rejected when conflicting.
- No free-text terminal output is imported; a narrative belongs in a separate structured reply.

## P5 shared-memory tools

P5 adds `threadhelm_memory_search`, `threadhelm_memory_get`, and
`threadhelm_memory_propose_revision` exactly as defined in [shared-memory.md](shared-memory.md).
Main derives author and visible scopes from the authenticated session. These tools cannot delete,
resolve conflicts, choose another scope, read transcripts/files, or change mission authority.

## P8 supervisor-role tools

P8 adds the mission/work tools in [supervisor.md](supervisor.md) only when the authenticated session
is the ordinary supervisor bound to one active mission. Workers receive no supervisor capability.
Main rejects role/scope/envelope/version/lease mismatches before persistence or external effects.

The expanded bridge remains a closed, versioned tool registry. P1–P4 sessions that do not negotiate
P5/P6 capabilities retain only the original four mailbox tools.

## Lifecycle evidence

A lifecycle adapter may emit only:

- authenticated ThreadHelm session ID;
- provider ID and normalized version;
- event kind from the provider-specific proved set;
- provider event/session/turn ID when documented and bounded;
- event timestamp; and
- `safePoint=true` only for the exact event/version semantics proved in smoke tests.

Main rejects stale, duplicated, cross-session, unknown-version, malformed, or unproved evidence. It
does not persist transcript paths, last assistant messages, reasoning, tool arguments/results, raw
hook input, or provider errors. Connection, process existence, output, silence, and elapsed time are
never safe-point evidence.

## Automatic presentation

When a valid safe point arrives and an opted-in conversation has an allowed queued reply, main may
present one item through the provider-specific proved path. The adapter must prove that the provider
will not combine it with a user draft. If that guarantee is absent, main changes the handoff to
manual-actionable instead.

Provider permission prompts remain authoritative. A bridge message never approves a tool call,
changes permission mode, expands workspace access, or suppresses provider/user confirmation.

## Proof requirements per provider/version

- config applies only to the intended session and leaves user/project/global settings unchanged;
- bridge is packaged, signed with the application, and contained by the session Job Object;
- tool caller cannot impersonate another session or access another inbox;
- bridge crash/disconnect degrades to manual and does not stop the provider;
- lifecycle event semantics are documented and observed at exact CLI version;
- a pending terminal draft is never overwritten by an automatic nudge;
- lock/suspend/resume/restart creates no replay or duplicate;
- raw prompt/output/hook/config secrets do not enter logs or coordination metadata; and
- proof result is recorded independently for Codex and Claude.
