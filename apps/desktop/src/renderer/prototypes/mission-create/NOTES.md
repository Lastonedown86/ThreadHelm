# Mission composer prototype decision

- Question: how should creation and revision make a dense mission envelope understandable without
  hiding authority?
- Page variants: A — Envelope, B — Guided course, C — Live boundary, D — Guided boundary hybrid.
- Owner decision: **D — Guided boundary with the continuous Mission Coach is approved on
  2026-09-01** as the production design direction. Prototype code remains disposable.
- Crew assignment variants:
  - A — Inline controls: direct profile, runtime, assignment, and evidence controls.
  - B — Brief + defaults: profile cards, one assignment brief, and a recommended runtime sentence;
    exact controls remain under `Customize runtime`.
  - C — Work lane: a compact lane and assigned-outcome summary with a separate editor action.
- Owner selection: **B — Brief + defaults approved on 2026-08-31; its rendered continuous-coach
  refinement received final design approval on 2026-09-01.**
- Runtime selection rule: provider remains a visible field resolved from the exact profile revision
  or verified live session. It is not hidden inside the model label. Model options are filtered by
  provider, and effort options are filtered by the selected provider/model capability record.
  Provider-default labels name the provider (`Use Codex CLI default`, `Use Claude Code default`) so
  two-provider and future-provider missions never show an ambiguous bare `CLI default`.
- Extensibility rule: the UI consumes a provider capability registry. Adding an adapter adds its
  provider, model, effort, and permission choices without adding provider-specific form branches.
  The current product runtime list remains Codex CLI and Claude Code.
- Profile-schema decision: keep `threadhelm/agent-profile@1` unchanged. It already stores the
  requested provider and model. Effort, permission, role, session, workspace, automatic startup, and
  mission assignment remain outside profile JSON. The prototype's imported sample now uses the exact
  strict manifest keys (`spec`, `name`, `description`, `provider`, `model`, `goal`, `capabilities`,
  `isolate`, `tokenCap`, and `author`) and requests a concrete model rather than a runtime CLI default.
- Contract note: the existing mission worker binding has no assignment field. The selected variant
  therefore requires a separately specified, validated field or an explicit decision to treat this
  as non-authoritative draft intent before production work begins.
- CLI profile drafting architecture: use a dedicated one-shot local CLI run. ThreadHelm owns a
  temporary directory, supplies no mission workspace or tools, requests one strict profile object,
  validates the result, and then shows an unsaved draft. It must never inject drafting instructions
  into an active worker session or silently switch providers.
- Prompt-builder variants:
  - A — Quick request: one freeform request for experienced users.
  - B — Guided starters: three plain-language prompts covering the reusable work, the expected
    result, and useful abilities, preceded by optional generic starter briefs. The owner approved
    the rendered direction on 2026-09-01.
  - C — Live profile: request fields beside a continuously visible profile-shape preview.
- The prototype simulates the generation receipt and result. Production needs a proved adapter
  capability for bounded structured profile drafting; the current adapters only establish
  interactive CLI sessions.
- Outcome, Access & limits, and Review now share three disposable path alternatives:
  - A — Quiet form keeps only essential choices and concise explanations.
  - B — Guided guardrails uses plain-language prompts, readiness checks, and visible consequences.
    It is the approved path within the D hybrid direction.
  - C — Exact operator exposes dense authority, provenance, and resolved-binding detail.
- The Guided guardrails Review path combines the finish line, crew purpose, exact access, runtime
  readiness, operating limits, authority behavior, and an expandable resolution ledger in one
  launch brief. Its Ready, Mission changed, and Setup incomplete material states are URL-addressable.
- Munder Difflin informed only transferable interaction mechanics: visible readiness, blocked-work
  consequences, and controls named by their result. No office presentation, product names, personas,
  or bundled Munder content is used.
- The cross-stage path, Approval expired, and B — Local autosave exit behavior are approved. Remaining
  load/degraded prerequisite states may reuse this in-page coach system but still need focused copy
  and recovery actions before production completion.
