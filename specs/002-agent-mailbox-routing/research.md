# Phase 0 Research: Durable Hive Coordination

**Date**: 2026-08-28

**Feature**: [spec.md](spec.md)

## Decision 1: Align with hive behaviors, not the upstream storage or visual implementation

**Decision**: Adopt Munder Difflin's addressed messages, causal replies, response expectations,
single-recipient routing, idempotence, bounded reply chains, shared blackboard/memory, task ledger,
and autonomous supervisor outcomes. Adapt them to ThreadHelm's main-owned SQLite/event architecture.
Exclude the Git-backed hive layout, agent-owned coordination files, blanket-privileged GOD agent,
broadcast delivery, remote control, office simulation, avatars, and graphics-heavy memory graph.

**Rationale**: ThreadHelm already owns stable session identity, process control, input ordering,
recovery, and a sanitized event history. Its shared memory and supervisor therefore belong behind
the same typed main-process authority rather than in a second file/Git authority. This preserves the
requested hive mechanics while avoiding cross-writer, project-modification, and visual-theater risks.

**Alternatives considered**:

- Copying Munder's `inbox/`/`outbox/` and single-committer Git repo was rejected because ThreadHelm's
  database is already its recovery authority and user repositories must remain untouched.
- Copying Munder's prompt-governed god mode was rejected; ThreadHelm instead gives an ordinary
  supervisor agent typed tools constrained by a user-approved mission envelope and deterministic policy.

**Sources**:

