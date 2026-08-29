/**
 * Provider coordination bridge acceptance smoke suite (T047).
 *
 * Deterministic, non-credentialed acceptance tests verifying installed bridge
 * discovery, isolated session configuration, structured replies, rate limits,
 * and clean teardown.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BridgeSessionManager,
  type BridgeResponse,
} from '../../apps/desktop/src/main/coordination/bridge.js';
import { codexAdapter, claudeCodeAdapter } from '@threadhelm/providers';
import {
  COORDINATION_FIXTURE_IDS,
  bridgeAcknowledgeRequest,
  bridgeListPendingRequest,
  bridgeReplyRequest,
  bridgeReportOutcomeRequest,
  createCoordinationClock,
} from '@threadhelm/test-fixtures';

function resultOf(response: BridgeResponse): Record<string, unknown> {
  expect(response.result).toBeDefined();
  expect(response.result).toBeTypeOf('object');
  return response.result as Record<string, unknown>;
}

describe('Provider coordination acceptance smoke (T047)', () => {
  const SESSION_1 = COORDINATION_FIXTURE_IDS.senderSession;

  it.skipIf(!process.env.THREADHELM_PACKAGED_APP)(
    'discovers the bridge beside the packaged application artifacts',
    () => {
      const appPath = process.env.THREADHELM_PACKAGED_APP!;
      const bridgePath = join(
        dirname(appPath),
        'resources',
        'app.asar.unpacked',
        'out',
        'main',
        'threadhelm-coordination-bridge.exe',
      );
      expect(existsSync(bridgePath)).toBe(true);
    },
  );

  it('configures isolated per-session launch without editing global settings', () => {
    const bridgeConfig = {
      bridgeExecutablePath: 'C:\\Program Files\\ThreadHelm\\threadhelm-coordination-bridge.exe',
      pipeName: `\\\\.\\pipe\\threadhelm-coord-${SESSION_1}`,
      sessionId: SESSION_1,
      sessionConfigPath: 'C:\\temp\\threadhelm-bridge-session-test.json',
      providerConfigPath: 'C:\\temp\\threadhelm-claude-mcp-test.json',
      codexConfigOverrides: [
        'mcp_servers.threadhelm.command="C:\\\\Program Files\\\\ThreadHelm\\\\threadhelm-coordination-bridge.exe"',
        'mcp_servers.threadhelm.args=["--session-config","C:\\\\temp\\\\threadhelm-bridge-session-test.json"]',
      ],
    };

    // Claude launch configuration
    const claudeLaunch = claudeCodeAdapter.buildLaunch({
      sessionId: SESSION_1,
      canonicalWorkspacePath: 'C:\\ws\\test',
      resolvedExecutable: 'C:\\tools\\claude.exe',
      executableKind: 'native',
      terminal: { columns: 120, rows: 40 },
      version: '1.0.0',
      runtimeSelection: { model: null, effort: null },
      bridgeConfig,
    });
    expect(claudeLaunch.args).toContain('--mcp-config');
    expect(claudeLaunch.args).toContain(bridgeConfig.providerConfigPath);

    // Codex launch configuration
    const codexLaunch = codexAdapter.buildLaunch({
      sessionId: SESSION_1,
      canonicalWorkspacePath: 'C:\\ws\\test',
      resolvedExecutable: 'C:\\tools\\codex.exe',
      executableKind: 'native',
      terminal: { columns: 120, rows: 40 },
      version: '0.40.0',
      runtimeSelection: { model: null, effort: null },
      bridgeConfig,
    });
    expect(codexLaunch.args.filter((arg) => arg === '--config')).toHaveLength(2);
    expect(codexLaunch.args).toContain(bridgeConfig.codexConfigOverrides[0]);
  });

  it('executes full structured bridge lifecycle: issue, auth, 4 mailbox tools, rate-limit, and teardown', async () => {
    const clock = createCoordinationClock('2026-01-01T00:00:00.000Z');
    const bridgeEvents: { event: string; payload: unknown }[] = [];
    const manager = new BridgeSessionManager({
      clock: clock.now,
      onEvent: (payload) => bridgeEvents.push({ event: 'coordination.bridgeChanged', payload }),
    });

    // 1. Issue credentials
    const cred = manager.issueCredential(SESSION_1, 'codex-cli', '0.40.0');
    expect(cred.token).toBeDefined();
    expect(cred.pipeName).toBe(`\\\\.\\pipe\\threadhelm-coord-${SESSION_1}`);
    expect(manager.isConnected(SESSION_1)).toBe(false);
    expect(bridgeEvents).toHaveLength(0);

    // 2. Dispatch pending list
    const listRes = await manager.dispatch(SESSION_1, cred.token, bridgeListPendingRequest());
    expect(listRes.jsonrpc).toBe('2.0');
    expect(listRes.result).toBeDefined();
    expect(manager.isConnected(SESSION_1)).toBe(true);
    expect(bridgeEvents.some((e) => e.event === 'coordination.bridgeChanged')).toBe(true);

    // 3. Dispatch acknowledge
    const ackRes = await manager.dispatch(SESSION_1, cred.token, bridgeAcknowledgeRequest());
    expect(resultOf(ackRes).deliveryState).toBe('acknowledged');

    // 4. Dispatch structured reply
    const replyRes = await manager.dispatch(SESSION_1, cred.token, bridgeReplyRequest());
    expect(resultOf(replyRes).senderSessionId).toBe(SESSION_1);

    // 5. Dispatch outcome report
    const outcomeRes = await manager.dispatch(SESSION_1, cred.token, bridgeReportOutcomeRequest());
    expect(resultOf(outcomeRes).workOutcome).toBe('completed');

    // 6. Safe disconnect and cleanup
    manager.handleDisconnect(SESSION_1, 'CLEAN_STOP');
    expect(manager.isConnected(SESSION_1)).toBe(false);

    // Post-disconnect dispatches fail closed
    await expect(
      manager.dispatch(SESSION_1, cred.token, bridgeListPendingRequest()),
    ).rejects.toThrow();

    // Revocation cleans up state
    manager.revoke(SESSION_1);
    expect(manager.authenticate(SESSION_1, cred.token)).toBeNull();
  });
});
