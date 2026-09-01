# Mission Focus Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scrolling all-in-one renderer with the approved Mission Course workspace while presenting and obtaining owner approval for every additional page before its production UI is created.

**Architecture:** Electron main remains the coordinator and sole SQLite writer. The renderer derives a selected-mission presentation from existing validated preload contracts, renders one mission at a time, and keeps terminal ownership bound to the selected session. The redesign proceeds page by page; every page except the already-approved Mission Course workspace has a blocking browser-variant gate before production component work.

**Tech Stack:** Electron 44, React 19, TypeScript 6/7, plain CSS, Zod-backed `@threadhelm/contracts`, Vitest, Playwright, Windows NSIS acceptance.

**Spec:** `docs/architecture/mission-focus-workspace-design.md`

## Global Constraints

- Electron main remains the sole coordinator and SQLite writer.
- Durable unknown delivery outcomes are never automatically resent.
- Existing session-host containment, terminal backpressure, and escalation-reason requirements remain unchanged.
- Production bundles contain generic agent starters only; private Marvel personas remain optional local imports and outside packaged artifacts.
- New sample content uses `threadhelm/agent-profile@1` and does not mention other products.
- No production page or materially different page state may be created until its browser variants are presented and the owner's selection is recorded.
- Prototype code is disposable and must not be promoted directly into production components.
- The primary supported release target remains unsigned Windows 11 x64; ARM64 evidence remains diagnostic unless a separate decision expands support.
- Existing behavior stays reachable until its approved replacement is implemented and verified.

---

## File map

### Shared shell and presentation

- `apps/desktop/src/renderer/App.tsx`: compose the selected production destinations after their visual gates pass.
- `apps/desktop/src/renderer/store.tsx`: own selected mission and selected destination identifiers; retain event-driven refresh.
- `apps/desktop/src/renderer/features/shell/AppShell.tsx`: three-region application shell and global notices.
- `apps/desktop/src/renderer/features/shell/AppNavigation.tsx`: keyboard navigation among approved destinations.
- `apps/desktop/src/renderer/features/shell/navigation.ts`: pure destination and selection reducer.
- `apps/desktop/src/renderer/features/mission-focus/mission-presentation.ts`: pure mapping from contract views to UI states.
- `apps/desktop/src/renderer/features/mission-focus/useMissionWorkspace.ts`: load mission summaries/detail on initial selection and `mission.changed` sequence updates.
- `apps/desktop/src/renderer/styles/tokens.css`: approved Mission Course color, type, spacing, focus, and state tokens.
- `apps/desktop/src/renderer/styles/shell.css`: responsive three-region shell.
- `apps/desktop/src/renderer/styles/mission-focus.css`: Mission Course, result, context, and session summary presentation.
- `apps/desktop/src/renderer/styles.css`: import the focused style files and retain styles for pages not yet redesigned.

### Mission Focus page

- `apps/desktop/src/renderer/features/mission-focus/MissionRail.tsx`: mission queue and selection.
- `apps/desktop/src/renderer/features/mission-focus/MissionWorkspace.tsx`: selected mission heading and page composition.
- `apps/desktop/src/renderer/features/mission-focus/MissionCourse.tsx`: verified, current, and queued outcomes.
- `apps/desktop/src/renderer/features/mission-focus/MissionContext.tsx`: decision, crew, and authority summaries.
- `apps/desktop/src/renderer/features/mission-focus/MissionResult.tsx`: latest verified result.
- `apps/desktop/src/renderer/features/mission-focus/MissionSessionSummary.tsx`: attached session and terminal entry point.

### Pages requiring later visual approval

- Mission create/revise: existing `MissionComposer.tsx`; replacement path chosen only after its gate.
- Sessions and terminal: existing `SessionList.tsx`, `LazyTerminal.tsx`, and `ControlBar.tsx`; replacement paths chosen only after their gate.
- Agents and templates: existing roster, authoring, and template components; replacement paths chosen only after their gate.
- Memory: existing `MemoryList.tsx`; replacement path chosen only after its gate.
- Settings, workspace, provider readiness, and recovery: existing panels; replacement paths chosen only after their gate.

### Verification

