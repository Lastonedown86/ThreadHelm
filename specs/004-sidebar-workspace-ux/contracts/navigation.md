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
