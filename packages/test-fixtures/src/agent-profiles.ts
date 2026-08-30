/**
 * T095 (Feature 002, US6) — sanitized `munder-difflin/hire@1` manifest
 * fixtures for the reviewed agent roster. These stand in for the ten
 * user-supplied Marvel-themed manifests from the manual acceptance run
 * (specs/002-agent-mailbox-routing/contracts/agent-profiles.md) without
 * copying any user file into the repository.
 *
 * Display names (persona) are mutable presentation data only; nothing here
 * assigns a role or authority — see the "never assigns authority" tests in
 * tests/unit/domain/agent-profile.test.ts and tests/contract/agent-profiles.test.ts.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const HIRE_MANIFEST_SPEC = 'munder-difflin/hire@1';
export const MAX_HIRE_MANIFEST_TOKEN_CAP = 2_000_000;

export interface HireManifestFixtureFields {
  readonly spec: string;
  readonly name: string;
  readonly description: string;
  readonly provider: string;
  readonly model: string;
  readonly goal: string;
  readonly capabilities: readonly string[];
  readonly isolate: boolean;
  readonly tokenCap: number;
  readonly author: string;
}

export interface HireManifestFixture {
  readonly basename: string;
  readonly fields: HireManifestFixtureFields;
  readonly text: string;
  readonly digest: string;
}

function manifestText(fields: HireManifestFixtureFields): string {
  return JSON.stringify(fields);
}

export function hireManifestDigest(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function fixture(basename: string, fields: HireManifestFixtureFields): HireManifestFixture {
  const text = manifestText(fields);
  return { basename, fields, text, digest: hireManifestDigest(text) };
}

/** Writes a fixture's exact text to disk and returns the file's full path. */
export function writeHireManifestFile(dir: string, basename: string, text: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, basename);
  writeFileSync(path, text, 'utf8');
  return path;
}

const CURATOR = 'Roster Curator';

/** Ten sanitized roster manifests: four Opus, six Sonnet; eight isolated, two not. */
export const MARVEL_ROSTER_FIXTURES: readonly HireManifestFixture[] = [
  fixture('black-panther.hire.json', {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Black Panther',
    description: 'Reviews security-sensitive changes before they reach a session.',
    provider: 'claude-code',
    model: 'claude-opus-5',
    goal: 'Flag security regressions for explicit human review.',
    capabilities: ['security_review'],
    isolate: true,
    tokenCap: 1_000_000,
    author: CURATOR,
  }),
  fixture('captain-america.hire.json', {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Captain America',
    description: 'Reviews whether a proposed change follows team conventions.',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    goal: 'Flag convention drift for explicit human review.',
    capabilities: ['style_review'],
    isolate: true,
    tokenCap: 500_000,
    author: CURATOR,
  }),
  fixture('doctor-strange.hire.json', {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Doctor Strange',
    description: 'Reviews edge cases and time-based logic before they reach a session.',
    provider: 'codex-cli',
    model: 'gpt-5.6-sol',
    goal: 'Flag unhandled edge cases for explicit human review.',
    capabilities: ['edge_case_review'],
    isolate: true,
    tokenCap: 2_000_000,
    author: CURATOR,
  }),
  fixture('maria-hill.hire.json', {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Maria Hill',
    description: 'Reviews operational readiness before a change is presented.',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    goal: 'Flag operational risk for explicit human review.',
    capabilities: ['ops_review'],
    isolate: false,
    tokenCap: 250_000,
    author: CURATOR,
  }),
  fixture('nick-fury.hire.json', {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Nick Fury',
    description: 'Coordinates review priority across the roster.',
    provider: 'claude-code',
    model: 'claude-opus-5',
    goal: 'Surface the highest-priority review items for explicit human triage.',
    capabilities: ['triage'],
    isolate: true,
    tokenCap: 750_000,
    author: CURATOR,
  }),
  fixture('she-hulk.hire.json', {
    spec: HIRE_MANIFEST_SPEC,
    name: 'She-Hulk',
    description: 'Reviews contract and API surface changes.',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    goal: 'Flag breaking API changes for explicit human review.',
    capabilities: ['api_review'],
    isolate: true,
    tokenCap: 500_000,
    author: CURATOR,
  }),
  fixture('shuri.hire.json', {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Shuri',
    description: 'Reviews build and tooling changes.',
    provider: 'codex-cli',
    model: 'gpt-5.6-sol',
    goal: 'Flag tooling regressions for explicit human review.',
    capabilities: ['tooling_review'],
    isolate: true,
    tokenCap: 1_000_000,
    author: CURATOR,
  }),
  fixture('spider-man.hire.json', {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Spider-Man',
    description: 'Reviews small, fast-turnaround changes.',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    goal: 'Flag risky small changes for explicit human review.',
    capabilities: ['quick_review'],
    isolate: false,
    tokenCap: 100_000,
    author: CURATOR,
  }),
  fixture('vision.hire.json', {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Vision',
    description: 'Reviews data consistency and invariants.',
    provider: 'claude-code',
    model: 'claude-opus-5',
    goal: 'Flag invariant violations for explicit human review.',
    capabilities: ['invariant_review'],
    isolate: true,
    tokenCap: 500_000,
    author: CURATOR,
  }),
  fixture('war-machine.hire.json', {
    spec: HIRE_MANIFEST_SPEC,
    name: 'War Machine',
    description: 'Reviews infrastructure and deployment changes.',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    goal: 'Flag infrastructure risk for explicit human review.',
    capabilities: ['infra_review'],
    isolate: true,
    tokenCap: 500_000,
    author: CURATOR,
  }),
];

