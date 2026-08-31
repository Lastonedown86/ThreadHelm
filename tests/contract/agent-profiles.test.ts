/**
 * T092 (Feature 002, US6) — failing-first contract tests for reviewed hire
 * manifests. None of the `@threadhelm/contracts` exports below exist yet
 * (T096/T100); every assertion is expected to fail until then.
 *
 * Contract: specs/002-agent-mailbox-routing/contracts/agent-profiles.md
 */

import {
  AgentProfileDetailView,
  AgentProfileSummaryView,
  ConfirmDeleteProfileRequest,
  ConfirmImportProfileRequest,
  HireManifestV1,
  MAX_TOKEN_CAP,
  operationNames,
  PreviewImportProfileRequest,
  ProfileCompatibility,
  ProfileDeletionDisclosureView,
  ProfileEventEnvelope,
  ProfileId,
  ProfilePreviewView,
  ProfileRevisionId,
  ProfileState,
  SetProfileEnabledRequest,
} from '@threadhelm/contracts';
import { CoordinationDisclosureStore } from '../../apps/desktop/src/main/coordination/disclosures.js';
import { describe, expect, it } from 'vitest';
import { parseHireManifest } from '@threadhelm/domain';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const AT = '2026-08-28T12:00:00.000Z';

const VALID_MANIFEST = {
  spec: 'munder-difflin/hire@1' as const,
  name: 'Tony Stark',
  description: 'Reviews architecture proposals before they reach a session.',
  provider: 'claude-code' as const,
  model: 'claude-sonnet-5',
  goal: 'Flag risky architecture decisions for explicit human review.',
  capabilities: ['code_review'],
  isolate: true,
  tokenCap: 500_000,
  author: 'Roster Curator',
};

describe('profile identifiers are stable UUIDs, never persona names', () => {
  it('accepts UUID identity and rejects a display name in its place', () => {
    expect(ProfileId.parse(ID_A)).toBe(ID_A);
    expect(ProfileRevisionId.parse(ID_A)).toBe(ID_A);
    expect(() => ProfileId.parse('Tony Stark')).toThrow();
  });

  it('keeps profile state and compatibility vocabularies closed', () => {
    expect(ProfileState.options).toEqual(['active', 'disabled', 'deleted']);
    expect(ProfileCompatibility.options).toEqual([
      'compatible',
      'incompatible_provider',
      'incompatible_model',
      'unavailable',
    ]);
  });
});

describe('hire manifest strict schema (unknown fields never grant authority)', () => {
  it('rejects credentials even when shaped like valid model or capability identifiers', () => {
    for (const value of ['sk-ant-syntheticexample', 'ghp_syntheticexample']) {
      expect(HireManifestV1.safeParse({ ...VALID_MANIFEST, model: value }).success).toBe(false);
      expect(HireManifestV1.safeParse({ ...VALID_MANIFEST, capabilities: [value] }).success).toBe(
        false,
      );
    }
  });
  it('rejects escaped duplicate JSON keys rather than accepting a hidden replacement', () => {
    const raw = JSON.stringify(VALID_MANIFEST);
    for (const replacement of ['"\\u0067oal":"hidden"', '"\\u006eame":"hidden"']) {
      expect(() => parseHireManifest(raw.slice(0, -1) + ',' + replacement + '}')).toThrow();
    }
  });

  it('rejects malformed Unicode, terminal controls, and credential-shaped content in every free-text field', () => {
    const unsafe = [
      '\ud800',
      '\udfff',
      '\u001b]52;c;clipboard\u0007',
      '\u009b31m',
      'sk-ant-' + 'synthetic'.repeat(3),
      'Bearer ' + 'synthetic'.repeat(3),
      '-----BEGIN PRIVATE KEY-----',
      '-----BEGIN RSA PRIVATE KEY-----',
      'api_key: syntheticexample',
    ];
    for (const field of ['name', 'description', 'goal', 'author']) {
      for (const value of unsafe) {
        expect(
          HireManifestV1.safeParse({ ...VALID_MANIFEST, [field]: value }).success,
          `${field}: ${JSON.stringify(value)}`,
        ).toBe(false);
      }
    }
    expect(
      HireManifestV1.parse({ ...VALID_MANIFEST, goal: 'Review 😀\nThen report.\tNo execution.' })
        .goal,
    ).toBe('Review 😀\nThen report.\tNo execution.');
  });

  it('accepts the exact supported field set', () => {
    expect(HireManifestV1.parse(VALID_MANIFEST)).toEqual(VALID_MANIFEST);
  });

  it('rejects an unknown field, including a role-shaped one', () => {
    expect(() => HireManifestV1.parse({ ...VALID_MANIFEST, role: 'supervisor' })).toThrow();
    expect(() => HireManifestV1.parse({ ...VALID_MANIFEST, effort: 'high' })).toThrow();
  });

  it('stores hostile-looking goal text inertly without throwing or executing it', () => {
    const hostile = '<script>alert(1)</script>; DROP TABLE agent_profiles;--';
    expect(HireManifestV1.parse({ ...VALID_MANIFEST, goal: hostile }).goal).toBe(hostile);
  });

  it('bounds tokenCap at the two-million ceiling (token-budget contract)', () => {
    expect(MAX_TOKEN_CAP).toBe(2_000_000);
    expect(HireManifestV1.parse({ ...VALID_MANIFEST, tokenCap: MAX_TOKEN_CAP }).tokenCap).toBe(
      MAX_TOKEN_CAP,
    );
    expect(() =>
      HireManifestV1.parse({ ...VALID_MANIFEST, tokenCap: MAX_TOKEN_CAP + 1 }),
    ).toThrow();
  });

  it('requires isolate to be an exact boolean, not a truthy string (isolation contract)', () => {
    expect(HireManifestV1.parse({ ...VALID_MANIFEST, isolate: false }).isolate).toBe(false);
    expect(() => HireManifestV1.parse({ ...VALID_MANIFEST, isolate: 'true' })).toThrow();
  });
});

