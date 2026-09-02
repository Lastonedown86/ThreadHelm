# Workspace Recon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an approved workspace one optional, owner-confirmed agent session that reads the repository and writes a proposed roster of `AgentManifestV1` files, which the owner reviews and accepts one role at a time through the existing profile-import gate.

**Architecture:** Recon is an ordinary session, not a new launch path. `workspaceRecon.previewLaunch` wraps the existing `LaunchPreviewView` and adds recon-only bounds; `workspaceRecon.confirmLaunch` launches through the same session machinery and sends the disclosed prompt as initial input. The agent writes manifests to a ThreadHelm-owned directory outside the workspace; when the session reaches a terminal lifecycle state, main reads that directory through `parseAgentManifest` and classifies the run into exactly one of seven outcomes. No terminal output is read, stored, or interpreted.

**Tech Stack:** TypeScript 7 (project references), Zod contracts, Electron main/preload/renderer, better-sqlite3 with a transactional migration runner, Vitest projects (`unit`, `contract`, `integration`, `acceptance`), Playwright Electron for e2e, and the deterministic `fake-agent.cjs` fixture.

**Spec:** `docs/superpowers/specs/2026-09-02-workspace-recon-design.md` — read it before Task 1. Every task below argues from it.

## Branch dependency

This plan uses `AgentManifestV1` and `parseAgentManifest`, which exist only on `refactor/agent-manifest-naming` (commit `e5f2b18`). **Merge that branch to `main` before starting Task 1.** If it has not merged, the identifiers in every task below are still named `HireManifestV1` / `parseHireManifest` and nothing will compile.

## Deviations from the spec, decided while planning

Two items. Both need a nod before Task 1; neither changes the approved behaviour.

1. **One read operation instead of two.** The spec names `workspaceRecon.listProposals { runId }`. Because the spec also says only the most recent run's proposals are ever listed, a caller would always need a second operation to learn the current `runId` first. This plan ships a single `workspaceRecon.getRun { workspaceId }` returning the latest run with its proposals inline. Same information, one round trip, one operation to test.
2. **The disclosure shows the exact recon prompt.** The spec does not require this. ThreadHelm discloses the effective executable, version and boundary before a launch; the prompt is the other thing this session does on the owner's behalf, and hiding it would be the one undisclosed input in an otherwise fully disclosed launch. `ReconLaunchPreviewView.reconPrompt` carries it verbatim.

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include this section.

- **No read-only claim anywhere.** ThreadHelm cannot enforce read-only on a CLI agent. The recon disclosure reuses the existing `LaunchPreviewView.boundaryWarning` string unmodified and adds no softer wording. The strings "read-only scan", "safe scan", and "sandboxed" must not appear in any recon code, copy, comment, or test.
- **Recon never fires automatically.** Workspace approval completes exactly as it does today. Recon starts only from an explicit owner action followed by the standard launch confirmation.
- **Recon never proposes a display name.** Proposed manifests carry a placeholder `name`; the owner types the real one at acceptance. A test must assert that an accepted profile's `displayName` is the owner-typed value and not any value from the manifest.
- **No transcript ingestion.** Recon reads files from its output directory. No recon code may read, buffer, persist, or parse session output bytes.
- **The output directory lives outside the workspace.** `%LOCALAPPDATA%\ThreadHelm\recon\<workspaceId>\<runId>\`. A test must assert the workspace tree is unmodified after a run.
- **Nothing is hired automatically.** Acceptance is one role at a time. There is no accept-all control.
- **Outcomes stay distinct.** Exactly seven: `completed`, `partial`, `no_output`, `unparsable_output`, `stopped_by_owner`, `token_cap_reached`, `provider_unauthenticated`. No blanket failure state, no automatic retry from any of them.
- **Bounds.** At most 12 files considered per run; each read under the existing `MAX_MANIFEST_BYTES` (65536).
- **Windows-first.** Every path, process and cleanup behaviour is verified on Windows.

---

### Task 1: Domain — file selection bounds and outcome classification

Pure functions with no I/O, so they can be driven entirely by unit tests before anything else exists.

**Files:**
- Create: `packages/domain/src/workspace-recon.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `tests/unit/domain/workspace-recon.test.ts`

**Interfaces:**
- Consumes: `MAX_MANIFEST_BYTES` from `packages/domain/src/agent-profile.ts`.
- Produces:
  - `MAX_RECON_FILES: 12`
  - `interface ReconFileCandidate { name: string; sizeBytes: number }`
  - `interface ReconSelection { considered: readonly string[]; oversized: readonly string[]; ignoredForCount: readonly string[] }`
  - `selectReconFiles(files: readonly ReconFileCandidate[]): ReconSelection`
  - `type ReconOutcome` (the seven strings)
  - `interface ReconRunFacts { providerUnauthenticated: boolean; ownerStopped: boolean; tokenCapReached: boolean; filesWritten: number; parsedCount: number; rejectedCount: number }`
  - `classifyReconOutcome(facts: ReconRunFacts): ReconOutcome`
  - `reconRoleForBasename(basename: string): 'supervisor' | 'specialist'`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/domain/workspace-recon.test.ts`:

```ts
/**
 * Workspace Recon domain policy: bounded collection, honest outcome
 * classification, and role assignment by filename.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_RECON_FILES,
  classifyReconOutcome,
  reconRoleForBasename,
  selectReconFiles,
  type ReconRunFacts,
} from '@threadhelm/domain';

const FACTS: ReconRunFacts = {
  providerUnauthenticated: false,
  ownerStopped: false,
  tokenCapReached: false,
  filesWritten: 0,
  parsedCount: 0,
  rejectedCount: 0,
};

describe('selectReconFiles', () => {
  it('considers files in name order so a run is reproducible', () => {
    const selection = selectReconFiles([
      { name: 'c.agent.json', sizeBytes: 10 },
      { name: 'a.agent.json', sizeBytes: 10 },
      { name: 'b.agent.json', sizeBytes: 10 },
    ]);
    expect(selection.considered).toEqual(['a.agent.json', 'b.agent.json', 'c.agent.json']);
    expect(selection.ignoredForCount).toEqual([]);
    expect(selection.oversized).toEqual([]);
  });

  it('considers at most MAX_RECON_FILES and reports the rest as ignored', () => {
    const files = Array.from({ length: MAX_RECON_FILES + 3 }, (_, i) => ({
      name: `role-${String(i).padStart(2, '0')}.agent.json`,
      sizeBytes: 10,
    }));
    const selection = selectReconFiles(files);
    expect(selection.considered).toHaveLength(MAX_RECON_FILES);
    expect(selection.ignoredForCount).toHaveLength(3);
    expect(selection.considered).not.toContain('role-12.agent.json');
  });

  it('reports an oversized considered file instead of reading it', () => {
    const selection = selectReconFiles([
      { name: 'big.agent.json', sizeBytes: 65537 },
      { name: 'small.agent.json', sizeBytes: 65536 },
    ]);
    expect(selection.oversized).toEqual(['big.agent.json']);
    expect(selection.considered).toEqual(['big.agent.json', 'small.agent.json']);
  });
});

describe('classifyReconOutcome', () => {
  it('reports no_output when the session wrote nothing', () => {
    expect(classifyReconOutcome(FACTS)).toBe('no_output');
  });

  it('reports unparsable_output when files were written but none parsed', () => {
    expect(
      classifyReconOutcome({ ...FACTS, filesWritten: 3, parsedCount: 0, rejectedCount: 3 }),
    ).toBe('unparsable_output');
  });

  it('reports partial when some parsed and some did not', () => {
    expect(
      classifyReconOutcome({ ...FACTS, filesWritten: 4, parsedCount: 3, rejectedCount: 1 }),
    ).toBe('partial');
  });

  it('reports completed only when every considered file parsed', () => {
    expect(
      classifyReconOutcome({ ...FACTS, filesWritten: 3, parsedCount: 3, rejectedCount: 0 }),
    ).toBe('completed');
  });

  it.each([
    [{ providerUnauthenticated: true, ownerStopped: true, tokenCapReached: true }, 'provider_unauthenticated'],
    [{ ownerStopped: true, tokenCapReached: true }, 'stopped_by_owner'],
    [{ tokenCapReached: true }, 'token_cap_reached'],
  ] as const)('prefers the run-level explanation %#', (overrides, expected) => {
    expect(
      classifyReconOutcome({ ...FACTS, ...overrides, filesWritten: 2, parsedCount: 2 }),
    ).toBe(expected);
  });
});

describe('reconRoleForBasename', () => {
  it('treats exactly supervisor.agent.json as the supervisor', () => {
    expect(reconRoleForBasename('supervisor.agent.json')).toBe('supervisor');
    expect(reconRoleForBasename('SUPERVISOR.AGENT.JSON')).toBe('supervisor');
  });

  it('treats every other name as a specialist', () => {
    expect(reconRoleForBasename('rust-native.agent.json')).toBe('specialist');
    expect(reconRoleForBasename('supervisor-notes.agent.json')).toBe('specialist');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/domain/workspace-recon.test.ts`
Expected: FAIL — `No "MAX_RECON_FILES" export is defined on the "@threadhelm/domain" mock` or a module resolution error.

- [ ] **Step 3: Write minimal implementation**

Create `packages/domain/src/workspace-recon.ts`:

```ts
/**
 * Workspace Recon policy: bounded collection and honest outcome
 * classification. Pure functions only — no filesystem, no session access.
 *
 * Design: docs/superpowers/specs/2026-09-02-workspace-recon-design.md
 */

