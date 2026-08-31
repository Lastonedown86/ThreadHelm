# Verified Mission OS: implementation roadmap

**Decision date:** 2026-08-30

**Status:** Product direction approved; follow-on features not yet specified or implemented.
**Audience:** Windows power users and solo developers using local coding agents.

> Give the supervisor one high-level outcome. The supervisor delegates bounded work to
> specialists, reconciles their evidence, and returns one verified result. The target
> delivery experience is a reviewable pull request, not an automatic merge or deployment.

## Purpose and source of truth

This document records the approved product direction, dependency sequence, and the exact
points at which a new `$speckit-specify` should be run. It is not a replacement for a
feature specification, implementation plan, task ledger, or execution evidence.

- [Feature 002 specification](../../specs/002-agent-mailbox-routing/spec.md) owns the current scope.
- [Feature 002 tasks](../../specs/002-agent-mailbox-routing/tasks.md) own individual task status.
- [Feature 002 execution evidence](../../specs/002-agent-mailbox-routing/execution-evidence.md)
  owns validation results, reviews, approvals, and blockers.
- The [constitution](../../.specify/memory/constitution.md) continues to govern local-first
  operation, authority, privacy, Windows acceptance, and restrained presentation.
- Each future feature will own its own `spec.md`, `plan.md`, `tasks.md`, and evidence.
  This roadmap links to those artifacts when created; it does not duplicate their checkboxes.

