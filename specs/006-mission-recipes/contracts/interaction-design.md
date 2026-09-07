# Interaction design — approved 2026-09-07

This proposal was reviewed and approved by the owner before UI implementation; the approval record is below.

## Start from a recipe

Within Missions entry, retain ordinary New mission and add Start from recipe. Open a Missions-local list with bundled/personal filters, purpose, origin, revision, short identity and availability. Load 50 summaries at a time through an explicit Load more control; preserve exact selected ID. Disabled/unsupported items explain why they cannot be used. No seventh global destination and no placement in Agents templates.

Selecting a recipe opens its purpose, revision/origin, required/optional literal fields and fully expanded preview. Input edits invalidate Create draft until the updated preview is ready. Show exact objective, checklist-to-evidence projection and suggested roles, plus field/byte limits. Create draft is explicit and creates only a draft. It opens Outcome with captured origin and editable role suggestions; preserve the existing Crew, Access & limits, Review and confirmation sequence. No runtime/profile selection happens here. If already editing another draft, use App's save-aware exit first; save failure retains the current view and pending navigation choices.

Oversized content shows the relevant field and composer limit. Offer shorter values or a personal editable copy; no truncation. At the 20-draft cap, preserve preview inputs and expose the existing draft inventory. A stale source shows Refresh preview; keep compatible values by variable key, mark changed/removed definitions, and require review before Create draft becomes actionable. Deletion/disable never silently switches recipes.

## Save personal structure

From an accessible draft or mission, Save as recipe opens an editor. First flush current draft edits. All content selections start unchecked. Select outcome/checklist explicitly; role fields contain only existing inert suggestions or manual generic text, never profile/worker assignments. Show exact selected text and disclosure about project-specific content. Name, description and optional literal variables are editable. Preview saved recipe is a distinct step; Save personal recipe commits the exact reviewed content and shows identity, revision and saved time.

Failed saves retain input and display Retry; no success until durable receipt. Safe authoring buffers autosave using the existing single-flight/800ms pattern, with Saving locally / Saved locally / Save failed states. Restart offers exact-ID resume of the last acknowledged safe buffer. Unsaved invalid content is never claimed recoverable. Guard leaving an unsaved recipe editor with the same save/retry/explicit-discard conventions as mission drafts.

## Maintain recipes

Personal detail offers Edit, Duplicate, Disable/Enable and Delete. Edit appends a revision and discloses existing drafts remain unchanged. Bundled detail offers Customize as personal copy. Same-name items show short/full IDs and origin. Stale edits preserve the buffer and offer reload or deliberate duplication, never overwrite.

Delete uses the shared native modal, exact name/ID/revision, and clear text: existing draft copies and their provenance remain. Cancel writes nothing. Pending confirmation is single-flight; failures stay visible and require fresh preview. Successful deletion returns focus to the next available row/list heading. Disabling is reversible and preserves selection; creation is unavailable until enabled and previewed again.

## Accessibility and visual behavior

Conventional labeled controls, visible keyboard focus, headings and field-linked error text. Error summary focuses first invalid field and expands hidden sections. Native modal traps focus, Escape cancels and returns focus to its trigger. Async status is politely announced without reading full content. At 200% scale and narrow widths, list/detail stack with reachable actions and no clipped essential content. Meet WCAG 2.2 AA contrast (4.5:1 ordinary text, 3:1 large text and essential control/focus boundaries), applicable target size/interaction requirements and reduced-motion settings. No decorative animation, periodic refresh, relative-time tickers or continuously mounted preview effects.

## Owner approval — 2026-09-07

Owner accepted the recommendations in conversation: 'Let’s go with the recommendations'. Missions placement, literal preview/create, explicit source selection/save preview, revisioned maintenance and recovery interactions are approved for implementation. T003 is satisfied; no repeat approval required.


