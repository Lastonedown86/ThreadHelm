# Repo-Idea Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Pick a repo" screen before the guided mission composer's Outcome stage that generates 3 AI-suggested mission ideas for an approved workspace and lets the user pick one to pre-fill Outcome, or skip straight to a blank draft.

**Architecture:** A new main-owned operation, `missionComposer.proposeRepoIdeas`, assembles a bounded prompt from Plan A's repo-metadata readers (file tree, README, manifest, commit subjects) and sends it through Plan A's `runStructuredDraft`, then validates the returned text as exactly 3 typed candidates. It touches no composer draft — nothing is persisted until the renderer commits a chosen idea's text into a freshly created draft via the existing `missionComposer.updateDraft`. The renderer gains one new top-level screen, mounted in `App.tsx` before `MissionComposerWorkspace`, that never becomes part of the composer's own stage strip.

**Tech Stack:** TypeScript, Zod (`@threadhelm/contracts`), React 19, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-03-repo-idea-generation-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-03-structured-draft-primitive.md` (Plan A — `runStructuredDraft`, `readFileTree`/`readReadme`/`readManifest`/`readRecentCommitSubjects`) and the guided mission composer (phase 4a, PR #22 — `missionComposer.createDraft`/`updateDraft`, `composer-fields.ts`, `MissionComposerWorkspace.tsx`, `state.workspaces`/`state.readiness`). **Both must be merged to `main` before this plan starts** — every file this plan modifies assumes they already exist there.

## Global Constraints

- No new draft schema, no new SQLite column — picking an idea only ever writes to `objective`/`completionEvidence`, the same fields Outcome's own textareas write to (per spec §4).
- The repo picker only lists already-approved workspaces (`state.workspaces`) — this screen cannot approve a folder, matching every other prerequisite gate in the composer.
- The provider/model picker is a request parameter on `proposeRepoIdeas`, never a stored setting — no new Settings surface.
- Never a dead end: provider unavailable, repo unreadable, or invalid output all show "Couldn't generate ideas right now" next to the Generate button, with the Skip link always present.
- Exactly one polite live region for this screen (it is not part of `MissionComposerWorkspace`, so it owns its own single `role="status" aria-live="polite"` element — never a second one once the user reaches the composer proper).
- New CSS only in `apps/desktop/src/renderer/styles/mission-composer.css`.
- Reason codes never appear in workspace text; every new code gets a label in `apps/desktop/src/renderer/features/mission-focus/reason-labels.ts`.
- Never `npx`; always `pnpm exec`. Branch: `feat/repo-idea-generation`, based on `main` after both dependencies are merged. Commit after every task. Attribution trailer on every commit:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT`.
- Commands: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:contract`, `pnpm desktop:build && pnpm exec playwright test <spec>`.

## Friendliness gates (renderer task)

Task 4 ends with this checklist. A task is not done until every line holds.

1. One question at a time; heading is a plain sentence ("Pick a repo to get mission ideas, or write your own.").
2. Visible labels in ordinary words; provider/model default stated in words ("Provider default model").
3. "Generate ideas" names what it does; disabled state says why (no repo picked yet).
4. Empty prerequisite (no approved workspace) → sentence + "Go to Settings" button — never a dead end.
5. N/A — no advanced/collapsed fields on this screen.
6. Nothing lost — Skip and Generate failures both leave a path forward; picking an idea only pre-fills editable fields.
7. N/A — a picker and a button, not a form with field-level errors.
8. No reason code/UUID/JSON — workspace names are real names via `state.workspaces`, never raw paths.

---

## File structure

| File                                                                    | Responsibility                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/index.ts`                                       | `RepoIdeaCandidate` schema, `missionComposer.proposeRepoIdeas` operation, `REPO_IDEAS_UNAVAILABLE`/`REPO_IDEAS_OUTPUT_INVALID` error codes. |
| `apps/desktop/src/main/coordination/repo-ideas.ts`                      | New. `createRepoIdeasService(ctx)`: assembles the prompt from Plan A's readers, calls `runStructuredDraft`, validates the response.         |
| `apps/desktop/src/main/coordinator.ts`                                  | Route `missionComposer.proposeRepoIdeas`.                                                                                                   |
| `apps/desktop/src/main/context.ts`                                      | `repoIdeas?: RepoIdeasService` on `Context`.                                                                                                |
| `apps/desktop/src/renderer/features/mission-composer/RepoIdeaEntry.tsx` | New. Repo picker, provider/model picker, generate/regenerate, 3 idea cards, skip link, own live region.                                     |
| `apps/desktop/src/renderer/App.tsx`                                     | `pickingRepo` state; `openComposer` gains an optional `initialFields` param; rail's "New mission…" opens `RepoIdeaEntry` first.             |
| `apps/desktop/src/renderer/features/mission-focus/reason-labels.ts`     | Labels for the two new codes.                                                                                                               |
| `apps/desktop/src/renderer/styles/mission-composer.css`                 | `.repo-idea-*` rules.                                                                                                                       |
| `tests/unit/renderer/reason-labels.test.ts`                             | New-code label test.                                                                                                                        |
| `tests/contract/repo-ideas.test.ts`                                     | `proposeRepoIdeas` operation tests (success, held-unavailable, held-invalid-output).                                                        |
| `tests/e2e/repo-idea-generation.spec.ts`                                | New. Guided journey: skip path, generate-and-pick path, failure path.                                                                       |

