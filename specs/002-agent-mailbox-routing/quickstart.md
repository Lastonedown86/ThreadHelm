# Quickstart Validation: Durable Hive Coordination

This guide validates the feature after implementation. It exercises deterministic fixtures first;
live provider and installed-artifact evidence remain separate gates.

## Prerequisites

- Supported Windows 11 client release with PowerShell.
- Node.js 22+, pnpm 11, Rust stable/MSVC, and Visual Studio Desktop C++ build tools.
- Cleanly installed project dependencies.
- For optional live proof: authenticated Codex CLI and Claude Code. Google Antigravity is used for
  story execution/model assignment, not added as a ThreadHelm runtime provider by this feature.
- Preserve unrelated working-tree changes. Run all gates sequentially to avoid native/package-store
  races.

Reference contracts:

- [coordination-domain.md](contracts/coordination-domain.md)
- [desktop-ipc.md](contracts/desktop-ipc.md)
- [provider-coordination.md](contracts/provider-coordination.md)
- [session-host.md](contracts/session-host.md)
- [shared-memory.md](contracts/shared-memory.md)
- [agent-profiles.md](contracts/agent-profiles.md)
- [agent-templates.md](contracts/agent-templates.md)
- [supervisor.md](contracts/supervisor.md)
- [data-model.md](data-model.md)

## 1. Confirm feature and repository state

```powershell
git status --short --branch
Get-Content -Raw .specify\feature.json
```

Expected:

- Active Spec Kit feature resolves to `specs/002-agent-mailbox-routing`.
- Any unrelated local changes are identified and preserved before implementation/testing.
- Do not claim branch, remote, or test status from an earlier run.

## 2. Confirm story execution models before assignment

```powershell
codex --version
claude --version
agy --version
agy models
```

Also use Claude Code `/model` and `/status`, and the current Codex app model selector/inventory.

Before any provider CLI session starts, review the displayed provider/model/effort resolution plus the
separate runtime permission policy and source. Changing model, effort, or permission automatically
refreshes the bound preview; there is no separate settings-review button. The one checkbox confirms
only the folder-access boundary. Model/effort priority is one-run override > exact agent/profile
revision request > task-type/project policy > CLI default. Permission priority is one-run selection >
task/project policy > provider default, excluding profiles, personas, templates, missions, and
persisted bypass. Readiness probes and app load do not prompt. Automated tests run without an LLM.
Routine test authoring/failure analysis recommends the lowest-cost capable approved model at
low/medium effort; explicitly select or record escalation for high-cost/high-effort. Planning may use
only ChatGPT/OpenAI, Claude, or Google Antigravity; runtime remains Codex CLI and Claude Code. Effort
and permission policy are not hire-manifest fields.

Expected assignments:

| Story | Primary | Fallback |
|---|---|---|
| P1 | OpenAI `gpt-5.6-sol` / `high` | `gpt-5.6-terra` / `xhigh` |
| P2 | Antigravity `gemini-3.7-flash-medium` | `gemini-3.6-flash-medium` |
| P3 | Claude `claude-opus-5` / `high` | `claude-sonnet-5` / `xhigh` |
| P4 | OpenAI `gpt-5.6-sol` / `max` | `gpt-5.6-terra` / `max` |
| P5 | Antigravity `gemini-3.1-pro-high` | `gemini-3.7-flash-medium` |
| P6 | Claude `claude-sonnet-5` / `high` | `claude-opus-5` / `high` |
| P7 | OpenAI `gpt-5.6-terra` / `high` | `gpt-5.6-sol` / `high` |
| P8 | OpenAI `gpt-5.6-sol` / `max` | `gpt-5.6-terra` / `max` |

If a primary and its approved in-ecosystem fallback are unavailable, leave that story unassigned.
Do not substitute another provider ecosystem or an unreviewed older model.

For the current US7 cycle, use the OpenAI assignment above. Do not start, probe, or otherwise invoke
Claude Code or Antigravity for US7 unless the owner first authorizes that specific external run. A
historical availability record does not supply that authorization; deterministic tests remain runnable
without an LLM.