- `tests/unit/renderer/navigation.test.ts`: destination and selected-mission reducer behavior.
- `tests/unit/renderer/mission-presentation.test.ts`: exact presentation mapping for all mission states.
- `tests/e2e/mission-focus-workspace.spec.ts`: keyboard selection, focus transfer, attention, evidence, and responsive behavior.
- Existing mission, recovery, multi-session, accessibility, and installer suites remain regression gates.

---

### Task 1: Preserve the approved design and create stable sample states

**Files:**

- Modify: `docs/architecture/mission-focus-workspace-design.md`
- Modify: `apps/desktop/src/renderer/prototypes/mission-focus/prototype.js`
- Create: `apps/desktop/src/renderer/prototypes/mission-focus/NOTES.md`

**Interfaces:**

- Consumes: approved prototype D — Mission Course.
- Produces: named sample states shared by every later browser-variant review; no production API.

- [x] **Step 1: Record the owner decision**

Create `NOTES.md` with this exact decision:

```markdown
# Mission Focus prototype decision

- Selected: D — Mission Course
- Keep: Mission Ledger queue and context rail
- Keep: Flight Deck execution timeline
- Rule: present browser variants and obtain owner approval before creating every additional production page or materially different page state
- Production status: no prototype code is production code
```

- [x] **Step 2: Name the representative page states**

Export one in-memory fixture object from `prototype.js` containing these keys:

```js
const reviewStates = {
  empty: { mission: null, attention: 'none', sessions: [] },
  active: { mission: 'feature-003', attention: 'decision', sessions: ['ui-discovery'] },
  waiting: { mission: 'operator-guide', attention: 'owner', sessions: [] },
  recovery: { mission: 'interrupted-run', attention: 'recovery', sessions: [] },
  uncertain: { mission: 'unknown-effect', attention: 'inspect', sessions: [] },
  complete: { mission: 'feature-002', attention: 'none', sessions: [] },
};
```

- [x] **Step 3: Verify prototype isolation**

Run:

```powershell
rg -n "from .*prototypes|import .*prototypes" apps/desktop/src --glob '!renderer/prototypes/**'
```

Expected: no matches.

- [ ] **Step 4: Commit the approved design artifact**

```powershell
git add docs/architecture/mission-focus-workspace-design.md docs/superpowers/plans/2026-08-31-mission-focus-workspace.md apps/desktop/src/renderer/prototypes/mission-focus package.json
git commit -m "docs: approve mission focus workspace direction"
```

---

### Task 2: Add pure navigation and mission-presentation models

**Files:**

- Create: `apps/desktop/src/renderer/features/shell/navigation.ts`
- Create: `apps/desktop/src/renderer/features/mission-focus/mission-presentation.ts`
- Test: `tests/unit/renderer/navigation.test.ts`
- Test: `tests/unit/renderer/mission-presentation.test.ts`

**Interfaces:**

- Consumes: `MissionSummaryView`, `MissionDetailView`, `SessionView` from `@threadhelm/contracts`.
- Produces:

```ts
export type WorkspaceDestination =
  'missions' | 'sessions' | 'agents' | 'templates' | 'memory' | 'settings';

export interface WorkspaceSelection {
  destination: WorkspaceDestination;
  missionId: string | null;
  sessionId: string | null;
}

export function selectMission(current: WorkspaceSelection, missionId: string): WorkspaceSelection;

export type MissionAttention = 'none' | 'decision' | 'recovery' | 'uncertain';
export type CourseNodeState = 'verified' | 'current' | 'queued' | 'held';

export interface MissionPresentation {
  title: string;
  objective: string | null;
  lifecycleLabel: string;
  attention: MissionAttention;
  primaryAction: 'pause' | 'resume' | 'inspect' | 'view_evidence' | null;
  course: Array<{ id: string; title: string; state: CourseNodeState; summary: string }>;
}

export function presentMission(detail: MissionDetailView): MissionPresentation;
```

- [ ] **Step 1: Write navigation reducer tests**

Test that selecting a mission sets `destination: 'missions'`, updates `missionId`, and clears a
session that is not explicitly rebound. Test that selecting a session never changes `missionId`.

- [ ] **Step 2: Run the focused navigation test and observe failure**