---

### Task 1: Contract additions

**Files:**

- Modify: `packages/contracts/src/index.ts` (`ErrorCode` list, new schema near `MissionComposerFields`, `operations` table)
- Test: `tests/unit/contracts/repo-ideas-schemas.test.ts`

**Interfaces:**

- Produces: `RepoIdeaCandidate = { title: string; rationale: string; proposedObjective: string; proposedCompletionEvidence: string }`, operation `missionComposer.proposeRepoIdeas`, codes `REPO_IDEAS_UNAVAILABLE`/`REPO_IDEAS_OUTPUT_INVALID`.

- [ ] **Step 1: Write the failing schema test**

Create `tests/unit/contracts/repo-ideas-schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ErrorCode, RepoIdeaCandidate, operationNames } from '@threadhelm/contracts';

describe('repo idea contract additions', () => {
  it('validates one candidate strictly', () => {
    const candidate = {
      title: 'Fix the flaky CI job',
      rationale: 'Three of the last five commits mention a retry.',
      proposedObjective: 'Make the CI job pass deterministically.',
      proposedCompletionEvidence: 'Ten consecutive green runs.',
    };
    expect(RepoIdeaCandidate.parse(candidate)).toEqual(candidate);
    expect(RepoIdeaCandidate.safeParse({ ...candidate, extra: true }).success).toBe(false);
  });

  it('names the operation and failure codes', () => {
    expect(operationNames).toContain('missionComposer.proposeRepoIdeas');
    for (const code of ['REPO_IDEAS_UNAVAILABLE', 'REPO_IDEAS_OUTPUT_INVALID']) {
      expect(ErrorCode.safeParse(code).success).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/contracts/repo-ideas-schemas.test.ts`
Expected: FAIL, `RepoIdeaCandidate` is not exported.

- [ ] **Step 3: Add the error codes**

In `packages/contracts/src/index.ts` `ErrorCode` list, after `'STRUCTURED_DRAFT_OUTPUT_INVALID',` (added by Plan A) insert:

```ts
  // repo idea generation
  'REPO_IDEAS_UNAVAILABLE',
  'REPO_IDEAS_OUTPUT_INVALID',
```

- [ ] **Step 4: Add the schema**

Near `MissionComposerFields` (Task 1 of the guided-mission-composer plan added it after `MissionPreviewView`), add:

```ts
export const RepoIdeaCandidate = strictObject({
  title: z.string().min(1).max(120),
  rationale: z.string().min(1).max(400),
  proposedObjective: z.string().min(1).max(4000),
  proposedCompletionEvidence: z.string().min(1).max(2000),
});
export type RepoIdeaCandidate = z.infer<typeof RepoIdeaCandidate>;
```

- [ ] **Step 5: Add the operation**

In the `operations` table, after `'missionComposer.confirmDiscard': {...},` add:

```ts
  'missionComposer.proposeRepoIdeas': {
    request: strictObject({
      workspaceId: Uuid,
      providerId: ProviderId.optional(),
      model: z.string().max(200).optional(),
      effort: z.string().max(50).optional(),
    }),
    response: strictObject({ ideas: z.array(RepoIdeaCandidate).length(3) }),
  },
```

- [ ] **Step 6: Run to verify it passes, then typecheck**

