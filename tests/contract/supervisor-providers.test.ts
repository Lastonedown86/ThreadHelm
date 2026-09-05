import { describe, expect, it } from 'vitest';
import {
  claudeCodeAdapter,
  codexAdapter,
  sessionRoleCapability,
  type LaunchContext,
} from '@threadhelm/providers';
import { resolveLaunchPermission } from '../../apps/desktop/src/main/sessions/launch-policy.js';

const id = '00000000-0000-4000-8000-000000000001';
const now = new Date();
const evidence = {
  providerId: 'claude-code' as const,
  providerVersion: '2.1.251',
  model: 'claude-sonnet-5',
  providerSurface: 'claude-code',
  organizationPolicy: 'allowed' as const,
  supportedPolicies: ['manual', 'auto'] as const,
  observedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 60_000).toISOString(),
};
function launchContext(): LaunchContext {
  const permission = resolveLaunchPermission({
    providerId: 'claude-code',
    providerVersion: '2.1.251',
    model: 'claude-sonnet-5',
    invocation: 'supervisor',
    oneRunSelection: { policy: 'auto', boundedAllowlist: [] },
    taskPolicy: null,
    projectPolicy: null,
    providerDefault: 'manual',
    capabilityEvidence: { ...evidence, supportedPolicies: [...evidence.supportedPolicies] },
    breakGlassProof: null,
    now: now.toISOString(),
  });
  return {
    sessionId: id,
    canonicalWorkspacePath: 'C:\\disposable\\worker',
    resolvedExecutable: 'C:\\tools\\claude.exe',
    executableKind: 'native',
    terminal: { columns: 100, rows: 30 },
    version: '2.1.251',
    runtimeSelection: { model: 'claude-sonnet-5', effort: 'high' },
    permissionResolution: permission,
    executionBounds: {
      maxElapsedMs: 60_000,
      maxTurns: 4,
      maxNoProgressMs: 30_000,
      maxOutputBytes: 1024,
      maxConcurrentProcesses: 8,
    },
    bridgeConfig: {
      sessionId: id,
      bridgeExecutablePath: 'C:\\ThreadHelm\\bridge.exe',
      pipeName: '\\\\.\\pipe\\fixture',
      sessionConfigPath: 'C:\\tmp\\session.json',
      providerConfigPath: 'C:\\tmp\\mcp.json',
      roleCapability: sessionRoleCapability(id, 'worker'),
    },
    profileBinding: {
      profileId: id,
      profileRevisionId: id,
      workspaceId: id,
      requestedIsolation: false,
      effectiveIsolation: false,
      requestedTokenCap: 1000,
      effectiveTokenBudget: 1000,
      effectiveResourceBudget: { maxElapsedMs: 60_000, maxConcurrentProcesses: 8 },
      toolRegistry: ['threadhelm_work_result'],
    },
  };
}
describe('per-session supervisor role and runtime configuration', () => {
  it('generates closed main-owned registries without profile/persona input', () => {
    expect(sessionRoleCapability(id, 'supervisor').tools).toContain('threadhelm_work_assign');
    expect(sessionRoleCapability(id, 'supervisor').tools).not.toContain('threadhelm_work_result');
    for (const role of ['worker', 'reviewer', 'triage'] as const)
      expect(sessionRoleCapability(id, role).tools).toEqual(['threadhelm_work_result']);
    expect(() => sessionRoleCapability(id, 'owner' as 'worker')).toThrow();
    expect(codexAdapter.capabilities.supervisorTools).toBe('bound_supervisor');
    expect(claudeCodeAdapter.capabilities.supervisorTools).toBe('bound_supervisor');
  });
  it('maps a proved exact Claude auto worker only into child argv and never serializes role or permission context', () => {
    const ctx = launchContext();
    const descriptor = claudeCodeAdapter.buildLaunch(ctx);
    expect(descriptor.args).toContain('--permission-mode');
    expect(descriptor.args).toContain('auto');
    expect(descriptor.args).not.toContain('bypassPermissions');
    expect(JSON.stringify(descriptor)).not.toMatch(
      /roleCapability|profileRevisionId|toolRegistry|organizationPolicy/,
    );
    expect(claudeCodeAdapter.buildLaunchDisclosure(ctx)?.toolRegistry).toEqual([
      'threadhelm_work_result',
    ]);
  });
  it('rejects role, registry, session, bounds, and bypass substitution before descriptor creation', () => {
    for (const alter of [
      (ctx: LaunchContext) => {
        ctx.bridgeConfig!.roleCapability!.tools = ['threadhelm_work_assign'];
      },
      (ctx: LaunchContext) => {
        ctx.bridgeConfig!.sessionId = '00000000-0000-4000-8000-000000000002';
      },
      (ctx: LaunchContext) => {
        ctx.profileBinding!.effectiveResourceBudget.maxElapsedMs = 120_000;
      },
      (ctx: LaunchContext) => {
        ctx.permissionResolution = {
          ...ctx.permissionResolution!,
          policy: 'break_glass_bypass',
          providerMapping: 'claude_bypass',
        };
      },
      (ctx: LaunchContext) => {
        ctx.permissionResolution = { ...ctx.permissionResolution!, disposition: 'held' };
      },
    ]) {
      const ctx = launchContext();
      alter(ctx);
      expect(() => claudeCodeAdapter.buildLaunch(ctx)).toThrow();
    }
  });
  it('keeps installed Claude auto held when only version/authentication evidence is available', () => {
    const capability = claudeCodeAdapter.permissionCapabilityEvidence!({
      providerVersion: '2.1.251',
      model: 'claude-sonnet-5',
      observedAt: now.toISOString(),
    });
    expect(capability?.organizationPolicy).toBe('unknown');
    const held = resolveLaunchPermission({
      providerId: 'claude-code',
      providerVersion: '2.1.251',
      model: 'claude-sonnet-5',
      invocation: 'supervisor',
      oneRunSelection: { policy: 'auto', boundedAllowlist: [] },
      taskPolicy: null,
      projectPolicy: null,
      providerDefault: 'manual',
      capabilityEvidence: capability,
      breakGlassProof: null,
      now: now.toISOString(),
    });
    expect(held.disposition).toBe('held');
    expect(held.providerMapping).toBeNull();
  });
  it('emits capability evidence only for allowlisted verified Claude versions', () => {
    const at = now.toISOString();
    const model = 'claude-sonnet-5';
    for (const providerVersion of ['2.1.251', '2.1.260']) {
      const capability = claudeCodeAdapter.permissionCapabilityEvidence!({
        providerVersion,
        model,
        observedAt: at,
      });
      expect(capability?.providerVersion).toBe(providerVersion);
      expect(capability?.organizationPolicy).toBe('unknown');
      expect(capability?.supportedPolicies).toEqual(['manual', 'bounded_allowlist']);
    }
    for (const providerVersion of ['2.1.261', '2.0.0', 'garbage']) {
      expect(
        claudeCodeAdapter.permissionCapabilityEvidence!({ providerVersion, model, observedAt: at }),
      ).toBeNull();
    }
  });
});
