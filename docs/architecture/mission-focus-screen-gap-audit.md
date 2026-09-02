# Mission workspace screen-gap audit

**Date:** 2026-08-31

**Scope:** Approved Mission Course prototype, Mission Composer discovery prototype, and the existing
renderer surfaces that the redesign must preserve.

## Decision

The active-mission happy path and continuous Mission Composer direction are owner-approved. The
assignment/evidence, coach-draft, expired-approval, and local-autosave behavior now have an explicit
contract. Shared application-shell and presentation-model work may begin. Production Mission
Composer completion still requires the remaining prerequisite failures, provider capability data,
and structured CLI drafting capability below.

The rest of the application can follow in bounded page gates. Sessions, Agents, Templates, Memory,
Settings, provider/workspace readiness, Recovery, and destructive actions are not blockers for the
shared shell. They remain blockers for calling the redesign complete or release-ready.

## Blocking gaps before Mission Composer production work

1. **Mission-specific worker assignment needs production implementation.** The approved B — Brief +
   defaults direction separates reusable profile purpose from validated mission `assignment` and
   `requiredReturnEvidence`. The production schema, persistence, preview, and supervisor enforcement
   must implement `contracts/mission-coaching.md`; the current TypeScript envelope still lacks those
   fields.
2. **Final Review Coach composition is approved.** Guided guardrails combines the coach receipts,
   outcome, crew purpose, exact access, runtime readiness, operating limits, ordered handoff,
   stop/approval behavior, and expandable Resolution Ledger. Quiet form and Exact operator remain
   comparison aids, not the production direction.
3. **Expired authority recovery is approved.** Approval expired preserves the mission, clears launch
   authority, marks the exact workspace binding stale, and returns the owner to Access without
   silent refresh, substitution, or partial start. Production still needs focus/live-region coverage.
4. **Only one prerequisite-failure example is represented.** Setup incomplete now demonstrates an
   unresolved worker provider that blocks launch without substitution. Loading profiles/sessions, no
   reviewed profiles, no eligible supervisor session, no approved workspace, storage degraded, and
   load failure still need the same in-page state system.
5. **B — Local autosave is approved and specified.** Production must add the main-owned versioned
   draft store, acknowledged save-before-close behavior, explicit discard preview/confirmation, and
   save-failure recovery defined in `contracts/mission-coaching.md`.
6. **Provider/runtime capability presentation needs a registry-backed implementation.** The refined
   Crew prototype shows provider explicitly, filters model choices by provider, and filters effort by
   the selected provider/model. Production currently derives provider from the exact profile or live
   session but hard-codes model choices and offers a generic effort list. Preserve provider-specific
   default labels and obtain model/effort compatibility from adapter capability data so future
   providers do not require new form branches.
7. **CLI profile drafting needs a production capability.** The owner approved the rendered Guided
   starters direction on 2026-09-01. Production must add a proved structured-drafting operation to
   each supported adapter: a dedicated app-owned temporary directory, no mission workspace, no
   tools, a bounded run, strict schema validation, and no silent provider fallback. The current
   screen only simulates that operation.

## Blocking gaps before Mission Focus production completion

1. **Only the active state is mocked.** No-active-mission, waiting-for-owner, recovery-required,
   uncertain, and completed states are specified but not presented in the approved Mission Course
   structure. Loading, load failure, and storage-degraded states also need a common shell treatment.
2. **Narrow-window Mission Course is currently unusable.** At a measured 680 by 800 viewport the
   page has no horizontal overflow, but the hidden mission rail retains its full viewport height and
   pushes the mission workspace below the initial screen. The narrow design needs a mission picker,
   not a blank rail.
3. **Terminal switching between missions is unresolved.** The design allows either switching to the
   new mission's attached terminal or keeping the old terminal with a conspicuous identity. One
   behavior must be selected and tested against wrong-mission input.
4. **Collapsed attention is not demonstrated.** At medium width the context rail disappears, but no
   persistent attention control shows that a decision, recovery item, or uncertain outcome is
   waiting.
5. **Mission selection is visually simulated, not atomic.** The sample queue changes selection but
   the heading, course, context, and terminal content remain Feature 003. Production must move all
   mission-owned regions together and focus the new mission heading.

## Required later page gates

These do not block the first shared-shell implementation, but each blocks completion of its own
production redesign:

- **Sessions and terminal:** stopped, failed, recovery-required, new-output, truncation,
  backpressure, force-stop, wrong-selection input, terminal loading, and terminal load failure.
- **Agents and Templates:** empty, imported, locally created, invalid import, duplicate/revision
  conflict, pinned-by-mission, and generic starter content. Private Marvel personas remain outside
  packaged artifacts.
- **Memory:** empty, contested, retracted, deleted, expired, superseded, pagination, load failure,
  and stale resolution.
- **Settings, Workspace, and Providers:** no workspace, candidate review, reparse-point warning,
  duplicate approval, revoke blocked, provider missing, unsupported, unauthenticated, check failed,
  and storage degraded.
- **Recovery and destructive actions:** interrupted start, observation lost, incomplete stop,
  explicit resume, cancel, delete-content preview, expired preview, and blocked deletion while leases
  remain active or unknown.

## Implementation-quality gaps that can share existing screens

- Give form controls stable names and preserve explicit labels.
- Replace generic `Continue` with destination labels such as `Continue to crew` and
  `Continue to access and limits`.
- Announce restrained step and preview-status changes with a live region; do not announce terminal
  output there.
- Preserve URL state or another durable navigation state for review layouts and recoverable wizard
  steps.
- Focus the first invalid field and keep errors adjacent to the affected control.
- Add long-content wrapping, visible hover states, high-contrast checks, and keyboard verification.
- Ensure sticky controls never cover focused content. The floating prototype switcher currently
  overlaps review content at narrow widths; it is prototype-only and must not be copied into
  production.

## Deferrable polish

- Fine box alignment and final spacing rhythm.
- Decorative empty-state art, charts, or placeholder metrics.
- Nonessential motion and transition tuning.
- Full mobile-product behavior beyond protecting a narrow Windows app window.
- Mission-queue search or virtualization until real usage justifies it; the current contract is
  bounded to 100 listed missions.

## Recommended visual sequence

1. Smart Crew Builder B — Crew Workshop is owner-approved in the disposable prototype. Before
   production, specify the strict crew-plan draft plus validated mission assignment/evidence
   contract; do not change agent-profile JSON for mission-specific work.
2. Finish Mission Composer exact-review visual signoff plus stale/expired and
   prerequisite-failure states.
3. Mission Focus state family: no active mission, waiting, recovery/uncertain, and complete.
4. Mission Focus responsive/terminal behavior: narrow picker, collapsed-attention control, and
   wrong-mission terminal switching.
5. Implement the approved shell and Mission Focus states.
6. Continue through Sessions, Agents/Templates, Memory, Settings/Workspace/Providers, then Recovery
   and destructive actions as separate owner-gated page families.
