import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COORDINATION_FIXTURE_IDS,
  bridgeAcknowledgeRequest,
  bridgeListPendingRequest,
  bridgeReplyRequest,
  bridgeReportOutcomeRequest,
  createCoordinationClock,
} from '@threadhelm/test-fixtures';
import {
  BridgeSessionManager,
  type BridgeRequest,
  type BridgeResponse,
} from '../../apps/desktop/src/main/coordination/bridge.js';

function resultOf(response: BridgeResponse): Record<string, unknown> {
  expect(response.result).toBeDefined();
  expect(response.result).toBeTypeOf('object');
  return response.result as Record<string, unknown>;
}

function requestOverPipe(pipeName: string, envelope: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(pipeName);
    let response = '';
    socket.setEncoding('utf8');
    socket.once('error', reject);
    socket.on('data', (chunk: string) => {
      response += chunk;
      const newline = response.indexOf('\n');
      if (newline < 0) return;
      socket.end();
      resolve(JSON.parse(response.slice(0, newline)) as Record<string, unknown>);
    });
    socket.once('connect', () => socket.write(`${JSON.stringify(envelope)}\n`));
  });
}

describe('Provider coordination bridge contract (T033)', () => {
  const SESSION_A = COORDINATION_FIXTURE_IDS.senderSession;
  const SESSION_B = COORDINATION_FIXTURE_IDS.recipientSession;
  const HANDOFF_1 = COORDINATION_FIXTURE_IDS.handoff;

  it('creates one private session configuration and serves authenticated MCP over its named pipe', async () => {
    const root = mkdtempSync(join(tmpdir(), 'threadhelm-bridge-'));
    const bridgeExecutablePath = join(root, 'threadhelm-coordination-bridge.exe');
    writeFileSync(bridgeExecutablePath, 'fixture');
    const manager = new BridgeSessionManager({
      configRoot: root,
      bridgeExecutablePath,
    });
    try {
      const config = await manager.prepareSession(SESSION_B, 'claude-code', '2.0.0');
      const secretConfig = JSON.parse(readFileSync(config.sessionConfigPath, 'utf8')) as {
        credential: string;
      };
      const providerConfig = readFileSync(config.providerConfigPath!, 'utf8');
      expect(providerConfig).not.toContain(secretConfig.credential);

      const response = await requestOverPipe(config.pipeName, {
        sessionId: SESSION_B,
        credential: secretConfig.credential,
        payload: {
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: { name: 'threadhelm_list_pending', arguments: { limit: 2 } },
        },
      });
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(7);
      expect(response.result).toMatchObject({ isError: false });

      manager.revoke(SESSION_B);
      expect(() => readFileSync(config.sessionConfigPath, 'utf8')).toThrow();
    } finally {
      manager.revoke(SESSION_B);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('authenticates session credential and rejects invalid or expired tokens', async () => {
    const manager = new BridgeSessionManager();
    const issued = manager.issueCredential(SESSION_A, 'codex-cli', '1.0.0');
    expect(issued.token).toBeDefined();
    expect(issued.sessionId).toBe(SESSION_A);

    // Valid credential resolves session
    const authenticated = manager.authenticate(issued.sessionId, issued.token);
    expect(authenticated).not.toBeNull();
    expect(authenticated?.sessionId).toBe(SESSION_A);

    // Invalid token fails
    expect(manager.authenticate(SESSION_A, 'wrong-token')).toBeNull();

    // Expired / revoked token fails
    manager.revoke(SESSION_A);
    expect(manager.authenticate(SESSION_A, issued.token)).toBeNull();
  });

  it('enforces JSON-RPC 2.0 schema and frame size limit of 32 KiB', async () => {
    const manager = new BridgeSessionManager();
    const cred = manager.issueCredential(SESSION_B, 'claude-code', '2.0.0');

    // Valid JSON-RPC frame
    const valid = bridgeListPendingRequest();
    const res = await manager.dispatch(SESSION_B, cred.token, valid);
    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(valid.id);

    // Oversized payload (> 32 KiB) rejected
    const oversized = {
      jsonrpc: '2.0',
      id: 2,
      method: 'threadhelm_reply',
      params: {
        inReplyTo: HANDOFF_1,
        kind: 'response',
        purpose: 'Too large',
        body: 'x'.repeat(33 * 1024),
        responseExpectation: 'none',
        authorityRequired: false,
      },
    };
    await expect(
      manager.dispatch(SESSION_B, cred.token, oversized as BridgeRequest),
    ).rejects.toThrow();

    // Unknown method rejected
    const unknownMethod = {
      jsonrpc: '2.0',
      id: 3,
      method: 'threadhelm_unknown_tool',
      params: {},
    };
    await expect(
      manager.dispatch(SESSION_B, cred.token, unknownMethod as BridgeRequest),
    ).rejects.toThrow();
  });

  it('prevents sender impersonation by deriving sender from authenticated session', async () => {
    const manager = new BridgeSessionManager();
    const credB = manager.issueCredential(SESSION_B, 'claude-code', '2.0.0');

    const replyReq = bridgeReplyRequest();
    const impersonationAttempt = {
      ...replyReq,
      params: { ...replyReq.params, senderSessionId: SESSION_A },
    } as BridgeRequest;
    await expect(manager.dispatch(SESSION_B, credB.token, impersonationAttempt)).rejects.toThrow();

    // With no caller-supplied identity, the authenticated bridge session is authoritative.
    const result = await manager.dispatch(SESSION_B, credB.token, replyReq);
    expect(result.result).toBeDefined();
    // Result confirms created reply is from authenticated session B
    expect(resultOf(result).senderSessionId).toBe(SESSION_B);
  });

  it('dispatches the four mailbox tools: list_pending, acknowledge, reply, report_outcome', async () => {
    const manager = new BridgeSessionManager();
    const cred = manager.issueCredential(SESSION_B, 'claude-code', '2.0.0');

    // 1. list_pending
    const listRes = await manager.dispatch(SESSION_B, cred.token, bridgeListPendingRequest());
    expect(listRes.result).toBeDefined();
    expect(Array.isArray(resultOf(listRes).handoffs)).toBe(true);

    // 2. acknowledge
    const ackRes = await manager.dispatch(SESSION_B, cred.token, bridgeAcknowledgeRequest());
    expect(resultOf(ackRes).deliveryState).toBe('acknowledged');

    // 3. reply
    const replyRes = await manager.dispatch(SESSION_B, cred.token, bridgeReplyRequest());
    expect(resultOf(replyRes).id).toBeDefined();
    expect(resultOf(replyRes).recipientSessionId).toBe(SESSION_A);

    // 4. report_outcome
    const outcomeRes = await manager.dispatch(SESSION_B, cred.token, bridgeReportOutcomeRequest());
    expect(resultOf(outcomeRes).workOutcome).toBe('completed');
  });

  it('enforces rate limit of at most 20 actions per minute per session', async () => {
    const clock = createCoordinationClock();
    const manager = new BridgeSessionManager({ clock: clock.now });
    const cred = manager.issueCredential(SESSION_B, 'claude-code', '2.0.0');

    // 20 actions succeed
    for (let i = 0; i < 20; i++) {
      const res = await manager.dispatch(SESSION_B, cred.token, {
        jsonrpc: '2.0',
        id: i + 1,
        method: 'threadhelm_list_pending',
        params: { limit: 5 },
      });
      expect(res.result).toBeDefined();
    }

    // 21st action in the same minute is rate limited
    await expect(
      manager.dispatch(SESSION_B, cred.token, {
        jsonrpc: '2.0',
        id: 21,
        method: 'threadhelm_list_pending',
        params: { limit: 5 },
      }),
    ).rejects.toThrow();

    // After 1 minute, rate limit bucket resets
    clock.advance(61_000);
    const resAfter = await manager.dispatch(SESSION_B, cred.token, {
      jsonrpc: '2.0',
      id: 22,
      method: 'threadhelm_list_pending',
      params: { limit: 5 },
    });
    expect(resAfter.result).toBeDefined();
  });

  it('handles bridge disconnect safely and degrades to manual without stopping session', async () => {
    const manager = new BridgeSessionManager();
    const cred = manager.issueCredential(SESSION_B, 'claude-code', '2.0.0');
    await manager.dispatch(SESSION_B, cred.token, bridgeListPendingRequest());
    expect(manager.isConnected(SESSION_B)).toBe(true);

    manager.handleDisconnect(SESSION_B, 'PIPE_CLOSED');
    expect(manager.isConnected(SESSION_B)).toBe(false);

    // Subsequent dispatch fails with bridge unavailable
    await expect(
      manager.dispatch(SESSION_B, cred.token, bridgeListPendingRequest()),
    ).rejects.toThrow();
  });
});
