# Mission Focus page decisions

Production page work may be planned only after a disposable browser comparison records its selected
direction here. Approval of a page does not widen runtime authority or approve another subsystem.

## Sessions and terminal

**Selected: B — Mission dock.** Session tabs and exact-target controls stay inside the active
mission. The dock can collapse without stopping its session. Lifecycle evidence from the inspector
variant is reserved for failed and recovery-required detail views.

## Agents and Templates

**Selected: C — Guided library with profile-studio detail.** Begin with the job to be done, generic
starters, saved drafts, and exact JSON import. Keep private local profiles separate from bundled
starters. Opening a local profile uses the profile-studio treatment for its goal, abilities, runtime
request, provenance, compatibility, and revisions.

## Memory

**Selected: B — Search-led Reading Desk with the Librarian, plus C for mission context packs.** The
primary Memory destination searches exact local evidence, opens one cited volume, explains why it
matched, and keeps lifecycle state visible. The continuous Memory Coach acts as a Librarian that may
search, explain, propose, and organize. It cannot silently publish, resolve conflicts, delete
content, or grant authority. Mission launches use a bounded reading-room packet with explicit
revision citations, inclusion controls, and a context budget.

## Settings, Workspaces, and Providers

**Selected: C — Task-oriented guided setup with B's compact attention summary.** The destination
walks through native folder approval, provider-specific readiness, and local application health in
three explained checks. Folder revocation, effective native identity, provider authentication,
storage degradation, Windows x64, unsigned release status, and sole-writer evidence remain visible.
Mission context may show a read-only attention summary but does not host setup mutations.

## Recovery and destructive actions

**Selected: C — Cross-mission attention queue with B's mission-context detail.** The queue exposes
every unresolved record, while opening one shows the exact mission, session, workspace, last known
state, and retained evidence. Unknown outcomes are never replayed or classified automatically. A
replacement session is reviewed as new work. Destructive reviews name exact removed content, linked
memory, retained content-free receipts, explicit exclusions, and any active or unknown work that
blocks confirmation.

## Mission Course states

**Selected: A — State-tinted.** Applies to waiting-for-owner, uncertain, recovery-required, and
completed missions inside the approved D — Mission Course layout. The header keeps its objective;
the state is carried by the lifecycle eyebrow, the status strip, the affected course node, and the
decision-first context rail. Reason codes never appear; each state carries a text label in every
place it is expressed. Rejected: B — attention band (a third copy of the same action) and C —
decision line (hides the objective while a decision waits). Decided 2026-09-02 from the disposable
`mission-focus-states` prototype.

**Exception — recovery's action label differs between header and rail on purpose.** Every other
attention state repeats its `primaryAction` label verbatim in both places. Recovery does not: the
header offers "Inspect evidence…" (spec 2.3, consistent with uncertain/held) while the rail offers
"Open attention queue" (spec 2.1, which asks the rail's recovery control to route to the Attention
destination rather than re-open the mission detail dialog). Where 2.1 and 2.3 disagree for recovery
specifically, 2.1 wins, so the label difference is intentional, not a miss.

**Deferred — the rail's recovery link is not filtered to this mission.** Spec 2.1 asks
`onOpenAttention` to open the Attention destination scoped to this mission's records. The shipped
control (`App.tsx`'s `onOpenAttention`) opens the destination unfiltered
(`actions.selectDestination('attention')`), same as any other route there. Filtering it would mean
teaching the Attention/Recovery screen about a mission-scoped view, which the Global Constraints for
this branch forbid outside bugs 1.1/1.2 (no changes to destinations other than Mission Focus).
Per-mission filtering is deferred to whichever phase next owns the Attention/Recovery page.

**The keyboard-order test stands in for an axe pass.** Spec 2.7 asks to extend "the existing axe
pass." This repo has no axe dependency (checked `tests/` and every `package.json`), so there is no
existing axe pass to extend. `tests/e2e/accessibility.spec.ts`'s keyboard-order test is the
accessibility coverage for the Mission Course states added here; treat 2.7 as met by that test, not
by an axe run that doesn't exist in this codebase.