import { MAX_MANIFEST_BYTES } from './agent-profile.js';

/** A run considers a bounded number of files so a hostile run cannot fan out. */
export const MAX_RECON_FILES = 12;

/** The one filename a run may use to propose the supervisor role. */
export const SUPERVISOR_BASENAME = 'supervisor.agent.json';

export interface ReconFileCandidate {
  readonly name: string;
  readonly sizeBytes: number;
}

export interface ReconSelection {
  readonly considered: readonly string[];
  readonly oversized: readonly string[];
  readonly ignoredForCount: readonly string[];
}

/**
 * Orders by name and takes the first `MAX_RECON_FILES`, so the same output
 * directory always yields the same selection. Oversized files stay in
 * `considered` and are reported separately: a file that was too big to read
 * is a rejection with a reason, not a file that silently vanished.
 */
export function selectReconFiles(files: readonly ReconFileCandidate[]): ReconSelection {
  const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, 'en-US'));
  const considered = ordered.slice(0, MAX_RECON_FILES);
  return {
    considered: considered.map((file) => file.name),
    oversized: considered.filter((f) => f.sizeBytes > MAX_MANIFEST_BYTES).map((f) => f.name),
    ignoredForCount: ordered.slice(MAX_RECON_FILES).map((file) => file.name),
  };
}

export type ReconOutcome =
  | 'completed'
  | 'partial'
  | 'no_output'
  | 'unparsable_output'
  | 'stopped_by_owner'
  | 'token_cap_reached'
  | 'provider_unauthenticated';

export interface ReconRunFacts {
  readonly providerUnauthenticated: boolean;
  readonly ownerStopped: boolean;
  readonly tokenCapReached: boolean;
  readonly filesWritten: number;
  readonly parsedCount: number;
  readonly rejectedCount: number;
}

/**
 * Run-level explanations win over output-shaped ones, most specific first:
 * a run that never authenticated explains itself better than one that
 * happens to have written nothing. Proposals are reported separately, so a
 * stopped run that still produced usable manifests keeps them.
 */
export function classifyReconOutcome(facts: ReconRunFacts): ReconOutcome {
  if (facts.providerUnauthenticated) return 'provider_unauthenticated';
  if (facts.ownerStopped) return 'stopped_by_owner';
  if (facts.tokenCapReached) return 'token_cap_reached';
  if (facts.filesWritten === 0) return 'no_output';
  if (facts.parsedCount === 0) return 'unparsable_output';
  return facts.rejectedCount > 0 ? 'partial' : 'completed';
}

/** Role is taken from the filename; a manifest carries no role field and grants no authority. */
export function reconRoleForBasename(basename: string): 'supervisor' | 'specialist' {
  return basename.toLocaleLowerCase('en-US') === SUPERVISOR_BASENAME ? 'supervisor' : 'specialist';
}
```

Add to `packages/domain/src/index.ts`, following the existing export style in that file:

```ts
export {
  MAX_RECON_FILES,
  SUPERVISOR_BASENAME,
  classifyReconOutcome,
  reconRoleForBasename,
  selectReconFiles,
  type ReconFileCandidate,
  type ReconOutcome,
  type ReconRunFacts,
  type ReconSelection,
} from './workspace-recon.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/domain/workspace-recon.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/workspace-recon.ts packages/domain/src/index.ts tests/unit/domain/workspace-recon.test.ts
git commit -m "feat: add recon collection bounds and outcome classification"
```

---

### Task 2: Contracts — recon views and operations

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Test: `tests/contract/workspace-recon.test.ts`

**Interfaces:**
- Consumes: `AgentManifestV1`, `LaunchPreviewView`, `ProfileCompatibility`, `ProfileDigest`, `Uuid`, `Timestamp`, `OpaqueToken`, `ProviderId`, `TerminalSize`, `MAX_TOKEN_CAP` — all already exported from this file.
- Produces: `ReconOutcome`, `ReconProposalView`, `ReconRejectionView`, `ReconRunView`, `ReconLaunchPreviewView`, `RECON_NO_AUTO_HIRE_STATEMENT`, and the three `workspaceRecon.*` operations. Also widens `PreviewImportProfileRequest`.

- [ ] **Step 1: Write the failing test**

Create `tests/contract/workspace-recon.test.ts`:

```ts
/**
 * Workspace Recon contract shapes. The disclosure must carry the launch
 * boundary warning unmodified; confirmation must be impossible without it.
 */