Run: `pnpm test:unit -- tests/unit/contracts/repo-ideas-schemas.test.ts && pnpm typecheck`
Expected: test PASS. Typecheck FAILS in `apps/desktop/src/main/coordinator.ts` (`Handlers` is exhaustive) — leave for Task 2.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/index.ts tests/unit/contracts/repo-ideas-schemas.test.ts
git commit -m "feat(contracts): repo idea candidate schema and proposeRepoIdeas operation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 2: Main-process repo-ideas service

**Files:**

- Create: `apps/desktop/src/main/coordination/repo-ideas.ts`
- Modify: `apps/desktop/src/main/context.ts` (`repoIdeas?: RepoIdeasService`)
- Modify: `apps/desktop/src/main/coordinator.ts` (handler, service construction)
- Test: `tests/contract/repo-ideas.test.ts`

**Interfaces:**

- Consumes: `readFileTree`/`readReadme`/`readManifest`/`readRecentCommitSubjects` (Plan A, `apps/desktop/src/main/coordination/repo-metadata.js`), `runStructuredDraft` (Plan A, `apps/desktop/src/main/providers/structured-draft.js`), `Context.storage.repositories.workspaces` (approved-workspace lookup — confirm the exact repository/method name against `packages/persistence/src/repositories/index.ts` during implementation; it is the same lookup `AccessStage`'s workspace list is built from).
- Produces: `RepoIdeasService { propose(request): Promise<{ ideas: RepoIdeaCandidate[] }> }`, `createRepoIdeasService(ctx: Context): RepoIdeasService`.

- [ ] **Step 1: Write the failing contract test**

Create `tests/contract/repo-ideas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createWorld } from './helpers/fake-context.js';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('missionComposer.proposeRepoIdeas', () => {
  it('returns 3 candidates parsed from the structured-draft response', async () => {
    const world = createWorld();
    await world.approve('C:\\repo');
    world.ctx.structuredDraft = {
      run: async () => ({
        text: JSON.stringify({
          ideas: [
            {
              title: 'Fix the flaky CI job',
              rationale: 'Recent commits mention retries.',
              proposedObjective: 'Make CI deterministic.',
              proposedCompletionEvidence: 'Ten green runs.',
            },
            {
              title: 'Add tests for the auth module',
              rationale: 'No test file matches auth.ts.',
              proposedObjective: 'Cover the auth module with tests.',
              proposedCompletionEvidence: 'A passing test file exists.',
            },
            {
              title: 'Update the stale README section',
              rationale: 'README still describes the old CLI flags.',
              proposedObjective: 'Bring the README in line with the CLI.',
              proposedCompletionEvidence: 'README examples run as written.',
            },
          ],
        }),
      }),
    };
    const workspaces = await world.ok<{ id: string }[]>('workspaces.list');
    const result = await world.ok<{ ideas: unknown[] }>('missionComposer.proposeRepoIdeas', {
      workspaceId: workspaces[0]!.id,
    });
    expect(result.ideas).toHaveLength(3);
  });

  it('reports REPO_IDEAS_UNAVAILABLE when the structured draft is held', async () => {
    const world = createWorld();
    await world.approve('C:\\repo');
    // Default fake structuredDraft always reports held — see Plan A's fake-context.ts change.
    const workspaces = await world.ok<{ id: string }[]>('workspaces.list');
    const result = await world.call('missionComposer.proposeRepoIdeas', {
      workspaceId: workspaces[0]!.id,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPO_IDEAS_UNAVAILABLE');
  });

  it('reports REPO_IDEAS_OUTPUT_INVALID when the model returns malformed JSON', async () => {
    const world = createWorld();
    await world.approve('C:\\repo');
    world.ctx.structuredDraft = { run: async () => ({ text: 'not json' }) };
    const workspaces = await world.ok<{ id: string }[]>('workspaces.list');
    const result = await world.call('missionComposer.proposeRepoIdeas', {
      workspaceId: workspaces[0]!.id,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPO_IDEAS_OUTPUT_INVALID');
  });

  it('rejects an unapproved workspace', async () => {
    const world = createWorld();
    const result = await world.call('missionComposer.proposeRepoIdeas', { workspaceId: uuid });
    expect(result.ok).toBe(false);
  });
});
```

Check `tests/contract/helpers/fake-context.ts`'s `approve(path)` helper and whatever operation lists approved workspaces (`workspaces.list`, confirm the exact name against `packages/contracts/src/index.ts`'s `operations` table) — adjust the test's calls if the real names differ.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:contract -- tests/contract/repo-ideas.test.ts`
Expected: FAIL, `Unknown operation` / `Handlers` missing `missionComposer.proposeRepoIdeas`.

