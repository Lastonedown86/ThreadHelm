# Memory Library and Librarian Implementation Plan

**Decision:** Search-led Reading Desk as the primary Memory destination; Mission Room provides a
bounded context packet. The Librarian is a constrained coach over existing memory operations.

**Production files**

- Create `apps/desktop/src/renderer/features/coordination/MemoryLibraryWorkspace.tsx`.
- Create `apps/desktop/src/renderer/features/coordination/MemoryLibrarian.tsx`.
- Create `apps/desktop/src/renderer/features/coordination/MissionReadingList.tsx`.
- Create `apps/desktop/src/renderer/styles/memory-library.css` and import it from `styles.css`.
- Modify `MemoryList.tsx`, `MemoryDetail.tsx`, `MissionComposer.tsx`, and `App.tsx`.
- Test `tests/e2e/hive-memory.spec.ts`, `tests/contract/shared-memory.test.ts`,
  `tests/unit/domain/shared-memory.test.ts`, `tests/unit/persistence/shared-memory.test.ts`,
  `tests/integration/windows/shared-memory.test.ts`, and `tests/e2e/accessibility.spec.ts`.

## Sequence

1. Add failing UI journeys for search, exact edition citation, why-matched explanation, explicit
   pagination, lineage, conflict, and active/contested/superseded/retracted/expired/deleted states.
2. Recompose existing scoped search/get/publish/supersede/retract/delete operations as Library,
   Collection, Volume, Edition, Citation, and lifecycle presentation. SQLite remains authoritative.
3. Implement the Librarian first as a deterministic coach over visible metadata and existing
   operations: construct searches, explain scope/status/source, open publication review, and propose
   reading-list membership. It cannot mutate content or invoke a provider silently.
4. Add Mission Reading List review with exact revision IDs, inclusion controls, total context bytes,
   contested/stale warnings, and no authority inference. A natural-language provider-backed
   Librarian requires a separate contract/spec before any provider call is added.
5. Prove scope isolation, FTS deletion, stable cursor pagination, restart integrity, bounded context,
   accessibility, lint, and typecheck.
