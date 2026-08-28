<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.0.1
- Modified principles: none
- Renamed project: AI Orchestrator -> ThreadHelm
- Added sections: none
- Removed sections: none
- Follow-up TODOs: none
-->
# ThreadHelm Constitution

## Core Principles

### I. Windows-First, Local-First
The application MUST treat supported Windows desktop environments as its primary product target.
Core orchestration, agent execution, configuration, and recovery workflows MUST work locally on
Windows without requiring a hosted control plane. Platform-specific behavior, including process
management, paths, shells, permissions, installers, and updates, MUST be verified on Windows.
Cross-platform support MAY be added later, but it MUST NOT weaken or delay the Windows experience.

Rationale: the product exists first as a dependable Windows application, not as a nominally
cross-platform application whose primary workflows are only proven elsewhere.

### II. Orchestration Capability Over Visual Theater
The product MUST prioritize useful multi-agent work: launching real agent processes, assigning and
routing work, communicating between agents, exposing status, preserving context, and recovering
from failure. Visual presentation MUST communicate operational state and user choices; it MUST NOT
simulate productivity through decorative activity. A feature that does not improve control,
comprehension, reliability, or completed work MUST justify its inclusion before implementation.

Rationale: the project draws inspiration from Munder Difflin's local multi-agent harness, while its
value comes from orchestration rather than an animated office metaphor.

### III. Restrained, Adaptable Interface
The interface MUST use conventional, low-overhead desktop patterns such as panels, lists, tables,
tabs, timelines, badges, and terminals. The core experience MUST NOT depend on characters, avatars,
pixel-art effects, animated scenery, game-like maps, or continuous decorative motion. Animation,
when used, MUST be brief, purposeful, respect reduced-motion settings, and explain a state change or
direct manipulation. UI experiments MUST remain replaceable and MUST NOT leak presentation choices
into orchestration-domain contracts.

Rationale: the interaction model is intentionally open for exploration, but the product must remain
calm, legible, performant, and inexpensive to render.

### IV. Explicit and Safe Local Control
Every operation that starts, stops, interrupts, or sends input to an agent process MUST expose its
target and resulting state. Destructive, privileged, or externally consequential operations MUST
require proportionate confirmation and MUST fail closed when the target or authority is ambiguous.
Filesystem and command access MUST be scoped to user-approved workspaces, and secrets MUST NOT be
written to logs, transcripts, prompts, or project files. The renderer or equivalent presentation
layer MUST NOT receive unrestricted operating-system access.

Rationale: an orchestrator controls powerful local tools, so clear authority boundaries and
recoverable behavior are product requirements rather than implementation details.

### V. Observable, Testable, Recoverable Work
Agent state, assignments, messages, tool activity, failures, and user interventions MUST have a
human-readable history sufficient to explain what happened. Persistent records MUST distinguish
requested, running, waiting, failed, cancelled, and completed work. Core state transitions and
process boundaries MUST be covered by automated tests; Windows-specific process and path behavior
MUST have integration coverage. Restarting the application MUST preserve durable work or present an
explicit, actionable recovery state.

Rationale: users cannot safely delegate work they cannot inspect, understand, or recover.

## Product and Platform Constraints

- The initial product is a Windows desktop application for orchestrating local terminal-based AI
  agents. The exact UI framework and agent-provider set remain feature-level decisions.
- Inspiration from Munder Difflin is limited to its functional model: real local agent processes,
  coordination, messaging, memory, terminal access, and centralized user control.
- Office simulations, character representations, pixel art, animated environments, and equivalent
  graphics-heavy metaphors are outside the default product scope. Adding any such mode requires a
  constitution amendment rather than an ordinary feature decision.
- Idle UI MUST avoid continuous rendering. Performance-sensitive views MUST define measurable
  budgets during feature planning and verify them on representative Windows hardware.
- Primary workflows MUST be keyboard accessible, expose visible focus, support text scaling, and
  meet WCAG 2.2 AA contrast and interaction requirements where applicable to desktop software.
- Provider integrations MUST be isolated behind explicit contracts so one agent CLI can fail or be
  unavailable without corrupting the rest of the orchestration state.

## Development Workflow and Quality Gates

- Each feature specification MUST state the user outcome, Windows acceptance criteria, process and
  filesystem authority, failure behavior, persistence impact, accessibility impact, and rendering
  cost where relevant.
- Plans MUST separate orchestration-domain logic from the presentation layer. UI experiments MAY
  change layout and interaction patterns without rewriting process, routing, or persistence rules.
- Tests MUST cover domain state transitions before release. Features that spawn processes, cross an
  IPC boundary, persist agent state, or manipulate workspaces MUST include integration tests.
- Changes are not complete until formatting, static analysis, automated tests, and a representative
  Windows workflow pass. Manual verification MUST identify the Windows version and tested workflow.
- Reviews MUST reject decorative complexity that adds idle rendering, obscures operational state,
  or couples core behavior to a particular visual metaphor without an approved constitutional
  amendment.
- Security-sensitive changes MUST document trust boundaries, permissions, secret handling, and a
  recovery or rollback path before implementation approval.

## Governance

This constitution is the highest-authority project governance document. Feature specifications,
plans, tasks, code, and reviews MUST comply with it. Where another project document conflicts with
this constitution, this constitution governs.

Amendments MUST be proposed as an explicit constitution change, include the reason and migration
impact, and receive project-owner approval. Affected specifications and implementation plans MUST
be reviewed after an amendment; they are updated through their own workflows, not implicitly by
the constitution change.

Versions follow semantic versioning for governance: MAJOR for removing or incompatibly redefining a
principle, MINOR for adding a principle or materially expanding obligations, and PATCH for
clarifications that do not change obligations. Every feature review and release review MUST include
a constitution-compliance check. Any exception MUST be written, narrowly scoped, time-bounded, and
approved by the project owner before merge.

**Version**: 1.0.1 | **Ratified**: 2026-08-28 | **Last Amended**: 2026-08-28
