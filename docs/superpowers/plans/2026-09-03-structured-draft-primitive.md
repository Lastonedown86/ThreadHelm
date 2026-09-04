# AI Structured-Draft Primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give main a bounded, non-interactive "send a prompt, get back validated JSON" call against the two built-in provider CLIs (`codex exec --json`, `claude -p --output-format json`), with no PTY, no tool access, and a hard timeout — the missing primitive both this plan's own repo-idea feature and the existing (unimplemented) Outcome/Crew/Access Coach contract need.

**Architecture:** Adapters gain an optional `buildStructuredDraft` method that returns a `LaunchDescriptor`-shaped invocation (adapters never spawn processes themselves, matching every other capability here) plus an adapter-specific `parseStructuredDraftOutput` reducer that turns each CLI's raw stdout shape into one plain string. A new main-owned `StructuredDraftRunner` (mirroring the existing `ProbeRunner`/`runBounded` pattern) executes the descriptor with `execFile`, a timeout, and a byte cap, feeds the result through the adapter's parser, then the caller (a future service, not built in this plan) parses that string as JSON and validates it against its own Zod schema. This plan also adds bounded repo-metadata readers (file tree, README, manifest, commit subjects) that a caller can assemble into a prompt — but does not build any caller, mission-composer wiring, or UI. Nothing in this plan is reachable from the renderer.

**Tech Stack:** TypeScript, Zod (`@threadhelm/contracts`), Node's built-in `child_process.execFile`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-03-repo-idea-generation-design.md` (§3 "What the model sees" and the `proposeRepoIdeas` operation in §4 describe the eventual caller this plan enables; this plan builds only the reusable primitive underneath it).

## Global Constraints

