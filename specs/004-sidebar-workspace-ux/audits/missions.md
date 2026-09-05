# Mission UI/UX audit — 5 September 2026

> Historical evidence at `c037c7c`. See [main-merge reconciliation](main-merge-reconciliation.md) for current status at `8f41aae`. The original screenshots, seven-destination sidebar sketch, and source line numbers below are historical; Templates now lives under Agents. Do not treat the old visual styling as the current baseline.

Scope: New mission entry, repo ideas, Outcome, Crew, Access & limits, Review, draft close/resume, mission sidebar rows, mission workspace, and detail dialog. Audited clean main at c037c7c. No application source changes.

Evidence: current source, freshly built Electron app, the repository's isolated parity screenshot workflow (1 passed, 49 seconds), and direct isolated UI probes. No real provider runs were requested. Existing fixture adapters supplied screenshot missions. Full test suite was not run. Source-only findings below are identified separately from live reproductions.

## Priority 1 — repair navigation and misleading controls

1. **Global mission entry points fail outside Missions.** Live reproduction: open Settings, click New mission; Settings stays visible and no repo entry mounts. Clicking Missions then reveals the pending entry. Resume draft from Settings also leaves Settings visible. `App.tsx:153,215,231` change local state without selecting the Missions destination. Improvement: one navigation transition for New mission and Resume draft, which saves the current draft and opens the requested destination immediately.

2. **Selecting a mission does not exit an open composer.** Source confirmed: `App.tsx:96` changes the selected mission but retains composerDraftId; rendering at `:245` prioritizes the composer. New mission also mounts repo entry immediately without flushing the outgoing draft (`:215`). The draft hook clears its pending autosave timer on unmount. Save failure during other switches only produces a notice and still completes navigation (`:90`). Improvement: a single view state for mission/entry/draft; save before transitions, clear obsolete view state, and retain edits when a save fails. Offer an explicit leave-without-saving choice only for the failure case.

3. **Existing sessions appear reconfigurable.** Source confirmed: Crew copies a live session's recorded launch settings, but runtime inputs remain editable (`CrewStage.tsx:270`) and Access still offers a folder picker (`AccessStage.tsx:94`). The backend rejects mismatched folder/runtime settings (`mission-bindings.ts:156,161`). Improvement: show a read-only Existing session summary; provide an explicit Switch to a new session action before enabling those controls. Also distinguish multiple sessions in the same folder with a session name or start time.

4. **Per-worker access controls actually change shared folder access.** Source confirmed: `AccessStage.tsx:64` updates mode by workspaceId, while rendering labels as Worker N access. Two workers sharing a folder therefore share the same setting. Supervisor access is derived but lacks its own normal control. Improvement: group access by folder and list every affected crew member, including the supervisor; show the common Read/Write choice once. If per-worker authority is desired, it requires a contract change rather than a cosmetic relabel.

## Priority 2 — make the flow coherent and identifiable

5. **Repo-ideas entry looks like a separate unfinished page.** Fresh `09b-repo-idea-entry.png`: content begins flush against the top/left edge, unlike the padded composer. It lacks a clear Cancel/Back action. Context continues to show the selected mission, or stale composer context, rather than idea-generation context. Improvement: same content inset, typography, and action footer as the composer; New mission heading; equally clear Write my own / Get ideas from a repo choices. Keep idea generation optional and outside the four creation stages.

6. **Idea-generation controls misstate their scope and retain stale results.** Source confirmed: Provider and model selects only a provider; its default does not name the chosen provider. Changing repo/provider does not clear existing ideas. Picking an idea passes only objective/evidence, losing repo context (`RepoIdeaEntry.tsx:115,125,166`). Improvement: accurately label Provider, show the resolved provider plus CLI-default model/effort, invalidate results when inputs change, and retain the source repo as an editable suggestion for later folder selection. Explicitly state that Generate ideas sends the listed repository context to that provider; Outcome is where suggested text is edited, while final mission approval remains on Review.

7. **Sidebar drafts cannot be distinguished.** Live reproduction: entering “Audit draft A” renders only “Resume draft · Outcome · just now”. No active draft styling, rename action, or normal-path discard action exists. Improvement: local draft title or objective excerpt, stage and saved time beneath it, selected-row treatment, and a small menu for rename/discard. Respect the existing content-free summary contract: add local presentation metadata or bounded detail retrieval rather than leaking content into lifecycle events.

