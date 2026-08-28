# Feature Specification: ThreadHelm Local Agent Workspace MVP

**Feature Branch**: `main`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "A Windows user can select an approved workspace, launch and supervise
multiple local terminal-based AI agents, view their real status/output, interrupt or stop them
safely, and recover understandable state after restarting ThreadHelm. Exclude agent-to-agent
routing, long-term memory, scheduling, remote control, and elaborate UI customization from this
first feature."

## Clarifications

### Session 2026-08-28

- Q: Which terminal-based AI agent tools must ThreadHelm support in the MVP? → A: Codex CLI and
  Claude Code.
- Q: What must ThreadHelm do when Codex CLI or Claude Code cannot be technically confined to the
  selected workspace? → A: Require explicit confirmation for every session.
- Q: May two write-capable agent sessions run concurrently in the same approved workspace? → A:
  No; block the second write-capable session.
- Q: What must ThreadHelm do when the user closes the application while agent sessions are still
  running? → A: Block closing until the user cancels or stops all sessions and exits.
- Q: Which Windows versions must ThreadHelm officially support for the MVP? → A: Current supported
  Windows 11 client releases only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Approve a Workspace and Launch an Agent (Priority: P1)

A Windows user selects a local project folder, reviews the scope being granted, chooses an available
terminal-based AI agent, and launches an interactive session in that workspace.

**Why this priority**: ThreadHelm provides no value until a user can safely start a real agent in an
intended workspace with clear authority.

**Independent Test**: Select an accessible Windows folder, approve it, launch one available agent,
and verify that the session opens in the selected workspace without granting another folder.

**Acceptance Scenarios**:

1. **Given** an accessible folder and an available agent, **When** the user reviews and approves the
   launch, **Then** ThreadHelm starts a session identified by agent and workspace and shows its
   initial state.
2. **Given** a folder that has not been approved, **When** the user attempts to launch an agent,
   **Then** ThreadHelm prevents launch and asks the user to review the workspace scope.
3. **Given** an unavailable or unauthenticated agent command, **When** the user reviews available
   agents, **Then** ThreadHelm identifies the problem and does not represent that agent as ready.
4. **Given** a path containing spaces or non-ASCII characters, **When** the user approves and
   launches the workspace, **Then** the session uses the intended folder without path truncation or
   substitution.
5. **Given** an approved workspace or available agent whose effective path, executable, version, or
   authentication state changes before launch, **When** the user starts a session, **Then**
   ThreadHelm rechecks the launch target, blocks stale approval or readiness assumptions, and asks
   the user to review the changed information.
6. **Given** a packaged ThreadHelm release installed on a supported Windows computer without project
   development tools, **When** the user opens the application and launches an available agent,
   **Then** the primary workspace and launch workflow operates with the displayed application
   version and the same safety controls as the development environment.

---

### User Story 2 - Supervise Multiple Live Agents (Priority: P2)

A user launches multiple independent sessions, sees each session's identity and current state, moves
between their live terminal output, and sends input to the selected session without confusing one
agent for another.

**Why this priority**: Multi-agent visibility and control distinguish ThreadHelm from using separate
uncoordinated terminal windows.

**Independent Test**: Launch at least two sessions in approved workspaces, send distinct input to
each, and verify that status, input, and output remain associated with the correct session.

**Acceptance Scenarios**:

1. **Given** one running session, **When** the user launches another session, **Then** both remain
   independently identifiable and usable.
2. **Given** multiple active sessions, **When** output arrives from any agent, **Then** ThreadHelm
   attributes the output to the correct session and indicates which sessions have new activity.
3. **Given** multiple active sessions, **When** the user sends input to one selected session,
   **Then** only that session receives the input.
4. **Given** one agent exits or fails, **When** other sessions are active, **Then** the failed session
   shows an actionable state without stopping or corrupting the others.
5. **Given** an active write-capable session, **When** the user attempts to launch another
   write-capable session in the same effective workspace, **Then** ThreadHelm blocks the launch and
   directs the user to select a separate folder or worktree.
6. **Given** an agent whose exact activity cannot be established from trustworthy evidence, **When**
   ThreadHelm displays its state, **Then** the application reports that activity is unknown without
   claiming the agent is idle, working, awaiting input, or complete.
7. **Given** concurrent terminal input, resizing, and a large output burst, **When** the user switches
   among sessions, **Then** input remains ordered and isolated, each terminal remains correctly
   sized, recent output remains usable, and any discarded output is clearly disclosed.
8. **Given** agent output containing terminal control sequences, links, or requests that could affect
   the clipboard, filesystem, another application, or the operating system, **When** ThreadHelm
   renders that output, **Then** it remains confined to the terminal unless the user explicitly
   authorizes a separate action.

