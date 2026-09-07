# Data model and persistence

Proposed contracts, not existing APIs. Main alone writes local SQLite. No recipe persistence in workspace files, provider configuration or shared-memory publication.

## Entities

| Entity | Fields |
|---|---|
| MissionRecipe | UUID recipeId; origin bundled/personal; schemaVersion=1; enabled/disabled; positive optimistic version; currentRevisionId; createdAt/updatedAt; optional copied-from recipe/revision IDs |
| RecipeRevision | UUID revisionId; recipeId; increasing ordinal; authoredAt; authorKind local-operator/bundled; immutable RecipeContent; content digest |
| RecipeContent | name, description, outcomeScaffold, ordered acceptanceChecklist strings, ordered suggestedRoles strings, declared variables; strict unknown-key rejection |
| LiteralVariable | Unique key matching `[a-z][a-z0-9_]{0,39}`, label <=120, required boolean; no defaults, expressions or resource types |
| RecipeEditorDraft | editorId/version; mode create/edit/duplicate/save-source; base recipe/revision/version if applicable; selected editable content; optional source type/ID/version; saved time |
| RecipePreview | Opaque main-owned previewId; recipe/revision/version; values; canonical expanded content; exact composer projection; digest/adapterVersion; issues; timestamp |
| DraftRecipeContext | Owning mission draftId; immutable recipe/revision/name/origin/appliedAt/digest and expanded snapshot; separately editable suggestedRoles; no live FK to source recipe |
| OperationReceipt | requestId, operation kind, request digest, committed target IDs/version/time; no authored content |

Identity never derives from name. Same-name recipes display origin and short ID. Preview tokens are ephemeral; restart requires new review.

## Validation and projection

| Field | Limit |
|---|---|
| Name | Nonblank, <=120 |
| Description | <=1,000 |
| Outcome scaffold | Nonblank, <=8,000 |
| Checklist | <=30 nonblank entries, <=1,000 each before expansion |
| Roles | <=12 nonblank descriptions, <=1,000 each before expansion |
| Variables | <=20 unique declarations; values <=2,000 each; required values nonblank |
| Expanded content | Outcome + checklist + roles + checklist join separators <=64,000 UTF-16 units |
| Projected objective | Boundary-trimmed expanded outcome; <=4,000 UTF-16 units AND UTF-8 bytes |
| Projected completionEvidence | Expanded checklist joined with newline, boundary-trimmed; <=2,000 units AND UTF-8 bytes |

Counts match current JS contracts; UI explains that some symbols count as two units and displays byte limits where relevant. The preview shows any boundary whitespace normalization. Empty checklist can create an incomplete draft with explicit notice; ordinary composer readiness still requires completion evidence. No truncation or silent entry removal. Expanded roles may exceed pre-expansion entry lengths but stay within aggregate bounds. Editing role suggestions in a derived draft enforces the same aggregate bound; ordinary objective/evidence edits retain composer limits.

Only scaffold/checklist/role text recognizes `{{key}}`. A backslash before opening braces escapes the token start to literal braces. Malformed or undeclared tokens are field errors. Values are inserted once and never rescanned: shell syntax, URLs and tokens inside values are inert. Optional missing values become empty strings. Accept declared own keys only; reject extra keys and prototype tricks. Validate all authored fields, values and expanded output with isSafeAuthoredText. No raw text in errors/logs.

## Tables and storage

Add `mission_recipes`, `mission_recipe_revisions`, `mission_recipe_editor_drafts`, `mission_draft_recipe_context`, `mission_recipe_operation_receipts` in the next available migration after current v5. Follow schema extension repair conventions so fresh, upgraded and repaired databases converge. Content/editor/context JSON each have a 1 MiB serialized UTF-8 ceiling; validate worst-case escaping and Unicode against this cap. Existing mission draft field_values retains 65,536 bytes. Sidecar storage avoids doubling copied context in field_values. All payload validation happens before SQL and returns field/size issues with current input retained.

Immutable original expansion is separate from current composer fields and editable roles. No variable-value map is needed after application: exact expanded content and origin identity/revision are sufficient. Never reconstruct drafts from a live recipe on reload. Conversion retains sidecar with the retained draft record, not in the mission authority envelope.

Bundled definitions have stable IDs/revision digests. Updates add revisions; never overwrite an existing revision ID. Unsupported schemas stay byte-for-byte intact and visibly unavailable for use/edit; no coercion or downgrade. Do not inherit agent-template count/revision quotas; inventory is paginated and 500 recipes must be supported.

## Atomic operations and state transitions

- Save revision: validate; compare expected identity version and base revision; insert immutable revision; advance head/version; write receipt; consume/update editor buffer in one transaction. Stale writes preserve the editor for reload or deliberate duplication.
- Save safe editor buffer: allow incomplete required fields but validate supplied text/bounds; optimistic version and durable acknowledgement. Invalid/prohibited text stays only in current renderer for correction. Last acknowledged safe buffer survives restart; pending keystrokes may not. Show saving/saved/failed precisely.
- Create draft: recheck current recipe/revision/version/availability and exact preview; check 20-open-draft cap; insert draft with sourceMissionId=null, context and receipt in one transaction. No renderer create-then-update chain.
- Edit/enable/disable: version increments on every lifecycle/content mutation, including disable/re-enable. Old previews invalidate even when revision content is unchanged. Existing draft content stays untouched.
- Duplicate: new personal identity and revision 1 from explicit selected revision; allowlisted content only. Bundled content is read-only; customization always duplicates.
- Delete personal recipe: exact-version preview/confirm, disclose retained independent drafts, scrub all source revisions/editor buffers and remove recipe identity transactionally. Retain only content-free deletion receipt/tombstone if needed for idempotency. Never cascade into derived draft context. Bundled edit/disable/delete are denied.
- Discard mission draft: existing explicit discard transaction also scrubs sidecar. Recipe deletion is logical deletion under existing storage rules, not a claim of forensic disk/backup erasure.

Recipe state: absent -> enabled revision1 -> new immutable revisions; enabled <-> disabled; personal -> deleted. Preview: editing -> valid preview -> create; any input or source change -> needs fresh preview. Deleted/disabled/unsupported sources block use, never pick a replacement.

Before-commit interruption leaves previous complete state; after-commit/lost-response retries return the same receipt/draft. Same requestId with different digest is conflict. Receipts follow target lifecycle and never resurrect a deleted target. Restart reads independent draft snapshots directly. Read errors show recovery/retry, never successful empty state.

Migration is transactional. Preserve incompatible/corrupt storage and journals using existing recovery semantics; disclose recovery initialization. No automatic downgrade. Rollback uses a compatible application or an explicitly restored pre-upgrade backup; never silently discard newer records.

## Implementation reconciliation — 2026-09-07

Migration v6 now includes the five content/editor/context/receipt tables above plus `mission_recipe_origins`. This small sidecar retains only copied-from recipe ID, revision ID and identity version for personal duplicates, independently of the source's later deletion. It participates in schema-extension repair and the initial copy transaction. Recipe deletion scrubs its own provenance row but does not cascade from source IDs into copies. No authority or source body is added to this attribution.

`MissionRecipeEditorContent` allows incomplete name/outcome/checklist text but still enforces safety, count, per-field and serialized bounds. Incomplete variable declarations remain renderer-only until their key and label are valid. `useRecipeEditor.ts` reuses `createDraftSaveQueue` directly rather than introducing a second queue implementation. An 800ms debounce schedules single-flight writes; edits during a save drain before navigation, and obsolete acknowledgements never replace newer visible text. Only acknowledged buffers are claimed recoverable.
