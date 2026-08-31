# Contract: Agent Creation Wizard and Templates

The wizard produces reviewed `threadhelm/agent-profile@1` data through bounded local forms. Templates and
drafts are non-executable scaffolds; they cannot launch providers, read workspaces, grant tools, or
assign mission roles.

Bundled starters, new drafts, duplicated templates, and wizard save/export output use the native
ThreadHelm identifier. The legacy `munder-difflin/hire@1` identifier remains accepted for imports
and persisted drafts. Completing a legacy draft produces native data for exact JSON review before
confirmation; it does not rewrite the source revision, its digest, or historical draft fields.
Existing imported template content remains exact until the user creates a new copy or revision.
Both identifiers use the same strict fields and authority boundaries; other identifiers fail closed.
On an existing installation, bundled starters receive an immutable new revision only when the
identifier is the sole content change. Drafts pinned to the equivalent legacy bundled revision
remain reviewable; changes to goals, variables, or other content still enforce stale-source rules.

## Wizard steps

1. **Start**: blank, bundled generic template, user template, or reviewed profile revision.
2. **Identity**: name, description, author, and optional local theme/style label.
3. **Role and goal**: bounded untrusted goal text with role-scoping guidance.
4. **Capabilities**: normalized routing labels only; no tool or permission chooser.
5. **Runtime requests**: provider/model preference, isolation request, and token-cap request. Effort,
   permission mode, effective tools, workspace, and mission role are explicitly deferred to
   launch/mission policy.
6. **Review**: exact JSON, strict validation, compatibility reasons, provenance, and action disclosure.

Each transition validates its owned fields and persists the draft through Electron main. Back,
cancel, delete, and restart preserve or remove state honestly. No step emits provider configuration.

## Templates

Bundled templates are immutable/versioned generic narrow roles: investigator, implementer, reviewer,
quality verifier, documentation helper, and release gatekeeper. User templates may be created from a
draft or reviewed profile, duplicated, revised, disabled, and deleted. Bundled templates contain no
Marvel identity, project-specific goal, credential, workspace path, provider tool, or authority field.

Optional variables are declared names with bounded literal string values. Substitution occurs only
inside supported string fields, is shown in final preview, and supports no expressions, conditions,
scripts, environment variables, file reads, includes, or tool calls.

## Views and operations

| Operation | Request | Result | Important failures |
|---|---|---|---|
| `agentWizard.createDraft` | blank/template/profile revision source | draft detail | source unavailable/incompatible, draft limit |
| `agentWizard.getDraft` | draft ID | exact fields, step, issues, provenance | not found/deleted |
| `agentWizard.updateStep` | draft ID/version, step, supported fields | updated draft | stale version, invalid/unknown field, bound exceeded |
| `agentWizard.previewCompletion` | draft ID/version, action | exact JSON/compatibility + token | incomplete, unresolved variables, stale template |
| `agentWizard.confirmProfile` | token + explicit confirmation | profile/revision summary | expired/replayed/changed draft |
| `agentWizard.previewExport` | token + selected `*.hire.json` target | path/collision disclosure + export token | invalid target, changed draft |
| `agentWizard.confirmExport` | export token + explicit overwrite choice | export result | target changed, collision unapproved, atomic write failed |
| `agentWizard.deleteDraft` | draft ID/version | content-free result | stale version/completed |
| `agentTemplates.list/get` | filters/cursor or template ID | summaries/detail | invalid cursor/not found |
| `agentTemplates.saveRevision` | reviewed draft/profile source + metadata | template revision | duplicate/stale/limit/invalid scaffold |
| `agentTemplates.duplicate` | template revision + new identity | new template | stale source/name conflict |
| `agentTemplates.setEnabled` | template/revision + enabled | updated summary | bundled/deleted/stale |
| `agentTemplates.delete` | user template + confirmation token | deleted summary | bundled, active draft provenance, stale token |

Draft/template events contain IDs, revision/state, step, validation/compatibility codes, and
timestamps only. Field values, variables, generated JSON, goal text, and export paths require an
explicit detail/preview request and never enter broad logs.

## Completion and export invariants

- Final JSON must pass the exact profile parser; the wizard does not maintain a looser second schema.
- Save-as-profile calls the same digest-bound revision service used by import and launches nothing.
- Export is restricted to a user-selected `.hire.json` file, writes UTF-8 JSON atomically, rechecks
  the target before replacement, and never overwrites without a distinct confirmation.
- A completed/failed export records safe evidence but does not retain the full target path in broad events.
- Template or wizard presentation uses steps, forms, text, tables, and status messages—no avatar,
  character-art, topology, animation, or model-generated image requirement.

At launch, ThreadHelm resolves provider/model/effort by one-run override > exact agent/profile revision request > task-type/project policy > CLI default and displays the result. Model and effort controls directly refresh the bound preview; no second settings-review action is required, and the one checkbox confirms only the folder boundary. CLI default is explicit; readiness probing and app load do not prompt. Effort remains launch policy and is not added to `munder-difflin/hire@1`.
