# Workspace Recon: a proposed roster from a confirmed assessment session

**Status:** Design approved in conversation on 2026-09-02; awaiting owner review of this written
spec.

**Scope:** One optional, owner-confirmed agent session per workspace that reads the approved
folder and writes a proposed roster — one supervisor plus a set of specialists — as
`AgentManifestV1` files. Every proposed role is reviewed and accepted individually through the
existing profile-import gate. Nothing is hired automatically and nothing gains authority.

**Reference material**

- `docs/roadmaps/verified-mission-os.md` — approved product rules, particularly rules 1, 2, 4, 7
  and 8, and the Stage 1 reuse table.
- `specs/002-agent-mailbox-routing/contracts/agent-profiles.md` — the manifest contract this
  feature produces.
- `.specify/memory/constitution.md` — Windows-first/local-first operation, orchestration over
  visual theater, restrained presentation.
- `packages/domain/src/agent-profile.ts` — `parseAgentManifest`, the untrusted-manifest boundary
  this feature routes through.

## Why

ThreadHelm can already run a roster of configured specialists, but it cannot help you build one.
Today an empty install means hand-authoring a manifest per role, guessing at goals and capability
labels, with no reference to what is actually in the repository you just approved. The knowledge
needed to write a good roster — that this tree is a pnpm workspace with a Rust N-API addon, a
Playwright Electron suite, and a Spec Kit gate before implementation — is sitting in the repo,
unread.

An agent can read it. This feature gives you a way to ask one to, under the same confirmation,
disclosure and containment rules as every other session ThreadHelm launches, and to get back a
draft roster you review rather than a squad that appears.

## Owner decisions recorded here

1. **Recon is offered after workspace approval, never automatic.** Approval completes exactly as
   it does today. The workspace then shows an empty roster region with a `Run recon` action.
2. **Recon is a normal session.** Same preflight, same launch disclosure, same ConPTY, same
   `KILL_ON_JOB_CLOSE` Job Object, same interrupt/stop/force-stop controls, same terminal dock
   presence. It is not a new launch path.
3. **Recon proposes both the supervisor and the specialists, and never proposes a name.** It
   proposes role shape — goal, model, token cap, capability labels — tuned to this repository.
   Display names ship blank for the owner to fill. This satisfies roadmap rule 2 literally: the
   model chooses the role, the owner chooses the persona.
4. **The return channel is files, not the transcript.** Recon writes manifests to a
   ThreadHelm-owned directory outside the workspace; ThreadHelm reads that directory through
   `parseAgentManifest`. No terminal output is scraped, stored, or interpreted, so roadmap rule 8
   holds without exception.
5. **The roster records the commit it was derived from.** A `derivedFromCommit` field is written
   at recon time. No staleness UI ships in this feature; the field exists because it cannot be
   reconstructed later.
6. **This ships standalone against the existing profile machinery.** It does not wait on Stage 1
   Verified Mission Delegation. Agent profiles, manifests, digests, revisions and compatibility
   already exist and are tested.

## Non-goals

- Automatic hiring. Recon proposes; acceptance is per role and explicit.
- Any grant of authority. An accepted profile has exactly the standing any imported profile has.
- Reading git history, prior transcripts, agent reasoning, or credentials.
- A staleness badge or re-run prompt. The field ships; the surface does not.
- Sharing or syncing rosters between machines.
- Anything in Stage 2 (worktrees, GitHub authentication, push, PR creation).

## The honesty boundary

**ThreadHelm cannot enforce read-only on a CLI agent.** A recon session is a real agent process
with the same reach as any other session in that workspace. The recon prompt asks for a read-only
assessment; the product does not claim to guarantee one.

The launch disclosure therefore reuses the standard access-boundary warning verbatim and adds no
softer language. There is no "read-only scan" wording anywhere in this feature. This is the same
discipline as honest recovery: the interface reports what the application can prove, and the
application can prove containment and disclosure, not agent restraint.

## Trust model

A manifest written by a recon agent is untrusted portable data, exactly as a manifest downloaded
from the internet is. It passes through the same parser, the same size bound, the same strict
schema, the same SHA-256 digest, and the same preview-then-confirm gate. Capability labels and
goals are inert presentation data. Unknown fields are rejected rather than ignored.

This means recon introduces **no new trust boundary**. It introduces a new *producer* of data that
an existing boundary already handles.

## Phase 1: the recon run

### 1.1 Entry point

The workspace view gains a roster region. With no accepted profiles and no recon run it reads:

> No roster yet. Recon can read this workspace and propose one.
> `[Run recon]`

The region is honest about absence — it never displays a speculative or default squad.

### 1.2 Launch disclosure

`workspaceRecon.previewLaunch` returns the same fields the session launch disclosure already
resolves, plus recon-specific bounds:

| Field | Source |
| --- | --- |
| Agent, version, effective executable path | existing preflight probe |
| Workspace path and access-boundary warning | existing launch disclosure, unmodified |
| Model and effort | existing resolution order |
| Token cap for this run | recon-specific, fixed |
| Output directory | `%LOCALAPPDATA%\ThreadHelm\recon\<workspaceId>\<runId>\` |
| Statement that nothing is hired automatically | recon-specific |

One confirmation, as with any session.

The token cap is fixed rather than owner-adjustable — specifically a module constant disclosed as `tokenCapRequested` — because ThreadHelm has no token accounting and carries the number to the agent in the prompt: a control over a value the application cannot enforce would present the owner with a ceiling they do not have.

### 1.3 The session

`workspaceRecon.confirmLaunch` starts an ordinary session carrying a fixed recon prompt. The
session appears in the session list and terminal dock, is selectable, and can be interrupted,
stopped or force-stopped by the existing controls. Closing the app with a recon session active is
blocked exactly as it is for any other session.

The prompt instructs the agent to:

- read manifests, lockfiles, workspace configuration, CI definitions, test configuration,
  `README`, `CONTRIBUTING`, and the directory shape;
- write one `threadhelm/agent-profile@1` JSON file per proposed role into the output directory;
- leave `name` blank in every file;
- propose one supervisor and between three and eight specialists;
- write nothing inside the workspace.

The last two are prompt requests, not enforced invariants. Section 1.4 bounds what happens when
they are not honoured.

### 1.4 Collection

When the session exits, ThreadHelm reads the output directory:

- at most 12 files are considered; the rest are reported as ignored;
- each file is read under the existing `MAX_MANIFEST_BYTES` (64 KiB) bound;
- each is parsed by `parseAgentManifest`, which returns a stable `ThreadHelmError` per failure.

`workspaceRecon.listProposals { runId }` returns `{ parsed[], rejected[{ file, errorCode }] }`.
Rejected files are shown with their reason rather than silently dropped — a recon run that produced
four good roles and one malformed file reports exactly that.

### 1.5 Acceptance

The proposal view lists parsed roles, supervisor first. Each has a `Review` action that opens the
existing profile preview, showing the parsed manifest, its digest and its compatibility result.
Confirming calls `profiles.confirmImport` unchanged. The owner fills the display name here.

Accepted profiles are stamped with `reconRunId` and `derivedFromCommit`. `derivedFromCommit` is
null when the approved folder is not a Git working tree; the field records what was observed, and
absence is recorded as absence rather than as an empty string.

Nothing on this screen accepts more than one role at a time, and there is no accept-all control.

### 1.6 Repeat runs and cleanup

Recon may be run again at any time. Only the most recent run's proposals are listed; proposals from
an earlier run that were never accepted are discarded when a new run starts — specifically once
its session has launched — because a proposal derived from a tree that has since moved is not
evidence about the current tree. Waiting for the new run to finish would keep a stale roster on
screen and leave it ambiguous which run the proposal list describes. A launch that is refused
starts no run and discards nothing. Profiles already accepted are unaffected — they are profiles
now, not proposals.

A run's output directory is deleted once its proposals are collected and classified. A run that is
stopped or produces nothing has its directory deleted on the next recon run for that workspace, so
a crash mid-run cannot leave the collection step reading a previous run's files.

## Phase 2: contract surface

New operations:

| Operation | Request | Response |
| --- | --- | --- |
| `workspaceRecon.previewLaunch` | `{ workspaceId }` | recon launch disclosure view |
| `workspaceRecon.confirmLaunch` | `{ confirmationToken, boundaryConfirmation: true }` | `{ runId, sessionId }` |
| `workspaceRecon.listProposals` | `{ runId }` | `{ parsed[], rejected[] }` |

One extension: `profiles.previewImport` accepts a proposal reference alongside its existing
`fileHandle`, so a proposed role reaches the preview without routing through the file picker.

Everything else is reuse: `parseAgentManifest`, digest and revision handling, compatibility
evaluation, `profiles.confirmImport`, session preflight, ConPTY, Job Objects, session lifecycle,
and the close-with-active-sessions block.

## Phase 3: outcomes kept distinct

Roadmap rule 7 requires that outcomes not collapse into a single failure. A recon run resolves to
exactly one of:

| Outcome | Meaning |
| --- | --- |
| `completed` | session exited and at least one manifest parsed |
| `no_output` | session exited without writing to the output directory |
| `unparsable_output` | files were written; none parsed |
| `partial` | some parsed, some rejected |
| `stopped_by_owner` | interrupt, stop or force stop |
| `token_cap_reached` | run bound consumed |
| `provider_unauthenticated` | preflight or the session reported no valid authentication |

No blanket "recon failed". No automatic retry from any of these states.

## Testing

**Fixtures.** `packages/test-fixtures` gains a recon mode for the deterministic fake terminal
agent: it writes a canned set of manifests to a directory given on its command line. Every test
below runs with no credentials, no network, and no token spend.

**Unit.** Collection bounds — the twelfth-plus file is ignored, an oversized file is rejected by
size before parse, a malformed file yields its stable error code. Outcome classification maps each
of the seven states from observable session and directory facts.

**Contract.** The three new operations validate request and response shape; `previewLaunch`
carries the unmodified access-boundary warning text; `confirmLaunch` refuses without the boundary
confirmation.

**Integration (Windows).** A recon session runs in its own utility process and Job Object; force
stop terminates it; the output directory lives outside the workspace and the workspace tree is
unmodified after the run.

**E2E.** Approve a workspace, run recon against the fixture agent, see the proposal list with one
rejected file reported by reason, accept two roles, confirm exactly two profiles exist and that
their display names are the ones typed by the user rather than any value from the manifest.

**Accessibility.** The roster region, proposal list and rejected-file list are keyboard reachable
with visible focus; the empty state is announced; no decorative motion.

## Sequence

1. Contracts: the three operations, the proposal views, the outcome enum.
2. Domain: collection bounds and outcome classification, with unit tests first.
3. Fixture recon mode.
4. Main: the recon coordinator — launch, watch the output directory, collect, classify.
5. Renderer: roster region, empty state, proposal list, per-role review handoff.
6. Integration and E2E.

Phases 1 through 3 of this document are one implementation plan. There is no second feature hiding
inside it.
