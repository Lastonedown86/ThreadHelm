/**
 * Reviewed hire manifest parsing and profile lifecycle policy. A manifest is
 * untrusted portable data, never an instruction; display name and capability
 * labels are inert presentation data, never identity or authority.
 *
 * Contract: specs/002-agent-mailbox-routing/contracts/agent-profiles.md
 */

import {
  HireManifestV1,
  MAX_GOAL_LENGTH,
  MAX_TOKEN_CAP,
  ProfileProviderId,
  ThreadHelmError,
  type ProfileProviderId as ProfileProviderIdType,
  type ProviderId,
  type ProfileCompatibility,
  type ProfileState,
} from '@threadhelm/contracts';

export { MAX_GOAL_LENGTH, MAX_TOKEN_CAP };

/** Bounded read size for a hire manifest file, independent of any single field. */
export const MAX_MANIFEST_BYTES = 64 * 1024;

// ponytail: minimal top-level-only duplicate-key scanner; the manifest schema
// is a flat object with string/number/boolean/string-array values only, so
// tracking bracket depth plus "string immediately followed by colon" is
// enough to find a duplicated top-level key without a full JSON tokenizer.
function findTopLevelKeys(text: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < n && text[j] !== '"') {
        if (text[j] === '\\') {
          value += text[j] + (text[j + 1] ?? '');
          j += 2;
          continue;
        }
        value += text[j];
        j++;
      }
      i = j + 1;
      if (depth === 1) {
        let k = i;
        while (k < n && /\s/.test(text[k] ?? '')) k++;
        if (text[k] === ':') keys.push(value);
      }
      continue;
    }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    i++;
  }
  return keys;
}

function hasDuplicateTopLevelKey(text: string): boolean {
  const keys = findTopLevelKeys(text);
  return new Set(keys).size !== keys.length;
}

/**
 * Strictly parses, size-bounds, and normalizes a hire manifest read from
 * disk. Throws a stable `ThreadHelmError` for every failure mode; raw parse
 * errors never cross this boundary.
 */
export function parseHireManifest(raw: string): HireManifestV1 {
  if (new TextEncoder().encode(raw).length > MAX_MANIFEST_BYTES) {
    throw new ThreadHelmError('PROFILE_OVERSIZED', 'Hire manifest exceeds the maximum read size.');
  }
  if (hasDuplicateTopLevelKey(raw)) {
    throw new ThreadHelmError(
      'PROFILE_SCHEMA_INVALID',
      'Hire manifest contains a duplicate top-level field.',
    );
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    throw new ThreadHelmError('PROFILE_SCHEMA_INVALID', 'Hire manifest is not valid JSON.');
  }

  if (candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)) {
    for (const field of ['goal', 'description'] as const) {
      const value = (candidate as Record<string, unknown>)[field];
      if (typeof value === 'string' && value.length > MAX_GOAL_LENGTH) {
        throw new ThreadHelmError(
          'PROFILE_OVERSIZED',
          `Hire manifest ${field} exceeds the maximum length.`,
        );
      }
    }
  }

  const result = HireManifestV1.safeParse(candidate);
  if (!result.success) {
    throw new ThreadHelmError('PROFILE_SCHEMA_INVALID', 'Hire manifest failed schema validation.');
  }
  return result.data;
}

export interface EvaluateProfileCompatibilityInput {
  requestedProvider: string;
  requestedModel: string;
  availableProviderModels: Partial<Record<string, readonly string[]>>;
}

export interface ProfileCompatibilityResult {
  compatibility: ProfileCompatibility;
  reasons: string[];
}

const PROFILE_PROVIDER_RUNTIME: Readonly<Record<ProfileProviderIdType, ProviderId>> = {
  claude: 'claude-code',
  codex: 'codex-cli',
  'claude-code': 'claude-code',
  'codex-cli': 'codex-cli',
};

/** Resolve a portable manifest provider label without changing its stored value. */
export function resolveProfileRuntimeProvider(requestedProvider: string): ProviderId | null {
  const parsed = ProfileProviderId.safeParse(requestedProvider);
  return parsed.success ? PROFILE_PROVIDER_RUNTIME[parsed.data] : null;
}

/**
 * Compatibility is always rechecked against current availability, never
 * cached or substituted with an alternative model.
 */
export function evaluateProfileCompatibility(
  input: EvaluateProfileCompatibilityInput,
): ProfileCompatibilityResult {
  const runtimeProvider = resolveProfileRuntimeProvider(input.requestedProvider);
  if (!runtimeProvider) {
    return {
      compatibility: 'incompatible_provider',
      reasons: [`provider ${input.requestedProvider} is not a supported provider`],
    };
  }
  const models = input.availableProviderModels[runtimeProvider];
  if (!models) {
    return {
      compatibility: 'unavailable',
      reasons: [`provider ${input.requestedProvider} is not currently available`],
    };
  }
  if (!models.includes(input.requestedModel)) {
    return {
      compatibility: 'incompatible_model',
      reasons: [
        `model ${input.requestedModel} is not currently available for ${input.requestedProvider}`,
      ],
    };
  }
  return { compatibility: 'compatible', reasons: [] };
}

export interface EffectiveTokenBudgetLimits {
  productLimit: number;
  sessionLimit: number;
  missionEnvelope: number;
}

/** The effective budget can only narrow the manifest's requested cap, never expand it. */
export function computeEffectiveTokenBudget(
  requestedTokenCap: number,
  limits: EffectiveTokenBudgetLimits,
): number {
  return Math.min(
    requestedTokenCap,
    limits.productLimit,
    limits.sessionLimit,
    limits.missionEnvelope,
  );
}

export const PROFILE_STATE_TRANSITIONS: Readonly<Record<ProfileState, readonly ProfileState[]>> = {
  active: ['disabled', 'deleted'],
  disabled: ['active', 'deleted'],
  deleted: [],
};

export function canTransitionProfileState(from: ProfileState, to: ProfileState): boolean {
  return PROFILE_STATE_TRANSITIONS[from].includes(to);
}

export function advanceProfileState(from: ProfileState, to: ProfileState): ProfileState {
  if (from === to) return to;
  if (!canTransitionProfileState(from, to)) {
    throw new ThreadHelmError('INVALID_STATE', `Illegal profile transition ${from} -> ${to}`, {
      from,
      to,
    });
  }
  return to;
}
