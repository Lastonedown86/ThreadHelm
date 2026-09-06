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

## MEM-004 Memory pagination selection

Appending a page preserves the selected detail and all earlier rows. A failed page request preserves rows, selection and cursor; Load more memories remains available to retry after the request finishes. A replacement search reconciles the current selection against replacement results. Query/scope/filter changes clear obsolete detail and invalidate pending responses as in MEM-003.

## MEM-002 temporary reading list

Membership is an exact workspace/entry/revision reference and survives section navigation in the current app session. Restart clears it. The list has no saved mission association or execution authority. Metadata is loaded through revision-specific scoped reads and refreshed after memory events/return; bodies are not stored in list state. Deleted content cannot remain displayed under an active badge. Pending/error/unavailable reads hide obsolete metadata and offer retry/remove. Duplicate editions are ignored; Remove targets one edition.

## ATT-001 recovery queue selection

Dismissing another record preserves a still-open selected detail. Removing the selected record chooses the next surviving record in prior queue order, otherwise the previous surviving record, otherwise the first new record or empty state. Completion of an older dismissal cannot override a newer selection. Rejected dismissal retains record and selection; only main-owned resolution changes durable lifecycle.

## ATT-002 recovery-only scope

Attention's badge and queue count unresolved session recovery records. Copy explicitly separates mission decisions, which remain in Missions. Open selected mission uses the existing guarded exact-ID selection; without selection, Open Missions uses guarded destination navigation. These routes never resolve a decision, dismiss recovery or launch a session. No global mission-decision aggregation is implied.

## ATT-003 recovery reflow

At narrow widths and 200% text, exact recovery identifiers and paths remain readable by wrapping; queue/detail and sidebar do not require horizontal scrolling. Vertical scrolling and the existing narrow navigation strip remain available. Dismiss and reviewed replacement retain the exact record target and existing authority. This slice does not change selection semantics or landmarks.

## ATT-004 landmarks and recovery focus

AppShell owns the single main landmark across all six destinations. Destination roots are named sections; the React mount is not a landmark. The current recovery button exposes aria-current and controls the identified detail. Native Tab, Enter and Space remain the keyboard model. Removal of a focused recovery record moves focus to the reconciled current button or empty heading, including dismissal from a persistent detail button. An inventory update must not steal focus from another control. Resolution failures do not remove the target.

## SET-001 pending folder approval

Folder approval is single-flight from the first activation. During the durable request, keep the exact candidate disclosure visible, announce Saving approval, disable Approve/Cancel and ignore Escape. Cancellation before submission writes nothing. Success projects the returned workspace and closes; failure closes with an actionable error and requires a fresh folder choice/token. Focus returns to Choose folder. No UI cancellation claims to undo an already submitted write.

## SET-002 roster read recovery

A roster reports empty only after a successful null read. Initial loading and failure are distinct; failed reads and exhausted collection checks expose Retry roster for the exact workspace. Retry preserves labeled last-loaded data until fresh readback, and obsolete requests are ignored after cleanup. Follow-up collection reads remain bounded at five with 300ms spacing; failures/exhaustion stop and require deliberate retry. Ended sessions are not described as running. Unknown read state disables new recon and proposal review; an unfinished run cannot start another recon from this control. Read recovery never launches, imports or mutates main-owned proposals.

## SET-003 provider readiness recheck

Check again invokes the existing readiness operation without changing workspace selection, installing, authenticating or launching. Single-flight checking and request-failure feedback identify previous results; panel launch controls stay disabled while checking or after request failure until a successful recheck. Each provider displays its own last-check timestamp and availability. Completion means the check finished, not that every provider is available. Local completion after unmount is ignored; older readiness events cannot replace a newer probedAt for that provider.

## SET-004 Settings reflow

Settings cards and their approval/recon disclosures fit available width at enlarged text. Long exact paths wrap; constrained health/disclosure facts stack; action rows wrap. Vertical scrolling remains available and no label or control is hidden to achieve containment. Approval, readiness and recon authority remain unchanged.

## SET-005 recon proposal lifetime

Before recon confirmation and in the roster, disclose that unaccepted proposals are temporary: exiting/restarting clears them, and a new recon run replaces the current proposals. Point to the existing Review/import flow to keep roles as saved profiles in Agents. Loaded-empty copy states only that no recon run is loaded. Cancelled replacement does not discard the existing run. This contract adds no durable proposal recovery, export or automatic rerun/import.

## MIS-003 existing-session runtime

A selected live worker's recorded launch tuple is fixed. Changing runtime requires explicit new-session selection; it never starts a process by itself. An older draft mismatch offers deliberate adoption of the exact recorded tuple and saves through the existing version-bound draft API. Missing/incompatible session guidance names the worker and offers selection repair. Review uses fresh eligibility for diagnosis; main preview and confirmation still reject stale or mismatched authority.