## 3. Install and build foundations

```powershell
$env:CI = 'true'
pnpm install --frozen-lockfile
pnpm native:build
pnpm desktop:build
```

Expected:

- The native package builds both the Windows supervisor module and packaged coordination bridge.
- The desktop build includes the helper at the declared installed-artifact path.
- No provider/global/project coordination configuration is written during build.
- No graph/office/animation dependency is added for memory or mission status.

## 4. Validate domain and persistence

```powershell
pnpm exec vitest run --project unit tests/unit/domain/coordination.test.ts
pnpm exec vitest run --project unit tests/unit/persistence/coordination.test.ts
pnpm exec vitest run --project unit tests/unit/domain/shared-memory.test.ts
pnpm exec vitest run --project unit tests/unit/domain/supervisor.test.ts
pnpm exec vitest run --project unit tests/unit/persistence/shared-memory.test.ts
pnpm exec vitest run --project unit tests/unit/persistence/supervisor.test.ts
```

Expected:

- Every legal/illegal conversation, delivery, attempt, outcome, and escalation transition passes.
- Recipient count, 16 KiB body, 100 open conversations, 128 handoffs, 64 MiB retained content,
  depth eight, repeat threshold three, failure threshold three, and two-minute token rules pass.
- Migration v1→v2 is transactional and preserves existing session/recovery data.
- Only one active and one applied attempt are possible per handoff.
- Dispatching attempts recover to unknown and never enqueue input.
- Content deletion removes purpose/body/fingerprint/size from ordinary reads.
- Migration v3 preserves coordination state and transactionally creates memory/mission/lease indexes.
- Memory revisions, conflicts, FTS rows, mission envelopes, DAGs, decisions, attempts, and leases obey
  their state, scope, uniqueness, quota, and recovery invariants.

## 5. Validate typed interfaces and bridge isolation

```powershell
pnpm exec vitest run --project contract tests/contract/desktop-ipc-coordination.test.ts
pnpm exec vitest run --project contract tests/contract/provider-coordination.test.ts
cargo test --manifest-path native/windows-supervisor/Cargo.toml coordination_bridge
```

Expected:

- Wrong origin, session, recipient, workspace, causal parent, token, state, or schema fails closed.
- List/events omit message bodies; detail/preview returns only explicitly requested content.
- Bridge tools can access only their authenticated session's pending items and causal replies.
- Bridge cannot choose sender, arbitrary recipient, database path, workspace path, or terminal input.
- Invalid/oversized JSON-RPC, duplicate initialization, expired credential, and disconnect degrade to
  manual mode without stopping the agent session.

## 6. Validate P1 directed handoffs on Windows

```powershell
pnpm exec vitest run --project integration tests/integration/windows/coordination-delivery.test.ts
```

Expected:

- User previews and confirms one durable handoff, then separately reviews presentation.
- Recipient must be the selected, live, unchanged session at final confirmation.
- Source, recipient, workspace, content, persistence, activity evidence, and manual risk are exact.
- The existing session control queue applies one envelope to one recipient in total order with user
  input, resize, interrupt, and stop.
- 1,000 injected duplicates/retries create no duplicate logical or applied delivery.
- Crash/failure before write is safely retryable by explicit user action; crash/lost evidence after
  submission becomes unknown and is never resent automatically.
- Other sessions, workspace leases, terminal streams, and lifecycle state remain unchanged.

## 7. Validate P2 conversations, replies, restart, and deletion

```powershell
pnpm exec vitest run --project integration tests/integration/windows/coordination-recovery.test.ts
pnpm exec playwright test tests/e2e/coordination.spec.ts --grep "auditable conversation"
```

Expected:

- Fixture bridge acknowledges and creates a causally linked reply as its authenticated session.
- Transport state never changes work outcome without separate structured evidence.
- Restart restores queued, held, delivered, acknowledged, and outcome state without replay/resend.
- Deleting a resolved/closed conversation removes content but keeps content-free lifecycle evidence.
- Conversation lists do not receive bodies; opening detail is explicit and bounded.

## 8. Validate P3 lifecycle-aware delivery

```powershell
pnpm exec playwright test tests/e2e/coordination.spec.ts --grep "safe lifecycle"
pnpm exec vitest run --project integration tests/integration/windows/coordination-delivery.test.ts --testNamePattern "safe point|manual fallback|power"
```

Expected:

- Structured safe-point evidence enables one allowed presentation for the exact proved provider
  fixture/version.
- Unknown activity, hook/config failure, unsupported version, stopped/failed/recovery-required state,
  lock, suspend, resume, and restart stay queued/manual and perform no input injection.
- No prompt regex, terminal text, quiet timer, CPU, process existence, or bridge connection is accepted
  as readiness evidence.
- Provider A failure does not change provider B or unrelated sessions.

## 9. Validate P4 bounds and human escalation

```powershell
pnpm exec playwright test tests/e2e/coordination.spec.ts --grep "bounded coordination"
pnpm exec vitest run --project unit tests/unit/domain/coordination.test.ts --testNamePattern "depth|loop|failure|authority|closed"
```

Expected:

- Automatic continuation is off by default and requires exact participant/scope disclosure.
- Ninth reply, third equivalent item, and third consecutive delivery failure pause before presentation.
- Request/query/proposal/conflict/authority-required/unknown acts remain held.
- Refusal/failure/conflict is visible and never rewritten as success.
- Paused/closed conversations cannot resume from a later message.
- Human `continue`, `redirect`, or `close` applies once to the exact escalation.
- Message content does not approve destructive, privileged, external, spending, scope, workspace, or
  provider-permission changes.

## 10. Validate P5 shared hive memory

```powershell
pnpm exec vitest run --project contract tests/contract/shared-memory.test.ts
pnpm exec vitest run --project integration tests/integration/windows/shared-memory.test.ts
pnpm exec playwright test tests/e2e/hive-memory.spec.ts
```

Expected:

- Searches return only the authenticated workspace/mission scope with author, sources, revision, and status.
- Conflicting claims remain contested until an attributable resolution revision; no model score decides truth.
- Superseded/retracted/expired entries are excluded by default and deletion removes content plus FTS rows.
- Terminal streams, transcripts, reasoning, environment, credentials, and workspace files are never ingested implicitly.
- With 10,000 revisions, 95% of bounded searches complete within 500 ms on the recorded Windows hardware.
- The memory view is a keyboard-accessible list/detail surface with no graph, force layout, or animation.

## 11. Validate P6 reviewed Marvel agent roster

```powershell
pnpm exec vitest run --project unit tests/unit/domain/agent-profile.test.ts
pnpm exec vitest run --project contract tests/contract/agent-profiles.test.ts
pnpm exec vitest run --project integration tests/integration/windows/agent-profile-import.test.ts
pnpm exec playwright test tests/e2e/agent-roster.spec.ts
```

Expected:

- The ten supplied Marvel manifests preview with exact schema fields, source basenames, SHA-256
  digests, compatibility reasons, and confirmation bound to unchanged content.
- Four Opus and six Sonnet preferences, eight isolation requests and two non-isolated requests, and
  each two-million token cap are preserved as requests rather than effective authority.
- Import launches no session, edits no provider/project settings, creates no worktree, and grants no
  workspace, tool, budget, or mission role.
- Unsupported/malformed/duplicate/changed-after-preview cases fail closed or remain visibly disabled;
  no provider/model substitution occurs.
- Marvel names and role descriptions appear in a keyboard-accessible compact roster without avatars,
  character art, topology, or animation.

Manual acceptance reads the ten files from their user-selected locations and records only basenames,
digests, and results in execution evidence. It does not copy those files into the repository.

## 12. Validate P7 agent creation wizard and templates