```powershell
pnpm vitest run --project unit tests/unit/renderer/navigation.test.ts
```

Expected: fail because `navigation.ts` does not exist.

- [ ] **Step 3: Implement the exact `WorkspaceSelection` reducer**

Keep the reducer pure. Do not access `window.threadhelm`, React state, or storage.

- [ ] **Step 4: Write mission-presentation tests**

Cover these exact mappings:

```ts
expect(presentMission(running).primaryAction).toBe('pause');
expect(presentMission(paused).primaryAction).toBe('resume');
expect(presentMission(recoveryRequired).attention).toBe('recovery');
expect(presentMission(withUnknownAttempt).primaryAction).toBe('inspect');
expect(presentMission(completed).primaryAction).toBe('view_evidence');
expect(presentMission(cancelled).primaryAction).toBeNull();
```

- [ ] **Step 5: Run the presentation test and observe failure**

```powershell
pnpm vitest run --project unit tests/unit/renderer/mission-presentation.test.ts
```

Expected: fail because `mission-presentation.ts` does not exist.

- [ ] **Step 6: Implement presentation mapping without inventing durable facts**

Derive verified nodes only from completed work and retained evidence. Map unknown attempts to
`uncertain`; never map them to queued retry work. Use the mission objective when content exists and
the fixed sentence `Mission content was deleted.` when `detail.envelope` is null.

- [ ] **Step 7: Run both focused unit tests**

```powershell
pnpm vitest run --project unit tests/unit/renderer/navigation.test.ts tests/unit/renderer/mission-presentation.test.ts
```

Expected: pass.

- [ ] **Step 8: Commit**

```powershell
git add apps/desktop/src/renderer/features/shell/navigation.ts apps/desktop/src/renderer/features/mission-focus/mission-presentation.ts tests/unit/renderer/navigation.test.ts tests/unit/renderer/mission-presentation.test.ts
git commit -m "feat: add mission workspace presentation model"
```

---

### Task 3: Implement the approved Mission Course page shell

**Owner gate:** Already satisfied by the selection of D — Mission Course. Do not infer approval for
any destination page opened from its navigation.

**Files:**

- Create: `apps/desktop/src/renderer/features/shell/AppShell.tsx`
- Create: `apps/desktop/src/renderer/features/shell/AppNavigation.tsx`
- Create: `apps/desktop/src/renderer/features/mission-focus/MissionRail.tsx`
- Create: `apps/desktop/src/renderer/styles/tokens.css`
- Create: `apps/desktop/src/renderer/styles/shell.css`
- Modify: `apps/desktop/src/renderer/styles.css`
- Modify: `apps/desktop/src/renderer/store.tsx`

**Interfaces:**

- Consumes: `WorkspaceSelection`, existing store notices, `MissionSummaryView[]`.
- Produces:

```ts
export interface AppShellProps {
  rail: ReactNode;
  workspace: ReactNode;
  context: ReactNode;
  terminal: ReactNode | null;
}

export interface MissionRailProps {
  missions: MissionSummaryView[];
  selectedMissionId: string | null;
  onSelect(missionId: string): void;
  onCreate(): void;
}
```

- [ ] **Step 1: Add selected mission and destination actions to the store**

Extend `State` with:

```ts
selectedMissionId: string | null;
selectedDestination: WorkspaceDestination;
```

Add actions `selectMission(missionId: string)` and `selectDestination(destination:
WorkspaceDestination)`. Preserve `selectedSessionId`; do not overload it as the mission selection.

- [ ] **Step 2: Add approved visual tokens**

Define the six approved colors, Windows-local font stacks, focus ring, state shapes, and reduced
motion behavior in `tokens.css`. Import it before legacy styles.

- [ ] **Step 3: Build the structural shell**

Render semantic `nav`, `main`, `aside`, and optional terminal regions. Include skip links for mission
content and the terminal. At widths below 980px collapse context; below 700px replace the rail with a
mission picker.

- [ ] **Step 4: Build keyboard mission selection**

Use one tab stop for the mission queue. Arrow keys, Home, End, Enter, and Space follow the existing
`SessionList` pattern. After activation, focus the selected mission heading in the main region.