describe('summary and detail views separate presentation from authority', () => {
  const summary = {
    profileId: ID_A,
    currentRevisionId: ID_B,
    displayName: 'Tony Stark',
    description: VALID_MANIFEST.description,
    requestedProvider: 'claude-code' as const,
    requestedModel: 'claude-sonnet-5',
    compatibility: 'compatible' as const,
    state: 'active' as const,
    capabilities: ['code_review'],
    isolateRequested: true,
    tokenCapRequested: 500_000,
    author: 'Roster Curator',
    digestPrefix: 'a'.repeat(12),
    createdAt: AT,
    updatedAt: AT,
  };

  it('omits goal text from the summary view', () => {
    expect(AgentProfileSummaryView.parse(summary)).toEqual(summary);
    expect(() =>
      AgentProfileSummaryView.parse({ ...summary, goal: VALID_MANIFEST.goal }),
    ).toThrow();
  });

  it('exposes the exact reviewed goal only in the detail view', () => {
    const detail = {
      ...summary,
      goal: VALID_MANIFEST.goal,
      digest: 'a'.repeat(64),
      manifestSpec: 'munder-difflin/hire@1' as const,
      compatibilityReasons: [] as string[],
      revisionHistory: [{ revisionId: ID_B, digest: 'a'.repeat(64), createdAt: AT }],
    };
    expect(AgentProfileDetailView.parse(detail)).toEqual(detail);
  });
});

