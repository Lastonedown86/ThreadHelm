# Mission Focus Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four visible shell bugs and bring the Mission Focus workspace to the owner-approved "D — Mission Course" prototype, with honest waiting / uncertain / recovery / completed states.

**Architecture:** All screen facts flow from one presentation module (`mission-presentation.ts`) that maps `MissionDetailView` plus live-session ids into a `MissionPresentation`; components render it and never compute state. Layout follows the recovered prototype at Git ref `7ef0ad5^`. No coordinator contracts change; the renderer reads only existing preload views and store state.

**Tech Stack:** React 19 + TypeScript in an Electron renderer, plain CSS with tokens in `apps/desktop/src/renderer/styles/`, Vitest (`unit` project) for presentation logic, Playwright `_electron` e2e against the built app (`pnpm desktop:build` first), pnpm scripts.

**Spec:** `docs/superpowers/specs/2026-09-01-mission-focus-parity-design.md`

## Global Constraints

- No new coordinator contracts; every fact comes from `MissionSummaryView`, `MissionDetailView`, store sessions, store recovery records.
- No terminal dock in the shell, no composer changes, no Sessions / Agents / Memory / Setup / Recovery page changes beyond bugs 1.1 and 1.2.
- New CSS goes in `apps/desktop/src/renderer/styles/*.css`, never in legacy `styles.css`.
- Reason codes (`/^[A-Z][A-Z0-9_]{2,63}$/`) never appear in workspace text.
- State is always expressed with text as well as color and shape.
- Terminal output never enters a live region. Reduced motion disables the only transition.
- Bundled copy uses generic terms; no product names or personas.
- Branch: `feat/mission-focus-parity`. Commit after every task. Attribution trailer on every commit:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz`.
- Commands: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm desktop:build && pnpm exec playwright test <spec>`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/desktop/src/renderer/features/mission-focus/reason-labels.ts` | New. Reason code → human sentence map and fallback. |
| `apps/desktop/src/renderer/features/mission-focus/mission-presentation.ts` | Rewritten. Single source of screen facts. |
| `apps/desktop/src/renderer/features/mission-focus/MissionWorkspace.tsx` | Header, action row, strip, course header, summary grid. |
| `apps/desktop/src/renderer/features/mission-focus/MissionStrip.tsx` | New. Status strip. |
| `apps/desktop/src/renderer/features/mission-focus/MissionCourse.tsx` | Course line with numbered nodes and actions. |
| `apps/desktop/src/renderer/features/mission-focus/MissionResult.tsx` | Renders `presentation.verifiedResult` only. |
| `apps/desktop/src/renderer/features/mission-focus/MissionContext.tsx` | Decision-first rail sections. |
| `apps/desktop/src/renderer/features/mission-focus/MissionContextFrame.tsx` | New. Padding + heading for any context content. |
| `apps/desktop/src/renderer/features/mission-focus/ContextToggle.tsx` | New. Medium-width attention button + overlay. |
| `apps/desktop/src/renderer/features/mission-focus/MissionRail.tsx` | Progress line per mission. |
| `apps/desktop/src/renderer/features/mission-focus/useMissionWorkspace.ts` | Passes live session ids into presentation. |
| `apps/desktop/src/renderer/features/shell/AppNavigation.tsx` | Badge counts. |
| `apps/desktop/src/renderer/features/shell/AppShell.tsx` | Context toggle slot, live region. |
| `apps/desktop/src/renderer/App.tsx` | Action dispatch by `kind`, frames non-mission context. |
| `apps/desktop/src/renderer/styles/shell.css` | Container, narrow rows, nav badges, overlay. |
| `apps/desktop/src/renderer/styles/mission-focus.css` | Strip, course line, cards, decision section. |
| `apps/desktop/src/renderer/styles/memory-library.css` | Container queries. |
| `apps/desktop/src/renderer/prototypes/mission-focus-states/` | Disposable variant round. Deleted before merge. |
| `tests/unit/renderer/reason-labels.test.ts` | Coverage of emitted codes. |
| `tests/unit/renderer/mission-presentation.test.ts` | Presentation matrix. |
| `tests/e2e/mission-focus-workspace.spec.ts` | State, viewport, toggle, no-code assertions. |
| `tests/e2e/parity-screenshots.spec.ts` | Opt-in screenshot capture for audit re-runs. |

---

### Task 0: Commit the in-progress Mission Focus polish

The branch carries uncommitted edits (rail titles, session rows, pause action, flex fix). Land them first so every later diff is clean.

**Files:**
- Modify: the 14 files already listed by `git status --short`

- [ ] **Step 1: Verify the working tree is green**

Run: `pnpm typecheck && pnpm lint && pnpm test:unit`
Expected: all pass.

- [ ] **Step 2: Build and run the two touched e2e specs**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts tests/e2e/supervisor-mission.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A apps/desktop/src/renderer tests/e2e/mission-focus-workspace.spec.ts tests/e2e/supervisor-mission.spec.ts tests/unit/renderer/mission-presentation.test.ts
git commit -m "feat: show mission titles, session rows and pause action in Mission Focus

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 1: Memory library sizes on its container (bug 1.1)

**Files:**
- Modify: `apps/desktop/src/renderer/styles/shell.css` (`.mission-shell-workspace` block)
- Modify: `apps/desktop/src/renderer/styles/memory-library.css` (grid + media queries)
- Test: `tests/e2e/mission-focus-workspace.spec.ts`

**Interfaces:**
- Produces: `.mission-shell-workspace` is a `container-type: inline-size` container named `workspace`. Later tasks use `@container workspace (...)`.

- [ ] **Step 1: Write the failing e2e assertion**

Add to the first test in `tests/e2e/mission-focus-workspace.spec.ts`, after the existing 200% font-size overflow check:

```ts
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
    for (const width of [1400, 1100]) {
      await page.setViewportSize({ width, height: 860 });
      await page.getByRole('button', { name: 'Memory', exact: true }).click();
      await expect(page.getByRole('heading', { name: /reading list/i })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
        `no horizontal overflow at ${width}px`,
      ).toBe(false);
      const clipped = await page.evaluate(() => {
        const main = document.querySelector('.mission-shell-workspace')!;
        return main.scrollWidth > main.clientWidth;
      });
      expect(clipped, `workspace column does not scroll sideways at ${width}px`).toBe(false);
      await page.getByRole('button', { name: 'Missions', exact: true }).click();
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "focused default"`
Expected: FAIL on `workspace column does not scroll sideways at 1400px`.

- [ ] **Step 3: Make the workspace a container**

In `shell.css`, replace the `.mission-shell-workspace` block:

```css
.mission-shell-workspace {
  background: var(--mission-paper);
  container-type: inline-size;
  container-name: workspace;
}
```

- [ ] **Step 4: Rewrite the memory grid on container width**

Replace the `.memory-library-grid` rule and both `@media` blocks in `memory-library.css`:

```css
.memory-library-grid {
  display: grid;
  grid-template-columns: minmax(13rem, 0.6fr) minmax(0, 1.6fr) minmax(13rem, 0.7fr);
  gap: 1rem;
  align-items: start;
  min-width: 0;
}
.memory-library-grid > * {
  min-width: 0;
}
@container workspace (max-width: 62rem) {
  .memory-library-grid {
    grid-template-columns: minmax(13rem, 0.7fr) minmax(0, 1.6fr);
  }
  .mission-reading-list {
    grid-column: 1 / -1;
  }
}
@container workspace (max-width: 40rem) {
  .memory-library-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .mission-reading-list {
    grid-column: auto;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "focused default"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer/styles/shell.css apps/desktop/src/renderer/styles/memory-library.css tests/e2e/mission-focus-workspace.spec.ts
git commit -m "fix: size the memory library on the workspace container

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 2: Frame every non-mission context (bug 1.2)

**Files:**
- Create: `apps/desktop/src/renderer/features/mission-focus/MissionContextFrame.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx` (the `context=` prop)
- Modify: `apps/desktop/src/renderer/features/workspaces/SetupAttentionSummary.tsx`
- Modify: `apps/desktop/src/renderer/styles/mission-focus.css`
- Test: `tests/e2e/mission-focus-workspace.spec.ts`

**Interfaces:**
- Produces: `MissionContextFrame({ heading: string; children })` renders `<div class="mission-context-content"><h2>{heading}</h2>{children}</div>`.

- [ ] **Step 1: Write the failing e2e assertion**

In the first test of `tests/e2e/mission-focus-workspace.spec.ts`, after the Sessions heading check:

```ts
    await expect(page.getByText(/^sessions workspace$/)).toHaveCount(0);
    await expect(
      page.getByRole('complementary', { name: 'Mission context' }).getByRole('heading', {
        name: 'Sessions',
      }),
    ).toBeVisible();
    await expect(page.getByText('Ready for reviewed work')).toBeVisible();
    const padding = await page
      .locator('.mission-shell-context .mission-context-content')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(padding).toBeGreaterThan(8);
```

Note: the cold app has no workspace approved, so `SetupAttentionSummary` reads "2 items need attention" there. Change the assertion text to `page.getByText(/need attention|Ready for reviewed work/)`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "focused default"`
Expected: FAIL on the Sessions heading in the complementary region.

- [ ] **Step 3: Create the frame**

```tsx
// apps/desktop/src/renderer/features/mission-focus/MissionContextFrame.tsx
import type { ReactNode } from 'react';

export function MissionContextFrame({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="mission-context-content">
      <h2>{heading}</h2>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Use it in App.tsx**

Add `import { MissionContextFrame } from './features/mission-focus/MissionContextFrame.js';` and a label map above `Shell`:

```ts
const destinationHeading: Record<WorkspaceDestination, string> = {
  missions: 'Mission context',
  sessions: 'Sessions',
  agents: 'Agents',
  templates: 'Templates',
  memory: 'Memory',
  attention: 'Attention',
  settings: 'Settings',
};
```

(import `type { WorkspaceDestination } from './features/shell/navigation.js'`). Replace the `context=` prop:

```tsx
        context={
          missionSelected ? (
            <MissionContext detail={workspace.detail} presentation={workspace.presentation} />
          ) : (
            <MissionContextFrame heading={destinationHeading[state.selectedDestination]}>
              <SetupAttentionSummary />
            </MissionContextFrame>
          )
        }
```

- [ ] **Step 5: Give the summary the section styling**

In `SetupAttentionSummary.tsx` change `<section className="setup-attention" ...>` to `<section className="setup-attention mission-context-section" ...>`. In `mission-focus.css` change the shared card selector list so the section style applies by class:

```css
.mission-course li,
.mission-result,
.mission-session-summary,
.mission-context-content section,
.mission-context-section {
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "focused default"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/features/mission-focus/MissionContextFrame.tsx apps/desktop/src/renderer/features/workspaces/SetupAttentionSummary.tsx apps/desktop/src/renderer/styles/mission-focus.css tests/e2e/mission-focus-workspace.spec.ts
git commit -m "fix: frame non-mission context with a heading and padding

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 3: Narrow rail no longer takes half the viewport (bug 1.3)

**Files:**
- Modify: `apps/desktop/src/renderer/styles/shell.css` (`@media (max-width: 700px)` block)
- Test: `tests/e2e/mission-focus-workspace.spec.ts`

- [ ] **Step 1: Write the failing e2e assertion**

Add a new test at the end of `tests/e2e/mission-focus-workspace.spec.ts`:

```ts
test('narrow windows keep the mission heading in the first screen', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const directories = [tempWorkspace('narrow-leader'), tempWorkspace('narrow-worker')];
  try {
    const mission = await confirmMission(
      app,
      await prepareFixtureMission(app, directories),
      'Narrow window mission',
    );
    await app.page.setViewportSize({ width: 680, height: 800 });
    await app.page.getByLabel('Selected mission').selectOption(mission.id);
    const heading = app.page.locator('#mission-workspace h1');
    await expect(heading).toHaveText('Narrow window mission');
    const top = await heading.evaluate((el) => el.getBoundingClientRect().top);
    expect(top, 'mission heading inside the first viewport').toBeLessThan(400);
    const scrollers = await app.page.evaluate(() =>
      [...document.querySelectorAll('*')].filter((el) => {
        const s = getComputedStyle(el);
        return (
          (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight
        );
      }).length,
    );
    expect(scrollers, 'one vertical scroller').toBeLessThanOrEqual(1);
  } finally {
    await teardown(app, ...directories);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "narrow windows"`
Expected: FAIL on `mission heading inside the first viewport`.

- [ ] **Step 3: Fix the narrow grid**

Replace the whole `@media (max-width: 700px)` block in `shell.css`:

```css
@media (max-width: 700px) {
  .mission-shell-regions {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .mission-shell-rail {
    overflow: visible;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--mission-ink) 20%, transparent);
  }

  .mission-rail-list {
    display: none;
  }

  .mission-picker,
  .mission-picker-label {
    display: block;
  }

  .mission-picker {
    width: 100%;
  }

  .app-navigation {
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    overflow-x: auto;
    padding: 0.5rem 0.75rem;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "narrow windows"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/styles/shell.css tests/e2e/mission-focus-workspace.spec.ts
git commit -m "fix: keep the mission workspace in view at narrow widths

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 4: Expected-fail test for collapsed attention (bug 1.4)

**Files:**
- Test: `tests/e2e/mission-focus-workspace.spec.ts`

- [ ] **Step 1: Add the fixme test**

```ts
test.fixme('medium windows keep an attention control when a decision waits', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const directories = [tempWorkspace('medium-leader'), tempWorkspace('medium-worker')];
  try {
    let mission = await confirmMission(
      app,
      await prepareFixtureMission(app, directories),
      'Medium window mission',
    );
    const work = await addWork(app, mission);
    await app.bridgeRequest(work.supervisorId, 'threadhelm_work_assign', {
      ...workDecision(mission.id),
      idempotencyKey: randomUUID(),
      workItemId: work.workItemId,
      bindingId: work.binding.bindingId,
    });
    mission = await app.call('missions.detail', { missionId: mission.id });
    await app.bridgeRequest(mission.attempts[0]!.sessionId!, 'threadhelm_work_result', {
      missionId: mission.id,
      workItemId: work.workItemId,
      attemptId: mission.attempts[0]!.id,
      idempotencyKey: randomUUID(),
      disposition: 'authority_required',
      explanation: 'An owner decision is needed.',
      evidenceRefs: [],
    });
    await app.page.setViewportSize({ width: 960, height: 800 });
    const list = app.page.getByRole('listbox', { name: 'Missions', exact: true });
    await list.getByRole('option', { name: new RegExp(mission.id.slice(0, 8), 'i') }).click();
    const toggle = app.page.getByRole('button', { name: /needs your decision/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const panel = app.page.getByRole('dialog', { name: 'Mission context' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Review choices…' })).toBeVisible();
    await app.page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
  } finally {
    await teardown(app, ...directories);
  }
});
```

- [ ] **Step 2: Run the file to confirm it is skipped, not failing**

Run: `pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "medium windows"`
Expected: 1 skipped.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/mission-focus-workspace.spec.ts
git commit -m "test: record the collapsed-attention requirement as expected-fail

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

Open PR 1 here: `gh pr create --title "fix: Mission Focus shell bugs (parity phase 1)" --base main`.

---

### Task 5: Reason labels with emitted-code coverage

**Files:**
- Create: `apps/desktop/src/renderer/features/mission-focus/reason-labels.ts`
- Test: `tests/unit/renderer/reason-labels.test.ts`

**Interfaces:**
- Produces: `reasonLabel(code: string | null | undefined): string | null` and `REASON_LABELS: Readonly<Record<string, string>>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/renderer/reason-labels.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REASON_LABELS,
  reasonLabel,
} from '../../../apps/desktop/src/renderer/features/mission-focus/reason-labels.js';

const roots = ['apps/desktop/src/main', 'packages/domain/src', 'packages/persistence/src'];
const prefixes = /'((?:WORKER|MISSION|SUPERVISOR|STARTUP|PERMISSION)_[A-Z0-9_]+)'/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

function emittedCodes(): string[] {
  const codes = new Set<string>();
  for (const root of roots)
    for (const file of walk(root))
      for (const match of readFileSync(file, 'utf8').matchAll(prefixes)) codes.add(match[1]!);
  return [...codes].sort();
}

describe('reason labels', () => {
  it('covers every mission-path reason code the main process can emit', () => {
    const codes = emittedCodes();
    expect(codes.length).toBeGreaterThan(20);
    const missing = codes.filter((code) => !(code in REASON_LABELS));
    expect(missing, 'add a human sentence for each').toEqual([]);
  });

  it('never returns a raw code', () => {
    for (const code of Object.keys(REASON_LABELS))
      expect(reasonLabel(code)).not.toMatch(/^[A-Z][A-Z0-9_]{2,63}$/);
    expect(reasonLabel('SOMETHING_NEW_HAPPENED')).toBe('Something new happened.');
    expect(reasonLabel(null)).toBeNull();
    expect(reasonLabel(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/renderer/reason-labels.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Enumerate the codes and write the map**

Run once to get the list:

```bash
rtk proxy grep -rhoE "'(WORKER|MISSION|SUPERVISOR|STARTUP|PERMISSION)_[A-Z0-9_]+'" apps/desktop/src/main packages/domain/src packages/persistence/src | sort -u
```

Write the module with one sentence per code found. Start from this list (26 known on 2026-09-01) and add any the grep reveals:

```ts
// apps/desktop/src/renderer/features/mission-focus/reason-labels.ts
/** Human sentences for coordinator reason codes. Codes never reach the screen. */
export const REASON_LABELS: Readonly<Record<string, string>> = {
  MAIN_STARTUP_FAILED: 'ThreadHelm could not finish starting.',
  MISSION_AUTHORITY_REQUIRED: 'This step needs your decision before work continues.',
  MISSION_BOUND_REACHED: 'A mission limit was reached, so work stopped here.',
  MISSION_COMPLETED: 'The mission completed with retained evidence.',
  MISSION_CONTENT_DELETED: 'Mission content was deleted; receipts remain.',
  MISSION_ENVELOPE_STALE: 'The mission envelope changed and needs a fresh review.',
  MISSION_POWER_BOUNDARY: 'Work paused at a power event and did not resume by itself.',
  PERMISSION_ALLOWLIST_UNAVAILABLE: 'The provider cannot use the requested permission allowlist.',
  PERMISSION_AUTO_UNAVAILABLE: 'Automatic permission mode is not available for this provider.',
  PERMISSION_CAPABILITY_CHANGED: 'Provider permission capabilities changed since review.',
  PERMISSION_POLICY_HELD: 'Permission policy held this action for your review.',
  STARTUP_DELIVERY_UNCERTAIN: 'A delivery outcome is uncertain after restart.',
  STARTUP_RECONCILIATION: 'ThreadHelm restarted and could not confirm this work.',
  SUPERVISOR_DECISION_LOOP: 'The supervisor repeated the same decision and was stopped.',
  SUPERVISOR_LOST: 'The supervisor session ended, so coordination stopped.',
  SUPERVISOR_NOT_BOUND: 'No supervisor is bound to this mission.',
  SUPERVISOR_OUTPUT_INVALID: 'The supervisor returned something ThreadHelm could not validate.',
  SUPERVISOR_PAUSED: 'The supervisor paused this work.',
  SUPERVISOR_ROLE_REQUIRED: 'Only the supervisor may make this change.',
  SUPERVISOR_ROLE_TOOLS: 'This tool is reserved for the supervisor role.',
  SUPERVISOR_TOOL_NAMES: 'The supervisor used a tool name ThreadHelm does not recognize.',
  WORKER_AUTOSTART_NOT_AUTHORIZED: 'Automatic worker start was not authorized.',
  WORKER_AUTOSTART_PREFLIGHT_FAILED: 'Worker start preflight failed, so nothing launched.',
  WORKER_AUTHORITY_REQUIRED: 'The worker needs your decision before continuing.',
  WORKER_SESSION_ENDED: 'The worker session ended before returning a result.',
  WORKER_START_FAILED_BEFORE_EFFECT: 'The worker failed to start and made no changes.',
  WORKER_START_OUTCOME_UNKNOWN: 'The worker start outcome is unknown.',
  WORKER_UNKNOWN: 'The outcome is unknown; retained evidence is kept as it is.',
};

export function reasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const known = REASON_LABELS[code];
  if (known) return known;
  const words = code.toLowerCase().replaceAll('_', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}
```

`WORKER_AUTHORITY_REQUIRED` and `WORKER_UNKNOWN` appear in work-item reason codes even if the grep roots miss them; keep them.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit -- tests/unit/renderer/reason-labels.test.ts`
Expected: PASS. If `missing` lists codes, add sentences for each and rerun.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/features/mission-focus/reason-labels.ts tests/unit/renderer/reason-labels.test.ts
git commit -m "feat: map mission reason codes to human sentences

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 6: Presentation model rewrite

**Files:**
- Modify: `apps/desktop/src/renderer/features/mission-focus/mission-presentation.ts` (full rewrite)
- Modify: `apps/desktop/src/renderer/features/mission-focus/useMissionWorkspace.ts` (`presentation:` line)
- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionWorkspace.tsx` (action row only, to keep typecheck green)
- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionContext.tsx` (attention line only)
- Modify: `apps/desktop/src/renderer/App.tsx` (`onPause` becomes `onAction`)
- Test: `tests/unit/renderer/mission-presentation.test.ts`

**Interfaces:**
- Produces (exact, used by every later task):

```ts
export type MissionAttention = 'none' | 'decision' | 'recovery' | 'uncertain';
export type CourseNodeState = 'verified' | 'current' | 'queued' | 'waiting' | 'uncertain' | 'held';
export type ActionKind = 'pause' | 'resume' | 'review' | 'inspect' | 'view_evidence';
export interface ActionSpec { kind: ActionKind; label: string }
export type NodeAction =
  | { kind: 'open_terminal'; sessionId: string; label: 'Open terminal' }
  | { kind: 'review'; label: 'Review choices…' }
  | { kind: 'inspect'; label: 'Inspect evidence…' };
export interface CourseNode { id: string; index: number; title: string; state: CourseNodeState; summary: string; action: NodeAction | null }
export interface MissionPresentation {
  title: string; objective: string | null; lifecycleLabel: string;
  attention: MissionAttention; attentionLabel: string | null; attentionSummary: string | null;
  primaryAction: ActionSpec | null; secondaryAction: ActionSpec | null;
  strip: { execution: string; decisionsPending: number; sessionsAttached: number };
  course: CourseNode[];
  verifiedResult: { explanation: string; evidence: string[] } | null;
}
export interface PresentationContext { liveSessionIds: ReadonlySet<string> }
export function presentMission(detail: MissionDetailView, context?: PresentationContext): MissionPresentation
export const ACTION_LABELS: Record<ActionKind, string>
```

- [ ] **Step 1: Rewrite the unit test file**

Replace `tests/unit/renderer/mission-presentation.test.ts` body after the `unknownAttempt` helper (keep `mission()` and `unknownAttempt()` as they are) with:

```ts
const workItemId = '00000000-0000-4000-8000-000000000003';
const sessionId = '00000000-0000-4000-8000-000000000009';

function workItem(
  overrides: Partial<SupervisorWorkView> = {},
): SupervisorWorkView {
  return {
    id: workItemId,
    missionId,
    parentWorkItemId: null,
    workspaceId: '00000000-0000-4000-8000-000000000008',
    title: 'Verify the result',
    specification: null,
    acceptanceCriteria: null,
    dependencies: [],
    authorityClass: 'routine',
    state: 'running',
    assignedSessionId: sessionId,
    attemptCount: 1,
    reasonCode: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:01:00.000Z',
    ...overrides,
  };
}

const evidenced = (): SupervisorAttemptView => ({
  ...unknownAttempt(),
  workItemId,
  state: 'completed',
  disposition: 'completion',
  explanation: 'Done with a report.',
  evidenceRefs: [{ kind: 'artifact', id: 'report.md' }],
  completedAt: '2026-09-01T12:01:00.000Z',
});

describe('mission presentation', () => {
  it('titles a mission by its objective and falls back to the id only without content', () => {
    expect(presentMission(mission()).title).toBe('Ship a bounded mission workspace.');
    expect(missionTitle('First line\nSecond line', missionId)).toBe('First line');
    expect(missionTitle('x'.repeat(100), missionId)).toBe(`${'x'.repeat(79)}…`);
    expect(missionTitle(null, missionId)).toBe('Mission 00000000');
    expect(presentMission(mission({ envelope: null })).title).toBe('Mission 00000000');
  });

  it('maps lifecycle to primary and secondary actions', () => {
    const running = presentMission(mission());
    expect(running.primaryAction).toEqual({ kind: 'pause', label: 'Pause mission' });
    expect(running.secondaryAction).toBeNull();
    expect(presentMission(mission({ state: 'paused' })).primaryAction).toEqual({
      kind: 'resume',
      label: 'Resume mission…',
    });
    expect(presentMission(mission({ state: 'completed' })).primaryAction).toEqual({
      kind: 'view_evidence',
      label: 'View evidence…',
    });
    expect(presentMission(mission({ state: 'cancelled' })).primaryAction).toBeNull();
  });

  it('waiting beats paused', () => {
    const result = presentMission(
      mission({
        state: 'paused',
        workItems: [workItem({ state: 'waiting', reasonCode: 'WORKER_AUTHORITY_REQUIRED' })],
      }),
    );
    expect(result.lifecycleLabel).toBe('Waiting for you');
    expect(result.attention).toBe('decision');
    expect(result.attentionLabel).toBe('Needs your decision');
    expect(result.attentionSummary).toBe('Verify the result');
    expect(result.primaryAction).toEqual({ kind: 'review', label: 'Review choices…' });
    expect(result.secondaryAction).toEqual({ kind: 'resume', label: 'Resume mission…' });
    expect(result.course[0]).toMatchObject({
      state: 'waiting',
      summary: 'The worker needs your decision before continuing.',
      action: { kind: 'review' },
    });
    expect(result.strip.execution).toBe('Waiting for your decision');
    expect(result.strip.decisionsPending).toBe(1);
  });

  it('uncertain beats waiting and never offers retry', () => {
    const result = presentMission(
      mission({
        state: 'paused',
        workItems: [workItem({ state: 'waiting' })],
        attempts: [{ ...unknownAttempt(), workItemId }],
      }),
    );
    expect(result.lifecycleLabel).toBe('Outcome uncertain');
    expect(result.attention).toBe('uncertain');
    expect(result.primaryAction).toEqual({ kind: 'inspect', label: 'Inspect evidence…' });
    expect(result.course[0]).toMatchObject({ state: 'uncertain', action: { kind: 'inspect' } });
    expect(JSON.stringify(result)).not.toMatch(/retry/i);
    expect(result.strip.execution).toBe('Held with uncertain outcome');
  });

  it('recovery and completed keep their labels', () => {
    expect(presentMission(mission({ state: 'recovery_required' }))).toMatchObject({
      lifecycleLabel: 'Recovery required',
      attention: 'recovery',
      attentionLabel: 'Recovery required',
      primaryAction: { kind: 'inspect' },
      strip: { execution: 'Recovery required' },
    });
    expect(presentMission(mission({ state: 'completed' })).strip.execution).toBe('Completed');
  });

  it('numbers course nodes in creation order and maps every work state', () => {
    const states: Array<[SupervisorWorkView['state'], CourseNodeState]> = [
      ['blocked', 'queued'],
      ['ready', 'queued'],
      ['assigned', 'current'],
      ['running', 'current'],
      ['waiting', 'waiting'],
      ['escalated', 'waiting'],
      ['failed', 'held'],
      ['cancelled', 'held'],
    ];
    const items = states.map(([state], index) =>
      workItem({
        id: `00000000-0000-4000-8000-0000000000${(10 + index).toString(16).padStart(2, '0')}`,
        state,
        createdAt: `2026-09-01T12:00:${index.toString().padStart(2, '0')}.000Z`,
      }),
    );
    const course = presentMission(mission({ workItems: items })).course;
    course.forEach((node, index) => {
      expect(node.index).toBe(index + 1);
      expect(node.state).toBe(states[index]![1]);
    });
  });

  it('marks completed work verified only with retained evidence and exposes the result', () => {
    const done = workItem({ state: 'completed' });
    const verified = presentMission(mission({ workItems: [done], attempts: [evidenced()] }));
    expect(verified.course[0]).toMatchObject({ state: 'verified', action: null });
    expect(verified.verifiedResult).toEqual({
      explanation: 'Done with a report.',
      evidence: ['artifact · report.md'],
    });
    const held = presentMission(mission({ workItems: [done] }));
    expect(held.course[0]).toMatchObject({ state: 'held' });
    expect(held.verifiedResult).toBeNull();
  });

  it('offers a terminal only for a live assigned session', () => {
    const live = presentMission(mission({ workItems: [workItem()] }), {
      liveSessionIds: new Set([sessionId]),
    });
    expect(live.course[0]!.action).toEqual({
      kind: 'open_terminal',
      sessionId,
      label: 'Open terminal',
    });
    expect(presentMission(mission({ workItems: [workItem()] })).course[0]!.action).toBeNull();
  });

  it('never leaks a reason code into any string', () => {
    const result = presentMission(
      mission({
        workItems: [
          workItem({ state: 'failed', reasonCode: 'WORKER_START_FAILED_BEFORE_EFFECT' }),
        ],
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
  });

  it('counts attached sessions from distinct bound session ids', () => {
    const envelope = {
      objective: 'Ship it.',
      bindings: [
        { sessionId, role: 'supervisor' },
        { sessionId, role: 'worker' },
        { sessionId: null, role: 'worker' },
      ],
    } as unknown as MissionDetailView['envelope'];
    expect(presentMission(mission({ envelope })).strip.sessionsAttached).toBe(1);
  });
});
```

Add `SupervisorWorkView` and `CourseNodeState` to the imports (`CourseNodeState` from the presentation module).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/renderer/mission-presentation.test.ts`
Expected: FAIL (types and fields missing).

- [ ] **Step 3: Rewrite the presentation module**

```ts
// apps/desktop/src/renderer/features/mission-focus/mission-presentation.ts
import type {
  MissionDetailView,
  SupervisorAttemptView,
  SupervisorWorkView,
} from '@threadhelm/contracts';
import { reasonLabel } from './reason-labels.js';

export type MissionAttention = 'none' | 'decision' | 'recovery' | 'uncertain';
export type CourseNodeState = 'verified' | 'current' | 'queued' | 'waiting' | 'uncertain' | 'held';
export type ActionKind = 'pause' | 'resume' | 'review' | 'inspect' | 'view_evidence';
export interface ActionSpec {
  kind: ActionKind;
  label: string;
}
export type NodeAction =
  | { kind: 'open_terminal'; sessionId: string; label: 'Open terminal' }
  | { kind: 'review'; label: 'Review choices…' }
  | { kind: 'inspect'; label: 'Inspect evidence…' };
export interface CourseNode {
  id: string;
  index: number;
  title: string;
  state: CourseNodeState;
  summary: string;
  action: NodeAction | null;
}
export interface MissionPresentation {
  title: string;
  objective: string | null;
  lifecycleLabel: string;
  attention: MissionAttention;
  attentionLabel: string | null;
  attentionSummary: string | null;
  primaryAction: ActionSpec | null;
  secondaryAction: ActionSpec | null;
  strip: { execution: string; decisionsPending: number; sessionsAttached: number };
  course: CourseNode[];
  verifiedResult: { explanation: string; evidence: string[] } | null;
}
export interface PresentationContext {
  liveSessionIds: ReadonlySet<string>;
}

/** Pause acts directly; the others open the detail dialog, so they end with an ellipsis. */
export const ACTION_LABELS: Record<ActionKind, string> = {
  pause: 'Pause mission',
  resume: 'Resume mission…',
  review: 'Review choices…',
  inspect: 'Inspect evidence…',
  view_evidence: 'View evidence…',
};

const action = (kind: ActionKind): ActionSpec => ({ kind, label: ACTION_LABELS[kind] });

/** First line of the objective, clipped for headings; the id only when content is gone. */
export function missionTitle(objective: string | null | undefined, id: string): string {
  const first = objective?.split('\n')[0]?.trim();
  if (!first) return `Mission ${id.slice(0, 8)}`;
  return first.length > 80 ? `${first.slice(0, 79).trimEnd()}…` : first;
}

const lifecycleLabels: Record<MissionDetailView['state'], string> = {
  running: 'Running',
  paused: 'Paused',
  recovery_required: 'Recovery required',
  completed: 'Completed',
  cancelled: 'Cancelled',
  deleted: 'Deleted',
};

const attentionLabels: Record<Exclude<MissionAttention, 'none'>, string> = {
  decision: 'Needs your decision',
  uncertain: 'Outcome uncertain',
  recovery: 'Recovery required',
};

function latestAttempt(workItemId: string, attempts: SupervisorAttemptView[]) {
  return attempts
    .filter((attempt) => attempt.workItemId === workItemId)
    .sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
}

function hasRetainedEvidence(workItemId: string, attempts: SupervisorAttemptView[]): boolean {
  return attempts.some(
    (attempt) =>
      attempt.workItemId === workItemId &&
      attempt.state === 'completed' &&
      attempt.evidenceRefs.length > 0,
  );
}

function nodeState(workItem: SupervisorWorkView, attempts: SupervisorAttemptView[]): CourseNodeState {
  if (latestAttempt(workItem.id, attempts)?.state === 'unknown') return 'uncertain';
  switch (workItem.state) {
    case 'completed':
      return hasRetainedEvidence(workItem.id, attempts) ? 'verified' : 'held';
    case 'assigned':
    case 'running':
      return 'current';
    case 'blocked':
    case 'ready':
      return 'queued';
    case 'waiting':
    case 'escalated':
      return 'waiting';
    case 'failed':
    case 'cancelled':
      return 'held';
  }
}

function nodeSummary(workItem: SupervisorWorkView, state: CourseNodeState): string {
  if (state === 'uncertain') return 'The outcome is unknown; retained evidence is kept as it is.';
  if (state === 'verified') return 'Completed with retained evidence.';
  if (workItem.state === 'completed') return 'Completion is held because no retained evidence is referenced.';
  const reason = reasonLabel(workItem.reasonCode);
  if (reason) return reason;
  switch (state) {
    case 'current':
      return 'Work is running.';
    case 'queued':
      return workItem.state === 'blocked'
        ? `Waiting on ${workItem.dependencies.length} earlier step${workItem.dependencies.length === 1 ? '' : 's'}.`
        : 'Ready to start.';
    case 'waiting':
      return 'This step needs your decision before work continues.';
    case 'held':
      return workItem.state === 'cancelled' ? 'This step was cancelled.' : 'This step failed.';
  }
}

function nodeAction(
  workItem: SupervisorWorkView,
  state: CourseNodeState,
  context: PresentationContext,
): NodeAction | null {
  switch (state) {
    case 'current':
      return workItem.assignedSessionId && context.liveSessionIds.has(workItem.assignedSessionId)
        ? { kind: 'open_terminal', sessionId: workItem.assignedSessionId, label: 'Open terminal' }
        : null;
    case 'waiting':
      return { kind: 'review', label: 'Review choices…' };
    case 'uncertain':
    case 'held':
      return { kind: 'inspect', label: 'Inspect evidence…' };
    default:
      return null;
  }
}

function presentCourse(detail: MissionDetailView, context: PresentationContext): CourseNode[] {
  return [...detail.workItems]
    .sort((left, right) =>
      left.createdAt === right.createdAt
        ? left.id.localeCompare(right.id)
        : left.createdAt.localeCompare(right.createdAt),
    )
    .map((workItem, index) => {
      const state = nodeState(workItem, detail.attempts);
      return {
        id: workItem.id,
        index: index + 1,
        title: workItem.title ?? 'Work item content was deleted.',
        state,
        summary: nodeSummary(workItem, state),
        action: nodeAction(workItem, state, context),
      };
    });
}

function verifiedResult(detail: MissionDetailView): MissionPresentation['verifiedResult'] {
  const latest = [...detail.attempts]
    .filter((attempt) => attempt.state === 'completed' && attempt.evidenceRefs.length > 0)
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))[0];
  if (!latest) return null;
  return {
    explanation: latest.explanation ?? 'Completed work retained evidence.',
    evidence: latest.evidenceRefs.map((reference) => `${reference.kind} · ${reference.id}`),
  };
}

export function presentMission(
  detail: MissionDetailView,
  context: PresentationContext = { liveSessionIds: new Set() },
): MissionPresentation {
  const course = presentCourse(detail, context);
  const uncertain = course.some((node) => node.state === 'uncertain');
  const waitingNodes = course.filter((node) => node.state === 'waiting');
  const heldDecisions = detail.decisions.filter((decision) => decision.policyResult === 'held');
  const decisionsPending = waitingNodes.length + heldDecisions.length;

  const attention: MissionAttention = uncertain
    ? 'uncertain'
    : detail.state === 'recovery_required'
      ? 'recovery'
      : decisionsPending > 0
        ? 'decision'
        : 'none';

  const focusNode =
    course.find((node) => node.state === (attention === 'uncertain' ? 'uncertain' : 'waiting')) ??
    null;

  let lifecycleLabel = lifecycleLabels[detail.state];
  if (attention === 'uncertain') lifecycleLabel = 'Outcome uncertain';
  else if (attention === 'decision') lifecycleLabel = 'Waiting for you';

  let primaryAction: ActionSpec | null = null;
  let secondaryAction: ActionSpec | null = null;
  if (attention === 'uncertain' || attention === 'recovery') primaryAction = action('inspect');
  else if (attention === 'decision') primaryAction = action('review');
  else if (detail.state === 'running') primaryAction = action('pause');
  else if (detail.state === 'paused') primaryAction = action('resume');
  else if (detail.state === 'completed') primaryAction = action('view_evidence');
  if (attention !== 'none' && (detail.state === 'running' || detail.state === 'paused'))
    secondaryAction = action(detail.state === 'running' ? 'pause' : 'resume');

  const execution =
    attention === 'uncertain'
      ? 'Held with uncertain outcome'
      : attention === 'recovery'
        ? 'Recovery required'
        : attention === 'decision'
          ? 'Waiting for your decision'
          : detail.state === 'running'
            ? 'Work continues locally'
            : detail.state === 'paused'
              ? 'Paused by you'
              : lifecycleLabels[detail.state];

  const sessionsAttached = new Set(
    (detail.envelope?.bindings ?? []).flatMap((binding) =>
      binding.sessionId ? [binding.sessionId] : [],
    ),
  ).size;

  return {
    title: missionTitle(detail.envelope?.objective, detail.id),
    objective: detail.envelope?.objective ?? 'Mission content was deleted.',
    lifecycleLabel,
    attention,
    attentionLabel: attention === 'none' ? null : attentionLabels[attention],
    attentionSummary:
      attention === 'none'
        ? null
        : (focusNode?.title ?? reasonLabel(detail.reasonCode) ?? lifecycleLabel),
    primaryAction,
    secondaryAction,
    strip: { execution, decisionsPending, sessionsAttached },
    course,
    verifiedResult: verifiedResult(detail),
  };
}
```

- [ ] **Step 4: Thread live session ids through the hook**

In `useMissionWorkspace.ts`, replace the `presentation:` line in the returned object:

```ts
    presentation: detail
      ? presentMission(detail, { liveSessionIds: new Set(state.sessionOrder) })
      : null,
```

- [ ] **Step 5: Adapt the workspace and context to the new shape (minimal)**

In `MissionWorkspace.tsx` delete the local `actionLabels` map, change the prop `onPause(): void` to `onAction(kind: ActionKind): void` (import `type { ActionKind }` from `./mission-presentation.js`), and replace the header action block:

```tsx
        <div className="mission-action-row">
          {presentation.secondaryAction ? (
            <button type="button" onClick={() => onAction(presentation.secondaryAction!.kind)}>
              {presentation.secondaryAction.label}
            </button>
          ) : null}
          {presentation.primaryAction ? (
            <button
              type="button"
              className="primary"
              onClick={() => onAction(presentation.primaryAction!.kind)}
            >
              {presentation.primaryAction.label}
            </button>
          ) : null}
        </div>
```

In `App.tsx` replace the `onPause={...}` prop with:

```tsx
              onAction={(kind) => {
                const missionId = state.selectedMissionId;
                if (!missionId) return;
                if (kind === 'pause') {
                  void call(api.missions.pause({ missionId })).catch((cause) =>
                    actions.setNotice(`Pausing the mission failed (${errorCode(cause)}).`),
                  );
                  return;
                }
                setDetailMissionId(missionId);
              }}
```

In `MissionContext.tsx` change `{presentation?.attention ?? 'none'}` to `{presentation?.attentionLabel ?? 'None'}`. In `MissionResult.tsx`, change the prop to `result: MissionPresentation['verifiedResult']` and render `result.explanation` and `result.evidence.join(', ')`; in `MissionWorkspace.tsx` pass `result={presentation.verifiedResult}`.

- [ ] **Step 6: Run unit, typecheck, lint**

Run: `pnpm test:unit -- tests/unit/renderer && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Update the existing e2e text expectations and run**

In `tests/e2e/mission-focus-workspace.spec.ts`, in the five-state test:
- `select(waiting)`: replace `getByText('decision', { exact: true })` with `getByText('Needs your decision', { exact: true })` and add `await expect(app.page.getByRole('button', { name: 'Review choices…', exact: true })).toBeVisible();`
- `select(uncertain)`: replace `getByText('uncertain', ...)` with `getByText('Outcome uncertain', { exact: true })` and the button name `'Inspect mission…'` with `'Inspect evidence…'`; keep the retry absence check.
- Recovered mission: button name `'Inspect evidence…'`.

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts tests/e2e/supervisor-mission.spec.ts`
Expected: PASS (fix any other label references the run reports).

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/renderer tests/unit/renderer/mission-presentation.test.ts tests/e2e/mission-focus-workspace.spec.ts tests/e2e/supervisor-mission.spec.ts
git commit -m "feat: model mission attention, actions and course nodes in one presentation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

Open PR 2 here: `gh pr create --title "feat: Mission Focus presentation model (parity phase 2a)" --base main`.

---

### Task 7: Variant round for un-prototyped states

Disposable. No production imports. Deleted in Task 14.

**Files:**
- Create: `apps/desktop/src/renderer/prototypes/mission-focus-states/{NOTES.md,index.html,prototype.js,serve.mjs,styles.css}`
- Modify (after the pick): `docs/architecture/mission-focus-page-decisions.md`

- [ ] **Step 1: Restore the approved D prototype as the base**

```bash
mkdir -p apps/desktop/src/renderer/prototypes/mission-focus-states
for f in index.html prototype.js serve.mjs styles.css; do
  git show "7ef0ad5^:apps/desktop/src/renderer/prototypes/mission-focus/$f" > "apps/desktop/src/renderer/prototypes/mission-focus-states/$f"
done
```

In `serve.mjs` change the port to `4185` and the log line to `Mission Focus states prototype: http://127.0.0.1:4185/?state=waiting&variant=A`.

- [ ] **Step 2: Add state data and variant switching to `prototype.js`**

At the top of `prototype.js`, after the existing sample data, add:

```js
// PROTOTYPE ONLY — four mission states the approved D layout never rendered.
const missionStates = {
  waiting: {
    eyebrow: 'Waiting for you · local',
    strip: 'Waiting for your decision',
    pending: 1,
    attention: { label: 'Needs your decision', summary: 'Set the boundary', action: 'Review choices…' },
    primary: 'Review choices…',
    secondary: 'Resume mission…',
    nodes: [
      { state: 'verified', title: 'Feature 002 merged', summary: 'Profile authoring and bounded supervisor missions.' },
      { state: 'waiting', title: 'Set the boundary', summary: 'The worker needs your decision before continuing.', action: 'Review choices…' },
      { state: 'queued', title: 'Write the specification', summary: 'Waiting on 1 earlier step.' },
    ],
  },
  uncertain: {
    eyebrow: 'Outcome uncertain · local',
    strip: 'Held with uncertain outcome',
    pending: 0,
    attention: { label: 'Outcome uncertain', summary: 'Set the boundary', action: 'Inspect evidence…' },
    primary: 'Inspect evidence…',
    secondary: 'Resume mission…',
    nodes: [
      { state: 'verified', title: 'Feature 002 merged', summary: 'Profile authoring and bounded supervisor missions.' },
      { state: 'uncertain', title: 'Set the boundary', summary: 'The outcome is unknown; retained evidence is kept as it is.', action: 'Inspect evidence…' },
      { state: 'queued', title: 'Write the specification', summary: 'Waiting on 1 earlier step.' },
    ],
  },
  recovery: {
    eyebrow: 'Recovery required · local',
    strip: 'Recovery required',
    pending: 0,
    attention: { label: 'Recovery required', summary: 'ThreadHelm restarted and could not confirm this work.', action: 'Inspect evidence…' },
    primary: 'Inspect evidence…',
    secondary: null,
    nodes: [
      { state: 'verified', title: 'Feature 002 merged', summary: 'Profile authoring and bounded supervisor missions.' },
      { state: 'held', title: 'Set the boundary', summary: 'ThreadHelm restarted and could not confirm this work.', action: 'Inspect evidence…' },
      { state: 'queued', title: 'Write the specification', summary: 'Waiting on 1 earlier step.' },
    ],
  },
  completed: {
    eyebrow: 'Completed · local',
    strip: 'Completed',
    pending: 0,
    attention: null,
    primary: 'View evidence…',
    secondary: null,
    nodes: [
      { state: 'verified', title: 'Feature 002 merged', summary: 'Profile authoring and bounded supervisor missions.' },
      { state: 'verified', title: 'Set the boundary', summary: 'Completed with retained evidence.' },
      { state: 'verified', title: 'Write the specification', summary: 'Completed with retained evidence.' },
    ],
  },
};
const stateParam = new URLSearchParams(location.search).get('state');
const missionState = missionStates[stateParam] ?? missionStates.waiting;
const stateVariant = ['A', 'B', 'C'].includes(new URLSearchParams(location.search).get('variant')?.toUpperCase())
  ? new URLSearchParams(location.search).get('variant').toUpperCase()
  : 'A';
```

Then locate the function that renders the D variant's workspace header (search `Continue mission` in the file) and wrap it so the three variants differ only in the header block:

```js
function renderStateHeader() {
  const attention = missionState.attention;
  const actions = `
    <div class="mission-action-row">
      ${missionState.secondary ? `<button type="button">${missionState.secondary}</button>` : ''}
      <button type="button" class="primary">${missionState.primary}</button>
    </div>`;
  const objective = `<p class="objective">Define the next verified coordination slice without weakening local authority.</p>`;
  if (stateVariant === 'B' && attention) {
    // B — Attention band under the header.
    return `
      <p class="eyebrow">${missionState.eyebrow}</p>
      <h1>Prepare Feature 003</h1>
      ${objective}${actions}
      <div class="attention-band" data-attention>
        <span class="eyebrow">${attention.label}</span>
        <strong>${attention.summary}</strong>
        <button type="button" class="primary">${attention.action}</button>
      </div>`;
  }
  if (stateVariant === 'C' && attention) {
    // C — Decision node takes the header: node title replaces the objective.
    return `
      <p class="eyebrow">${missionState.eyebrow}</p>
      <h1>Prepare Feature 003</h1>
      <p class="objective decision-line"><span class="eyebrow">${attention.label}</span> ${attention.summary}</p>
      ${actions}`;
  }
  // A — Same layout, state-tinted: only eyebrow, strip, node and rail change.
  return `
    <p class="eyebrow">${missionState.eyebrow}</p>
    <h1>Prepare Feature 003</h1>
    ${objective}${actions}`;
}
```

Replace the D header markup with `${renderStateHeader()}`, replace the D course nodes with a loop over `missionState.nodes` (state label, title, summary, optional action button), replace the strip text with `missionState.strip` and `${missionState.pending} decision${missionState.pending === 1 ? '' : 's'} pending`, and render the context rail's first section from `missionState.attention` (omit when null). Add a keyboard-switchable control bar (buttons for `state` × `variant`) that writes the URL and re-renders, reusing the existing variant switcher's pattern.

- [ ] **Step 3: Add the state styles**

Append to `styles.css`:

```css
.attention-band { display: grid; grid-template-columns: 1fr auto; gap: 0.25rem 1rem; align-items: center; margin-top: 1rem; padding: 0.9rem 1.1rem; border-left: 0.3rem solid var(--copper); background: color-mix(in srgb, var(--copper) 10%, white); }
.attention-band .eyebrow { grid-column: 1; }
.attention-band strong { grid-column: 1; }
.attention-band button { grid-column: 2; grid-row: 1 / span 2; }
.decision-line { border-left: 0.3rem solid var(--copper); padding-left: 0.75rem; }
.course-node[data-state='waiting'] .node-mark { border-color: var(--copper); }
.course-node[data-state='waiting'] .node-mark::after { content: '❚❚'; font-size: 0.6rem; }
.course-node[data-state='uncertain'] .node-mark { border-color: var(--copper); }
.course-node[data-state='uncertain'] .node-mark::after { content: '?'; }
.course-node[data-state='held'] .node-mark { border-color: var(--ink); }
.course-node[data-state='held'] .node-mark::after { content: '–'; }
```

Use the existing prototype's variable names if they differ from `--copper` / `--ink` (check the top of `styles.css`).

- [ ] **Step 4: Write NOTES.md**

```md
# Mission Focus state prototype

- Question: how should waiting-for-owner, uncertain, recovery-required, and completed missions
  look inside the approved D — Mission Course layout?
- Variants: A — same layout, state-tinted; B — attention band under the header;
  C — decision node takes the header line.
- States: `?state=waiting|uncertain|recovery|completed`, `?variant=A|B|C`.
- Review URLs: `http://127.0.0.1:4185/?state=waiting&variant=A` (and B, C).
- Production status: no prototype code is production code. Delete before the phase-2 PR merges.
```

- [ ] **Step 5: Serve, screenshot, present to the owner**

```bash
node apps/desktop/src/renderer/prototypes/mission-focus-states/serve.mjs
```

Capture the 12 combinations (4 states × 3 variants) at 1400×860 and present them side by side. Ask the owner to pick one variant (one letter for all four states, or per state if they insist).

- [ ] **Step 6: Record the decision**

Append to `docs/architecture/mission-focus-page-decisions.md`:

```md
## Mission Course states

**Selected: <letter> — <name>.** Applies to waiting-for-owner, uncertain, recovery-required, and
completed missions inside the approved D — Mission Course layout. Reason codes never appear;
each state carries a text label in the eyebrow, the strip, the affected node, and the context rail.
```

- [ ] **Step 7: Commit the decision only (prototype stays uncommitted)**

```bash
git add docs/architecture/mission-focus-page-decisions.md
git commit -m "docs: record the Mission Course state variant decision

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

Do not `git add` the prototype directory. Add `apps/desktop/src/renderer/prototypes/` to `.git/info/exclude` for the duration.

---

### Task 8: Workspace layout: action row, strip, course header, summary grid

**Files:**
- Create: `apps/desktop/src/renderer/features/mission-focus/MissionStrip.tsx`
- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionWorkspace.tsx`
- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionResult.tsx`
- Modify: `apps/desktop/src/renderer/styles/mission-focus.css`
- Test: `tests/e2e/mission-focus-workspace.spec.ts`

**Interfaces:**
- Consumes: `MissionPresentation` from Task 6.
- Produces: `MissionWorkspace` props `{ workspace, onCreate, onOpenDetail, onAction(kind: ActionKind), onOpenTerminal(sessionId: string) }`.

- [ ] **Step 1: Write the failing e2e assertions**

In the five-state test after `await select(running);`:

```ts
    const strip = app.page.getByRole('list', { name: 'Mission status' });
    await expect(strip).toContainText('Work continues locally');
    await expect(strip).toContainText('0 decisions pending');
    await expect(strip).toContainText('2 sessions attached');
    await expect(app.page.getByRole('button', { name: 'View full history…' })).toBeVisible();
    await expect(app.page.getByText('No verified result yet.')).toBeVisible();
    await expect(app.page.getByRole('heading', { name: 'Latest verified result' })).toHaveCount(0);
```

After `await select(completed);`:

```ts
    await expect(app.page.getByRole('heading', { name: 'Latest verified result' })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Open evidence…' })).toBeVisible();
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "honestly"`
Expected: FAIL on `Mission status` list.

- [ ] **Step 3: Create the strip**

```tsx
// apps/desktop/src/renderer/features/mission-focus/MissionStrip.tsx
import type { MissionPresentation } from './mission-presentation.js';

export function MissionStrip({
  strip,
  state,
}: {
  strip: MissionPresentation['strip'];
  state: string;
}) {
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  return (
    <ul className="mission-strip" aria-label="Mission status">
      <li>
        <span className="mission-state-shape" data-state={state} aria-hidden="true" />
        {strip.execution}
      </li>
      <li>{plural(strip.decisionsPending, 'decision')} pending</li>
      <li>{plural(strip.sessionsAttached, 'session')} attached</li>
    </ul>
  );
}
```

- [ ] **Step 4: Rewrite the result card**

```tsx
// apps/desktop/src/renderer/features/mission-focus/MissionResult.tsx
import type { MissionPresentation } from './mission-presentation.js';

export function MissionResult({
  result,
  onOpenDetail,
}: {
  result: NonNullable<MissionPresentation['verifiedResult']>;
  onOpenDetail(): void;
}) {
  return (
    <section className="mission-result" aria-labelledby="mission-result-heading">
      <h2 id="mission-result-heading">Latest verified result</h2>
      <p>{result.explanation}</p>
      <p className="mission-evidence">Evidence: {result.evidence.join(', ')}</p>
      <button type="button" className="small" onClick={onOpenDetail}>
        Open evidence…
      </button>
    </section>
  );
}
```

- [ ] **Step 5: Rewrite the workspace body**

Replace everything from `const { detail, presentation } = workspace;` to the end of `MissionWorkspace` with:

```tsx
  const { detail, presentation } = workspace;
  return (
    <article className="mission-workspace-content">
      <header className="mission-header">
        <div>
          <span className="mission-lifecycle">{presentation.lifecycleLabel} · local</span>
          <h1 tabIndex={-1}>{presentation.title}</h1>
          {presentation.objective && presentation.objective !== presentation.title ? (
            <p>{presentation.objective}</p>
          ) : null}
        </div>
        <div className="mission-action-row">
          {presentation.secondaryAction ? (
            <button type="button" onClick={() => onAction(presentation.secondaryAction!.kind)}>
              {presentation.secondaryAction.label}
            </button>
          ) : null}
          {presentation.primaryAction ? (
            <button
              type="button"
              className="primary"
              onClick={() => onAction(presentation.primaryAction!.kind)}
            >
              {presentation.primaryAction.label}
            </button>
          ) : null}
        </div>
      </header>
      <MissionStrip strip={presentation.strip} state={detail.state} />
      <MissionCourse
        course={presentation.course}
        onOpenDetail={onOpenDetail}
        onOpenTerminal={onOpenTerminal}
      />
      {presentation.verifiedResult ? null : (
        <p className="mission-result-note">No verified result yet.</p>
      )}
      <div className="mission-summary-grid">
        {presentation.verifiedResult ? (
          <MissionResult result={presentation.verifiedResult} onOpenDetail={onOpenDetail} />
        ) : null}
        <MissionSessionSummary detail={detail} />
      </div>
    </article>
  );
```

Add `onOpenTerminal(sessionId: string): void` to the props and import `MissionStrip`. `MissionCourse` gets its new props in Task 9; for this task, temporarily keep `<MissionCourse course={presentation.course} />` and add the history button inside `MissionCourse` in Task 9. To keep the strip test green now, add the history button to the header action row temporarily: `<button type="button" className="small" onClick={onOpenDetail}>View full history…</button>` (moved in Task 9).

In `App.tsx` add:

```tsx
              onOpenTerminal={(sessionId) => {
                actions.select(sessionId);
                actions.selectDestination('sessions');
              }}
```

- [ ] **Step 6: Styles**

Append to `mission-focus.css`:

```css
.mission-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: end;
  max-width: none;
}
.mission-action-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.mission-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 1.25rem 0 0;
  padding: 0.5rem 0;
  list-style: none;
  border-top: 1px solid color-mix(in srgb, var(--mission-ink) 20%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--mission-ink) 20%, transparent);
  font-family: var(--mission-font-code);
  font-size: 0.8rem;
}
.mission-strip li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.mission-strip li + li {
  margin-left: auto;
}
.mission-strip li + li + li {
  margin-left: 0;
}
.mission-strip .mission-state-shape {
  margin-top: 0;
}
.mission-result-note {
  margin: 0.75rem 0 0;
  color: color-mix(in srgb, var(--mission-ink) 65%, white);
  font-size: 0.9rem;
}
.mission-result {
  border-left: 0.3rem solid var(--mission-steel);
}
@container workspace (max-width: 44rem) {
  .mission-header {
    grid-template-columns: minmax(0, 1fr);
  }
  .mission-action-row {
    justify-content: flex-start;
  }
}
```

- [ ] **Step 7: Run e2e, typecheck, lint**

Run: `pnpm typecheck && pnpm lint && pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/renderer tests/e2e/mission-focus-workspace.spec.ts
git commit -m "feat: add the mission status strip, action row and verified-result card

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 9: Course line with numbered nodes and actions

**Files:**
- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionCourse.tsx` (rewrite)
- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionWorkspace.tsx` (remove temporary history button, pass props)
- Modify: `apps/desktop/src/renderer/styles/mission-focus.css`
- Test: `tests/e2e/mission-focus-workspace.spec.ts`

**Interfaces:**
- Produces: `MissionCourse({ course: CourseNode[]; onOpenDetail(): void; onOpenTerminal(sessionId: string): void })`.

- [ ] **Step 1: Write the failing e2e assertions**

In the five-state test after `await select(running);` (after the strip checks):

```ts
    const course = app.page.getByRole('list', { name: 'Mission course' });
    const node = course.getByRole('listitem').first();
    await expect(node).toContainText('1');
    await expect(node).toContainText('In focus');
    await expect(node.getByRole('button', { name: 'Open terminal' })).toBeVisible();
```

After `await select(waiting);`:

```ts
    await expect(
      app.page.getByRole('list', { name: 'Mission course' }).getByRole('button', {
        name: 'Review choices…',
      }),
    ).toBeVisible();
```

After `await select(completed);`:

```ts
    await expect(
      app.page.getByRole('list', { name: 'Mission course' }).getByText('Verified', { exact: true }),
    ).toBeVisible();
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "honestly"`
Expected: FAIL on `In focus`.

- [ ] **Step 3: Rewrite the course**

```tsx
// apps/desktop/src/renderer/features/mission-focus/MissionCourse.tsx
import type { CourseNode, CourseNodeState } from './mission-presentation.js';

const stateLabel: Record<CourseNodeState, string> = {
  verified: 'Verified',
  current: 'In focus',
  queued: 'Queued',
  waiting: 'Waiting for you',
  uncertain: 'Uncertain',
  held: 'Held',
};

const stateGlyph: Record<CourseNodeState, string | null> = {
  verified: '✓',
  current: null,
  queued: null,
  waiting: '❚❚',
  uncertain: '?',
  held: '–',
};

export function MissionCourse({
  course,
  onOpenDetail,
  onOpenTerminal,
}: {
  course: CourseNode[];
  onOpenDetail(): void;
  onOpenTerminal(sessionId: string): void;
}) {
  return (
    <section className="mission-course" aria-labelledby="mission-course-heading">
      <div className="mission-course-header">
        <h2 id="mission-course-heading">Mission course</h2>
        <button type="button" className="small" onClick={onOpenDetail}>
          View full history…
        </button>
      </div>
      {course.length === 0 ? <p>No work has been decomposed yet.</p> : null}
      <ol className="mission-course-line" aria-label="Mission course">
        {course.map((node) => (
          <li key={node.id} className="course-node" data-state={node.state}>
            <span className="node-mark" aria-hidden="true">
              {stateGlyph[node.state] ?? node.index}
            </span>
            <span className="course-state">{stateLabel[node.state]}</span>
            <strong>{node.title}</strong>
            <p>{node.summary}</p>
            {node.action ? (
              <button
                type="button"
                className="small"
                onClick={() =>
                  node.action!.kind === 'open_terminal'
                    ? onOpenTerminal(node.action!.sessionId)
                    : onOpenDetail()
                }
              >
                {node.action.label}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

In `MissionWorkspace.tsx` remove the temporary history button and pass `onOpenDetail` and `onOpenTerminal` to `MissionCourse`.

- [ ] **Step 4: Styles**

Replace the `.mission-course ol`, `.mission-course li[data-state=…]` rules in `mission-focus.css` and drop `.mission-course li` from the shared card selector list; add:

```css
.mission-course-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}
.mission-course-line {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 1.5rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}
.course-node {
  position: relative;
  display: grid;
  gap: 0.2rem;
  padding-top: 3rem;
}
.course-node::before {
  content: '';
  position: absolute;
  top: 1.1rem;
  left: 2.4rem;
  right: -1.5rem;
  height: 2px;
  background: color-mix(in srgb, var(--mission-ink) 25%, transparent);
}
.course-node:last-child::before {
  display: none;
}
.node-mark {
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 2px solid var(--mission-steel);
  border-radius: 50%;
  background: #fff;
  font: 650 0.95rem/1 var(--mission-font-heading);
}
.course-node[data-state='verified'] .node-mark {
  border-color: var(--mission-verdigris);
  background: var(--mission-verdigris);
  color: #fff;
}
.course-node[data-state='current'] .node-mark {
  border-color: var(--mission-copper);
  background: var(--mission-copper);
  color: #fff;
}
.course-node[data-state='waiting'] .node-mark,
.course-node[data-state='uncertain'] .node-mark {
  border-color: var(--mission-copper);
  color: var(--mission-copper);
  font-size: 0.7rem;
}
.course-node[data-state='held'] .node-mark {
  border-color: var(--mission-ink);
}
.course-node strong {
  font-family: var(--mission-font-heading);
  font-size: 1.05rem;
}
.course-node p {
  margin: 0;
  font-size: 0.9rem;
}
.course-node button {
  justify-self: start;
  margin-top: 0.35rem;
}
@container workspace (max-width: 44rem) {
  .mission-course-line {
    grid-auto-flow: row;
    gap: 1rem;
  }
  .course-node {
    padding: 0 0 0 3rem;
  }
  .course-node::before {
    top: 2.4rem;
    bottom: -1rem;
    left: 1.1rem;
    right: auto;
    width: 2px;
    height: auto;
  }
}
@media (prefers-reduced-motion: no-preference) {
  .node-mark {
    transition: background-color 180ms ease, border-color 180ms ease;
  }
}
```

- [ ] **Step 5: Run e2e, typecheck, lint**

Run: `pnpm typecheck && pnpm lint && pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer tests/e2e/mission-focus-workspace.spec.ts
git commit -m "feat: render the Mission Course as a numbered outcome line with actions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 10: Decision-first context rail with crew rows

**Files:**
- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionContext.tsx` (rewrite)
- Modify: `apps/desktop/src/renderer/App.tsx` (pass `onAction`, recovery link)
- Modify: `apps/desktop/src/renderer/styles/mission-focus.css`
- Test: `tests/e2e/mission-focus-workspace.spec.ts`

**Interfaces:**
- Produces: `MissionContext({ detail, presentation, onAction(kind: ActionKind): void, onOpenAttention(): void })`.

- [ ] **Step 1: Write the failing e2e assertions**

After `await select(waiting);`:

```ts
    const rail = app.page.getByRole('complementary', { name: 'Mission context' });
    await expect(rail.locator('section').first()).toContainText('Needs your decision');
    await expect(rail.getByRole('button', { name: 'Review choices…' })).toBeVisible();
    await expect(rail.getByRole('list', { name: 'Crew' }).getByRole('listitem')).toHaveCount(2);
    await expect(rail.getByRole('list', { name: 'Crew' })).toContainText('Supervisor');
    await expect(rail.getByRole('list', { name: 'Crew' })).toContainText('failed');
```

After the recovered-mission click at the end:

```ts
    await expect(
      app.page
        .getByRole('complementary', { name: 'Mission context' })
        .getByRole('button', { name: 'Open attention queue' }),
    ).toBeVisible();
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "honestly"`
Expected: FAIL on the Crew list.

- [ ] **Step 3: Rewrite the context**

```tsx
// apps/desktop/src/renderer/features/mission-focus/MissionContext.tsx
import type { MissionDetailView, SessionView } from '@threadhelm/contracts';
import { useStore } from '../../store.js';
import type { ActionKind, MissionPresentation } from './mission-presentation.js';

const roleLabel: Record<string, string> = {
  supervisor: 'Supervisor',
  worker: 'Worker',
  reviewer: 'Reviewer',
  triage: 'Triage',
};

function crewState(session: SessionView | undefined): string {
  if (!session) return 'not running';
  switch (session.lifecycleState) {
    case 'running':
      return 'working';
    case 'starting':
      return 'starting';
    case 'interrupting':
    case 'stopping':
      return 'stopping';
    case 'stopped':
      return 'stopped';
    case 'failed':
      return 'failed';
    case 'recovery_required':
      return 'recovery required';
  }
}

export function MissionContext({
  detail,
  presentation,
  onAction,
  onOpenAttention,
}: {
  detail: MissionDetailView | null;
  presentation: MissionPresentation | null;
  onAction(kind: ActionKind): void;
  onOpenAttention(): void;
}) {
  const { state } = useStore();
  const bindings = detail?.envelope?.bindings ?? [];
  return (
    <div className="mission-context-content">
      <h2>Mission context</h2>
      {presentation && presentation.attention !== 'none' ? (
        <section className="mission-decision" data-attention={presentation.attention}>
          <span className="context-label">{presentation.attentionLabel}</span>
          <strong>{presentation.attentionSummary}</strong>
          {presentation.attention === 'recovery' ? (
            <button type="button" className="primary" onClick={onOpenAttention}>
              Open attention queue
            </button>
          ) : presentation.primaryAction ? (
            <button
              type="button"
              className="primary"
              onClick={() => onAction(presentation.primaryAction!.kind)}
            >
              {presentation.primaryAction.label}
            </button>
          ) : null}
        </section>
      ) : null}
      <section>
        <span className="context-label">Crew</span>
        {bindings.length === 0 ? (
          <p>No crew is bound.</p>
        ) : (
          <ul className="mission-crew" aria-label="Crew">
            {bindings.map((binding) => {
              const session = binding.sessionId ? state.sessions[binding.sessionId] : undefined;
              return (
                <li key={binding.bindingId}>
                  <span className="crew-mark" aria-hidden="true">
                    {(roleLabel[binding.role] ?? binding.role).charAt(0)}
                  </span>
                  <span>
                    <strong>{roleLabel[binding.role] ?? binding.role}</strong>
                    <small>{session?.providerDisplayName ?? binding.providerId}</small>
                  </span>
                  <em>{crewState(session)}</em>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <span className="context-label">Authority</span>
        <p>Local coordinator · sole writer</p>
        <p>External actions · approval required</p>
      </section>
    </div>
  );
}
```

In `App.tsx` extract the action handler into a named function `runMissionAction(kind)` above the JSX (same body as Task 6's `onAction`) and pass it to both `MissionWorkspace` and `MissionContext`; pass `onOpenAttention={() => actions.selectDestination('attention')}`.

- [ ] **Step 4: Styles**

Append to `mission-focus.css`:

```css
.mission-decision {
  border-left: 0.3rem solid var(--mission-copper);
}
.mission-decision .context-label {
  color: var(--mission-copper);
}
.mission-decision button {
  margin-top: 0.5rem;
}
.mission-crew {
  display: grid;
  gap: 0.5rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}
.mission-crew li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.6rem;
  align-items: center;
}
.crew-mark {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: 50%;
  background: var(--mission-ink);
  color: #fff;
  font: 650 0.8rem/1 var(--mission-font-heading);
}
.mission-crew small {
  display: block;
  color: color-mix(in srgb, var(--mission-ink) 70%, white);
}
.mission-crew em {
  font-family: var(--mission-font-code);
  font-size: 0.75rem;
  font-style: normal;
  color: var(--mission-steel);
}
```

- [ ] **Step 5: Run e2e, typecheck, lint**

Run: `pnpm typecheck && pnpm lint && pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer tests/e2e/mission-focus-workspace.spec.ts
git commit -m "feat: put the pending decision first in the mission context rail

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 11: Rail progress line and nav badge counts

**Files:**
- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionRail.tsx` (row second line)
- Modify: `apps/desktop/src/renderer/features/shell/AppNavigation.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx` (pass counts)
- Modify: `apps/desktop/src/renderer/styles/shell.css`
- Test: `tests/e2e/mission-focus-workspace.spec.ts`

**Interfaces:**
- Produces: `AppNavigation({ selected, onSelect, counts: Partial<Record<WorkspaceDestination, number>> })`.

- [ ] **Step 1: Write the failing e2e assertions**

After `await select(completed);` add:

```ts
    await expect(
      list.getByRole('option', { name: new RegExp(completed.id.slice(0, 8), 'i') }),
    ).toContainText('1/1');
```

At the end after the recovered-mission checks:

```ts
    await expect(
      app.page.getByRole('button', { name: /^Attention, \d+ needing attention$/ }),
    ).toBeVisible();
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "honestly"`
Expected: FAIL on `1/1`.

- [ ] **Step 3: Rail second line**

In `MissionRail.tsx` replace the `<small>` content in the list item:

```tsx
                <small>
                  {mission.workItemCount > 0
                    ? `${mission.completedWorkItemCount}/${mission.workItemCount} · `
                    : ''}
                  {mission.state.replaceAll('_', ' ')} · {mission.id.slice(0, 8)}
                </small>
```

- [ ] **Step 4: Navigation counts**

```tsx
// apps/desktop/src/renderer/features/shell/AppNavigation.tsx
import type { WorkspaceDestination } from './navigation.js';

const destinations: ReadonlyArray<{ id: WorkspaceDestination; label: string; countNoun: string }> = [
  { id: 'missions', label: 'Missions', countNoun: '' },
  { id: 'sessions', label: 'Sessions', countNoun: 'with new output' },
  { id: 'agents', label: 'Agents', countNoun: '' },
  { id: 'templates', label: 'Templates', countNoun: '' },
  { id: 'memory', label: 'Memory', countNoun: '' },
  { id: 'attention', label: 'Attention', countNoun: 'needing attention' },
  { id: 'settings', label: 'Settings', countNoun: '' },
];

export interface AppNavigationProps {
  selected: WorkspaceDestination;
  counts?: Partial<Record<WorkspaceDestination, number>>;
  onSelect(destination: WorkspaceDestination): void;
}

export function AppNavigation({ selected, counts = {}, onSelect }: AppNavigationProps) {
  return (
    <div className="app-navigation" aria-label="Destinations">
      {destinations.map((destination) => {
        const count = counts[destination.id] ?? 0;
        return (
          <button
            key={destination.id}
            type="button"
            className={destination.id === selected ? 'selected' : undefined}
            aria-current={destination.id === selected ? 'page' : undefined}
            aria-label={
              count > 0 ? `${destination.label}, ${count} ${destination.countNoun}` : undefined
            }
            onClick={() => onSelect(destination.id)}
          >
            {destination.label}
            {count > 0 ? <span className="nav-count">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
```

In `App.tsx` pass:

```tsx
              counts={{
                sessions: Object.values(state.unread).filter(Boolean).length,
                attention: state.recoveryRecords.filter((record) => record.resolvedAt === null)
                  .length,
              }}
```

Append to `shell.css`:

```css
.app-navigation button {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}
.nav-count {
  min-width: 1.4rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--mission-copper);
  color: #fff;
  font: 650 0.72rem/1.4rem var(--mission-font-code);
  text-align: center;
}
```

- [ ] **Step 5: Run e2e, typecheck, lint**

Run: `pnpm typecheck && pnpm lint && pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts tests/e2e/accessibility.spec.ts`
Expected: PASS. If `accessibility.spec.ts` tabs to "Sessions" by name, the `aria-label` changes the accessible name only when a count exists; adjust its regex to `/^Sessions/` if needed.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer tests/e2e
git commit -m "feat: show mission progress in the rail and counts on destinations

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 12: Collapsed attention toggle at medium width (bug 1.4)

**Files:**
- Create: `apps/desktop/src/renderer/features/mission-focus/ContextToggle.tsx`
- Modify: `apps/desktop/src/renderer/features/shell/AppShell.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles/shell.css`
- Test: `tests/e2e/mission-focus-workspace.spec.ts` (remove `.fixme`)

**Interfaces:**
- Produces: `AppShell` gains `contextToggle: ReactNode | null` rendered at the top of the workspace column; `ContextToggle({ label, attention, children })` owns open state.

- [ ] **Step 1: Un-fixme the Task 4 test**

Change `test.fixme(` to `test(` for "medium windows keep an attention control when a decision waits".

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "medium windows"`
Expected: FAIL, no button matching `/needs your decision/i`.

- [ ] **Step 3: Create the toggle**

```tsx
// apps/desktop/src/renderer/features/mission-focus/ContextToggle.tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MissionAttention } from './mission-presentation.js';

export function ContextToggle({
  label,
  attention,
  children,
}: {
  label: string;
  attention: MissionAttention;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <div className="context-toggle">
      <button
        ref={button}
        type="button"
        className="small"
        aria-expanded={open}
        aria-controls="mission-context-overlay"
        data-attention={attention}
        onClick={() => setOpen((value) => !value)}
      >
        {attention !== 'none' ? <span className="attention-dot" aria-hidden="true" /> : null}
        {label}
      </button>
      {open ? (
        <div
          id="mission-context-overlay"
          className="context-overlay"
          role="dialog"
          aria-modal="false"
          aria-label="Mission context"
        >
          <button type="button" className="small context-overlay-close" onClick={close}>
            Close
          </button>
          {children}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Slot it into the shell**

In `AppShell.tsx` add `contextToggle: ReactNode | null` to the props and render it as the first child of `<main id="mission-workspace" …>`. In `App.tsx` build the context element once:

```tsx
  const contextContent = missionSelected ? (
    <MissionContext
      detail={workspace.detail}
      presentation={workspace.presentation}
      onAction={runMissionAction}
      onOpenAttention={() => actions.selectDestination('attention')}
    />
  ) : (
    <MissionContextFrame heading={destinationHeading[state.selectedDestination]}>
      <SetupAttentionSummary />
    </MissionContextFrame>
  );
```

Pass `context={contextContent}` and:

```tsx
        contextToggle={
          <ContextToggle
            label={workspace.presentation?.attentionLabel ?? 'Context'}
            attention={workspace.presentation?.attention ?? 'none'}
          >
            {contextContent}
          </ContextToggle>
        }
```

- [ ] **Step 5: Styles**

Append to `shell.css`:

```css
.context-toggle {
  display: none;
  position: relative;
  justify-content: flex-end;
  padding: 0.5rem 1rem 0;
}
.context-toggle .attention-dot {
  display: inline-block;
  width: 0.6rem;
  height: 0.6rem;
  margin-right: 0.4rem;
  border-radius: 50%;
  background: var(--mission-copper);
}
.context-overlay {
  position: absolute;
  top: 2.5rem;
  right: 1rem;
  z-index: 5;
  width: min(22rem, calc(100vw - 2rem));
  max-height: 70vh;
  overflow: auto;
  border: 1px solid color-mix(in srgb, var(--mission-ink) 30%, transparent);
  background: var(--mission-fog);
  box-shadow: 0 0.5rem 1.5rem rgba(24, 36, 44, 0.18);
}
.context-overlay-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}
@media (max-width: 980px) {
  .context-toggle {
    display: flex;
  }
}
```

The existing `@media (max-width: 980px) { .mission-shell-context { display: none; } }` stays.

- [ ] **Step 6: Run e2e, typecheck, lint**

Run: `pnpm typecheck && pnpm lint && pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts`
Expected: PASS including "medium windows".

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer tests/e2e/mission-focus-workspace.spec.ts
git commit -m "feat: keep an attention control when the context rail collapses

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 13: Live region announcements and keyboard order

**Files:**
- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionWorkspace.tsx`
- Test: `tests/e2e/mission-focus-workspace.spec.ts`, `tests/e2e/accessibility.spec.ts`

- [ ] **Step 1: Write the failing e2e assertions**

In the five-state test after `await select(waiting);`:

```ts
    await expect(app.page.getByRole('status').filter({ hasText: /Mission changed/ })).toContainText(
      'Mission changed: Waiting browser decision mission, Waiting for you',
    );
```

In `tests/e2e/accessibility.spec.ts`, inside the keyboard test after the app has a selected mission (find the section that tabs through the mission rail; if none exists add a step after launch), add:

```ts
    await tabTo(page, /^New mission…$/);
    await tabTo(page, /^Missions$/);
    await tabTo(page, /mission|Pause|Review|Inspect|View evidence/);
    await tabTo(page, /View full history…/);
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "honestly"`
Expected: FAIL on the status region.

- [ ] **Step 3: Add the live region**

In `MissionWorkspace.tsx` add near the top of the component (before early returns are fine since hooks must run unconditionally):

```tsx
  const [announcement, setAnnouncement] = useState('');
  const detailId = workspace.detail?.id ?? null;
  const attentionLabel = workspace.presentation?.attentionLabel ?? null;
  const lifecycle = workspace.presentation?.lifecycleLabel ?? null;
  const title = workspace.presentation?.title ?? null;
  const lastId = useRef<string | null>(null);
  const lastAttention = useRef<string | null>(null);
  useEffect(() => {
    if (!detailId || !title) return;
    if (detailId !== lastId.current) {
      lastId.current = detailId;
      lastAttention.current = attentionLabel;
      setAnnouncement(`Mission changed: ${title}, ${lifecycle}`);
    } else if (attentionLabel && attentionLabel !== lastAttention.current) {
      lastAttention.current = attentionLabel;
      setAnnouncement(attentionLabel);
    }
  }, [detailId, title, lifecycle, attentionLabel]);
```

Render inside `<article>` as the first child:

```tsx
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
```

Add to `mission-focus.css`:

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

Import `useEffect, useRef, useState` from react.

- [ ] **Step 4: Run e2e**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts tests/e2e/accessibility.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer tests/e2e
git commit -m "feat: announce mission and attention changes in a restrained live region

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 14: Apply the picked state variant and delete the prototype

**Files:**
- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionWorkspace.tsx` (header only)
- Modify: `apps/desktop/src/renderer/styles/mission-focus.css`
- Delete: `apps/desktop/src/renderer/prototypes/mission-focus-states/`
- Test: `tests/e2e/mission-focus-workspace.spec.ts`

Read the decision recorded in Task 7 and apply exactly one of the three blocks.

- [ ] **Step 1: Write the failing e2e assertion for the picked variant**

After `await select(waiting);`, add one of:

```ts
    // A — state-tinted: nothing new in the header; the strip and node carry the state.
    await expect(app.page.locator('.mission-header')).not.toContainText('Needs your decision');
```

```ts
    // B — attention band.
    await expect(app.page.locator('.attention-band')).toContainText('Needs your decision');
    await expect(app.page.locator('.attention-band').getByRole('button', { name: 'Review choices…' })).toBeVisible();
```

```ts
    // C — decision line replaces the objective.
    await expect(app.page.locator('.mission-header .decision-line')).toContainText('Needs your decision');
    await expect(app.page.locator('.mission-header .decision-line')).toContainText('Verify browser evidence');
```

- [ ] **Step 2: Run to verify it fails (B or C) or passes (A)**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts -g "honestly"`

- [ ] **Step 3: Implement the picked header**

For **A**: no change.

For **B**, in `MissionWorkspace.tsx` after `</header>` and before `<MissionStrip …>`:

```tsx
      {presentation.attention !== 'none' && presentation.primaryAction ? (
        <div className="attention-band" data-attention={presentation.attention}>
          <span className="context-label">{presentation.attentionLabel}</span>
          <strong>{presentation.attentionSummary}</strong>
          <button
            type="button"
            className="primary"
            onClick={() => onAction(presentation.primaryAction!.kind)}
          >
            {presentation.primaryAction.label}
          </button>
        </div>
      ) : null}
```

and remove the primary button from the header action row while a band shows (keep the secondary). CSS:

```css
.attention-band {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.2rem 1rem;
  align-items: center;
  margin-top: 1rem;
  padding: 0.9rem 1.1rem;
  border-left: 0.3rem solid var(--mission-copper);
  background: color-mix(in srgb, var(--mission-copper) 10%, white);
}
.attention-band .context-label { color: var(--mission-copper); }
.attention-band button { grid-column: 2; grid-row: 1 / span 2; }
```

For **C**, replace the objective paragraph in the header:

```tsx
          {presentation.attention !== 'none' ? (
            <p className="decision-line">
              <span className="context-label">{presentation.attentionLabel}</span>{' '}
              {presentation.attentionSummary}
            </p>
          ) : presentation.objective && presentation.objective !== presentation.title ? (
            <p>{presentation.objective}</p>
          ) : null}
```

CSS:

```css
.decision-line {
  border-left: 0.3rem solid var(--mission-copper);
  padding-left: 0.75rem;
}
.decision-line .context-label { color: var(--mission-copper); }
```

- [ ] **Step 4: Delete the prototype and its exclude entry**

```bash
rm -r apps/desktop/src/renderer/prototypes
```

Remove the `apps/desktop/src/renderer/prototypes/` line from `.git/info/exclude`. Verify `rtk proxy grep -rn "prototypes/" apps/desktop/src` returns nothing.

- [ ] **Step 5: Run the full local sequence**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm desktop:build && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A apps/desktop/src/renderer tests/e2e/mission-focus-workspace.spec.ts
git commit -m "feat: present waiting, uncertain, recovery and completed missions per the approved variant

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
```

---

### Task 15: No-code guard, opt-in parity screenshots, installed verification

**Files:**
- Test: `tests/e2e/mission-focus-workspace.spec.ts`
- Create: `tests/e2e/parity-screenshots.spec.ts`

- [ ] **Step 1: Add the no-reason-code guard to every state**

In the five-state test, inside the `select` helper after the focus assertion:

```ts
      const text = await app.page.locator('#mission-workspace, .mission-shell-context').allInnerTexts();
      expect(text.join('\n'), 'no raw reason code on screen').not.toMatch(/\b[A-Z]{3,}_[A-Z0-9_]+\b/);
```

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-focus-workspace.spec.ts`
Expected: PASS.

- [ ] **Step 2: Add the opt-in screenshot spec**

```ts
// tests/e2e/parity-screenshots.spec.ts
// Opt-in: PARITY_SHOTS=1 pnpm exec playwright test tests/e2e/parity-screenshots.spec.ts
// Writes artifacts/parity/*.png for design review. Skipped in the normal suite.
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import type { MissionDetailView, MissionEnvelopeInput, MissionPreviewView } from '@threadhelm/contracts';
import { launchApp, type LaunchedApp } from './helpers/app.js';
import { prepareFixtureMission } from './helpers/mission.js';
import { launchWithFixtures, teardown, tempWorkspace } from './helpers/ui.js';

const OUT = 'artifacts/parity';
test.skip(!process.env['PARITY_SHOTS'], 'set PARITY_SHOTS=1 to capture');

async function confirmMission(app: LaunchedApp, envelope: MissionEnvelopeInput, objective: string) {
  const preview = await app.call<MissionPreviewView>('missions.preview', { envelope: { ...envelope, objective } });
  return app.call<MissionDetailView>('missions.confirm', { previewToken: preview.previewToken, boundaryConfirmation: true });
}
async function assignWork(app: LaunchedApp, mission: MissionDetailView, disposition: 'completion' | 'unknown' | 'authority_required' | null) {
  const supervisorId = mission.supervisorSessionId!;
  const binding = mission.envelope!.bindings.find((item) => item.role === 'worker')!;
  const workItemId = randomUUID();
  const decision = { missionId: mission.id, rationale: 'Parity capture', inputRefs: [], expectedEvidence: 'A retained report' };
  await app.bridgeRequest(supervisorId, 'threadhelm_work_decompose', {
    ...decision, idempotencyKey: randomUUID(),
    items: [{ id: workItemId, parentWorkItemId: null, workspaceId: binding.workspaceId, title: 'Verify browser evidence', specification: 'Produce one bounded result.', acceptanceCriteria: 'Reference the report.', dependencies: [], authorityClass: 'routine' }],
  });
  await app.bridgeRequest(supervisorId, 'threadhelm_work_assign', { ...decision, idempotencyKey: randomUUID(), workItemId, bindingId: binding.bindingId });
  if (!disposition) return;
  const detail = await app.call<MissionDetailView>('missions.detail', { missionId: mission.id });
  const attempt = detail.attempts[0]!;
  await app.bridgeRequest(attempt.sessionId!, 'threadhelm_work_result', {
    missionId: mission.id, workItemId, attemptId: attempt.id, idempotencyKey: randomUUID(), disposition,
    explanation: disposition === 'completion' ? 'Done with a report.' : 'The worker stopped here.',
    evidenceRefs: disposition === 'completion' ? [{ kind: 'artifact', id: 'report.md' }] : [],
  });
  if (disposition === 'completion')
    await app.bridgeRequest(supervisorId, 'threadhelm_mission_complete', { ...decision, idempotencyKey: randomUUID(), evidenceRefs: [{ kind: 'work_item', id: workItemId }] });
}

test('capture parity screenshots', async () => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const shot = (app: LaunchedApp, name: string) => app.page.screenshot({ path: `${OUT}/${name}.png` });
  const nav = (app: LaunchedApp, label: string) => app.page.getByRole('button', { name: label, exact: true }).click();

  let app = await launchApp();
  await app.page.setViewportSize({ width: 1400, height: 860 });
  await expect(app.page.locator('.status-bar')).toContainText('ThreadHelm v');
  await shot(app, '01-missions-empty');
  for (const d of ['Sessions', 'Agents', 'Templates', 'Memory', 'Attention', 'Settings']) { await nav(app, d); await shot(app, `02-empty-${d.toLowerCase()}`); }
  await app.close();

  app = await launchWithFixtures({ 'codex-cli': 'echo' });
  await app.page.setViewportSize({ width: 1400, height: 860 });
  const directories: string[] = [];
  const envelope = async (tag: string) => { const pair = [tempWorkspace(`${tag}-leader`), tempWorkspace(`${tag}-worker`)]; directories.push(...pair); return prepareFixtureMission(app, pair); };
  try {
    const completed = await confirmMission(app, await envelope('done'), 'Ship cited release notes for v0.3'); await assignWork(app, completed, 'completion');
    const uncertain = await confirmMission(app, await envelope('unk'), 'Migrate config loader to schema v2'); await assignWork(app, uncertain, 'unknown');
    const waiting = await confirmMission(app, await envelope('wait'), 'Audit auth middleware token expiry'); await assignWork(app, waiting, 'authority_required');
    const running = await confirmMission(app, await envelope('run'), 'Refactor session stream backpressure'); await assignWork(app, running, null);
    const list = app.page.getByRole('listbox', { name: 'Missions', exact: true });
    const select = async (m: MissionDetailView) => { await list.getByRole('option', { name: new RegExp(m.id.slice(0, 8), 'i') }).click(); await app.page.waitForTimeout(300); };
    for (const [name, m] of [['10-mission-running', running], ['11-mission-waiting', waiting], ['12-mission-uncertain', uncertain], ['13-mission-completed', completed]] as const) { await select(m); await shot(app, name); }
    await select(running);
    for (const d of ['Sessions', 'Agents', 'Memory', 'Settings', 'Attention']) { await nav(app, d); await shot(app, `20-${d.toLowerCase()}`); }
    await nav(app, 'Missions'); await select(waiting);
    await app.page.setViewportSize({ width: 960, height: 800 }); await shot(app, '30-medium-waiting');
    await app.page.setViewportSize({ width: 680, height: 800 }); await shot(app, '31-narrow-waiting');
    await app.page.setViewportSize({ width: 1400, height: 860 });
    const userData = app.userData; await app.crashCoordinator();
    app = await launchWithFixtures({ 'codex-cli': 'echo' }, userData);
    await app.page.setViewportSize({ width: 1400, height: 860 });
    await app.page.getByRole('listbox', { name: 'Missions', exact: true }).getByRole('option').filter({ hasText: 'recovery required' }).first().click();
    await shot(app, '17-mission-recovery');
    await nav(app, 'Attention'); await shot(app, '25-attention-populated');
  } finally {
    await teardown(app, ...directories);
  }
});
```

Add `artifacts/` to `.gitignore` if not present.

Run: `PARITY_SHOTS=1 pnpm exec playwright test tests/e2e/parity-screenshots.spec.ts` (PowerShell: `$env:PARITY_SHOTS='1'; pnpm exec playwright test tests/e2e/parity-screenshots.spec.ts`)
Expected: PASS, PNGs under `artifacts/parity/`. Open `11-mission-waiting.png`, `12-mission-uncertain.png`, `17-mission-recovery.png`, `13-mission-completed.png`, `30-medium-waiting.png` and compare against the audit and the recovered prototype; fix any visible regression before continuing.

- [ ] **Step 3: Installed-app run**

Run: `pnpm package:win && pnpm test:acceptance:installed`
Expected: PASS. If the installed run cannot be executed on this machine, record that as a blocker in the PR description; do not mark the phase complete.

- [ ] **Step 4: Commit and open PR 3**

```bash
git add tests/e2e/parity-screenshots.spec.ts tests/e2e/mission-focus-workspace.spec.ts .gitignore
git commit -m "test: guard against reason codes on screen and add opt-in parity screenshots

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RSSo6ULod8jfAhiGutfKz"
gh pr create --title "feat: Mission Focus workspace to approved direction (parity phase 2b)" --base main
```

PR body lists: prototype decision reference, the e2e specs run, the installed-app result, and the five screenshots from Step 2 attached.

---

## Self-review

**Spec coverage.** 1.1 → Task 1. 1.2 → Task 2. 1.3 → Task 3. 1.4 → Tasks 4 + 12. 2.1 → Tasks 5, 6. 2.2 → Tasks 8, 9. 2.3 → Task 10. 2.4 → Task 11. 2.5 → Task 12. 2.6 → Tasks 7, 14. 2.7 → Tasks 9 (reduced motion), 13. Testing section → unit in 5, 6; e2e across 1–15; no-code guard in 15; installed run in 15. Dock-switch decision is recorded in the spec and belongs to phase 3; no task here.

**Type consistency.** `ActionKind`, `ActionSpec`, `NodeAction`, `CourseNode`, `MissionPresentation`, `PresentationContext`, `ACTION_LABELS` are defined once in Task 6 and consumed by name in Tasks 8–14. `MissionWorkspace` prop names `onAction`, `onOpenDetail`, `onOpenTerminal`, `onCreate` match between Tasks 6, 8, 9. `MissionContext` props `onAction`, `onOpenAttention` match Tasks 10 and 12. `runMissionAction` is introduced in Task 10 and reused in Task 12.

**Placeholders.** None. Task 14 offers three concrete alternatives keyed to the recorded decision rather than a blank.