```powershell
pnpm exec vitest run --project unit tests/unit/domain/agent-template.test.ts
pnpm exec vitest run --project unit tests/unit/persistence/agent-templates.test.ts
pnpm exec vitest run --project contract tests/contract/agent-templates.test.ts
pnpm exec vitest run --project integration tests/integration/windows/agent-profile-wizard.test.ts
pnpm exec playwright test tests/e2e/agent-profile-wizard.spec.ts
```

Expected:

- Blank, generic-template, user-template, and reviewed-profile starts create independent resumable drafts.
- Identity, role/goal, capability, runtime-request, isolation/budget, and review steps validate without
  exposing tools, workspace, mission role, effort, or authority as manifest fields.
- Final review shows exact JSON, compatibility, template provenance, literal substitutions, and the
  exact save-as-profile or export effect before confirmation.
- Save-as-profile passes the same strict/digest profile path; export rechecks the selected
  `*.hire.json` target and never overwrites without a separate confirmation.
- Restart, cancellation, stale template, unresolved variable, target collision, and write failure
  retain an honest recoverable state and launch no session.
- Shipped templates are narrow, generic, text-only roles; locally saved Marvel templates remain user data.
  Production builds and packaging reject private persona fixture modules/content, including stale
  output chunks. The desktop imports only the narrow generic fixture/runtime entry; the personal
  roster fixture barrel remains test-only.

Manual desktop acceptance:

1. In **Agent templates**, choose **Create agent…**, select **Quality specialist (bundled)**,
   and use Next through Identity, Role and goal, Capabilities, Runtime requests, and Review.
   Change the name and goal, use Back, then **Save draft and close**. Restart ThreadHelm and
   resume the saved draft; verify the same values and step.
2. Review the exact JSON and digest. Check **I reviewed this exact manifest**, then **Save
   profile**. Verify one reviewed profile appears and no session launches.
3. Create another draft, choose **Export…**, and select an existing `*.hire.json` file. The
   full selected target must appear. **Confirm export** stays disabled until **Replace this
   existing file** is checked. Canceling the native picker or export confirmation changes no file.
4. Import a reviewed local Marvel profile through the existing profile-import dialog. Start a
   wizard from that reviewed profile, customize its name, review it, then choose **Save as
   template…** and **Confirm save template**. Close the draft, open template Details, and verify
   its reviewed-profile provenance. Disable, enable, and duplicate the local template; delete the
   duplicate. A template used by an open draft cannot be deleted until that draft is removed.
5. Verify all six bundled starters remain generic and immutable, with no Marvel names, project
   goals, character art, or launch action. Local theme/style remains ordinary name/description
   text and never becomes a manifest authority field.

Every action is available with Tab, Shift+Tab, Enter, Space, and the native select keys. An invalid
field stays visible and blocks Next; draft saving preserves incomplete bounded text. If an export
does not report success, inspect the target before retrying. Unknown export effects are recorded
locally and are never replayed on restart. This acceptance recipe does not authorize a provider run.

## 13. Validate P8 bounded autonomous supervision

```powershell
pnpm exec vitest run --project contract tests/contract/supervisor.test.ts
pnpm exec vitest run --project integration tests/integration/windows/supervisor-mission.test.ts
pnpm exec playwright test tests/e2e/supervisor-mission.spec.ts
```

Expected:

- The user confirms exact mission objective, scopes, eligible profiles, concurrency, retry/time/resource
  limits, routine actions, escalation rules, and any exact per-worker automatic-start bindings,
  including runtime permission policy/source and capability evidence, before autonomy starts.
- One ordinary supervisor decomposes and assigns only valid DAG work to approved worker/workspace pairs.
- With a confirmed binding, main can reserve the work/workspace, start an offline ordinary worker,
  bind the resulting session, and deliver without a second prompt; launch drift or substitution holds.
