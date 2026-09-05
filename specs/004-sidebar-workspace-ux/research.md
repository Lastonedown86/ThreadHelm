# Slice 1 research decisions

- Decision: every shell transition uses the same guard, including New mission, Resume draft, mission selection and revision entry. Rationale: audit D03/D05/N01/N04 show divergent handlers. Reject separate per-button fixes because omissions recreate data loss.
- Decision: a false or rejected save blocks navigation. Show Retry, Keep editing and Leave without saving in the existing native modal. Retry retains the original target; Escape means Keep editing. A pending transition cannot be replaced by repeated clicks. Rationale: one clear decision and predictable targeting.
- Decision: serialize complete flush cycles, not merely individual requests. Track the exact saved snapshot; if edits arrive during a request, save again using the returned version before resolving navigation. Stop on failure. Reject unconditional dirty=false because it acknowledges edits the request never contained.
- Decision: remount the composer by draft ID and withhold editing until draft hydration completes. Rationale: per-draft hook refs and delayed responses must not leak across drafts or overwrite early typing.
- Decision: entry and draft views clear obsolete composer context and hide mission-row selection; selecting a mission clears entry/draft state only after a successful guard. The store may retain its last mission ID for return navigation.
- Decision: retain the existing successful Close receipt in this slice. MIS-009 close simplification is a separate proposal; its explicit failure exit remains available.

All decisions use current repository source and audit evidence; no dependency changes or unresolved external questions.