- [ ] **Step 3: Write the service**

Create `apps/desktop/src/main/coordination/repo-ideas.ts`:

```ts
/**
 * Repo-idea generation (T-repo-idea-02). A pure read-and-propose call: it
 * never touches a composer draft. The renderer commits a chosen idea's text
 * into a draft itself, through the existing missionComposer.updateDraft.
 */

import {
  RepoIdeaCandidate,
  ThreadHelmError,
  type OperationRequest,
  type OperationResponse,
} from '@threadhelm/contracts';
import {
  readFileTree,
  readManifest,
  readReadme,
  readRecentCommitSubjects,
} from './repo-metadata.js';
import { runStructuredDraft } from '../providers/structured-draft.js';
import type { Context } from '../context.js';

export interface RepoIdeasService {
  propose(
    request: OperationRequest<'missionComposer.proposeRepoIdeas'>,
  ): Promise<OperationResponse<'missionComposer.proposeRepoIdeas'>>;
}

const PROMPT_INSTRUCTIONS = `You are suggesting three small, concrete engineering tasks for the repository described below. Respond with ONLY a JSON object of this exact shape and nothing else — no prose, no markdown fences:
{"ideas":[{"title":"...","rationale":"...","proposedObjective":"...","proposedCompletionEvidence":"..."},{"title":"...","rationale":"...","proposedObjective":"...","proposedCompletionEvidence":"..."},{"title":"...","rationale":"...","proposedObjective":"...","proposedCompletionEvidence":"..."}]}
Each "title" is under 120 characters. Each "rationale" is one sentence explaining why, grounded in what you were shown below. Each "proposedObjective" is one sentence a coordinator could check off. Each "proposedCompletionEvidence" is one sentence naming the proof.`;

function buildPrompt(input: {
  fileTree: string[];
  readme: string | null;
  manifest: { filename: string; contents: string } | null;
  commitSubjects: string[];
}): string {
  const sections = [PROMPT_INSTRUCTIONS];
  sections.push(
    `File tree (${input.fileTree.length} files):\n${input.fileTree.slice(0, 200).join('\n')}`,
  );
  if (input.readme) sections.push(`README:\n${input.readme}`);
  if (input.manifest) sections.push(`${input.manifest.filename}:\n${input.manifest.contents}`);
  if (input.commitSubjects.length > 0) {
    sections.push(`Recent commit subjects:\n${input.commitSubjects.join('\n')}`);
  }
  return sections.join('\n\n');
}

/** Untrusted output is validated the same way the mission-composer preview is. */
function parseIdeas(text: string): RepoIdeaCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ThreadHelmError('REPO_IDEAS_OUTPUT_INVALID', 'The model response was not JSON.');
  }
  const shape = z.object({ ideas: z.array(RepoIdeaCandidate).length(3) }).safeParse(parsed);
  if (!shape.success) {
    throw new ThreadHelmError(
      'REPO_IDEAS_OUTPUT_INVALID',
      'The model response did not match the expected shape.',
    );
  }
  return shape.data.ideas;
}

export function createRepoIdeasService(ctx: Context): RepoIdeasService {
  return {
    async propose(request) {
      if (!ctx.storage || ctx.health.degraded) {
        throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Workspace storage is unavailable.');
      }
      const workspace = ctx.storage.repositories.workspaces.findById(request.workspaceId);
      if (!workspace || workspace.revokedAt) {
        throw new ThreadHelmError('WORKSPACE_NOT_APPROVED', 'That folder is not approved.');
      }
      const [fileTree, readme, manifest, commitSubjects] = await Promise.all([
        readFileTree(workspace.canonicalPath),
        readReadme(workspace.canonicalPath),
        readManifest(workspace.canonicalPath),
        readRecentCommitSubjects(workspace.canonicalPath),
      ]);
      const prompt = buildPrompt({ fileTree, readme, manifest, commitSubjects });
      const providerId = request.providerId ?? 'codex-cli';
      const outcome = await runStructuredDraft(ctx, providerId, prompt);
      if ('held' in outcome) {
        throw new ThreadHelmError('REPO_IDEAS_UNAVAILABLE', "Couldn't generate ideas right now.");
      }
      return { ideas: parseIdeas(outcome.text) };
    },
  };
}
```

