import { describe, expect, it } from 'vitest';
import { resolveLaunchPermission } from '../../../apps/desktop/src/main/sessions/launch-policy.js';
import { claudeCodeAdapter } from '@threadhelm/providers';

describe('Windows provider permission policy boundary', () => {
  it('never adds bypass while auto capability is absent', () => {
    const resolution = resolveLaunchPermission({
      providerId: 'claude-code',
      providerVersion: '2.1.251',
      model: 'claude-sonnet-5',
      invocation: 'supervisor',
      oneRunSelection: null,
      taskPolicy: 'auto',
      projectPolicy: null,
      providerDefault: 'manual',
      capabilityEvidence: null,
      breakGlassProof: null,
      now: '2026-08-30T12:00:00.000Z',
    });
    expect(resolution.disposition).toBe('held');
    expect(JSON.stringify(resolution)).not.toContain('bypass');
  });

  it('maps an exact ready auto resolution only into the child process argv', () => {
    const resolution = resolveLaunchPermission({
      providerId: 'claude-code',
      providerVersion: '2.1.251',
      model: 'claude-sonnet-5',
      invocation: 'direct',
      oneRunSelection: { policy: 'auto', boundedAllowlist: [] },
      taskPolicy: null,
      projectPolicy: null,
      providerDefault: 'manual',
      capabilityEvidence: {
        providerId: 'claude-code',
        providerVersion: '2.1.251',
        model: 'claude-sonnet-5',
        providerSurface: 'claude-code',
        organizationPolicy: 'allowed',
        supportedPolicies: ['manual', 'auto'],
        observedAt: '2026-08-30T11:59:00.000Z',
        expiresAt: '2026-08-30T12:04:00.000Z',
      },
      breakGlassProof: null,
      now: '2026-08-30T12:00:00.000Z',
    });
    const descriptor = claudeCodeAdapter.buildLaunch({
      sessionId: 'session-a',
      canonicalWorkspacePath: 'C:\\disposable\\task-a',
      resolvedExecutable: 'C:\\tools\\claude.exe',
      executableKind: 'native',
      terminal: { columns: 100, rows: 30 },
      version: '2.1.251',
      runtimeSelection: { model: 'claude-sonnet-5', effort: 'medium' },
      permissionResolution: resolution,
    });
    expect(descriptor.args).toContain('auto');
    expect(descriptor.args).not.toContain('bypassPermissions');
    expect(descriptor.cwd).toBe('C:\\disposable\\task-a');
  });
});