/** Same content, a different basename: import must dedupe by digest, not filename. */
export const DUPLICATE_HIRE_MANIFEST_FIXTURE: HireManifestFixture = fixture(
  'black-panther-copy.hire.json',
  MARVEL_ROSTER_FIXTURES[0]!.fields,
);

/** Same identity (name + author) as the first roster entry, different content/digest. */
export const REVISED_HIRE_MANIFEST_FIXTURE: HireManifestFixture = fixture(
  'black-panther.hire.json',
  {
    ...MARVEL_ROSTER_FIXTURES[0]!.fields,
    description: 'Revised: also reviews dependency updates for supply-chain risk.',
    capabilities: ['security_review', 'dependency_review'],
  },
);

/** Schema-valid but hostile-looking text; must be stored inertly, never executed. */
export const HOSTILE_TEXT_HIRE_MANIFEST_FIXTURE: HireManifestFixture = fixture(
  'hostile-text.hire.json',
  {
    spec: HIRE_MANIFEST_SPEC,
    name: '<img src=x onerror=alert(1)>',
    description: "'; DROP TABLE agent_profiles;--",
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    goal: '<script>alert(document.cookie)</script>',
    capabilities: ['code_review'],
    isolate: true,
    tokenCap: 100_000,
    author: CURATOR,
  },
);

/** Schema-valid, but the requested model is not in any fixture availability map. */
export const UNAVAILABLE_MODEL_HIRE_MANIFEST_FIXTURE: HireManifestFixture = fixture(
  'unavailable-model.hire.json',
  {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Ultron',
    description: 'Requests a model ThreadHelm does not currently make available.',
    provider: 'claude-code',
    model: 'claude-model-that-does-not-exist',
    goal: 'Exercise the incompatible/unavailable compatibility path.',
    capabilities: ['code_review'],
    isolate: true,
    tokenCap: 100_000,
    author: CURATOR,
  },
);

/** tokenCap exceeds the product ceiling; must fail preview as an unsafe numeric value. */
export const EXCESSIVE_BOUND_HIRE_MANIFEST_FIXTURE: HireManifestFixture = fixture(
  'excessive-bound.hire.json',
  {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Thanos',
    description: 'Requests a token cap above the two-million ceiling.',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    goal: 'Exercise the excessive-bound rejection path.',
    capabilities: ['code_review'],
    isolate: true,
    tokenCap: MAX_HIRE_MANIFEST_TOKEN_CAP + 1,
    author: CURATOR,
  },
);

/** The "before" half of a changed-after-preview scenario; pair with the field below. */
export const CHANGED_AFTER_PREVIEW_ORIGINAL_FIXTURE: HireManifestFixture = fixture(
  'changed-after-preview.hire.json',
  {
    spec: HIRE_MANIFEST_SPEC,
    name: 'Ant-Man',
    description: 'Original content reviewed at preview time.',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    goal: 'This exact text must match what confirmImport re-reads.',
    capabilities: ['code_review'],
    isolate: true,
    tokenCap: 100_000,
    author: CURATOR,
  },
);

/** The "after" half: same basename, edited on disk after preview but before confirm. */
export const CHANGED_AFTER_PREVIEW_EDITED_FIXTURE: HireManifestFixture = fixture(
  'changed-after-preview.hire.json',
  {
    ...CHANGED_AFTER_PREVIEW_ORIGINAL_FIXTURE.fields,
    goal: 'This text was edited after preview, so confirmImport must fail closed.',
  },
);

/** Raw text that must fail strict schema validation for a distinct reason each. */
export const MALFORMED_HIRE_MANIFEST_TEXT_FIXTURES: readonly { reason: string; text: string }[] = [
  {
    reason: 'unknown field (role)',
    text: JSON.stringify({ ...MARVEL_ROSTER_FIXTURES[0]!.fields, role: 'supervisor' }),
  },
  {
    reason: 'duplicate top-level key',
    text: manifestText(MARVEL_ROSTER_FIXTURES[0]!.fields).replace(
      `"spec":"${HIRE_MANIFEST_SPEC}"`,
      `"spec":"${HIRE_MANIFEST_SPEC}","spec":"${HIRE_MANIFEST_SPEC}"`,
    ),
  },
  {
    reason: 'invalid capability label',
    text: JSON.stringify({
      ...MARVEL_ROSTER_FIXTURES[0]!.fields,
      capabilities: ['NOT-a-valid-label!'],
    }),
  },
  {
    reason: 'unsafe tokenCap (negative)',
    text: JSON.stringify({ ...MARVEL_ROSTER_FIXTURES[0]!.fields, tokenCap: -1 }),
  },
  {
    reason: 'unsupported spec literal',
    text: JSON.stringify({ ...MARVEL_ROSTER_FIXTURES[0]!.fields, spec: 'munder-difflin/hire@2' }),
  },
];