- [ ] **Step 5: Run typecheck and focused accessibility E2E**

```powershell
pnpm typecheck
pnpm playwright test tests/e2e/accessibility.spec.ts
```

Expected: pass; the old app remains mounted until Task 4 completes the selected mission page.

- [ ] **Step 6: Commit**

```powershell
git add apps/desktop/src/renderer/features/shell apps/desktop/src/renderer/features/mission-focus/MissionRail.tsx apps/desktop/src/renderer/styles apps/desktop/src/renderer/styles.css apps/desktop/src/renderer/store.tsx
git commit -m "feat: add approved mission course shell"
```

---

### Task 4: Implement selected mission content and context

**Files:**

- Create: `apps/desktop/src/renderer/features/mission-focus/useMissionWorkspace.ts`
- Create: `apps/desktop/src/renderer/features/mission-focus/MissionWorkspace.tsx`
- Create: `apps/desktop/src/renderer/features/mission-focus/MissionCourse.tsx`
- Create: `apps/desktop/src/renderer/features/mission-focus/MissionContext.tsx`
- Create: `apps/desktop/src/renderer/features/mission-focus/MissionResult.tsx`
- Create: `apps/desktop/src/renderer/features/mission-focus/MissionSessionSummary.tsx`
- Create: `apps/desktop/src/renderer/styles/mission-focus.css`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Test: `tests/e2e/mission-focus-workspace.spec.ts`

**Interfaces:**

- Consumes: `api.missions.list`, `api.missions.detail`, `missionSequence`, `MissionPresentation`, and
  the existing session store.
- Produces:

```ts
export interface MissionWorkspaceState {
  missions: MissionSummaryView[];
  detail: MissionDetailView | null;
  presentation: MissionPresentation | null;
  loading: boolean;
  error: unknown;
}

export function useMissionWorkspace(selectedMissionId: string | null): MissionWorkspaceState;
```

- [ ] **Step 1: Write the E2E test for the approved page**

The test must assert:

- Mission queue selection changes the `<h1>` and moves focus there.
- Exactly one mission is exposed as selected.
- Running, waiting, recovery-required, uncertain, and completed fixtures show different text states.
- Unknown work exposes inspection but no retry action.
- Latest result identifies its evidence source.
- The context rail states `Local coordinator · sole writer` and `External actions · approval required`.
- At 200% text scaling, content reflows without horizontal page scrolling.

- [ ] **Step 2: Run the E2E test and observe failure**

```powershell
pnpm playwright test tests/e2e/mission-focus-workspace.spec.ts
```

Expected: fail because the production Mission Focus page is not mounted.

- [ ] **Step 3: Implement event-driven mission loading**

Load summaries on mount and when `missionSequence` changes. Load detail only for the selected mission.
Use a cancellation flag in both effects. Do not poll and do not store mission content in browser
storage.

- [ ] **Step 4: Implement Mission Course and result mapping**

Render `presentation.course` as an ordered list with text state labels. Expose one primary action from
`presentation.primaryAction`. Route pause, resume, inspect, and evidence actions through the existing
validated API and existing detailed controls; do not duplicate mutation logic in presentation
components.

- [ ] **Step 5: Implement context and session summaries**

Summarize bound profiles and sessions from the selected detail. Do not show unbound sessions as crew.
Keep profile display names local and never supply packaged personal persona fixtures.

- [ ] **Step 6: Mount Mission Focus without redesigning other destinations**

Use Mission Focus as the default destination. Until later page gates pass, selecting Sessions, Agents,
Templates, Memory, or Settings opens the existing components with their current semantics and copy;
do not restyle their internal layouts in this task.

- [ ] **Step 7: Run focused and regression verification**

```powershell
pnpm typecheck
pnpm lint
pnpm vitest run --project unit tests/unit/renderer/navigation.test.ts tests/unit/renderer/mission-presentation.test.ts
pnpm playwright test tests/e2e/mission-focus-workspace.spec.ts tests/e2e/supervisor-mission.spec.ts tests/e2e/accessibility.spec.ts
```

Expected: pass.

- [ ] **Step 8: Commit**