8. **Sidebar status hides the reason a mission needs attention.** Fresh screenshots show a mission requiring a decision and an uncertain mission both as Paused in the sidebar. The workspace correctly distinguishes them. Rows also always show a short ID. Improvement: reuse the mission presentation labels for Needs your decision / Outcome uncertain / Paused / Running / Completed; move IDs into details. Put active missions first, retain a compact completed group, and add search/filter once list volume warrants it. Keep global navigation fixed; the current entire rail scrolls as missions accumulate.

9. **Close is a two-step detour despite autosave.** Live reproduction: Close opens a full saved receipt requiring Close composer. Normal autosave has no persistent visible Saved/Saving indicator; successful save is announced only in a hidden live region. Improvement: persistent local save status and Save & close that returns directly, with a short saved notification. Keep the explicit unsaved-edits decision for failures. Normal draft management should expose Discard, which currently appears through the error banner.

10. **Review and the post-start landing lose the established action hierarchy.** Fresh review screenshot: sticky footer contains Close and Back while Start mission lives far below the expanded authority disclosure. After starting, `App.tsx:255` immediately opens the technical Mission detail dialog. Improvement: keep the approval checkbox and final Start mission action in a consistent review action area; leave essential scope, launch, and permission facts prominent and group raw identifiers/JSON in technical details. After success, land on the mission overview with a Started confirmation and a clear next action. Open detail/history on demand.

11. **Runtime and prerequisite UX differ from normal session launch.** Crew uses a free-text model box, while LaunchDialog already offers provider-specific options, CLI default, and Custom model. Crew's “Start a new session at launch” option also conflicts with the hidden default that requires separately authorizing automatic startup. Access tells users to fix folders/providers in Settings without a direct action. Improvement: reuse the established runtime picker within mission-supported limits; expose startup intent alongside the session choice; add fix-and-return navigation for prerequisites, preserving the draft and step. Express time/output limits in minutes and MiB while retaining exact values internally.

## Priority 3 — accessibility and state polish

12. **Invalid-field focus is unreachable through Continue.** `MissionComposerWorkspace.tsx:130,352`: the button is disabled precisely when the handler would focus the first invalid field. Improvement: allow validation activation while fields are incomplete, then focus and label the field; disable only for saves or hard storage blocks. Alternatively provide a reachable Fix missing field action. Do not remove final authority checks.

13. **Loading and selected content can disagree.** `useMissionWorkspace.ts:87` loads another mission without clearing/marking old detail; selected sidebar row can change before the workspace content does. Mission errors provide no direct Retry in MissionWorkspace. Improvement: show an explicit pending state for the selected mission, retain clear identity if preserving previous content, and offer Retry.

14. **Accessibility patterns are inconsistent.** Source/probe evidence: nested main landmarks, a custom discard role=dialog without the shared modal's focus handling, and focus behavior that runs before asynchronous navigation completes. Improvement: one main landmark, reuse ModalDialog, focus the destination after it mounts, and ensure the active sidebar row is scrolled into view during keyboard navigation. Keep visible keyboard focus.

## Proposed interaction flow

New mission (from any destination) → New mission entry → Write my own or Get repo ideas → Outcome → Crew → Access & limits → Review and approve → Mission overview.

A consistent footer offers Save & close, Back, and the current forward action. Draft status remains visible. The right panel summarizes the current draft or mission, never an unrelated selection. Selecting a sidebar item opens that exact item after saving outgoing edits.

Sidebar example:

    ThreadHelm
    [+ New mission]

    Missions
      Fix flaky terminal test
      Needs your decision · 2/3 complete
      Audit navigation
      Running · 1/4 complete

    Drafts (2)
      Improve onboarding
      Crew · Saved 2 min ago
      Add export support
      Outcome · Saved just now

    Completed (4)
    -------------------------
    Sessions / Agents / Templates / Memory / Attention / Settings

Recommended sequence: repair navigation and invalid editable controls first; then unify sidebar identity, page layout, save/close, and Review; then complete keyboard/error/loading polish. Preserve the existing four stages and explicit final mission approval.

Reference baseline: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md. Recommendations above are grounded primarily in the local implementation and fresh app evidence.
