# Mission Focus workspace design

**Status:** Approved interaction direction and mission-creation flow; production implementation in progress

**Selected prototype:** D — Mission Course

**Decision date:** 2026-08-31

## Purpose

ThreadHelm should open as a mission workspace. The selected mission is the primary context for
decisions, verified results, agents, sessions, and terminals. Several missions may continue in the
background, but the interface presents one selected mission in detail at a time.

This direction combines the stable mission queue and context rail from the Mission Ledger prototype
with the progress-oriented execution timeline from the Flight Deck prototype. The resulting layout
is called **Mission Course**.

The redesign changes renderer information architecture. It does not move coordination authority out
of Electron main, add a renderer database writer, change delivery semantics, or broaden provider
permissions.

## Interaction principles

1. **One mission owns the screen.** Every visible action and status belongs to the selected mission.
2. **Progress is evidence-based.** Completed steps identify verified results. Running, waiting,
   blocked, uncertain, deferred, and complete remain distinct states.
3. **Attention is bounded.** The workspace elevates pending decisions and recovery needs without
   turning every status into an alert.
4. **Terminals support the mission.** A terminal opens on demand as a dock and does not occupy the
   primary workspace by default.
5. **Authority stays visible.** Local coordinator ownership, external approval requirements, and
   uncertain delivery outcomes remain explicit.
6. **Details disclose progressively.** The default view answers what is happening, what needs a
   decision, and what comes next. History and lower-level operational details remain reachable.

## Owner visual approval gate

Architecture approval does not authorize the creation of every production page. Before production
code is written for a new page or a materially different page state:

1. Build two or three structurally distinct, disposable browser variants using representative local
   data. A fourth hybrid may be added when the owner selects elements from multiple variants.
2. Present the variants in the browser with a visible prototype marker and keyboard-switchable
   comparison control.
3. Explain the information hierarchy and tradeoffs. Do not treat a preferred color or isolated
   component as approval of the full page.
4. Record the owner's selected variant and requested combination.
5. Only then write the production component and its tests. Prototype code must not be promoted
   directly into production.

The owner approved **D — Mission Course** for the primary Mission Focus workspace. This approval
covers its three-region shell, mission queue, Mission Course timeline, mission context rail, verified
result summary, active-session summary, and on-demand terminal position. It does not approve the
detailed designs for mission creation, mission recovery and uncertainty, Sessions, Agents,
Templates, Memory, Settings, or destructive confirmation surfaces. Each requires its own browser
variants before production redesign work begins.

When a worker is selected from a saved profile or imported from local JSON, the review surface must
show the profile's goal and abilities before the worker is added. Abilities are inert matching labels;
the UI must state that they do not grant tools, permissions, folder access, or authority.

The worker-add flow must also offer in-app profile creation for users who do not want to author JSON.
That form collects name, description, goal, abilities, provider, and requested model, then shows an
exact local-profile review before saving and adding the worker. Profile goal and description remain
separate from the selected mission's objective and worker assignment.

## Information architecture

The desktop workspace has three persistent regions and one optional region.

### Mission rail

The left rail contains:

- ThreadHelm identity and a `New mission` action.
- A compact mission queue with selected, running, waiting, blocked, deferred, and complete states.
- Primary destinations: Missions, Sessions, Agents, Templates, Memory, and Settings.
- A visible selected state that does not rely on color alone.

Selecting another mission changes the mission header, course, verified result, attention context,
crew, and attached sessions together. The application must never leave stale controls from the
previous mission visible during the transition.

### Mission workspace

The center region contains:

1. Mission identity: name, objective, lifecycle state, and the primary next action.
2. A narrow status strip for local execution, pending decisions, and attached sessions.
3. The Mission Course: a horizontal sequence of verified, current, and queued outcomes.
4. The latest verified result and its evidence link.
5. The active session summary and a control to open its terminal.

The Mission Course is a concise outcome sequence rather than a low-level activity log. Each node
uses a state label, title, and one-sentence result or next step. The current node may expose one
primary action. Full history opens separately.

### Mission context

The right rail contains:

- The highest-priority decision or recovery need.
- Crew ownership and work state.
- Local and external authority boundaries.
- Later additions such as handoff receipt or verification state when those contracts exist.

The rail can collapse at narrower widths. Collapsing it must leave an explicit indicator when a
decision or recovery item is waiting.

### Terminal dock

The terminal is closed by default. Opening it creates a dock attached to the selected mission and
session. The dock must identify both before accepting input. It supports multiple session tabs when
needed, preserves the existing bounded terminal stream, and can be collapsed without stopping the
session.