---

### User Story 3 - Interrupt or Stop Work Safely (Priority: P3)

A user interrupts current work or stops an agent session while seeing the exact target, requested
action, and resulting state. ThreadHelm escalates safely when an agent does not respond.

**Why this priority**: Users must retain control over local processes before they can trust the
application with meaningful work.

**Independent Test**: Start two distinguishable sessions, interrupt one, stop the other, and verify
that each action affects only its displayed target and produces an understandable final state.

**Acceptance Scenarios**:

1. **Given** a running agent, **When** the user requests an interrupt, **Then** ThreadHelm identifies
   the target, sends the least-destructive supported interruption, and reports whether the agent
   returned to an interactive state, exited, or did not respond.
2. **Given** a running agent, **When** the user requests to stop the session, **Then** ThreadHelm
   confirms the target before ending active work and records the resulting state.
3. **Given** an agent that does not respond to a stop request, **When** the safe wait period expires,
   **Then** ThreadHelm offers an explicit force-stop action and explains the risk before proceeding.
4. **Given** multiple running sessions, **When** the user interrupts or stops one session, **Then**
   all non-targeted sessions continue unchanged.
5. **Given** one or more active sessions, **When** the user attempts to close ThreadHelm, **Then**
   ThreadHelm lists the active sessions and requires the user to cancel closing or stop all sessions
   before exiting.
6. **Given** an agent that created descendant or helper processes, **When** its session is stopped or
   force-stopped, **Then** ThreadHelm applies the selected stop level to the complete supervised
   process scope and reports any process that remains alive.
7. **Given** ThreadHelm's supervising process ends unexpectedly, **When** the operating system closes
   its supervision scope, **Then** no process started within an active agent session continues
   silently without ThreadHelm control.

---

### User Story 4 - Understand State After Restart (Priority: P4)

After ThreadHelm closes unexpectedly or is restarted, the user can see which sessions existed, their
last known state, their associated workspace and agent, and whether each session ended cleanly or
requires attention.

**Why this priority**: Recovery prevents a restart from turning delegated work into an unexplained
or unsafe condition.

**Independent Test**: Run multiple sessions, close ThreadHelm during activity, restart it, and verify
that every prior session has an honest recovery record without automatic relaunch.

**Acceptance Scenarios**:

1. **Given** sessions that ended cleanly before exit, **When** ThreadHelm restarts, **Then** their
   final states and identifying details remain visible.
2. **Given** a session active when ThreadHelm ended unexpectedly, **When** ThreadHelm restarts,
   **Then** the session is marked as interrupted or requiring reconciliation rather than completed.
3. **Given** a recoverable prior record, **When** the user reviews it, **Then** ThreadHelm provides
   an explicit next action such as dismissing the record or starting a new session.
4. **Given** a restart, **When** recovery information loads, **Then** ThreadHelm does not
   automatically restart an agent or replay prior input.
5. **Given** active sessions when Windows locks, suspends, resumes, or unlocks, **When** ThreadHelm
   regains execution, **Then** it rechecks each session, presents its observed state or a recovery
   requirement, and does not automatically restart an agent or replay input.
6. **Given** a controlling ThreadHelm instance is already running, **When** the user starts
   ThreadHelm again, **Then** the second launch does not create another session controller and
   directs the user to the existing instance.

### Edge Cases

- The selected folder does not exist, becomes unavailable, or loses permissions before launch.
- The selected path contains spaces, non-ASCII characters, a long Windows path, or a junction or
  symbolic link whose effective boundary is ambiguous.
- An agent executable is missing, is not authenticated, changes location, or exits immediately.
- A second workspace path resolves to the same effective folder as an active write-capable session.
- An agent emits a very large burst, unsupported control sequences, malformed text, or binary data.
- Agent output contains a credential or another secret-like value.
- An agent ignores an interrupt, spawns child processes, or remains alive after ThreadHelm exits.
- A descendant process detaches from its parent, changes identity, or refuses the selected stop
  level.
- ThreadHelm ends unexpectedly while an agent is starting, interrupting, stopping, or producing
  output.
- Windows locks, suspends, resumes, or unlocks while one or more sessions are starting, awaiting
  attention, or stopping.
- A second ThreadHelm launch occurs while the first instance is active or recovering sessions.
- The terminal is resized while output is arriving, receives output faster than it can display, or
  receives control sequences that request clipboard, hyperlink, file, or operating-system actions.
- The approved workspace, resolved agent executable, agent version, or authentication state changes
  between readiness display and process creation.