import { describe, expect, it } from 'vitest';
import {
  operations,
  RECON_NO_AUTO_HIRE_STATEMENT,
  ReconOutcome,
  ReconRejectionView,
  ReconRunView,
  PreviewImportProfileRequest,
} from '@threadhelm/contracts';

describe('recon outcomes', () => {
  it('keeps all seven outcomes distinct with no blanket failure', () => {
    expect(ReconOutcome.options).toEqual([
      'completed',
      'partial',
      'no_output',
      'unparsable_output',
      'stopped_by_owner',
      'token_cap_reached',
      'provider_unauthenticated',
    ]);
    expect(ReconOutcome.options).not.toContain('failed');
  });
});

describe('workspaceRecon operations', () => {
  it('exposes preview, confirm and read', () => {
    expect(Object.keys(operations).filter((k) => k.startsWith('workspaceRecon.'))).toEqual([
      'workspaceRecon.previewLaunch',
      'workspaceRecon.confirmLaunch',
      'workspaceRecon.getRun',
    ]);
  });

  it('refuses confirmation without the boundary confirmation', () => {
    const request = operations['workspaceRecon.confirmLaunch'].request;
    expect(request.safeParse({ previewToken: 'tok', boundaryConfirmation: false }).success).toBe(
      false,
    );
    expect(request.safeParse({ previewToken: 'tok' }).success).toBe(false);
  });

  it('states that nothing is hired automatically and never claims read-only', () => {
    expect(RECON_NO_AUTO_HIRE_STATEMENT).toContain('No agent is hired');
    expect(RECON_NO_AUTO_HIRE_STATEMENT.toLowerCase()).not.toContain('read-only');
  });
});

describe('ReconRunView', () => {
  const base = {
    runId: '11111111-1111-4111-8111-111111111111',
    workspaceId: '22222222-2222-4222-8222-222222222222',
    sessionId: null,
    outcome: null,
    derivedFromCommit: null,
    startedAt: '2026-09-02T00:00:00.000Z',
    completedAt: null,
    proposals: [],
    rejected: [],
    ignoredFileCount: 0,
  };

  it('accepts a run that is still in flight', () => {
    expect(ReconRunView.safeParse(base).success).toBe(true);
  });

  it('records absence of a commit as null rather than an empty string', () => {
    expect(ReconRunView.safeParse({ ...base, derivedFromCommit: '' }).success).toBe(false);
  });

  it('bounds proposals to the collection limit', () => {
    const rejection = ReconRejectionView.parse({ sourceBasename: 'x.json', errorCode: 'X' });
    const rejected = Array.from({ length: 13 }, () => rejection);
    expect(ReconRunView.safeParse({ ...base, rejected }).success).toBe(false);
  });
});

