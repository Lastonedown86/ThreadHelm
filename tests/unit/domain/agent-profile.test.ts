/**
 * T090 (Feature 002, US6) — failing-first domain tests for reviewed hire
 * manifests. `packages/domain/src/agent-profile.ts` does not exist yet; every
 * import below is expected to fail until T096 implements it.
 *
 * Contract: specs/002-agent-mailbox-routing/contracts/agent-profiles.md
 */

import {
  HireManifestV1,
  ThreadHelmError,
  type ProfileCompatibility,
  type ProfileState,
} from '@threadhelm/contracts';
import {
  advanceProfileState,
  canTransitionProfileState,
  computeEffectiveTokenBudget,
  evaluateProfileCompatibility,
  MAX_GOAL_LENGTH,
  MAX_MANIFEST_BYTES,
  MAX_TOKEN_CAP,
  parseHireManifest,
  PROFILE_STATE_TRANSITIONS,
  resolveProfileRuntimeProvider,
} from '@threadhelm/domain';
import { describe, expect, it } from 'vitest';

function manifestText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    spec: 'munder-difflin/hire@1',
    name: 'Tony Stark',
    description: 'Reviews architecture proposals before they reach a session.',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    goal: 'Flag risky architecture decisions for explicit human review.',
    capabilities: ['code_review'],
    isolate: true,
    tokenCap: 500_000,
    author: 'Roster Curator',
    ...overrides,
  });
}

describe('hire manifest strict schema and normalization', () => {
  it('parses a valid manifest and trims normalized text fields', () => {
    const raw = JSON.stringify({
      spec: 'munder-difflin/hire@1',
      name: '  Tony Stark  ',
      description: '  Reviews architecture proposals.  ',
      provider: 'claude-code',
      model: 'claude-sonnet-5',
      goal: '  Flag risky decisions.  ',
      capabilities: ['code_review'],
      isolate: true,
      tokenCap: 500_000,
      author: '  Roster Curator  ',
    });

    const parsed = parseHireManifest(raw);

    expect(parsed).toEqual({
      spec: 'munder-difflin/hire@1',
      name: 'Tony Stark',
      description: 'Reviews architecture proposals.',
      provider: 'claude-code',
      model: 'claude-sonnet-5',
      goal: 'Flag risky decisions.',
      capabilities: ['code_review'],
      isolate: true,
      tokenCap: 500_000,
      author: 'Roster Curator',
    });
    expect(HireManifestV1.parse(parsed)).toEqual(parsed);
  });

  it('rejects an unknown top-level field', () => {
    expect(() => parseHireManifest(manifestText({ role: 'supervisor' }))).toThrowError(
      expect.objectContaining({ code: 'PROFILE_SCHEMA_INVALID' }),
    );
  });

  it('rejects a duplicate top-level key in the raw manifest text', () => {
    const withDuplicate = manifestText().replace(
      '"spec":"munder-difflin/hire@1"',
      '"spec":"munder-difflin/hire@1","spec":"munder-difflin/hire@1"',
    );
    expect(() => parseHireManifest(withDuplicate)).toThrowError(
      expect.objectContaining({ code: 'PROFILE_SCHEMA_INVALID' }),
    );
  });

  it('rejects a file larger than the 64 KiB read bound', () => {
    const oversizedGoal = 'a'.repeat(MAX_MANIFEST_BYTES);
    expect(() =>
      parseHireManifest(manifestText({ goal: oversizedGoal, description: oversizedGoal })),
    ).toThrowError(expect.objectContaining({ code: 'PROFILE_OVERSIZED' }));
  });

  it('rejects a goal that exceeds the bounded goal length even in a small file', () => {
    const tooLong = 'a'.repeat(MAX_GOAL_LENGTH + 1);
    expect(() => parseHireManifest(manifestText({ goal: tooLong }))).toThrowError(
      expect.objectContaining({ code: 'PROFILE_OVERSIZED' }),
    );
  });

  it('rejects an invalid capability label', () => {
    expect(() =>
      parseHireManifest(manifestText({ capabilities: ['NOT-a-valid-label!'] })),
    ).toThrowError(expect.objectContaining({ code: 'PROFILE_SCHEMA_INVALID' }));
  });

  it.each([-1, 0, 1.5, MAX_TOKEN_CAP + 1, Number.NaN])(
    'rejects an unsafe tokenCap value: %s',
    (tokenCap) => {
      expect(() => parseHireManifest(manifestText({ tokenCap }))).toThrowError(
        expect.objectContaining({ code: 'PROFILE_SCHEMA_INVALID' }),
      );
    },
  );

  it('rejects a provider outside the supported set', () => {
    expect(() =>
      parseHireManifest(manifestText({ provider: 'unsupported-provider' })),
    ).toThrowError(expect.objectContaining({ code: 'PROFILE_SCHEMA_INVALID' }));
  });

  it('rejects an "effort" field: effort is launch policy, never part of the manifest', () => {
    expect(() => parseHireManifest(manifestText({ effort: 'high' }))).toThrowError(
      expect.objectContaining({ code: 'PROFILE_SCHEMA_INVALID' }),
    );
  });
});

