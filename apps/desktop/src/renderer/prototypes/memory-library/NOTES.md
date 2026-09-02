# ThreadHelm Memory Library design gate

This disposable prototype interprets a spatial memory system as a calm book library. It borrows the
idea of scoped locations from MemPalace without adopting automatic transcript capture, a separate
storage authority, or its product identity.

## Variants

- **A — Catalog hall:** collection-first browsing with every lifecycle state and explicit pagination.
- **B — Reading desk:** search-led evidence, an open-volume detail, “Why this appeared,” and the
  Librarian beside the results.
- **C — Mission reading room:** a bounded context packet for one mission, with budget and inclusion
  controls.

## Recommended direction

Select B as the primary Memory destination and use C as the mission-scoped context-pack view. The
Librarian is the continuous Memory Coach. It may search, explain, propose, and organize, but it may
not publish, resolve conflicts, delete content, or grant authority without the existing explicit
operations.

Library mapping: approved workspace = library; mission or topic = collection; memory entry = volume;
immutable revision = edition; source reference = citation card; lifecycle history = circulation
record. Deleted content retains only a content-free receipt.

## Review URLs

- `http://127.0.0.1:4182/?variant=A`
- `http://127.0.0.1:4182/?variant=B`
- `http://127.0.0.1:4182/?variant=C`
