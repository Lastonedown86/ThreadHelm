# Recipe interface and authority contracts

Proposed typed main/preload namespace `missionRecipes`; no network API. Every input/output uses strict schemas. Main validates independently of renderer and enforces current storage availability. Errors carry code, field path, limit/actual size and safe guidance, never submitted text.

| Operation | Input | Result / guard |
|---|---|---|
| list | cursor, origin/availability filter, pageSize<=50 | Summary page: ID/name/purpose/origin/revision/version/availability; stable cursor; no bulk bodies |
| get | recipeId | Complete current revision or explicit unavailable/not-found |
| preview | recipeId, revisionId, expectedVersion, declared values | Exact expanded outcome/checklist/roles, projected composer fields, limits/issues and opaque token |
| createDraft | previewId, requestId | Atomic draft ID/version/save receipt; sourceMissionId=null; token bound to exact values/content and current source |
| openEditor / getEditor | mode and optional source ID/version or editorId | Recoverable editor with exact identity/version |
| saveEditor | editorId, expectedVersion, incomplete safe content | Durable buffer receipt; no available recipe yet |
| previewSource | draft/mission ID, expected source version, selected field paths | Main reads accessible source and returns ONLY selected allowed content, source version and token |
| previewSave | editorId/version | Exact content, origin and new/edit/duplicate target revision proposal; final validation |
| save | savePreviewId, requestId | Atomic initial/new revision receipt after source/base/editor version checks |
| duplicate | selected recipe/revision/version | Personal editor copy; final save still requires preview |
| setEnabled | recipeId, expectedVersion, enabled, requestId | Versioned receipt; bundled denied |
| previewDelete / delete | exact ID/version; then token/requestId | Disclosed retained copies; atomic source scrubbing; bundled denied |
| discardEditor | editorId, expectedVersion | Explicitly discard recovery buffer; no source mutation |

All preview tokens bind operation kind and exact target. Mutation invalidates relevant tokens; implementation consumes mutation tokens when the attempt begins. After a failed mutation require fresh review unless a durable receipt establishes that this exact operation already committed. Duplicate button submissions share requestId; retries resolve receipt first, even after process restart. Changed-value requests require a new preview/key. Stale errors preserve compatible current values but never auto-submit. Events contain IDs/version/kind/time only; refresh on relevant events or explicit user action, never polling. Ignore obsolete async responses.

Errors include INVALID_RECIPE, UNSAFE_CONTENT, REQUIRED_VALUE, UNDECLARED_VARIABLE, FIELD_LIMIT, EXPANDED_LIMIT, COMPOSER_LIMIT, SERIALIZED_LIMIT, STALE_PREVIEW, STALE_EDITOR, DISABLED, DELETED, UNSUPPORTED_VERSION, STORAGE_UNAVAILABLE, SAVE_FAILED, REQUEST_CONFLICT and existing MISSION_DRAFT_LIMIT. Adapt names to shared error conventions during implementation without weakening outcomes.

## Source extraction

Flush the source draft through the existing save queue before capturing its version. Nothing is selected by default. Allow objective, completionEvidence (explicitly split on newline and preview as checklist entries), and explicitly authored generic role descriptions. Actual worker assignments, profile/persona bodies, runtime configuration, evidence records, artifacts and transcripts are not extraction sources. If no inert role suggestions exist, offer empty manual role fields. Oversized source text is retained in the editor for deliberate correction; do not truncate or claim it saved. User may replace selected text with declared placeholders manually. Preview flags that selected text can contain project-specific details; prohibited secrets are rejected by existing validation.

Before save, verify the selected accessible source is still the reviewed version. A changed/deleted source requires fresh review, or deliberate conversion to an independent manual editor after reviewing retained selected text. After successful save, source deletion never invalidates the recipe. Extraction is read-only and never enumerates workspace files or performs URL fetches.

## Authority boundary

Recipe schemas allow only permitted content and provenance. Reject workspace approvals, resource approvals, runtime/provider/model settings, permissions, active assignments, tools, executable actions and launch state at every boundary. Main recipe service has no dependency on launch/provider/supervisor execution APIs. Generated draft contains objective/completionEvidence and separate inert context only; no source mission, worker rows, approvals or inherited access.

Use an explicit allowlist when projecting ordinary composer fields into its authority envelope; never spread recipe context into it. Existing Outcome -> Crew -> Access & limits -> Review path and exact-preview confirmation remain necessary. Suggested roles are readable/editable notes for ordinary manual crew selection; they never create profiles or choose substitutes. Checklist entries are proposed text, not Feature 003 criteria IDs, verified evidence or approval.

## Implemented API reconciliation — 2026-09-07

The executable strict definitions are in `packages/contracts/src/mission-recipes.ts`. `list` always returns at most 50 summaries, with optional cursor/origin/availability; caller-controlled page size is unnecessary. `get` returns current detail and optional inert `copiedFrom` recipe/revision/version provenance. `listEditors({cursor?})` returns at most 50 `{editorId,version,name,updatedAt}` summaries and `nextCursor`, enabling exact-ID recovery.

`previewSource({source:{kind,id,version},fields})` accepts only explicitly selected `objective`, `completionEvidence`, `suggestedRoles`, and returns `{previewId,content}`. Its transient safe-text response may exceed individual authoring field limits so the renderer can retain and correct selected text. `openEditor({sourcePreviewId?,content?})` accepts corrected bounded content only with the reviewed source token; no input creates an empty manual buffer. It returns the editor, not a recipe. `saveEditor` returns the complete acknowledged editor/version; `previewSave({editorId,expectedVersion})` returns `{previewId,content}`; `save({previewId,requestId})` returns a durable receipt. `edit` and `duplicate` take `{recipeId,revisionId,expectedVersion}` and return a buffer. `detachSource({editorId,expectedVersion})` deliberately converts retained source/base content to independent creation. A stale editor can be explicitly reloaded, or its valid current text copied to a new editor without overwriting the remote buffer.

`previewDelete({recipeId,expectedVersion})` returns the token and exact identity/version/name; `delete({previewId,requestId})` commits only that reviewed target. `missionRecipes.changed` contains `{type,recipeId,version,kind,occurredAt}` only. Renderer refreshes are explicit, with no recipe polling. Ordinary mission sources have no inert role context in their authority envelope, so selecting roles yields no assigned/profile content. Source draft capture flushes edits and reads the resulting current version before selection.
