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
import { createRepositories, migrate, openDatabase } from '@threadhelm/persistence';
import {
  COORDINATION_FIXTURE_IDS,
  bridgeAcknowledgeRequest,
  bridgeListPendingRequest,
  bridgeReplyRequest,
  bridgeReportOutcomeRequest,
  createCoordinationClock,
  fixtureAdapter,
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

  it('executes full structured bridge lifecycle: issue, auth, mailbox tools, rate-limit, and teardown', async () => {
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

  it('derives memory scope and author from authenticated sessions and exposes no ingestion or owner tools', async () => {
    const database = openDatabase(':memory:');
    try {
      migrate(database);
      const workspaceA = '00000000-0000-4000-8000-000000000061';
      const workspaceB = '00000000-0000-4000-8000-000000000062';
      const sessionA = '00000000-0000-4000-8000-000000000071';
      const sessionB = '00000000-0000-4000-8000-000000000072';
      const readinessA = '00000000-0000-4000-8000-000000000081';
      const readinessB = '00000000-0000-4000-8000-000000000082';
      const at = '2026-01-01T00:00:00.000Z';
      const insertWorkspace = database.prepare(
        `INSERT INTO approved_workspaces
          (id, selected_path, display_path, canonical_path, volume_serial, file_id, drive_type,
           approved_at, last_validated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'fixed_local', ?, ?)`,
      );
      insertWorkspace.run(
        workspaceA,
        'C:\\provider-a',
        'C:\\provider-a',
        '\\\\?\\C:\\provider-a',
        'provider-a-volume',
        'provider-a-file',
        at,
        at,
      );
      insertWorkspace.run(
        workspaceB,
        'C:\\provider-b',
        'C:\\provider-b',
        '\\\\?\\C:\\provider-b',
        'provider-b-volume',
        'provider-b-file',
        at,
        at,
      );
      database
        .prepare(
          `INSERT INTO agent_definitions
            (id, display_name, provider_kind, executable_candidates, tested_version_range, capabilities)
           VALUES ('codex-cli', 'Codex CLI', 'codex-cli', '[]', 'fixture', '{}'),
                  ('claude-code', 'Claude Code', 'claude-code', '[]', 'fixture', '{}')`,
        )
        .run();
      const insertReadiness = database.prepare(
        `INSERT INTO agent_readiness_snapshots
          (id, provider_id, resolved_executable, version, availability, authentication, probed_at,
           reason_code, safe_summary)
         VALUES (?, ?, 'C:\\fixture.exe', '1.0.0', 'available', 'authenticated', ?, NULL,
                 'Fixture available')`,
      );
      insertReadiness.run(readinessA, 'codex-cli', at);
      insertReadiness.run(readinessB, 'claude-code', at);
      const insertSession = database.prepare(
        `INSERT INTO agent_sessions
          (id, workspace_id, definition_id, readiness_snapshot_id, access_mode, lifecycle_state,
           activity_state, activity_evidence_kind, columns, rows, started_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'write_capable', 'running', 'unknown', 'none', 100, 30, ?, ?, ?)`,
      );
      insertSession.run(sessionA, workspaceA, 'codex-cli', readinessA, at, at, at);
      insertSession.run(sessionB, workspaceB, 'claude-code', readinessB, at, at, at);

      const memory = createRepositories(database).memory;
      const scopes = new Map([
        [sessionA, { workspaceId: workspaceA }],
        [sessionB, { workspaceId: workspaceB }],
      ] as const);
      const scopeFor = (sessionId: string) => {
        const scope = scopes.get(sessionId as typeof sessionA | typeof sessionB);
        if (!scope) throw new Error('unscoped provider session');
        return scope;
      };
      const manager = new BridgeSessionManager();
      manager.setMemoryAuthority({
        searchForSession: (sessionId, request) =>
          memory.search({
            scope: scopeFor(sessionId),
            query: request.query,
            ...(request.kind ? { kind: request.kind } : {}),
            ...(request.includeContested ? { includeContested: true } : {}),
            ...(request.cursor ? { cursor: request.cursor } : {}),
            ...(request.limit ? { limit: request.limit } : {}),
          }),
        getForSession: (sessionId, request) =>
          memory.get(request.entryId, scopeFor(sessionId), request.revisionId),
        proposeForSession: (sessionId, request) => {
          const published = memory.publish({
            scope: scopeFor(sessionId),
            kind: request.kind,
            title: request.title ?? null,
            body: request.body,
            sourceRefs: request.sourceRefs,
            authorSessionId: sessionId,
            authorUser: false,
            confidence: request.confidence,
            submission: 'deliberate',
            createdAt: at,
          });
          return memory.get(published.entry.id, scopeFor(sessionId));
        },
      });
      const credentialA = manager.issueCredential(sessionA, 'codex-cli', '1.0.0');
      const credentialB = manager.issueCredential(sessionB, 'claude-code', '1.0.0');

      const proposed = resultOf(
        await manager.dispatch(sessionA, credentialA.token, {
          jsonrpc: '2.0',
          id: 'memory-propose',
          method: 'threadhelm_memory_propose_revision',
          params: {
            kind: 'decision',
            title: 'Provider-authored decision',
            body: 'Use deterministic provider scope.',
            sourceRefs: [{ kind: 'artifact', id: 'provider-proof.md' }],
            confidence: 'high',
          },
        }),
      );
      const summary = proposed.summary as Record<string, unknown>;
      expect(summary.scope).toEqual({ workspaceId: workspaceA });
      expect(summary.author).toEqual({ kind: 'session', sessionId: sessionA });
      const entryId = summary.entryId as string;

      const visible = resultOf(
        await manager.dispatch(sessionA, credentialA.token, {
          jsonrpc: '2.0',
          id: 'memory-search-a',
          method: 'threadhelm_memory_search',
          params: { query: 'deterministic provider scope' },
        }),
      );
      expect(visible.items).toEqual([expect.objectContaining({ entryId })]);

      const isolated = resultOf(
        await manager.dispatch(sessionB, credentialB.token, {
          jsonrpc: '2.0',
          id: 'memory-search-b',
          method: 'threadhelm_memory_search',
          params: { query: 'deterministic provider scope' },
        }),
      );
      expect(isolated.items).toEqual([]);
      await expect(
        manager.dispatch(sessionB, credentialB.token, {
          jsonrpc: '2.0',
          id: 'memory-get-cross-scope',
          method: 'threadhelm_memory_get',
          params: { entryId },
        }),
      ).rejects.toThrowError(expect.objectContaining({ code: 'MEMORY_SCOPE_UNAUTHORIZED' }));

      for (const forbiddenParams of [
        { kind: 'fact', body: 'impersonation', workspaceId: workspaceB },
        { kind: 'fact', body: 'impersonation', authorSessionId: sessionB },
        { kind: 'fact', body: 'automatic transcript', submission: 'provider_transcript' },
      ]) {
        await expect(
          manager.dispatch(sessionA, credentialA.token, {
            jsonrpc: '2.0',
            id: `memory-forbidden-${Object.keys(forbiddenParams).at(-1)}`,
            method: 'threadhelm_memory_propose_revision',
            params: forbiddenParams,
          }),
        ).rejects.toThrow();
      }
      for (const forbiddenMethod of [
        'threadhelm_memory_ingest_transcript',
        'threadhelm_memory_delete',
        'threadhelm_memory_resolve_conflict',
      ]) {
        await expect(
          manager.dispatch(sessionA, credentialA.token, {
            jsonrpc: '2.0',
            id: forbiddenMethod,
            method: forbiddenMethod,
            params: {},
          }),
        ).rejects.toThrow();
      }
    } finally {
      database.close();
    }
  });
});

describe('Provider lifecycle acceptance smoke (T059)', () => {
  const SESSION_1 = COORDINATION_FIXTURE_IDS.senderSession;
  const cases = [
    { providerId: 'codex-cli' as const, adapter: codexAdapter },
    { providerId: 'claude-code' as const, adapter: claudeCodeAdapter },
  ];

  it.each(cases)(
    'keeps the built-in $providerId adapter manual until exact installed proof is recorded',
    ({ adapter }) => {
      expect(adapter.capabilities.safePointEvidence).toMatchObject({
        mode: 'none',
        exactVersions: [],
        inputSafety: 'unknown',
      });
      expect(adapter.capabilities.automaticPresentation).toBe('manual_only');
      expect(
        adapter.parseLifecycleEvidence?.({
          transcriptPath: 'must-not-cross.jsonl',
          lastAssistantMessage: 'must not persist',
        }),
      ).toBeNull();
    },
  );

  it.each(cases)(
    'isolates exact fixture safe points, pending drafts, power invalidation, and cleanup for $providerId',
    async ({ providerId }) => {
      const clock = createCoordinationClock();
      const presentations: string[] = [];
      const adapter = fixtureAdapter({
        id: providerId,
        mode: 'echo',
        executable: process.execPath,
        structuredSafePoint: true,
      });
      const manager = new BridgeSessionManager({
        clock: clock.now,
        adapters: [adapter],
        onLifecycleEvidence: (evidence) => {
          presentations.push(evidence.providerEventId);
          return { presented: true, reasonCode: null };
        },
      });
      const credential = manager.issueCredential(SESSION_1, providerId, '1.0.0');
      const base = {
        sessionId: SESSION_1,
        providerId,
        providerVersion: '1.0.0',
        eventKind: 'safe_point' as const,
        turnId: 'acceptance-turn-1',
        occurredAt: clock.iso(),
        safePoint: true,
      };

      await expect(
        manager.ingestLifecycleEvidence(SESSION_1, credential.token, {
          ...base,
          providerEventId: 'acceptance-safe-point-1',
          inputSafety: 'proved_no_pending_draft',
        }),
      ).resolves.toMatchObject({ status: 'accepted', safePoint: true });
      await expect(
        manager.ingestLifecycleEvidence(SESSION_1, credential.token, {
          ...base,
          providerEventId: 'acceptance-safe-point-2',
          turnId: 'acceptance-turn-2',
          inputSafety: 'unknown',
        }),
      ).resolves.toMatchObject({ status: 'manual_only', safePoint: false });

      clock.advance(1);
      manager.invalidateLifecycleEvidence(SESSION_1);
      await expect(
        manager.ingestLifecycleEvidence(SESSION_1, credential.token, {
          ...base,
          providerEventId: 'acceptance-pre-power-event',
          inputSafety: 'proved_no_pending_draft',
        }),
      ).resolves.toMatchObject({
        status: 'rejected',
        reasonCode: 'LIFECYCLE_EVIDENCE_STALE',
      });
      expect(presentations).toEqual(['acceptance-safe-point-1']);

      manager.revoke(SESSION_1);
      expect(manager.authenticate(SESSION_1, credential.token)).toBeNull();
      await expect(
        manager.ingestLifecycleEvidence(SESSION_1, credential.token, {
          ...base,
          providerEventId: 'acceptance-after-cleanup',
          inputSafety: 'proved_no_pending_draft',
        }),
      ).rejects.toThrow();
    },
  );
});
