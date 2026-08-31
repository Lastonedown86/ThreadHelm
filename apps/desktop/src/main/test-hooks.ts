/**
 * Test hooks — installed ONLY when the app is started with
 * `--threadhelm-test-hooks`. They give Playwright/vitest harnesses the same
 * router the renderer uses, a way to answer the native folder picker without
 * a dialog, fixture-backed provider adapters, and crash/power simulation.
 *
 * Production operations still go through their normal boundaries. Extra test
 * authority is explicit: picker substitution and authenticated-provider
 * outcome simulation for deterministic bridge-independent E2E coverage.
 */

import { app } from 'electron';
import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import {
  ProviderLifecycleEvidence,
  CoordinationEventEnvelope,
  EscalationView,
  type HandoffKind,
  type MemoryDetailView,
  type PowerEvent,
  type ProviderMemoryProposeRevisionInput,
  type ProviderId,
  type WorkOutcome,
} from '@threadhelm/contracts';
import {
  fixtureAdapter,
  resolveFixtureRuntime,
  type FakeAgentMode,
} from '@threadhelm/test-fixtures/desktop';
import type { Context, HostHandle } from './context.js';
import type { Envelope, Router } from './ipc/router.js';
import type { LifecycleIngestionResult } from './coordination/bridge.js';
import { reconcileLiveSessions } from './recovery/power-events.js';
import { failSession } from './sessions/failure.js';

export const TEST_HOOKS_SWITCH = 'threadhelm-test-hooks';

