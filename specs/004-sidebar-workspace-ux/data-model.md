# Slice 1 state model

No persisted schema changes.

- Draft snapshot: immutable field values plus current stage. A save acknowledges only the snapshot submitted with its expected version.
- Save queue: one active flush promise. The flush drains changed snapshots in order; failure returns null, preserves latest fields, and allows explicit retry. A clean hydrated draft can navigate without a redundant write.
- Navigation request: a pending target action and failure state. idle -> saving -> apply, or saving -> decision. decision -> retry -> saving; decision -> keep -> idle; decision -> explicit leave -> apply. Only one request owns the transition.
- Mission view: entry, draft(ID), or selected mission. Opening entry/draft changes destination to Missions. Selecting a mission clears obsolete composer state. Draft ID changes remount local state.

Existing draft ID, optimistic version and saved receipt contracts remain authoritative. No navigation path grants access or launches a provider.

## Slice 2 renderer scope

Add `sessionScope: 'all' | 'mission'` to ephemeral renderer State, initially `all`. `selectDestination('sessions')` resets it to `all`; `setSessionScope` changes only the filter. Mission terminal navigation sets `mission` after selecting the destination. The effective mission filter requires a selected mission ID, and uses bindings only from detail with that same ID. Selection fallback uses visible session IDs only. No persisted model or contract schema changes.

## Slice 3 renderer inventory state

Track requested page count, filter, profile event sequence and retry generation. Retain the completed request identity separately from the accumulated rows and nextCursor. Only rows for the current filter/event sequence are actionable; paging may retain those rows while loading. Selection is an exact profile ID reconciled against completed visible inventory. Detail has an exact ID key and loaded sequence. No durable model changes.

## Slice 4 review state

Supersession fields and main disclosure remain ephemeral renderer state. An operation generation invalidates responses on detail replacement or cancellation; pending review/append blocks duplicate requests. Editing clears disclosure. No durable model changes.
