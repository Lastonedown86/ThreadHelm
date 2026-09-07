# Feature Specification: Mission Recipes

**Feature Branch**: `codex/mission-recipes`

**Created**: 2026-09-07

**Status**: Draft — specification only; implementation and acceptance pending.

**Input**: User requested specifications for the recommended Mission Recipes and Workspace Collision Radar features. This specification covers Mission Recipes: reusable starting structures for bug investigations, PR reviews, and release preparation that create editable mission drafts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start from a useful recipe (Priority: P1)

As an operator, I can select a recipe and start with an editable outcome, acceptance checklist, and suggested roles instead of repeatedly writing the same structure.

**Why this priority**: Provides the primary benefit without requiring recipe authoring.

**Independent Test**: Choose each bundled recipe and verify its preview produces the expected independent draft without starting work.

**Acceptance Scenarios**:

1. **Given** the recipe list, **When** I select Investigate a bug, Review a PR, or Prepare a release, **Then** I see its purpose, revision, origin, requested literal values, outcome scaffold, checklist, and suggested role descriptions before creating a draft.
2. **Given** a recipe preview, **When** I supply required values and choose Create draft, **Then** an independent mission draft opens in the existing composer with the previewed content and recipe provenance; no session or mission starts.
3. **Given** a generated draft, **When** I edit its content, **Then** my changes do not alter the recipe or another draft; current workspace, crew, access, limits, and launch settings still require the existing review path.
4. **Given** missing required values or oversized input, **When** I attempt creation, **Then** the relevant field explains the limit or missing value, creation is prevented, and valid entries remain intact.

### User Story 2 - Save a reusable structure (Priority: P2)

As an operator, I can save selected mission structure as my own local recipe while excluding details specific to a previous execution.

**Why this priority**: Lets repeatable work match the operator's actual workflow.

**Independent Test**: Select permitted fields from an accessible draft or mission, review the saved content, save, restart, and create an independent draft from it.

**Acceptance Scenarios**:

1. **Given** an accessible draft or mission, **When** I choose Save as recipe, **Then** I explicitly select and preview outcome structure, acceptance checklist, and generic role descriptions, with no automatic inclusion of transcripts, artifacts, evidence, provider configuration, or runtime bindings.
2. **Given** a reviewed recipe, **When** I save, **Then** it becomes available locally with identity, initial revision, origin, and saved time; its source mission is unchanged.
3. **Given** a save failure, **When** saving is attempted, **Then** the editor retains valid input, reports failure, and does not report a successfully saved recipe.
4. **Given** a recipe requiring a PR reference, **When** I enter a URL, **Then** it is treated as literal draft context; no repository fetch, authentication, or external action occurs through the recipe feature.

### User Story 3 - Maintain recipes without changing existing work (Priority: P2)

As an operator, I can duplicate, edit, disable, and delete personal recipes while keeping existing drafts reproducible.

**Why this priority**: Reuse must not silently change work already reviewed.

**Independent Test**: Create two drafts, revise and delete their recipe, restart, and verify draft content and provenance remain intact.

**Acceptance Scenarios**:

1. **Given** a bundled recipe, **When** I customize it, **Then** a personal copy is created and the shipped original remains unchanged.
2. **Given** an existing personal recipe, **When** I save an edit, **Then** a new revision is created and existing drafts remain bound to their captured content and origin revision.
3. **Given** a preview of a recipe changed or disabled in another view, **When** I create a draft, **Then** creation is held until I refresh and review the currently available recipe; entered values are retained where compatible.
4. **Given** a personal recipe is disabled or deleted, **When** I browse recipes, **Then** it cannot create new drafts; existing drafts keep their copied content and provenance. Deletion explicitly discloses that those independent copies remain.
5. **Given** an interrupted save, **When** I restart, **Then** either the previous complete revision or the new complete revision exists, never a partially saved recipe.

### Edge Cases

