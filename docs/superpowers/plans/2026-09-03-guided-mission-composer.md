# Guided Mission Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat "Create mission" modal with a four-stage guided composer (Outcome → Crew → Access & limits → Review) that lives in the mission workspace region, autosaves main-owned drafts, and pins per-worker assignment and return evidence into the confirmed envelope.

**Architecture:** Main owns a `mission_composer_drafts` table and a `missionComposer.*` service that wraps the existing `supervisor.preview/confirm`. The renderer holds one `MissionComposerFields` object per draft, derives every readiness sentence deterministically in `composer-fields.ts`, and renders four stage components inside `MissionComposerWorkspace`. No provider calls; no model output.

**Tech Stack:** Zod contracts (`packages/contracts`), better-sqlite3 repositories (`packages/persistence`), Electron main services (`apps/desktop/src/main/coordination`), React 19 renderer with plain CSS, Vitest (`unit`, `contract` projects), Playwright `_electron` e2e.

**Spec:** `docs/superpowers/specs/2026-09-03-guided-mission-composer-design.md`

## Global Constraints

- No provider/CLI calls from any composer code path. No Outcome Coach, Crew Workshop, Access Coach.
- No change to `threadhelm/agent-profile@1`. No provider capability registry.
- Drafts are main-owned SQLite rows; the renderer never persists composer state itself (no localStorage).
- Every draft mutation carries `expectedVersion`; stale writes fail with `MISSION_DRAFT_STALE` and never merge.
- List/event views carry no authored text (objective, evidence, assignment, exclusions).
- Reason codes (`/^[A-Z][A-Z0-9_]{2,63}$/`) never appear in workspace text; every new code gets a label in `reason-labels.ts`.
- Continue buttons are named by destination: "Continue to crew", "Continue to access and limits", "Continue to review".
- Stage headings receive focus on entry; one polite live region per composer; terminal output never enters it.
- New CSS goes in `apps/desktop/src/renderer/styles/mission-composer.css`, never legacy `styles.css`.
- Bundled copy uses generic terms; no product names or personas.
- Branch: `feat/guided-mission-composer`. Commit after every task. Attribution trailer on every commit:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT`.
- Commands: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:contract`, `pnpm desktop:build && pnpm exec playwright test <spec>`. Never `npx` (it rewrites `package.json` in this workspace); always `pnpm exec`.

## Friendliness gates (apply to every renderer task)

Each renderer task ends with this checklist in its last step. A task is not done until every line holds.

1. The stage asks one question at a time; the heading is a plain sentence, not a noun label.
2. Every control has a visible label in ordinary words; units and defaults are stated in words next to the control, not only as raw numbers.
3. The continue button names where it goes, and when disabled the readiness line says exactly what is missing.
4. An empty prerequisite never shows an empty dropdown; it shows a sentence and one button that goes to the fix.
5. Advanced fields sit under a collapsed `<details>` whose summary states the current defaults in words.
6. Nothing is lost on Close, Back, navigation, or app restart (autosave), and the receipt says so.
7. Errors sit next to the control; the first invalid control gets focus on a blocked continue.
8. No reason code, UUID, or JSON on screen outside the exact-authority disclosure.

---

## File structure

| File                                                                                          | Responsibility                                                                           |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/contracts/src/index.ts`                                                             | Envelope field additions, draft view/request schemas, operations, event, error codes.    |
| `packages/contracts/src/protocol.ts`                                                          | `missionComposer.*` operation names and `missionComposer.changed` event name.            |
| `packages/persistence/src/schema.ts`                                                          | `V5_MISSION_COMPOSER` migration and extension entry.                                     |
| `packages/persistence/src/repositories/mission-composer.ts`                                   | New. Draft CRUD with expected-version writes, open-draft cap, conversion mark.           |
| `packages/persistence/src/repositories/index.ts`                                              | Register `missionComposer` repository.                                                   |
| `apps/desktop/src/main/coordination/mission-composer.ts`                                      | New. `MissionComposerService`: drafts, preview/confirm wrappers, discard tokens, events. |
| `apps/desktop/src/main/coordination/mission-bindings.ts`                                      | Copy `assignment`, `requiredReturnEvidence`, `exclusions` into the envelope view.        |
| `apps/desktop/src/main/coordinator.ts`                                                        | Route `missionComposer.*` handlers.                                                      |
| `apps/desktop/src/main/context.ts`                                                            | `missionComposer?: MissionComposerService`.                                              |
| `apps/desktop/src/main/test-hooks.ts`                                                         | `advanceClock(ms)` hook.                                                                 |
| `apps/desktop/src/renderer/features/mission-composer/composer-fields.ts`                      | New. `MissionComposerFields`, defaults, per-stage readiness, envelope assembly.          |
| `apps/desktop/src/renderer/features/mission-composer/MissionComposerWorkspace.tsx`            | New. Stage strip, action row, autosave, banner, live region, close receipt.              |
| `apps/desktop/src/renderer/features/mission-composer/OutcomeStage.tsx`                        | New. Finish line, proof, exclusions.                                                     |
| `apps/desktop/src/renderer/features/mission-composer/CrewStage.tsx`                           | New. Supervisor, worker cards, prerequisite notices, runtime disclosure.                 |
| `apps/desktop/src/renderer/features/mission-composer/AccessStage.tsx`                         | New. Workspace rows, readiness lines, limits disclosure, withheld list.                  |
| `apps/desktop/src/renderer/features/mission-composer/ReviewStage.tsx`                         | New. Launch brief, four material states, confirm.                                        |
| `apps/desktop/src/renderer/features/mission-composer/ListEditor.tsx`                          | New. Bounded string-list editor.                                                         |
| `apps/desktop/src/renderer/features/mission-composer/MissionEnvelopeDisclosure.tsx`           | Moved from the modal; shows the three new fields.                                        |
| `apps/desktop/src/renderer/features/mission-composer/DraftBanner.tsx`                         | New. Save failure / storage degraded banner.                                             |
| `apps/desktop/src/renderer/features/mission-composer/useDraft.ts`                             | New. Load, debounce-save, stale handling, version tracking.                              |
| `apps/desktop/src/renderer/features/mission-focus/MissionRail.tsx`                            | Drafts row.                                                                              |
| `apps/desktop/src/renderer/features/mission-focus/MissionWorkspace.tsx`                       | Empty state without the create button; drafts list.                                      |
| `apps/desktop/src/renderer/features/mission-focus/reason-labels.ts`                           | Labels for the new codes.                                                                |
| `apps/desktop/src/renderer/features/coordination/MissionDetail.tsx`                           | Revision opens the composer; shows assignment/evidence/exclusions.                       |
| `apps/desktop/src/renderer/features/coordination/MissionComposer.tsx`                         | Task 4: two new inputs. Task 10: deleted.                                                |
| `apps/desktop/src/renderer/App.tsx`, `store.tsx`                                              | `composerDraftId`, drafts summaries, `missionComposer.changed` subscription.             |
| `apps/desktop/src/renderer/styles/mission-composer.css`                                       | All composer rules.                                                                      |
| `tests/unit/contracts/mission-composer-schemas.test.ts`                                       | Schema additions parse/reject.                                                           |
| `tests/unit/persistence/mission-composer.test.ts`                                             | Repository behavior.                                                                     |
| `tests/unit/renderer/composer-fields.test.ts`                                                 | Readiness and envelope assembly.                                                         |
| `tests/contract/mission-composer.test.ts`                                                     | Operations end to end through the router.                                                |
| `tests/e2e/mission-composer.spec.ts`                                                          | Guided journey, drafts, states, revision.                                                |
| `tests/e2e/helpers/mission.ts`                                                                | `composeMissionViaUi` helper replacing the modal helper.                                 |
| `tests/e2e/supervisor-mission.spec.ts`, `accessibility.spec.ts`, `parity-screenshots.spec.ts` | Updated to the composer.                                                                 |

---

### Task 1: Contract additions

**Files:**

- Modify: `packages/contracts/src/protocol.ts` (operation and event name arrays)
- Modify: `packages/contracts/src/index.ts` (ErrorCode list ~line 318, mission schemas ~1896-1977, operations table ~2218, events table ~2676)
- Test: `tests/unit/contracts/mission-composer-schemas.test.ts`

**Interfaces:**

- Produces: `MissionWorkerInput.assignment`, `.requiredReturnEvidence`; `MissionEnvelopeInput.exclusions`; view counterparts with defaults; `MissionComposerStage`, `MissionComposerDraftState`, `MissionComposerFields`, `MissionComposerDraftSummaryView`, `MissionComposerDraftDetailView`, `MissionComposerSaveReceipt`, `MissionComposerChangedEvent`; operations `missionComposer.createDraft|listDrafts|getDraft|updateDraft|preview|confirm|previewDiscard|confirmDiscard`; codes `MISSION_DRAFT_NOT_FOUND|MISSION_DRAFT_STALE|MISSION_DRAFT_LIMIT|MISSION_DRAFT_SAVE_FAILED|MISSION_DRAFT_DISCARD_STALE|MISSION_CONFIRMATION_EXPIRED`.

- [ ] **Step 1: Write the failing schema test**

Create `tests/unit/contracts/mission-composer-schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ErrorCode,
  MissionBindingView,
  MissionComposerFields,
  MissionEnvelopeInput,
  MissionEnvelopeView,
  operationNames,
  eventNames,
} from '@threadhelm/contracts';

const uuid = '11111111-1111-4111-8111-111111111111';
const worker = {
  profileId: uuid,
  profileRevisionId: uuid,
  workspaceId: uuid,
  sessionId: null,
  role: 'worker',
  autoStart: false,
  runtimeSelection: { model: null, effort: null },
  permissionSelection: { policy: null, boundedAllowlist: [] },
  executionBounds: {
    maxElapsedMs: 1_800_000,
    maxTurns: 64,
    maxNoProgressMs: 300_000,
    maxOutputBytes: 8_388_608,
    maxConcurrentProcesses: 8,
  },
};
const envelope = {
  objective: 'Review a bounded local change.',
  completionEvidence: 'A cited report.',
  workspaces: [{ workspaceId: uuid, mode: 'write' }],
  supervisor: { profileId: uuid, profileRevisionId: uuid, sessionId: uuid },
  workers: [{ ...worker, assignment: 'Inspect the change.', requiredReturnEvidence: ['A report'] }],
  bounds: {
    maxElapsedMs: 1_800_000,
    maxTurns: 64,
    maxNoProgressMs: 300_000,
    maxOutputBytes: 8_388_608,
    maxConcurrentProcesses: 16,
    maxWorkers: 4,
    maxWorkItems: 64,
    maxDepth: 8,
    maxAttempts: 3,
    maxTokenBudget: 250_000,
  },
  permittedRoutineActions: ['decompose'],
  knownSafeRetryClasses: [],
  escalationRules: ['consequential', 'unknown', 'bounds', 'supervisor_loss'],
};

