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

## Slice 5 search request identity

MemoryList owns the selected workspace and contested filter across direct and guided requests. The parent increments a guided request version instead of remounting the list. Search and detail generations discard obsolete successes and failures; context changes clear results/detail and reset pending state. No durable state changes.

## Slice 7 temporary reading-list state

Renderer store holds only entryId/revisionId/scope references, deduplicated by revision ID, until app restart. Each mounted row projects a revision-specific main read into title/status/expiry metadata and discards body/lineage content. Lifecycle event/request identity gates hide obsolete metadata; cancellation prevents late results from repopulating removed/unmounted rows. A single deadline timer triggers an authoritative expiry refresh, capped at the platform timeout maximum; no periodic polling. Deleted/expired entry status overrides revision status; otherwise the exact selected lineage revision supplies status. No durable schema changes.