describe('persona and capability data never imply authority', () => {
  it('accepts role-shaped capability words as inert routing labels only', () => {
    const parsed = parseHireManifest(
      manifestText({ capabilities: ['supervisor', 'reviewer', 'triage'] }),
    );
    expect(parsed.capabilities).toEqual(['supervisor', 'reviewer', 'triage']);
    expect(parsed).not.toHaveProperty('role');
    expect(parsed).not.toHaveProperty('authority');
  });

  it('never assigns stable identity from the mutable display name', () => {
    const starkParsed = parseHireManifest(manifestText({ name: 'Tony Stark' }));
    const ironManParsed = parseHireManifest(manifestText({ name: 'Iron Man' }));
    expect(starkParsed).not.toHaveProperty('id');
    expect(starkParsed).not.toHaveProperty('profileId');
    expect(ironManParsed).not.toHaveProperty('id');
    expect(ironManParsed).not.toHaveProperty('profileId');
  });
});

describe('compatibility evaluation is rechecked, never substituted', () => {
  it('keeps the portable provider value while resolving its runtime adapter explicitly', () => {
    const parsed = parseHireManifest(manifestText({ provider: 'claude' }));
    expect(parsed.provider).toBe('claude');
    expect(resolveProfileRuntimeProvider(parsed.provider)).toBe('claude-code');
    expect(
      evaluateProfileCompatibility({
        requestedProvider: parsed.provider,
        requestedModel: parsed.model,
        availableProviderModels: { 'claude-code': ['claude-sonnet-5'] },
      }).compatibility,
    ).toBe('compatible');
  });

  it('reports compatible only when both the provider and exact model are currently available', () => {
    const available: Partial<Record<string, readonly string[]>> = {
      'claude-code': ['claude-sonnet-5', 'claude-opus-5'],
    };
    expect(
      evaluateProfileCompatibility({
        requestedProvider: 'claude-code',
        requestedModel: 'claude-sonnet-5',
        availableProviderModels: available,
      }),
    ).toMatchObject({ compatibility: 'compatible' satisfies ProfileCompatibility });
  });

  it('reports incompatible_model without substituting an available alternative', () => {
    const result = evaluateProfileCompatibility({
      requestedProvider: 'claude-code',
      requestedModel: 'claude-opus-5',
      availableProviderModels: { 'claude-code': ['claude-sonnet-5'] },
    });
    expect(result.compatibility).toBe('incompatible_model');
    expect(result).not.toHaveProperty('substitutedModel');
  });

  it('reports unavailable when the requested provider is not currently ready', () => {
    const result = evaluateProfileCompatibility({
      requestedProvider: 'codex-cli',
      requestedModel: 'gpt-5.6-sol',
      availableProviderModels: { 'claude-code': ['claude-sonnet-5'] },
    });
    expect(result.compatibility).toBe('unavailable');
  });

  it('is rechecked from current availability rather than cached', () => {
    const request = {
      requestedProvider: 'claude-code' as const,
      requestedModel: 'claude-sonnet-5',
    };
    expect(
      evaluateProfileCompatibility({ ...request, availableProviderModels: {} }).compatibility,
    ).toBe('unavailable');
    expect(
      evaluateProfileCompatibility({
        ...request,
        availableProviderModels: { 'claude-code': ['claude-sonnet-5'] },
      }).compatibility,
    ).toBe('compatible');
  });
});

describe('effective token/resource budget can only narrow', () => {
  it('takes the minimum of the manifest request, product, session, and mission limits', () => {
    expect(
      computeEffectiveTokenBudget(500_000, {
        productLimit: 2_000_000,
        sessionLimit: 1_000_000,
        missionEnvelope: 300_000,
      }),
    ).toBe(300_000);
  });

  it('never expands the manifest request even when every limit is larger', () => {
    expect(
      computeEffectiveTokenBudget(50_000, {
        productLimit: 2_000_000,
        sessionLimit: 2_000_000,
        missionEnvelope: 2_000_000,
      }),
    ).toBe(50_000);
  });
});

describe('profile lifecycle state machine', () => {
  const EXPECTED = {
    active: ['disabled', 'deleted'],
    disabled: ['active', 'deleted'],
    deleted: [],
  };

  it('matches the documented state transitions exactly', () => {
    expect(PROFILE_STATE_TRANSITIONS).toEqual(EXPECTED);
    for (const from of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
      for (const to of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
        expect(canTransitionProfileState(from, to), `${from} -> ${to}`).toBe(
          (EXPECTED[from] as readonly ProfileState[]).includes(to),
        );
      }
    }
  });

  it('handles a duplicate transition idempotently and rejects an illegal one', () => {
    expect(advanceProfileState('disabled', 'disabled')).toBe('disabled');
    expect(() => advanceProfileState('deleted', 'active')).toThrowError(ThreadHelmError);
  });
});