The observed baseline was `main` at `659e59b` (PR #16) on 2026-08-30. The user reported US7
in progress; the main ledger had US1-US6 and T159-T166 checked, with US7, US8, and Phase 11
still open. This is a dated baseline, not a claim about another task's unmerged progress.

## Approved product rules

1. **Delegation is the core workflow.** The user supplies a high-level outcome, not a task
   breakdown. The supervisor proposes acceptance criteria, decomposes work, selects eligible
   specialists, coordinates dependencies, requests corrections, and synthesizes results.
2. **Names are configurable metadata.** Tony Stark is the owner's chosen supervisor persona,
   not a product default or privileged identity. All supervisor and worker names are editable;
   stable identities, profile revisions, and policy determine authority.
3. **Main enforces authority.** The supervisor proposes strategy; Electron main validates
   operations and owns durable coordination, leases, runtime bounds, and process controls.
   Recorded evidence is not infallible truth and must retain its provenance and limitations.
4. **One accountable delegator initially.** Only the bound supervisor may request authoritative
   mission work-item changes. Workers can propose subwork but cannot independently spawn
   agents, change the contract, or grant authority. All returns pass through main to the supervisor.
5. **Approve the envelope, not a frozen task list.** A revision-bound Mission Contract defines
   outcome, acceptance criteria, scope, eligible workers, exact launch bindings, limits,
   verification, and allowed routine actions. Internal work may change within that envelope.
   Scope, authority, resource-ceiling, or bound-target changes need the appropriate amendment
   or fresh confirmation; no runtime substitution bypasses Feature 002's exact-start checks.
6. **Stop at human review.** The complete future workflow terminates at a verified PR. Merge,
   deployment, spending, credential changes, broader workspace access, and other consequential
   actions are excluded unless separately authorized. Approval of this roadmap grants none of them.
7. **Preserve uncertainty.** Completed, blocked, failed, refused, cancelled, permission-denied,
   timed-out, budget-exhausted, and unknown outcomes stay distinct. Unknown effects never trigger
   blind replay. Restart preserves evidence but starts or resumes no mission automatically.
8. **Privacy and permissions remain separate from personas.** No automatic transcript/reasoning
   ingestion, secrets in prompts/logs/worktrees, inherited bypass, or persona-based authority.
   Provider model/effort choices and current availability belong in the future plan, not this roadmap.

## Sequence and specification triggers

| Stage                                | Dependency and entry                                                                                                                                           | Exit evidence                                                                                                                                                                      | Next specification action                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 0. Finish Feature 002                | Continue the existing feature: US7 (T107-T125), then US8 (T126-T149), then Phase 11 (T150-T158); preserve all earlier acceptance and supplemental obligations. | US1-US8 and supplemental requirements delivered; required validation and human acceptance recorded; integrated on main; no unresolved blocking gate.                               | Only when the Feature 002 closure gate below passes, run `$speckit-specify` for **Verified Mission Delegation**. |
| 1. Verified Mission Delegation       | Feature 002 closure accepted; inspect the actual US8 implementation before defining additions.                                                                 | Mission contract, attributable delegation, verification/receipt, and Mission Focus acceptance pass on Windows; evidence and required reviews recorded; feature integrated on main. | Run a separate `$speckit-specify` for **GitHub Mission Intake** after this feature's closure is accepted.        |
| 2. GitHub Mission Intake             | Stage 1 accepted; connector ingress, authentication, privacy, and authority decisions resolved during specification/planning.                                  | Selected-repository draft intake, approved clarification, issue/mission/PR linkage, verified-PR delivery, and quiet final update pass acceptance; recovery and revocation proved.  | No automatic next feature. Obtain a separate owner decision before specifying bounded issue auto-start.          |
| 3. Optional bounded issue auto-start | Stage 2 accepted and explicit owner approval of this additional scope.                                                                                         | Future spec must prove trusted triggers, templates, quotas, concurrency, pause/recovery, and the same PR-review boundary.                                                          | Deferred; neither specified nor authorized for implementation by this roadmap.                                   |

### Feature 002 closure gate

Finishing or merging US7 alone does not finish Feature 002. US8 finishes the supervisor story,
but does not replace Phase 11. Before creating the next active feature specification:

- Reconcile the full Feature 002 ledger, including T159-T166 and earlier acceptance obligations.
  Mark work complete only with attributable evidence; task count alone is insufficient.
- Complete US7's wizard/template/export acceptance and US8's bounded supervisor, exact worker
  start, structured return, fault, and explicit human acceptance requirements.
- Clear T150-T154 security/privacy, performance, accessibility, packaging, containment, and cleanup gates.
- Complete T155 documentation, T156 full local quality sequence, T157 installed-artifact and
  separate exact-version provider proofs, and T158 final drift review and approval.
- Record local, hosted CI, installed Windows artifact, Codex, Claude, and manual acceptance
  separately. A skipped required proof, a PR merge, or a T158 entry listing blockers is not a pass.
- Integrate the completed feature on main with passing applicable hosted checks and no unresolved
  blocking findings. Record the final commit, relevant PRs, acceptance, and remaining nonblocking
  limitations in the feature evidence.

The next-spec trigger is **recorded closure and acceptance after T158**, not merely running T158.
Keep `.specify/feature.json` on Feature 002 until the transition is explicitly undertaken. An earlier
partial release or a proposed deferral must not be labeled full completion; any different sequencing
requires an explicit owner decision and a documented dependency impact.

### How to start each next specification

At each trigger, inspect the current checkout, feature selector, existing spec directories, final
evidence, and unmerged changes. Do not switch or overwrite another active task's checkout.
Allocate the next available feature number at invocation time; do not reserve `003` or `004` here.
Create only one feature per invocation and keep Git branch names independent from spec numbering.

For the first transition, use this bounded request:

```text
$speckit-specify Create Verified Mission Delegation from docs/roadmaps/verified-mission-os.md.
First verify Feature 002's recorded closure. Extend its US8 mission, delegation, result-return,
lease, and recovery foundation rather than recreating it. Specify the acceptance-evidence
matrix, Capability Passports, progress accountability, Mission Receipts, and approved Mission
Focus experience. Separate local verified completion from future GitHub-confirmed PR readiness.
Exclude GitHub intake, external delivery implementation, automatic issue starts, merge, and deployment.
```

After that feature is accepted and integrated, use:

```text
$speckit-specify Create GitHub Mission Intake from docs/roadmaps/verified-mission-os.md.
Build on the accepted Verified Mission Delegation feature. Specify selected-repository issue
sync into local Draft Missions, explicit mission approval, individually approved clarification
and final issue comments, authorized branch/PR delivery, and issue/mission/evidence linkage.
Resolve desktop ingress and credential custody without silently requiring hosted coordination.
Exclude automatic issue activation, automatic merge, and deployment.
```

For each new feature, review specification quality and resolve material questions with
`$speckit-clarify` before `$speckit-plan`; then generate `$speckit-tasks`, check consistency with
`$speckit-analyze`, and use `$speckit-implement`. A roadmap entry is not an implementation plan.
Update this roadmap with the actual feature links and closure references as each stage advances.

## Stage 1: Verified Mission Delegation

### Reuse rather than duplicate Feature 002

| Existing foundation                                          | Follow-on increment                                                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| US7 reviewed profiles, templates, and resumable agent drafts | Configurable stable specialists plus evidence-backed capability history; no additional persona authority.                                |
| US8 mission envelopes and exact launch authorization         | High-level outcome intake, proposed measurable criteria, one contract-review experience, and visible amendments.                         |
| US8 work DAG, decisions, leases, and structured returns      | User-facing Delegation Ledger linking assignment rationale, deliverables, dependencies, attempts, corrections, and verification.         |
| US8 bounds, known-safe retries, and recovery                 | Meaningful-progress checkpoints, attributable interventions, transparent usage sources, and supervisor briefing.                         |
| US8 acceptance evidence and mission status                   | Criterion-level evidence freshness, separation of duties, final receipt, and local-verified versus externally confirmed PR-ready states. |
| US8 compact mission/task views                               | Mission Focus layout with the supervisor briefing above a restrained delegation tree/table.                                              |

### Planned implementation order within the future feature

1. **Contracts and state:** Extend existing mission/work records, specify lifecycle and amendments,
   acceptance-criterion identities, evidence provenance, and compatibility/migration behavior.
2. **Delegation accountability:** Expose bounded work packets and their return paths. Record the
   delegator, selected profile/revision, rationale, required output, dependencies, attempt, and reviewer.
3. **Verification and receipt:** Map criteria to exact artifacts, commits, deterministic checks,
   independent reviews, hosted results when available, and manual acceptance. Invalidated evidence
   becomes stale; if affected scope cannot be proved, do not assume old evidence still applies.
4. **Capability Passports and progress:** Derive attributable history by role/task/profile revision
   and provider capability. Show sample size, recency, limitations, and declared versus demonstrated
   ability; never convert a name or opaque score into permission. Reuse US8's governor and stop controls.
5. **Mission Focus UI:** Mission list left; selected outcome, supervisor briefing, and live delegation
   center; acceptance evidence and usage right. Terminals, logs, and full work detail are drill-downs.
   Keep keyboard access, visible focus, text scaling, bounded updates, and no decorative graph motion.
6. **Acceptance and closure:** Prove a high-level request becomes accountable assignments, independent
   verification, correction when needed, and an honest receipt without manual terminal coordination.

The receipt records outcome, criteria, participants, exact artifact/commit references, checks,
reviews, usage source, elapsed time, corrections, limitations, and actions not performed. Export
Markdown/JSON only through bounded, disclosed content handling. A worker's completion claim is not
verification. Local tests, hosted checks, installed acceptance, and human decisions remain distinct.

Usage must be labeled provider-reported, CLI-derived, estimated, or unavailable. Time/turn/process
limits are enforceable separately; estimated cost does not promise an exact billing cutoff.
Warning thresholds and checkpoint timing are planning parameters, not fixed promises from examples.
Output volume, process existence, model narration, or self-reported checkpoints alone must not be
treated as trustworthy progress or safe-delivery evidence.

**Stage boundary:** This feature can return a locally verified receipt and define the future PR-ready
contract. It must not claim a verified PR exists without observed GitHub delivery and final checks.
Managed worktree creation, GitHub authentication, push, PR creation, and external updates are new
scope for Stage 2, not implicit additions to Feature 002's user-prepared workspace model.

## Stage 2: GitHub Mission Intake and delivery

### Approved experience

An eligible issue creates a local Draft Mission, never an active mission. The intake record retains
repository/issue identity, author, source revision, eligibility rationale, missing decisions, and
proposed criteria. The user reviews the completed Mission Contract before delegation begins.

- **Repository policy:** Selected repositories, eligible/excluded labels, optional trusted-author
  rules, pending/active limits, eligible profiles, verification profile, budgets, and PR base.
- **Classification:** Actionable, needs clarification, conflicting, outside the envelope, or unsafe.
  External issue/comment text is attributed context and never grants authority.
- **Clarification:** The supervisor prepares a local comment draft. The user approves the exact
  repository, issue, installation, body, and effect before each post. Editing invalidates approval.
- **Revision handling:** Deduplicate events and preserve source revisions. An issue edit can refresh
  an unapproved draft but cannot silently rewrite an active contract. Closure/reopen events neither
  silently cancel running processes nor restart old missions.
- **Delivery:** After mission approval, separately authorized GitHub delivery may create an isolated
  worktree/branch, push scoped commits, maintain a draft PR, address findings through delegation, and
  report ready for review only against the exact final commit and required evidence.
- **Quiet communication:** No agent-by-agent chatter. Individually approve clarification posts and
  one final PR-ready issue update. Retain operational detail locally and in appropriate PR evidence.
- **Recovery:** Persist outbound intent and confirmed GitHub object identity; reconcile ambiguous
  writes before retry. Missed/duplicate/out-of-order events, outages, rate limits, repository transfer,
  deleted issues, permission reduction, and installation revocation must not corrupt local missions.

### Connector decisions required before implementation

These are explicit planning gates, not permission to create infrastructure now:

1. **Desktop ingress:** A local-only desktop is not automatically reachable by GitHub webhooks.
   Specify how selected-repository events reach it and how offline catch-up works. A hosted relay,
   tunnel, or public listener requires explicit security/privacy and operational approval; do not
   silently add one. If local authenticated API synchronization replaces inbound webhooks for v1,
   record that decision and owner approval. Core local missions must remain usable without GitHub.
2. **GitHub App authentication:** Resolve selected-repository authorization, secure Windows token
   storage, renewal/revocation, and trusted credential custody. Never ship a shared GitHub App private
   key/client secret in desktop clients or pass connector tokens to agents. Prefer separate read-only
   intake and explicitly enabled delivery capabilities; verify exact GitHub permissions in planning.
   A write scope may enable more APIs than the product allows, so main must still reject merge and
   deployment operations regardless of token capability.
3. **Intake model usage:** Automatic issue capture must be deterministic and must not silently launch
   a provider to let the supervisor draft a contract. Model-assisted drafting needs an explicitly
   authorized bounded intake session/usage policy, or waits for user review. No worker, worktree,
   branch, PR, or issue comment is created merely because an issue arrived.
4. **Managed repository work:** Specify exact branch/worktree targets, isolation checks, cleanup,
   dirty-work preservation, conflict handling, Git credential custody, and outbound-write approval.
   New network/filesystem authority cannot be inherited from issue text or a persona.

### Delivery slices and exit scenarios

1. Connection and draft intake: authorize selected repositories, define policy, synchronize sources,
   create one local candidate per logical issue intake, and prove no execution side effects.
2. Clarification: classify missing decisions, answer locally, approve exact comment drafts, ingest
   attributed replies, and handle uncertain posting without duplicate comments.
3. Mission-to-PR: approve contract, delegate, verify, deliver the scoped branch/PR, return receipt,
   and approve the quiet final issue update. No merge, deployment, or issue-driven permission change.

Test all slices with deterministic fixtures before credentialed proof. Cover webhook authenticity
if used, pagination/catch-up, duplicate/out-of-order events, revoked permissions, changed targets,
prompt-injection attempts, secrets, lost acknowledgements, stale evidence, cancellation, and restart.
Record hosted/provider/manual proof separately; missing credentials do not become a passing test.

## Deferred directions

Bounded issue auto-start is a potential later feature, not a v1 intake setting. It requires another
owner decision and specification for trusted triggers, mission templates, concurrency, budgets,
and fail-closed ambiguity. Recursive worker delegation, cross-device/multi-user control, broad
integrations, automatic merge/deployment, and an agent marketplace are not authorized by this roadmap.

## Maintenance and handoff record

At a stage transition, record its real spec link, accepted final commit, PR references, validation
and human approval links, blockers/limitations, and the next eligible `$speckit-specify` request.
Until then, stage status is planned or in progress, never complete based only on design approval.
Do not publish speculative delivery dates or copy task-level status into this document.

| Stage                       | Tracking artifact                                                                                                                | Handoff state at roadmap creation                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Feature 002                 | [Tasks](../../specs/002-agent-mailbox-routing/tasks.md), [evidence](../../specs/002-agent-mailbox-routing/execution-evidence.md) | Current feature; closure not established.                                           |
| Verified Mission Delegation | Create with the next available number after the Feature 002 closure gate.                                                        | Product direction approved; no spec or implementation claim.                        |
| GitHub Mission Intake       | Create separately after Verified Mission Delegation acceptance.                                                                  | Draft-only/quiet-communication direction approved; connector planning gates remain. |
| Bounded issue auto-start    | Separate future owner decision and spec.                                                                                         | Deferred.                                                                           |