- [Munder Difflin Hive design](https://github.com/chaitanyagiri/munder-difflin/blob/main/HIVE.md)
- [Munder Difflin message queue](https://github.com/chaitanyagiri/munder-difflin/blob/main/docs/message-queue.md)
- `.specify/memory/constitution.md`

## Launch policy decision

Before a provider CLI session starts, show resolved provider/model/effort plus separate runtime
permission policy and source. Treat model, effort, and permission controls as direct choices that
automatically refresh the bound preview; do not add a second settings-review gate. Keep one independent
checkbox for the folder-access boundary. Readiness probing and app load do not prompt. Model/effort
priority is one-run override > exact agent/profile revision request > task-type/project policy > CLI
default. Permission priority is one-run selection > task/project policy > provider default, excluding
profiles, personas, templates, missions, and persisted bypass. Automated tests use no LLM. Test
authoring/failure analysis recommends the lowest-cost capable approved model at low/medium effort;
high-cost/high-effort requires explicit selection or recorded escalation. Planning providers remain
ChatGPT/OpenAI, Claude, and Google Antigravity; runtime providers remain Codex CLI and Claude Code.
Effort and permission policy are launch state, not hire-schema data.

## Decision 2: Keep Electron main as the sole router and SQLite writer

**Decision**: Add schema migration v2 with normalized conversation, handoff, delivery-attempt,
coordination-event, and escalation records. Main owns every transaction and state transition.
Renderer, session hosts, provider CLIs, and the coordination bridge never open the database.

**Rationale**: One writer preserves the existing authority boundary, makes causal and quota checks
transactional, and allows crash recovery to distinguish known failure from unknown external delivery.
SQLite foreign keys, unique constraints, and partial indexes can enforce identity and at-most-one
applied delivery invariants without a second queue implementation.

**Alternatives considered**:

- Atomic JSON/mailbox files require custom multi-record transactions and quota recovery.
- A separate broker or database adds a service and violates local simplicity.
- Provider-owned storage cannot authoritatively reconcile ThreadHelm sessions after restart.

**Sources**:

- [SQLite transactions](https://www.sqlite.org/transactional.html)
- `packages/persistence/src/schema.ts`
- `packages/persistence/src/migrate.ts`

## Decision 3: Use at-most-once dispatch with an explicit unknown outcome

**Decision**: Persist a delivery attempt before writing to the session control queue. A host
acknowledgement marks that attempt applied and the handoff delivered. A known pre-write failure may
return the same handoff to manual action. If main crashes or loses acknowledgement while dispatch is
in progress, recovery marks the attempt `unknown`, holds the handoff, and prohibits automatic resend
to that session.

**Rationale**: SQLite and a PTY cannot form one atomic transaction. Claiming exactly-once external
delivery would be false. At-most-once automatic dispatch plus visible uncertainty satisfies duplicate
protection without inventing evidence. Stable handoff IDs in the submitted envelope help an agent
and user recognize an intentionally created replacement as distinct.

**Alternatives considered**:

- Automatic retry after uncertain write can duplicate a prompt.
- Marking delivered before host acknowledgement invents evidence.
- Marking every uncertain write failed hides the possibility that the provider received it.

## Decision 4: Separate durable creation from presentation authority

**Decision**: Use two one-time, two-minute disclosures. The first confirms sender, recipient,
workspace context, normalized durable content, retention, and response expectation before creating a
queued handoff. The second binds the exact current recipient, activity evidence, lifecycle,
workspace approval, final terminal envelope, and dispatch risk before presentation.

**Rationale**: Persisting work and typing into a live agent are different side effects. Separate
authority keeps a queued item useful when a recipient is unavailable, enables cancellation and
retargeting, and prevents a stale content review from authorizing a changed process target.

**Alternatives considered**:

- One combined confirmation cannot represent queued-only recovery safely.
- Reusing `sessions.sendInput` would inherit selected-terminal semantics but would not bind the
  durable message identity or disclose persistence and target drift.

## Decision 5: Add a session-scoped local coordination bridge for structured replies

**Decision**: Starting in P2, configure a packaged stdio MCP bridge for each eligible Codex or Claude
session using provider-supported per-session configuration. The provider spawns the helper inside its
existing Job Object. The helper translates four bounded tools—`list_pending`, `acknowledge`, `reply`,
and `report_outcome`—to a session-authenticated Windows named pipe owned by main.

The helper is a binary target in the existing Rust native package. It receives no database path,
workspace path, shell API, provider credential, or arbitrary recipient. Main derives its sender from
the authenticated session and derives reply recipients from the original handoff.

**Rationale**: Structured tool calls allow an agent to deliberately create a durable reply without
scraping or persisting terminal output. A packaged helper works in installed artifacts without a
system Node dependency, and named pipes avoid a network listener. Per-session configuration avoids
editing user, project, repository, or global provider settings.

**Alternatives considered**:

- Terminal-output parsing is untrustworthy, captures raw transcripts, and couples behavior to TUI text.
- A localhost HTTP/WebSocket service adds a network listener.
- Giving the helper direct SQLite access creates a second writer and weakens session scoping.
- Global or project MCP settings create persistent configuration outside the user's confirmed session.

**Sources**:

- [Claude Code local stdio MCP](https://code.claude.com/docs/en/mcp)
- [Codex configuration reference source](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json)
- Installed CLI evidence: Codex `-c/--config` supports per-process overrides; Claude supports
  `--mcp-config` and `--settings`.

## Decision 6: Treat lifecycle automation as a proved provider capability

**Decision**: P1 remains explicit/manual. P3 adds a provider coordination capability with
`manual_only` or `structured_safe_point` modes and a tested version range. Automatic presentation is
off unless a credentialed proof shows a structured turn-complete/safe-point event for the exact
provider version. Hook policy errors, unsupported versions, missing configuration, or ambiguous
evidence downgrade only that session to manual action.

Claude `Stop` hooks and Codex lifecycle hooks/app-server notifications are candidate evidence seams.
They are not assumed equivalent. Hook payloads are reduced to session, event kind, and time; raw
transcript paths, terminal content, reasoning, tool payloads, and last-message text are not persisted
as lifecycle evidence.

**Rationale**: Both providers expose structured integration surfaces, but their configuration,
policy, and event semantics change independently. ThreadHelm's current adapters truthfully declare
`structuredActivity: false`; the plan must preserve unknown state until the new seam is proved.

**Alternatives considered**:

- Prompt regexes, quiet timers, output timing, CPU, and process existence were rejected as false
  readiness evidence.
- Treating one provider's proof as parity for the other violates provider isolation.
- Replacing the interactive PTY with Codex app-server in P1 would reopen the proven terminal and
  process architecture.

**Sources**:

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Codex app-server protocol](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- `packages/domain/src/activity-state.ts`
- `packages/providers/src/adapter.ts`

## Decision 7: Make durable content explicit, bounded, deletable, and isolated from logs

**Decision**: Store only the exact purpose/body the user confirms or the bounded structured body an
authenticated provider bridge deliberately submits. Reject binary data, NUL, escape/C0 controls
other than tab/newline, invalid Unicode, known credential-like patterns, and content above 16 KiB.
No prompt, terminal stream, environment, transcript, raw hook payload, or provider error is imported
automatically.

Deleting an inactive conversation transactionally nulls purpose, body, content fingerprint, and
content-size metadata. IDs, causal links, state types, timestamps, safe reason codes, and fixed safe
summaries remain. Message bodies are never copied to application logs or broad renderer events.

**Rationale**: A handoff is intentionally durable and must remain readable across restart, unlike raw
terminal data. Separating content fields from sanitized lifecycle metadata allows disclosure,
deletion, quota accounting, and debugging without normalizing transcript persistence.

**Alternatives considered**:

- Persisting selected terminal scrollback risks capturing unrelated code and credentials.
- Keeping body hashes or lengths after deletion conflicts with the content-free record promise.
- Automatic semantic secret scanning cannot be a sole guarantee; known patterns are blocked and the
  final content remains visible for user review.

## Decision 8: Fix deterministic limits during planning

**Decision**:

- one recipient per handoff;
- purpose: 160 Unicode scalar values;
- body: 16 KiB UTF-8;
- 100 open conversations;
- 128 handoffs per conversation;
- 64 MiB total retained body content;
- automatic reply depth: eight;
- pause before presenting a third identical normalized kind/sender/recipient/body fingerprint within
  the latest eight handoffs;
- pause after three consecutive delivery failures; and
- disclosure tokens: one use, two-minute expiry.

Normalization is deterministic—line endings normalized, Unicode preserved, trailing line whitespace
removed—and is not a semantic similarity judgment. New request/query/proposal, conflict,
authority-required, and unknown acts are always held for the user in automatic mode.

**Rationale**: These limits fit well below the existing 64 KiB terminal-input bound, support the
specified 100-handoff performance case, bound privacy exposure and UI size, and make livelock tests
repeatable. Exact matching avoids an AI classifier becoming a hidden routing authority.

**Alternatives considered**:

- Unbounded local retention turns normal product use into an uncontrolled transcript archive.
- Semantic loop detection is nondeterministic and may suppress legitimate work.
- Allowing broadcast or multi-recipient messages conflicts with independent target review.

## Decision 9: Extend typed IPC and keep UI state-focused

**Decision**: Add named coordination operations and events to the existing Zod registry/preload
bridge. Low-rate views use bounded cursor pagination. Full bodies cross only in an explicitly opened
conversation or disclosure; list/events contain sanitized summaries. The renderer uses ordinary text
rendering, panels, lists/tables, badges, dialogs, and bounded accessible live regions with no generic
IPC, raw HTML, automatic link opening, idle polling, or decorative animation.

**Rationale**: This preserves the existing Electron sender validation and renderer sandbox. It also
keeps transport, work outcome, and escalation visibly distinct without coupling core state to a
particular visual layout.

**Alternatives considered**:

- A generic coordination IPC channel weakens schema and sender checks.
- Sending every body on every event expands exposure and renderer memory.
- A graphical office/message animation conflicts with the constitution.

**Sources**:

- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- `packages/contracts/src/index.ts`
- `specs/001-local-agent-workspace/contracts/desktop-ipc.md`

## Decision 10: Assign stories only within the approved model ecosystems

**Decision**: Use the following current assignments, rechecking account availability immediately
before each story:

| Story | Primary | Same-ecosystem fallback | Independent verifier |
|---|---|---|---|
| P1 Directed handoffs | OpenAI `gpt-5.6-sol` at `high` | `gpt-5.6-terra` at `xhigh` | Claude `claude-opus-5` at `high` |
| P2 Auditable conversations | Antigravity `gemini-3.7-flash-medium` | `gemini-3.6-flash-medium` | Claude `claude-sonnet-5` at `high` |
| P3 Lifecycle-aware delivery | Claude `claude-opus-5` at `high` | `claude-sonnet-5` at `xhigh` | OpenAI `gpt-5.6-sol` at `max` |
| P4 Bounded coordination | OpenAI `gpt-5.6-sol` at `max` | `gpt-5.6-terra` at `max` | Claude `claude-opus-5` at `xhigh`, human owner required; optional Antigravity `gemini-3.1-pro-high` second review |
| P5 Shared hive memory | Antigravity `gemini-3.1-pro-high` | `gemini-3.7-flash-medium` | Claude `claude-opus-5` at `high` plus deterministic retrieval/privacy evaluation |
| P6 Reviewed agent roster | Claude `claude-sonnet-5` at `high` | `claude-opus-5` at `high` | OpenAI `gpt-5.6-sol` at `high` plus deterministic schema/digest tests |
| P7 Agent wizard and templates | OpenAI `gpt-5.6-terra` at `high` | `gpt-5.6-sol` at `high` | Deterministic schema/export tests; Claude `claude-sonnet-5` at `high` only after a separately owner-approved external run |
| P8 Autonomous supervisor | OpenAI `gpt-5.6-sol` at `max` | `gpt-5.6-terra` at `max` | Claude `claude-opus-5` at `xhigh`, human owner required; Antigravity `gemini-3.1-pro-high` adversarial review |

**Rationale**: P1, P3, P4, and P8 contain persistence, crash, authority, or concurrency invariants and
receive frontier reasoning plus cross-ecosystem review. P2 is broad but bounded UI/domain work, while
P5 benefits from Antigravity Pro's long-context architecture review. The matrix uses all three
user-approved ecosystems without treating a model as evidence that its own work is correct.

At planning time the installed surfaces were Codex CLI 0.150.1, Claude Code 2.1.251, and Antigravity
CLI 1.1.22. `agy models` exposed the selected Gemini slugs. Codex app availability exposed
`gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`; Claude's current model documentation and Claude
Code configuration expose `claude-opus-5` and `claude-sonnet-5`. Current inventory, subscription
quota, and retirement dates may drift, so the commands/checks in the plan are gates, not optional notes.

**Usage/cost tradeoffs**:

- Sol/Opus/Pro-class or maximum effort is restricted to safety-critical slices and independent review.
- Terra, Sonnet, and Gemini Flash are the production-work fallbacks/defaults where evaluations hold.
- Luna, Haiku, and low-effort Flash may perform only mechanically checkable subtasks after contracts
  are fixed; they do not own or accept a story.
- OpenAI GPT-5.4 variants are too close to announced Codex retirement for new assignments; GPT-5.5 is
  previous-generation and less usage-efficient than the chosen GPT-5.6 models.
- Claude Fable 5 is not a default because its higher quota/cost and retention terms are unnecessary;
  using it for a genuinely unresolved P4/P8 escalation requires explicit user approval.
- Antigravity is quota-based for normal individual use; API token prices explain relative cost but
  are not presented as the user's actual Antigravity bill.

**Alternatives considered**:

- Selecting one vendor for every story was rejected because correlated review failures weaken safety.
- Silently substituting outside the three approved ecosystems was explicitly rejected by the user.
- Freezing model names without an execution-time check was rejected because account catalogs drift.

**Sources**:

- [OpenAI Codex model guide](https://learn.chatgpt.com/docs/models)
- [OpenAI Codex pricing and usage](https://learn.chatgpt.com/docs/pricing)
- [Claude current models](https://platform.claude.com/docs/en/models/overview)
- [Claude model selection](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)
- [Claude effort controls](https://platform.claude.com/docs/en/build-with-claude/effort)
- [Claude Code models and usage](https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code)
- [Antigravity current models](https://www.antigravity.google/docs/models)
- [Antigravity headless CLI](https://www.antigravity.google/docs/cli/headless/)
- [Antigravity plans and quotas](https://www.antigravity.google/docs/plans)

## Decision 11: Use deterministic fixtures for correctness and live providers only for proof

**Decision**: Domain, contract, persistence, Windows fault, and UI acceptance use deterministic
fixture sessions and a fixture coordination bridge. Credentialed Codex/Claude tests separately prove
configuration, tool registration, lifecycle evidence, and manual fallback against an exact CLI
version. Model output is never an assertion oracle; tests inspect durable state, IPC events, host
controls, processes, and visible UI.

**Rationale**: Hosted/subscription availability cannot make core CI nondeterministic, and a model's
self-report cannot prove routing or process safety. Real-provider evidence remains essential but is a
separate release gate per provider and version.

**Alternatives considered**:

- Depending on live providers in CI creates quota and behavior instability.
- Treating a green unit suite as provider parity omits launch/configuration and packaged-artifact risks.

**Sources**:

- `vitest.config.ts`
- `specs/001-local-agent-workspace/research.md`

## Decision 12: Use revisioned SQLite shared memory with deterministic FTS retrieval first

**Decision**: Add workspace/mission-scoped shared-memory entries and immutable revisions to the
main-owned SQLite database. Entries are deliberately published as typed facts, decisions,
constraints, artifact references, or lessons; every revision carries author/session provenance,
source references, status, timestamps, and optional expiry. SQLite FTS5 indexes active revision text
for bounded local search. Supersede, contest, retract, expire, and delete are explicit state changes.

The first milestone does not add embeddings, a vector service, automatic transcript mining, raw
workspace crawling, or a graph renderer. Semantic retrieval remains a separately evaluated upgrade
that must prove deletion, isolation, resource use, relevance, and deterministic fallback.

**Rationale**: Munder Difflin's markdown-first memory and shared blackboard demonstrate the product
value, but ThreadHelm already has a transactional single-writer store. Revisioned records prevent
last-writer-wins knowledge loss, FTS5 is local and inspectable, and deliberate publication avoids
turning coordination into a transcript/secret archive.

**Alternatives considered**:

- A Git-backed `board.md`/per-agent `memory.md` layout duplicates persistence and modifies a second
  coordination tree.
- Automatic transcript summarization imports unrelated or sensitive material and makes deletion
  provenance unclear.
- Vector-only recall adds model/runtime cost and nondeterministic relevance before basic memory
  quality, conflict handling, and scoping are proved.

**Sources**:

- [Munder Difflin Hive design](https://github.com/chaitanyagiri/munder-difflin/blob/main/HIVE.md)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- `.specify/memory/constitution.md`

## Decision 13: Import Munder hire manifests only through a digest-bound review

**Decision**: Treat `munder-difflin/hire@1` files as portable, untrusted agent-profile data. Electron
main performs bounded strict parsing, documented normalization, compatibility evaluation, and a
SHA-256-bound preview/confirm flow. The stored profile and immutable revisions preserve `name`,
`description`, `goal`, `provider`, `model`, `capabilities`, `isolate`, `tokenCap`, `author`, and
`spec`; import itself launches nothing and grants no tools, workspace, role, budget, or authority.

The supplied ten Marvel manifests are manual acceptance inputs. Product tests use sanitized
representative fixtures so project-specific goals and user Downloads paths do not become ThreadHelm
defaults. `effort` remains runtime/session configuration because the observed schema does not define
it. Unsupported models stay visibly incompatible/disabled rather than being silently substituted.

**Reviewed acceptance baseline** (goal text was measured but not reproduced or executed):

| File | Name | Model request | Isolate | Token cap | Goal chars | SHA-256 |
|---|---|---|---:|---:|---:|---|
| `maria-hill-issue-triage.hire.json` | Maria Hill | `claude-sonnet-5` | true | 2000000 | 3296 | `88d8b9677c564e530c6a306878d62d08299e0c16a1e25a775e63863b0768eb31` |
| `black-panther-commerce-engineer.hire.json` | Black Panther | `claude-opus-5` | true | 2000000 | 1059 | `7cf5af78041346cb91eabcc1d485900097ad2c0a1d1cf4252fa5b38d9de49214` |
| `captain-america-pr-deployment-gatekeeper.hire.json` | Captain America | `claude-opus-5` | false | 2000000 | 1902 | `17a94e34540a37cc43b49a0df2c85af5da4851584a9c872475d5ef3ae189373b` |
| `doctor-strange-square-event-sentinel.hire.json` | Doctor Strange | `claude-opus-5` | true | 2000000 | 1205 | `2a0aa5268a3cc413d3598a5b9e660866a89ab7d7ca2bec7bc2462dea27345b3a` |
| `nick-fury-release-commander.hire.json` | Nick Fury | `claude-sonnet-5` | false | 2000000 | 1026 | `a0be866432d56d47bce9123425a37ff8dee0ee5cf1fb99cae0241dc919248521` |
| `she-hulk-spec-review-counsel.hire.json` | She-Hulk | `claude-sonnet-5` | true | 2000000 | 1412 | `17db7fa89b4403ecbd6e1aac66a0be62e86890e9539da3cb5728c423862eb7cb` |
| `shuri-ui-ux.hire.json` | Shuri | `claude-sonnet-5` | true | 2000000 | 1126 | `932ea6d8870af3fe9774bf310d457220febe306363032876016de671737f64c0` |
| `spider-man-quality-engineer.hire.json` | Spider-Man | `claude-sonnet-5` | true | 2000000 | 1126 | `18a234d108fccdce28cee2a12882431c2f1952eb3d1697b5aaca390d0e6c38e7` |
| `vision-authority-flags-architect.hire.json` | Vision | `claude-opus-5` | true | 2000000 | 1258 | `9b1cee77bdc0a4b740a7ad07709a161ca2a41eff0ceef3849d3d3f9838a86515` |
| `war-machine-devops-operator.hire.json` | War Machine | `claude-sonnet-5` | true | 2000000 | 1147 | `332ca412f71ada3f8238686836d0a76efc40bff85b2973fac20b457c4a3f2e6e` |

**Rationale**: This preserves the user's named agent style and makes the supervisor roster concrete
without allowing persona prose or capability labels to become an authorization channel. Immutable
digests/revisions also prevent a file from changing between review and import unnoticed.

**Alternatives considered**:

- Compiling Marvel profiles into ThreadHelm was rejected because the goals are user/project-specific.
- Auto-spawning after import was rejected because data import is not launch authority.
- Trusting names/capabilities as roles was rejected because a manifest could self-appoint privilege.
- Adding an `effort` field was rejected because it would extend the portable schema without evidence.

**Sources**:

- The ten user-supplied `*.hire.json` files reviewed on 2026-08-28
- `munder-difflin/hire@1` manifest shape and observed validation bounds
- `.specify/memory/constitution.md`

## Decision 14: Build agents from versioned, non-executable templates

**Decision**: Add a local step wizard whose draft is copied from blank fields, a generic shipped
starter, a user-saved template, or a reviewed profile revision. Shipped starters cover narrow generic
roles such as investigator, implementer, reviewer, quality verifier, documentation helper, and release
gatekeeper. They avoid provider-specific models where possible and do not include Marvel identities or
project goals. User templates and drafts are main-owned, revisioned, bounded, recoverable, and deletable.

Template variables are declared bounded text fields with literal substitution only. Final review
shows the exact `munder-difflin/hire@1` JSON and compatibility result. Saving as a profile reuses the
profile digest/confirmation contract; export uses an explicit user-selected target, atomic replace
preparation, collision/change detection, and a separate overwrite confirmation. Nothing auto-spawns.

**Rationale**: A wizard removes fragile hand-edited JSON while preserving the manifest as the portable
interchange format. Copy-on-create provenance makes drafts reproducible, and non-executable templates
avoid creating a second prompt/tool authority channel.

**Alternatives considered**:

- A free-form AI persona generator was deferred because it adds model cost, nondeterminism, and review complexity.
- Executable/conditional templates were rejected because scripts and expressions broaden authority.
- Bundled Marvel templates were rejected as user-specific branding/content; users may save them locally.
- Silent overwrite/export was rejected because it can destroy a reviewed external manifest.

**Sources**:

- [agent-profiles.md](contracts/agent-profiles.md)
- The reviewed `munder-difflin/hire@1` acceptance baseline above
- `.specify/memory/constitution.md`

## Decision 15: Make the supervisor autonomous inside a typed mission envelope

**Decision**: Model the supervisor as an ordinary provider session with a replaceable role, not as
Electron main and not as a privileged identity. The user first confirms a mission envelope containing
the objective, approved workspaces, eligible provider/profile set, worker/concurrency limits,
task/decomposition/retry/time/resource bounds, permitted routine actions, exact per-worker
automatic-start bindings, and escalation/stop rules.
The supervisor can then propose structured decompositions, assignments, retries, reassignments,
memory publications, completion, and escalation through the session-scoped bridge. Main validates
every operation, reserves and binds work leases, owns any pre-authorized process start, and performs
only actions allowed by the envelope. Every worker result returns through main to the bound
supervisor's mission inbox for synthesis; workers cannot choose an arbitrary peer or alternate return
recipient.

The loop is driven by durable state changes and provider safe-point evidence, never by idle UI
polling. Destructive, privileged, external, spending, credential, permission, workspace-expanding,
and materially scope-changing branches always pause for exact user authority. Invalid output,
equivalent decisions, lease conflicts, ambiguous delivery, budget exhaustion, or supervisor loss
pause safely without replay.

**Rationale**: This provides genuine unattended routine coordination while retaining ThreadHelm's
constitutional authority boundary. Intelligence may change with the selected ChatGPT/OpenAI,
Claude, or Antigravity execution model; safety and recovery do not depend on its prompt compliance.

**Alternatives considered**:

- A prompt-only god agent can silently reinterpret criticality and has no enforceable resource or
  workspace boundary.
- Embedding supervisor reasoning inside Electron main couples model behavior to the authority layer
  and makes replacement/testing harder.
- Fully manual approval for every assignment is safe but does not satisfy autonomous supervision.
- A prompt-authorized or silently substituted worker launch was rejected because only the reviewed
  mission envelope can authorize an exact profile-revision/runtime/workspace binding.

**Sources**:

- [Munder Difflin Hive design](https://github.com/chaitanyagiri/munder-difflin/blob/main/HIVE.md)
- `.specify/memory/constitution.md`

## Decision 16: Resolve provider permission mode at launch, never from persona data

**Decision**: Treat permission mode as main-owned runtime policy alongside model, effort, isolation,
workspace, tools, and resource bounds. Agent names, goals, capability labels, templates, and imported
Munder manifests remain static context and cannot select or inherit permissions. A user may rename the
supervisor and every worker without changing this policy.

For Claude, ThreadHelm distinguishes the provider's current `auto` classifier from
`bypassPermissions`. A supervisor-started worker may use real `--permission-mode auto` only after the
exact installed CLI, selected model/provider surface, and organization policy prove it available. If
that proof is missing, stale, or fails, main holds the assignment for Manual or bounded-allowlist
handling and never falls through to bypass. Bypass is a direct one-run break-glass choice that requires
a fresh container, VM, or provider-supported sandbox runtime proving child-process containment,
disposable-workspace-only writes, no unrelated credential/environment inheritance, network limited to
provider/control endpoints plus exact task-approved destinations, and verified process/workspace/config
cleanup. It cannot be persisted, mission-pre-authorized, inherited, or restored.

Auto mode addresses permission prompts, not runaway reasoning or opaque provider delay. ThreadHelm
therefore independently owns elapsed/turn/resource bounds, no-progress detection, live structured
progress, cancellation, and distinct permission/classifier/timeout/budget/unknown outcomes. Main
routes every worker result back to the bound replaceable supervisor; unknown completion is not replayed.

**Rationale**: Munder's local roster hardcodes Claude `bypassPermissions` and its command reference
describes that as “auto mode,” but current Claude Code exposes `auto` and `bypassPermissions` as
separate modes with different trust assumptions. Keeping permission policy outside persona data allows
ThreadHelm to use the safer current classifier without making custom agents privileged or permanently
coupling stored profiles to one provider version.

**Alternatives considered**:

- Persisting bypass in every custom agent was rejected because rename/template/import operations would
  silently carry machine authority into unrelated work.
- Treating current auto mode as equivalent to bypass was rejected because it removes the classifier and
  requires an isolation boundary that ordinary local workspaces do not provide.
- Falling back from unavailable auto to bypass was rejected because capability loss must narrow or hold
  authority, never widen it.
- Relying on auto mode alone for usage control was rejected because permission classification does not
  bound turns, elapsed time, provider cost, or no-progress behavior.

**Sources**:

- [Claude Code permission modes](https://code.claude.com/docs/en/permission-modes)
- [provider-coordination.md](contracts/provider-coordination.md)
- `.specify/memory/constitution.md`