- The packaged application observes a different executable search path or permission boundary than
  the development environment.
- Recovery state cannot be saved or loaded because storage is unavailable or corrupted.
- A workspace approval is revoked while sessions associated with that workspace still exist.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: ThreadHelm MUST allow a user to select an existing local folder and display its
  effective Windows path before approval.
- **FR-002**: ThreadHelm MUST require explicit workspace approval before launching an agent in that
  workspace.
- **FR-003**: Workspace approval MUST be scoped to the selected workspace and MUST be revocable when
  no associated session is active.
- **FR-004**: Before launch, ThreadHelm MUST show the selected agent, workspace, intended action, and
  the effective access boundary. If ThreadHelm cannot enforce the external agent's filesystem
  boundary, it MUST disclose that limitation and require explicit confirmation for every new
  session; an earlier confirmation MUST NOT authorize a later session.
- **FR-005**: ThreadHelm MUST support Codex CLI and Claude Code as independent MVP agent tools,
  distinguish each tool's available, missing, unavailable, or unauthenticated state, and provide an
  actionable explanation when launch cannot proceed.
- **FR-006**: ThreadHelm MUST launch a selected available agent as a real interactive local process
  associated with the approved workspace.
- **FR-007**: ThreadHelm MUST assign every session a stable identity and display its agent,
  workspace, start time, and current lifecycle state.
- **FR-008**: ThreadHelm MUST support at least four concurrent independent sessions on a
  representative supported Windows computer.
- **FR-009**: ThreadHelm MUST route user input only to the currently selected session and MUST make
  the selected target visually and programmatically clear.
- **FR-010**: ThreadHelm MUST display live terminal output for each session and preserve attribution
  when output arrives from multiple agents concurrently.
- **FR-011**: ThreadHelm MUST represent at least the following user-meaningful states: starting,
  running, awaiting user attention, interrupting, stopping, stopped, failed, and recovery required.
- **FR-012**: ThreadHelm MUST expose an interrupt action that uses the least-destructive supported
  interruption and reports the observed result.
- **FR-013**: ThreadHelm MUST expose a stop action that identifies and confirms an actively working
  target before ending it.
- **FR-014**: ThreadHelm MUST NOT force-stop an unresponsive process without a separate explicit
  user action that explains the risk.
- **FR-015**: A failure, interrupt, or stop in one session MUST NOT alter the lifecycle state or
  input/output routing of another session.
- **FR-016**: ThreadHelm MUST retain a local recovery record containing session identity, agent,
  workspace, lifecycle events, last known state, and timestamps.
- **FR-017**: ThreadHelm MUST NOT persist raw terminal output by default. Persisted recovery records
  MUST exclude credential values and prior terminal input.
- **FR-018**: On startup, ThreadHelm MUST classify prior unfinished sessions as interrupted or
  requiring reconciliation and MUST NOT claim they completed successfully.
- **FR-019**: ThreadHelm MUST NOT automatically restart agents, replay input, or resume side effects
  during recovery.
- **FR-020**: Recovery failures MUST preserve available evidence, identify what could not be loaded,
  and present a safe next action without inventing session state.
- **FR-021**: Primary workspace, launch, session selection, input, interrupt, stop, and recovery
  workflows MUST be operable by keyboard with visible focus and accessible names.
- **FR-022**: The interface MUST avoid characters, avatars, pixel effects, animated scenery,
  game-like maps, continuous decorative motion, and continuous rendering while idle.
- **FR-023**: ThreadHelm MUST keep lifecycle events human-readable and attributable to the initiating
  user action, agent process, or recovery operation.
- **FR-024**: ThreadHelm MUST operate without a ThreadHelm-hosted control plane or remote-control
  service.
- **FR-025**: ThreadHelm MUST prevent more than one active write-capable session in the same
  effective workspace. If an agent's write capability is unknown, ThreadHelm MUST treat it as
  write-capable. Parallel write-capable sessions require separately approved folders or worktrees.
- **FR-026**: ThreadHelm MUST block a user-requested application close while any session is active,
  list every affected session, and offer only cancellation of the close or safe stopping of all
  sessions before exit. An unresponsive session MUST follow the explicit force-stop requirement in
  FR-014; ThreadHelm MUST NOT silently leave it running or force-stop it during close.
- **FR-027**: The MVP MUST support Windows 11 client releases that remain within Microsoft's support
  lifecycle at the time of each ThreadHelm release. Windows 10, Windows Server, and non-Windows
  platforms are outside this feature's acceptance matrix.
- **FR-028**: ThreadHelm MUST permit only one controlling application instance per Windows user at a
  time. A second launch MUST direct the user to the existing instance or exit with an actionable
  explanation and MUST NOT create a second session controller.