```powershell
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/features/mission-focus apps/desktop/src/renderer/styles/mission-focus.css tests/e2e/mission-focus-workspace.spec.ts
git commit -m "feat: make missions the primary workspace"
```

---

### Task 5: Present and approve Mission creation and revision variants

**Owner gate:** Blocking. No production Mission Composer redesign may begin until this task records an
explicit selection.

**Files:**

- Create: `apps/desktop/src/renderer/prototypes/mission-create/index.html`
- Create: `apps/desktop/src/renderer/prototypes/mission-create/prototype.js`
- Create: `apps/desktop/src/renderer/prototypes/mission-create/styles.css`
- Create: `apps/desktop/src/renderer/prototypes/mission-create/NOTES.md`

**Interfaces:**

- Consumes: the exact existing mission fields, limits, roster bindings, model, effort, permission,
  review, and revision-conflict states from `MissionComposer.tsx`.
- Produces: one owner-approved design decision; no production imports.

- [x] **Step 1: Build three structural variants**

Present all existing fields and these structures:

- A: one-page mission envelope with a sticky review summary.
- B: staged Objective → Crew → Bounds → Review flow with progress and Back.
- C: split editor and exact-envelope preview with automatic preview refresh.

Keep folder selection as the only confirmation gate, preserve `CLI default` and `Custom model…`, and
show exact provider-specific choices. Both saved-profile selection and local JSON import must display
the agent's goal and abilities before addition. State that ability labels are descriptive and do not
grant tools, permissions, folder access, or authority.

Offer a third `Create worker profile…` path that collects name, description, goal, abilities,
provider, and requested model in the UI. It must show the exact profile review before saving and
adding the worker. Saving the profile must not start a session, grant authority, or merge the reusable
profile goal with the mission-specific assignment.

- [x] **Step 2: Present variants in the browser**

Open the local page on variant A, leave the switcher visible, and explain the hierarchy and tradeoffs.

- [x] **Step 3: Stop for owner selection**

Do not create or modify production Mission Composer components in this task. Record the chosen variant,
combined elements, and rejected behaviors in `NOTES.md`.

- [ ] **Step 4: Commit only the reviewed prototype decision**

```powershell
git add apps/desktop/src/renderer/prototypes/mission-create
git commit -m "docs: record mission composer design decision"
```

---

### Task 6: Present and approve Sessions and terminal variants

**Owner gate:** Blocking. The approved Mission Course only establishes the terminal's dock position;
it does not approve session-page density, terminal tabs, or control placement.

**Files:**

- Create: `apps/desktop/src/renderer/prototypes/session-workspace/index.html`
- Create: `apps/desktop/src/renderer/prototypes/session-workspace/prototype.js`
- Create: `apps/desktop/src/renderer/prototypes/session-workspace/styles.css`
- Create: `apps/desktop/src/renderer/prototypes/session-workspace/NOTES.md`

**Interfaces:**

- Consumes: current lifecycle, activity, unread, truncation, input rejection, interrupt, stop, and
  force-stop states.
- Produces: one owner-approved session page and terminal-dock decision; no production imports.

- [ ] **Step 1: Build three structural variants**

- A: session list in the left rail with one full-height terminal.
- B: mission-scoped lower dock with session tabs and controls in the dock header.
- C: split session inspector and terminal with lifecycle evidence beside controls.

Every variant must show stopped, failed, recovery-required, new-output, truncation, backpressure, and
wrong-selection input states.

- [ ] **Step 2: Present variants and terminal interactions in the browser**

Demonstrate session switching, dock collapse, keyboard escape from terminal to controls, and visible
mission/session identity.

- [ ] **Step 3: Stop for owner selection**

Record the chosen structure and terminal-switch behavior. Do not change `LazyTerminal`, terminal
controller ownership, or production controls in this task.

- [ ] **Step 4: Commit only the reviewed prototype decision**

```powershell
git add apps/desktop/src/renderer/prototypes/session-workspace
git commit -m "docs: record session workspace design decision"
```

---

### Task 7: Present remaining destination pages before scheduling their production tasks

**Owner gate:** Blocking per page. Each page is reviewed separately; approval of one does not approve
the next.

**Files:**

