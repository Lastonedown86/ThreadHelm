import { describe, expect, it } from 'vitest';
import { claudeCodeAdapter } from '@threadhelm/providers';
import { resolveLaunchPermission } from '../../../apps/desktop/src/main/sessions/launch-policy.js';

const NOW = '2026-09-04T12:00:00.000Z';

function evidence(providerVersion: string) {
  return claudeCodeAdapter.permissionCapabilityEvidence!({
    providerVersion,
    model: 'claude-sonnet-5',
    observedAt: NOW,
  });
}

describe('Claude Code verified capability versions', () => {
  it.each(['2.1.251', '2.1.260'])('returns evidence for verified version %s', (version) => {
    expect(evidence(version)).toMatchObject({
      providerId: 'claude-code',
      providerVersion: version,
      organizationPolicy: 'unknown',
      supportedPolicies: ['manual', 'bounded_allowlist'],
    });
  });

  it.each(['2.1.261', '2.0.0', '2.1.2600', '', 'garbage', '2.1.260-beta'])(
    'returns no evidence for unverified version %j',
    (version) => {
      expect(evidence(version)).toBeNull();
    },
  );

  it('keeps 2.1.260 auto held because organizationPolicy is unknown', () => {
    const resolution = resolveLaunchPermission({
      providerId: 'claude-code',
      providerVersion: '2.1.260',
      model: 'claude-sonnet-5',
      invocation: 'supervisor',
      oneRunSelection: { policy: 'auto', boundedAllowlist: [] },
      taskPolicy: null,
      projectPolicy: null,
      providerDefault: 'manual',
      capabilityEvidence: evidence('2.1.260'),
      breakGlassProof: null,
      now: NOW,
    });
    expect(resolution).toMatchObject({
      disposition: 'held',
      providerMapping: null,
      reasonCode: 'PERMISSION_AUTO_UNAVAILABLE',
    });
  });

  it('resolves a bounded allowlist on 2.1.260 and holds it on an unverified version', () => {
    const input = (providerVersion: string) => ({
      providerId: 'claude-code' as const,
      providerVersion,
      model: 'claude-sonnet-5',
      invocation: 'supervisor' as const,
      oneRunSelection: { policy: 'bounded_allowlist' as const, boundedAllowlist: ['Read'] },
      taskPolicy: null,
      projectPolicy: null,
      providerDefault: 'manual' as const,
      capabilityEvidence: evidence(providerVersion),
      breakGlassProof: null,
      now: NOW,
    });
    expect(resolveLaunchPermission(input('2.1.260'))).toMatchObject({
      disposition: 'ready',
      providerMapping: 'claude_bounded_allowlist',
    });
    expect(resolveLaunchPermission(input('2.1.261'))).toMatchObject({
      disposition: 'held',
      reasonCode: 'PERMISSION_ALLOWLIST_UNAVAILABLE',
    });
  });
});