- Claude automatic workers use supported real auto mode. Unsupported or failed auto holds for Manual or
  bounded-allowlist handling and never silently enters bypass. Bypass remains a separate isolated
  one-run break-glass launch with fresh process/filesystem containment, disposable-workspace-only
  writes, bounded credential/environment/network exposure, and verified cleanup; it is not stored in
  any persona, profile, template, mission, or recovery.
- Permission denial, classifier failure, timeout, cancellation, no-progress, budget exhaustion, and
  unknown completion remain distinguishable, bounded, and attributable in the supervisor result path.
- Every worker's structured result and deliberate artifact/evidence references return through main to
  the bound supervisor mission inbox; transcripts and implicit workspace contents do not.
- Conflicting write leases, 65th work item, depth nine, fourth attempt, third equivalent decision,
  exhausted budget, invalid output, and supervisor loss pause safely.
- Known-safe failures may be reassigned inside bounds; unknown attempts are never replayed automatically.
- Destructive, privileged, external, spending, credential, permission, workspace-expanding, and
  scope-changing branches require exact user authority.
- Restart preserves mission/work/memory/decision/lease evidence but launches or resumes nothing.

Manual desktop acceptance (use disposable folders and generic reviewed profiles):

1. Launch an ordinary supervisor and a worker with their intended provider/model/effort and runtime
   permission selections. In **Missions**, choose **New mission…**. Enter the objective and completion
   evidence, select the supervisor profile/session, and add the worker profile/session. A profile
   alone does not create an eligible running session or grant a mission role.
2. Review every workspace's read/write mode, worker role, and mission ceiling. For an offline worker,
   opt into automatic startup explicitly and set its exact runtime and execution limits. Choose
   **Review mission** and inspect the profile revision/digest, native folder identity, permission source,
   capability evidence, requested/effective isolation, and held reasons before confirming the boundary.
   No provider substitution or bypass is authorized by this confirmation.
3. Inspect **Work and dependencies**, **Decision history**, **Attempts, starts and results**, and
   **Workspace leases** in mission detail. Deliberate objective/evidence text belongs in this detail
   view; the mission list and live event payloads carry bounded lifecycle metadata only.
4. Choose **Pause mission**. Resuming requires selecting an eligible supervisor and pressing
   **Resume mission**. **Revise envelope…** requires a fresh exact review; it does not silently widen
   the previous authorization. Held-work controls do not approve consequential work.
5. Close and restart the app with unfinished work. Confirm **recovery required**, no restarted worker,
   and no replay of an unknown attempt. Inspect prior effects before choosing any explicit recovery
   action. An unavailable or changed provider leaves the binding held.
   For an unknown effect, stop the prior worker, choose **Inspect unknown effect…**, and explicitly
   acknowledge inspection of that exact work. Main independently checks the prior process scope.
   This releases an eligible unknown hold without retrying, completing, or resuming its work.
6. Choose **Cancel mission…**, confirm the exact mission cancellation, then **Delete mission
   content…** and confirm that separate content deletion. The objective, work descriptions and decision
   content disappear while the lifecycle evidence remains. Deletion does not erase external effects.

The built-in Claude capability evidence currently does not authorize `auto`: organization policy is
unknown. The previous disposable auto proof is evidence for its exact run, not permission for a new
runtime. A held binding must remain held until current trusted capability evidence supports the exact
launch. Authentication alone is insufficient. Deterministic fixture acceptance does not establish a
live provider result or human acceptance.

## 14. Validate accessibility, responsiveness, and idle cost

```powershell
pnpm exec playwright test tests/e2e/coordination.spec.ts
pnpm exec vitest run --project integration tests/integration/windows/performance.test.ts
```

Expected:

- Composition, confirmation, presentation, conversation review, pause, cancel, retarget, deletion,
  memory search/detail, profile import/roster, wizard/template management, mission review, work inspection, and escalation are keyboard complete with
  visible focus and accessible names.
- Delivery state and work outcome use distinct accessible labels.
- Four sessions plus 100 queued handoffs remain responsive; 95% of operations acknowledge within one
  second and recovery view appears within five seconds.