describe('mission composer contract additions', () => {
  it('requires assignment and return evidence on workers and defaults exclusions', () => {
    const parsed = MissionEnvelopeInput.parse(envelope);
    expect(parsed.exclusions).toEqual([]);
    expect(parsed.workers[0]!.requiredReturnEvidence).toEqual(['A report']);
    expect(MissionEnvelopeInput.safeParse({ ...envelope, workers: [worker] }).success).toBe(false);
    expect(
      MissionEnvelopeInput.safeParse({
        ...envelope,
        workers: [{ ...envelope.workers[0], requiredReturnEvidence: [] }],
      }).success,
    ).toBe(false);
    expect(
      MissionEnvelopeInput.safeParse({ ...envelope, exclusions: Array(9).fill('x') }).success,
    ).toBe(false);
  });

  it('view schemas default the new fields so pre-change envelopes still parse', () => {
    expect(MissionEnvelopeView.shape.exclusions.parse(undefined)).toEqual([]);
    expect(MissionBindingView.shape.assignment.parse(undefined)).toBeNull();
    expect(MissionBindingView.shape.requiredReturnEvidence.parse(undefined)).toEqual([]);
  });

  it('accepts a partial composer draft', () => {
    expect(MissionComposerFields.parse({})).toEqual({});
    expect(MissionComposerFields.parse({ objective: 'x' })).toEqual({ objective: 'x' });
    expect(MissionComposerFields.safeParse({ objective: 1 }).success).toBe(false);
  });

  it('names the composer operations, event and failure codes', () => {
    for (const name of [
      'missionComposer.createDraft',
      'missionComposer.listDrafts',
      'missionComposer.getDraft',
      'missionComposer.updateDraft',
      'missionComposer.preview',
      'missionComposer.confirm',
      'missionComposer.previewDiscard',
      'missionComposer.confirmDiscard',
    ])
      expect(operationNames).toContain(name);
    expect(eventNames).toContain('missionComposer.changed');
    for (const code of [
      'MISSION_DRAFT_NOT_FOUND',
      'MISSION_DRAFT_STALE',
      'MISSION_DRAFT_LIMIT',
      'MISSION_DRAFT_SAVE_FAILED',
      'MISSION_DRAFT_DISCARD_STALE',
      'MISSION_CONFIRMATION_EXPIRED',
    ])
      expect(ErrorCode.safeParse(code).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/contracts/mission-composer-schemas.test.ts`
Expected: FAIL, `MissionComposerFields` is not exported.

- [ ] **Step 3: Add the names**

In `packages/contracts/src/protocol.ts`, after `'missions.confirmDelete',` insert:

```ts
  'missionComposer.createDraft',
  'missionComposer.listDrafts',
  'missionComposer.getDraft',
  'missionComposer.updateDraft',
  'missionComposer.preview',
  'missionComposer.confirm',
  'missionComposer.previewDiscard',
  'missionComposer.confirmDiscard',
```

In `eventNames`, after `'mission.changed',` insert `'missionComposer.changed',`.

- [ ] **Step 4: Add the error codes**

In `packages/contracts/src/index.ts` `ErrorCode` list, after `'MISSION_AUTHORITY_REQUIRED',` insert:

```ts
  // mission composer drafts
  'MISSION_DRAFT_NOT_FOUND',
  'MISSION_DRAFT_STALE',
  'MISSION_DRAFT_LIMIT',
  'MISSION_DRAFT_SAVE_FAILED',
  'MISSION_DRAFT_DISCARD_STALE',
  'MISSION_CONFIRMATION_EXPIRED',
```

- [ ] **Step 5: Extend the mission schemas**

Replace `MissionWorkerInput` through `MissionEnvelopeView` (lines ~1897-1963) so the new fields exist. Only the changed lines are shown; keep every other field as it is.

```ts
const MissionAssignment = MissionText(2000);
const MissionEvidenceItem = MissionText(500);
const MissionWorkerInput = strictObject({
  profileId: Uuid,
  profileRevisionId: Uuid,
  workspaceId: Uuid,
  sessionId: Uuid.nullable(),
  role: z.enum(['worker', 'reviewer', 'triage']).default('worker'),
  autoStart: z.boolean(),
  runtimeSelection: LaunchRuntimeSelection,
  permissionSelection: LaunchPermissionSelection,
  executionBounds: ProviderExecutionBounds,
  /** One bounded contribution for this mission; mission authority, not profile data. */
  assignment: MissionAssignment,
  requiredReturnEvidence: z.array(MissionEvidenceItem).min(1).max(8),
}).refine(
  (v) => v.permissionSelection.policy !== 'break_glass_bypass',
  'mission bypass is prohibited',
);
export type MissionWorkerInput = z.infer<typeof MissionWorkerInput>;
export const MissionEnvelopeInput = strictObject({
  objective: MissionText(4000),
  completionEvidence: MissionText(2000),
  exclusions: z.array(MissionEvidenceItem).max(8).default([]),
  workspaces: z.array(MissionWorkspaceInput).min(1).max(16),
  supervisor: strictObject({ profileId: Uuid, profileRevisionId: Uuid, sessionId: Uuid }),
  workers: z.array(MissionWorkerInput).min(1).max(16),
  bounds: MissionBounds,
  permittedRoutineActions: z.array(MissionRoutineAction).min(1).max(6),
  knownSafeRetryClasses: z.array(z.literal('failed_before_effect')).max(1),
  escalationRules: z
    .array(z.enum(['consequential', 'unknown', 'bounds', 'supervisor_loss']))
    .min(4)
    .max(4),
});
```

In `MissionBindingView` add after `reasonCode: ReasonCode.nullable(),`:

```ts
  assignment: MissionAssignment.nullable().default(null),
  requiredReturnEvidence: z.array(MissionEvidenceItem).max(8).default([]),
```

In `MissionEnvelopeView` add after `completionEvidence: MissionText(2000),`:

```ts
  exclusions: z.array(MissionEvidenceItem).max(8).default([]),
```

- [ ] **Step 6: Add the draft schemas**

After `MissionPreviewView` (line ~1977) add:

```ts
export const MissionComposerStage = z.enum(['outcome', 'crew', 'access', 'review']);
export type MissionComposerStage = z.infer<typeof MissionComposerStage>;
export const MissionComposerDraftState = z.enum([
  'editing',
  'ready_for_review',
  'converted',
  'deleted',
]);
export type MissionComposerDraftState = z.infer<typeof MissionComposerDraftState>;
/** Every envelope key optional; element shapes match the envelope so a draft never lies. */
export const MissionComposerFields = strictObject({
  objective: z.string().max(4000).optional(),
  completionEvidence: z.string().max(2000).optional(),
  exclusions: z.array(z.string().max(500)).max(8).optional(),
  workspaces: z.array(MissionWorkspaceInput).max(16).optional(),
  supervisor: strictObject({
    profileId: Uuid.nullable(),
    profileRevisionId: Uuid.nullable(),
    sessionId: Uuid.nullable(),
  }).optional(),
  workers: z
    .array(
      strictObject({
        profileId: Uuid.nullable(),
        profileRevisionId: Uuid.nullable(),
        workspaceId: Uuid.nullable(),
        sessionId: Uuid.nullable(),
        role: z.enum(['worker', 'reviewer', 'triage']),
        autoStart: z.boolean(),
        runtimeSelection: LaunchRuntimeSelection,
        permissionSelection: LaunchPermissionSelection,
        executionBounds: ProviderExecutionBounds,
        assignment: z.string().max(2000),
        requiredReturnEvidence: z.array(z.string().max(500)).max(8),
      }),
    )
    .max(16)
    .optional(),
  bounds: MissionBounds.optional(),
  permittedRoutineActions: z.array(MissionRoutineAction).max(6).optional(),
});
export type MissionComposerFields = z.infer<typeof MissionComposerFields>;
const MissionComposerIssueCode = z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/);
export const MissionComposerDraftSummaryView = strictObject({
  draftId: Uuid,
  version: z.number().int().positive(),
  state: MissionComposerDraftState,
  currentStage: MissionComposerStage,
  sourceMissionId: Uuid.nullable(),
  issueCodes: z.array(MissionComposerIssueCode).max(20),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type MissionComposerDraftSummaryView = z.infer<typeof MissionComposerDraftSummaryView>;
export const MissionComposerDraftDetailView = strictObject({
  ...MissionComposerDraftSummaryView.shape,
  fieldValues: MissionComposerFields,
  convertedMissionId: Uuid.nullable(),
});
export type MissionComposerDraftDetailView = z.infer<typeof MissionComposerDraftDetailView>;
export const MissionComposerSaveReceipt = strictObject({
  draftId: Uuid,
  version: z.number().int().positive(),
  savedAt: Timestamp,
  currentStage: MissionComposerStage,
});
export type MissionComposerSaveReceipt = z.infer<typeof MissionComposerSaveReceipt>;
export const MissionComposerChangedEvent = strictObject({
  type: z.literal('missionComposer.changed'),
  draftId: Uuid,
  version: z.number().int().positive(),
  state: MissionComposerDraftState,
  currentStage: MissionComposerStage,
  occurredAt: Timestamp,
});
export type MissionComposerChangedEvent = z.infer<typeof MissionComposerChangedEvent>;
```

- [ ] **Step 7: Add the operations and event**

In the `operations` table, after `'missions.confirmDelete': {...},` add:

```ts
  'missionComposer.createDraft': {
    request: strictObject({ sourceMissionId: Uuid.optional() }).optional(),
    response: MissionComposerDraftDetailView,
  },
  'missionComposer.listDrafts': {
    request: strictObject({ limit: z.number().int().min(1).max(20).optional() }).optional(),
    response: strictObject({ drafts: z.array(MissionComposerDraftSummaryView).max(20) }),
  },
  'missionComposer.getDraft': {
    request: strictObject({ draftId: Uuid }),
    response: MissionComposerDraftDetailView,
  },
  'missionComposer.updateDraft': {
    request: strictObject({
      draftId: Uuid,
      expectedVersion: z.number().int().positive(),
      fieldValues: MissionComposerFields,
      currentStage: MissionComposerStage,
    }),
    response: MissionComposerSaveReceipt,
  },
  'missionComposer.preview': {
    request: strictObject({ draftId: Uuid, version: z.number().int().positive() }),
    response: strictObject({
      ...MissionPreviewView.shape,
      draftVersion: z.number().int().positive(),
    }),
  },
  'missionComposer.confirm': {
    request: strictObject({
      draftId: Uuid,
      version: z.number().int().positive(),
      previewToken: OpaqueToken,
    }),
    response: MissionDetailView,
  },
  'missionComposer.previewDiscard': {
    request: strictObject({ draftId: Uuid, version: z.number().int().positive() }),
    response: strictObject({
      discardToken: OpaqueToken,
      currentStage: MissionComposerStage,
      expiresAt: Timestamp,
    }),
  },
  'missionComposer.confirmDiscard': {
    request: strictObject({
      draftId: Uuid,
      version: z.number().int().positive(),
      discardToken: OpaqueToken,
    }),
    response: strictObject({
      draftId: Uuid,
      state: z.literal('deleted'),
      version: z.number().int().positive(),
      deletedAt: Timestamp,
    }),
  },
```

In the `events` table add `'missionComposer.changed': MissionComposerChangedEvent,` after `'mission.changed': MissionChangedEvent,`.

- [ ] **Step 8: Run to verify it passes, then typecheck**

Run: `pnpm test:unit -- tests/unit/contracts/mission-composer-schemas.test.ts && pnpm typecheck`
Expected: test PASS. Typecheck FAILS in `apps/desktop/src/main/coordinator.ts` (`Handlers` is exhaustive) and in every place that builds a `MissionWorkerInput` literal (`tests/e2e/helpers/mission.ts`, `tests/contract/helpers/supervisor-world.ts`, `MissionComposer.tsx`). Fix the fixtures now: add `assignment: 'Inspect the fixture and report.'` and `requiredReturnEvidence: ['A cited report']` to each worker literal in `tests/e2e/helpers/mission.ts` (`prepareFixtureMission`) and `tests/contract/helpers/supervisor-world.ts`. Leave `coordinator.ts` and `MissionComposer.tsx` for Tasks 3 and 4.

- [ ] **Step 9: Commit**

```bash
git add packages/contracts/src/protocol.ts packages/contracts/src/index.ts tests/unit/contracts/mission-composer-schemas.test.ts tests/e2e/helpers/mission.ts tests/contract/helpers/supervisor-world.ts
git commit -m "feat(contracts): mission composer drafts and worker assignment fields

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 2: Draft repository and migration

**Files:**

- Modify: `packages/persistence/src/schema.ts` (`SCHEMA_VERSION`, `MIGRATIONS`, `CURRENT_SCHEMA_EXTENSIONS`)
- Create: `packages/persistence/src/repositories/mission-composer.ts`
- Modify: `packages/persistence/src/repositories/index.ts`
- Test: `tests/unit/persistence/mission-composer.test.ts`

**Interfaces:**

- Consumes: `MissionComposerFields`, `MissionComposerStage`, `MissionComposerDraftState`, `ThreadHelmError` from contracts; `Db` from `../migrate.js`.
- Produces: `MissionComposerRepository` with `createDraft({ sourceMissionId, fieldValues, currentStage, createdAt }) => { draftId }`, `listDrafts(limit = 20) => MissionComposerDraftSummary[]`, `getDraft(draftId) => MissionComposerDraftDetail`, `updateDraft({ draftId, expectedVersion, fieldValues, currentStage, issueCodes, state, updatedAt }) => { version }`, `markConverted({ draftId, expectedVersion, missionId, convertedAt })`, `deleteDraft({ draftId, expectedVersion, deletedAt })`; `MAX_OPEN_MISSION_DRAFTS = 20`.

- [ ] **Step 1: Write the failing repository test**

Create `tests/unit/persistence/mission-composer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openStorage } from '@threadhelm/persistence';
import { MAX_OPEN_MISSION_DRAFTS } from '@threadhelm/persistence';

const AT = '2026-09-03T12:00:00.000Z';

function repo() {
  return openStorage(':memory:').repositories.missionComposer;
}

describe('mission composer drafts', () => {
  it('creates, reads and updates with expected versions', () => {
    const drafts = repo();
    const { draftId } = drafts.createDraft({
      sourceMissionId: null,
      fieldValues: {},
      currentStage: 'outcome',
      createdAt: AT,
    });
    const created = drafts.getDraft(draftId);
    expect(created).toMatchObject({ version: 1, state: 'editing', currentStage: 'outcome' });
    const saved = drafts.updateDraft({
      draftId,
      expectedVersion: 1,
      fieldValues: { objective: 'Fix it' },
      currentStage: 'crew',
      issueCodes: [],
      state: 'editing',
      updatedAt: AT,
    });
    expect(saved.version).toBe(2);
    expect(drafts.getDraft(draftId).fieldValues).toEqual({ objective: 'Fix it' });
    expect(() =>
      drafts.updateDraft({
        draftId,
        expectedVersion: 1,
        fieldValues: { objective: 'Stale' },
        currentStage: 'crew',
        issueCodes: [],
        state: 'editing',
        updatedAt: AT,
      }),
    ).toThrow(/MISSION_DRAFT_STALE/);
    expect(drafts.getDraft(draftId).fieldValues).toEqual({ objective: 'Fix it' });
  });

  it('lists open drafts without authored text and caps them at twenty', () => {
    const drafts = repo();
    for (let n = 0; n < MAX_OPEN_MISSION_DRAFTS; n++)
      drafts.createDraft({
        sourceMissionId: null,
        fieldValues: { objective: `secret ${n}` },
        currentStage: 'outcome',
        createdAt: AT,
      });
    expect(() =>
      drafts.createDraft({
        sourceMissionId: null,
        fieldValues: {},
        currentStage: 'outcome',
        createdAt: AT,
      }),
    ).toThrow(/MISSION_DRAFT_LIMIT/);
    const listed = drafts.listDrafts();
    expect(listed).toHaveLength(20);
    expect(JSON.stringify(listed)).not.toContain('secret');
  });

  it('marks conversion once and hides deleted drafts', () => {
    const drafts = repo();
    const { draftId } = drafts.createDraft({
      sourceMissionId: null,
      fieldValues: {},
      currentStage: 'review',
      createdAt: AT,
    });
    drafts.markConverted({
      draftId,
      expectedVersion: 1,
      missionId: '22222222-2222-4222-8222-222222222222',
      convertedAt: AT,
    });
    expect(drafts.getDraft(draftId)).toMatchObject({ state: 'converted', version: 2 });
    expect(drafts.listDrafts()).toHaveLength(0);
    expect(() =>
      drafts.updateDraft({
        draftId,
        expectedVersion: 2,
        fieldValues: {},
        currentStage: 'review',
        issueCodes: [],
        state: 'editing',
        updatedAt: AT,
      }),
    ).toThrow(/INVALID_STATE/);
    const other = drafts.createDraft({
      sourceMissionId: null,
      fieldValues: { objective: 'gone' },
      currentStage: 'outcome',
      createdAt: AT,
    });
    drafts.deleteDraft({ draftId: other.draftId, expectedVersion: 1, deletedAt: AT });
    expect(() => drafts.getDraft(other.draftId)).toThrow(/MISSION_DRAFT_NOT_FOUND/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/persistence/mission-composer.test.ts`
Expected: FAIL, `missionComposer` is undefined on repositories.

- [ ] **Step 3: Add the migration**

In `packages/persistence/src/schema.ts`, set `export const SCHEMA_VERSION = 5;` and add after `V4_RECON_PROVENANCE`:

```ts
const V5_MISSION_COMPOSER = `
CREATE TABLE mission_composer_drafts (
  id TEXT PRIMARY KEY,
  source_mission_id TEXT REFERENCES supervisor_missions (id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK (state IN ('editing', 'ready_for_review', 'converted', 'deleted')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  current_stage TEXT NOT NULL DEFAULT 'outcome'
    CHECK (current_stage IN ('outcome', 'crew', 'access', 'review')),
  field_values TEXT NOT NULL DEFAULT '{}' CHECK (length(CAST(field_values AS BLOB)) <= 65536),
  issue_codes TEXT NOT NULL DEFAULT '[]',
  converted_mission_id TEXT REFERENCES supervisor_missions (id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  converted_at TEXT,
  deleted_at TEXT
);
CREATE INDEX mission_composer_drafts_state ON mission_composer_drafts (state, updated_at, id);
`;
```

Append `{ version: 5, sql: V5_MISSION_COMPOSER },` to `MIGRATIONS` and
`{ table: 'mission_composer_drafts', sql: V5_MISSION_COMPOSER },` to `CURRENT_SCHEMA_EXTENSIONS`.

- [ ] **Step 4: Write the repository**

Create `packages/persistence/src/repositories/mission-composer.ts`:

```ts
import { randomUUID } from 'node:crypto';
import {
  MissionComposerFields,
  ThreadHelmError,
  type MissionComposerDraftState,
  type MissionComposerStage,
} from '@threadhelm/contracts';
import type { Db } from '../migrate.js';

export const MAX_OPEN_MISSION_DRAFTS = 20;
const OPEN_STATES = "('editing', 'ready_for_review')";
const STAGES: readonly MissionComposerStage[] = ['outcome', 'crew', 'access', 'review'];

export interface MissionComposerDraftSummary {
  draftId: string;
  version: number;
  state: MissionComposerDraftState;
  currentStage: MissionComposerStage;
  sourceMissionId: string | null;
  issueCodes: string[];
  createdAt: string;
  updatedAt: string;
}
export interface MissionComposerDraftDetail extends MissionComposerDraftSummary {
  fieldValues: MissionComposerFields;
  convertedMissionId: string | null;
}
interface Row {
  id: string;
  source_mission_id: string | null;
  state: MissionComposerDraftState;
  version: number;
  current_stage: MissionComposerStage;
  field_values: string;
  issue_codes: string;
  converted_mission_id: string | null;
  created_at: string;
  updated_at: string;
}

function notFound(): never {
  throw new ThreadHelmError('MISSION_DRAFT_NOT_FOUND', 'The mission draft was not found.');
}
function stale(): never {
  throw new ThreadHelmError('MISSION_DRAFT_STALE', 'The draft changed after it was displayed.');
}

/** Only Electron main calls this; a draft is local editing state and grants no authority. */
export class MissionComposerRepository {
  constructor(private readonly db: Db) {}

  private summary(row: Row): MissionComposerDraftSummary {
    return {
      draftId: row.id,
      version: row.version,
      state: row.state,
      currentStage: row.current_stage,
      sourceMissionId: row.source_mission_id,
      issueCodes: JSON.parse(row.issue_codes) as string[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private row(draftId: string): Row {
    const row = this.db
      .prepare('SELECT * FROM mission_composer_drafts WHERE id = ?')
      .get(draftId) as Row | undefined;
    if (!row || row.state === 'deleted') notFound();
    return row;
  }

  private mutable(draftId: string, expectedVersion: number): Row {
    const row = this.row(draftId);
    if (row.state === 'converted')
      throw new ThreadHelmError('INVALID_STATE', 'A converted draft is immutable.');
    if (!Number.isSafeInteger(expectedVersion) || row.version !== expectedVersion) stale();
    return row;
  }

  createDraft(input: {
    sourceMissionId: string | null;
    fieldValues: MissionComposerFields;
    currentStage: MissionComposerStage;
    createdAt: string;
  }): { draftId: string } {
    return this.db.transaction(() => {
      const open = this.db
        .prepare(
          `SELECT COUNT(*) AS count FROM mission_composer_drafts WHERE state IN ${OPEN_STATES}`,
        )
        .get() as { count: number };
      if (open.count >= MAX_OPEN_MISSION_DRAFTS)
        throw new ThreadHelmError('MISSION_DRAFT_LIMIT', 'Twenty drafts are already open.');
      if (!STAGES.includes(input.currentStage)) throw new ThreadHelmError('INVALID_REQUEST');
      const draftId = randomUUID();
      this.db
        .prepare(
          'INSERT INTO mission_composer_drafts (id, source_mission_id, state, current_stage, field_values, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          draftId,
          input.sourceMissionId,
          'editing',
          input.currentStage,
          JSON.stringify(MissionComposerFields.parse(input.fieldValues)),
          input.createdAt,
          input.createdAt,
        );
      return { draftId };
    })();
  }

  listDrafts(limit = 20): MissionComposerDraftSummary[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20)
      throw new ThreadHelmError('INVALID_REQUEST');
    const rows = this.db
      .prepare(
        `SELECT * FROM mission_composer_drafts WHERE state IN ${OPEN_STATES} ORDER BY updated_at DESC, id LIMIT ?`,
      )
      .all(limit) as Row[];
    return rows.map((row) => this.summary(row));
  }

  getDraft(draftId: string): MissionComposerDraftDetail {
    const row = this.row(draftId);
    return {
      ...this.summary(row),
      fieldValues: MissionComposerFields.parse(JSON.parse(row.field_values)),
      convertedMissionId: row.converted_mission_id,
    };
  }

  updateDraft(input: {
    draftId: string;
    expectedVersion: number;
    fieldValues: MissionComposerFields;
    currentStage: MissionComposerStage;
    issueCodes: string[];
    state: 'editing' | 'ready_for_review';
    updatedAt: string;
  }): { version: number } {
    return this.db.transaction(() => {
      const row = this.mutable(input.draftId, input.expectedVersion);
      if (!STAGES.includes(input.currentStage)) throw new ThreadHelmError('INVALID_REQUEST');
      this.db
        .prepare(
          'UPDATE mission_composer_drafts SET field_values = ?, current_stage = ?, state = ?, issue_codes = ?, version = version + 1, updated_at = ? WHERE id = ?',
        )
        .run(
          JSON.stringify(MissionComposerFields.parse(input.fieldValues)),
          input.currentStage,
          input.state,
          JSON.stringify(input.issueCodes),
          input.updatedAt,
          input.draftId,
        );
      return { version: row.version + 1 };
    })();
  }

  markConverted(input: {
    draftId: string;
    expectedVersion: number;
    missionId: string;
    convertedAt: string;
  }): void {
    this.db.transaction(() => {
      this.mutable(input.draftId, input.expectedVersion);
      this.db
        .prepare(
          "UPDATE mission_composer_drafts SET state = 'converted', converted_mission_id = ?, converted_at = ?, updated_at = ?, version = version + 1 WHERE id = ?",
        )
        .run(input.missionId, input.convertedAt, input.convertedAt, input.draftId);
    })();
  }

  deleteDraft(input: { draftId: string; expectedVersion: number; deletedAt: string }): void {
    this.db.transaction(() => {
      this.mutable(input.draftId, input.expectedVersion);
      this.db
        .prepare(
          "UPDATE mission_composer_drafts SET state = 'deleted', field_values = '{}', issue_codes = '[]', deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ?",
        )
        .run(input.deletedAt, input.deletedAt, input.draftId);
    })();
  }
}
```

- [ ] **Step 5: Register the repository**

In `packages/persistence/src/repositories/index.ts` add `import { MissionComposerRepository } from './mission-composer.js';`, add `missionComposer: MissionComposerRepository;` to `Repositories`, add `missionComposer: new MissionComposerRepository(db),` to `createRepositories`, and add `export * from './mission-composer.js';` with the other re-exports.

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm test:unit -- tests/unit/persistence && pnpm typecheck`
Expected: new test PASS; existing persistence tests still PASS (a migration test may assert `SCHEMA_VERSION`; update its expected value to 5 if it pins the number). Typecheck still fails only in `coordinator.ts` and `MissionComposer.tsx`.

- [ ] **Step 7: Commit**

```bash
git add packages/persistence/src/schema.ts packages/persistence/src/repositories/mission-composer.ts packages/persistence/src/repositories/index.ts tests/unit/persistence/mission-composer.test.ts
git commit -m "feat(persistence): mission composer draft store

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 3: Main service, handlers and test hook

**Files:**

- Create: `apps/desktop/src/main/coordination/mission-composer.ts`
- Modify: `apps/desktop/src/main/context.ts` (add `missionComposer?: MissionComposerService`)
- Modify: `apps/desktop/src/main/coordinator.ts` (handlers)
- Modify: `apps/desktop/src/main/coordination/mission-bindings.ts:224-233` (copy new fields)
- Modify: `apps/desktop/src/main/test-hooks.ts` (`advanceClock`)
- Modify: `tests/e2e/helpers/app.ts` (`advanceClock`, `breakStorage` on `LaunchedApp`)
- Test: `tests/contract/mission-composer.test.ts`

**Interfaces:**

- Consumes: `MissionComposerRepository` (Task 2), `SupervisorService.preview/confirm`, `Context.clock/events/storage/health`.
- Produces: `createMissionComposerService(ctx: Context, supervisor: SupervisorService): MissionComposerService` with methods matching the eight operations; `ctx.missionComposer`; test hooks `advanceClock(ms: number): void`.

- [ ] **Step 1: Write the failing contract test**

Create `tests/contract/mission-composer.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import type {
  MissionComposerDraftDetailView,
  MissionComposerSaveReceipt,
  MissionDetailView,
  MissionPreviewView,
} from '@threadhelm/contracts';
import { supervisorWorld } from './helpers/supervisor-world.js';
import { createWorld } from './helpers/fake-context.js';

type Preview = MissionPreviewView & { draftVersion: number };

describe('mission composer drafts', () => {
  let fixture: Awaited<ReturnType<typeof supervisorWorld>> | undefined;
  afterEach(() => fixture?.cleanup());

  it('creates, saves with expected versions and lists without authored text', async () => {
    const world = createWorld();
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.createDraft');
    expect(draft).toMatchObject({ version: 1, state: 'editing', currentStage: 'outcome' });
    const saved = await world.ok<MissionComposerSaveReceipt>('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { objective: 'secret objective' },
      currentStage: 'crew',
    });
    expect(saved.version).toBe(2);
    const stale = await world.call('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { objective: 'older' },
      currentStage: 'crew',
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('MISSION_DRAFT_STALE');
    const listed = await world.ok<{ drafts: unknown[] }>('missionComposer.listDrafts');
    expect(listed.drafts).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain('secret');
    expect(
      JSON.stringify(world.events.filter((e) => e.name === 'missionComposer.changed')),
    ).not.toContain('secret');
    const detail = await world.ok<MissionComposerDraftDetailView>('missionComposer.getDraft', {
      draftId: draft.draftId,
    });
    expect(detail.fieldValues.objective).toBe('secret objective');
  });

  it('previews an incomplete draft with field paths and converts a complete one atomically', async () => {
    fixture = await supervisorWorld();
    const { world, input } = fixture;
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.createDraft');
    const incomplete = await world.call('missionComposer.preview', {
      draftId: draft.draftId,
      version: draft.version,
    });
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) {
      expect(incomplete.error.code).toBe('INVALID_REQUEST');
      expect(String(incomplete.error.details['paths'])).toContain('objective');
    }
    const saved = await world.ok<MissionComposerSaveReceipt>('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: draft.version,
      fieldValues: input,
      currentStage: 'review',
    });
    const preview = await world.ok<Preview>('missionComposer.preview', {
      draftId: draft.draftId,
      version: saved.version,
    });
    expect(preview.draftVersion).toBe(saved.version);
    expect(preview.envelope.bindings.find((b) => b.role === 'worker')?.assignment).toBe(
      input.workers[0]!.assignment,
    );
    const mission = await world.ok<MissionDetailView>('missionComposer.confirm', {
      draftId: draft.draftId,
      version: saved.version,
      previewToken: preview.previewToken,
    });
    expect(mission.state).toBe('running');
    const after = await world.ok<MissionComposerDraftDetailView>('missionComposer.getDraft', {
      draftId: draft.draftId,
    });
    expect(after).toMatchObject({ state: 'converted', convertedMissionId: mission.id });
    const replay = await world.call('missionComposer.confirm', {
      draftId: draft.draftId,
      version: saved.version,
      previewToken: preview.previewToken,
    });
    expect(replay.ok).toBe(false);
  });

  it('rejects confirm after an edit and reports expiry by code', async () => {
    fixture = await supervisorWorld();
    const { world, input } = fixture;
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.createDraft');
    let saved = await world.ok<MissionComposerSaveReceipt>('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: draft.version,
      fieldValues: input,
      currentStage: 'review',
    });
    const preview = await world.ok<Preview>('missionComposer.preview', {
      draftId: draft.draftId,
      version: saved.version,
    });
    saved = await world.ok<MissionComposerSaveReceipt>('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: saved.version,
      fieldValues: { ...input, objective: 'Changed after preview' },
      currentStage: 'review',
    });
    const moved = await world.call('missionComposer.confirm', {
      draftId: draft.draftId,
      version: saved.version,
      previewToken: preview.previewToken,
    });
    expect(moved.ok).toBe(false);
    if (!moved.ok) expect(moved.error.code).toBe('MISSION_DRAFT_STALE');
    const again = await world.ok<Preview>('missionComposer.preview', {
      draftId: draft.draftId,
      version: saved.version,
    });
    world.clock.now += 121_000;
    const expired = await world.call('missionComposer.confirm', {
      draftId: draft.draftId,
      version: saved.version,
      previewToken: again.previewToken,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error.code).toBe('MISSION_CONFIRMATION_EXPIRED');
    expect(world.hosts).toHaveLength(1);
  });

  it('discards only with a matching version and token', async () => {
    const world = createWorld();
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.createDraft');
    const preview = await world.ok<{ discardToken: string }>('missionComposer.previewDiscard', {
      draftId: draft.draftId,
      version: draft.version,
    });
    await world.ok('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: draft.version,
      fieldValues: { objective: 'x' },
      currentStage: 'outcome',
    });
    const stale = await world.call('missionComposer.confirmDiscard', {
      draftId: draft.draftId,
      version: draft.version,
      discardToken: preview.discardToken,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('MISSION_DRAFT_DISCARD_STALE');
    const fresh = await world.ok<{ discardToken: string }>('missionComposer.previewDiscard', {
      draftId: draft.draftId,
      version: 2,
    });
    const gone = await world.ok<{ state: string }>('missionComposer.confirmDiscard', {
      draftId: draft.draftId,
      version: 2,
      discardToken: fresh.discardToken,
    });
    expect(gone.state).toBe('deleted');
    expect(
      (await world.ok<{ drafts: unknown[] }>('missionComposer.listDrafts')).drafts,
    ).toHaveLength(0);
  });

  it('seeds a revision draft from the mission input and applies through the revision path', async () => {
    fixture = await supervisorWorld();
    const { world, confirm } = fixture;
    const mission = await confirm();
    await world.ok('missions.pause', { missionId: mission.id });
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.createDraft', {
      sourceMissionId: mission.id,
    });
    expect(draft.currentStage).toBe('review');
    expect(draft.fieldValues.objective).toBe(mission.envelope!.objective);
    const saved = await world.ok<MissionComposerSaveReceipt>('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: draft.version,
      fieldValues: { ...draft.fieldValues, objective: 'Revised objective' },
      currentStage: 'review',
    });
    const preview = await world.ok<Preview>('missionComposer.preview', {
      draftId: draft.draftId,
      version: saved.version,
    });
    const revised = await world.ok<MissionDetailView>('missionComposer.confirm', {
      draftId: draft.draftId,
      version: saved.version,
      previewToken: preview.previewToken,
    });
    expect(revised.id).toBe(mission.id);
    expect(revised.version).toBe(mission.version + 1);
    expect(revised.envelope!.objective).toBe('Revised objective');
  });

  it('blocks drafts while storage is degraded', async () => {
    const world = createWorld({ degraded: true });
    const result = await world.call('missionComposer.createDraft');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STORAGE_UNAVAILABLE');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:contract -- tests/contract/mission-composer.test.ts`
Expected: FAIL, `Handlers` missing `missionComposer.*` (typecheck) or `Unknown operation`.

- [ ] **Step 3: Copy the new fields in the envelope view**

In `apps/desktop/src/main/coordination/mission-bindings.ts`, the `requests` array (line ~112) spreads `input.supervisor` for the supervisor entry; add `assignment: null, requiredReturnEvidence: []` to that supervisor object. In the `MissionBindingView.parse({...})` call (line ~200) add:

```ts
      assignment: request.assignment,
      requiredReturnEvidence: request.requiredReturnEvidence,
```

In the final `MissionEnvelopeView.parse({...})` add `exclusions: input.exclusions,` after `completionEvidence`.

- [ ] **Step 4: Write the service**

Create `apps/desktop/src/main/coordination/mission-composer.ts`:

```ts
import {
  MissionComposerChangedEvent,
  MissionComposerDraftDetailView,
  MissionComposerDraftSummaryView,
  MissionComposerFields,
  MissionEnvelopeInput,
  ThreadHelmError,
  TOKEN_TTL_MS,
  type MissionComposerStage,
  type OperationRequest,
  type OperationResponse,
} from '@threadhelm/contracts';
import type { Context } from '../context.js';
import { TokenStore } from '../tokens.js';
import type { SupervisorService } from './supervisor.js';

export interface MissionComposerService {
  createDraft(
    request: OperationRequest<'missionComposer.createDraft'>,
  ): OperationResponse<'missionComposer.createDraft'>;
  listDrafts(
    request: OperationRequest<'missionComposer.listDrafts'>,
  ): OperationResponse<'missionComposer.listDrafts'>;
  getDraft(
    request: OperationRequest<'missionComposer.getDraft'>,
  ): OperationResponse<'missionComposer.getDraft'>;
  updateDraft(
    request: OperationRequest<'missionComposer.updateDraft'>,
  ): OperationResponse<'missionComposer.updateDraft'>;
  preview(
    request: OperationRequest<'missionComposer.preview'>,
  ): Promise<OperationResponse<'missionComposer.preview'>>;
  confirm(
    request: OperationRequest<'missionComposer.confirm'>,
  ): Promise<OperationResponse<'missionComposer.confirm'>>;
  previewDiscard(
    request: OperationRequest<'missionComposer.previewDiscard'>,
  ): OperationResponse<'missionComposer.previewDiscard'>;
  confirmDiscard(
    request: OperationRequest<'missionComposer.confirmDiscard'>,
  ): OperationResponse<'missionComposer.confirmDiscard'>;
}

/** Turns a partial draft into an exact envelope or names every missing path. */
function envelopeOf(fields: MissionComposerFields): MissionEnvelopeInput {
  const parsed = MissionEnvelopeInput.safeParse(fields);
  if (parsed.success) return parsed.data;
  const paths = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
  throw new ThreadHelmError('INVALID_REQUEST', 'The draft is not complete.', {
    paths: paths.join(','),
  });
}

export function createMissionComposerService(
  ctx: Context,
  supervisor: SupervisorService,
): MissionComposerService {
  const repo = () => {
    if (!ctx.storage || ctx.health.degraded)
      throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Mission draft storage is unavailable.');
    return ctx.storage.repositories;
  };
  const now = () => ctx.clock().toISOString();
  const discards = new TokenStore<{ draftId: string; version: number }>(TOKEN_TTL_MS, () =>
    ctx.clock().getTime(),
  );
  /** Preview issue per draft; confirm checks it before touching the supervisor token. */
  const previews = new Map<string, { version: number; expiresAt: number; revision: boolean }>();
  const detail = (draftId: string) =>
    MissionComposerDraftDetailView.parse(repo().missionComposer.getDraft(draftId));
  const emit = (draftId: string) => {
    const draft = repo().missionComposer.getDraft(draftId);
    ctx.events.emit(
      'missionComposer.changed',
      MissionComposerChangedEvent.parse({
        type: 'missionComposer.changed',
        draftId,
        version: draft.version,
        state: draft.state,
        currentStage: draft.currentStage,
        occurredAt: now(),
      }),
    );
  };

  return {
    createDraft(request) {
      const source = request?.sourceMissionId ?? null;
      let fieldValues: MissionComposerFields = {};
      let currentStage: MissionComposerStage = 'outcome';
      if (source) {
        const mission = repo().supervisor.detail(source);
        if (!mission.input) throw new ThreadHelmError('MISSION_NOT_FOUND');
        fieldValues = MissionComposerFields.parse(mission.input);
        currentStage = 'review';
      }
      const { draftId } = repo().missionComposer.createDraft({
        sourceMissionId: source,
        fieldValues,
        currentStage,
        createdAt: now(),
      });
      emit(draftId);
      return detail(draftId);
    },
    listDrafts(request) {
      return {
        drafts: repo()
          .missionComposer.listDrafts(request?.limit ?? 20)
          .map((item) => MissionComposerDraftSummaryView.parse(item)),
      };
    },
    getDraft({ draftId }) {
      return detail(draftId);
    },
    updateDraft(request) {
      const complete = MissionEnvelopeInput.safeParse(request.fieldValues).success;
      let version: number;
      try {
        version = repo().missionComposer.updateDraft({
          draftId: request.draftId,
          expectedVersion: request.expectedVersion,
          fieldValues: request.fieldValues,
          currentStage: request.currentStage,
          issueCodes: [],
          state: complete && request.currentStage === 'review' ? 'ready_for_review' : 'editing',
          updatedAt: now(),
        }).version;
      } catch (error) {
        if (error instanceof ThreadHelmError) throw error;
        throw new ThreadHelmError('MISSION_DRAFT_SAVE_FAILED', 'The draft could not be saved.');
      }
      previews.delete(request.draftId);
      emit(request.draftId);
      return {
        draftId: request.draftId,
        version,
        savedAt: now(),
        currentStage: request.currentStage,
      };
    },
    async preview({ draftId, version }) {
      const draft = repo().missionComposer.getDraft(draftId);
      if (draft.version !== version) throw new ThreadHelmError('MISSION_DRAFT_STALE');
      const envelope = envelopeOf(draft.fieldValues);
      const revision = draft.sourceMissionId !== null;
      const view = await supervisor.preview(
        revision
          ? {
              missionId: draft.sourceMissionId!,
              expectedVersion: repo().supervisor.mission(draft.sourceMissionId!).version,
              envelope,
            }
          : { envelope },
      );
      previews.set(draftId, { version, expiresAt: Date.parse(view.expiresAt), revision });
      return { ...view, draftVersion: version };
    },
    async confirm({ draftId, version, previewToken }) {
      const draft = repo().missionComposer.getDraft(draftId);
      const issued = previews.get(draftId);
      if (draft.version !== version || !issued || issued.version !== version)
        throw new ThreadHelmError(
          'MISSION_DRAFT_STALE',
          'Review the mission again before starting.',
        );
      if (issued.expiresAt <= ctx.clock().getTime()) {
        previews.delete(draftId);
        throw new ThreadHelmError(
          'MISSION_CONFIRMATION_EXPIRED',
          'The review expired. Return to access and limits for a fresh approval.',
        );
      }
      const mission = await supervisor.confirm(
        { previewToken, boundaryConfirmation: true },
        issued.revision,
      );
      previews.delete(draftId);
      repo().missionComposer.markConverted({
        draftId,
        expectedVersion: version,
        missionId: mission.id,
        convertedAt: now(),
      });
      emit(draftId);
      return mission;
    },
    previewDiscard({ draftId, version }) {
      const draft = repo().missionComposer.getDraft(draftId);
      if (draft.version !== version) throw new ThreadHelmError('MISSION_DRAFT_DISCARD_STALE');
      const issued = discards.issue({ draftId, version });
      return {
        discardToken: issued.token,
        currentStage: draft.currentStage,
        expiresAt: issued.expiresAt,
      };
    },
    confirmDiscard({ draftId, version, discardToken }) {
      const payload = discards.take(discardToken);
      if (!payload || payload.draftId !== draftId || payload.version !== version)
        throw new ThreadHelmError('MISSION_DRAFT_DISCARD_STALE', 'Preview the discard again.');
      const deletedAt = now();
      try {
        repo().missionComposer.deleteDraft({ draftId, expectedVersion: version, deletedAt });
      } catch (error) {
        if (error instanceof ThreadHelmError && error.code === 'MISSION_DRAFT_STALE')
          throw new ThreadHelmError('MISSION_DRAFT_DISCARD_STALE', 'Preview the discard again.');
        throw error;
      }
      ctx.events.emit(
        'missionComposer.changed',
        MissionComposerChangedEvent.parse({
          type: 'missionComposer.changed',
          draftId,
          version: version + 1,
          state: 'deleted',
          currentStage: 'outcome',
          occurredAt: deletedAt,
        }),
      );
      return { draftId, state: 'deleted' as const, version: version + 1, deletedAt };
    },
  };
}
```

Note: `supervisor.confirm` is not atomic with `markConverted` across two SQLite transactions. Wrap both in `repo().transaction(() => ...)` is impossible because `supervisor.confirm` is async (revalidation probes). Accept the ordering: mission first, mark second; if marking fails the draft stays open and the mission exists, which the next `listDrafts` shows. Record this as `// ponytail: mission commit then draft mark; a crash between leaves an open draft, never a lost mission.`

- [ ] **Step 5: Wire context and handlers**

In `apps/desktop/src/main/context.ts` after `supervisor?: SupervisorService;` add:

```ts
  /** Main-owned mission draft authority; drafts grant nothing. */
  missionComposer?: MissionComposerService;
```

with `import type { MissionComposerService } from './coordination/mission-composer.js';`.

In `apps/desktop/src/main/coordinator.ts`, after `ctx.supervisor = supervisor;` add:

```ts
const missionComposer = ctx.missionComposer ?? createMissionComposerService(ctx, supervisor);
ctx.missionComposer = missionComposer;
```

and in the returned handlers, after `'missions.confirmDelete'`:

```ts
    'missionComposer.createDraft': (request) => missionComposer.createDraft(request),
    'missionComposer.listDrafts': (request) => missionComposer.listDrafts(request),
    'missionComposer.getDraft': (request) => missionComposer.getDraft(request),
    'missionComposer.updateDraft': (request) => missionComposer.updateDraft(request),
    'missionComposer.preview': (request) => missionComposer.preview(request),
    'missionComposer.confirm': (request) => missionComposer.confirm(request),
    'missionComposer.previewDiscard': (request) => missionComposer.previewDiscard(request),
    'missionComposer.confirmDiscard': (request) => missionComposer.confirmDiscard(request),
```

- [ ] **Step 6: Add the clock hook**

In `apps/desktop/src/main/test-hooks.ts` add `advanceClock(ms: number): void;` to `TestHooks` and, in the hooks object:

```ts
    advanceClock: (ms) => {
      const base = ctx.clock;
      ctx.clock = () => new Date(base().getTime() + ms);
    },
```

Services that captured `ctx.clock` by reference at construction (`MissionDisclosures`, `TokenStore`) call `ctx.clock()` lazily through the closure `() => ctx.clock().getTime()`, so reassigning `ctx.clock` moves them too. In `tests/e2e/helpers/app.ts` add to `LaunchedApp`:

```ts
  advanceClock(ms: number): Promise<void>;
  breakStorage(): Promise<void>;
```

and to `launched`:

```ts
      advanceClock: (ms) => hooks('hooks.advanceClock(arg)', ms),
      breakStorage: () => hooks('hooks.breakStorage()'),
```

- [ ] **Step 7: Run to verify it passes**

Run: `pnpm typecheck && pnpm test:contract -- tests/contract/mission-composer.test.ts tests/contract/supervisor.test.ts`
Expected: typecheck fails only in `MissionComposer.tsx` (fixed in Task 4); both contract files PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/main/coordination/mission-composer.ts apps/desktop/src/main/coordination/mission-bindings.ts apps/desktop/src/main/context.ts apps/desktop/src/main/coordinator.ts apps/desktop/src/main/test-hooks.ts tests/e2e/helpers/app.ts tests/contract/mission-composer.test.ts
git commit -m "feat(main): mission composer draft service over the supervisor preview

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 4: Keep the old modal and detail honest until deletion

**Files:**

- Modify: `apps/desktop/src/renderer/features/coordination/MissionComposer.tsx` (worker fieldset ~line 416-642; `MissionEnvelopeDisclosure` ~81-162)
- Modify: `apps/desktop/src/renderer/features/coordination/MissionDetail.tsx:129-167`
- Modify: `apps/desktop/src/renderer/features/mission-focus/reason-labels.ts`
- Test: `tests/unit/renderer/reason-labels.test.ts`, `tests/e2e/supervisor-mission.spec.ts`

**Interfaces:**

- Produces: green typecheck and green existing e2e; labels for the six new codes.

- [ ] **Step 1: Add reason labels and their test**

Append to `tests/unit/renderer/reason-labels.test.ts`:

```ts
it('labels every mission draft code as a sentence', () => {
  for (const code of [
    'MISSION_DRAFT_NOT_FOUND',
    'MISSION_DRAFT_STALE',
    'MISSION_DRAFT_LIMIT',
    'MISSION_DRAFT_SAVE_FAILED',
    'MISSION_DRAFT_DISCARD_STALE',
    'MISSION_CONFIRMATION_EXPIRED',
  ]) {
    expect(REASON_LABELS[code]).toMatch(/^[A-Z].*\.$/);
    expect(REASON_LABELS[code]).not.toMatch(/[A-Z]{3,}_/);
  }
});
```

Add to `REASON_LABELS`:

```ts
  MISSION_DRAFT_NOT_FOUND: 'That mission draft no longer exists.',
  MISSION_DRAFT_STALE: 'This draft was saved elsewhere. Reload it before continuing.',
  MISSION_DRAFT_LIMIT: 'Twenty drafts are already open. Finish or discard one first.',
  MISSION_DRAFT_SAVE_FAILED: 'Your draft could not be saved. Nothing has been discarded.',
  MISSION_DRAFT_DISCARD_STALE: 'The draft changed since the discard preview. Preview it again.',
  MISSION_CONFIRMATION_EXPIRED:
    'The review expired. Return to access and limits for a fresh approval.',
```

Run: `pnpm test:unit -- tests/unit/renderer/reason-labels.test.ts` → PASS.

- [ ] **Step 2: Give the modal the two fields**

In `MissionComposer.tsx`, where "Add worker" pushes a new worker object (line ~643-664), add `assignment: ''` and `requiredReturnEvidence: []` to the literal. Inside each worker fieldset, after the role select, add:

```tsx
            <label className="field">
              Worker {index + 1} assignment
              <textarea
                rows={2}
                value={worker.assignment}
                onChange={(event) => workerPatch(index, { assignment: event.target.value })}
              />
            </label>
            <AllowedToolsInput
              label={`Worker ${index + 1} return evidence`}
              value={worker.requiredReturnEvidence}
              onChange={(value) => workerPatch(index, { requiredReturnEvidence: value })}
            />
```

Extend `valid` with `&& workers.every((w) => w.assignment.trim() && w.requiredReturnEvidence.length > 0)`. In `review()` add `exclusions: current?.input?.exclusions ?? [],` to the envelope literal.

In `MissionEnvelopeDisclosure` add after the completion evidence paragraph:

```tsx
{
  preview.envelope.exclusions.length ? (
    <p>Outside this mission: {preview.envelope.exclusions.join('; ')}</p>
  ) : null;
}
```

and inside each binding fieldset, after the automatic-startup paragraph:

```tsx
{
  binding.assignment ? <p>Assignment: {binding.assignment}</p> : null;
}
{
  binding.requiredReturnEvidence.length ? (
    <p>Must bring back: {binding.requiredReturnEvidence.join('; ')}</p>
  ) : null;
}
```

- [ ] **Step 3: Show the fields in mission detail**

In `MissionDetail.tsx` after the `Completion evidence` paragraph add:

```tsx
{
  detail.envelope.exclusions.length ? (
    <>
      <h3>Outside this mission</h3>
      <ul>
        {detail.envelope.exclusions.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  ) : null;
}
```

and inside each binding `<details>`, before the `<pre>`:

```tsx
{
  binding.assignment ? <p>Assignment: {binding.assignment}</p> : null;
}
{
  binding.requiredReturnEvidence.length ? (
    <p>Must bring back: {binding.requiredReturnEvidence.join('; ')}</p>
  ) : null;
}
```

- [ ] **Step 4: Update the modal e2e helper**

In `tests/e2e/supervisor-mission.spec.ts` `createMission`, after selecting `Worker 1 session`, add:

```ts
await dialog.getByLabel('Worker 1 assignment', { exact: true }).fill('Inspect the change.');
await dialog.getByLabel('Worker 1 return evidence', { exact: true }).fill('A cited report');
```

Apply the same two lines in the "offline worker review" test after `Worker 1 profile` is selected.

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm desktop:build && pnpm exec playwright test tests/e2e/supervisor-mission.spec.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer/features/coordination/MissionComposer.tsx apps/desktop/src/renderer/features/coordination/MissionDetail.tsx apps/desktop/src/renderer/features/mission-focus/reason-labels.ts tests/unit/renderer/reason-labels.test.ts tests/e2e/supervisor-mission.spec.ts
git commit -m "feat(renderer): assignment and evidence in the modal, detail and labels

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 5: Composer fields, defaults and readiness

**Files:**

- Create: `apps/desktop/src/renderer/features/mission-composer/composer-fields.ts`
- Test: `tests/unit/renderer/composer-fields.test.ts`

**Interfaces:**

- Consumes: `MissionComposerFields`, `MissionEnvelopeInput`, `MissionComposerStage` from contracts.
- Produces:
  - `STAGES: readonly MissionComposerStage[]`, `STAGE_LABEL: Record<Stage, string>`, `CONTINUE_LABEL: Record<Stage, string>`
  - `DEFAULT_BOUNDS`, `DEFAULT_WORKER_EXECUTION_BOUNDS`, `newWorker(): WorkerFields`
  - `stageReadiness(stage, fields, context): { ready: boolean; message: string; firstInvalid: string | null }`
  - `limitsSummary(bounds): string`, `runtimeSummary(worker): string`, `accessReason(mode): string`
  - `envelopeFrom(fields): MissionEnvelopeInput` (throws `Error` with `.paths` on incomplete)

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/renderer/composer-fields.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CONTINUE_LABEL,
  DEFAULT_BOUNDS,
  envelopeFrom,
  limitsSummary,
  newWorker,
  runtimeSummary,
  stageReadiness,
} from '../../../apps/desktop/src/renderer/features/mission-composer/composer-fields.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const context = { hasProfiles: true, hasEligibleSessions: true };

describe('composer fields', () => {
  it('names continue buttons by destination', () => {
    expect(CONTINUE_LABEL.outcome).toBe('Continue to crew');
    expect(CONTINUE_LABEL.crew).toBe('Continue to access and limits');
    expect(CONTINUE_LABEL.access).toBe('Continue to review');
  });

  it('outcome readiness names the missing field and focuses it', () => {
    expect(stageReadiness('outcome', {}, context)).toEqual({
      ready: false,
      message: 'Add a finish line so the coordinator knows what done means.',
      firstInvalid: 'objective',
    });
    expect(stageReadiness('outcome', { objective: 'Fix the flaky test.' }, context)).toMatchObject({
      ready: false,
      firstInvalid: 'completionEvidence',
    });
    expect(
      stageReadiness(
        'outcome',
        { objective: 'Fix the flaky test.', completionEvidence: 'Green run, three times.' },
        context,
      ),
    ).toMatchObject({ ready: true, firstInvalid: null });
  });

  it('crew readiness explains prerequisites before fields', () => {
    expect(
      stageReadiness('crew', {}, { hasProfiles: false, hasEligibleSessions: true }),
    ).toMatchObject({
      ready: false,
      message: 'No reviewed profile yet. Create an agent first.',
    });
    const worker = { ...newWorker(), profileId: uuid, profileRevisionId: uuid };
    expect(
      stageReadiness(
        'crew',
        {
          supervisor: { profileId: uuid, profileRevisionId: uuid, sessionId: uuid },
          workers: [worker],
        },
        context,
      ),
    ).toMatchObject({ ready: false, firstInvalid: 'workers.0.assignment' });
    expect(
      stageReadiness(
        'crew',
        {
          supervisor: { profileId: uuid, profileRevisionId: uuid, sessionId: uuid },
          workers: [{ ...worker, assignment: 'Inspect.', requiredReturnEvidence: ['A report'] }],
        },
        context,
      ),
    ).toMatchObject({ ready: true });
  });

  it('access readiness needs one workspace per worker', () => {
    const worker = {
      ...newWorker(),
      profileId: uuid,
      profileRevisionId: uuid,
      assignment: 'Inspect.',
      requiredReturnEvidence: ['A report'],
    };
    expect(stageReadiness('access', { workers: [worker] }, context)).toMatchObject({
      ready: false,
      firstInvalid: 'workers.0.workspaceId',
    });
    expect(
      stageReadiness(
        'access',
        {
          workers: [{ ...worker, workspaceId: uuid }],
          workspaces: [{ workspaceId: uuid, mode: 'read' }],
        },
        context,
      ),
    ).toMatchObject({ ready: true });
  });

  it('summarizes defaults in words', () => {
    expect(limitsSummary(DEFAULT_BOUNDS)).toBe(
      'Stops after 30 minutes, 64 turns, 5 minutes without progress or 8 MiB of output; at most 4 workers, 64 work items, depth 8, 3 attempts, 250,000 tokens.',
    );
    expect(runtimeSummary(newWorker())).toBe(
      'Provider default model · provider default effort · manual permission · starts only when you launch it',
    );
  });

  it('assembles an exact envelope or lists the missing paths', () => {
    expect(() => envelopeFrom({})).toThrow(/objective/);
    const worker = {
      ...newWorker(),
      profileId: uuid,
      profileRevisionId: uuid,
      workspaceId: uuid,
      assignment: 'Inspect.',
      requiredReturnEvidence: ['A report'],
    };
    const envelope = envelopeFrom({
      objective: 'Fix it.',
      completionEvidence: 'Green.',
      supervisor: { profileId: uuid, profileRevisionId: uuid, sessionId: uuid },
      workers: [worker],
      workspaces: [{ workspaceId: uuid, mode: 'write' }],
    });
    expect(envelope.bounds).toEqual(DEFAULT_BOUNDS);
    expect(envelope.escalationRules).toHaveLength(4);
    expect(envelope.exclusions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/renderer/composer-fields.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the module**

Create `apps/desktop/src/renderer/features/mission-composer/composer-fields.ts`:

```ts
import {
  MissionEnvelopeInput,
  type MissionBounds,
  type MissionComposerFields,
  type MissionComposerStage,
} from '@threadhelm/contracts';

export type Stage = MissionComposerStage;
export type WorkerFields = NonNullable<MissionComposerFields['workers']>[number];
export type SupervisorFields = NonNullable<MissionComposerFields['supervisor']>;

export const STAGES: readonly Stage[] = ['outcome', 'crew', 'access', 'review'];
export const STAGE_LABEL: Record<Stage, string> = {
  outcome: 'Outcome',
  crew: 'Crew',
  access: 'Access & limits',
  review: 'Review',
};
export const STAGE_HEADING: Record<Stage, string> = {
  outcome: 'Define one finish line.',
  crew: 'Choose who does the work.',
  access: 'Set where the mission may work and when it must stop.',
  review: 'Review the exact mission before anything starts.',
};
export const CONTINUE_LABEL: Record<Exclude<Stage, 'review'>, string> = {
  outcome: 'Continue to crew',
  crew: 'Continue to access and limits',
  access: 'Continue to review',
};

export const DEFAULT_WORKER_EXECUTION_BOUNDS = {
  maxElapsedMs: 1_800_000,
  maxTurns: 64,
  maxNoProgressMs: 300_000,
  maxOutputBytes: 8_388_608,
  maxConcurrentProcesses: 8,
};
export const DEFAULT_BOUNDS: MissionBounds = {
  ...DEFAULT_WORKER_EXECUTION_BOUNDS,
  maxConcurrentProcesses: 16,
  maxWorkers: 4,
  maxWorkItems: 64,
  maxDepth: 8,
  maxAttempts: 3,
  maxTokenBudget: 250_000,
};
export const BOUND_LABELS: Record<keyof MissionBounds, string> = {
  maxElapsedMs: 'Elapsed limit (ms)',
  maxTurns: 'Turn limit',
  maxNoProgressMs: 'No-progress limit (ms)',
  maxOutputBytes: 'Output limit (bytes)',
  maxConcurrentProcesses: 'Process limit',
  maxWorkers: 'Concurrent worker limit',
  maxWorkItems: 'Work item limit',
  maxDepth: 'Decomposition depth limit',
  maxAttempts: 'Attempt limit',
  maxTokenBudget: 'Token budget',
};
const ROUTINE_ACTIONS = ['decompose', 'assign', 'retry', 'reassign', 'pause', 'complete'] as const;

export function newWorker(): WorkerFields {
  return {
    profileId: null,
    profileRevisionId: null,
    workspaceId: null,
    sessionId: null,
    role: 'worker',
    autoStart: false,
    runtimeSelection: { model: null, effort: null },
    permissionSelection: { policy: null, boundedAllowlist: [] },
    executionBounds: DEFAULT_WORKER_EXECUTION_BOUNDS,
    assignment: '',
    requiredReturnEvidence: [],
  };
}

export interface ReadinessContext {
  hasProfiles: boolean;
  hasEligibleSessions: boolean;
}
export interface Readiness {
  ready: boolean;
  message: string;
  firstInvalid: string | null;
}
const ready = (message: string): Readiness => ({ ready: true, message, firstInvalid: null });
const blocked = (message: string, firstInvalid: string | null): Readiness => ({
  ready: false,
  message,
  firstInvalid,
});
const filled = (value: string | undefined) => Boolean(value && value.trim());

export function stageReadiness(
  stage: Stage,
  fields: MissionComposerFields,
  context: ReadinessContext,
): Readiness {
  const workers = fields.workers ?? [];
  switch (stage) {
    case 'outcome':
      if (!filled(fields.objective))
        return blocked('Add a finish line so the coordinator knows what done means.', 'objective');
      if (!filled(fields.completionEvidence))
        return blocked('Say what proof shows the mission is complete.', 'completionEvidence');
      return ready(
        'Ready to choose the crew. The coordinator can recognize completion without interpreting a task list.',
      );
    case 'crew': {
      if (!context.hasProfiles)
        return blocked('No reviewed profile yet. Create an agent first.', null);
      if (!context.hasEligibleSessions)
        return blocked('No live session can supervise yet. Launch a session first.', null);
      if (!fields.supervisor?.profileId)
        return blocked('Choose a supervisor profile.', 'supervisor.profileId');
      if (!fields.supervisor.sessionId)
        return blocked('Choose the live session that supervises.', 'supervisor.sessionId');
      if (workers.length === 0) return blocked('Add at least one worker.', 'workers');
      for (const [index, worker] of workers.entries()) {
        if (!worker.profileId)
          return blocked(`Choose a profile for worker ${index + 1}.`, `workers.${index}.profileId`);
        if (!filled(worker.assignment))
          return blocked(
            `Say what worker ${index + 1} contributes.`,
            `workers.${index}.assignment`,
          );
        if (worker.requiredReturnEvidence.length === 0)
          return blocked(
            `Add one thing worker ${index + 1} must bring back.`,
            `workers.${index}.requiredReturnEvidence`,
          );
      }
      return ready(
        'Crew is covered. Every worker has one contribution and at least one piece of return evidence.',
      );
    }
    case 'access': {
      for (const [index, worker] of workers.entries())
        if (!worker.workspaceId)
          return blocked(
            `Choose an approved folder for worker ${index + 1}.`,
            `workers.${index}.workspaceId`,
          );
      const ids = new Set(workers.map((w) => w.workspaceId));
      for (const id of ids)
        if (!(fields.workspaces ?? []).some((w) => w.workspaceId === id))
          return blocked('Choose read or write for every folder.', 'workspaces');
      return ready('Workspace and runtimes are ready. Continue to review the exact mission.');
    }
    case 'review':
      return ready('Review the exact mission, then start it.');
  }
}

const minutes = (ms: number) => `${Math.round(ms / 60_000)} minutes`;
const mib = (bytes: number) => `${Math.round(bytes / 1_048_576)} MiB`;
export function limitsSummary(bounds: MissionBounds): string {
  return `Stops after ${minutes(bounds.maxElapsedMs)}, ${bounds.maxTurns} turns, ${minutes(
    bounds.maxNoProgressMs,
  )} without progress or ${mib(bounds.maxOutputBytes)} of output; at most ${bounds.maxWorkers} workers, ${
    bounds.maxWorkItems
  } work items, depth ${bounds.maxDepth}, ${bounds.maxAttempts} attempts, ${bounds.maxTokenBudget.toLocaleString(
    'en-US',
  )} tokens.`;
}
export function runtimeSummary(worker: WorkerFields): string {
  const model = worker.runtimeSelection.model ?? 'Provider default model';
  const effort = worker.runtimeSelection.effort ?? 'provider default effort';
  const permission =
    worker.permissionSelection.policy === 'bounded_allowlist'
      ? 'allow-listed tools'
      : worker.permissionSelection.policy
        ? worker.permissionSelection.policy.replaceAll('_', ' ')
        : 'manual permission';
  const start = worker.autoStart
    ? 'starts automatically inside the mission'
    : 'starts only when you launch it';
  return `${model} · ${effort} · ${permission} · ${start}`;
}
export function accessReason(mode: 'read' | 'write'): string {
  return mode === 'read'
    ? 'Read: this worker inspects files and reports.'
    : 'Write: this worker changes files inside this folder only.';
}

export class IncompleteDraft extends Error {
  constructor(readonly paths: string[]) {
    super(`Draft incomplete: ${paths.join(', ')}`);
  }
}
/** Same parse main runs; the renderer uses it only to explain, never to authorize. */
export function envelopeFrom(fields: MissionComposerFields): MissionEnvelopeInput {
  const candidate = {
    ...fields,
    exclusions: fields.exclusions ?? [],
    bounds: fields.bounds ?? DEFAULT_BOUNDS,
    permittedRoutineActions: fields.permittedRoutineActions ?? [...ROUTINE_ACTIONS],
    knownSafeRetryClasses: ['failed_before_effect'],
    escalationRules: ['consequential', 'unknown', 'bounds', 'supervisor_loss'],
  };
  const parsed = MissionEnvelopeInput.safeParse(candidate);
  if (!parsed.success)
    throw new IncompleteDraft([...new Set(parsed.error.issues.map((i) => i.path.join('.')))]);
  return parsed.data;
}
/** Fields the main service will parse; strips nothing, adds the fixed policy arrays. */
export function fieldsForSave(fields: MissionComposerFields): MissionComposerFields {
  return {
    ...fields,
    exclusions: fields.exclusions ?? [],
    bounds: fields.bounds ?? DEFAULT_BOUNDS,
    permittedRoutineActions: fields.permittedRoutineActions ?? [...ROUTINE_ACTIONS],
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit -- tests/unit/renderer/composer-fields.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/features/mission-composer/composer-fields.ts tests/unit/renderer/composer-fields.test.ts
git commit -m "feat(renderer): composer field model, defaults and readiness copy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 6: Composer workspace shell, autosave and the Outcome stage

**Files:**

- Create: `apps/desktop/src/renderer/features/mission-composer/useDraft.ts`
- Create: `apps/desktop/src/renderer/features/mission-composer/MissionComposerWorkspace.tsx`
- Create: `apps/desktop/src/renderer/features/mission-composer/OutcomeStage.tsx`
- Create: `apps/desktop/src/renderer/features/mission-composer/ListEditor.tsx`
- Create: `apps/desktop/src/renderer/features/mission-composer/DraftBanner.tsx`
- Modify: `apps/desktop/src/renderer/styles/mission-composer.css` (replace stub)
- Modify: `apps/desktop/src/renderer/App.tsx` (`composerDraftId`, workspace branch, rail `onCreate`)
- Modify: `apps/desktop/src/renderer/store.tsx` (`missionComposer.changed` → `missionEvent`)
- Test: `tests/e2e/mission-composer.spec.ts` (first test)

**Interfaces:**

- Consumes: Task 5 exports; `api.missionComposer.*`.
- Produces:
  - `useDraft(draftId): { draft, fields, setFields(patch), stage, goTo(stage), saveNow(): Promise<Receipt|null>, saving, failure, retry(), close(): Promise<boolean> }`
  - `MissionComposerWorkspace({ draftId, onClose(), onStarted(mission) })`
  - `ListEditor({ label, items, max, onChange, itemMax })`
  - `DraftBanner({ failure, onRetry, onDiscard })`
  - stage components receive `{ fields, setFields, readiness, context }` (defined in Task 7 for Crew/Access, Task 9 for Review).

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/mission-composer.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { launchApp } from './helpers/app.js';
import { teardown } from './helpers/ui.js';

test.setTimeout(90_000);

test('new mission opens the guided composer in the workspace and autosaves the outcome', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    await expect(page.getByRole('button', { name: 'Create mission', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'New mission…', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const heading = page.getByRole('heading', { name: 'Define one finish line.' });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText('Step 1 of 4 · Outcome')).toBeVisible();
    await expect(page.getByRole('listbox', { name: 'Missions' })).toBeVisible();
    const next = page.getByRole('button', { name: 'Continue to crew', exact: true });
    await expect(next).toBeDisabled();
    await expect(
      page.getByText('Add a finish line so the coordinator knows what done means.'),
    ).toBeVisible();
    await page.getByLabel('Finish line', { exact: true }).fill('Fix the flaky terminal test.');
    await page
      .getByLabel('Proof of completion', { exact: true })
      .fill('Three green runs in a row.');
    await page.getByLabel('Outside this mission', { exact: true }).fill('Rewriting xterm');
    await page.getByRole('button', { name: 'Add to outside this mission', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Rewriting xterm' })).toBeVisible();
    await expect(next).toBeEnabled();
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByText('Your mission draft is saved locally.')).toBeVisible();
    await expect(page.getByText('Still off: access, permissions, launch')).toBeVisible();
    await page.getByRole('button', { name: 'Close composer', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Start a mission' })).toBeVisible();
    await page.getByRole('button', { name: /^Resume draft · Outcome/ }).click();
    await expect(page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Fix the flaky terminal test.',
    );
  } finally {
    await teardown(app);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-composer.spec.ts`
Expected: FAIL, `Create mission` button still present / no composer heading.

- [ ] **Step 3: Write `useDraft.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MissionComposerDraftDetailView,
  MissionComposerFields,
  MissionComposerSaveReceipt,
} from '@threadhelm/contracts';
import { api, call, errorCode } from '../../api.js';
import { fieldsForSave, type Stage } from './composer-fields.js';

const SAVE_DELAY_MS = 800;

export interface DraftFailure {
  code: string;
  savedElsewhere?: MissionComposerDraftDetailView;
}

export function useDraft(draftId: string) {
  const [draft, setDraft] = useState<MissionComposerDraftDetailView | null>(null);
  const [fields, setFieldsState] = useState<MissionComposerFields>({});
  const [stage, setStage] = useState<Stage>('outcome');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<DraftFailure | null>(null);
  const [receipt, setReceipt] = useState<MissionComposerSaveReceipt | null>(null);
  const version = useRef(0);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ fields: MissionComposerFields; stage: Stage }>({
    fields: {},
    stage: 'outcome',
  });

  useEffect(() => {
    let cancelled = false;
    void call(api.missionComposer.getDraft({ draftId }))
      .then((loaded) => {
        if (cancelled) return;
        setDraft(loaded);
        setFieldsState(loaded.fieldValues);
        setStage(loaded.currentStage);
        version.current = loaded.version;
        latest.current = { fields: loaded.fieldValues, stage: loaded.currentStage };
      })
      .catch((cause) => setFailure({ code: errorCode(cause) }));
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draftId]);

  const saveNow = useCallback(async (): Promise<MissionComposerSaveReceipt | null> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current && receipt) return receipt;
    setSaving(true);
    try {
      const saved = await call(
        api.missionComposer.updateDraft({
          draftId,
          expectedVersion: version.current,
          fieldValues: fieldsForSave(latest.current.fields),
          currentStage: latest.current.stage,
        }),
      );
      version.current = saved.version;
      dirty.current = false;
      setReceipt(saved);
      setFailure(null);
      return saved;
    } catch (cause) {
      const code = errorCode(cause);
      if (code === 'MISSION_DRAFT_STALE') {
        const elsewhere = await call(api.missionComposer.getDraft({ draftId })).catch(() => null);
        setFailure({ code, ...(elsewhere ? { savedElsewhere: elsewhere } : {}) });
      } else setFailure({ code });
      return null;
    } finally {
      setSaving(false);
    }
  }, [draftId, receipt]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow(), SAVE_DELAY_MS);
  }, [saveNow]);

  const setFields = useCallback(
    (patch: Partial<MissionComposerFields>) => {
      setFieldsState((old) => {
        const next = { ...old, ...patch };
        latest.current = { ...latest.current, fields: next };
        return next;
      });
      dirty.current = true;
      schedule();
    },
    [schedule],
  );

  const goTo = useCallback(
    async (next: Stage) => {
      latest.current = { ...latest.current, stage: next };
      dirty.current = true;
      const saved = await saveNow();
      if (saved) setStage(next);
      return saved !== null;
    },
    [saveNow],
  );

  const useSavedVersion = useCallback(() => {
    const elsewhere = failure?.savedElsewhere;
    if (!elsewhere) return;
    setFieldsState(elsewhere.fieldValues);
    setStage(elsewhere.currentStage);
    version.current = elsewhere.version;
    latest.current = { fields: elsewhere.fieldValues, stage: elsewhere.currentStage };
    dirty.current = false;
    setFailure(null);
  }, [failure]);

  const keepMyEdits = useCallback(() => {
    const elsewhere = failure?.savedElsewhere;
    if (!elsewhere) return;
    version.current = elsewhere.version;
    dirty.current = true;
    setFailure(null);
    void saveNow();
  }, [failure, saveNow]);

  return {
    draft,
    fields,
    setFields,
    stage,
    goTo,
    saveNow,
    saving,
    failure,
    receipt,
    version: () => version.current,
    retry: saveNow,
    useSavedVersion,
    keepMyEdits,
  };
}
```

- [ ] **Step 4: Write `ListEditor.tsx`**

```tsx
import { useId, useState } from 'react';

export function ListEditor({
  label,
  items,
  max,
  itemMax = 500,
  hint,
  onChange,
}: {
  label: string;
  items: string[];
  max: number;
  itemMax?: number;
  hint?: string;
  onChange(items: string[]): void;
}) {
  const [text, setText] = useState('');
  const id = useId();
  const add = () => {
    const value = text.trim();
    if (!value || items.length >= max) return;
    onChange([...items, value.slice(0, itemMax)]);
    setText('');
  };
  const lower = label.charAt(0).toLowerCase() + label.slice(1);
  return (
    <div className="composer-list-editor">
      <label className="field" htmlFor={id}>
        {label}
      </label>
      {hint ? <p className="hint">{hint}</p> : null}
      <div className="composer-list-row">
        <input
          id={id}
          value={text}
          maxLength={itemMax}
          disabled={items.length >= max}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="small"
          onClick={add}
          disabled={!text.trim() || items.length >= max}
        >
          Add to {lower}
        </button>
      </div>
      {items.length ? (
        <ul className="composer-list" aria-label={label}>
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>
              <span>{item}</span>
              <button
                type="button"
                className="small"
                aria-label={`Remove ${item}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="hint">
        {items.length} of {max}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Write `DraftBanner.tsx`**

```tsx
import { reasonLabel } from '../mission-focus/reason-labels.js';
import type { DraftFailure } from './useDraft.js';

export function DraftBanner({
  failure,
  storageDegraded,
  onRetry,
  onKeepEditing,
  onDiscard,
  onUseSaved,
  onKeepMine,
}: {
  failure: DraftFailure | null;
  storageDegraded: boolean;
  onRetry(): void;
  onKeepEditing(): void;
  onDiscard(): void;
  onUseSaved(): void;
  onKeepMine(): void;
}) {
  if (!failure && !storageDegraded) return null;
  if (failure?.savedElsewhere)
    return (
      <div className="banner composer-banner" role="alert">
        <p>{reasonLabel('MISSION_DRAFT_STALE')}</p>
        <div className="actions">
          <button type="button" onClick={onUseSaved}>
            Use saved version
          </button>
          <button type="button" onClick={onKeepMine}>
            Keep my edits
          </button>
        </div>
      </div>
    );
  return (
    <div className="banner error composer-banner" role="alert">
      <p>
        {storageDegraded
          ? 'Local storage is degraded. Your draft cannot be saved right now, and nothing has been discarded.'
          : reasonLabel(failure?.code ?? 'MISSION_DRAFT_SAVE_FAILED')}
      </p>
      <div className="actions">
        <button type="button" onClick={onRetry} disabled={storageDegraded}>
          Retry
        </button>
        <button type="button" onClick={onKeepEditing}>
          Keep editing
        </button>
        <button type="button" className="danger" onClick={onDiscard}>
          Discard draft…
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `OutcomeStage.tsx`**

```tsx
import type { MissionComposerFields } from '@threadhelm/contracts';
import { ListEditor } from './ListEditor.js';

export interface StageProps {
  fields: MissionComposerFields;
  setFields(patch: Partial<MissionComposerFields>): void;
  invalid: string | null;
}

export function OutcomeStage({ fields, setFields, invalid }: StageProps) {
  return (
    <div className="composer-stage-body">
      <label className="field">
        Finish line
        <span className="hint">
          One sentence a coordinator can check. Keep it narrow enough that everyone recognizes done.
        </span>
        <textarea
          rows={3}
          maxLength={4000}
          value={fields.objective ?? ''}
          aria-invalid={invalid === 'objective' || undefined}
          data-field="objective"
          onChange={(event) => setFields({ objective: event.target.value })}
        />
      </label>
      <label className="field">
        Proof of completion
        <span className="hint">What evidence shows the finish line was reached.</span>
        <textarea
          rows={2}
          maxLength={2000}
          value={fields.completionEvidence ?? ''}
          aria-invalid={invalid === 'completionEvidence' || undefined}
          data-field="completionEvidence"
          onChange={(event) => setFields({ completionEvidence: event.target.value })}
        />
      </label>
      <ListEditor
        label="Outside this mission"
        hint="Optional. Boundaries stop useful work from quietly widening the mission."
        items={fields.exclusions ?? []}
        max={8}
        onChange={(exclusions) => setFields({ exclusions })}
      />
    </div>
  );
}
```

- [ ] **Step 7: Write `MissionComposerWorkspace.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MissionDetailView, OperationResponse } from '@threadhelm/contracts';
import { api, call, errorCode } from '../../api.js';
import { useStore } from '../../store.js';
import { reasonLabel } from '../mission-focus/reason-labels.js';
import {
  CONTINUE_LABEL,
  STAGES,
  STAGE_HEADING,
  STAGE_LABEL,
  stageReadiness,
  type Stage,
} from './composer-fields.js';
import { DraftBanner } from './DraftBanner.js';
import { OutcomeStage } from './OutcomeStage.js';
import { useDraft } from './useDraft.js';

type Profile = OperationResponse<'profiles.list'>['profiles'][number];
type Eligible = OperationResponse<'missions.eligibleSessions'>[number];

export function MissionComposerWorkspace({
  draftId,
  onClose,
  onStarted,
}: {
  draftId: string;
  onClose(): void;
  onStarted(mission: MissionDetailView): void;
}) {
  const { state, actions } = useStore();
  const draft = useDraft(draftId);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const [closing, setClosing] = useState<{ savedAt: string; stage: Stage } | null>(null);
  const [discarding, setDiscarding] = useState<{ token: string; stage: Stage } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [invalid, setInvalid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      call(api.profiles.list({ state: 'active', limit: 100 })),
      call(api.missions.eligibleSessions(undefined)),
    ])
      .then(([roster, sessions]) => {
        if (cancelled) return;
        setProfiles(roster.profiles);
        setEligible(sessions);
        setLoadError(null);
      })
      .catch((cause) => !cancelled && setLoadError(cause));
    return () => {
      cancelled = true;
    };
  }, [state.profilesSequence, state.missionSequence]);

  const stage = draft.stage;
  const index = STAGES.indexOf(stage);
  const context = { hasProfiles: profiles.length > 0, hasEligibleSessions: eligible.length > 0 };
  const readiness = useMemo(
    () => stageReadiness(stage, draft.fields, context),
    [stage, draft.fields, context.hasProfiles, context.hasEligibleSessions],
  );

  useEffect(() => {
    heading.current?.focus();
    setAnnouncement(`Step ${index + 1} of 4, ${STAGE_LABEL[stage]}`);
    setInvalid(null);
  }, [stage, index]);
  useEffect(() => {
    if (draft.receipt) setAnnouncement('Draft saved');
  }, [draft.receipt]);

  const blocked = state.storageDegraded || draft.failure !== null;
  const isRevision = draft.draft?.sourceMissionId !== null && draft.draft !== null;

  const focusInvalid = (path: string | null) => {
    setInvalid(path);
    if (!path) return;
    requestAnimationFrame(() => {
      body.current?.querySelector<HTMLElement>(`[data-field="${path}"]`)?.focus();
    });
  };
  const advance = async () => {
    if (!readiness.ready) return focusInvalid(readiness.firstInvalid);
    const next = STAGES[index + 1];
    if (next) await draft.goTo(next);
  };
  const back = async () => {
    const prev = STAGES[index - 1];
    if (prev) await draft.goTo(prev);
  };
  const close = async () => {
    const saved = await draft.saveNow();
    if (saved) setClosing({ savedAt: saved.savedAt, stage: saved.currentStage });
  };
  const startDiscard = async () => {
    try {
      const preview = await call(
        api.missionComposer.previewDiscard({ draftId, version: draft.version() }),
      );
      setDiscarding({ token: preview.discardToken, stage: preview.currentStage });
    } catch (cause) {
      actions.setNotice(reasonLabel(errorCode(cause)) ?? 'The discard could not be prepared.');
    }
  };
  const confirmDiscard = async () => {
    if (!discarding) return;
    try {
      await call(
        api.missionComposer.confirmDiscard({
          draftId,
          version: draft.version(),
          discardToken: discarding.token,
        }),
      );
      onClose();
    } catch (cause) {
      setDiscarding(null);
      actions.setNotice(reasonLabel(errorCode(cause)) ?? 'The draft was not discarded.');
    }
  };

  if (closing)
    return (
      <section className="composer-receipt" aria-labelledby="composer-receipt-heading">
        <p className="eyebrow">Mission draft · saved</p>
        <h1 id="composer-receipt-heading" tabIndex={-1} ref={heading}>
          Your mission draft is saved locally.
        </h1>
        <dl className="composer-receipt-grid">
          <div>
            <dt>Saved</dt>
            <dd>{new Date(closing.savedAt).toLocaleTimeString()}</dd>
          </div>
          <div>
            <dt>Resume point</dt>
            <dd>{STAGE_LABEL[closing.stage]}</dd>
          </div>
          <div>
            <dt>Still off</dt>
            <dd>Still off: access, permissions, launch</dd>
          </div>
        </dl>
        <p>A draft is not mission authority. Nothing was launched or granted access.</p>
        <div className="mission-action-row">
          <button type="button" onClick={() => setClosing(null)}>
            Keep editing
          </button>
          <button type="button" className="primary" onClick={onClose}>
            Close composer
          </button>
        </div>
      </section>
    );

  return (
    <section className="composer" aria-labelledby="composer-heading">
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <DraftBanner
        failure={draft.failure}
        storageDegraded={state.storageDegraded}
        onRetry={() => void draft.retry()}
        onKeepEditing={() => setAnnouncement('Keep editing. Nothing was discarded.')}
        onDiscard={() => void startDiscard()}
        onUseSaved={draft.useSavedVersion}
        onKeepMine={draft.keepMyEdits}
      />
      <ol className="composer-strip" aria-label="Mission stages">
        {STAGES.map((item, i) => (
          <li
            key={item}
            aria-current={item === stage ? 'step' : undefined}
            data-done={i < index || undefined}
          >
            {i < index ? (
              <button type="button" className="small" onClick={() => void draft.goTo(item)}>
                {STAGE_LABEL[item]}
              </button>
            ) : (
              <span>{STAGE_LABEL[item]}</span>
            )}
          </li>
        ))}
      </ol>
      <p className="eyebrow">
        Step {index + 1} of 4 · {STAGE_LABEL[stage]}
        {isRevision ? ' · Revise mission' : ''}
      </p>
      <h1 id="composer-heading" tabIndex={-1} ref={heading}>
        {STAGE_HEADING[stage]}
      </h1>
      {loadError ? <p className="notice">{reasonLabel(errorCode(loadError))}</p> : null}
      <div ref={body}>
        {stage === 'outcome' ? (
          <OutcomeStage fields={draft.fields} setFields={draft.setFields} invalid={invalid} />
        ) : null}
        {/* Task 7 mounts CrewStage and AccessStage; Task 9 mounts ReviewStage. */}
      </div>
      <p className={`composer-readiness${readiness.ready ? ' ready' : ''}`} role="status">
        {readiness.message}
      </p>
      <div className="mission-action-row composer-actions">
        <button type="button" onClick={() => void close()} disabled={blocked || draft.saving}>
          Close
        </button>
        {index > 0 ? (
          <button type="button" onClick={() => void back()} disabled={draft.saving}>
            Back
          </button>
        ) : null}
        {stage !== 'review' ? (
          <button
            type="button"
            className="primary"
            disabled={!readiness.ready || blocked || draft.saving}
            onClick={() => void advance()}
          >
            {CONTINUE_LABEL[stage]}
          </button>
        ) : null}
      </div>
      {discarding ? (
        <div className="composer-discard" role="dialog" aria-labelledby="composer-discard-heading">
          <h2 id="composer-discard-heading">Discard this draft?</h2>
          <p>
            The draft at {STAGE_LABEL[discarding.stage]} will be deleted. Nothing else changes; no
            mission exists yet.
          </p>
          <div className="mission-action-row">
            <button type="button" onClick={() => setDiscarding(null)}>
              Keep draft
            </button>
            <button type="button" className="danger" onClick={() => void confirmDiscard()}>
              Discard draft
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
```

`onStarted` is unused until Task 9; keep the prop in the signature so the App wiring does not change later.

- [ ] **Step 8: Wire App and store**

In `store.tsx` subscriptions add `api.on('missionComposer.changed', () => dispatch({ type: 'missionEvent' })),` next to the `mission.changed` line.

In `App.tsx`:

- Replace `const [creatingMission, setCreatingMission] = useState(false);` with `const [composerDraftId, setComposerDraftId] = useState<string | null>(null);`.
- Add:

```tsx
const openComposer = (sourceMissionId?: string) => {
  void call(api.missionComposer.createDraft(sourceMissionId ? { sourceMissionId } : undefined))
    .then((draft) => setComposerDraftId(draft.draftId))
    .catch((cause) =>
      actions.setNotice(reasonLabel(errorCode(cause)) ?? 'The draft could not be created.'),
    );
};
```

with `import { reasonLabel } from './features/mission-focus/reason-labels.js';` and `import { MissionComposerWorkspace } from './features/mission-composer/MissionComposerWorkspace.js';`.

- `MissionRail onCreate={() => openComposer()}`.
- Workspace prop becomes:

```tsx
          composerDraftId ? (
            <MissionComposerWorkspace
              draftId={composerDraftId}
              onClose={() => setComposerDraftId(null)}
              onStarted={(mission) => {
                setComposerDraftId(null);
                actions.selectMission(mission.id);
                setDetailMissionId(mission.id);
              }}
            />
          ) : missionSelected ? (
            <MissionWorkspace
              workspace={workspace}
              onResumeDraft={setComposerDraftId}
              ...
```

- Remove the `{creatingMission ? <MissionComposer .../> : null}` block and the `MissionComposer` import.

In `MissionWorkspace.tsx` replace the `onCreate` prop with `onResumeDraft(draftId: string): void` and rewrite the empty state:

```tsx
<div className="mission-workspace-state">
  <h1 tabIndex={-1}>Start a mission</h1>
  <p>
    Use <strong>New mission…</strong> in the rail. You will describe one outcome, choose the crew,
    set access and limits, then review the exact mission before anything starts.
  </p>
  <DraftList onResume={onResumeDraft} />
</div>
```

Create `DraftList` in `apps/desktop/src/renderer/features/mission-composer/DraftList.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { MissionComposerDraftSummaryView } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { STAGE_LABEL } from './composer-fields.js';

function relative(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export function DraftList({ onResume }: { onResume(draftId: string): void }) {
  const { state } = useStore();
  const [drafts, setDrafts] = useState<MissionComposerDraftSummaryView[]>([]);
  useEffect(() => {
    let cancelled = false;
    void call(api.missionComposer.listDrafts(undefined))
      .then((page) => !cancelled && setDrafts(page.drafts))
      .catch(() => !cancelled && setDrafts([]));
    return () => {
      cancelled = true;
    };
  }, [state.missionSequence]);
  if (!drafts.length) return null;
  return (
    <section className="composer-drafts" aria-labelledby="composer-drafts-heading">
      <h2 id="composer-drafts-heading">Drafts</h2>
      <ul className="list">
        {drafts.map((draft) => (
          <li key={draft.draftId}>
            <button type="button" className="small" onClick={() => onResume(draft.draftId)}>
              Resume draft · {STAGE_LABEL[draft.currentStage]} · {relative(draft.updatedAt)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 9: Styles**

Replace `apps/desktop/src/renderer/styles/mission-composer.css`:

```css
.composer,
.composer-receipt {
  padding: clamp(1rem, 3vw, 2.25rem);
  max-width: 56rem;
  min-width: 0;
}
.composer h1,
.composer-receipt h1 {
  font-family: var(--mission-font-heading);
  font-size: clamp(1.4rem, 2.4vw, 2rem);
  margin: 0.25rem 0 0.75rem;
}
.composer h1:focus,
.composer-receipt h1:focus {
  outline: var(--mission-focus-ring);
  outline-offset: 4px;
}
.composer-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  counter-reset: stage;
}
.composer-strip li {
  counter-increment: stage;
  color: var(--muted);
}
.composer-strip li::before {
  content: counter(stage) '. ';
}
.composer-strip li[aria-current='step'] {
  color: var(--text);
  font-weight: 600;
}
.composer-strip li[data-done] {
  color: var(--mission-verdigris);
}
.composer-stage-body {
  display: grid;
  gap: 1rem;
}
.composer-stage-body .field {
  display: grid;
  gap: 0.35rem;
}
.composer-stage-body textarea,
.composer-stage-body input,
.composer-stage-body select {
  max-width: 100%;
  min-width: 0;
}
.composer-readiness {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border-left: 4px solid var(--mission-copper);
  background: var(--mission-fog);
}
.composer-readiness.ready {
  border-left-color: var(--mission-verdigris);
}
.composer-actions {
  position: sticky;
  bottom: 0;
  padding: 0.75rem 0;
  background: var(--mission-paper);
  justify-content: flex-start;
}
.composer-list-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.composer-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}
.composer-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: baseline;
  overflow-wrap: anywhere;
}
.composer-banner {
  display: grid;
  gap: 0.5rem;
}
.composer-card {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  display: grid;
  gap: 0.75rem;
}
.composer-card > details > summary {
  cursor: pointer;
}
.composer-notice {
  border: 1px solid var(--border);
  border-left: 4px solid var(--mission-steel);
  padding: 0.75rem 1rem;
  display: grid;
  gap: 0.5rem;
}
.composer-receipt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}
.composer-receipt-grid dt {
  color: var(--muted);
  font-size: 0.85rem;
}
.composer-discard {
  border: 1px solid var(--danger);
  padding: 1rem;
  margin-top: 1rem;
}
@container workspace (max-width: 40rem) {
  .composer-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
```

- [ ] **Step 10: Run to verify it passes**

Run: `pnpm typecheck && pnpm lint && pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-composer.spec.ts`
Expected: PASS. The other e2e suites that opened the modal will fail until Task 10; do not run them yet.

- [ ] **Step 11: Friendliness gate**

Walk the Outcome stage in the built app (`pnpm dev`) and confirm every line of the gate list at the top of this plan. In particular: the readiness sentence names the missing field, the heading is a sentence, the close receipt states the resume point and "Still off".

- [ ] **Step 12: Commit**

```bash
git add apps/desktop/src/renderer/features/mission-composer apps/desktop/src/renderer/styles/mission-composer.css apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/store.tsx apps/desktop/src/renderer/features/mission-focus/MissionWorkspace.tsx tests/e2e/mission-composer.spec.ts
git commit -m "feat(renderer): guided composer shell with autosave and the outcome stage

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 7: Crew stage with prerequisite notices

**Files:**

- Create: `apps/desktop/src/renderer/features/mission-composer/CrewStage.tsx`
- Modify: `apps/desktop/src/renderer/features/mission-composer/MissionComposerWorkspace.tsx` (mount, pass profiles/eligible, prerequisite actions)
- Test: `tests/e2e/mission-composer.spec.ts` (two tests)

**Interfaces:**

- Consumes: `StageProps` (Task 6), `newWorker`, `runtimeSummary` (Task 5), `profiles.list` and `missions.eligibleSessions` responses.
- Produces: `CrewStage({ ...StageProps, profiles, eligible, loading, loadError, onCreateAgent(), onLaunchSession(), onRetryLoad() })`.

- [ ] **Step 1: Write the failing e2e tests**

Append to `tests/e2e/mission-composer.spec.ts`:

```ts
import { missionProfile, missionSession } from './helpers/mission.js';
import { launchWithFixtures, tempWorkspace } from './helpers/ui.js';

async function fillOutcome(app: Awaited<ReturnType<typeof launchApp>>) {
  const page = app.page;
  await page.getByRole('button', { name: 'New mission…', exact: true }).click();
  await page.getByLabel('Finish line', { exact: true }).fill('Fix the flaky terminal test.');
  await page.getByLabel('Proof of completion', { exact: true }).fill('Three green runs.');
  await page.getByRole('button', { name: 'Continue to crew', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose who does the work.' })).toBeFocused();
}

test('crew stage explains prerequisites and routes to the fix', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    await fillOutcome(app);
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByText('No reviewed profile yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Create agent', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Choose or create the right worker' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Missions', exact: true }).click();
    await page.getByRole('button', { name: /^Resume draft · Crew/ }).click();
    await expect(page.getByText('No reviewed profile yet.')).toBeVisible();
  } finally {
    await teardown(app);
  }
});

test('crew stage names every missing worker field and collapses runtime under a summary', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-crew');
  try {
    const page = app.page;
    const leader = await missionProfile(app, 'Crew coordinator');
    const worker = await missionProfile(app, 'Crew worker');
    const session = await missionSession(app, dir);
    await page.reload();
    await fillOutcome(app);
    await page
      .getByRole('combobox', { name: 'Supervisor profile', exact: true })
      .selectOption(leader.profileId);
    await page
      .getByRole('combobox', { name: 'Supervisor session', exact: true })
      .selectOption(session.id);
    const next = page.getByRole('button', { name: 'Continue to access and limits', exact: true });
    await expect(next).toBeDisabled();
    await expect(page.getByText('Add at least one worker.')).toBeVisible();
    await page.getByRole('button', { name: 'Add worker', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Worker 1 profile', exact: true })
      .selectOption(worker.profileId);
    await expect(page.getByText('Say what worker 1 contributes.')).toBeVisible();
    await page
      .getByLabel('What worker 1 contributes', { exact: true })
      .fill('Reproduce and fix the test.');
    await expect(page.getByText('Add one thing worker 1 must bring back.')).toBeVisible();
    await page
      .getByLabel('What worker 1 must bring back', { exact: true })
      .fill('A passing run log');
    await page
      .getByRole('button', { name: 'Add to what worker 1 must bring back', exact: true })
      .click();
    await expect(next).toBeEnabled();
    const runtime = page.getByRole('group', { name: 'Worker 1' }).locator('details');
    await expect(runtime.locator('summary')).toContainText('Provider default model');
    await expect(runtime.locator('summary')).toContainText('starts only when you launch it');
    await expect(page.getByLabel('Worker 1 model', { exact: true })).toBeHidden();
    await runtime.locator('summary').click();
    await expect(page.getByLabel('Worker 1 model', { exact: true })).toBeVisible();
    await next.click();
    await expect(
      page.getByRole('heading', { name: 'Set where the mission may work and when it must stop.' }),
    ).toBeFocused();
  } finally {
    await teardown(app, dir);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-composer.spec.ts -g "crew stage"`
Expected: FAIL, "No reviewed profile yet." not found.

- [ ] **Step 3: Write `CrewStage.tsx`**

```tsx
import type { OperationResponse } from '@threadhelm/contracts';
import { ListEditor } from './ListEditor.js';
import type { StageProps } from './OutcomeStage.js';
import { newWorker, runtimeSummary, type WorkerFields } from './composer-fields.js';

type Profile = OperationResponse<'profiles.list'>['profiles'][number];
type Eligible = OperationResponse<'missions.eligibleSessions'>[number];

export function CrewStage({
  fields,
  setFields,
  invalid,
  profiles,
  eligible,
  loading,
  loadError,
  onCreateAgent,
  onLaunchSession,
  onRetryLoad,
}: StageProps & {
  profiles: Profile[];
  eligible: Eligible[];
  loading: boolean;
  loadError: boolean;
  onCreateAgent(): void;
  onLaunchSession(): void;
  onRetryLoad(): void;
}) {
  if (loading) return <p role="status">Loading profiles…</p>;
  if (loadError)
    return (
      <div className="composer-notice">
        <p>Profiles could not be loaded.</p>
        <button type="button" className="small" onClick={onRetryLoad}>
          Retry
        </button>
      </div>
    );
  if (profiles.length === 0)
    return (
      <div className="composer-notice">
        <p>
          No reviewed profile yet. A profile is needed before a supervisor or worker can be chosen.
        </p>
        <button type="button" className="primary" onClick={onCreateAgent}>
          Create agent
        </button>
      </div>
    );
  if (eligible.length === 0)
    return (
      <div className="composer-notice">
        <p>
          No live session can supervise yet. Launch a session with a verified launch snapshot first.
        </p>
        <button type="button" className="primary" onClick={onLaunchSession}>
          Launch a session
        </button>
      </div>
    );

  const supervisor = fields.supervisor ?? {
    profileId: null,
    profileRevisionId: null,
    sessionId: null,
  };
  const workers = fields.workers ?? [];
  const profileOf = (id: string | null) => profiles.find((p) => p.profileId === id);
  const patchWorker = (index: number, patch: Partial<WorkerFields>) =>
    setFields({ workers: workers.map((w, i) => (i === index ? { ...w, ...patch } : w)) });
  const providerOf = (worker: WorkerFields) => {
    const requested = profileOf(worker.profileId)?.requestedProvider;
    return requested === 'codex' || requested === 'codex-cli' ? 'codex-cli' : 'claude-code';
  };

  return (
    <div className="composer-stage-body">
      <fieldset className="composer-card">
        <legend>Supervisor</legend>
        <p className="hint">
          The supervisor decomposes and assigns work. It must already be a live session with a
          recorded launch.
        </p>
        <label className="field">
          Supervisor profile
          <select
            data-field="supervisor.profileId"
            aria-invalid={invalid === 'supervisor.profileId' || undefined}
            value={supervisor.profileId ?? ''}
            onChange={(event) => {
              const profile = profileOf(event.target.value);
              setFields({
                supervisor: {
                  ...supervisor,
                  profileId: profile?.profileId ?? null,
                  profileRevisionId: profile?.currentRevisionId ?? null,
                },
              });
            }}
          >
            <option value="">Choose a reviewed profile</option>
            {profiles.map((p) => (
              <option key={p.profileId} value={p.profileId}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Supervisor session
          <select
            data-field="supervisor.sessionId"
            aria-invalid={invalid === 'supervisor.sessionId' || undefined}
            value={supervisor.sessionId ?? ''}
            onChange={(event) =>
              setFields({ supervisor: { ...supervisor, sessionId: event.target.value || null } })
            }
          >
            <option value="">Choose a live session</option>
            {eligible.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.providerId} · {s.displayPath}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {workers.map((worker, index) => {
        const n = index + 1;
        const sessions = eligible.filter(
          (s) => s.providerId === providerOf(worker) && s.sessionId !== supervisor.sessionId,
        );
        return (
          <fieldset key={index} className="composer-card" aria-label={`Worker ${n}`}>
            <legend>Worker {n}</legend>
            <label className="field">
              Worker {n} profile
              <select
                data-field={`workers.${index}.profileId`}
                aria-invalid={invalid === `workers.${index}.profileId` || undefined}
                value={worker.profileId ?? ''}
                onChange={(event) => {
                  const profile = profileOf(event.target.value);
                  patchWorker(index, {
                    profileId: profile?.profileId ?? null,
                    profileRevisionId: profile?.currentRevisionId ?? null,
                  });
                }}
              >
                <option value="">Choose a reviewed profile</option>
                {profiles.map((p) => (
                  <option key={p.profileId} value={p.profileId}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            {worker.profileId ? (
              <p className="hint">Goal: {profileOf(worker.profileId)?.goal}</p>
            ) : null}
            <label className="field">
              Worker {n} role
              <select
                value={worker.role}
                onChange={(event) =>
                  patchWorker(index, { role: event.target.value as WorkerFields['role'] })
                }
              >
                <option value="worker">Worker: does the assigned work</option>
                <option value="reviewer">Reviewer: checks another worker's result</option>
                <option value="triage">Triage: sorts and routes incoming items</option>
              </select>
            </label>
            <label className="field">
              Worker {n} session
              <select
                value={worker.sessionId ?? ''}
                onChange={(event) =>
                  patchWorker(index, {
                    sessionId: event.target.value || null,
                    ...(event.target.value ? { autoStart: false } : {}),
                  })
                }
              >
                <option value="">Start a new session at launch</option>
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.providerId} · {s.displayPath}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              What worker {n} contributes
              <span className="hint">One concrete contribution for this mission only.</span>
              <textarea
                rows={2}
                maxLength={2000}
                data-field={`workers.${index}.assignment`}
                aria-invalid={invalid === `workers.${index}.assignment` || undefined}
                value={worker.assignment}
                onChange={(event) => patchWorker(index, { assignment: event.target.value })}
              />
            </label>
            <ListEditor
              label={`What worker ${n} must bring back`}
              hint="Evidence you can judge the result by. At least one."
              items={worker.requiredReturnEvidence}
              max={8}
              onChange={(requiredReturnEvidence) => patchWorker(index, { requiredReturnEvidence })}
            />
            <details>
              <summary>Customize runtime · {runtimeSummary(worker)}</summary>
              <label className="field">
                Worker {n} model
                <input
                  value={worker.runtimeSelection.model ?? ''}
                  placeholder="Provider default"
                  onChange={(event) =>
                    patchWorker(index, {
                      runtimeSelection: {
                        ...worker.runtimeSelection,
                        model: event.target.value || null,
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                Worker {n} effort
                <select
                  value={worker.runtimeSelection.effort ?? ''}
                  onChange={(event) =>
                    patchWorker(index, {
                      runtimeSelection: {
                        ...worker.runtimeSelection,
                        effort: (event.target.value ||
                          null) as WorkerFields['runtimeSelection']['effort'],
                      },
                    })
                  }
                >
                  <option value="">Provider default effort</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                </select>
              </label>
              <label className="field">
                Worker {n} permission
                <select
                  value={worker.permissionSelection.policy ?? ''}
                  onChange={(event) =>
                    patchWorker(index, {
                      permissionSelection: {
                        ...worker.permissionSelection,
                        policy: (event.target.value ||
                          null) as WorkerFields['permissionSelection']['policy'],
                      },
                    })
                  }
                >
                  <option value="">Manual permission (asks you)</option>
                  <option value="bounded_allowlist">Allow-listed tools only</option>
                </select>
              </label>
              {worker.permissionSelection.policy === 'bounded_allowlist' ? (
                <ListEditor
                  label={`Worker ${n} allowed tools`}
                  items={worker.permissionSelection.boundedAllowlist}
                  max={32}
                  itemMax={64}
                  onChange={(boundedAllowlist) =>
                    patchWorker(index, {
                      permissionSelection: { ...worker.permissionSelection, boundedAllowlist },
                    })
                  }
                />
              ) : null}
              <label className="check">
                <input
                  type="checkbox"
                  checked={worker.autoStart}
                  disabled={worker.sessionId !== null}
                  onChange={(event) => patchWorker(index, { autoStart: event.target.checked })}
                />
                Authorize automatic startup of worker {n} within this mission
              </label>
            </details>
            <button
              type="button"
              className="small"
              onClick={() => setFields({ workers: workers.filter((_, i) => i !== index) })}
            >
              Remove worker {n}
            </button>
          </fieldset>
        );
      })}
      <button
        type="button"
        data-field="workers"
        disabled={workers.length >= 16}
        onClick={() => setFields({ workers: [...workers, newWorker()] })}
      >
        Add worker
      </button>
    </div>
  );
}
```

If `Eligible` has no `displayPath`, use `s.workspaceId.slice(0, 8)`; check `MissionEligibleSessionView` in contracts and prefer the path field it exposes. If `LaunchPermissionSelection.policy` allows values beyond `null | 'bounded_allowlist'`, keep the select limited to those two; the others are not offered by the composer (bypass is prohibited by the contract refine).

- [ ] **Step 4: Mount it**

In `MissionComposerWorkspace.tsx`, add a `loading` state set true until the profiles effect resolves, then render:

```tsx
{
  stage === 'crew' ? (
    <CrewStage
      fields={draft.fields}
      setFields={draft.setFields}
      invalid={invalid}
      profiles={profiles}
      eligible={eligible}
      loading={loading}
      loadError={loadError !== null}
      onCreateAgent={() =>
        void draft.saveNow().then((s) => s && actions.selectDestination('agents'))
      }
      onLaunchSession={() => {
        const workspace = state.workspaces.find((w) => !w.revokedAt);
        void draft
          .saveNow()
          .then(
            (s) =>
              s &&
              (workspace
                ? actions.openLaunch({ workspaceId: workspace.id, providerId: 'codex-cli' })
                : actions.selectDestination('settings')),
          );
      }}
      onRetryLoad={() => setReload((n) => n + 1)}
    />
  ) : null;
}
```

with `const [reload, setReload] = useState(0);` added to the profiles effect dependencies. Selecting Agents while the composer is open must keep `composerDraftId` set in App so returning to Missions shows the composer again; add to `App.tsx` a guard: when `state.selectedDestination !== 'missions'`, render `LegacyDestination` even if `composerDraftId` is set.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm typecheck && pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-composer.spec.ts`
Expected: PASS (three tests).

- [ ] **Step 6: Friendliness gate**

Confirm in the app: empty prerequisites show a sentence and one button (gate 4); runtime is collapsed and its summary is words (gate 5); each missing worker field is named in order (gate 3); role options explain themselves.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/features/mission-composer apps/desktop/src/renderer/App.tsx tests/e2e/mission-composer.spec.ts
git commit -m "feat(renderer): crew stage with prerequisite notices and runtime disclosure

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 8: Access & limits stage

**Files:**

- Create: `apps/desktop/src/renderer/features/mission-composer/AccessStage.tsx`
- Modify: `apps/desktop/src/renderer/features/mission-composer/MissionComposerWorkspace.tsx` (mount)
- Test: `tests/e2e/mission-composer.spec.ts` (one test)

**Interfaces:**

- Consumes: `StageProps`, `accessReason`, `limitsSummary`, `BOUND_LABELS`, `DEFAULT_BOUNDS`; store `workspaces`, `readiness`.
- Produces: `AccessStage({ ...StageProps, workspaces, readiness, providersInUse })`.

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/mission-composer.spec.ts`:

```ts
async function fillCrew(app: Awaited<ReturnType<typeof launchWithFixtures>>, dir: string) {
  const page = app.page;
  const leader = await missionProfile(app, 'Access coordinator');
  const worker = await missionProfile(app, 'Access worker');
  const session = await missionSession(app, dir);
  await page.reload();
  await fillOutcome(app);
  await page
    .getByRole('combobox', { name: 'Supervisor profile', exact: true })
    .selectOption(leader.profileId);
  await page
    .getByRole('combobox', { name: 'Supervisor session', exact: true })
    .selectOption(session.id);
  await page.getByRole('button', { name: 'Add worker', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Worker 1 profile', exact: true })
    .selectOption(worker.profileId);
  await page
    .getByLabel('What worker 1 contributes', { exact: true })
    .fill('Reproduce and fix the test.');
  await page.getByLabel('What worker 1 must bring back', { exact: true }).fill('A passing run log');
  await page
    .getByRole('button', { name: 'Add to what worker 1 must bring back', exact: true })
    .click();
  await page.getByRole('button', { name: 'Continue to access and limits', exact: true }).click();
  return { leader, worker, session };
}

test('access stage explains read or write, shows readiness, and keeps limits collapsed in words', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-access');
  try {
    const page = app.page;
    await fillCrew(app, dir);
    const next = page.getByRole('button', { name: 'Continue to review', exact: true });
    await expect(next).toBeDisabled();
    await expect(page.getByText('Choose an approved folder for worker 1.')).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
      .selectOption({ index: 1 });
    await expect(
      page.getByText('Write: this worker changes files inside this folder only.'),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Read', exact: true }).check();
    await expect(page.getByText('Read: this worker inspects files and reports.')).toBeVisible();
    await expect(page.getByText('Codex CLI').first()).toBeVisible();
    await expect(page.getByText('Available').first()).toBeVisible();
    const limits = page.locator('details', { hasText: 'Customize limits' });
    await expect(limits.locator('summary')).toContainText('Stops after 30 minutes, 64 turns');
    await expect(page.getByLabel('Elapsed limit (ms)', { exact: true })).toBeHidden();
    await expect(page.getByText('What stays off')).toBeVisible();
    await expect(page.getByText('Break-glass bypass')).toBeVisible();
    await expect(next).toBeEnabled();
    await next.click();
    await expect(
      page.getByRole('heading', { name: 'Review the exact mission before anything starts.' }),
    ).toBeFocused();
  } finally {
    await teardown(app, dir);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-composer.spec.ts -g "access stage"`
Expected: FAIL, "Worker 1 folder" not found.

- [ ] **Step 3: Write `AccessStage.tsx`**

```tsx
import type { ApprovedWorkspaceView, MissionBounds, ReadinessView } from '@threadhelm/contracts';
import { PROVIDER_LABEL } from '../launch/provider-label.js';
import type { StageProps } from './OutcomeStage.js';
import { BOUND_LABELS, DEFAULT_BOUNDS, accessReason, limitsSummary } from './composer-fields.js';

const WITHHELD = [
  'Break-glass bypass',
  'Parent or sibling folders',
  'Automatic startup unless chosen per worker',
  'Consequential external actions without your approval',
  'Provider or model substitution',
];

export function AccessStage({
  fields,
  setFields,
  invalid,
  workspaces,
  readiness,
  providersInUse,
}: StageProps & {
  workspaces: ApprovedWorkspaceView[];
  readiness: ReadinessView[];
  providersInUse: ReadinessView['providerId'][];
}) {
  const workers = fields.workers ?? [];
  const modes = new Map((fields.workspaces ?? []).map((w) => [w.workspaceId, w.mode] as const));
  const approved = workspaces.filter((w) => !w.revokedAt);
  const setWorkspace = (index: number, workspaceId: string | null) => {
    const next = workers.map((w, i) => (i === index ? { ...w, workspaceId } : w));
    const ids = [
      ...new Set(next.map((w) => w.workspaceId).filter((id): id is string => id !== null)),
    ];
    setFields({
      workers: next,
      workspaces: ids.map((id) => ({ workspaceId: id, mode: modes.get(id) ?? 'write' })),
    });
  };
  const setMode = (workspaceId: string, mode: 'read' | 'write') =>
    setFields({
      workspaces: (fields.workspaces ?? []).map((w) =>
        w.workspaceId === workspaceId ? { ...w, mode } : w,
      ),
    });
  const bounds: MissionBounds = fields.bounds ?? DEFAULT_BOUNDS;

  return (
    <div className="composer-stage-body">
      <section className="composer-card" aria-labelledby="composer-access-heading">
        <h2 id="composer-access-heading">Workspace access</h2>
        <p className="hint">
          Only folders you already approved appear here. ThreadHelm starts each worker inside its
          folder; it cannot confine what the provider does there.
        </p>
        {workers.map((worker, index) => {
          const n = index + 1;
          const mode = worker.workspaceId ? (modes.get(worker.workspaceId) ?? 'write') : null;
          return (
            <div key={index} className="composer-access-row">
              <label className="field">
                Worker {n} folder
                <select
                  data-field={`workers.${index}.workspaceId`}
                  aria-invalid={invalid === `workers.${index}.workspaceId` || undefined}
                  value={worker.workspaceId ?? ''}
                  onChange={(event) => setWorkspace(index, event.target.value || null)}
                >
                  <option value="">Choose an approved folder</option>
                  {approved.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.displayPath}
                    </option>
                  ))}
                </select>
              </label>
              {worker.workspaceId && mode ? (
                <fieldset className="composer-mode">
                  <legend>Worker {n} access</legend>
                  <label className="check">
                    <input
                      type="radio"
                      name={`mode-${index}`}
                      checked={mode === 'read'}
                      onChange={() => setMode(worker.workspaceId!, 'read')}
                    />
                    Read
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      name={`mode-${index}`}
                      checked={mode === 'write'}
                      onChange={() => setMode(worker.workspaceId!, 'write')}
                    />
                    Write
                  </label>
                  <p className="hint">{accessReason(mode)}</p>
                </fieldset>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="composer-card" aria-labelledby="composer-runtime-heading">
        <h2 id="composer-runtime-heading">Runtime readiness</h2>
        <ul className="list">
          {providersInUse.map((providerId) => {
            const r = readiness.find((item) => item.providerId === providerId);
            return (
              <li key={providerId}>
                <strong>{PROVIDER_LABEL[providerId]}</strong> ·{' '}
                {r
                  ? `${r.availability === 'available' ? 'Available' : r.availability} · ${r.explanation}`
                  : 'Not checked yet'}
              </li>
            );
          })}
        </ul>
        <p className="hint">
          Nothing here installs or signs in to a provider. Fix readiness in Settings.
        </p>
      </section>

      <details className="composer-card">
        <summary>Customize limits · {limitsSummary(bounds)}</summary>
        <div className="mission-limits-grid">
          {(Object.keys(BOUND_LABELS) as (keyof MissionBounds)[]).map((key) => (
            <label key={key} className="field">
              {BOUND_LABELS[key]}
              <input
                type="number"
                min={1}
                value={bounds[key]}
                onChange={(event) =>
                  setFields({ bounds: { ...bounds, [key]: Number(event.target.value) } })
                }
              />
            </label>
          ))}
        </div>
      </details>

      <section className="composer-card" aria-labelledby="composer-withheld-heading">
        <h2 id="composer-withheld-heading">What stays off</h2>
        <ul className="list">
          {WITHHELD.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

If `PROVIDER_LABEL` does not exist under `features/launch/`, reuse `PROVIDER_NAME` from wherever the Settings page labels providers (search `'Codex CLI'` in the renderer) and import that. If `ReadinessView` lacks `explanation`, use the field the Settings page renders next to "Available".

- [ ] **Step 4: Mount it**

In `MissionComposerWorkspace.tsx`:

```tsx
{
  stage === 'access' ? (
    <AccessStage
      fields={draft.fields}
      setFields={draft.setFields}
      invalid={invalid}
      workspaces={state.workspaces}
      readiness={state.readiness}
      providersInUse={[
        ...new Set([
          ...eligible
            .filter((s) => s.sessionId === draft.fields.supervisor?.sessionId)
            .map((s) => s.providerId),
          ...(draft.fields.workers ?? []).map((w) => {
            const requested = profiles.find((p) => p.profileId === w.profileId)?.requestedProvider;
            return requested === 'codex' || requested === 'codex-cli'
              ? ('codex-cli' as const)
              : ('claude-code' as const);
          }),
        ]),
      ]}
    />
  ) : null;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm typecheck && pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-composer.spec.ts`
Expected: PASS (four tests).

- [ ] **Step 6: Friendliness gate**

Confirm: read/write reason updates live; limits collapsed with the sentence; raw ms/bytes only inside the disclosure; "What stays off" always visible.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/features/mission-composer tests/e2e/mission-composer.spec.ts
git commit -m "feat(renderer): access and limits stage with plain-language defaults

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 9: Review stage with four material states and revision

**Files:**

- Create: `apps/desktop/src/renderer/features/mission-composer/ReviewStage.tsx`
- Create: `apps/desktop/src/renderer/features/mission-composer/MissionEnvelopeDisclosure.tsx` (moved from the modal, verbatim plus the three fields already added in Task 4)
- Modify: `apps/desktop/src/renderer/features/mission-composer/MissionComposerWorkspace.tsx` (mount, `onStarted`)
- Modify: `apps/desktop/src/renderer/features/coordination/MissionDetail.tsx:96-106, 180-190` (revision opens the composer)
- Modify: `apps/desktop/src/renderer/App.tsx` (`MissionDetail onRevise`)
- Test: `tests/e2e/mission-composer.spec.ts` (three tests)

**Interfaces:**

- Consumes: `api.missionComposer.preview/confirm`, `MissionEnvelopeDisclosure({ preview })`, `limitsSummary`, `reasonLabel`.
- Produces: `ReviewStage({ draftId, version(), fields, isRevision, onStarted(mission), onGoTo(stage), onSaveNow() })`; `MissionDetail` prop `onRevise(missionId: string): void`.

- [ ] **Step 1: Write the failing e2e tests**

Append to `tests/e2e/mission-composer.spec.ts`:

```ts
async function fillAccess(app: Awaited<ReturnType<typeof launchWithFixtures>>, dir: string) {
  const crew = await fillCrew(app, dir);
  const page = app.page;
  await page
    .getByRole('combobox', { name: 'Worker 1 folder', exact: true })
    .selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Review the exact mission before anything starts.' }),
  ).toBeFocused();
  return crew;
}

test('review shows a launch brief, requires confirmation, and starts the mission', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-review');
  try {
    const page = app.page;
    await fillAccess(app, dir);
    await expect(page.getByText('Ready to start')).toBeVisible();
    const brief = page.getByRole('region', { name: 'Launch brief' });
    await expect(brief).toContainText('Fix the flaky terminal test.');
    await expect(brief).toContainText('Reproduce and fix the test.');
    await expect(brief).toContainText('A passing run log');
    await expect(brief).toContainText('Stops after 30 minutes');
    await expect(page.getByRole('heading', { name: 'Review mission authority' })).toBeVisible();
    const start = page.getByRole('button', { name: 'Start mission', exact: true });
    await expect(start).toBeDisabled();
    await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
    await start.click();
    const detail = page.getByRole('dialog', { name: 'Mission detail', exact: true });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Assignment: Reproduce and fix the test.');
    await expect(detail).toContainText('Must bring back: A passing run log');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: /Fix the flaky terminal test/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Resume draft/ })).toHaveCount(0);
  } finally {
    await teardown(app, dir);
  }
});

test('editing after preview shows Mission changed, and an expired review returns to access', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-states');
  try {
    const page = app.page;
    await fillAccess(app, dir);
    await expect(page.getByText('Ready to start')).toBeVisible();
    await page.getByRole('button', { name: 'Outcome', exact: true }).click();
    await page
      .getByLabel('Finish line', { exact: true })
      .fill('Fix the flaky terminal test, quickly.');
    await page.getByRole('button', { name: 'Continue to crew', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to access and limits', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
    await expect(page.getByText('Ready to start')).toBeVisible();
    await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
    await app.advanceClock(121_000);
    await page.getByRole('button', { name: 'Start mission', exact: true }).click();
    await expect(page.getByText('Approval expired')).toBeVisible();
    await expect(
      page.getByText('The review expired. Return to access and limits for a fresh approval.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Return to access and limits', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Set where the mission may work and when it must stop.' }),
    ).toBeFocused();
    await expect(page.getByText('approval stale')).toBeVisible();
    expect(await app.liveSessions()).toHaveLength(1);
  } finally {
    await teardown(app, dir);
  }
});

test('revision reuses the composer and applies through the revision path', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-revise');
  try {
    const page = app.page;
    await fillAccess(app, dir);
    await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
    await page.getByRole('button', { name: 'Start mission', exact: true }).click();
    const detail = page.getByRole('dialog', { name: 'Mission detail', exact: true });
    await detail.getByRole('button', { name: 'Pause mission', exact: true }).click();
    await expect(detail.getByRole('status')).toContainText('paused');
    await detail.getByRole('button', { name: 'Revise envelope…', exact: true }).click();
    await expect(detail).toBeHidden();
    await expect(page.getByText('Step 4 of 4 · Review · Revise mission')).toBeVisible();
    await page.getByRole('button', { name: 'Outcome', exact: true }).click();
    await page.getByLabel('Finish line', { exact: true }).fill('Revised finish line.');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
    await page.getByRole('button', { name: 'Apply revision', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Mission detail', exact: true })).toContainText(
      'Revised finish line.',
    );
  } finally {
    await teardown(app, dir);
  }
});
```

For the revision test the strip must allow jumping forward to "Review" once the draft has been at Review before; implement that by treating every stage as clickable when `draft.draft?.sourceMissionId` is set or when the draft state was `ready_for_review` at load. Add `everReviewed` state in the workspace set when `stage === 'review'` is first reached.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-composer.spec.ts -g "review|revision|expired"`
Expected: FAIL, "Launch brief" region missing.

- [ ] **Step 3: Move the disclosure**

Create `apps/desktop/src/renderer/features/mission-composer/MissionEnvelopeDisclosure.tsx` with the body of `MissionEnvelopeDisclosure` from `MissionComposer.tsx` (including the Task 4 additions), importing `BOUND_LABELS` from `./composer-fields.js` instead of the modal's `boundLabels`. Leave the modal importing from the new file for one task (`import { MissionEnvelopeDisclosure } from '../mission-composer/MissionEnvelopeDisclosure.js';`) and delete its local copy.

- [ ] **Step 4: Write `ReviewStage.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type {
  MissionDetailView,
  MissionPreviewView,
  OperationResponse,
} from '@threadhelm/contracts';
import { api, call, errorCode } from '../../api.js';
import { useStore } from '../../store.js';
import { reasonLabel } from '../mission-focus/reason-labels.js';
import { MissionEnvelopeDisclosure } from './MissionEnvelopeDisclosure.js';
import { limitsSummary, type Stage } from './composer-fields.js';

type Preview = OperationResponse<'missionComposer.preview'>;
type Profile = OperationResponse<'profiles.list'>['profiles'][number];
type ReviewState = 'loading' | 'ready' | 'incomplete' | 'changed' | 'expired' | 'failed';

export function ReviewStage({
  draftId,
  version,
  isRevision,
  profiles,
  onStarted,
  onGoTo,
}: {
  draftId: string;
  version(): number;
  isRevision: boolean;
  profiles: Profile[];
  onStarted(mission: MissionDetailView): void;
  onGoTo(stage: Stage): void;
}) {
  const { state } = useStore();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<ReviewState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setStatus('loading');
    setError(null);
    setConfirmed(false);
    try {
      const view = await call(api.missionComposer.preview({ draftId, version: version() }));
      setPreview(view);
      const held = view.envelope.bindings.some((b) => b.launchDisposition === 'held');
      setStatus(held ? 'incomplete' : 'ready');
      if (expiry.current) clearTimeout(expiry.current);
      expiry.current = setTimeout(
        () => setStatus('expired'),
        Math.max(0, Date.parse(view.expiresAt) - Date.now()),
      );
    } catch (cause) {
      setPreview(null);
      setError(reasonLabel(errorCode(cause)));
      setStatus('failed');
    }
  };
  useEffect(() => {
    void load();
    return () => {
      if (expiry.current) clearTimeout(expiry.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);
  useEffect(() => {
    if (preview && preview.draftVersion !== version()) setStatus('changed');
  }, [preview, version, state.missionSequence]);

  const start = async () => {
    if (!preview || !confirmed || busy) return;
    setBusy(true);
    try {
      onStarted(
        await call(
          api.missionComposer.confirm({
            draftId,
            version: version(),
            previewToken: preview.previewToken,
          }),
        ),
      );
    } catch (cause) {
      const code = errorCode(cause);
      setConfirmed(false);
      if (code === 'MISSION_CONFIRMATION_EXPIRED') setStatus('expired');
      else if (code === 'MISSION_DRAFT_STALE' || code === 'MISSION_ENVELOPE_STALE')
        setStatus('changed');
      else {
        setError(reasonLabel(code));
        setStatus('failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const profileName = (id: string) =>
    profiles.find((p) => p.profileId === id)?.displayName ?? 'Profile';
  const held = preview?.envelope.bindings.filter((b) => b.launchDisposition === 'held') ?? [];
  const stageFor = (b: MissionPreviewView['envelope']['bindings'][number]): Stage =>
    b.reasonCode?.startsWith('RUNTIME') || b.reasonCode?.startsWith('PERMISSION')
      ? 'crew'
      : 'access';

  return (
    <div className="composer-stage-body">
      {status === 'loading' ? <p role="status">Preparing the exact mission…</p> : null}
      {status === 'ready' ? (
        <p className="composer-state ready" role="status">
          <strong>Ready to start.</strong> Everything below is exactly what will be pinned.
        </p>
      ) : null}
      {status === 'incomplete' ? (
        <div className="composer-state held" role="status">
          <strong>Setup incomplete.</strong> No substitution or partial start is offered.
          <ul className="list">
            {held.map((b) => (
              <li key={b.bindingId}>
                {b.role} · {profileName(b.profileId)}: {reasonLabel(b.reasonCode)}{' '}
                <button type="button" className="small" onClick={() => onGoTo(stageFor(b))}>
                  Go to {stageFor(b) === 'crew' ? 'crew' : 'access and limits'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {status === 'changed' ? (
        <div className="composer-state changed" role="status">
          <strong>Mission changed.</strong> The draft moved after this review was prepared.
          <button type="button" className="small" onClick={() => void load()}>
            Refresh review
          </button>
        </div>
      ) : null}
      {status === 'expired' ? (
        <div className="composer-state expired" role="alert">
          <strong>Approval expired.</strong> {reasonLabel('MISSION_CONFIRMATION_EXPIRED')} Your
          draft is unchanged.
          <button type="button" className="small" onClick={() => onGoTo('access')}>
            Return to access and limits
          </button>
        </div>
      ) : null}
      {status === 'failed' ? (
        <div className="composer-state failed" role="alert">
          <strong>Review could not be prepared.</strong> {error}
          <button type="button" className="small" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : null}

      {preview ? (
        <>
          <section className="composer-card" aria-label="Launch brief">
            <h2>Launch brief</h2>
            <h3>Outcome</h3>
            <p>{preview.envelope.objective}</p>
            <p className="hint">Proof: {preview.envelope.completionEvidence}</p>
            {preview.envelope.exclusions.length ? (
              <p className="hint">Outside this mission: {preview.envelope.exclusions.join('; ')}</p>
            ) : null}
            <h3>Crew</h3>
            <ul className="list">
              {preview.envelope.bindings.map((b) => (
                <li key={b.bindingId}>
                  <strong>{b.role}</strong> · {profileName(b.profileId)}
                  {b.assignment ? ` · ${b.assignment}` : ''}
                  {b.requiredReturnEvidence.length
                    ? ` · brings back ${b.requiredReturnEvidence.length} item${b.requiredReturnEvidence.length === 1 ? '' : 's'}`
                    : ''}
                </li>
              ))}
            </ul>
            <h3>Access</h3>
            <ul className="list">
              {preview.envelope.bindings.map((b) => (
                <li key={b.bindingId}>
                  {b.displayPath} · {b.mode}
                  {status === 'expired' ? ' · approval stale' : ''}
                </li>
              ))}
            </ul>
            <h3>Limits</h3>
            <p>{limitsSummary(preview.envelope.bounds)}</p>
            <h3>Stop and approval behavior</h3>
            <p>
              Work stops for consequential actions, unknown outcomes, exhausted limits, and loss of
              the supervisor. Routine actions allowed:{' '}
              {preview.envelope.permittedRoutineActions.join(', ')}.
            </p>
            <p className="notice">{preview.boundaryWarning}</p>
          </section>
          <details className="composer-card" open>
            <summary>Exact mission authority</summary>
            <MissionEnvelopeDisclosure preview={preview} />
          </details>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={status !== 'ready' || busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I reviewed this exact mission authority
          </label>
          <div className="mission-action-row">
            <button
              type="button"
              className="primary"
              disabled={status !== 'ready' || !confirmed || busy || state.storageDegraded}
              onClick={() => void start()}
            >
              {isRevision ? 'Apply revision' : 'Start mission'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
```

Add to `mission-composer.css`:

```css
.composer-state {
  padding: 0.75rem 1rem;
  border-left: 4px solid var(--mission-steel);
  background: var(--mission-fog);
  display: grid;
  gap: 0.5rem;
}
.composer-state.ready {
  border-left-color: var(--mission-verdigris);
}
.composer-state.held,
.composer-state.changed {
  border-left-color: var(--mission-copper);
}
.composer-state.expired,
.composer-state.failed {
  border-left-color: var(--danger);
}
```

- [ ] **Step 5: Mount and wire revision**

In `MissionComposerWorkspace.tsx`:

```tsx
{
  stage === 'review' ? (
    <ReviewStage
      draftId={draftId}
      version={draft.version}
      isRevision={isRevision}
      profiles={profiles}
      onStarted={onStarted}
      onGoTo={(target) => void draft.goTo(target)}
    />
  ) : null;
}
```

Review entry must save first: `goTo('review')` already awaits `saveNow`, and the stage effect resets `invalid`; add `everReviewed` per Step 1.

In `MissionDetail.tsx`: add prop `onRevise(missionId: string): void`; replace the `editing` branch (lines 96-106) and the `setEditing(true)` click with `onRevise(detail.id)` followed by `onClose()`. Remove the `MissionComposer` import. In `App.tsx`, pass `onRevise={(id) => openComposer(id)}` to `MissionDetail`.

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm typecheck && pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-composer.spec.ts`
Expected: PASS (seven tests).

- [ ] **Step 7: Friendliness gate**

Confirm: the brief reads top to bottom as a plain-language answer to "what will happen"; the exact JSON sits under a disclosure; each state has one sentence and one action; nothing reads as a code.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/renderer/features/mission-composer apps/desktop/src/renderer/styles/mission-composer.css apps/desktop/src/renderer/features/coordination/MissionDetail.tsx apps/desktop/src/renderer/features/coordination/MissionComposer.tsx apps/desktop/src/renderer/App.tsx tests/e2e/mission-composer.spec.ts
git commit -m "feat(renderer): review stage with launch brief, material states and revision

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 10: Delete the modal and migrate the remaining suites

**Files:**

- Delete: `apps/desktop/src/renderer/features/coordination/MissionComposer.tsx`
- Modify: `tests/e2e/helpers/mission.ts` (add `composeMissionViaUi`)
- Modify: `tests/e2e/supervisor-mission.spec.ts`, `tests/e2e/accessibility.spec.ts:249-282`, `tests/e2e/parity-screenshots.spec.ts`, and any other spec that opens `Create mission` (grep `'Create mission'` and `'Revise mission envelope'` under `tests/e2e`)
- Test: full e2e run

**Interfaces:**

- Produces: `composeMissionViaUi(app, dirs: [supervisorDir, workerDir]) => Promise<{ detail: Locator; supervisorId: string }>` with the same return shape the old `createMission` helper had.

- [ ] **Step 1: Write the shared helper**

Append to `tests/e2e/helpers/mission.ts`:

```ts
import { expect } from '@playwright/test';

/** Drives the guided composer end to end; returns the mission detail dialog. */
export async function composeMissionViaUi(app: LaunchedApp, dirs: string[]) {
  const page = app.page;
  const leader = (await missionProfile(app, 'Mission coordinator')).profileId;
  const worker = (await missionProfile(app, 'Mission worker')).profileId;
  const supervisorId = (await missionSession(app, dirs[0]!)).id;
  const workerId = (await missionSession(app, dirs[1]!)).id;
  await page.reload();
  await page.getByRole('button', { name: 'New mission…', exact: true }).click();
  await page.getByLabel('Finish line', { exact: true }).fill('Review a bounded local change.');
  await page
    .getByLabel('Proof of completion', { exact: true })
    .fill('A cited report and focused tests.');
  await page.getByRole('button', { name: 'Continue to crew', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Supervisor profile', exact: true })
    .selectOption(leader);
  await page
    .getByRole('combobox', { name: 'Supervisor session', exact: true })
    .selectOption(supervisorId);
  await page.getByRole('button', { name: 'Add worker', exact: true }).click();
  await page.getByRole('combobox', { name: 'Worker 1 profile', exact: true }).selectOption(worker);
  await page
    .getByRole('combobox', { name: 'Worker 1 session', exact: true })
    .selectOption(workerId);
  await page.getByLabel('What worker 1 contributes', { exact: true }).fill('Inspect the change.');
  await page.getByLabel('What worker 1 must bring back', { exact: true }).fill('A cited report');
  await page
    .getByRole('button', { name: 'Add to what worker 1 must bring back', exact: true })
    .click();
  await page.getByRole('button', { name: 'Continue to access and limits', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to review', exact: true }).click();
  await expect(page.getByText('Ready to start')).toBeVisible();
  await page.getByRole('checkbox', { name: 'I reviewed this exact mission authority' }).check();
  await page.getByRole('button', { name: 'Start mission', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Mission detail', exact: true });
  await expect(detail).toBeVisible();
  return { detail, supervisorId };
}
```

A worker bound to a live session already has its folder, so the Access stage's folder select is pre-filled from the session's workspace: in `CrewStage`, when a session is chosen, also set `workspaceId` to that session's `workspaceId` and add its `{ workspaceId, mode: 'write' }` to `fields.workspaces` if absent. Do that change in this task and add one assertion to the Task 8 test: after selecting a session the folder select is already set.

- [ ] **Step 2: Migrate `supervisor-mission.spec.ts`**

Replace `createMission` with `composeMissionViaUi` (import from helpers). Rewrite the first test ("keyboard accessible … empty roster") to the composer:

```ts
test('mission creation is keyboard accessible and explains an empty roster', async () => {
  const app = await launchApp();
  try {
    const button = app.page.getByRole('button', { name: 'New mission…', exact: true });
    await button.focus();
    await app.page.keyboard.press('Enter');
    await expect(app.page.getByRole('heading', { name: 'Define one finish line.' })).toBeFocused();
    await app.page.getByLabel('Finish line', { exact: true }).fill('x');
    await app.page.getByLabel('Proof of completion', { exact: true }).fill('y');
    await app.page.getByRole('button', { name: 'Continue to crew', exact: true }).click();
    await expect(app.page.getByText('No reviewed profile yet.')).toBeVisible();
    await expect(
      app.page.getByRole('button', { name: 'Continue to access and limits', exact: true }),
    ).toBeDisabled();
    await app.page.getByRole('button', { name: 'Close', exact: true }).click();
    await app.page.getByRole('button', { name: 'Close composer', exact: true }).click();
    await expect(button).toBeVisible();
  } finally {
    await teardown(app);
  }
});
```

Rewrite "offline worker review discloses exact typed tool patterns": drive the composer with `autoStart` and the allow-list under "Customize runtime", assert the `<pre>` inside the exact-authority disclosure contains `"boundedAllowlist": [` and both tools, then use the "Crew" strip button instead of "Back to mission" and assert the finish line keeps focus order (the heading is focused). Rewrite "revision editor cannot submit stale fields": open revision through the composer, make an out-of-band `missions.confirmRevision`, press "Apply revision", and assert the Mission changed state appears and the stored objective is the newer one.

- [ ] **Step 3: Migrate accessibility and screenshots**

In `accessibility.spec.ts` the "mission form" test: replace the dialog locator with `page.locator('.composer')`, the focused-first assertion with the Outcome heading, keep the 18-tab traversal, the idle-stability check, and the 200% reflow check against `.composer`, and end with Close → Close composer. In `parity-screenshots.spec.ts` add captures `10-composer-outcome`, `11-composer-crew`, `12-composer-access`, `13-composer-review-ready` by driving the same helper steps up to each stage.

- [ ] **Step 4: Delete the modal**

`git rm apps/desktop/src/renderer/features/coordination/MissionComposer.tsx`. Remove the last import (Task 9 left only the disclosure re-import). Grep the renderer for `MissionComposer` and `Revise mission envelope`; nothing may remain.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:contract && pnpm desktop:build && pnpm exec playwright test`
Expected: all PASS. The mission-focus workspace `assertNoRawReasonCode` guard must stay green: composer copy contains no all-caps underscore tokens.

- [ ] **Step 6: Commit**

```bash
git add -A apps/desktop/src/renderer tests/e2e
git commit -m "refactor(renderer): remove the mission modal; suites drive the guided composer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 11: Rail drafts row, context rail cards, and save failure

**Files:**

- Modify: `apps/desktop/src/renderer/features/mission-focus/MissionRail.tsx` (drafts row)
- Modify: `apps/desktop/src/renderer/App.tsx` (rail props, composer context)
- Create: `apps/desktop/src/renderer/features/mission-composer/ComposerContext.tsx`
- Test: `tests/e2e/mission-composer.spec.ts` (two tests)

**Interfaces:**

- Consumes: `DraftList` (Task 6), `MissionContextFrame`, `useDraft` receipt, `STAGE_LABEL`.
- Produces: `MissionRail` prop `drafts: MissionComposerDraftSummaryView[]` and `onResumeDraft(draftId)`; `ComposerContext({ stage, workers, storageDegraded })`.

- [ ] **Step 1: Write the failing e2e tests**

Append to `tests/e2e/mission-composer.spec.ts`:

```ts
test('drafts appear in the rail and the context rail explains the draft', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await page.getByLabel('Finish line', { exact: true }).fill('Draft one.');
    const context = page.getByRole('complementary', { name: 'Mission context' });
    await expect(context.getByText('Mission draft')).toBeVisible();
    await expect(context.getByText('Outcome')).toBeVisible();
    await expect(context.getByText('No crew chosen')).toBeVisible();
    await expect(context.getByText('Break-glass bypass')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Close composer', exact: true }).click();
    const rail = page.getByRole('navigation', { name: 'Mission workspace' });
    await expect(rail.getByText('Drafts (1)')).toBeVisible();
    await rail.getByRole('button', { name: /^Resume draft · Outcome/ }).click();
    await expect(page.getByLabel('Finish line', { exact: true })).toHaveValue('Draft one.');
  } finally {
    await teardown(app);
  }
});

test('a save failure keeps the composer open and offers retry, keep editing, discard', async () => {
  const app = await launchApp();
  try {
    const page = app.page;
    await page.getByRole('button', { name: 'New mission…', exact: true }).click();
    await page.getByLabel('Finish line', { exact: true }).fill('Before the failure.');
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
    await app.breakStorage();
    await page.getByLabel('Finish line', { exact: true }).fill('Before the failure. And after.');
    const banner = page.getByRole('alert').filter({ hasText: 'Nothing has been discarded' });
    await expect(banner).toBeVisible();
    await expect(page.getByLabel('Finish line', { exact: true })).toHaveValue(
      'Before the failure. And after.',
    );
    await expect(
      page.getByRole('button', { name: 'Continue to crew', exact: true }),
    ).toBeDisabled();
    await expect(banner.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Keep editing', exact: true })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Discard draft…', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await teardown(app);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-composer.spec.ts -g "drafts appear|save failure"`
Expected: FAIL, "Mission draft" / "Drafts (1)" not found.

- [ ] **Step 3: Rail drafts row**

In `MissionRail.tsx` add props `drafts: MissionComposerDraftSummaryView[]` and `onResumeDraft(draftId: string): void`, and after the `<ul className="mission-rail-list">` block render:

```tsx
{
  drafts.length ? (
    <details className="mission-rail-drafts">
      <summary>Drafts ({drafts.length})</summary>
      <ul className="list">
        {drafts.map((draft) => (
          <li key={draft.draftId}>
            <button type="button" className="small" onClick={() => onResumeDraft(draft.draftId)}>
              Resume draft · {STAGE_LABEL[draft.currentStage]} · {relative(draft.updatedAt)}
            </button>
          </li>
        ))}
      </ul>
    </details>
  ) : null;
}
```

Move `relative()` from `DraftList.tsx` into `composer-fields.ts` as `export function relativeTime(iso: string): string` and import it in both. In `App.tsx` load drafts once per `state.missionSequence` with `api.missionComposer.listDrafts` into local state and pass `drafts` and `onResumeDraft={setComposerDraftId}` to the rail. When `state.storageDegraded`, skip the call and pass `[]`.

- [ ] **Step 4: Context rail while composing**

Create `ComposerContext.tsx`:

```tsx
import { MissionContextFrame } from '../mission-focus/MissionContextFrame.js';
import { STAGE_LABEL, type Stage, type WorkerFields } from './composer-fields.js';

const REMAINING: Record<Stage, string> = {
  outcome: 'Crew, access and limits, then review remain.',
  access: 'Review remains.',
  crew: 'Access and limits, then review remain.',
  review: 'Start the mission when the review is ready.',
};

export function ComposerContext({ stage, workers }: { stage: Stage; workers: WorkerFields[] }) {
  const roles = workers.map((w) => w.role);
  return (
    <MissionContextFrame heading="Mission draft">
      <section>
        <p className="context-label">Stage</p>
        <p>{STAGE_LABEL[stage]}</p>
        <p className="hint">{REMAINING[stage]}</p>
      </section>
      <section>
        <p className="context-label">Crew</p>
        <p>
          {workers.length === 0
            ? 'No crew chosen'
            : `${workers.length} worker${workers.length === 1 ? '' : 's'} · ${[...new Set(roles)].join(', ')}`}
        </p>
      </section>
      <section>
        <p className="context-label">Still off</p>
        <ul className="list">
          <li>Break-glass bypass</li>
          <li>Parent or sibling folders</li>
          <li>Automatic startup unless chosen per worker</li>
          <li>External actions without approval</li>
        </ul>
      </section>
    </MissionContextFrame>
  );
}
```

The workspace must expose its stage and workers to App. Lift them: `MissionComposerWorkspace` accepts `onState?(state: { stage: Stage; workers: WorkerFields[] }): void` and calls it in an effect whenever `stage` or `draft.fields.workers` changes; App stores that in `composerState` and renders `<ComposerContext .../>` as `contextContent` while `composerDraftId` is set and the destination is `missions`.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm typecheck && pnpm desktop:build && pnpm exec playwright test tests/e2e/mission-composer.spec.ts`
Expected: PASS (nine tests). `breakStorage` closes the database, so `updateDraft` throws a raw SQLite error; the service maps non-ThreadHelm errors to `MISSION_DRAFT_SAVE_FAILED` (Task 3), and the banner text comes from that label.

- [ ] **Step 6: Friendliness gate**

Confirm: the context rail answers "where am I, who is on it, what cannot happen"; the drafts row reads as one sentence per draft with a relative time; the failure banner never hides the form.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer tests/e2e/mission-composer.spec.ts
git commit -m "feat(renderer): rail drafts, composer context rail, and save-failure banner

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 12: Friendliness audit with evidence

**Files:**

- Modify: `tests/e2e/accessibility.spec.ts` (composer viewport test)
- Modify: `tests/e2e/mission-focus-workspace.spec.ts` (extend the no-raw-reason-code guard to the composer)
- Create: `docs/architecture/guided-mission-composer-ux-audit.md`
- Test: the two specs above; screenshots via `PARITY_SHOTS=1`

**Interfaces:**

- Produces: an audit document with one row per gate and per stage, each with the screenshot filename and the assertion that proves it.

- [ ] **Step 1: Viewport and overlay assertions**

Add to `accessibility.spec.ts`:

```ts
test('composer never scrolls sideways and its sticky actions never cover the focused control', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo' });
  const dir = tempWorkspace('composer-a11y');
  try {
    const page = app.page;
    for (const [width, height] of [
      [1400, 900],
      [680, 800],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.getByRole('button', { name: 'Missions', exact: true }).click();
      await page.getByRole('button', { name: 'New mission…', exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
        `no horizontal overflow at ${width}`,
      ).toBe(false);
      const outside = page.getByLabel('Outside this mission', { exact: true });
      await outside.focus();
      const covered = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + 4, r.bottom - 4);
        return !(hit === el || el.contains(hit));
      });
      expect(covered, `sticky actions do not cover focus at ${width}`).toBe(false);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Close composer', exact: true }).click();
    }
  } finally {
    await teardown(app, dir);
  }
});
```

- [ ] **Step 2: No-code guard**

In `tests/e2e/mission-focus-workspace.spec.ts`, find the test that calls `assertNoRawReasonCode` and add a composer pass: open the composer, run the assertion against `.composer` innerText at Outcome, then (with fixtures) at Crew, Access and Review. Allow-list nothing new; if a token trips, fix the copy.

- [ ] **Step 3: Capture and audit**

Run: `PARITY_SHOTS=1 pnpm exec playwright test tests/e2e/parity-screenshots.spec.ts` (PowerShell: `$env:PARITY_SHOTS='1'; pnpm exec playwright test tests/e2e/parity-screenshots.spec.ts`).

Write `docs/architecture/guided-mission-composer-ux-audit.md` with this table, one row per (stage × gate), filled from the screenshots and the e2e assertions. Rows must cite the test name that proves the gate; a row without a test is a gap and gets a follow-up bullet at the end.

```markdown
# Guided mission composer: friendliness audit

**Date:** <fill>

| Stage   | Gate                             | Evidence (screenshot, test)                                         | Result |
| ------- | -------------------------------- | ------------------------------------------------------------------- | ------ |
| Outcome | 1 one question, sentence heading | 10-composer-outcome.png; mission-composer.spec "new mission opens…" | pass   |
| Outcome | 3 continue named, missing named  | same; "Add a finish line…" assertion                                | pass   |
| ...     |                                  |                                                                     |        |

## Gaps and follow-ups

- <none, or one line each>
```

Cover all four stages and all eight gates (32 rows). Also record the three modal problems the owner named (redundant buttons, raw limits, empty dropdowns) and the assertion that shows each is gone.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm desktop:build && pnpm exec playwright test tests/e2e/accessibility.spec.ts tests/e2e/mission-focus-workspace.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/accessibility.spec.ts tests/e2e/mission-focus-workspace.spec.ts docs/architecture/guided-mission-composer-ux-audit.md
git commit -m "test: composer viewport, overlay and no-code guards; record the friendliness audit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 13: Docs, installed run, and PR

**Files:**

- Modify: `docs/architecture/journey-ui-from-prototyping.md` (status line and the mission-creation row)
- Modify: `docs/superpowers/specs/2026-09-03-guided-mission-composer-design.md` (status → implemented, PR number)
- Test: installed x64 e2e run

- [ ] **Step 1: Update the journey document**

Change `**Status:** Production journey implemented` to:

```markdown
**Status:** Phases 1, 2 and 4a shipped (Mission Course, shell fixes, guided mission composer). Phase 3 (terminal dock), 4b (coach generation), 5 (secondary destinations) and 6 (legacy stylesheet retirement) remain.
```

In the "Mission creation" row of the decisions table, replace the production outcome with: `Four-stage guided composer with main-owned autosave drafts, per-worker assignment and return evidence, and four Review states. Coach generation deferred to phase 4b.`

- [ ] **Step 2: Installed verification**

Run: `pnpm package:win`, then with `THREADHELM_ARTIFACT` pointed at the unpacked exe (see `tests/acceptance/INSTALLER.md`): `pnpm test:acceptance:installed` and `pnpm exec playwright test tests/e2e/mission-composer.spec.ts`. Record the result in the PR body. If the installed run cannot attach (known: Playwright times out against the Setup installer; use the unpacked exe), say so explicitly.

- [ ] **Step 3: Full verification and PR**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:contract && pnpm desktop:build && pnpm exec playwright test`
Expected: all PASS.

```bash
git add docs
git commit -m "docs: record the guided mission composer as shipped phase 4a

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
git push -u origin feat/guided-mission-composer
gh pr create --title "feat: guided mission composer (phase 4a)" --body-file <(cat <<'EOF'
Four-stage guided composer in the mission workspace; main-owned autosave drafts; assignment and return evidence pinned in the envelope; Ready / Setup incomplete / Mission changed / Approval expired review states. Modal deleted.

Spec: docs/superpowers/specs/2026-09-03-guided-mission-composer-design.md
Audit: docs/architecture/guided-mission-composer-ux-audit.md

Installed run: <result>

Deferred: Outcome Coach / Crew Workshop / Access Coach generation (4b), provider capability registry, supervisor enforcement of return evidence.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT
EOF
)
```

On PowerShell, write the body to a scratch file and pass `--body-file <path>`.

---

## Self-review notes

- Spec §1.1 one entry point → Task 6 (empty-state button removed, rail button creates a draft).
- Spec §1.2 page in workspace → Task 6 App wiring; §1.3 drafts → Tasks 6 and 11; §1.4 revision → Task 9.
- Spec §2.1–2.4 stages → Tasks 6, 7, 8, 9; §2.5 keyboard/focus/live region → Task 6 shell, Task 12 assertions.
- Spec §3.1 schema → Task 1; §3.2 table/repo → Task 2; §3.3 operations → Task 3.
- Spec §4 autosave/stale/close/failure → Tasks 6 and 11; discard preview/confirm → Tasks 3 and 6.
- Spec §5 context rail → Task 11. §6 files → matches the file-structure table. §7 tests → Tasks 1–3, 6–12. §8 sequence: PR 1 = Tasks 1–4, PR 2 = Tasks 5–13; this plan lands both on one branch, so the executor may split at Task 4 if the owner wants two PRs.
- Deviation from spec: `MISSION_CONFIRMATION_EXPIRED` is raised by the composer service from its own `expiresAt` record, because the supervisor token store reports expiry as `MISSION_ENVELOPE_STALE`; the review stage maps both.
- Deviation from spec: acceptance test for supervisor inspection is covered by the contract test asserting `assignment` on the preview envelope and by `mission-bindings` copying into the view the supervisor already reads; no new acceptance file.