Add `import { z } from 'zod';` to the imports (used by `parseIdeas`).

`ctx.storage.repositories.workspaces.findById(request.workspaceId)` is confirmed against `packages/persistence/src/repositories/workspaces.ts`'s real `ApprovedWorkspaceRepository` — it returns `ApprovedWorkspaceView | null`, with `canonicalPath` and `revokedAt` both present.

- [ ] **Step 4: Wire context and handler**

In `apps/desktop/src/main/context.ts`, add after `structuredDraft: StructuredDraftRunner;` (Plan A):

```ts
  /** Main-owned repo-idea generation; never touches a composer draft. */
  repoIdeas?: RepoIdeasService;
```

with `import type { RepoIdeasService } from './coordination/repo-ideas.js';` added.

In `apps/desktop/src/main/coordinator.ts`, after the `missionComposer` service construction, add:

```ts
const repoIdeas = ctx.repoIdeas ?? createRepoIdeasService(ctx);
ctx.repoIdeas = repoIdeas;
```

and in the returned handlers, after `'missionComposer.confirmDiscard'`:

```ts
    'missionComposer.proposeRepoIdeas': (request) => repoIdeas.propose(request),
```

with `import { createRepoIdeasService } from './coordination/repo-ideas.js';` added.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test:contract -- tests/contract/repo-ideas.test.ts && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/main/coordination/repo-ideas.ts apps/desktop/src/main/context.ts apps/desktop/src/main/coordinator.ts tests/contract/repo-ideas.test.ts
git commit -m "feat(main): repo idea generation over the structured-draft primitive

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 3: Reason labels

**Files:**

- Modify: `apps/desktop/src/renderer/features/mission-focus/reason-labels.ts`
- Test: `tests/unit/renderer/reason-labels.test.ts`

- [ ] **Step 1: Add the test**

Append to `tests/unit/renderer/reason-labels.test.ts`:

```ts
it('labels the repo-idea codes as a sentence', () => {
  for (const code of ['REPO_IDEAS_UNAVAILABLE', 'REPO_IDEAS_OUTPUT_INVALID']) {
    expect(REASON_LABELS[code]).toMatch(/^[A-Z].*\.$/);
    expect(REASON_LABELS[code]).not.toMatch(/[A-Z]{3,}_/);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/renderer/reason-labels.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the labels**

Add to `REASON_LABELS`:

```ts
  REPO_IDEAS_UNAVAILABLE: "Couldn't generate ideas right now.",
  REPO_IDEAS_OUTPUT_INVALID: "Couldn't generate ideas right now.",
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit -- tests/unit/renderer/reason-labels.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/features/mission-focus/reason-labels.ts tests/unit/renderer/reason-labels.test.ts
git commit -m "feat(renderer): reason labels for repo idea generation failures

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 4: `RepoIdeaEntry` screen

**Files:**

- Create: `apps/desktop/src/renderer/features/mission-composer/RepoIdeaEntry.tsx`
- Modify: `apps/desktop/src/renderer/styles/mission-composer.css`
- Test: `tests/e2e/repo-idea-generation.spec.ts` (first three tests: skip path, empty-workspace path, generate-and-pick path)

**Interfaces:**

- Consumes: `state.workspaces: ApprovedWorkspaceView[]`, `state.readiness: ReadinessView[]` (both already in the store per the guided-mission-composer plan), `api.missionComposer.proposeRepoIdeas`, `reasonLabel` from `reason-labels.ts`.
- Produces: `RepoIdeaEntry({ workspaces, readiness, onSkip(), onPick(fields: { objective: string; completionEvidence: string }), onGoToSettings() })`.

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/repo-idea-generation.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { launchApp } from './helpers/app.js';
import { teardown } from './helpers/ui.js';

test.setTimeout(90_000);

test('skipping the repo-idea screen opens a blank Outcome stage', async ({}, testInfo) => {
  const app = await launchApp();
  try {
    const page = app.page;
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Pick a repo/ })).toBeVisible();
    await page.getByRole('link', { name: /Skip/ }).click();
    await expect(page.getByRole('heading', { name: 'Define one finish line.' })).toBeVisible();
    await expect(page.getByLabel('Finish line', { exact: true })).toHaveValue('');
  } finally {
    await teardown(app);
  }
});