- **FR-029**: ThreadHelm MUST supervise the complete process scope it starts for each agent session,
  including descendant and helper processes. Graceful stop and explicit force-stop MUST apply to
  that scope, remaining processes MUST be reported, and an unexpected loss of ThreadHelm supervision
  MUST NOT leave session-started processes running silently outside user control.
- **FR-030**: ThreadHelm MUST detect supported Windows lock, suspend, resume, and unlock transitions.
  After execution resumes, it MUST recheck every active session, report the observed process and
  terminal state or mark recovery as required, and MUST NOT automatically restart an agent or replay
  input.
- **FR-031**: ThreadHelm MUST base displayed lifecycle and attention states on observed process or
  supported agent evidence. Silence, elapsed time, or missing evidence MUST NOT be presented as
  proof that an agent is idle, working, awaiting input, complete, or failed; uncertain activity MUST
  be labeled as unknown.
- **FR-032**: ThreadHelm MUST preserve ordered, session-isolated terminal input; keep interactive
  terminal dimensions synchronized with the displayed session; bound live output retained in
  memory; disclose any output truncation; and prevent terminal output from causing clipboard,
  filesystem, external-application, link-opening, or operating-system actions without an explicit
  user action.
- **FR-033**: Immediately before process creation, ThreadHelm MUST revalidate the effective workspace
  boundary and the selected agent's resolved executable, version, availability, and authentication
  state. Changed or ambiguous launch information MUST fail closed and require renewed review, and
  the approved launch values MUST reach the agent without unintended command interpretation.
- **FR-034**: The MVP release MUST provide an installable Windows application that displays its
  version and completes the primary workflows on supported Windows 11 releases without requiring
  project development tools. Acceptance MUST exercise the installed release artifact and document
  how users can verify its publisher or artifact integrity and obtain a safe newer version.

### Scope Boundaries

**Included**:

- Explicit approval of local Windows workspaces.
- Launching, interacting with, supervising, interrupting, and stopping independent local agent
  sessions.
- Live per-session status and terminal output.
- Local session lifecycle history and honest restart recovery.
- Lightweight, accessible controls sufficient for the defined workflows.

**Excluded**:

- Agent-to-agent messaging, routing, delegation, shared task boards, or consensus workflows.
- Cross-session or long-term agent memory.
- Scheduled, unattended, or recurring execution.
- Remote control, remote workers, hosted coordination, or network listeners for external control.
- Automatic installation, authentication, or subscription management for third-party agent tools.
- Automatic restart, replay, or continuation of agent work after ThreadHelm restarts.
- Background or notification-area continuation of sessions after the user closes ThreadHelm.
- Windows 10, Windows Server, macOS, Linux, and other non-Windows platforms.
- Office simulations, characters, avatars, pixel effects, animated scenery, game-like maps, themes,
  and elaborate UI customization.

### Key Entities

- **Approved Workspace**: A local folder the user explicitly authorizes for agent launch, including
  its canonical effective path, approval state, and relevant boundary disclosure. Canonically
  equivalent paths identify the same workspace for concurrency control.
- **Agent Definition**: A terminal-based AI agent option, including its user-facing identity and
  current availability for launch without storing provider credentials.
- **Agent Session**: One interactive local agent process associated with one approved workspace,
  including its stable identity, lifecycle state, timestamps, and control eligibility.
- **Session Event**: A human-readable state change attributable to the user, agent process, or
  ThreadHelm recovery behavior.
- **Recovery Record**: The safe, local subset of session identity and lifecycle evidence retained
  across restarts without raw terminal output, prior input, or credential values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing, at least 90% of first-time users can select a workspace, approve
  its scope, and launch an available agent within two minutes, excluding third-party installation or
  authentication time.
- **SC-002**: A user can operate four concurrent sessions, including at least one Codex CLI session
  and one Claude Code session, for 30 minutes while every input, output, status change, interrupt,
  and stop remains attributed to the correct session.
- **SC-003**: Under four concurrent sessions, 95% of agent output becomes visible in its associated
  session within one second of ThreadHelm receiving it.
- **SC-004**: Every interrupt or stop request produces a visible acknowledgement within two seconds
  and an observed result or escalation option within ten seconds.
- **SC-005**: After an unexpected ThreadHelm exit with four sessions, the restarted application
  presents an honest recovery state for 100% of those sessions within five seconds of opening the
  workspace view.
- **SC-006**: In all recovery tests, zero agents are automatically relaunched and zero prior user
  inputs are replayed.
