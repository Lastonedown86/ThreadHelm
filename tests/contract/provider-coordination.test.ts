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
  fixtureAdapter,
} from '@threadhelm/test-fixtures';
import { ProviderLifecycleEvidence } from '@threadhelm/contracts';
import { claudeCodeAdapter, codexAdapter } from '@threadhelm/providers';
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

function closePipeWithoutRequest(pipeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(pipeName);
    socket.once('error', reject);
    socket.once('close', () => resolve());
    socket.once('connect', () => socket.end());
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
      expect(manager.hasValidCredential(SESSION_B)).toBe(true);

      manager.revoke(SESSION_B);
      expect(() => readFileSync(config.sessionConfigPath, 'utf8')).toThrow();
    } finally {
      manager.revoke(SESSION_B);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('degrades on transport EOF before an authenticated exchange completes', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000099';
    const root = mkdtempSync(join(tmpdir(), 'threadhelm-bridge-eof-'));
    const bridgeExecutablePath = join(root, 'threadhelm-coordination-bridge.exe');
    writeFileSync(bridgeExecutablePath, 'fixture');
    const manager = new BridgeSessionManager({ configRoot: root, bridgeExecutablePath });
    try {
      const config = await manager.prepareSession(sessionId, 'claude-code', '2.0.0');
      await closePipeWithoutRequest(config.pipeName);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(manager.hasValidCredential(sessionId)).toBe(false);
    } finally {
      manager.revoke(sessionId);
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

describe('Provider lifecycle evidence contract (T050)', () => {
  const SESSION_A = COORDINATION_FIXTURE_IDS.senderSession;
  const SESSION_B = COORDINATION_FIXTURE_IDS.recipientSession;

  function evidence(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: SESSION_B,
      providerId: 'claude-code',
      providerVersion: '1.0.0',
      eventKind: 'safe_point',
      providerEventId: 'fixture-safe-point-1',
      turnId: 'fixture-turn-1',
      occurredAt: '2026-01-01T00:00:00.000Z',
      safePoint: true,
      inputSafety: 'proved_no_pending_draft',
      ...overrides,
    };
  }

  it('keeps built-in providers manual until an exact version and input-safety path are proved', () => {
    for (const adapter of [codexAdapter, claudeCodeAdapter]) {
      expect(adapter.capabilities.safePointEvidence).toMatchObject({
        mode: 'none',
        exactVersions: [],
        inputSafety: 'unknown',
      });
      expect(adapter.capabilities.automaticPresentation).toBe('manual_only');
    }

    const fixture = fixtureAdapter({
      id: 'claude-code',
      mode: 'echo',
      executable: process.execPath,
      structuredSafePoint: true,
    });
    expect(fixture.capabilities.safePointEvidence).toMatchObject({
      mode: 'structured_event',
      exactVersions: ['1.0.0'],
      inputSafety: 'proved_no_pending_draft',
    });
    expect(fixture.capabilities.automaticPresentation).toBe('structured_safe_point');
  });

  it('accepts one exact fresh content-free event and deduplicates the provider event id', async () => {
    const clock = createCoordinationClock();
    const accepted: unknown[] = [];
    const fixture = fixtureAdapter({
      id: 'claude-code',
      mode: 'echo',
      executable: process.execPath,
      structuredSafePoint: true,
    });
    const manager = new BridgeSessionManager({
      clock: clock.now,
      adapters: [fixture],
      onLifecycleEvidence: (value) => {
        accepted.push(value);
        return { presented: false, reasonCode: 'NO_PENDING_HANDOFF' };
      },
    });
    const credential = manager.issueCredential(SESSION_B, 'claude-code', '1.0.0');

    await expect(
      manager.ingestLifecycleEvidence(SESSION_B, credential.token, evidence()),
    ).resolves.toMatchObject({ status: 'accepted', safePoint: true });
    await expect(
      manager.ingestLifecycleEvidence(SESSION_B, credential.token, evidence()),
    ).resolves.toMatchObject({ status: 'duplicate', safePoint: false });
    await expect(
      manager.ingestLifecycleEvidence(
        SESSION_B,
        credential.token,
        evidence({ providerEventId: 'fixture-safe-point-2' }),
      ),
    ).resolves.toMatchObject({ status: 'duplicate', safePoint: false });
    expect(accepted).toHaveLength(1);
  });

  it('rejects future-dated evidence and keeps dedupe identities for the session lifetime', async () => {
    const clock = createCoordinationClock();
    const fixture = fixtureAdapter({
      id: 'claude-code',
      mode: 'echo',
      executable: process.execPath,
      structuredSafePoint: true,
    });
    const manager = new BridgeSessionManager({
      clock: clock.now,
      adapters: [fixture],
      onLifecycleEvidence: () => ({ presented: false, reasonCode: 'NO_PENDING_HANDOFF' }),
    });
    const credential = manager.issueCredential(SESSION_B, 'claude-code', '1.0.0');

    await expect(
      manager.ingestLifecycleEvidence(
        SESSION_B,
        credential.token,
        evidence({
          providerEventId: 'future-before-power',
          turnId: 'future-before-power-turn',
          occurredAt: '2026-01-01T00:00:00.001Z',
        }),
      ),
    ).resolves.toMatchObject({ status: 'rejected', reasonCode: 'LIFECYCLE_EVIDENCE_STALE' });

    await expect(
      manager.ingestLifecycleEvidence(
        SESSION_B,
        credential.token,
        evidence({ providerEventId: 'lifetime-event', turnId: 'lifetime-turn' }),
      ),
    ).resolves.toMatchObject({ status: 'accepted' });
    clock.advance(31_000);
    manager.invalidateLifecycleEvidence(SESSION_B);
    clock.advance(1);
    await expect(
      manager.ingestLifecycleEvidence(
        SESSION_B,
        credential.token,
        evidence({
          providerEventId: 'lifetime-event',
          turnId: 'fresh-turn-id',
          occurredAt: clock.iso(),
        }),
      ),
    ).resolves.toMatchObject({ status: 'duplicate', reasonCode: 'LIFECYCLE_EVIDENCE_DUPLICATE' });
  });

  it('rejects stale, cross-session, unknown-field, version, and pending-draft evidence', async () => {
    const clock = createCoordinationClock();
    const fixture = fixtureAdapter({
      id: 'claude-code',
      mode: 'echo',
      executable: process.execPath,
      structuredSafePoint: true,
    });
    const manager = new BridgeSessionManager({ clock: clock.now, adapters: [fixture] });
    const credential = manager.issueCredential(SESSION_B, 'claude-code', '1.0.0');

    expect(
      ProviderLifecycleEvidence.safeParse(evidence({ transcriptPath: 'secret.jsonl' })).success,
    ).toBe(false);
    await expect(
      manager.ingestLifecycleEvidence(
        SESSION_B,
        credential.token,
        evidence({ sessionId: SESSION_A }),
      ),
    ).resolves.toMatchObject({ status: 'rejected', reasonCode: 'LIFECYCLE_SESSION_MISMATCH' });
    await expect(
      manager.ingestLifecycleEvidence(
        SESSION_B,
        credential.token,
        evidence({ providerVersion: '1.0.1' }),
      ),
    ).resolves.toMatchObject({ status: 'manual_only', reasonCode: 'LIFECYCLE_VERSION_UNPROVED' });
    await expect(
      manager.ingestLifecycleEvidence(
        SESSION_B,
        credential.token,
        evidence({ occurredAt: '2025-12-31T23:58:00.000Z' }),
      ),
    ).resolves.toMatchObject({ status: 'rejected', reasonCode: 'LIFECYCLE_EVIDENCE_STALE' });
    await expect(
      manager.ingestLifecycleEvidence(
        SESSION_B,
        credential.token,
        evidence({ inputSafety: 'unknown', providerEventId: 'fixture-safe-point-2' }),
      ),
    ).resolves.toMatchObject({ status: 'manual_only', reasonCode: 'PENDING_DRAFT_UNPROVED' });
  });
});
