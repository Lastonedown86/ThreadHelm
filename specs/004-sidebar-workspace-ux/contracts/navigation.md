# Slice 1 UI contract

Requirements: FR-004/005/016–019; US2 and US7. Findings: MIS-001, MIS-002 / NAV-001–003.

1. New mission and Resume draft work from all six destinations and update selected navigation and displayed content together.
2. Mission selection saves the outgoing draft and displays the selected mission, with matching context. A rejected save changes none of those targets.
3. Pending edits, including edits typed during an earlier save, must be acknowledged before a transition succeeds. Saves use sequential expected versions; a failure does not silently retry or clear newer dirty state.
4. Failed exits open a native modal naming unsaved changes. Keep editing (default focus) and Escape retain editor and values. Retry attempts the same target. Leave without saving is explicit; it abandons only unsaved changes, not the durable draft.
5. Repeated navigation during a pending save does not create additional drafts or change the intended target. Loading a draft never exposes stale values as editable.
6. Normal navigation never changes process lifecycle. Tests independently inspect saved fields, mission identity and live-session counts.

No IPC contract changes. Existing success Close receipt and process confirmation gates remain in force.

## SES-001: Sessions navigation

- Global Sessions entry, including a repeated click: All sessions.
- Explicit Selected mission: only bindings of identity-matching selected mission detail; unavailable when no mission is selected. Pending detail shows a loading state with no previous mission candidates.
- Successful launch: All sessions and the returned session ID selected.
- Mission Open terminal: Selected mission and the requested bound session selected.
- Attention row then Sessions: All sessions retains that exact ID.
- Scope narrowing: retain selection if visible, otherwise select the first visible ID. Empty scope renders no terminal. Scope widening retains a visible selection.
- Navigation retains the existing draft-save guard. Filtering does not launch, stop, restart, bind or reassign a process.

## AGT-001/002 roster behavior

- Load more profiles uses the existing cursor contract in 50-item pages; retain selected ID and deduplicate refreshed pages.
- Filter changes reset to the first page. Excluded selected detail closes; a matching selection is retained if present in the completed page.
- No filtered matches uses No active profiles / No disabled profiles and Show all profiles; a truly empty All inventory uses No reviewed agent profiles yet.
- Loading and failures are explicit, with Retry profiles / Retry profile detail on failure. Old requests cannot publish into a newer selection/filter. No prior detail action is rendered as a new target.
- Successful import switches to All and reveals/selects its exact profile. Enable/Disable remains bound to the displayed profile ID and revision and triggers inventory reconciliation.

## MEM-001 exact memory supersession

- Any title/body edit invalidates the existing disclosure; Append requires a fresh review of the visible text.
- Review displays exact title/body from the authoritative disclosure. Main still binds revision, scope, sources and confidence.
- Only one review/append request runs at a time. Cancelled or replaced reviews cannot repopulate the dialog.
- A failed append retains edits and requires fresh review; show the failure within the active dialog. Cancel performs no write; pending append cannot be dismissed or edited.
- Independent get/restart must return the exact newly reviewed fields and one appended revision.

## MEM-003 shared Memory search scope

Direct and guided searches use one selected approved workspace. Repeated guided queries run again without remounting the panel or resetting scope/filter. Query, scope and contested-filter changes invalidate old search/detail responses and clear obsolete actionable detail. Stale success/failure cannot overwrite newer results. Search and navigation never mutate memory or launch processes.