- Adapters never spawn processes or touch the filesystem themselves — only main's runner calls `execFile`; adapters only build descriptors and parse output (per the existing file-header comment in `packages/providers/src/adapter.ts:5-7`).
- Every call is bounded: a hard timeout (`STRUCTURED_DRAFT_TIMEOUT_MS`), a max-output-byte cap, no retry, no provider/model substitution — same posture as `runProbe`/`runBounded`.
- No PTY, no interactive session, no tool execution, no credentials beyond what the CLI already has from its own login state (same as `probe()`'s `login status`/`auth status` calls — this reads auth, never writes or elevates it).
- Raw provider output is reduced or rejected inside the adapter (matches the existing `parseLifecycleEvidence` doc comment at `adapter.ts:255`) — main never stores, logs, or forwards a provider's raw stdout.
- The file-tree walker never reads `.git/` internals, never follows symlinks outside the workspace root, and is bounded by both depth and total entry count — no unbounded recursion into a huge repo.
- Git shell-outs use `execFileAsync('git', [...], { cwd, timeout, windowsHide: true })` exactly like the existing `headCommit` in `apps/desktop/src/main/coordination/recon.ts:189-201`, and fail soft (return `null`/`[]`) — git absence or a non-repo directory is not an error.
- Never `npx`; always `pnpm exec`. Branch: `feat/structured-draft-primitive`. Commit after every task. Attribution trailer on every commit:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT`.
- Commands: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:contract`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `packages/providers/src/adapter.ts` | `StructuredDraftContext`/`StructuredDraftDescriptor` types, `buildStructuredDraft?`/`parseStructuredDraftOutput?` on `ProviderAdapter`, `capabilities.structuredDraft` flag. |
| `packages/providers/src/codex.ts` | Codex's `buildStructuredDraft`/`parseStructuredDraftOutput`. |
| `packages/providers/src/claude-code.ts` | Claude Code's `buildStructuredDraft`/`parseStructuredDraftOutput`. |
| `packages/contracts/src/index.ts` | New `ErrorCode` members: `STRUCTURED_DRAFT_UNAVAILABLE`, `STRUCTURED_DRAFT_TIMEOUT`, `STRUCTURED_DRAFT_OUTPUT_INVALID`. |
| `apps/desktop/src/main/providers/structured-draft.ts` | New. `StructuredDraftRunner` interface, `createStructuredDraftRunner()` (real `execFile`-based implementation), `runStructuredDraft(ctx, providerId, prompt)` helper mirroring `probeProvider`. |
| `apps/desktop/src/main/context.ts` | `structuredDraft: StructuredDraftRunner` field on `Context`. |
| `apps/desktop/src/main/bootstrap.ts` | Wires `structuredDraft: createStructuredDraftRunner()`. |
| `apps/desktop/src/main/coordination/repo-metadata.ts` | New. `readFileTree`, `readReadme`, `readManifest`, `readRecentCommitSubjects` — all bounded, all fail-soft. |
| `tests/contract/helpers/fake-context.ts` | Default `structuredDraft` field on the fake `Context` (held/unsupported by default; individual tests override `world.ctx.structuredDraft` directly, the same pattern already used for `world.ctx.probes`). |
| `tests/unit/providers/structured-draft.test.ts` | Adapter descriptor/parser unit tests. |
| `tests/unit/main/repo-metadata.test.ts` | Repo-metadata reader unit tests against a real temp directory. |
| `tests/contract/structured-draft-runner.test.ts` | Runner-level test proving the bounded-exec → parse round trip, overriding `world.ctx.structuredDraft` instead of shelling out to a real CLI. |

---

### Task 1: Provider adapter capability surface

**Files:**

- Modify: `packages/providers/src/adapter.ts`
- Test: `tests/unit/providers/structured-draft.test.ts` (this task's slice: capability shape only)

**Interfaces:**

- Produces: `StructuredDraftContext { prompt: string; resolvedExecutable: string; executableKind: ExecutableKind }`, `StructuredDraftDescriptor { executable: string; args: string[]; cwd?: string }`, `ProviderAdapter.buildStructuredDraft?(ctx: StructuredDraftContext): StructuredDraftDescriptor`, `ProviderAdapter.parseStructuredDraftOutput?(raw: { stdout: string; stderr: string; exitCode: number | null }): string | null`, `capabilities.structuredDraft?: boolean`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/providers/structured-draft.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { codexAdapter, claudeCodeAdapter } from '@threadhelm/providers';

describe('structured-draft capability surface', () => {
  it('codex declares the capability and builds a non-interactive descriptor', () => {
    expect(codexAdapter.capabilities.structuredDraft).toBe(true);
    const descriptor = codexAdapter.buildStructuredDraft!({
      prompt: 'List three ideas.',
      resolvedExecutable: 'C:\\codex\\codex.exe',
      executableKind: 'native',
    });
    expect(descriptor.executable).toBe('C:\\codex\\codex.exe');
    expect(descriptor.args).toEqual(['exec', '--json', 'List three ideas.']);
  });

  it('claude-code declares the capability and builds a non-interactive descriptor', () => {
    expect(claudeCodeAdapter.capabilities.structuredDraft).toBe(true);
    const descriptor = claudeCodeAdapter.buildStructuredDraft!({
      prompt: 'List three ideas.',
      resolvedExecutable: 'C:\\claude\\claude.exe',
      executableKind: 'native',
    });
    expect(descriptor.executable).toBe('C:\\claude\\claude.exe');
    expect(descriptor.args).toEqual([
      '-p',
      '--output-format',
      'json',
      'List three ideas.',
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/providers/structured-draft.test.ts`
Expected: FAIL — `buildStructuredDraft` is `undefined` on both adapters (Task 2/3 add the real implementations; this step only needs the interface to compile, so the test fails at the `!()` call, not at typecheck).

- [ ] **Step 3: Add the capability surface to the adapter contract**

In `packages/providers/src/adapter.ts`, after the `ProbeContext` interface (line 58), add:

```ts
export interface StructuredDraftContext {
  /** The exact text sent to the CLI. Main assembled this; adapters never edit it. */
  prompt: string;
  resolvedExecutable: string;
  executableKind: ExecutableKind;
}

export interface StructuredDraftDescriptor {
  executable: string;
  args: string[];
  /** Omitted when the call needs no working directory (it reads no workspace). */
  cwd?: string;
}

export interface StructuredDraftExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
```

In the `capabilities` object type (lines 236-248), add one field after `structuredActivity: boolean;`:

```ts
    structuredActivity: boolean;
    /** True only for adapters with a verified non-interactive JSON-emitting mode. */
    structuredDraft?: boolean;
```

In the `ProviderAdapter` interface (lines 232-263), add after `buildCleanStop(ctx: StopContext): CleanStopAction;`:

```ts
  /** Absent when the adapter has no verified non-interactive mode. */
  buildStructuredDraft?(ctx: StructuredDraftContext): StructuredDraftDescriptor;
  /** Raw CLI output is reduced to one string here; main never sees the raw shape. */
  parseStructuredDraftOutput?(raw: StructuredDraftExecResult): string | null;
```

- [ ] **Step 4: Run to verify it still fails the same way**

Run: `pnpm test:unit -- tests/unit/providers/structured-draft.test.ts`
Expected: FAIL — now a clean assertion failure (`descriptor` is `undefined` because `buildStructuredDraft` is still `undefined` on both adapters), not a type error. Confirms the interface compiles.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (the new interface members are all optional, so no existing adapter or caller breaks).

- [ ] **Step 6: Commit**

```bash
git add packages/providers/src/adapter.ts tests/unit/providers/structured-draft.test.ts
git commit -m "feat(providers): structured-draft capability surface on ProviderAdapter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 2: Codex structured-draft implementation

**Files:**

- Modify: `packages/providers/src/codex.ts`
- Test: `tests/unit/providers/structured-draft.test.ts` (extends Task 1's file)

**Interfaces:**

- Consumes: `StructuredDraftContext`, `StructuredDraftDescriptor`, `StructuredDraftExecResult` (Task 1).
- Produces: `codexAdapter.buildStructuredDraft`, `codexAdapter.parseStructuredDraftOutput`.

**Important — verify against the real CLI during implementation:** `codex exec --json` streams JSON Lines (one JSON object per line) as it runs, with event types including `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, and `item.*` entries for the agent's output. The exact field names below (`type`, `item.text`) are the best-documented shape as of this plan's research but have not been executed against a live `codex` binary in this environment. If the installed CLI's actual JSONL differs, adjust `parseStructuredDraftOutput`'s field access to match — the test in Step 1 is written against a literal JSONL fixture string, so update that fixture to match reality first, then adjust the parser until it passes again.

- [ ] **Step 1: Extend the failing test with codex's output-parsing case**

Append to `tests/unit/providers/structured-draft.test.ts`:

```ts
describe('codex structured-draft output parsing', () => {
  it('extracts the final agent text from a JSONL stream', () => {
    const jsonl = [
      JSON.stringify({ type: 'thread.started', thread_id: 't1' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: '{"ideas":[]}' },
      }),
      JSON.stringify({ type: 'turn.completed' }),
    ].join('\n');
    const text = codexAdapter.parseStructuredDraftOutput!({
      stdout: jsonl,
      stderr: '',
      exitCode: 0,
    });
    expect(text).toBe('{"ideas":[]}');
  });

  it('returns null when no agent_message item is present', () => {
    const jsonl = [JSON.stringify({ type: 'turn.failed' })].join('\n');
    expect(
      codexAdapter.parseStructuredDraftOutput!({ stdout: jsonl, stderr: '', exitCode: 1 }),
    ).toBeNull();
  });

  it('returns null on malformed JSONL rather than throwing', () => {
    expect(
      codexAdapter.parseStructuredDraftOutput!({
        stdout: 'not json\n{also not json',
        stderr: '',
        exitCode: 0,
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/providers/structured-draft.test.ts`
Expected: FAIL — `codexAdapter.buildStructuredDraft`/`parseStructuredDraftOutput` are `undefined`.

- [ ] **Step 3: Implement**

In `packages/providers/src/codex.ts`, add after the `launchArgs` function:

```ts
function parseCodexAgentMessage(stdout: string): string | null {
  const lines = stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      (event as { type: unknown }).type === 'item.completed' &&
      'item' in event &&
      typeof (event as { item: unknown }).item === 'object' &&
      (event as { item: { type?: unknown; text?: unknown } }).item !== null
    ) {
      const item = (event as { item: { type?: unknown; text?: unknown } }).item;
      if (item.type === 'agent_message' && typeof item.text === 'string') return item.text;
    }
  }
  return null;
}
```

In the `codexAdapter` object literal, add after `buildCleanStop(): CleanStopAction { ... },`:

```ts
  buildStructuredDraft(ctx) {
    return { executable: ctx.resolvedExecutable, args: ['exec', '--json', ctx.prompt] };
  },
  parseStructuredDraftOutput(raw) {
    if (raw.exitCode !== 0) return null;
    return parseCodexAgentMessage(raw.stdout);
  },
```

Add `structuredDraft: true,` to the `capabilities` object, after `structuredActivity: false,`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit -- tests/unit/providers/structured-draft.test.ts`
Expected: PASS (all tests, including Task 1's).

- [ ] **Step 5: Commit**

```bash
git add packages/providers/src/codex.ts tests/unit/providers/structured-draft.test.ts
git commit -m "feat(providers): codex exec --json structured-draft support

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 3: Claude Code structured-draft implementation

**Files:**

- Modify: `packages/providers/src/claude-code.ts`
- Test: `tests/unit/providers/structured-draft.test.ts` (extends Task 1/2's file)

**Interfaces:**

- Consumes: same as Task 2.
- Produces: `claudeCodeAdapter.buildStructuredDraft`, `claudeCodeAdapter.parseStructuredDraftOutput`.

**Important — verify against the real CLI during implementation:** `claude -p --output-format json "<prompt>"` prints one JSON object to stdout (not JSONL) shaped like `{ result: string, session_id: string, ... }`, per the CLI's documented headless/print mode. The field name below (`result`) is the best-documented shape as of this plan's research but has not been executed against a live `claude` binary in this environment — same verification note as Task 2 applies.

- [ ] **Step 1: Extend the failing test with claude-code's output-parsing case**

Append to `tests/unit/providers/structured-draft.test.ts`:

```ts
describe('claude-code structured-draft output parsing', () => {
  it('extracts the result field from the JSON envelope', () => {
    const envelope = JSON.stringify({
      result: '{"ideas":[]}',
      session_id: 's1',
      is_error: false,
    });
    const text = claudeCodeAdapter.parseStructuredDraftOutput!({
      stdout: envelope,
      stderr: '',
      exitCode: 0,
    });
    expect(text).toBe('{"ideas":[]}');
  });

  it('returns null when is_error is true', () => {
    const envelope = JSON.stringify({ result: 'ignored', is_error: true });
    expect(
      claudeCodeAdapter.parseStructuredDraftOutput!({
        stdout: envelope,
        stderr: '',
        exitCode: 0,
      }),
    ).toBeNull();
  });

  it('returns null on malformed JSON rather than throwing', () => {
    expect(
      claudeCodeAdapter.parseStructuredDraftOutput!({
        stdout: 'not json',
        stderr: '',
        exitCode: 0,
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/providers/structured-draft.test.ts`
Expected: FAIL — `claudeCodeAdapter.buildStructuredDraft`/`parseStructuredDraftOutput` are `undefined`.

- [ ] **Step 3: Implement**

In `packages/providers/src/claude-code.ts`, add after the `launchArgs` function:

```ts
function parseClaudePrintEnvelope(stdout: string): string | null {
  let envelope: unknown;
  try {
    envelope = JSON.parse(stdout.trim());
  } catch {
    return null;
  }
  if (typeof envelope !== 'object' || envelope === null) return null;
  const { result, is_error: isError } = envelope as { result?: unknown; is_error?: unknown };
  if (isError === true || typeof result !== 'string') return null;
  return result;
}
```

In the `claudeCodeAdapter` object literal, add after `buildCleanStop(): CleanStopAction { ... },`:

```ts
  buildStructuredDraft(ctx) {
    return {
      executable: ctx.resolvedExecutable,
      args: ['-p', '--output-format', 'json', ctx.prompt],
    };
  },
  parseStructuredDraftOutput(raw) {
    if (raw.exitCode !== 0) return null;
    return parseClaudePrintEnvelope(raw.stdout);
  },
```

Add `structuredDraft: true,` to the `capabilities` object, after `structuredActivity: false,`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit -- tests/unit/providers/structured-draft.test.ts`
Expected: PASS (all tests from Tasks 1-3).

- [ ] **Step 5: Commit**

```bash
git add packages/providers/src/claude-code.ts tests/unit/providers/structured-draft.test.ts
git commit -m "feat(providers): claude -p --output-format json structured-draft support

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 4: Main-process structured-draft runner

**Files:**

- Modify: `packages/contracts/src/index.ts` (`ErrorCode` list)
- Create: `apps/desktop/src/main/providers/structured-draft.ts`
- Modify: `apps/desktop/src/main/context.ts` (`structuredDraft` field)
- Modify: `apps/desktop/src/main/bootstrap.ts` (wire the real runner)
- Modify: `tests/contract/helpers/fake-context.ts` (default `structuredDraft` field on the fake `Context`)
- Test: `tests/contract/structured-draft-runner.test.ts`

**Interfaces:**

- Consumes: `ProviderAdapter.buildStructuredDraft`/`parseStructuredDraftOutput` (Tasks 1-3), `Context.adapters`, `resolveExecutable` (exported from `@threadhelm/providers`).
- Produces: `StructuredDraftRunner { run(providerId: ProviderId, prompt: string): Promise<{ text: string } | { held: true; reasonCode: string }> }`, `createStructuredDraftRunner(): StructuredDraftRunner`, `runStructuredDraft(ctx: Context, providerId: ProviderId, prompt: string): Promise<{ text: string } | { held: true; reasonCode: string }>`.

- [ ] **Step 1: Add the error codes**

In `packages/contracts/src/index.ts`, in the `ErrorCode` list, after `'MISSION_CONFIRMATION_EXPIRED',` insert:

```ts
  // structured-draft primitive
  'STRUCTURED_DRAFT_UNAVAILABLE',
  'STRUCTURED_DRAFT_TIMEOUT',
  'STRUCTURED_DRAFT_OUTPUT_INVALID',
```

- [ ] **Step 2: Write the failing contract test**

Create `tests/contract/structured-draft-runner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { runStructuredDraft } from '../../apps/desktop/src/main/providers/structured-draft.js';
import { createWorld } from './helpers/fake-context.js';

describe('structured-draft runner', () => {
  it('returns the adapter-parsed text on success', async () => {
    const world = createWorld();
    // Same override pattern already used for world.ctx.probes: tests assign
    // the field directly rather than going through a global test-hook.
    world.ctx.structuredDraft = {
      run: async (providerId) =>
        providerId === 'codex-cli'
          ? { text: '{"ideas":["a","b","c"]}' }
          : { held: true, reasonCode: 'STRUCTURED_DRAFT_UNSUPPORTED' },
    };
    const result = await runStructuredDraft(world.ctx, 'codex-cli', 'List three ideas.');
    expect(result).toEqual({ text: '{"ideas":["a","b","c"]}' });
  });

  it('reports held by default (fake context ships no structured-draft support)', async () => {
    const world = createWorld();
    const result = await runStructuredDraft(world.ctx, 'claude-code', 'List three ideas.');
    expect(result).toMatchObject({ held: true });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test:contract -- tests/contract/structured-draft-runner.test.ts`
Expected: FAIL — `apps/desktop/src/main/providers/structured-draft.js` does not exist yet.

- [ ] **Step 4: Write the runner**

Create `apps/desktop/src/main/providers/structured-draft.ts`:

```ts
/**
 * Bounded, non-interactive structured-draft calls (T-structured-draft-01).
 *
 * Mirrors providers/readiness.ts's probe runner: main resolves the
 * executable and executes the adapter's descriptor with a hard timeout and
 * a byte cap. The adapter reduces raw output to one string or null; this
 * module never inspects that string's contents and never retries.
 */

import { execFile } from 'node:child_process';
import { delimiter, isAbsolute, resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { ThreadHelmError, type ProviderId } from '@threadhelm/contracts';
import { builtInAdapters, resolveExecutable, type ProbeContext } from '@threadhelm/providers';
import type { Context } from '../context.js';

const MAX_STRUCTURED_DRAFT_OUTPUT = 256 * 1024;
export const STRUCTURED_DRAFT_TIMEOUT_MS = 30_000;

export type StructuredDraftOutcome = { text: string } | { held: true; reasonCode: string };

export interface StructuredDraftRunner {
  run(providerId: ProviderId, prompt: string): Promise<StructuredDraftOutcome>;
}

function isCmdExe(executable: string): boolean {
  return /[\\/]cmd\.exe$/i.test(executable);
}

function envDir(name: string): string | null {
  const value = process.env[name];
  return value && isAbsolute(value) ? resolve(value) : null;
}

function structuredDraftProbeContext(): Omit<ProbeContext, 'timeoutMs' | 'signal'> {
  const pathEntries = (process.env.PATH ?? '')
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && isAbsolute(entry))
    .map((entry) => resolve(entry));
  return {
    roots: {
      LOCALAPPDATA: envDir('LOCALAPPDATA'),
      APPDATA: envDir('APPDATA'),
      PROGRAMFILES: envDir('ProgramFiles'),
      USERPROFILE: envDir('USERPROFILE'),
    },
    pathEntries,
    excludedDirectories: [process.cwd()],
    fs: {
      async isFile(path) {
        try {
          return (await stat(path)).isFile();
        } catch {
          return false;
        }
      },
    },
    exec: () => {
      throw new Error('unused: structured-draft resolves the executable only, never probes');
    },
  };
}

function runBoundedExec(
  executable: string,
  args: readonly string[],
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolvePromise) => {
    const child = execFile(
      executable,
      [...args],
      {
        timeout: STRUCTURED_DRAFT_TIMEOUT_MS,
        maxBuffer: MAX_STRUCTURED_DRAFT_OUTPUT,
        windowsHide: true,
        shell: false,
        windowsVerbatimArguments: isCmdExe(executable),
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        resolvePromise({
          stdout: String(stdout).slice(0, MAX_STRUCTURED_DRAFT_OUTPUT),
          stderr: String(stderr).slice(0, MAX_STRUCTURED_DRAFT_OUTPUT),
          exitCode: typeof child.exitCode === 'number' ? child.exitCode : error ? null : 0,
        });
      },
    );
  });
}

/** Real runner: injected into bootstrap; contract tests override ctx.structuredDraft directly. */
export function createStructuredDraftRunner(): StructuredDraftRunner {
  return {
    async run(providerId, prompt) {
      const adapter = builtInAdapters.find((candidate) => candidate.id === providerId);
      if (!adapter?.buildStructuredDraft || !adapter.parseStructuredDraftOutput) {
        return { held: true, reasonCode: 'STRUCTURED_DRAFT_UNSUPPORTED' };
      }
      const resolved = await resolveExecutable(adapter, {
        ...structuredDraftProbeContext(),
        timeoutMs: STRUCTURED_DRAFT_TIMEOUT_MS,
      });
      if (!resolved) return { held: true, reasonCode: 'EXECUTABLE_NOT_FOUND' };
      const descriptor = adapter.buildStructuredDraft({
        prompt,
        resolvedExecutable: resolved.path,
        executableKind: resolved.kind,
      });
      const raw = await runBoundedExec(descriptor.executable, descriptor.args);
      const text = adapter.parseStructuredDraftOutput(raw);
      if (text === null) return { held: true, reasonCode: 'STRUCTURED_DRAFT_OUTPUT_INVALID' };
      return { text };
    },
  };
}

/** Thin ctx-shaped wrapper, mirroring providers/readiness.ts's probeProvider. */
export async function runStructuredDraft(
  ctx: Context,
  providerId: ProviderId,
  prompt: string,
): Promise<StructuredDraftOutcome> {
  try {
    return await ctx.structuredDraft.run(providerId, prompt);
  } catch (error) {
    ctx.log.warn('structured_draft.threw', {
      providerId,
      errorName: error instanceof Error ? error.name : 'unknown',
    });
    throw new ThreadHelmError(
      'STRUCTURED_DRAFT_UNAVAILABLE',
      'The structured draft request could not be completed.',
    );
  }
}
```

- [ ] **Step 5: Wire the field onto Context**

In `apps/desktop/src/main/context.ts`, add after `probes: ProbeRunner;` (line 214):

```ts
  /** Bounded, non-interactive structured-draft calls; contract tests override this directly. */
  structuredDraft: StructuredDraftRunner;
```

with `import type { StructuredDraftRunner } from './providers/structured-draft.js';` added to the imports.

- [ ] **Step 6: Wire the real implementation in bootstrap**

In `apps/desktop/src/main/bootstrap.ts`, add `structuredDraft: createStructuredDraftRunner(),` after `probes: createProbeRunner(),` (line 157), with `import { createStructuredDraftRunner } from './providers/structured-draft.js';` added alongside the existing `import { createProbeRunner } from './providers/readiness.js';`.

- [ ] **Step 7: Give the fake context a default `structuredDraft`**

`Context.structuredDraft` is a required field, so `tests/contract/helpers/fake-context.ts`'s `createWorld()` must supply one or every existing contract test fails to typecheck. In `tests/contract/helpers/fake-context.ts`, find the `ctx: { ... }` object literal inside `createWorld` (it already sets `probes: { context: () => ({ ... }) },` — add the new field immediately after that `probes` entry:

```ts
      structuredDraft: {
        run: async () => ({ held: true, reasonCode: 'STRUCTURED_DRAFT_UNSUPPORTED' }),
      },
```

No new helper function, no test-hook plumbing — individual tests override it by reassigning `world.ctx.structuredDraft` directly after `createWorld()` returns, exactly as Step 2's test does and exactly how other contract tests already override `world.ctx.probes`/`world.ctx.storage` per-test.

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test:contract -- tests/contract/structured-draft-runner.test.ts && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/contracts/src/index.ts apps/desktop/src/main/providers/structured-draft.ts apps/desktop/src/main/context.ts apps/desktop/src/main/bootstrap.ts tests/contract/helpers/fake-context.ts tests/contract/structured-draft-runner.test.ts
git commit -m "feat(main): bounded structured-draft runner over the provider adapters

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

### Task 5: Repo-metadata readers

**Files:**

- Create: `apps/desktop/src/main/coordination/repo-metadata.ts`
- Test: `tests/unit/main/repo-metadata.test.ts`

**Interfaces:**

- Produces: `readFileTree(root: string, opts?: { maxDepth?: number; maxEntries?: number }): Promise<string[]>`, `readReadme(root: string, maxBytes?: number): Promise<string | null>`, `readManifest(root: string, maxBytes?: number): Promise<{ filename: string; contents: string } | null>`, `readRecentCommitSubjects(root: string, limit?: number): Promise<string[]>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/main/repo-metadata.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readFileTree,
  readReadme,
  readManifest,
  readRecentCommitSubjects,
} from '../../../apps/desktop/src/main/coordination/repo-metadata.js';

const execFileAsync = promisify(execFile);

describe('repo metadata readers', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'repo-metadata-'));
  });

  afterEach(async () => {
    // Best-effort cleanup; a leftover temp dir never fails the suite.
    await rm(root, { recursive: true, force: true }).catch(() => {});
  });

  it('lists file paths bounded by depth and entry count, skipping .git', async () => {
    await mkdir(join(root, '.git'), { recursive: true });
    await writeFile(join(root, '.git', 'HEAD'), 'ref: refs/heads/main');
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'index.ts'), '');
    await writeFile(join(root, 'README.md'), '# hi');

    const tree = await readFileTree(root);
    expect(tree).toContain('README.md');
    expect(tree).toContain(['src', 'index.ts'].join(sep));
    expect(tree.some((p) => p.includes('.git'))).toBe(false);
  });

  it('returns null when no README is present', async () => {
    expect(await readReadme(root)).toBeNull();
  });

  it('returns README contents bounded by byte limit', async () => {
    await writeFile(join(root, 'README.md'), 'x'.repeat(100));
    const readme = await readReadme(root, 10);
    expect(readme).toHaveLength(10);
  });

  it('reads a package.json manifest when present', async () => {
    await writeFile(join(root, 'package.json'), '{"name":"demo"}');
    const manifest = await readManifest(root);
    expect(manifest).toEqual({ filename: 'package.json', contents: '{"name":"demo"}' });
  });

  it('returns null for a manifest when none of the known filenames exist', async () => {
    expect(await readManifest(root)).toBeNull();
  });

  it('returns an empty list of commit subjects for a non-git directory', async () => {
    expect(await readRecentCommitSubjects(root)).toEqual([]);
  });

  it('reads recent commit subjects for a real git repo', async () => {
    await execFileAsync('git', ['init'], { cwd: root });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: root });
    await writeFile(join(root, 'file.txt'), 'a');
    await execFileAsync('git', ['add', '.'], { cwd: root });
    await execFileAsync('git', ['commit', '-m', 'first commit'], { cwd: root });
    const subjects = await readRecentCommitSubjects(root);
    expect(subjects).toEqual(['first commit']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- tests/unit/main/repo-metadata.test.ts`
Expected: FAIL — `apps/desktop/src/main/coordination/repo-metadata.js` does not exist.

- [ ] **Step 3: Implement**

Create `apps/desktop/src/main/coordination/repo-metadata.ts`:

```ts
/**
 * Bounded, fail-soft repo-metadata readers (T-repo-idea-01).
 *
 * Every function here returns an empty/null result on any error — a missing
 * README, a non-git directory, or a permissions failure is provenance, not a
 * crash. Nothing here reads file contents beyond the README and manifest;
 * the file tree carries paths only.
 */

import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_README_BYTES = 8_192;
const DEFAULT_COMMIT_LIMIT = 20;
const GIT_TIMEOUT_MS = 2_000;

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'build', '.venv', '__pycache__']);
const MANIFEST_FILENAMES = ['package.json', 'Cargo.toml', 'pyproject.toml', 'go.mod'];

export async function readFileTree(
  root: string,
  opts: { maxDepth?: number; maxEntries?: number } = {},
): Promise<string[]> {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const paths: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (paths.length >= maxEntries || depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (paths.length >= maxEntries) return;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(join(dir, entry.name), depth + 1);
      } else if (entry.isFile()) {
        paths.push(relative(root, join(dir, entry.name)));
      }
    }
  }

  await walk(root, 0);
  return paths;
}

export async function readReadme(root: string, maxBytes = DEFAULT_README_BYTES): Promise<string | null> {
  for (const filename of ['README.md', 'README', 'readme.md']) {
    try {
      const contents = await readFile(join(root, filename), 'utf8');
      return contents.slice(0, maxBytes);
    } catch {
      continue;
    }
  }
  return null;
}

export async function readManifest(
  root: string,
  maxBytes = DEFAULT_README_BYTES,
): Promise<{ filename: string; contents: string } | null> {
  for (const filename of MANIFEST_FILENAMES) {
    try {
      const path = join(root, filename);
      const info = await stat(path);
      if (!info.isFile()) continue;
      const contents = await readFile(path, 'utf8');
      return { filename, contents: contents.slice(0, maxBytes) };
    } catch {
      continue;
    }
  }
  return null;
}

/** `git log` subjects are provenance, not a dependency — never throws, matches recon.ts's headCommit posture. */
export async function readRecentCommitSubjects(
  root: string,
  limit = DEFAULT_COMMIT_LIMIT,
): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', `-n`, String(limit), '--format=%s'],
      { cwd: root, timeout: GIT_TIMEOUT_MS, windowsHide: true },
    );
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit -- tests/unit/main/repo-metadata.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full verification**

Run: `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:contract`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/main/coordination/repo-metadata.ts tests/unit/main/repo-metadata.test.ts
git commit -m "feat(main): bounded repo-metadata readers (file tree, README, manifest, commit subjects)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LFtCatUbxGukemftYkTJGT"
```

---

## What this plan does not build

- No `missionComposer.proposeRepoIdeas` operation, no composer UI step, no prompt-assembly logic that combines the repo-metadata readers' output into an actual prompt string. That is the next plan (repo-idea-generation feature), which consumes `runStructuredDraft` and the four readers from this plan as building blocks.
- No JSON-schema validation of the *content* of a structured draft's output (e.g. "exactly 3 ideas, each under 200 characters") — that is caller-specific and belongs to whichever feature parses the returned text (this plan's `StructuredDraftOutcome.text` is an unvalidated string; Zod validation of its parsed JSON is the caller's job, matching how `MissionEnvelopeInput.safeParse` works in mission-composer.ts).
- No token/cost accounting, no UI for provider/model selection — those belong to the feature plan that has an actual UI surface to put them in.