export interface TestHooks {
  dispatch(name: string, payload?: unknown): Promise<Envelope<unknown>>;
  setPickerPath(path: string | null): void;
  setProfileFilePickerPath(path: string | null): void;
  setAgentExportPickerPath(path: string | null): void;
  failNextAgentExportBeforeWrite(): void;
  failNextAgentExportAfterReplace(): void;
  failNextAgentExportTempCleanup(): void;
  useFixtureAdapters(
    modes: Partial<Record<ProviderId, FakeAgentMode>>,
    lines?: number,
    permissionCapabilities?: Partial<Record<ProviderId, 'allowed' | 'denied' | 'unknown'>>,
  ): void;
  liveSessions(): { id: string; state: string; hostPid: number; rootPid: number | null }[];
  jobSnapshot(sessionId: string): { activeProcessCount: number; processIds: number[] } | null;
  simulatePower(event: PowerEvent): void;
  delayNextHostReady(ms: number): void;
  delayNextControlApplied(ms: number): void;
  failNextHostInput(): void;
  failSession(sessionId: string): void;
  reportProviderOutcome(
    sessionId: string,
    handoffId: string,
    outcome: WorkOutcome,
  ): { handoffId: string; workOutcome: WorkOutcome };
  proposeProviderMemory(
    sessionId: string,
    input: ProviderMemoryProposeRevisionInput,
  ): MemoryDetailView;
  replyFromProvider(input: {
    sessionId: string;
    inReplyToId: string;
    kind: HandoffKind;
    purpose: string;
    body: string;
    authorityRequired: boolean;
  }): { id: string; deliveryState: string; holdReasonCode: string | null };
  emitProviderLifecycle(evidence: unknown): Promise<LifecycleIngestionResult>;
  bridgeRequest(
    sessionId: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown>;
  dropProviderPipe(sessionId: string): Promise<void>;
  storagePath(): string;
  breakStorage(): void;
  version(): string;
}

export function testHooksEnabled(): boolean {
  return app.commandLine.hasSwitch(TEST_HOOKS_SWITCH);
}

export function installTestHooks(ctx: Context, router: Router, allowedOrigin: () => string): void {
  let pickerPath: string | null = null;
  let profileFilePickerPath: string | null = null;
  let agentExportPickerPath: string | null = null;
  let failNextAgentExportBeforeWrite = false;
  let failNextAgentExportAfterReplace = false;
  let failNextAgentExportTempCleanup = false;
  let nextHostReadyDelayMs = 0;
  let nextControlAppliedDelayMs = 0;
  let rejectNextHostInput = false;
  const productionHosts = ctx.hosts;
  ctx.hosts = {
    spawn(sessionId) {
      const host = productionHosts.spawn(sessionId);
      const delayMs = nextHostReadyDelayMs;
      nextHostReadyDelayMs = 0;
      const delayed: HostHandle = {
        get pid() {
          return host.pid;
        },
        postMessage(message, ports) {
          if (message.type === 'host.input' && rejectNextHostInput) {
            rejectNextHostInput = false;
            throw new Error('TEST_INPUT_REJECTED_BEFORE_WRITE');
          }
          host.postMessage(message, ports);
        },
        onMessage(listener) {
          host.onMessage((message) => {
            const type =
              message && typeof message === 'object'
                ? (message as { type?: unknown }).type
                : undefined;
            if (type === 'host.ready' && delayMs > 0) {
              setTimeout(() => listener(message), delayMs);
            } else if (type === 'host.controlApplied' && nextControlAppliedDelayMs > 0) {
              const controlDelayMs = nextControlAppliedDelayMs;
              nextControlAppliedDelayMs = 0;
              setTimeout(() => listener(message), controlDelayMs);
            } else listener(message);
          });
        },
        onExit: (listener) => host.onExit(listener),
        kill: () => host.kill(),
      };
      return delayed;
    },
  };
  ctx.picker = { pickDirectory: async () => pickerPath };
  ctx.profilePicker = { pickFile: async () => profileFilePickerPath };
  ctx.agentExportPicker = { pickTarget: async () => agentExportPickerPath };
  ctx.agentExportFailureInjector = {
    consumeBeforeWriteFailure: () => {
      const fail = failNextAgentExportBeforeWrite;
      failNextAgentExportBeforeWrite = false;
      return fail;
    },
    consumeAfterReplaceFailure: () => {
      const fail = failNextAgentExportAfterReplace;
      failNextAgentExportAfterReplace = false;
      return fail;
    },
    consumeTempCleanupFailure: () => {
      const fail = failNextAgentExportTempCleanup;
      failNextAgentExportTempCleanup = false;
      return fail;
    },
  };

  const hooks: TestHooks = {
    dispatch: (name, payload) =>
      router.dispatch(name, payload, { frameUrl: allowedOrigin(), isMainFrame: true }),
    setPickerPath: (path) => {
      pickerPath = path;
    },
    setProfileFilePickerPath: (path) => {
      profileFilePickerPath = path;
    },
    setAgentExportPickerPath: (path) => {
      agentExportPickerPath = path;
    },
    failNextAgentExportBeforeWrite: () => {
      failNextAgentExportBeforeWrite = true;
    },
    failNextAgentExportAfterReplace: () => {
      failNextAgentExportAfterReplace = true;
    },
    failNextAgentExportTempCleanup: () => {
      failNextAgentExportTempCleanup = true;
    },
    useFixtureAdapters: (modes, lines, permissionCapabilities) => {
      ctx.adapters = ctx.adapters.map((adapter) => {
        const mode = modes[adapter.id];
        if (!mode) return adapter;
        return fixtureAdapter({
          id: adapter.id,
          mode,
          executable: resolveFixtureRuntime() ?? process.execPath,
          ...(lines !== undefined ? { lines } : {}),
          structuredSafePoint: true,
          ...(permissionCapabilities?.[adapter.id]
            ? { permissionCapability: permissionCapabilities[adapter.id] }
            : {}),
        });
      });
      ctx.coordinationBridge?.setAdapters(ctx.adapters);
    },
    liveSessions: () =>
      [...ctx.live.values()].map((live) => ({
        id: live.id,
        state: live.state,
        hostPid: live.hostPid,
        rootPid: live.rootPid,
      })),
    jobSnapshot: (sessionId) => {
      const live = ctx.live.get(sessionId);
      if (!live) return null;
      try {
        const snapshot = ctx.native.inspectJob(live.jobToken);
        return { activeProcessCount: snapshot.activeProcessCount, processIds: snapshot.processIds };
      } catch {
        return null;
      }
    },
    simulatePower: (event) => reconcileLiveSessions(ctx, event),
    delayNextHostReady: (ms) => {
      nextHostReadyDelayMs = Math.max(0, Math.min(ms, 30_000));
    },
    delayNextControlApplied: (ms) => {
      nextControlAppliedDelayMs = Math.max(0, Math.min(ms, 30_000));
    },
    failNextHostInput: () => {
      rejectNextHostInput = true;
    },
    failSession: (sessionId) => {
      const live = ctx.live.get(sessionId);
      if (!live) throw new Error('TEST_SESSION_NOT_LIVE');
      failSession(ctx, live, 'TEST_HOST_EXITED_DURING_DISPATCH');
    },
    reportProviderOutcome: (sessionId, handoffId, outcome) => {
      if (!ctx.live.has(sessionId)) throw new Error('TEST_SESSION_NOT_LIVE');
      const repository = ctx.storage?.repositories.coordination;
      if (!repository) throw new Error('TEST_STORAGE_UNAVAILABLE');
      const handoff = repository.reportWorkOutcome(
        handoffId,
        sessionId,
        outcome,
        null,
        ctx.clock().toISOString(),
      );
      return { handoffId: handoff.id, workOutcome: handoff.workOutcome };
    },
    proposeProviderMemory: (sessionId, input) => {
      if (!ctx.live.has(sessionId)) throw new Error('TEST_SESSION_NOT_LIVE');
      if (!ctx.memory) throw new Error('TEST_MEMORY_UNAVAILABLE');
      return ctx.memory.proposeForSession(sessionId, input);
    },
    replyFromProvider: (input) => {
      if (!ctx.live.has(input.sessionId)) throw new Error('TEST_SESSION_NOT_LIVE');
      const repository = ctx.storage?.repositories.coordination;
      if (!repository) throw new Error('TEST_STORAGE_UNAVAILABLE');
      const handoff = repository.createBridgeReply({
        inReplyToId: input.inReplyToId,
        senderSessionId: input.sessionId,
        kind: input.kind,
        purpose: input.purpose,
        body: input.body,
        authorityRequired: input.authorityRequired,
        createdAt: ctx.clock().toISOString(),
      });
      const event = repository.latestEventForHandoff(handoff.id);
      if (event && ctx.coordination) {
        ctx.coordination.publish(
          CoordinationEventEnvelope.parse({
            type: 'coordination.handoffChanged',
            eventId: event.id,
            conversationId: event.conversationId,
            handoffId: event.handoffId,
            sequence: event.sequence,
            kind: event.kind,
            reasonCode: event.reasonCode,
            safeSummary: event.safeSummary,
            occurredAt: event.occurredAt,
          }),
        );
      }
      const escalation = repository.getOpenEscalation(handoff.conversationId);
      if (escalation) {
        ctx.events.emit('coordination.escalationChanged', EscalationView.parse(escalation));
      }
      return {
        id: handoff.id,
        deliveryState: handoff.deliveryState,
        holdReasonCode: handoff.holdReasonCode,
      };
    },
    emitProviderLifecycle: async (rawEvidence) => {
      const evidence = ProviderLifecycleEvidence.parse(rawEvidence);
      if (!ctx.live.has(evidence.sessionId)) throw new Error('TEST_SESSION_NOT_LIVE');
      const manager = ctx.coordinationBridge;
      const token = manager?.testCredential(evidence.sessionId);
      if (!manager || !token) throw new Error('TEST_BRIDGE_NOT_AVAILABLE');
      return manager.ingestLifecycleEvidence(evidence.sessionId, token, evidence);
    },
    bridgeRequest: async (sessionId, method, params) => {
      const manager = ctx.coordinationBridge;
      const credential = manager?.testCredential(sessionId);
      const pipeName = manager?.testPipeName(sessionId);
      if (!credential || !pipeName) throw new Error('TEST_BRIDGE_NOT_AVAILABLE');
      const response = await new Promise<{
        error?: unknown;
        result?: { isError?: boolean; structuredContent?: unknown };
      }>((resolve, reject) => {
        const socket = createConnection(pipeName);
        let buffer = '';
        socket.setEncoding('utf8');
        socket.setTimeout(30_000, () => socket.destroy(new Error('TEST_BRIDGE_TIMEOUT')));
        socket.once('error', reject);
        socket.once('connect', () =>
          socket.write(
            `${JSON.stringify({ sessionId, credential, payload: { jsonrpc: '2.0', id: randomUUID(), method: 'tools/call', params: { name: method, arguments: params } } })}\n`,
          ),
        );
        socket.on('data', (chunk: string) => {
          buffer += chunk;
          if (Buffer.byteLength(buffer) > 32 * 1024) {
            socket.destroy(new Error('TEST_BRIDGE_FRAME_TOO_LARGE'));
            return;
          }
          const newline = buffer.indexOf('\n');
          if (newline < 0) return;
          try {
            resolve(JSON.parse(buffer.slice(0, newline)));
            socket.end();
          } catch {
            socket.destroy(new Error('TEST_BRIDGE_RESPONSE_INVALID'));
          }
        });
      });
      if (response.error || response.result?.isError)
        throw new Error(
          `TEST_BRIDGE_REJECTED ${JSON.stringify(response.result?.structuredContent ?? {})}`,
        );
      return response.result?.structuredContent;
    },
    dropProviderPipe: async (sessionId) => {
      if (!ctx.live.has(sessionId)) throw new Error('TEST_SESSION_NOT_LIVE');
      const pipeName = ctx.coordinationBridge?.testPipeName(sessionId);
      if (!pipeName) throw new Error('TEST_BRIDGE_NOT_AVAILABLE');
      await new Promise<void>((resolve, reject) => {
        const socket = createConnection(pipeName);
        socket.once('error', reject);
        socket.once('close', () => resolve());
        socket.once('connect', () => socket.end());
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    },
    storagePath: () => ctx.storage?.db.name ?? '',
    breakStorage: () => {
      ctx.storage?.db.close();
    },
    version: () => app.getVersion(),
  };
  (globalThis as unknown as { __threadhelmTest: TestHooks }).__threadhelmTest = hooks;
  ctx.log.warn('test_hooks.installed', { enabled: true });
}