- Create: `docs/architecture/mission-focus-page-decisions.md`
- Create per review: `apps/desktop/src/renderer/prototypes/<page-name>/`

**Interfaces:**

- Consumes: existing production component behavior and representative local sample data.
- Produces: an owner-selected design and a scoped follow-up implementation plan for each page.

- [ ] **Step 1: Present Agents and Templates variants**

Compare roster-first, profile-detail-first, and library-first structures. Preserve generic bundled
starters, exact imported provenance, and private local-profile separation. Record the selection before
planning production files.

- [ ] **Step 2: Present Memory variants**

Compare list/detail, search-led, and mission-context structures. Preserve citation, contested,
retracted, deleted, expired, superseded, and explicit pagination states. Record the selection before
planning production files.

- [ ] **Step 3: Present Settings, Workspace, and Provider variants**

Compare destination page, compact inspector, and task-oriented setup structures. Preserve native
folder selection, revocation, provider readiness, storage degradation, and app-information evidence.
Record the selection before planning production files.

- [ ] **Step 4: Present Recovery and destructive-action variants**

Compare dedicated recovery page, mission-context recovery, and attention-queue structures. Preserve
exact target identity, explicit confirmation, no replay of unknown work, and content-deletion scope.
Record the selection before planning production files.

- [ ] **Step 5: Write one follow-up plan per approved subsystem**

Save each plan under `docs/superpowers/plans/` with exact production files and tests. Do not combine
Agents, Memory, Settings, and Recovery into one implementation task because each can be accepted or
rejected independently.

---

### Task 8: Integrate only approved pages and remove prototype code

**Files:**

- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: production files named in the approved follow-up page plans.
- Delete: `apps/desktop/src/renderer/prototypes/`
- Modify: `package.json`
- Test: all renderer, mission, session, recovery, accessibility, and installed acceptance suites.

**Interfaces:**

- Consumes: owner-approved page decisions and completed follow-up plans.
- Produces: one production renderer with no prototype runtime or import path.

- [ ] **Step 1: Confirm every mounted destination has an approval record**

Run:

```powershell
rg -n "Selected:|Approved:" apps/desktop/src/renderer/prototypes docs/architecture/mission-focus-page-decisions.md
```

Expected: one recorded owner selection for every destination mounted by `App.tsx`.

- [ ] **Step 2: Remove prototype code and command**

Delete `apps/desktop/src/renderer/prototypes/` and remove `prototype:mission-ui` from `package.json`.

- [ ] **Step 3: Prove production has no prototype or private-persona import**

```powershell
rg -n "prototype|Marvel|munder-difflin/hire@1" apps/desktop/src packages --glob '!**/*.test.*'
```

Expected: no production prototype or private-persona import. A legacy manifest identifier may remain
only in explicit untrusted-import compatibility code and its tests.

- [ ] **Step 4: Run local CI-equivalent verification**

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:contract
pnpm test:integration:windows
pnpm desktop:build
pnpm test:e2e
pnpm rust:fmt
pnpm rust:check
pnpm rust:test
```

Expected: all pass. Record any diagnostic ARM64 result separately from x64 release evidence.

- [ ] **Step 5: Build and inspect the unsigned x64 installer**

```powershell
pnpm package:win
pnpm test:acceptance:installed
```

Expected: installer acceptance passes with `NotSigned` recorded as intentional, x64 architecture
confirmed, private personas absent, and uninstall cleanup complete.

- [ ] **Step 6: Commit the integrated renderer**

```powershell
git add -A
git commit -m "feat: deliver approved mission focus workspace"
```

---

## Self-review record

- Spec coverage: mission selection, Mission Course, context, evidence, terminal position, responsive
  behavior, accessibility, authority, unknown outcomes, content boundaries, and visual approval gates
  all map to tasks above.
- Scope split: Mission Focus has concrete production tasks. Mission creation, Sessions, Agents,
  Memory, Settings, and Recovery each stop at a visual gate and receive separate production plans
  after approval.
- Placeholder scan: the plan contains no deferred implementation markers or unspecified code steps.
- Type consistency: `WorkspaceSelection`, `MissionPresentation`, and `MissionWorkspaceState` have one
  definition and stable names across dependent tasks.