describe('preview/confirm import never accepts arbitrary provider input', () => {
  it('accepts only a renderer file-selection handle', () => {
    expect(PreviewImportProfileRequest.parse({ fileHandle: 'picker-handle-1' })).toEqual({
      fileHandle: 'picker-handle-1',
    });
    expect(() =>
      PreviewImportProfileRequest.parse({ fileHandle: 'picker-handle-1', rawContent: '{}' }),
    ).toThrow();
    expect(() =>
      PreviewImportProfileRequest.parse({ sourcePath: 'C:\\Users\\bill\\Downloads\\x.json' }),
    ).toThrow();
  });

  it('returns only the basename, digest, and normalized fields in preview — never the source path', () => {
    const preview = {
      previewToken: 'p'.repeat(24),
      digest: 'a'.repeat(64),
      basename: 'tony-stark.hire.json',
      normalized: VALID_MANIFEST,
      warnings: [] as string[],
      compatibility: 'compatible' as const,
      compatibilityReasons: [] as string[],
      expiresAt: AT,
    };
    expect(ProfilePreviewView.parse(preview)).toEqual(preview);
    expect(() =>
      ProfilePreviewView.parse({ ...preview, sourcePath: 'C:\\Users\\bill\\Downloads\\x.json' }),
    ).toThrow();
  });

  it('requires an explicit, literal import confirmation', () => {
    expect(
      ConfirmImportProfileRequest.parse({
        previewToken: 'p'.repeat(24),
        importConfirmation: true,
      }),
    ).toEqual({ previewToken: 'p'.repeat(24), importConfirmation: true });
    expect(() =>
      ConfirmImportProfileRequest.parse({
        previewToken: 'p'.repeat(24),
        importConfirmation: false,
      }),
    ).toThrow();
  });

  it('fails closed when the file changes digest after preview (one-use, fingerprinted token)', () => {
    const store = new CoordinationDisclosureStore<{ digest: string; basename: string }>(() =>
      Date.parse(AT),
    );
    const snapshot = { digest: 'a'.repeat(64), basename: 'tony-stark.hire.json' };
    const issued = store.issue('profiles.confirmImport', snapshot);

    expect(
      store.take(issued.token, 'profiles.confirmImport', { ...snapshot, digest: 'b'.repeat(64) }),
    ).toBeNull();
    expect(store.take(issued.token, 'profiles.confirmImport', snapshot)).toBeNull();

    const confirmed = store.issue('profiles.confirmImport', snapshot);
    expect(store.take(confirmed.token, 'profiles.confirmImport', snapshot)).toEqual(snapshot);
    expect(store.take(confirmed.token, 'profiles.confirmImport', snapshot)).toBeNull();
  });
});

describe('enable/disable and delete require exact revision and explicit confirmation', () => {
  it('pins enable/disable to one exact reviewed revision', () => {
    expect(
      SetProfileEnabledRequest.parse({ profileId: ID_A, revisionId: ID_B, enabled: false }),
    ).toEqual({ profileId: ID_A, revisionId: ID_B, enabled: false });
    expect(() => SetProfileEnabledRequest.parse({ profileId: ID_A, enabled: false })).toThrow();
  });

  it('discloses deletion content-free and requires literal confirmation', () => {
    const disclosure = {
      deleteToken: 'd'.repeat(24),
      profileId: ID_A,
      displayName: 'Tony Stark',
      expiresAt: AT,
    };
    expect(ProfileDeletionDisclosureView.parse(disclosure)).toEqual(disclosure);
    expect(() =>
      ProfileDeletionDisclosureView.parse({ ...disclosure, goal: VALID_MANIFEST.goal }),
    ).toThrow();
    expect(() =>
      ConfirmDeleteProfileRequest.parse({ deleteToken: 'd'.repeat(24), deleteConfirmation: false }),
    ).toThrow();
  });
});

describe('profile events are content-free and never expose a launch/role operation', () => {
  it('accepts an event with only ids, state, compatibility, digest prefix, and timestamps', () => {
    const event = {
      type: 'profiles.changed' as const,
      eventId: ID_A,
      profileId: ID_A,
      revisionId: ID_B,
      state: 'active' as const,
      compatibility: 'compatible' as const,
      digestPrefix: 'a'.repeat(12),
      kind: 'imported' as const,
      occurredAt: AT,
    };
    expect(ProfileEventEnvelope.parse(event)).toEqual(event);
    for (const extra of [
      { goal: VALID_MANIFEST.goal },
      { description: VALID_MANIFEST.description },
      { sourcePath: 'C:\\Users\\bill\\Downloads\\x.json' },
    ]) {
      expect(() => ProfileEventEnvelope.parse({ ...event, ...extra })).toThrow();
    }
  });

  it('registers only the named review/roster operations and never a launch or role-grant operation', () => {
    for (const name of [
      'profiles.chooseFile',
      'profiles.previewImport',
      'profiles.confirmImport',
      'profiles.list',
      'profiles.get',
      'profiles.setEnabled',
      'profiles.previewDelete',
      'profiles.confirmDelete',
    ]) {
      expect(operationNames, name).toContain(name);
    }
    expect(operationNames).not.toContain('profiles.launch');
    expect(operationNames).not.toContain('profiles.assignRole');
    expect(operationNames).not.toContain('profiles.setRole');
  });
});
