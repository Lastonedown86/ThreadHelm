# Feature Specification: Sidebar and Workspace UX Consistency

**Feature Branch**: `codex/sidebar-workspace-ux-audit` (documentation PR). Implementation branches are independent of feature numbering.

**Created**: 2026-09-05

**Status**: Draft — prepared against main at `8f41aae` (PR #29); Mission findings reconciled; remaining section audits and owner design review pending.

**Input**: User requested an audit of New mission, its related pages, the Mission sidebar and items; extended the same audit standard to every sidebar section; then requested migration into spec-driven development.

## Scope and relationship to existing work

This feature establishes a consistent, evidence-led audit and improvement program for the current ThreadHelm sidebar and its destination workspaces. It contains a common UX contract and independently reviewable section audits. An audit recommendation is a proposal until its disposition and interaction design are recorded.

In scope: shared sidebar/navigation, Missions including New mission and drafts, Sessions, Agents (including starter/template flows), Memory, Attention, Settings, their dialogs and prerequisite/return flows, and cross-section consistency. Each audit covers reachable items and secondary pages, not only the destination landing page.

Out of scope: new agent providers, new delegation capabilities, new external integrations, changes to authority or process-control policy, automatic external provider execution, merge/deployment, wholesale visual rebranding, and removal of existing release gates.

Feature 002 owns existing coordination and release boundaries. Feature 003 owns future verified delegation, contracts, progress accountability, and receipts. This feature owns how existing capabilities are presented and navigated. A finding requiring a new capability is referred to its owning feature rather than silently extending this scope. Neither existing feature is marked complete by this specification.

The repository's roadmap explicitly preserves `.specify/feature.json` on Feature 002 until a separate transition. This specification follows the existing Feature 003 draft convention and preserves that selector. Downstream work must explicitly target `specs/004-sidebar-workspace-ux` and verify the target before writing. Use read-only resolution for inspection; later planning must use an isolated checkout because the normal feature-directory override persists the selector. See the audit register for the verified command. This documents the sequencing impact without changing the existing implementation sequence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review comparable evidence for every sidebar section (Priority: P1)

As the owner, I can review each section using the same audit standard and see which problems are reproduced, inferred from current source, proposed, accepted, deferred, or verified fixed.

**Why this priority**: Unexamined sections must not inherit presumed defects or approval from the Mission audit.

**Independent Test**: Review the audit register and any completed section report; follow every finding to evidence, a user impact, and a proposed improvement.

**Acceptance Scenarios**:

1. **Given** a section has not been examined, **When** its register entry is opened, **Then** it says pending and contains no claimed passing or failing runtime results.
2. **Given** a completed audit, **When** the owner reviews it, **Then** it identifies baseline revision, reachable flows, relevant states, reproduction or source evidence, priority, proposed change, and verification limitations.
3. **Given** overlapping findings across sections, **When** the consolidated review is prepared, **Then** they reference one shared requirement and conflicting proposals are resolved before implementation planning.
4. **Given** a proposed improvement, **When** it is accepted or deferred, **Then** the decision records its scope and reason; migrating it into this feature alone does not constitute acceptance.

### User Story 2 - Navigate to the intended item without losing work (Priority: P1)

As a user, I can open any destination, mission, draft, or related item and trust that the highlighted selection matches the visible content and that my edits are preserved.

**Why this priority**: Failed navigation and silent loss undermine every other workflow.

**Independent Test**: From every sidebar destination, open New mission and a saved draft; switch between an edited draft and a mission under successful and failed save conditions.

**Acceptance Scenarios**:

1. **Given** any sidebar destination, **When** I choose New mission or Resume draft, **Then** the requested screen opens directly without another navigation action.
2. **Given** an open draft, **When** I select a mission, **Then** saved edits are preserved and the mission, selection, and context agree.
3. **Given** saving fails during navigation, **When** I try to leave, **Then** the edits remain recoverable and I can retry, remain, or explicitly leave without the latest edits; a notice alone cannot silently discard them.
4. **Given** a prerequisite must be fixed elsewhere, **When** I complete that fix and return, **Then** the original item, stage, and entered values are restored.
5. **Given** a new selection is loading, **When** previous content remains visible, **Then** it is clearly identified as previous content until the requested item is ready.

### User Story 3 - Understand and control the exact target of an action (Priority: P1)

As a user, I can tell which session, folder, agent, or mission a control affects and whether the selected change is possible.

**Why this priority**: Misleading editable controls cause invalid choices and uncertainty about permissions and process actions.

**Independent Test**: Compare an existing session with a proposed new session, and configure two crew members sharing one folder.

**Acceptance Scenarios**:

1. **Given** an existing session whose launch configuration is fixed, **When** I inspect its mission settings, **Then** fixed values are read-only and changing them requires an explicit supported alternative.
2. **Given** two crew members share folder access, **When** I change its access mode, **Then** all affected members, including any supervisor, are identified before the change is applied.
3. **Given** a start, stop, interrupt, permission, or destructive action, **When** I activate it, **Then** its target, confirmation requirements, pending state, and result are explicit.
4. **Given** a mission is uncertain, blocked, or awaiting a decision, **When** I view its sidebar item and workspace, **Then** both preserve that distinction and offer only supported next actions.

### User Story 4 - Recognize and resume work from a consistent sidebar (Priority: P2)

As a user, I can distinguish similarly named items, locate drafts and active work, and understand badges without opening every item.

**Why this priority**: Identity and status reduce navigation effort as the workspace grows.

**Independent Test**: Use an inventory with 50 missions, 20 drafts, duplicate title prefixes, long names, and a mix of lifecycle and attention states.

**Acceptance Scenarios**:

1. **Given** several drafts at the same stage, **When** I browse them, **Then** each has a meaningful identity and saved-state information, with additional context available to disambiguate similar names.
2. **Given** an item is selected, **When** I inspect the sidebar, **Then** selection is visible and announced, and keyboard navigation brings the active item into view.
3. **Given** a long inventory, **When** I navigate between sections, **Then** destinations remain discoverable and the current item can be located without inspecting every item.
4. **Given** the same badge or status appears in different sections, **When** I compare them, **Then** its meaning and counting rule remain consistent or explicitly distinguish their different meanings.

### User Story 5 - Complete related workflows with consistent page and action patterns (Priority: P2)

As a user, I can move among destination pages, creation flows, details, and prerequisite fixes without relearning layout and action conventions.

**Why this priority**: Predictability makes complex setup understandable without hiding essential authority information.

**Independent Test**: Walk through each audited primary flow and compare headings, content spacing, context, primary actions, save/close, validation, and success landing.

**Acceptance Scenarios**:

1. **Given** New mission entry and the four composer stages, **When** I move between them, **Then** they use a consistent content frame and context describes the current flow.
2. **Given** a normally saved draft, **When** I choose the close action, **Then** I return in one action with visible save feedback; failure handling remains explicit.
3. **Given** final mission review, **When** I inspect the required approval facts, **Then** the final action is discoverable in a consistent action area and cannot bypass approval.
4. **Given** a mission starts successfully, **When** confirmation completes, **Then** its operational overview communicates success and the next action, with technical details available on demand.
5. **Given** idea-generation inputs change, **When** prior suggestions exist, **Then** they are invalidated or explicitly associated with their original inputs, and the user knows what information generation sends and to whom.
6. **Given** provider/model settings or numeric limits appear in multiple flows, **When** I compare them, **Then** supported choices use consistent labels and units; differing supported limits are explained.

### User Story 6 - Use every section with a keyboard and recover from incomplete states (Priority: P2)

As a user, I can complete primary workflows with the keyboard, identify validation failures, and recover from unavailable data or prerequisites.

**Why this priority**: Keyboard accessibility and actionable failures are required parts of the desktop experience.

**Independent Test**: Repeat each section's primary journey without a mouse at supported desktop sizes and increased text scale, including one applicable error or empty state.

**Acceptance Scenarios**:

1. **Given** a destination change or dialog, **When** it opens and closes, **Then** focus moves to meaningful content and returns appropriately without traps or hidden focus.
2. **Given** an incomplete form, **When** I request to continue or fix the missing field, **Then** the relevant field is identified and reachable; blocked controls explain the reason.
3. **Given** a loading failure or missing prerequisite, **When** the message appears, **Then** an applicable retry or direct fix action is available and retains context.
4. **Given** a long page at increased text scale, **When** I reach an action, **Then** the layout does not obscure focused controls or essential approval facts.

### Edge Cases

- A selected ended session forces its group visible; a hide action must communicate any resulting selection constraint.
- Recovery-required sessions grouped as ended still need a discoverable recovery path.
- Rapid navigation while autosave or item loading is pending; save failure, degraded storage, and stale draft revisions.
- Multiple same-stage drafts, identical title prefixes, long unbroken names/paths, and content-deleted mission records.
- Empty inventories, unavailable providers, revoked folders, failed/stopped sessions, and stale idea-generation results.
- Shared worker/supervisor folders; several sessions of the same provider in one folder; configuration fixed by a prior launch.
- Unknown work outcomes, unresolved decisions, cancelled work, and recovery after restart; no automatic replay or restart.
- Sidebar collapse or narrow-window layout, 200% text scaling, modal dismissal, keyboard-only selection, and large inventories.
- Navigation away from a running terminal changes the view, not process lifecycle or authority.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every in-scope audit MUST inventory its destination, related items/pages/dialogs, entry/exit paths, and relevant normal, empty, loading, error, and recovery states; non-applicable states require a reason.
- **FR-002**: Each finding MUST have a stable ID, priority, evidence type, baseline, user impact, proposed improvement, requirement mapping, disposition, and verification state. Source inspection MUST NOT be reported as runtime reproduction.
- **FR-003**: Cross-section findings MUST be reconciled into shared conventions before affected implementation is planned. Every recommendation MUST remain proposed until a decision is recorded.
- **FR-004**: Every global destination and item action MUST directly open its intended view, synchronizing selection, content identity, and contextual information. Applies to US2 and US4.
- **FR-005**: Navigation MUST preserve pending edits or obtain an explicit informed decision to leave without them. Prerequisite excursions MUST retain the originating item, stage, and values. Applies to US2.
- **FR-006**: Editable controls MUST represent supported changes for their exact target. Fixed existing-session values and shared-access scope MUST be explicit. Applies to US3.
- **FR-007**: Lifecycle, uncertainty, attention, and completion meanings MUST remain consistent across sidebar, workspace, details, and action labels. Applies to US3 and US4.
- **FR-008**: Sidebar items MUST expose meaningful identity, selected state, and appropriate status; drafts MUST expose save state and a discoverable supported management path. Applies to US4.
- **FR-009**: Related workflows MUST share consistent content framing, heading hierarchy, action placement, save/close feedback, and context ownership. Essential review facts MUST remain visible before consequential confirmation. Applies to US5.
- **FR-010**: Generation and launch choices MUST accurately disclose their effect, data destination where applicable, selected provider/default semantics, and validity after input changes. Applies to US3 and US5.
- **FR-011**: Form failures and unavailable prerequisites MUST provide an actionable, keyboard-reachable path to correction. Loading and operation results MUST be communicated without confusing stale content with the selected item. Applies to US2 and US6.
- **FR-012**: Primary workflows MUST support keyboard operation, visible focus, meaningful names and landmarks, dialog focus handling, and 200% text scaling without inaccessible essential controls. Applicable contrast and interaction behavior MUST meet the constitution's accessibility requirements. Applies to US6.
- **FR-013**: Changes MUST preserve approved folder boundaries, exact launch confirmation, process-control target identity, content privacy, local persistence/recovery semantics, and explicit external-action approval. A presentation change MUST NOT grant capability or broaden authority. Applies to US2, US3, and US5.
- **FR-014**: The audit and implementation evidence MUST separate fixtures, current-source inspection, live local verification, owner approval, and release readiness. Existing unmet release/capability gates MUST remain unmet until their owning feature supplies evidence. Applies to US1.
- **FR-015**: The interface MUST avoid continuous decorative motion or idle rendering work. Planning MUST define and measure rendering/responsiveness budgets on representative Windows hardware without claiming old performance deferrals resolved. Applies to US4 and US6.

### Key Entities

- **Audit section**: A destination or shared surface, its inventory, baseline, coverage, findings, and completion limitations.
- **Finding**: Evidence-backed inconsistency with stable identity, impact, priority, proposed outcome, requirement links, decision, and verification record.
- **UX convention**: A shared meaning or interaction rule covering navigation, identity, status, forms, actions, feedback, or accessibility.
- **Design decision**: An accepted, amended, rejected, or deferred proposal with rationale and affected flows.
- **Evidence record**: A dated observation identifying revision, environment, scenario, expected/observed outcome, method, artifacts, and limitations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 9 audit passes in the register have documented flow inventories and evidence classifications before the consolidated design is submitted for approval.
- **SC-002**: 100% of findings have requirement links and explicit dispositions; every accepted finding maps to a planned verification scenario before implementation starts for that slice.
- **SC-003**: New mission and Resume draft open directly from all 6 sidebar destinations; every tested mission/draft switch preserves edits or requires an explicit leave-without-saving decision.
- **SC-004**: All audited controls for fixed live-session configuration or shared folder access accurately communicate their scope; there are zero accepted scenarios where an editable choice is known to be impossible for the selected target.
- **SC-005**: All 6 destination primary journeys and the nested Agents starter/template journey and the mission creation journey are completable with a keyboard at 100% and 200% text scale on Windows 11 x64; no essential focused control is obscured.
- **SC-006**: The sidebar remains usable with 50 missions and 20 drafts, including duplicate prefixes and long names; the current item and global destinations remain discoverable.
- **SC-007**: Every accepted high-priority finding has passing targeted verification and every remaining limitation has an owner-visible disposition before feature completion; no release readiness is inferred from this alone.
- **SC-008**: Each completed improvement slice includes before/after evidence for its primary journey, one applicable failure/recovery path, and its cross-section navigation impact.

## Assumptions

- The requested migration authorizes specification and audit organization, not blanket approval of the previously proposed UI changes.
- The existing four mission stages and explicit final approval are retained unless a later recorded design decision changes their presentation while preserving authority rules.
- The original Mission evidence at `c037c7c` is retained as history. The [main-merge reconciliation](audits/main-merge-reconciliation.md) refreshes the findings against `8f41aae` (PR #29), including six-destination runtime probes. None of MIS-001–014 is fully resolved by that merge; common styling is improved. Other sections remain pending full audit. Recheck the baseline again before implementation.
- Audits use isolated local data and fixtures where appropriate. A provider-backed operation or live-data mutation is not implied by audit scope.
- No new external provider, paid model run, public posting, deployment, or parallel agent work is authorized by this specification.
- Model/effort assignments and implementation mechanics belong in a later plan, not requirements.
- The existing constitution, Feature 002 retained gates, and Feature 003 capability ownership remain dependencies; roadmap or selector changes require their own recorded transition.
