# Research and compatibility findings

Baseline: `f8a2c80`, `codex/mission-recipes`, 2026-09-07. Initial changes were only the untracked Feature 006 directory. Spec/checklist preserved. Local selector targets 006; original checkout targets 002. Hidden-file search found no repository AGENTS.md/CLAUDE.md; supplied instructions and local planning skill apply. Constitution v1.0.1. No extensions.yml exists, so pre/post plan hooks are absent. Setup returned correct feature paths; its BRANCH `006-mission-recipes` is selector-derived, while Git reports `codex/mission-recipes`.

## Separate recipes from profiles

**Decision**: Reuse patterns, not agent-template types or lifecycle behavior.

**Rationale**: `packages/domain/src/agent-template.ts`, `packages/persistence/src/repositories/agent-templates.ts` and `apps/desktop/src/main/coordination/profile-wizard.ts` provide immutable revisions, optimistic guards, preview tokens and main-owned authoring. Template deletion blocks open source drafts and completion rechecks live source availability; recipes require independent copies surviving deletion. Profile template fields and quotas also differ: 16 variables/256-code-point values and 100 active templates are unsuitable for recipes.

**Alternatives considered**: AgentManifestV1 extension or mission mode in agent templates; rejected because identity, authority, limits and lifecycle differ.

## Composer projection

**Decision**: Outcome -> objective; checklist joined with newline -> completionEvidence. Preview exact copied text. Roles remain editable inert sidecar text, never worker rows. New recipe drafts use sourceMissionId=null.

**Rationale**: `packages/contracts/src/index.ts` MissionComposerFields has objective max4,000 and completionEvidence max2,000, no generic checklist/roles. MissionText/MissionEnvelopeInput additionally enforce UTF-8 byte limits after trim. Worker rows contain runtime, permissions, identity, bounds and assignments. `apps/desktop/src/main/coordination/mission-composer.ts` create accepts sourceMissionId for mission revision semantics, not recipe provenance. New main-owned atomic application is needed. Existing repoIdeaSource demonstrates inert provenance but contains workspace/provider information and cannot be copied as the recipe schema.

**Alternatives considered**: Truncation, increased composer limits, roles as workers, everything in completionEvidence; rejected for silent loss, scope growth or authority confusion.

## Bounds and authored safety

**Decision**: Keep spec authoring limits, independently enforce expanded and composer limits. Match existing UTF-16 length semantics and explicitly explain them in UI. Validate UTF-8 and serialized JSON size too. Use `packages/contracts/src/content-text.ts` isSafeAuthoredText on all authored and expanded content.

**Rationale**: A 64,000-character expansion is not a 64 KiB JSON document. Existing mission draft field_values is capped at 65,536 UTF-8 bytes. Credential patterns, unpaired surrogates and disallowed controls must fail without logging input. Ordinary commands and URLs remain literal text. Spec-valid but incompatible recipes can be saved with warnings; draft creation is blocked pending deliberate correction.

**Alternatives considered**: Character counts alone, agent-template quotas, expression/template engines or environment/file expansion; rejected.

## Persistence and recovery

**Decision**: Main-owned SQLite transactions, recoverable safe editor buffers, immutable revisions, idempotent receipts and independent draft context.

**Rationale**: `packages/persistence/src/schema.ts` is v5; migrate.ts uses DELETE journaling, FULL synchronous and foreign keys. Account for CURRENT_SCHEMA_EXTENSIONS repair convergence as well as versioned migration. `repositories/mission-composer.ts` supplies optimistic versions, transactional writes, 20-open-draft cap and deletion scrubbing. `useDraft.ts` / `draft-save-queue.ts` serialize 800ms-debounced saves but unacknowledged renderer edits are not crash-durable. `recovery.ts` preserves failed/corrupt data and journals before recovery; new/empty storage must remain explicitly disclosed. Existing main confirm commits supervisor state before marking draft converted; retain that inherited crash gap as an open dependency.

**Alternatives considered**: Workspace JSON, localStorage, shared-memory publication or wholesale template lifecycle reuse; rejected by authority, recovery or independence requirements.

## Navigation and feature boundaries

**Decision**: Missions-local recipe list/preview/editor; reuse App.tsx save-aware guard, features/shell/navigation.ts six destinations, and features/coordination/ModalDialog.tsx.

**Rationale**: Feature 004 already provides guarded transitions, exact identity and native modal conventions. Feature 003 remains a draft spec owning future verified evidence/contracts. Recipe context creates no approved criteria or verification state.

**Alternatives considered**: Seventh destination or Agents-library integration; rejected as unnecessary navigation expansion and conceptual mixing.

## Research completion

Two read-only research agents inspected composer and template/persistence boundaries while navigation/governance were inspected locally, as requested by the planning skill. All technical unknowns have bounded design decisions. Runtime performance, installed dependencies and acceptance were not tested. No external source was needed for these repository-local contracts.

## Implementation baseline — 2026-09-07

T001 verified at f8a2c80 on codex/mission-recipes: initial changes only specs/006-mission-recipes/. Local selector remains 006 and original checkout remains 002. Existing Feature 002–004 deferrals are unchanged. Dependency installation uses the frozen lockfile in this isolated checkout. Ignore files already cover applicable dependencies/output/secrets; no publishing, Docker or Terraform setup is needed.