describe('PreviewImportProfileRequest', () => {
  it('accepts exactly one source', () => {
    expect(PreviewImportProfileRequest.safeParse({ fileHandle: 'h' }).success).toBe(true);
    expect(
      PreviewImportProfileRequest.safeParse({
        proposalId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
    expect(PreviewImportProfileRequest.safeParse({}).success).toBe(false);
    expect(
      PreviewImportProfileRequest.safeParse({
        fileHandle: 'h',
        proposalId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project contract tests/contract/workspace-recon.test.ts`
Expected: FAIL — `ReconOutcome` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `packages/contracts/src/index.ts`, immediately after the agent-profile section (after `AgentProfileDetailView`, around line 1450), add:

```ts
// Workspace Recon (docs/superpowers/specs/2026-09-02-workspace-recon-design.md).
// A recon session is an ordinary session; these shapes add only the bounds and
// provenance a proposed roster needs.

export const RECON_NO_AUTO_HIRE_STATEMENT =
  'Recon proposes roles only. No agent is hired and no authority is granted until you review and confirm each one.';

export const MAX_RECON_PROPOSALS = 12;

export const ReconOutcome = z.enum([
  'completed',
  'partial',
  'no_output',
  'unparsable_output',
  'stopped_by_owner',
  'token_cap_reached',
  'provider_unauthenticated',
]);
export type ReconOutcome = z.infer<typeof ReconOutcome>;

export const ReconRole = z.enum(['supervisor', 'specialist']);
export type ReconRole = z.infer<typeof ReconRole>;

export const ReconProposalView = strictObject({
  proposalId: Uuid,
  role: ReconRole,
  sourceBasename: z.string().min(1).max(200),
  digest: ProfileDigest,
  manifest: AgentManifestV1,
  compatibility: ProfileCompatibility,
  compatibilityReasons: z.array(z.string().max(300)).max(20),
});
export type ReconProposalView = z.infer<typeof ReconProposalView>;

export const ReconRejectionView = strictObject({
  sourceBasename: z.string().min(1).max(200),
  /** A stable ThreadHelmError code; never a raw parser message. */
  errorCode: z.string().min(1).max(64),
});
export type ReconRejectionView = z.infer<typeof ReconRejectionView>;

export const ReconRunView = strictObject({
  runId: Uuid,
  workspaceId: Uuid,
  sessionId: Uuid.nullable(),
  /** Null while the run is still in flight. */
  outcome: ReconOutcome.nullable(),
  /** Null when the approved folder is not a Git working tree. */
  derivedFromCommit: z.string().regex(/^[0-9a-f]{40}$/).nullable(),
  startedAt: Timestamp,
  completedAt: Timestamp.nullable(),
  proposals: z.array(ReconProposalView).max(MAX_RECON_PROPOSALS),
  rejected: z.array(ReconRejectionView).max(MAX_RECON_PROPOSALS),
  ignoredFileCount: z.number().int().min(0),
});
export type ReconRunView = z.infer<typeof ReconRunView>;

export const ReconLaunchPreviewView = strictObject({
  /** The unmodified session disclosure, boundary warning included. */
  launch: LaunchPreviewView,
  outputDirectory: z.string().min(1),
  tokenCap: z.number().int().positive().max(MAX_TOKEN_CAP),
  /** The exact text sent as this session's first input. */
  reconPrompt: z.string().min(1).max(8000),
  autoHireStatement: z.literal(RECON_NO_AUTO_HIRE_STATEMENT),
});
export type ReconLaunchPreviewView = z.infer<typeof ReconLaunchPreviewView>;
```

Replace the existing `PreviewImportProfileRequest` definition (currently around line 1453) with:

```ts
/** Accepts a renderer file-selection handle or a recon proposal, never both. */
export const PreviewImportProfileRequest = strictObject({
  fileHandle: z.string().min(1).max(256).optional(),
  proposalId: Uuid.optional(),
}).refine(
  (value) => (value.fileHandle === undefined) !== (value.proposalId === undefined),
  'exactly one import source',
);
```

In the `OPERATIONS` map, immediately after the `'profiles.confirmDelete'` entry, add:

```ts
  'workspaceRecon.previewLaunch': {
    request: strictObject({
      workspaceId: Uuid,
      providerId: ProviderId,
      terminal: TerminalSize,
    }),
    response: ReconLaunchPreviewView,
  },
  'workspaceRecon.confirmLaunch': {
    request: strictObject({
      previewToken: OpaqueToken,
      boundaryConfirmation: z.literal(true),
    }),
    response: ReconRunView,
  },
  'workspaceRecon.getRun': {
    request: strictObject({ workspaceId: Uuid }),
    response: ReconRunView.nullable(),
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project contract tests/contract/workspace-recon.test.ts && pnpm typecheck`
Expected: PASS, 8 tests, and typecheck clean. If typecheck reports an error at `apps/desktop/src/main/coordination/profiles.ts` on `request.fileHandle`, that is the widened request type surfacing correctly — fix it in Task 5, not here, by leaving the call site as `if (request.fileHandle === undefined) throw ...` for now.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/index.ts tests/contract/workspace-recon.test.ts
git commit -m "feat: add workspace recon contract shapes and operations"
```

---

### Task 3: Persistence — recon provenance on accepted profiles

**Files:**
- Modify: `packages/persistence/src/schema.ts`
- Modify: `packages/persistence/src/repositories/agent-profiles.ts`
- Test: `tests/unit/persistence/workspace-recon.test.ts`

**Interfaces:**
- Consumes: `ImportProfileManifestInput` from `packages/persistence/src/repositories/agent-profiles.ts`.
- Produces: `ImportProfileManifestInput` gains `reconRunId?: string | null` and `derivedFromCommit?: string | null`; `AgentProfileDetailView` rows carry them back.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/persistence/workspace-recon.test.ts`. Open the database the way the sibling `tests/unit/persistence/agent-profiles.test.ts` does — copy its setup helper exactly rather than inventing one:

```ts
/**
 * Recon provenance survives import and defaults to null for a hand-picked file.
 */
import { describe, expect, it } from 'vitest';
import { migrate, openDatabase, readSchemaVersion } from '@threadhelm/persistence';

// Reuse the in-memory database helper from tests/unit/persistence/agent-profiles.test.ts.
// If that file exports no helper, inline the same three lines it uses.

describe('recon provenance columns', () => {
  it('migrates a version 3 database forward without loss', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    expect(readSchemaVersion(db)).toBeGreaterThanOrEqual(4);
    const columns = db
      .prepare(`SELECT name FROM pragma_table_info('agent_profiles')`)
      .all()
      .map((row) => (row as { name: string }).name);
    expect(columns).toContain('recon_run_id');
    expect(columns).toContain('derived_from_commit');
    db.close();
  });

  it('defaults both columns to null for an import with no recon provenance', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    const row = db
      .prepare(`SELECT recon_run_id, derived_from_commit FROM agent_profiles LIMIT 0`)
      .all();
    expect(row).toEqual([]);
    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/persistence/workspace-recon.test.ts`
Expected: FAIL — `expect(readSchemaVersion(db)).toBeGreaterThanOrEqual(4)` receives 3.

- [ ] **Step 3: Write minimal implementation**

In `packages/persistence/src/schema.ts`:

1. Change `export const SCHEMA_VERSION = 3;` to `= 4;`.
2. Append a migration to the `MIGRATIONS` array, matching the shape of the existing entries:

```ts
  {
    version: 4,
    sql: `
ALTER TABLE agent_profiles ADD COLUMN recon_run_id TEXT;
ALTER TABLE agent_profiles ADD COLUMN derived_from_commit TEXT;
`,
  },
```

3. In the `CREATE TABLE agent_profiles` statement (around line 384), add the two columns so a fresh database matches a migrated one:

```sql
  recon_run_id TEXT,
  derived_from_commit TEXT,
```

In `packages/persistence/src/repositories/agent-profiles.ts`, add both fields to `ImportProfileManifestInput` as optional and nullable, and include them in the `INSERT` with `?? null`. Follow the existing column ordering in that file's insert statement.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/persistence && pnpm test:contract`
Expected: PASS, including the existing persistence and contract suites — a migration that breaks an existing row shape will surface here.

- [ ] **Step 5: Commit**

```bash
git add packages/persistence/src tests/unit/persistence/workspace-recon.test.ts
git commit -m "feat: record recon provenance on accepted profiles"
```

---

### Task 4: Fixture — a recon mode for the deterministic fake agent

Everything downstream is tested with no credentials, no network and no token spend, so this comes before main and renderer.

**Files:**
- Modify: `packages/test-fixtures/src/fake-agent.cjs`
- Modify: `packages/test-fixtures/src/runtime.ts`
- Create: `packages/test-fixtures/src/recon.ts`
- Modify: `packages/test-fixtures/src/index.ts`
- Test: `tests/unit/test-fixtures/recon-mode.test.ts`

**Interfaces:**
- Consumes: `FakeAgentMode`, `fakeAgentLaunch` from `packages/test-fixtures/src/runtime.ts`.
- Produces: `FakeAgentMode` gains `'recon'`; `fakeAgentLaunch('recon', { outDir })`; `RECON_PROPOSAL_FIXTURES: readonly { basename: string; text: string }[]` — four valid manifests (one `supervisor.agent.json`, three specialists) plus one malformed file, so every collection path is exercised by one run.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test-fixtures/recon-mode.test.ts`:

```ts
/**
 * The recon fixture writes a deterministic proposal set outside any workspace.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECON_PROPOSAL_FIXTURES, fakeAgentLaunch } from '@threadhelm/test-fixtures';
import { parseAgentManifest } from '@threadhelm/domain';

describe('fake agent recon mode', () => {
  it('writes exactly the fixture set into the directory it is given', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'recon-fixture-'));
    const { executable, args } = fakeAgentLaunch('recon', { outDir });
    execFileSync(executable, args, { encoding: 'utf8' });

    const written = readdirSync(outDir).sort();
    expect(written).toEqual(RECON_PROPOSAL_FIXTURES.map((f) => f.basename).sort());
    expect(written).toContain('supervisor.agent.json');
  });

  it('produces manifests that parse and carry a placeholder name', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'recon-fixture-'));
    const { executable, args } = fakeAgentLaunch('recon', { outDir });
    execFileSync(executable, args, { encoding: 'utf8' });

    const manifest = parseAgentManifest(
      readFileSync(join(outDir, 'supervisor.agent.json'), 'utf8'),
    );
    expect(manifest.name).toBe('Unnamed supervisor');
    expect(manifest.spec).toBe('threadhelm/agent-profile@1');
  });

  it('includes one malformed file so the rejection path is always exercised', () => {
    const malformed = RECON_PROPOSAL_FIXTURES.find((f) => f.basename.includes('malformed'));
    expect(malformed).toBeDefined();
    expect(() => parseAgentManifest(malformed!.text)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/test-fixtures/recon-mode.test.ts`
Expected: FAIL — `RECON_PROPOSAL_FIXTURES` is not exported.

- [ ] **Step 3: Write minimal implementation**

Create `packages/test-fixtures/src/recon.ts`. Manifest fields must satisfy `AgentManifestV1` exactly — `spec`, `name`, `description`, `provider`, `model`, `goal`, `capabilities`, `isolate`, `tokenCap`, `author`:

```ts
/** Deterministic recon proposal set (Workspace Recon). Names are placeholders by design. */

function manifest(fields: Record<string, unknown>): string {
  return `${JSON.stringify(fields, null, 2)}\n`;
}

const COMMON = {
  spec: 'threadhelm/agent-profile@1',
  provider: 'claude-code',
  model: 'claude-sonnet-5',
  isolate: false,
  tokenCap: 200_000,
  author: 'ThreadHelm recon fixture',
} as const;

export const RECON_PROPOSAL_FIXTURES: readonly { basename: string; text: string }[] = [
  {
    basename: 'supervisor.agent.json',
    text: manifest({
      ...COMMON,
      name: 'Unnamed supervisor',
      description: 'Owns the outcome and delegates bounded work.',
      goal: 'Decompose one outcome into bounded assignments and verify each result before reporting done.',
      capabilities: ['delegation', 'verification'],
    }),
  },
  {
    basename: 'native-addon.agent.json',
    text: manifest({
      ...COMMON,
      name: 'Unnamed specialist',
      description: 'Rust Node-API addon work.',
      goal: 'Change the Rust supervisor addon and keep cargo fmt, check and test green.',
      capabilities: ['rust', 'node-api'],
    }),
  },
  {
    basename: 'renderer.agent.json',
    text: manifest({
      ...COMMON,
      name: 'Unnamed specialist',
      description: 'React renderer and accessibility.',
      goal: 'Change renderer features and keep keyboard access and visible focus intact.',
      capabilities: ['react', 'accessibility'],
    }),
  },
  {
    basename: 'testing.agent.json',
    text: manifest({
      ...COMMON,
      name: 'Unnamed specialist',
      description: 'Vitest and Playwright Electron suites.',
      goal: 'Write failing tests first and keep the unit, contract and e2e projects green.',
      capabilities: ['vitest', 'playwright'],
    }),
  },
  { basename: 'malformed.agent.json', text: '{ "spec": "threadhelm/agent-profile@1", ' },
];
```

In `packages/test-fixtures/src/runtime.ts`, add `'recon'` to `FakeAgentMode` and pass the directory through:

```ts
export type FakeAgentMode =
  'echo' | 'burst' | 'control' | 'ignore-interrupt' | 'spawn-children' | 'spawn-bridge' | 'recon';

export function fakeAgentLaunch(
  mode: FakeAgentMode,
  opts: { lines?: number; outDir?: string } = {},
): { executable: string; args: string[] } {
  const args = [FAKE_AGENT_PATH, '--mode', mode];
  if (opts.lines !== undefined) args.push('--lines', String(opts.lines));
  if (opts.outDir !== undefined) args.push('--out-dir', opts.outDir);
  return { executable: process.execPath, args };
}
```

In `packages/test-fixtures/src/fake-agent.cjs`, add a `recon` branch to the existing `switch (mode)` (around line 137). Keep it CommonJS and dependency-free, matching the file's style. It must inline the same fixture set — the `.cjs` script cannot import the TypeScript module:

```js
  case 'recon': {
    const fs = require('node:fs');
    const path = require('node:path');
    const outDir = flag('out-dir', '');
    if (!outDir) {
      write('RECON_NO_OUT_DIR\n');
      break;
    }
    fs.mkdirSync(outDir, { recursive: true });
    for (const file of RECON_FILES) {
      fs.writeFileSync(path.join(outDir, file.basename), file.text, 'utf8');
    }
    write(`RECON_WROTE:${RECON_FILES.length}\n`);
    break;
  }
```

Define `RECON_FILES` near the top of `fake-agent.cjs` with the same five entries and identical text as `recon.ts`.

Export from `packages/test-fixtures/src/index.ts`:

```ts
export { RECON_PROPOSAL_FIXTURES } from './recon.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/test-fixtures/recon-mode.test.ts`
Expected: PASS, 3 tests.

Then add one guard so the two copies of the fixture set cannot drift. Append to the same test file:

```ts
it('keeps the .cjs copy of the fixture set identical to the module copy', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'recon-fixture-'));
  const { executable, args } = fakeAgentLaunch('recon', { outDir });
  execFileSync(executable, args, { encoding: 'utf8' });
  for (const fixture of RECON_PROPOSAL_FIXTURES) {
    expect(readFileSync(join(outDir, fixture.basename), 'utf8')).toBe(fixture.text);
  }
});
```

Run it; it must pass before you commit.

- [ ] **Step 5: Commit**

```bash
git add packages/test-fixtures/src tests/unit/test-fixtures/recon-mode.test.ts
git commit -m "feat: add a recon mode to the deterministic fake agent"
```

---

### Task 5: Main — the recon service

The largest task. It stays one task because its three parts (preview, launch, collect) cannot be reviewed independently — a preview that no launch consumes is not testable.

**Files:**
- Create: `apps/desktop/src/main/coordination/recon.ts`
- Modify: `apps/desktop/src/main/coordinator.ts`
- Modify: `apps/desktop/src/main/coordination/profiles.ts:170-190` (the `previewImport` call site)
- Modify: `apps/desktop/src/main/context.ts` (add `reconRoot: () => string`)
- Test: `tests/unit/main/recon.test.ts`

**Interfaces:**
- Consumes: `selectReconFiles`, `classifyReconOutcome`, `reconRoleForBasename`, `parseAgentManifest`, `evaluateProfileCompatibility` from `@threadhelm/domain`; `ReconRunView`, `ReconLaunchPreviewView`, `RECON_NO_AUTO_HIRE_STATEMENT` from `@threadhelm/contracts`; the existing session preview and launch services on `Context`.
- Produces:
  ```ts
  export interface ReconService {
    previewLaunch(request: OperationRequest<'workspaceRecon.previewLaunch'>): Promise<ReconLaunchPreviewView>;
    confirmLaunch(request: OperationRequest<'workspaceRecon.confirmLaunch'>): Promise<ReconRunView>;
    getRun(request: OperationRequest<'workspaceRecon.getRun'>): ReconRunView | null;
    /** Consumed by profiles.previewImport when the source is a proposal. */
    takeProposal(proposalId: string): { manifest: AgentManifestV1; digest: string; sourceBasename: string; runId: string; derivedFromCommit: string | null } | null;
    /** Resolves once collection for this run has finished. Deterministic waiting for tests. */
    whenCollected(runId: string): Promise<void>;
  }
  export function createReconService(ctx: Context): ReconService;
  ```

**Behaviour this task must implement, each with a test below:**

1. `previewLaunch` returns the unmodified `LaunchPreviewView` from the existing session preview path, plus `outputDirectory`, `tokenCap`, `reconPrompt` and `autoHireStatement`.
2. `confirmLaunch` launches through the existing session launch path, sends `reconPrompt` as the session's first input, and returns a `ReconRunView` with `outcome: null`.
3. `derivedFromCommit` is read once at launch by running `git rev-parse HEAD` in the workspace with a bounded timeout; any failure yields `null`.
4. When the session reaches a terminal lifecycle state, main lists the output directory, applies `selectReconFiles`, parses each considered file, computes compatibility, classifies the outcome, then deletes the directory.
5. A new run for a workspace discards the previous run's uncollected proposals and deletes any stale directory for that workspace first.
6. `takeProposal` returns a proposal once and only once.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/main/recon.test.ts`. Build the service against a fake `Context`, following the pattern in the existing `tests/unit/main/` suites — read one of them first and copy its context builder rather than writing a new one.

Write this harness at the top of the file before the `describe` blocks. Every test below depends on it, so it is part of Step 1, not a later cleanup:

```ts
const WORKSPACE_ID = '33333333-3333-4333-8333-333333333333';
let WORKSPACE_PATH: string;

interface ReconHarness {
  service: ReconService;
  /** The exact LaunchPreviewView the fake session preview returns. */
  launchPreview: LaunchPreviewView;
  outputDirOf(runId: string): string;
  /** Drives the session to a terminal lifecycle state and lets collection run. */
  completeSession(runId: string, opts: { ownerStopped: boolean }): Promise<void>;
}

function buildReconHarness(): ReconHarness {
  // 1. WORKSPACE_PATH = mkdtempSync(join(tmpdir(), 'recon-ws-'))
  // 2. reconRoot = mkdtempSync(join(tmpdir(), 'recon-root-'))
  // 3. ctx = buildContext({ reconRoot: () => reconRoot }) using the neighbouring
  //    suite's builder, with a fake session preview service returning a fixed
  //    LaunchPreviewView and a fake launch service recording sessionId + input.
  // 4. service = createReconService(ctx)
  // 5. completeSession emits the same terminal lifecycle signal the real
  //    registry emits, then awaits the service's collection promise.
  // Return { service, launchPreview, outputDirOf, completeSession }.
}

/** Runs previewLaunch + confirmLaunch and returns the started run. */
async function startRun(service: ReconService): Promise<ReconRunView> {
  const preview = await service.previewLaunch({
    workspaceId: WORKSPACE_ID,
    providerId: 'claude-code',
    terminal: { cols: 120, rows: 30 },
  });
  return service.confirmLaunch({
    previewToken: preview.launch.previewToken,
    boundaryConfirmation: true,
  });
}
```

`buildReconHarness` needs `createReconService` to expose its collection promise for deterministic awaiting. Give the service an internal `whenCollected(runId): Promise<void>` and export it on the interface — a test that polls a filesystem race is a flaky test.

```ts
/**
 * Recon service: honest disclosure, bounded collection, distinct outcomes,
 * and no reading of session output.
 */
import { mkdtempSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECON_NO_AUTO_HIRE_STATEMENT } from '@threadhelm/contracts';
import { RECON_PROPOSAL_FIXTURES } from '@threadhelm/test-fixtures';
import { createReconService } from '../../../apps/desktop/src/main/coordination/recon.js';
// buildContext: copy the fake-context helper from the neighbouring main tests.

describe('previewLaunch', () => {
  it('carries the session boundary warning unmodified', async () => {
    const { service, launchPreview } = buildReconHarness();
    const preview = await service.previewLaunch({
      workspaceId: WORKSPACE_ID,
      providerId: 'claude-code',
      terminal: { cols: 120, rows: 30 },
    });
    expect(preview.launch.boundaryWarning).toBe(launchPreview.boundaryWarning);
    expect(preview.autoHireStatement).toBe(RECON_NO_AUTO_HIRE_STATEMENT);
  });

  it('discloses the exact prompt it will send and never claims read-only', async () => {
    const { service } = buildReconHarness();
    const preview = await service.previewLaunch({
      workspaceId: WORKSPACE_ID,
      providerId: 'claude-code',
      terminal: { cols: 120, rows: 30 },
    });
    expect(preview.reconPrompt.length).toBeGreaterThan(0);
    expect(preview.reconPrompt.toLowerCase()).not.toContain('read-only');
    expect(preview.outputDirectory.toLowerCase()).not.toContain(WORKSPACE_PATH.toLowerCase());
  });
});

describe('collection', () => {
  it('classifies a fixture run with one malformed file as partial', async () => {
    const { service, completeSession, outputDirOf } = buildReconHarness();
    const run = await startRun(service);
    for (const fixture of RECON_PROPOSAL_FIXTURES) {
      writeFileSync(join(outputDirOf(run.runId), fixture.basename), fixture.text, 'utf8');
    }
    await completeSession(run.runId, { ownerStopped: false });

    const collected = service.getRun({ workspaceId: WORKSPACE_ID })!;
    expect(collected.outcome).toBe('partial');
    expect(collected.proposals).toHaveLength(4);
    expect(collected.rejected).toEqual([
      { sourceBasename: 'malformed.agent.json', errorCode: 'PROFILE_SCHEMA_INVALID' },
    ]);
    expect(collected.proposals.filter((p) => p.role === 'supervisor')).toHaveLength(1);
  });

  it('reports no_output when the session wrote nothing', async () => {
    const { service, completeSession } = buildReconHarness();
    const run = await startRun(service);
    await completeSession(run.runId, { ownerStopped: false });
    expect(service.getRun({ workspaceId: WORKSPACE_ID })!.outcome).toBe('no_output');
  });

  it('reports stopped_by_owner even when manifests were written', async () => {
    const { service, completeSession, outputDirOf } = buildReconHarness();
    const run = await startRun(service);
    writeFileSync(
      join(outputDirOf(run.runId), 'supervisor.agent.json'),
      RECON_PROPOSAL_FIXTURES[0]!.text,
      'utf8',
    );
    await completeSession(run.runId, { ownerStopped: true });

    const collected = service.getRun({ workspaceId: WORKSPACE_ID })!;
    expect(collected.outcome).toBe('stopped_by_owner');
    expect(collected.proposals).toHaveLength(1);
  });

  it('deletes the output directory once a run is collected', async () => {
    const { service, completeSession, outputDirOf } = buildReconHarness();
    const run = await startRun(service);
    const dir = outputDirOf(run.runId);
    await completeSession(run.runId, { ownerStopped: false });
    expect(existsSync(dir)).toBe(false);
  });
});

describe('repeat runs', () => {
  it('discards the previous run proposals when a new run starts', async () => {
    const { service, completeSession, outputDirOf } = buildReconHarness();
    const first = await startRun(service);
    writeFileSync(
      join(outputDirOf(first.runId), 'supervisor.agent.json'),
      RECON_PROPOSAL_FIXTURES[0]!.text,
      'utf8',
    );
    await completeSession(first.runId, { ownerStopped: false });
    expect(service.getRun({ workspaceId: WORKSPACE_ID })!.proposals).toHaveLength(1);

    const second = await startRun(service);
    const current = service.getRun({ workspaceId: WORKSPACE_ID })!;
    expect(current.runId).toBe(second.runId);
    expect(current.proposals).toEqual([]);
  });
});

describe('takeProposal', () => {
  it('returns a proposal once and then reports it gone', async () => {
    const { service, completeSession, outputDirOf } = buildReconHarness();
    const run = await startRun(service);
    writeFileSync(
      join(outputDirOf(run.runId), 'supervisor.agent.json'),
      RECON_PROPOSAL_FIXTURES[0]!.text,
      'utf8',
    );
    await completeSession(run.runId, { ownerStopped: false });

    const id = service.getRun({ workspaceId: WORKSPACE_ID })!.proposals[0]!.proposalId;
    expect(service.takeProposal(id)).not.toBeNull();
    expect(service.takeProposal(id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/main/recon.test.ts`
Expected: FAIL — cannot resolve `createReconService`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/desktop/src/main/coordination/recon.ts` following the structure of `profiles.ts`: a `createReconService(ctx: Context)` factory returning the interface above, a module-level `TokenStore` for previews keyed the way `profiles.ts` keys its preview snapshots, and a `Map<workspaceId, ReconRun>` for the current run.

Points the implementation must respect, each already covered by a test:

- Build the recon prompt as a module constant. It instructs the agent to read manifests, lockfiles, workspace and CI configuration, `README`, `CONTRIBUTING` and the directory shape; to write one `threadhelm/agent-profile@1` JSON file per role into the given directory; to name the supervisor file exactly `supervisor.agent.json`; to leave every `name` as a placeholder; to propose three to eight specialists; and to write nothing inside the workspace. It must not contain the words "read-only", "safe" or "sandboxed".
- `previewLaunch` calls the existing session preview service and embeds its result unchanged in `launch`. Do not reconstruct or edit `boundaryWarning`.
- `confirmLaunch` calls the existing session launch service with the stored preview token, then sends the prompt via the existing input path. Record `sessionId` on the run.
- `derivedFromCommit`: `execFile('git', ['rev-parse', 'HEAD'], { cwd: workspacePath, timeout: 2000 })`, trimmed, validated against `/^[0-9a-f]{40}$/`, else `null`. Never throw out of this.
- Collection subscribes to the same terminal-lifecycle signal the session registry already emits; it must not subscribe to output.
- Every parse failure is caught and recorded as `{ sourceBasename, errorCode: error.code }` where `error` is the `ThreadHelmError` from `parseAgentManifest`. A non-`ThreadHelmError` becomes `PROFILE_UNREADABLE`.
- Deleting the output directory uses `rm(dir, { recursive: true, force: true })` and never throws.

Add two fields to `Context` in `apps/desktop/src/main/context.ts`, following the existing optional-service-seam style used by `coordination?` and `memory?`:

```ts
  reconRoot: () => string;
  /** Main-owned recon authority; absent until handler composition. */
  recon?: ReconService;
```

`reconRoot` defaults to `join(app.getPath('userData'), 'recon')` where the real context is constructed, and to a temp directory in test contexts. `ctx.recon` is assigned during handler composition in `coordinator.ts`, the same way `ctx.coordination` and `ctx.memory` are. In `profiles.ts`, guard it: if `ctx.recon` is undefined when a `proposalId` arrives, throw `PROFILE_UNREADABLE` rather than dereferencing.

Wire the three operations in `apps/desktop/src/main/coordinator.ts` beside the `profiles.*` entries:

```ts
    'workspaceRecon.previewLaunch': (request) => recon.previewLaunch(request),
    'workspaceRecon.confirmLaunch': (request) => recon.confirmLaunch(request),
    'workspaceRecon.getRun': (request) => recon.getRun(request),
```

In `apps/desktop/src/main/coordination/profiles.ts`, change `previewImport` to branch on the source:

```ts
    async previewImport(request) {
      if (request.proposalId !== undefined) {
        const proposal = ctx.recon.takeProposal(request.proposalId);
        if (!proposal) {
          throw new ThreadHelmError(
            'PROFILE_UNREADABLE',
            'That proposed role is no longer available.',
          );
        }
        return snapshotPreview(proposal.manifest, proposal.digest, proposal.sourceBasename);
      }
      const path = handles.get(request.fileHandle!);
      // ...existing body unchanged from here
    },
```

Extract the existing tail of `previewImport` (from `evaluateProfileCompatibility` onward) into a local `snapshotPreview(manifest, digest, sourceBasename)` so both sources share one path. Do not duplicate it.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/main/recon.test.ts && pnpm typecheck && pnpm test:unit && pnpm test:contract`
Expected: PASS across all four.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main tests/unit/main/recon.test.ts
git commit -m "feat: add the workspace recon service"
```

---

### Task 6: Renderer — roster region and proposal review

**Files:**
- Create: `apps/desktop/src/renderer/features/workspaces/WorkspaceRoster.tsx`
- Modify: the workspace view that renders an approved workspace (find it with `rg -l "workspaces.list" apps/desktop/src/renderer`)
- Modify: `apps/desktop/src/preload/` bridge surface, if operations are enumerated there
- Test: `tests/e2e/workspace-recon.spec.ts` (written in Task 7)

**Interfaces:**
- Consumes: `api.workspaceRecon.previewLaunch` / `confirmLaunch` / `getRun`, and `api.profiles.previewImport({ proposalId })` / `confirmImport`.
- Produces: no exports other than the component.

- [ ] **Step 1: Build the empty state**

Render, when `getRun` returns `null` or a run with no proposals:

```tsx
<section aria-labelledby="roster-heading">
  <h2 id="roster-heading">Roster</h2>
  <p>No roster yet. Recon can read this workspace and propose one.</p>
  <button type="button" onClick={openReconDisclosure}>Run recon</button>
</section>
```

Never render a placeholder or example role here.

- [ ] **Step 2: Build the disclosure dialog**

Show, from `ReconLaunchPreviewView`: agent display name, version, resolved executable, workspace display path, `launch.boundaryWarning` verbatim, `outputDirectory`, `tokenCap`, `autoHireStatement`, and `reconPrompt` in a scrollable `<pre>`. One checkbox confirming the folder-access boundary, then `Start recon`. Follow the existing `LaunchDialog.tsx` for markup, focus handling and checkbox wiring — copy its patterns rather than inventing new ones.

- [ ] **Step 3: Build the proposal list**

Supervisor first, then specialists in name order. Per row: role, goal, capability labels, compatibility. One `Review` button per row. No accept-all control anywhere. Below the list, render rejected files as `<basename> — <errorCode>` and, when `ignoredFileCount > 0`, `N further files were not read.`

Render the outcome as a sentence per state, all seven distinct:

```ts
const OUTCOME_TEXT: Record<ReconOutcome, string> = {
  completed: 'Recon finished and every file it wrote was read.',
  partial: 'Recon finished. Some files could not be read.',
  no_output: 'Recon finished without writing any roles.',
  unparsable_output: 'Recon wrote files, but none could be read as a role.',
  stopped_by_owner: 'You stopped this recon run.',
  token_cap_reached: 'Recon reached its token cap for this run.',
  provider_unauthenticated: 'The provider was not authenticated, so recon did not run.',
};
```

No retry button on any of these. `Run recon` remains available as the same explicit action it always was.

- [ ] **Step 4: Wire Review to the existing import gate**

`Review` calls `api.profiles.previewImport({ proposalId })` and renders the existing profile preview component unchanged, including its digest and compatibility display. The display-name field starts empty with placeholder text `Name this agent`, and `Confirm` is disabled until the owner types one.

- [ ] **Step 5: Verify accessibility and commit**

Run: `pnpm lint && pnpm typecheck && pnpm format`

Check by keyboard only: tab reaches `Run recon`, the dialog traps focus and returns it on close, every `Review` button is reachable with visible focus, and the outcome sentence is in a live region. No animation on the list.

```bash
git add apps/desktop/src/renderer apps/desktop/src/preload
git commit -m "feat: show the proposed roster and route review through profile import"
```

---

### Task 7: Windows integration and end-to-end coverage

**Files:**
- Create: `tests/integration/windows/workspace-recon.test.ts`
- Create: `tests/e2e/workspace-recon.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6. Produces nothing.

- [ ] **Step 1: Write the Windows integration test**

Model it on `tests/integration/windows/agent-profile-import.test.ts`, reusing its app-startup and workspace-approval helpers. Define these four locally at the top of the file — they are the only new helpers, and every assertion below depends on them:

```ts
/** Approves a temp workspace, previews and confirms a recon launch against the fixture agent. */
async function startReconAgainstFixture(
  opts: { mode?: FakeAgentMode } = {},
): Promise<ReconRunView>;

/** Awaits service.whenCollected(runId) and returns the collected run. */
async function waitForOutcome(runId: string): Promise<ReconRunView>;

/** The run's output directory under the app's reconRoot. */
function outputDirOf(runId: string): string;

/** Sorted relative paths plus sizes, for asserting a tree is untouched. */
function snapshotTree(root: string): { path: string; size: number }[];
```

`forceStop(sessionId)` and `killWithoutCollecting(sessionId)` are the existing force-stop and process-kill helpers from the neighbouring Windows integration suites; import them rather than reimplementing.

It must assert:

```ts
it('runs recon in its own job object and leaves the workspace untouched', async () => {
  const before = snapshotTree(workspacePath);
  const run = await startReconAgainstFixture();
  await waitForOutcome(run.runId);
  expect(snapshotTree(workspacePath)).toEqual(before);
});

it('writes proposals outside the approved workspace', async () => {
  const run = await startReconAgainstFixture();
  expect(outputDirOf(run.runId).toLowerCase()).not.toContain(workspacePath.toLowerCase());
});

it('force stop terminates a recon session and records stopped_by_owner', async () => {
  const run = await startReconAgainstFixture({ mode: 'ignore-interrupt' });
  await forceStop(run.sessionId!);
  expect((await waitForOutcome(run.runId)).outcome).toBe('stopped_by_owner');
});

it('deletes a stale output directory when a new run starts for the same workspace', async () => {
  const first = await startReconAgainstFixture();
  const staleDir = outputDirOf(first.runId);
  await killWithoutCollecting(first.sessionId!);
  await startReconAgainstFixture();
  expect(existsSync(staleDir)).toBe(false);
});
```

- [ ] **Step 2: Run it**

Run: `pnpm test:integration:windows -- workspace-recon`
Expected: PASS, 4 tests.

- [ ] **Step 3: Write the end-to-end journey**

Model it on `tests/e2e/agent-roster.spec.ts`. `approveFixtureWorkspace(app)` is that suite's existing helper — import it. `countLaunchedSessions(app)` is new: read the session list through the app's own `sessions.list` operation and return its length.

```ts
test('approve, run recon, accept two roles, and name them yourself', async () => {
  await approveFixtureWorkspace(app);
  await expect(page.getByText('No roster yet.')).toBeVisible();

  await page.getByRole('button', { name: 'Run recon' }).click();
  await expect(page.getByText('ThreadHelm cannot confine')).toBeVisible(); // boundary warning
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Start recon' }).click();

  await expect(page.getByText('Some files could not be read.')).toBeVisible();
  await expect(page.getByText('malformed.agent.json')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review' })).toHaveCount(4);
  await expect(page.getByRole('button', { name: /accept all/i })).toHaveCount(0);

  for (const name of ['Tony Stark', 'Rhodey']) {
    await page.getByRole('button', { name: 'Review' }).first().click();
    await page.getByLabel('Name this agent').fill(name);
    await page.getByRole('button', { name: 'Confirm' }).click();
  }

  await expect(page.getByText('Tony Stark')).toBeVisible();
  await expect(page.getByText('Rhodey')).toBeVisible();
  await expect(page.getByText('Unnamed supervisor')).toHaveCount(0);
});

test('a workspace opens with no recon and no provider contact', async () => {
  await approveFixtureWorkspace(app);
  await expect(page.getByText('No roster yet.')).toBeVisible();
  expect(await countLaunchedSessions(app)).toBe(0);
});
```

The second test is the guard for the "never automatic" constraint. Do not delete it.

- [ ] **Step 4: Run the full gate**

Run, in this order:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:contract
pnpm desktop:build
pnpm test:integration:windows
pnpm test:e2e
```

Expected: every one green. Do not claim completion on a partial run.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/windows/workspace-recon.test.ts tests/e2e/workspace-recon.spec.ts
git commit -m "test: cover recon containment, honest outcomes and owner-typed names"
```

---

## Coverage against the spec

| Spec section | Task |
| --- | --- |
| § Owner decisions 1 (offered, never automatic) | 6 (empty state), 7 (guard test) |
| § Owner decisions 2 (recon is a normal session) | 5 (reuses preview/launch), 7 (job object, force stop) |
| § Owner decisions 3 (both roles, never a name) | 4 (placeholder fixtures), 6 (empty name field), 7 (owner-typed assertion) |
| § Owner decisions 4 (files, not transcript) | 5 (no output subscription) |
| § Owner decisions 5 (`derivedFromCommit`) | 3 (column), 5 (git rev-parse, null on failure) |
| § Owner decisions 6 (standalone) | Branch dependency note only |
| § The honesty boundary | 2 (`boundaryWarning` embedded whole), 5 (prompt wording), 6 (verbatim render) |
| § Trust model | 5 (routes through `parseAgentManifest`) |
| § 1.1 entry point | 6 |
| § 1.2 launch disclosure | 2, 5, 6 |
| § 1.3 the session | 5 |
| § 1.4 collection | 1 (bounds), 5 (parse and classify) |
| § 1.5 acceptance | 5 (`takeProposal`), 6 (review handoff) |
| § 1.6 repeat runs and cleanup | 5 (discard + delete), 7 (stale directory) |
| § Phase 2 contract surface | 2 |
| § Phase 3 outcomes | 1 (classification), 6 (seven sentences) |
| § Testing | 1, 3, 4, 5, 7 |
