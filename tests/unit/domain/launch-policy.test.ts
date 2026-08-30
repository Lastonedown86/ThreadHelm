import { describe, expect, it } from 'vitest';
import { ThreadHelmError, type PermissionCapabilityEvidence } from '@threadhelm/contracts';
import {
  DEFAULT_PROVIDER_EXECUTION_BOUNDS,
  cancellationForProgress,
  resolveLaunchPermission,
} from '../../../apps/desktop/src/main/sessions/launch-policy.js';

const NOW = '2026-08-30T12:00:00.000Z';

const autoEvidence: PermissionCapabilityEvidence = {
  providerId: 'claude-code' as const,
  providerVersion: '2.1.251',
  model: 'claude-sonnet-5',
  providerSurface: 'claude-code',
  organizationPolicy: 'allowed' as const,
  supportedPolicies: ['manual', 'auto', 'bounded_allowlist'],
  observedAt: '2026-08-30T11:59:00.000Z',
  expiresAt: '2026-08-30T12:04:00.000Z',
};

const base = {
  providerId: 'claude-code' as const,
  providerVersion: '2.1.251',
  model: 'claude-sonnet-5',
  invocation: 'supervisor' as const,
  oneRunSelection: null,
  taskPolicy: null,
  projectPolicy: null,
  providerDefault: 'manual' as const,
  capabilityEvidence: autoEvidence,
  breakGlassProof: null,
  now: NOW,
};

describe('main-owned runtime permission resolution', () => {
  it('resolves one-run over task, project, and provider policy and discloses its source', () => {
    const resolution = resolveLaunchPermission({
      ...base,
      invocation: 'direct',
      oneRunSelection: { policy: 'manual', boundedAllowlist: [] },
      taskPolicy: 'auto',
      projectPolicy: 'bounded_allowlist',
    });
    expect(resolution).toMatchObject({
      policy: 'manual',
      source: 'one_run',
      disposition: 'ready',
      providerMapping: 'claude_manual',
    });
  });

  it('does not treat persona, profile, template, or supervisor names as permission authority', () => {
    const input: Parameters<typeof resolveLaunchPermission>[0] & Record<string, unknown> = {
      ...base,
      taskPolicy: 'auto' as const,
      personaPermission: 'break_glass_bypass',
      profilePermission: 'break_glass_bypass',
      templatePermission: 'break_glass_bypass',
      supervisorName: 'Tony Stark',
    };
    expect(resolveLaunchPermission(input)).toMatchObject({
      policy: 'auto',
      source: 'task_policy',
      disposition: 'ready',
    });
  });

  it('holds unavailable Claude auto with only manual or bounded-allowlist next actions', () => {
    const resolution = resolveLaunchPermission({
      ...base,
      taskPolicy: 'auto',
      capabilityEvidence: null,
    });
    expect(resolution).toMatchObject({
      policy: 'auto',
      disposition: 'held',
      providerMapping: null,
      reasonCode: 'PERMISSION_AUTO_UNAVAILABLE',
      fallbackActions: ['manual', 'bounded_allowlist'],
    });
    expect(JSON.stringify(resolution)).not.toContain('bypassPermissions');
    expect(JSON.stringify(resolution)).not.toContain('break_glass_bypass');
  });

  it('rejects bypass from every persisted policy source', () => {
    expect(() =>
      resolveLaunchPermission({
        ...base,
        taskPolicy: 'break_glass_bypass',
      }),
    ).toThrowError(ThreadHelmError);
  });

  it('requires a direct one-run selection and every isolation/cleanup proof for bypass', () => {
    const selection = { policy: 'break_glass_bypass' as const, boundedAllowlist: [] };
    const incompleteProof = {
      isolationKind: 'container' as const,
      freshRuntime: true,
      childProcessContainment: true,
      disposableWorkspaceOnlyWrites: true,
      unrelatedCredentialsExcluded: true,
      unrelatedEnvironmentExcluded: true,
      networkDestinations: ['api.anthropic.com'],
      processCleanupVerified: true,
      workspaceCleanupVerified: true,
      configCleanupVerified: false,
    };
    expect(
      resolveLaunchPermission({
        ...base,
        invocation: 'direct',
        oneRunSelection: selection,
        capabilityEvidence: {
          ...autoEvidence,
          supportedPolicies: ['manual', 'break_glass_bypass'],
        },
        breakGlassProof: incompleteProof,
      }),
    ).toMatchObject({ disposition: 'held', reasonCode: 'BREAK_GLASS_ISOLATION_UNPROVED' });

    expect(
      resolveLaunchPermission({
        ...base,
        invocation: 'direct',
        oneRunSelection: selection,
        capabilityEvidence: {
          ...autoEvidence,
          supportedPolicies: ['manual', 'break_glass_bypass'],
        },
        breakGlassProof: { ...incompleteProof, configCleanupVerified: true },
      }),
    ).toMatchObject({
      policy: 'break_glass_bypass',
      source: 'one_run',
      disposition: 'ready',
      providerMapping: 'claude_bypass',
    });
  });

  it('defines independent elapsed, turn, no-progress, and resource ceilings', () => {
    expect(DEFAULT_PROVIDER_EXECUTION_BOUNDS).toEqual({
      maxElapsedMs: 30 * 60_000,
      maxTurns: 64,
      maxNoProgressMs: 5 * 60_000,
      maxOutputBytes: 8 * 1024 * 1024,
      maxConcurrentProcesses: 1,
    });
  });

  it('turns structured bound evidence into a cancellation request', () => {
    expect(
      cancellationForProgress({
        progress: {
          attemptId: '11111111-1111-4111-8111-111111111111',
          sessionId: '22222222-2222-4222-8222-222222222222',
          kind: 'heartbeat',
          turnCount: 2,
          elapsedMs: DEFAULT_PROVIDER_EXECUTION_BOUNDS.maxElapsedMs,
          outputBytes: 1_024,
          activeProcessCount: 1,
          observedAt: NOW,
        },
        bounds: DEFAULT_PROVIDER_EXECUTION_BOUNDS,
        lastMeaningfulProgressAt: '2026-08-30T11:59:00.000Z',
      }),
    ).toMatchObject({ reason: 'elapsed_bound' });
  });
});