test('no approved workspace shows a sentence and a Settings button, no dropdown', async ({}, testInfo) => {
  const app = await launchApp();
  try {
    const page = app.page;
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Repo', exact: true })).toHaveCount(0);
    await expect(page.getByText(/No approved folder yet/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to Settings', exact: true })).toBeVisible();
  } finally {
    await teardown(app);
  }
});
```

The third (generate-and-pick) test needs an approved workspace and a faked structured-draft response, which requires an e2e test hook this task does not yet have — write it as a stub `test.fixme(...)` here with a one-line comment pointing at Task 5, which adds the hook and completes this test.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/repo-idea-generation.spec.ts`
Expected: FAIL — "New mission…" still opens the composer directly (App.tsx not yet wired; Task 5 does that). Both non-fixme tests fail at the first assertion.

- [ ] **Step 3: Write the component**

Create `apps/desktop/src/renderer/features/mission-composer/RepoIdeaEntry.tsx`:

```tsx
import { useId, useState } from 'react';
import type {
  ApprovedWorkspaceView,
  OperationResponse,
  ProviderId,
  ReadinessView,
} from '@threadhelm/contracts';
import { api, call, errorCode } from '../../api.js';
import { reasonLabel } from '../mission-focus/reason-labels.js';

type RepoIdea = OperationResponse<'missionComposer.proposeRepoIdeas'>['ideas'][number];

export function RepoIdeaEntry({
  workspaces,
  readiness,
  onSkip,
  onPick,
  onGoToSettings,
}: {
  workspaces: ApprovedWorkspaceView[];
  readiness: ReadinessView[];
  onSkip(): void;
  onPick(fields: { objective: string; completionEvidence: string }): void;
  onGoToSettings(): void;
}) {
  const headingId = useId();
  const [workspaceId, setWorkspaceId] = useState('');
  const [providerId, setProviderId] = useState<ProviderId | ''>('');
  const [ideas, setIdeas] = useState<RepoIdea[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const approved = workspaces.filter((w) => !w.revokedAt);
  const availableProviders = readiness.filter((r) => r.availability === 'available');

  const generate = async () => {
    if (!workspaceId) return;
    setBusy(true);
    setFailure(null);
    setIdeas(null);
    try {
      const result = await call(
        api.missionComposer.proposeRepoIdeas({
          workspaceId,
          ...(providerId ? { providerId } : {}),
        }),
      );
      setIdeas(result.ideas);
    } catch (cause) {
      setFailure(reasonLabel(errorCode(cause)) ?? "Couldn't generate ideas right now.");
    } finally {
      setBusy(false);
    }
  };

  if (approved.length === 0)
    return (
      <section className="repo-idea-entry" aria-labelledby={headingId}>
        <h1 id={headingId}>Pick a repo to get mission ideas, or write your own.</h1>
        <div className="composer-notice">
          <p>
            No approved folder yet. Go to Settings and approve a folder, then come back to choose it
            here.
          </p>
          <button type="button" className="primary" onClick={onGoToSettings}>
            Go to Settings
          </button>
        </div>
        <button type="button" className="link" onClick={onSkip}>
          Skip — I&rsquo;ll write my own
        </button>
      </section>
    );

  return (
    <section className="repo-idea-entry" aria-labelledby={headingId}>
      <p className="visually-hidden" role="status" aria-live="polite">
        {busy ? 'Generating ideas…' : failure ? failure : ideas ? 'Ideas ready.' : ''}
      </p>
      <h1 id={headingId}>Pick a repo to get mission ideas, or write your own.</h1>
      <label className="field">
        Repo
        <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
          <option value="">Choose an approved folder</option>
          {approved.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.displayPath}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Provider and model
        <select
          value={providerId}
          onChange={(event) => setProviderId(event.target.value as ProviderId | '')}
        >
          <option value="">Provider default model</option>
          {availableProviders.map((provider) => (
            <option key={provider.providerId} value={provider.providerId}>
              {provider.displayName}
            </option>
          ))}
        </select>
      </label>
      <div className="mission-action-row">
        <button
          type="button"
          className="primary"
          disabled={!workspaceId || busy}
          onClick={() => void generate()}
        >
          {ideas ? 'Try different ideas' : 'Generate ideas'}
        </button>
        <button type="button" className="link" onClick={onSkip}>
          Skip — I&rsquo;ll write my own
        </button>
      </div>
      {failure ? <p className="notice">{failure}</p> : null}
      {ideas ? (
        <ul className="repo-idea-list" aria-label="Mission ideas">
          {ideas.map((idea) => (
            <li key={idea.title} className="repo-idea-card">
              <h2>{idea.title}</h2>
              <p>{idea.rationale}</p>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    objective: idea.proposedObjective,
                    completionEvidence: idea.proposedCompletionEvidence,
                  })
                }
              >
                Use this idea
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Add the CSS**

Add to `apps/desktop/src/renderer/styles/mission-composer.css`:

```css
.repo-idea-entry {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 40rem;
}
.repo-idea-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  list-style: none;
  padding: 0;
}
.repo-idea-card {
  border: 1px solid var(--border, #ccc);
  border-radius: 0.5rem;
  padding: 1rem;
}
```

- [ ] **Step 5: Run to verify the non-fixme tests still fail the same way**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/repo-idea-generation.spec.ts`
Expected: still FAIL — the component exists but nothing in `App.tsx` mounts it yet (Task 5).

- [ ] **Step 6: Self-review against the friendliness gates**

Check `RepoIdeaEntry.tsx` against each line of this plan's "Friendliness gates" section (near the top): plain-sentence heading (1); ordinary-word labels, provider default stated in words (2); "Generate ideas" names its action, disabled while no repo is chosen (3); the empty-workspace branch shows a sentence plus a "Go to Settings" button, never an empty `<select>` (4); N/A for 5 and 7 (no advanced fields, no per-field validation on this screen); Skip is always present and picking an idea only pre-fills editable fields, never auto-advances past Outcome (6); no raw workspace id or reason code appears anywhere outside `reasonLabel(...)`'s output (8). Fix anything that doesn't hold before committing.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/features/mission-composer/RepoIdeaEntry.tsx apps/desktop/src/renderer/styles/mission-composer.css tests/e2e/repo-idea-generation.spec.ts
git commit -m "feat(renderer): RepoIdeaEntry screen (repo/provider picker, idea cards)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 5: Wire into App.tsx

**Files:**

- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/main/test-hooks.ts` (a fixture hook so the e2e generate-and-pick test doesn't need a real CLI — check the file's actual current shape before editing, as prior plans/tasks may have changed its structure; follow whatever hook-object pattern is already there)
- Modify: `tests/e2e/repo-idea-generation.spec.ts` (complete the fixme'd third test)

**Interfaces:**

- Consumes: `RepoIdeaEntry` (Task 4), existing `openComposer`/`MissionRail` wiring.
- Produces: `openComposer(sourceMissionId?: string, initialFields?: { objective: string; completionEvidence: string }): void`.

- [ ] **Step 1: Add the e2e test hook**

Open `apps/desktop/src/main/test-hooks.ts`, read its current `TestHooks` interface and the object implementing it, and add an entry that lets an e2e test fake `ctx.repoIdeas` the same way `useFixtureAdapters` fakes `ctx.adapters` — e.g.:

```ts
  fakeRepoIdeas(ideas: RepoIdeaCandidate[]): void;
```

and in the implementing object:

```ts
    fakeRepoIdeas: (ideas) => {
      ctx.repoIdeas = { propose: async () => ({ ideas }) };
    },
```

with `import type { RepoIdeaCandidate } from '@threadhelm/contracts';` added. Match the exact surrounding style — read the file first (its shape may have changed since Plan A's Task 4 added a different hook to it).

- [ ] **Step 2: Complete the fixme'd e2e test**

Replace the `test.fixme` placeholder in `tests/e2e/repo-idea-generation.spec.ts` with:

```ts
test('generating ideas and picking one pre-fills Outcome', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    const dir = await app.approveWorkspace();
    await app.hooks('hooks.fakeRepoIdeas(arg)', [
      {
        title: 'Fix the flaky CI job',
        rationale: 'Recent commits mention retries.',
        proposedObjective: 'Make CI deterministic.',
        proposedCompletionEvidence: 'Ten green runs.',
      },
      {
        title: 'Add tests for the auth module',
        rationale: 'No test file matches auth.ts.',
        proposedObjective: 'Cover the auth module with tests.',
        proposedCompletionEvidence: 'A passing test file exists.',
      },
      {
        title: 'Update the stale README section',
        rationale: 'README still describes the old CLI flags.',
        proposedObjective: 'Bring the README in line with the CLI.',
        proposedCompletionEvidence: 'README examples run as written.',
      },
    ]);
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await page.getByLabel('Repo', { exact: true }).selectOption({ label: dir });
    await page.getByRole('button', { name: 'Generate ideas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Fix the flaky CI job' })).toBeVisible();
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Fix the flaky CI job' })
      .getByRole('button', { name: 'Use this idea', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Define one finish line.' })).toBeVisible();
    await expect(page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Make CI deterministic.',
    );
    await expect(page.getByLabel('Proof of completion', { exact: true })).toHaveValue(
      'Ten green runs.',
    );
  } finally {
    await teardown(app);
  }
});
```

Check `tests/e2e/helpers/app.ts` for the exact name of an existing "approve a workspace and return its display path" helper (several existing specs already need one) and use that instead of a fictional `app.approveWorkspace()` if the real helper is named differently.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/repo-idea-generation.spec.ts`
Expected: FAIL — `App.tsx` doesn't mount `RepoIdeaEntry` yet.

- [ ] **Step 4: Wire App.tsx**

In `apps/desktop/src/renderer/App.tsx`:

Add state: `const [pickingRepo, setPickingRepo] = useState(false);`

Change `openComposer` to accept an optional third argument and apply it after draft creation:

```ts
const openComposer = (
  sourceMissionId?: string,
  initialFields?: { objective: string; completionEvidence: string },
) => {
  void flushComposer().then(() =>
    call(api.missionComposer.createDraft(sourceMissionId ? { sourceMissionId } : undefined))
      .then((draft) =>
        initialFields
          ? call(
              api.missionComposer.updateDraft({
                draftId: draft.draftId,
                expectedVersion: draft.version,
                fieldValues: initialFields,
                currentStage: 'outcome',
              }),
            ).then(() => draft.draftId)
          : draft.draftId,
      )
      .then((draftId) => setComposerDraftId(draftId))
      .catch((cause) =>
        actions.setNotice(reasonLabel(errorCode(cause)) ?? 'The draft could not be created.'),
      ),
  );
};
```

Change the rail's `onCreate` from `() => openComposer()` to `() => setPickingRepo(true)`.

In the render tree, where `composerDraftId ? <MissionComposerWorkspace ... /> : ...` currently branches, add a preceding branch:

```tsx
) : pickingRepo ? (
  <RepoIdeaEntry
    workspaces={state.workspaces}
    readiness={state.readiness}
    onSkip={() => {
      setPickingRepo(false);
      openComposer();
    }}
    onPick={(fields) => {
      setPickingRepo(false);
      openComposer(undefined, fields);
    }}
    onGoToSettings={() => {
      setPickingRepo(false);
      actions.selectDestination('settings');
    }}
  />
) : composerDraftId ? (
```

with `import { RepoIdeaEntry } from './features/mission-composer/RepoIdeaEntry.js';` added. Read the actual current branch structure around `composerDraftId`/`missionSelected` in `App.tsx` before editing — insert `pickingRepo` at the same nesting level so it doesn't interfere with the `state.selectedDestination !== 'missions'` branch that takes priority over both.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm typecheck && pnpm lint && pnpm desktop:build && pnpm exec playwright test tests/e2e/repo-idea-generation.spec.ts`
Expected: all PASS (all three tests, including the completed generate-and-pick test).

- [ ] **Step 6: Full verification**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:contract && pnpm desktop:build && pnpm exec playwright test`
Expected: all PASS, no regressions in the existing composer suite.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/App.tsx apps/desktop/src/main/test-hooks.ts tests/e2e/repo-idea-generation.spec.ts
git commit -m "feat(renderer): wire repo-idea entry before the guided composer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

## What this plan does not build

- No caching or persistence of generated ideas across sessions — every "Pick a repo" visit generates fresh (or the user regenerates within the same visit).
- No provider/model preference remembered across visits — the picker always starts at "Provider default model," per the spec's explicit deferral.
- No revision-flow integration — `onRevise` still calls `openComposer(missionId)` directly, bypassing `RepoIdeaEntry` entirely, since a revision already has a full envelope to seed from.