- A 60-second idle period produces no polling-driven user-visible updates, graph simulation,
  animation, or decorative motion.

## 15. Run the complete local quality sequence

```powershell
pnpm format
pnpm lint
pnpm rust:fmt
pnpm rust:check
pnpm rust:test
pnpm typecheck
pnpm test:unit
pnpm test:contract
pnpm desktop:build
pnpm proof:windows-supervision
pnpm test:integration:windows
pnpm test:e2e
```

Record each final exit code and summary separately. A later pass does not erase an earlier failure,
and local results do not imply hosted CI or installed-artifact readiness.

## 16. Installed artifact and live provider proofs

```powershell
pnpm package:win
$env:THREADHELM_ARTIFACT = 'C:\path\to\ThreadHelm.exe'
pnpm test:acceptance:installed
$env:THREADHELM_PROVIDER_SMOKE = '1'
pnpm test:smoke:providers
```

`THREADHELM_ARTIFACT` points to the packaged or installed **ThreadHelm.exe**, not a Setup executable.
Artifact acceptance starts that app but does not install/uninstall Squirrel. The provider smoke
command separately drives the development build with installed CLIs; it proves readiness and process
lifecycle only. It does not prove a live mission, Claude auto/classifier behavior, actual read/edit/test
work, or installed mission integration. The expanded `provider-coordination-smoke.test.ts` suite is
deterministic main/SQLite/bridge coverage; `THREADHELM_PACKAGED_APP` adds packaged bridge lookup only.
Keep those evidence categories separate when recording T148/T149/T157.

ThreadHelm will be distributed unsigned, per the owner's 2026-08-30 decision. Artifact acceptance
allows `NotSigned` or `Valid` on the app and every unpacked native executable, DLL and addon;
invalid or unrecognized signature states still fail. No unsigned-test override is required.
The report records `distributionPolicy: unsigned`, each unsigned file, and whether publisher trust
was verified for the app. Passing this policy does not establish a trusted publisher: Windows may
show an unknown-publisher or reputation warning. Published SHA-256 checksums, production fuses,
ASAR integrity, architecture, private-persona exclusion, and install/uninstall checks remain required.

For each provider proof, record:

- installed ThreadHelm artifact identity and version;
- Windows version/architecture;
- provider CLI version and authenticated state;
- bridge configuration path/scope and proof that user/project/global settings were unchanged;
- bridge connection, structured reply, and manual fallback result;
- scoped memory search/publish behavior and proof that cross-scope access is rejected;
- reviewed profile revision, effective provider/model/effort/isolation/budget disclosure, and proof
  that manifest fields did not expand the session tool or workspace registry;
- worker versus bound-supervisor tool registry and proof that worker sessions cannot mutate missions;
- one bounded autonomous fixture mission including assignment, known-safe reassignment, and human escalation;
- exact lifecycle evidence and whether automatic presentation is approved for that provider/version;
- Job Object cleanup after bridge/provider/main failure; and
- confirmation that logs/database metadata contain no raw terminal, hook, transcript, token, credential,
  or unrelated workspace content.

Codex and Claude are separate statuses. If only one provider passes the lifecycle proof, only that
provider/version may advertise `structured_safe_point`; the other remains `manual_only`.

Release records must also distinguish a locally built x64 artifact from its signature status, an
ARM64 installed run, uninstall cleanup, hosted CI, named model review, and owner acceptance. Scan the
actual ASAR and unpacked resources for private persona material; inspecting source imports alone is
insufficient. User-selected local Marvel profiles remain personal data and must never become bundled
starters, default seed data, screenshots, or production fixtures.

Rollback/recovery: preserve the user-data directory before changing application versions. Do not
remove additive tables, reset the SQLite schema version, or use an older binary to resume unfinished
missions. Recovery is inspection-first: unknown delivery/start/write outcomes are never automatically
retried. Restoring a database does not undo provider filesystem or external effects.