Changing missions while the terminal is open must either switch to an attached session for the new
mission or retain the previous terminal with a conspicuous mission label. The implementation plan
must choose one behavior and test against wrong-mission input.

## Primary states

### No active mission

Show a restrained starting surface with `Create mission`, recent missions, and work requiring
recovery. Do not render an empty timeline or placeholder metrics.

### Active mission

Show the mission objective, current outcome, latest verified result, crew, and next action. Other
missions remain visible only in the queue.

### Waiting for owner

Move the decision into the first position in the context rail, mark the current course node as
waiting, and use the same action label in both places.

### Blocked or uncertain

Name the blocking condition or uncertain operation. Do not convert an unknown delivery outcome into
a retry action. Recovery controls must continue using the existing coordinator contracts.

### Complete

Replace the primary action with the verified result and evidence. Keep terminals and history
available without presenting additional execution as part of the completed mission.

## Visual system

The selected prototype uses a calm, instrument-like Windows workspace rather than an office theme.

- **Ink `#18242c`:** primary text, key actions, and the ThreadHelm mark.
- **Fog `#edf1f3`:** application shell and secondary surfaces.
- **Paper `#f8fafb`:** focused mission workspace.
- **Copper `#ad5b3d`:** current position and owner attention.
- **Verdigris `#2f7168`:** verified and locally healthy states.
- **Steel blue `#3f647a`:** evidence and operational links.

Bahnschrift carries mission titles and hierarchy, Segoe UI Variable carries interface text, and
Cascadia Code carries state, authority, and evidence labels. All are Windows-appropriate local font
choices with system fallbacks.

The memorable element is the Mission Course itself: an outcome line that connects verified work to
the current decision and the next bounded step. Motion should be limited to a single state transition
when the selected mission changes and must respect reduced-motion settings.

## Responsive behavior

- At full desktop width, show all three regions.
- At medium width, collapse the context rail behind an attention control while preserving the
  mission rail and workspace.
- At narrow width, replace the mission rail with a mission picker and stack Mission Course nodes
  vertically.
- The terminal dock may grow vertically but must not obscure the selected mission identity.

The installed Windows application remains the primary target. Mobile behavior protects layout
integrity for narrow windows; it does not establish a mobile product requirement.

## Accessibility and keyboard behavior

- Mission selection, course actions, context controls, and terminal tabs must be keyboard reachable.
- Focus stays within the selected mission after a mission switch and moves to the new mission heading.
- State uses text and shape in addition to color.
- The tab order follows mission rail, mission workspace, context rail, then terminal dock.
- Focus indicators remain visible against every surface.
- Status changes use restrained live-region announcements; terminal output does not enter that live
  region.
- Reduced-motion settings disable nonessential transitions.

## Content and release boundaries

- Bundled production content uses generic agent starters only.
- Private Marvel personas remain outside packaged artifacts and may appear only as optional local
  imports owned by the user.
- The current `threadhelm/agent-profile@1` vocabulary is used for new sample content.
- Other product names do not appear in bundled examples or interface copy.
- UI language describes user-recognizable missions, agents, sessions, decisions, and evidence rather
  than internal coordinator or database mechanics.

## Technical boundaries

- Electron main remains the sole coordinator and SQLite writer.
- The renderer consumes validated preload contracts and does not infer durable state from transient
  UI state.
- Durable unknown delivery outcomes are never automatically resent.
- Existing session-host containment, terminal backpressure, and escalation-reason requirements remain
  unchanged.
- The redesign should first reorganize existing mission and session contracts. New contracts require
  a separately specified behavior and testable authority boundary.

## Implementation sequence for planning

1. Extract a renderer-only application shell and mission selection context using existing data.
2. Build the mission rail and atomic mission-switch transition.
3. Build Mission Course from existing mission state and verified results.
4. Add the context rail using current decision, crew, and authority data.
5. Move existing terminal surfaces into the mission-aware dock without changing stream semantics.
6. Add responsive and keyboard behavior.
7. Verify empty, active, waiting, blocked or uncertain, and complete mission states in the installed
   Windows application.

This sequence is a design input, not an implementation plan. The plan must inspect current renderer
contracts and assign acceptance evidence before code changes begin.

## Prototype disposition

The temporary browser prototype lives beside the renderer under
`apps/desktop/src/renderer/prototypes/mission-focus`. It contains four switchable variants and no
production API calls. Keep it only through design review. After this document is accepted, remove the
losing variants and either delete the prototype before implementation or retain a single static
reference outside the production build until the real renderer reaches visual parity.