- **SC-007**: In isolation tests, failure or forced termination of one session causes zero state or
  routing changes in the remaining sessions.
- **SC-008**: 100% of the primary workflows can be completed using only a keyboard, with visible
  focus and an accessible name for every control.
- **SC-009**: During a 60-second idle period with no agent activity or user input, the interface
  performs no user-visible state changes or decorative motion and remains immediately responsive to
  keyboard input.
- **SC-010**: Across restart and persistence tests, no raw terminal input, raw terminal output, or
  detected credential value appears in a recovery record.
- **SC-011**: In 100% of launch tests, ThreadHelm blocks a second write-capable or capability-unknown
  session whose selected path resolves to the same effective workspace as an active session.
- **SC-012**: In 100% of user-requested close tests with active sessions, ThreadHelm remains open
  until the user cancels the close or every session reaches a stopped state through the safe-stop
  flow.
- **SC-013**: All primary user journeys and Windows-specific process, path, recovery, and
  accessibility acceptance tests pass on the oldest and newest supported Windows 11 client releases
  in the release test matrix.
- **SC-014**: In 100% of tests that start ThreadHelm while another instance is controlling sessions,
  no second session controller is created and the existing instance remains authoritative.
- **SC-015**: Across graceful-stop, force-stop, user-exit, and supervisor-crash tests, 100% of
  session-started processes either reach the expected stopped state or are surfaced as surviving
  processes requiring explicit user attention; none continue silently.
- **SC-016**: Within ten seconds after each tested Windows lock, suspend, resume, or unlock cycle,
  ThreadHelm presents an observed or recovery-required state for every previously active session,
  with zero automatic agent restarts and zero replayed inputs.
- **SC-017**: Across agent-output, silence, prompt, natural-exit, and missing-evidence tests,
  ThreadHelm makes zero unsupported claims that a session is idle, working, awaiting input,
  complete, or failed.
- **SC-018**: During concurrent input, resize, control-sequence, and sustained-output tests with four
  sessions, 100% of user input reaches only its selected session in order, the application remains
  responsive, privileged side effects require user action, and every output truncation is disclosed.
- **SC-019**: In 100% of tests where a workspace boundary, executable path, agent version,
  availability, or authentication state changes after initial readiness display, ThreadHelm blocks
  launch until the changed information is revalidated and reviewed.
- **SC-020**: The installed release artifact passes all primary launch, supervision, stop, recovery,
  and accessibility journeys on the oldest and newest supported Windows 11 client releases without
  requiring project development tools.

## Assumptions

- The MVP serves one local Windows user and does not include ThreadHelm accounts, roles, or shared
  remote workspaces.
- Users install and authenticate supported third-party agent tools outside ThreadHelm. ThreadHelm
  does not collect or manage provider credentials.
- The required MVP agent tools are Codex CLI and Claude Code. The supported operating systems are
  Windows 11 client releases within Microsoft's support lifecycle at release time.
- Multiple sessions may use the same agent tool, but full MVP acceptance requires at least one
  concurrent Codex CLI session and one concurrent Claude Code session in separately approved
  workspaces.
- Users who want agents to edit the same project concurrently provide separately selected folders
  or worktrees; automatic worktree creation is outside this MVP.
- Third-party agents may make their own network requests according to their configuration. That
  behavior is outside ThreadHelm's hosted-service exclusion and must be disclosed to the user.
- ThreadHelm sets and communicates the approved workspace boundary. When an external agent cannot be
  technically confined to that folder, ThreadHelm discloses the limitation, requires confirmation
  for every new session, and does not present the boundary as enforced.
- Restart recovery restores understandable session records, not interactive operating-system
  processes or unfinished agent work.
- Raw terminal output remains visible during the live session but is not persisted by default in
  the MVP.
- A single ThreadHelm application instance owns session control for this feature.
- A Windows lock or suspend may pause an external agent. ThreadHelm reports observed state after
  execution resumes rather than promising uninterrupted background execution.
- Terminal output and agent-generated links are treated as untrusted content and do not themselves
  authorize actions outside the terminal display.

## Dependencies

- Codex CLI and Claude Code must both be installed and authenticated for full MVP acceptance testing;
  either tool may be tested independently when the other is unavailable.
- The selected Windows account must have permission to read the workspace and start the chosen
  agent process.
- Representative hardware running the oldest and newest supported Windows 11 client releases, plus
  assistive-technology checks, is required for performance and accessibility acceptance testing.
- Release acceptance requires an installed ThreadHelm artifact and test fixtures that exercise
  process descendants, Windows lifecycle transitions, executable/version drift, terminal bursts,
  and potentially active terminal control sequences without causing external side effects.
