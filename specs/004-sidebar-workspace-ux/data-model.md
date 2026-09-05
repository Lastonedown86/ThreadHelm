# Slice 1 state model

No persisted schema changes.

- Draft snapshot: immutable field values plus current stage. A save acknowledges only the snapshot submitted with its expected version.
- Save queue: one active flush promise. The flush drains changed snapshots in order; failure returns null, preserves latest fields, and allows explicit retry. A clean hydrated draft can navigate without a redundant write.
- Navigation request: a pending target action and failure state. idle -> saving -> apply, or saving -> decision. decision -> retry -> saving; decision -> keep -> idle; decision -> explicit leave -> apply. Only one request owns the transition.
- Mission view: entry, draft(ID), or selected mission. Opening entry/draft changes destination to Missions. Selecting a mission clears obsolete composer state. Draft ID changes remount local state.

Existing draft ID, optimistic version and saved receipt contracts remain authoritative. No navigation path grants access or launches a provider.
