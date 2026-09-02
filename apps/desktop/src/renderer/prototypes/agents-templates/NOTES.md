# Agents and Templates design gate

This disposable prototype compares three structures without importing production code or saving
profiles.

## Shared boundaries

- Every agent exposes its description, goal, abilities, provider request, and exact revision.
- Bundled starters are generic and visually separate from private profiles stored on this machine.
- Imported profiles retain their filename and digest provenance in an exact-field preview.
- Profiles and templates are inert. They grant no workspace, tools, mission role, or budget.
- Imported and locally authored profiles remain visibly distinguishable.

## Variants

- **A — Roster first:** quickest for managing many existing profiles, but gives new users little
  guidance about how to create the right agent.
- **B — Profile studio:** strongest inspection and revision-history view, but begins with internal
  profile structure instead of the user's desired outcome.
- **C — Guided library:** begins with the job to be done, offers generic guided starters, resumes
  drafts, supports exact JSON import, and keeps private local profiles in a separate section.

## Selected direction

Variant C — Guided library is selected under the owner's standing approval of the recommended
direction. Variant B's detailed profile presentation becomes the explicit detail view after a user
opens a local profile. The design does not merge private local profiles into bundled starters.

## Review URLs

- `http://127.0.0.1:4181/?variant=A`
- `http://127.0.0.1:4181/?variant=B`
- `http://127.0.0.1:4181/?variant=C`