- Smart Crew Builder decision:
  - **B — Crew Workshop approved on 2026-09-01.** It appears at the start of Crew after Outcome.
  - The builder matches reviewed active profiles first and uses one explicit bounded local CLI request
    only to draft missing generic roles. It receives outcome text, evidence, and exclusions; it receives
    no workspace contents, tools, permissions, or launch authority.
  - Suggestions expose why each worker is needed, standing goal, descriptive abilities, one mission
    contribution, required return evidence, requested runtime, and whether the source is a saved exact
    profile revision or a new unsaved draft.
  - The recommended crew is capped at three. The owner selects and edits proposals before adding them
    to the mission draft. New profile drafts still require review and save before they can be bound.
  - CLI unavailable, invalid output, duplicate profile, over-limit result, and no-match states are
    browser-addressable through `crewState`. No state silently substitutes providers, saves profiles,
    grants access, or launches workers.
  - Production requires a strict `CrewPlanDraft`-equivalent contract and validated mission-specific
    assignment/evidence fields. The existing agent-profile schema remains unchanged.
  - The approved workshop now demonstrates an adaptive automation wizard. It keeps the four mission
    stages and automates within them: outcome interpretation, proof mapping, crew planning, and
    preflight. The wizard asks only when a choice changes coverage, oversight, access, or authority.
  - Focused, Balanced, and Thorough plans expose their worker and checkpoint consequences. Focused is
    the default and explains why it is the smallest sufficient crew; manual worker changes become a
    custom plan rather than being silently overwritten.
  - Mission Preflight shows proof ownership, return evidence, duplicate-role count, owner checkpoints,
    the proposed handoff sequence, and everything still withheld. These are planning explanations,
    not runtime readiness or permission grants.
- Outcome Coach prototype:
  - The Guided Outcome path now accepts a rough request and uses one explicit bounded local CLI draft
    to propose one finish line, proof obligations, exclusions, assumptions, and follow-up candidates.
    The request is the only CLI input; no workspace, files, tools, or mission authority are attached.
  - Generated output remains an unsaved proposal until the owner applies it. Continue to Crew is
    disabled while the coach is open with an unapplied proposal; closing the coach preserves the
    manual field path.
  - Ready, one-answer-needed, too-broad, CLI-unavailable, and invalid-output states are
    browser-addressable. The coach asks only when the answer changes the finish line, proof, or
    follow-up boundary. It never substitutes a provider or silently creates follow-up missions.
  - Applying the proposal populates ordinary editable Outcome fields. Later crew automation consumes
    those edited values, not a hidden model response.
- Continuous Mission Coach and Access Coach:
  - One persistent coach banner now carries the same context through Outcome, Crew, Access, and
    Review. It shows the current owner decision and one four-part readiness trail rather than making
    each helper feel like a separate feature.
  - Access Coach derives the minimum sufficient authority from approved worker assignments: one exact
    folder, read/write access when implementation changes files, manual permission, verified runtime,
    three participants, and bounded time/token limits. It explains why every recommendation is needed
    and lists broader authority that remains off.
  - Access recommendations remain unsaved until applied. Continue to Review is disabled while an
    unapplied recommendation is open; applying it reveals the ordinary editable guardrail controls.
    Provider substitution, parent/sibling folders, automatic startup, and consequential external
    actions remain withheld.
- Review Coach prototype:
  - The Guided Review path now synthesizes Outcome, Crew, Access, and Preflight coach receipts into
    one launch brief. It shows three bound participants, the ordered handoff back to the owner, what
    cannot happen automatically, and one remaining exact folder-boundary confirmation.
  - Ready enables Start only after confirmation. Mission changed clears the decision and requires a
    refreshed review. Setup incomplete blocks Start and refuses provider/model substitution or a
    partial launch.
  - The persistent coach banner yields to the full Review Coach header on the final stage so the
    assistant remains continuous without repeating itself. Exact resolution details remain available
    under disclosure.
  - Approval expired is now a fourth material state. It preserves the mission draft, clears launch
    authority, marks the exact workspace binding stale, and returns the owner to Access for a fresh
    approval. No partial start, substitution, or silent refresh occurs.
- Draft exit alternatives:
  - **B — Local autosave is recommended.** After meaningful edits and before Close, save the
    composer draft locally and show a receipt with the resume stage and authority still off. This
    avoids a second confirmation gate while keeping draft persistence separate from mission launch.
  - A — Ask every time remains available for comparison with Save-and-close, explicit Discard, and
    Keep editing actions.
  - Save failure keeps the composer open, confirms that no values were discarded, and offers retry,
    Keep editing, or an explicit destructive discard path. It never retries or closes silently.
  - Owner approved B — Local autosave on 2026-09-01. The production contract is specified in
    `specs/002-agent-mailbox-routing/contracts/mission-coaching.md`.
- Production status: no prototype code is production code.