- Same-name recipes remain distinguishable by origin and stable identity; no silent overwrite.
- Recipe text resembling commands remains literal text; substitution cannot execute expressions, read files, or invoke tools.
- Removed or incompatible variables retain compatible user input and identify fields needing review.
- Deleted source missions do not invalidate deliberately saved independent recipes.
- An unavailable role/profile does not trigger provider substitution or automatic profile creation; role text remains a suggestion for ordinary crew selection.
- Workspace-specific sensitive text in selected fields is disclosed in the save preview and subject to existing authored-content validation; prohibited secrets are rejected with input preserved for correction and never logged.
- Unsupported recipe versions are labeled unavailable without destructive conversion or lost data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Provide an offline local recipe list with purpose, origin, revision, and availability; ship three generic starters: Investigate a bug, Review a PR, and Prepare a release.
- **FR-002**: Recipes MUST contain only a name, description, outcome scaffold, acceptance checklist, suggested role descriptions, declared literal-text variables, and provenance/version metadata. They MUST NOT carry executable actions, workspace approval, provider/model bindings, permissions, credentials, resource approvals, or launch authority.
- **FR-003**: Recipe application MUST preview the fully substituted content and create an independent editable mission draft through the existing composer. It MUST preserve recipe identity/revision and the copied content, and MUST NOT start any process or mission.
- **FR-004**: The user MUST select or review current workspace, crew, access, limits, and launch settings through existing flows. Recipe roles and checklist entries remain proposed context, not assignments or verified criteria.
- **FR-005**: Allow personal recipes to be saved from explicitly selected and previewed permitted fields of an accessible draft or mission. No source transcript, artifact body, evidence, runtime configuration, or private persona may be automatically copied. Shipped starters MUST contain no private user personas or project-specific content.
- **FR-006**: Personal recipes MUST support duplicate, revisioned edit, disable, and explicit delete. Bundled recipes MUST be read-only and customizable through duplication. Existing drafts MUST never be silently rewritten by recipe maintenance.
- **FR-007**: Validate the recipe identity/revision and availability at draft creation. A stale preview MUST require refreshed review without silently substituting content. Compatible entered values MUST be preserved.
- **FR-008**: Substitution MUST accept only declared bounded literal text, show required/optional fields, reject undeclared substitutions, and execute no commands, expressions, tools, or file reads. Missing required values MUST prevent draft creation.
- **FR-009**: Initial authoring limits MUST be explicit: 120 characters for names, 1,000 for descriptions, 8,000 for outcome scaffolds, 30 checklist entries of 1,000 characters each, 12 role descriptions of 1,000 characters each, and 20 variables with values up to 2,000 characters each. Expanded draft content MUST not exceed 64,000 characters; tighter existing composer limits MUST be shown and enforced before creation.
- **FR-010**: Recipe saves MUST be durable, attributable, and complete across interruption. Failures MUST preserve editable input and existing complete revisions. Unsupported versions MUST remain intact and visibly unavailable.
- **FR-011**: Recipe persistence MUST remain local and separate from automatic shared-memory publication, broad logs, provider configuration, and workspace files. Existing content validation and deletion rules apply; deleting a recipe MUST disclose that already-created drafts retain their independent copies.
- **FR-012**: All flows MUST be keyboard accessible, preserve focus and valid edits, support 200% text scaling and reduced motion, and satisfy constitutional contrast requirements. Idle views MUST have no continuous decorative rendering or periodic refresh.

### Key Entities *(include if feature involves data)*

- **Mission Recipe**: Stable identity, origin, availability, and one or more complete revisions of permitted reusable mission content.
- **Recipe Revision**: Immutable saved content and declared variable definitions, with revision identity and authored time.
- **Recipe Preview**: Selected revision plus literal user values and final proposed draft content awaiting creation.
- **Recipe-derived Draft**: Independent mission draft with captured content and origin identity/revision; runtime authority remains owned by mission composition.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least four of five usability participants create an editable draft from a bundled recipe within two minutes, without assistance or starting a session.
- **SC-002**: All starter, custom, duplicate, stale-preview, edit, disable, delete, and restart scenarios preserve expected draft content and exact recipe provenance with zero silent draft mutations.
- **SC-003**: Across acceptance scenarios, there are zero launches, provider calls, workspace writes, automatic role assignments, or inherited permission approvals caused by recipe actions.
- **SC-004**: Required-variable, undeclared-variable, field-limit, expanded-limit, prohibited-content, unsupported-version, and interrupted-save cases produce explicit outcomes without losing previously saved data or valid current input.
- **SC-005**: On a representative Windows 11 x64 machine selected during planning, at least 19 of 20 list openings with 500 recipes show usable results within one second, and 19 of 20 valid maximum-size previews appear within two seconds.
- **SC-006**: A keyboard-only operator completes select, fill, preview, create, save, and edit flows; essential content remains readable and reachable at 200% scaling. A 60-second idle observation has no periodic refresh or decorative motion.

## Assumptions

- Recipes reuse mission structure; Feature 002 US7 agent-profile templates remain a separate existing capability. Planning must reuse appropriate validation and provenance conventions without treating a mission recipe as an agent manifest.
- Feature 003 owns verified contracts and evidence. A recipe checklist is proposed acceptance context, not verification evidence or contract approval.
- The existing composer owns field compatibility and final review; Feature 004 owns navigation consistency. Planning must inspect current interfaces and present the bounded interaction design before UI implementation.
- Starters request investigation, review, and release preparation only. Merging, deployment, purchasing, and external delivery remain outside recipe authority.
- Import/export, recipe marketplace, remote sharing, AI generation, scripts, direct recipe editing of active missions, and automatic starts are excluded.
- This draft neither reorders the roadmap nor closes Feature 002–004 or preview obligations. Windows validation, persistence failure tests, and representative rendering/memory budgets must be planned before implementation.
- Feature 005 is reserved in the existing briefing worktree; this feature uses 006. Its ignored local selector lives only in this isolated worktree, preserving the original checkout's Feature 002 selector.
