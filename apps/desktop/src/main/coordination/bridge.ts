/** Session-scoped coordination bridge manager (Feature 002, US2). */

import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import { join } from 'node:path';
import {
  HandoffId,
  HandoffKind,
  ProviderLifecycleEvidence,
  ReasonCode,
  ThreadHelmError,
  WorkOutcome,
  type EventPayload,
} from '@threadhelm/contracts';
import {
  sanitizeCoordinationBody,
  sanitizeCoordinationPurpose,
  type CoordinationRepository,
} from '@threadhelm/persistence';
import type { ProviderId } from '@threadhelm/contracts';
import type { ProviderLifecycleEvidence as ProviderLifecycleEvidenceValue } from '@threadhelm/contracts';
import type { ProviderAdapter, SessionBridgeConfig } from '@threadhelm/providers';

export interface BridgeSessionInfo {
  sessionId: string;
  token: string;
  pipeName: string;
  providerId: string;
  providerVersion: string;
  connected: boolean;
  credentialValid: boolean;
  issuedAt: number;
}

export interface BridgeRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface BridgeResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface BridgeDispatchContext {
  repo?: CoordinationRepository;
  clock?: () => Date;
  onEvent?: (payload: EventPayload<'coordination.bridgeChanged'>) => void;
  configRoot?: string;
  bridgeExecutablePath?: string;
  adapters?: readonly ProviderAdapter[];
  onLifecycleEvidence?: (
    evidence: ProviderLifecycleEvidenceValue,
  ) => Promise<LifecyclePresentationResult> | LifecyclePresentationResult;
  onHandoffChanged?: (handoffId: string) => void;
}

export interface LifecyclePresentationResult {
  presented: boolean;
  reasonCode: string | null;
}

export interface LifecycleIngestionResult {
  status: 'accepted' | 'duplicate' | 'manual_only' | 'rejected';
  safePoint: boolean;
  reasonCode: string | null;
  presentation: LifecyclePresentationResult | null;
}

const MAX_LIFECYCLE_DEDUPE_KEYS = 4_096;

export const MAX_FRAME_BYTES = 32 * 1024;
export const MAX_MUTATIONS_PER_MINUTE = 20;

export class BridgeSessionManager {
  readonly #sessions = new Map<string, BridgeSessionInfo>();
  readonly #rateLimits = new Map<string, number[]>();
  readonly #servers = new Map<string, Server>();
  readonly #configPaths = new Map<string, string[]>();
  readonly #inFlightMutations = new Set<string>();
  readonly #repo: CoordinationRepository | undefined;
  readonly #clock: () => Date;
  readonly #onEvent: ((payload: EventPayload<'coordination.bridgeChanged'>) => void) | undefined;
  readonly #configRoot: string | undefined;
  readonly #bridgeExecutablePath: string | undefined;
  readonly #seenLifecycleEvents = new Map<string, Map<string, number>>();
  readonly #lifecycleNotBefore = new Map<string, number>();
  #adapters: readonly ProviderAdapter[];
  readonly #onLifecycleEvidence:
    | ((
        evidence: ProviderLifecycleEvidenceValue,
      ) => Promise<LifecyclePresentationResult> | LifecyclePresentationResult)
    | undefined;
  readonly #onHandoffChanged: ((handoffId: string) => void) | undefined;

  constructor(options: BridgeDispatchContext = {}) {
    this.#repo = options.repo;
    this.#clock = options.clock ?? (() => new Date());
    this.#onEvent = options.onEvent;
    this.#configRoot = options.configRoot;
    this.#bridgeExecutablePath = options.bridgeExecutablePath;
    this.#adapters = options.adapters ?? [];
    this.#onLifecycleEvidence = options.onLifecycleEvidence;
    this.#onHandoffChanged = options.onHandoffChanged;
  }

  setAdapters(adapters: readonly ProviderAdapter[]): void {
    this.#adapters = adapters;
  }

  async prepareSession(
    sessionId: string,
    providerId: ProviderId,
    providerVersion: string,
  ): Promise<SessionBridgeConfig> {
    if (!this.#configRoot || !this.#bridgeExecutablePath) {
      throw new ThreadHelmError(
        'COORDINATION_BRIDGE_UNAVAILABLE',
        'Session bridge paths are not configured.',
      );
    }
    if (!existsSync(this.#bridgeExecutablePath)) {
      throw new ThreadHelmError(
        'COORDINATION_BRIDGE_UNAVAILABLE',
        'The packaged coordination bridge is unavailable.',
      );
    }
    if (this.#sessions.has(sessionId)) {
      throw new ThreadHelmError('INVALID_STATE', 'Session bridge is already configured.');
    }

    const issued = this.issueCredential(sessionId, providerId, providerVersion);
    const server = createServer((socket) => this.#acceptConnection(sessionId, socket));
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once('error', onError);
        server.listen(issued.pipeName, () => {
          server.off('error', onError);
          resolve();
        });
      });
      this.#servers.set(sessionId, server);

      const directory = join(this.#configRoot, sessionId);
      mkdirSync(directory, { recursive: true });
      const sessionConfigPath = join(directory, 'bridge-session.json');
      writePrivateJson(sessionConfigPath, {
        version: 1,
        pipeName: issued.pipeName,
        sessionId,
        credential: issued.token,
      });
      const paths = [sessionConfigPath];
      const bridgeArgs = ['--session-config', sessionConfigPath];
      const result: SessionBridgeConfig = {
        bridgeExecutablePath: this.#bridgeExecutablePath,
        pipeName: issued.pipeName,
        sessionId,
        sessionConfigPath,
      };

      if (providerId === 'claude-code') {
        const providerConfigPath = join(directory, 'claude-mcp.json');
        writePrivateJson(providerConfigPath, {
          mcpServers: {
            threadhelm: {
              type: 'stdio',
              command: this.#bridgeExecutablePath,
              args: bridgeArgs,
            },
          },
        });
        paths.push(providerConfigPath);
        result.providerConfigPath = providerConfigPath;
      } else {
        result.codexConfigOverrides = [
          `mcp_servers.threadhelm.command=${tomlString(this.#bridgeExecutablePath)}`,
          `mcp_servers.threadhelm.args=${JSON.stringify(bridgeArgs)}`,
        ];
      }
      this.#configPaths.set(sessionId, paths);
      return result;
    } catch (error) {
      server.close();
      this.revoke(sessionId, 'COORDINATION_BRIDGE_UNAVAILABLE');
      throw new ThreadHelmError(
        'COORDINATION_BRIDGE_UNAVAILABLE',
        'The local coordination bridge could not be prepared.',
        { reason: error instanceof Error ? error.name : 'unknown' },
      );
    }
  }

  issueCredential(
    sessionId: string,
    providerId: string,
    providerVersion: string,
  ): { sessionId: string; token: string; pipeName: string } {
    const token = randomBytes(24).toString('hex');
    const pipeName = `\\\\.\\pipe\\threadhelm-coord-${sessionId}`;
    const info: BridgeSessionInfo = {
      sessionId,
      token,
      pipeName,
      providerId,
      providerVersion,
      connected: false,
      credentialValid: true,
      issuedAt: this.#clock().getTime(),
    };
    this.#sessions.set(sessionId, info);
    return { sessionId, token, pipeName };
  }

  authenticate(sessionId: string, token: string): BridgeSessionInfo | null {
    const info = this.#sessions.get(sessionId);
    if (!info || !info.credentialValid || info.token !== token) {
      return null;
    }
    return info;
  }

  revoke(sessionId: string, reasonCode = 'REVOKED'): void {
    const info = this.#sessions.get(sessionId);
    if (info) {
      this.#servers.get(sessionId)?.close();
      this.#servers.delete(sessionId);
      for (const path of this.#configPaths.get(sessionId) ?? []) {
        try {
          rmSync(path, { force: true });
        } catch {
          /* credential is already invalid even if cleanup is delayed */
        }
      }
      const directory = this.#configRoot ? join(this.#configRoot, sessionId) : null;
      if (directory) {
        try {
          rmSync(directory, { recursive: true, force: true });
        } catch {
          /* credential is already invalid even if cleanup is delayed */
        }
      }
      this.#configPaths.delete(sessionId);
      this.#sessions.delete(sessionId);
      this.#rateLimits.delete(sessionId);
      this.#inFlightMutations.delete(sessionId);
      this.#seenLifecycleEvents.delete(sessionId);
      this.#lifecycleNotBefore.delete(sessionId);
      this.#onEvent?.({
        sessionId,
        capability: 'session_scoped_stdio_mcp',
        connected: false,
        reasonCode,
      });
    }
  }

  revokeAll(): void {
    for (const sessionId of [...this.#sessions.keys()]) this.revoke(sessionId);
  }

  #acceptConnection(sessionId: string, socket: Socket): void {
    socket.setEncoding('utf8');
    let buffer = '';
    let inFlight = false;
    let exchangeCompleted = false;
    let disconnected = false;
    const disconnect = (reasonCode: string) => {
      if (disconnected) return;
      disconnected = true;
      this.handleDisconnect(sessionId, reasonCode);
    };
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer, 'utf8') > MAX_FRAME_BYTES) {
        socket.destroy();
        disconnect('FRAME_TOO_LARGE');
        return;
      }
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      if (inFlight || buffer.indexOf('\n', newline + 1) >= 0) {
        socket.destroy();
        disconnect('MULTIPLE_IN_FLIGHT');
        return;
      }
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      inFlight = true;
      void this.#dispatchPipeEnvelope(sessionId, line)
        .then((response) => {
          socket.write(`${JSON.stringify(response)}\n`, (error) => {
            if (error) {
              disconnect('PIPE_DISCONNECTED');
              return;
            }
            exchangeCompleted = true;
            inFlight = false;
          });
        })
        .catch(() => {
          socket.destroy();
          disconnect('PIPE_PROTOCOL_REJECTED');
        });
    });
    const incompleteExchange = () => !exchangeCompleted || inFlight || buffer.length > 0;
    socket.on('end', () => {
      if (incompleteExchange()) disconnect('PIPE_DISCONNECTED');
    });
    socket.on('close', (hadError) => {
      if (hadError || incompleteExchange()) disconnect('PIPE_DISCONNECTED');
    });
    socket.on('error', () => disconnect('PIPE_DISCONNECTED'));
  }

  async #dispatchPipeEnvelope(sessionId: string, line: string): Promise<BridgeResponse> {
    const decoded: unknown = JSON.parse(line);
    if (!isRecord(decoded) || !hasOnlyKeys(decoded, ['sessionId', 'credential', 'payload'])) {
      throw new ThreadHelmError('INVALID_REQUEST', 'Invalid bridge envelope.');
    }
    if (decoded.sessionId !== sessionId || typeof decoded.credential !== 'string') {
      throw new ThreadHelmError('UNAUTHORIZED_SENDER', 'Bridge session identity did not match.');
    }
    const payload = decoded.payload;
    if (!isRecord(payload) || !hasOnlyKeys(payload, ['jsonrpc', 'id', 'method', 'params'])) {
      throw new ThreadHelmError('INVALID_REQUEST', 'Invalid MCP request.');
    }
    if (payload.jsonrpc !== '2.0' || payload.method !== 'tools/call') {
      throw new ThreadHelmError('INVALID_REQUEST', 'Only MCP tool calls cross the private pipe.');
    }
    if (typeof payload.id !== 'string' && typeof payload.id !== 'number') {
      throw new ThreadHelmError('INVALID_REQUEST', 'MCP request ID is invalid.');
    }
    if (!isRecord(payload.params) || !hasOnlyKeys(payload.params, ['name', 'arguments'])) {
      throw new ThreadHelmError('INVALID_REQUEST', 'MCP tool call parameters are invalid.');
    }
    if (typeof payload.params.name !== 'string' || !isRecord(payload.params.arguments)) {
      throw new ThreadHelmError('INVALID_REQUEST', 'MCP tool call parameters are invalid.');
    }
    if (!this.authenticate(sessionId, decoded.credential)) {
      throw new ThreadHelmError('UNAUTHORIZED_SENDER', 'Bridge credential was rejected.');
    }
    let response: BridgeResponse;
    try {
      response = await this.dispatch(sessionId, decoded.credential, {
        jsonrpc: '2.0',
        id: payload.id,
        method: payload.params.name,
        params: payload.params.arguments,
      });
    } catch (error) {
      const code = error instanceof ThreadHelmError ? error.code : 'INTERNAL';
      return {
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          content: [
            {
              type: 'text',
              text: `ThreadHelm rejected the coordination request (${code}).`,
            },
          ],
          structuredContent: { code },
          isError: true,
        },
      };
    }
    if (response.error) return response;
    const success: BridgeResponse = {
      jsonrpc: '2.0',
      id: response.id,
      result: {
        content: [{ type: 'text', text: 'ThreadHelm returned a structured coordination result.' }],
        structuredContent: response.result ?? {},
        isError: false,
      },
    };
    if (Buffer.byteLength(JSON.stringify(success), 'utf8') > MAX_FRAME_BYTES) {
      return {
        jsonrpc: '2.0',
        id: response.id,
        error: {
          code: -32000,
          message: 'Coordination result exceeds the bridge frame limit; request a smaller page.',
        },
      };
    }
    return success;
  }

  isConnected(sessionId: string): boolean {
    const info = this.#sessions.get(sessionId);
    return Boolean(info?.connected);
  }

  hasValidCredential(sessionId: string): boolean {
    return this.#sessions.get(sessionId)?.credentialValid === true;
  }

  handleDisconnect(sessionId: string, reasonCode?: string): void {
    const info = this.#sessions.get(sessionId);
    if (info?.credentialValid) {
      info.connected = false;
      info.credentialValid = false;
      this.invalidateLifecycleEvidence(sessionId);
      const handoffs = this.#repo?.markAllQueuedManualActionable({
        recipientSessionId: sessionId,
        reasonCode: 'COORDINATION_BRIDGE_UNAVAILABLE',
        actor: 'threadhelm',
        at: this.#clock().toISOString(),
      });
      for (const handoff of handoffs ?? []) this.#onHandoffChanged?.(handoff.id);
      this.#onEvent?.({
        sessionId,
        capability: 'session_scoped_stdio_mcp',
        connected: false,
        reasonCode: reasonCode ?? 'PIPE_DISCONNECTED',
      });
    }
  }

  invalidateLifecycleEvidence(sessionId: string): void {
    this.#lifecycleNotBefore.set(sessionId, this.#clock().getTime());
  }

  /** Test-hooks-only access; never exposed through renderer IPC or the bridge. */
  testCredential(sessionId: string): string | null {
    return this.#sessions.get(sessionId)?.token ?? null;
  }

  /** Test-hooks-only access; exercises the real named-pipe transport. */
  testPipeName(sessionId: string): string | null {
    return this.#sessions.get(sessionId)?.pipeName ?? null;
  }

  async ingestLifecycleEvidence(
    sessionId: string,
    token: string,
    rawEvidence: unknown,
  ): Promise<LifecycleIngestionResult> {
    const session = this.authenticate(sessionId, token);
    if (!session) {
      throw new ThreadHelmError(
        'UNAUTHORIZED_SENDER',
        'Invalid, expired, or disconnected session credential.',
      );
    }

    const parsed = ProviderLifecycleEvidence.safeParse(rawEvidence);
    if (!parsed.success) {
      return {
        status: 'rejected',
        safePoint: false,
        reasonCode: 'LIFECYCLE_EVIDENCE_INVALID',
        presentation: null,
      };
    }
    const evidence = parsed.data;
    if (evidence.sessionId !== sessionId) {
      return {
        status: 'rejected',
        safePoint: false,
        reasonCode: 'LIFECYCLE_SESSION_MISMATCH',
        presentation: null,
      };
    }
    if (evidence.providerId !== session.providerId) {
      return {
        status: 'rejected',
        safePoint: false,
        reasonCode: 'LIFECYCLE_PROVIDER_MISMATCH',
        presentation: null,
      };
    }
    if (evidence.providerVersion !== session.providerVersion) {
      this.#markOldestQueuedManualActionable(sessionId, 'LIFECYCLE_VERSION_UNPROVED');
      return {
        status: 'manual_only',
        safePoint: false,
        reasonCode: 'LIFECYCLE_VERSION_UNPROVED',
        presentation: null,
      };
    }

    const adapter = this.#adapters.find((candidate) => candidate.id === evidence.providerId);
    const capability = adapter?.capabilities.safePointEvidence;
    if (
      !adapter ||
      !capability ||
      capability.mode !== 'structured_event' ||
      !capability.exactVersions.includes(evidence.providerVersion) ||
      !capability.eventKinds.includes(evidence.eventKind)
    ) {
      this.#markOldestQueuedManualActionable(sessionId, 'LIFECYCLE_VERSION_UNPROVED');
      return {
        status: 'manual_only',
        safePoint: false,
        reasonCode: 'LIFECYCLE_VERSION_UNPROVED',
        presentation: null,
      };
    }

    const occurredAt = Date.parse(evidence.occurredAt);
    const now = this.#clock().getTime();
    const notBefore = this.#lifecycleNotBefore.get(sessionId) ?? Number.NEGATIVE_INFINITY;
    if (
      Number.isNaN(occurredAt) ||
      now - occurredAt > capability.maxAgeMs ||
      occurredAt > now ||
      occurredAt <= notBefore
    ) {
      return {
        status: 'rejected',
        safePoint: false,
        reasonCode: 'LIFECYCLE_EVIDENCE_STALE',
        presentation: null,
      };
    }

    const seen = this.#seenLifecycleEvents.get(sessionId) ?? new Map<string, number>();
    const dedupeKeys = [
      `event:${evidence.providerEventId}`,
      ...(evidence.turnId ? [`turn:${evidence.turnId}`] : []),
    ];
    if (dedupeKeys.some((key) => seen.has(key))) {
      return {
        status: 'duplicate',
        safePoint: false,
        reasonCode: 'LIFECYCLE_EVIDENCE_DUPLICATE',
        presentation: null,
      };
    }
    if (seen.size + dedupeKeys.length > MAX_LIFECYCLE_DEDUPE_KEYS) {
      this.#markOldestQueuedManualActionable(sessionId, 'LIFECYCLE_EVIDENCE_LIMIT');
      return {
        status: 'manual_only',
        safePoint: false,
        reasonCode: 'LIFECYCLE_EVIDENCE_LIMIT',
        presentation: null,
      };
    }
    for (const key of dedupeKeys) seen.set(key, occurredAt);
    this.#seenLifecycleEvents.set(sessionId, seen);

    if (
      !evidence.safePoint ||
      evidence.inputSafety !== 'proved_no_pending_draft' ||
      capability.inputSafety !== 'proved_no_pending_draft' ||
      adapter.capabilities.automaticPresentation !== 'structured_safe_point'
    ) {
      this.#markOldestQueuedManualActionable(sessionId, 'PENDING_DRAFT_UNPROVED');
      return {
        status: 'manual_only',
        safePoint: false,
        reasonCode: 'PENDING_DRAFT_UNPROVED',
        presentation: null,
      };
    }

    const presentation = this.#onLifecycleEvidence
      ? await this.#onLifecycleEvidence(evidence)
      : { presented: false, reasonCode: 'NO_LIFECYCLE_HANDLER' };
    return {
      status: 'accepted',
      safePoint: true,
      reasonCode: presentation.reasonCode,
      presentation,
    };
  }

  #markOldestQueuedManualActionable(sessionId: string, reasonCode: string): void {
    const handoff = this.#repo?.markOldestQueuedManualActionable({
      recipientSessionId: sessionId,
      reasonCode,
      actor: 'provider',
      at: this.#clock().toISOString(),
    });
    if (handoff) this.#onHandoffChanged?.(handoff.id);
  }

  async dispatch(
    sessionId: string,
    token: string,
    request: BridgeRequest,
  ): Promise<BridgeResponse> {
    if (
      !request ||
      !hasOnlyKeys(request as unknown as Record<string, unknown>, [
        'jsonrpc',
        'id',
        'method',
        'params',
      ]) ||
      request.jsonrpc !== '2.0' ||
      (typeof request.id !== 'string' && typeof request.id !== 'number') ||
      typeof request.method !== 'string' ||
      (request.params !== undefined && !isRecord(request.params))
    ) {
      throw new ThreadHelmError('INVALID_REQUEST', 'Invalid JSON-RPC 2.0 request envelope.');
    }

    const payloadString = JSON.stringify(request);
    if (Buffer.byteLength(payloadString, 'utf8') > MAX_FRAME_BYTES) {
      throw new ThreadHelmError('INVALID_REQUEST', 'Request exceeds 32 KiB maximum frame size.');
    }

    const session = this.authenticate(sessionId, token);
    if (!session) {
      throw new ThreadHelmError(
        'UNAUTHORIZED_SENDER',
        'Invalid, expired, or disconnected session credential.',
      );
    }
    if (!session.connected) {
      session.connected = true;
      this.#onEvent?.({
        sessionId,
        capability: 'session_scoped_stdio_mcp',
        connected: true,
        reasonCode: null,
      });
    }

    // Rate limiting: max 20 calls per 60-second window per session
    const now = this.#clock().getTime();
    const timestamps = this.#rateLimits.get(sessionId) ?? [];
    const recent = timestamps.filter((t) => now - t < 60_000);
    if (recent.length >= MAX_MUTATIONS_PER_MINUTE) {
      throw new ThreadHelmError(
        'COORDINATION_LIMIT_REACHED',
        'Bridge rate limit exceeded (max 20 per minute).',
      );
    }
    recent.push(now);
    this.#rateLimits.set(sessionId, recent);

    const params = request.params ?? {};
    const isMutation = request.method !== 'threadhelm_list_pending';
    if (isMutation && this.#inFlightMutations.has(sessionId)) {
      throw new ThreadHelmError(
        'COORDINATION_LIMIT_REACHED',
        'Only one bridge mutation may be in flight for a session.',
      );
    }
    if (isMutation) this.#inFlightMutations.add(sessionId);

    try {
      switch (request.method) {
        case 'threadhelm_list_pending': {
          requireExactParams(params, ['limit']);
          const limit = typeof params.limit === 'number' ? params.limit : 20;
          if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
            throw new ThreadHelmError('INVALID_REQUEST', 'limit must be an integer from 1 to 20.');
          }
          if (this.#repo) {
            const handoffs = this.#repo.listPendingHandoffsForSession(sessionId, limit);
            return {
              jsonrpc: '2.0',
              id: request.id,
              result: { handoffs },
            };
          }
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: { handoffs: [] },
          };
        }

        case 'threadhelm_acknowledge': {
          requireExactParams(params, ['handoffId']);
          const handoffId = HandoffId.parse(params.handoffId);
          if (this.#repo) {
            const handoff = this.#repo.acknowledgeHandoff(
              handoffId,
              sessionId,
              new Date(now).toISOString(),
            );
            return {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                handoffId: handoff.id,
                deliveryState: handoff.deliveryState,
                acknowledgedAt: handoff.acknowledgedAt,
              },
            };
          }
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              handoffId,
              deliveryState: 'acknowledged',
              acknowledgedAt: new Date(now).toISOString(),
            },
          };
        }

        case 'threadhelm_reply': {
          requireExactParams(params, [
            'inReplyTo',
            'kind',
            'purpose',
            'body',
            'responseExpectation',
            'authorityRequired',
            'conflictingInstruction',
          ]);
          const inReplyTo = HandoffId.parse(params.inReplyTo);
          const kind = HandoffKind.parse(params.kind);
          if (kind === 'request') {
            throw new ThreadHelmError(
              'INVALID_REQUEST',
              'Bridge replies cannot create new requests.',
            );
          }
          if (typeof params.purpose !== 'string' || typeof params.body !== 'string') {
            throw new ThreadHelmError('INVALID_REQUEST', 'Reply purpose and body are required.');
          }
          if (typeof params.authorityRequired !== 'boolean') {
            throw new ThreadHelmError('INVALID_REQUEST', 'authorityRequired must be boolean.');
          }
          if (typeof params.conflictingInstruction !== 'boolean') {
            throw new ThreadHelmError('INVALID_REQUEST', 'conflictingInstruction must be boolean.');
          }
          if (
            params.responseExpectation !== 'none' &&
            params.responseExpectation !== 'response_required'
          ) {
            throw new ThreadHelmError('INVALID_REQUEST', 'responseExpectation is invalid.');
          }
          const purpose = sanitizeCoordinationPurpose(params.purpose).normalized;
          const body = sanitizeCoordinationBody(params.body).normalized;
          const authorityRequired = params.authorityRequired;
          const conflictingInstruction = params.conflictingInstruction;
          const responseExpected = params.responseExpectation === 'response_required';
          if (
            (kind === 'query' && !responseExpected) ||
            ((kind === 'completion' || kind === 'refusal' || kind === 'failure') &&
              responseExpected)
          ) {
            throw new ThreadHelmError(
              'INVALID_REQUEST',
              'Reply kind and responseExpectation are inconsistent.',
            );
          }

          if (this.#repo) {
            const handoff = this.#repo.createBridgeReply(
              {
                inReplyToId: inReplyTo,
                senderSessionId: sessionId,
                kind,
                purpose,
                body,
                responseExpected,
                authorityRequired,
                conflictingInstruction,
                createdAt: new Date(now).toISOString(),
              },
              new Date(now).toISOString(),
            );
            this.#onHandoffChanged?.(handoff.id);
            return {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                id: handoff.id,
                conversationId: handoff.conversationId,
                inReplyToId: handoff.inReplyToId,
                senderSessionId: handoff.senderSessionId,
                recipientSessionId: handoff.recipientSessionId,
                deliveryState: handoff.deliveryState,
                holdReasonCode: handoff.holdReasonCode,
              },
            };
          }
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              id: randomUUID(),
              inReplyToId: inReplyTo,
              senderSessionId: sessionId,
              recipientSessionId: '00000000-0000-4000-8000-000000000001',
              deliveryState: authorityRequired || conflictingInstruction ? 'held' : 'queued',
              holdReasonCode: authorityRequired
                ? 'AUTHORITY_REQUIRED'
                : conflictingInstruction
                  ? 'CONFLICTING_INSTRUCTION'
                  : null,
            },
          };
        }

        case 'threadhelm_report_outcome': {
          requireExactParams(params, ['handoffId', 'outcome', 'reasonCode']);
          const handoffId = HandoffId.parse(params.handoffId);
          const outcome = WorkOutcome.parse(params.outcome);
          if (!['completed', 'refused', 'failed'].includes(outcome)) {
            throw new ThreadHelmError('INVALID_REQUEST', 'Bridge outcome is invalid.');
          }
          const reasonCode = ReasonCode.parse(params.reasonCode ?? null);

          if (this.#repo) {
            const handoff = this.#repo.reportWorkOutcome(
              handoffId,
              sessionId,
              outcome,
              reasonCode,
              new Date(now).toISOString(),
            );
            return {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                handoffId: handoff.id,
                workOutcome: handoff.workOutcome,
              },
            };
          }
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              handoffId,
              workOutcome: outcome,
            },
          };
        }

        default:
          throw new ThreadHelmError('INVALID_REQUEST', `Unknown method: ${request.method}`);
      }
    } finally {
      if (isMutation) this.#inFlightMutations.delete(sessionId);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function requireExactParams(params: Record<string, unknown>, allowed: readonly string[]): void {
  if (!hasOnlyKeys(params, allowed)) {
    throw new ThreadHelmError('INVALID_REQUEST', 'Bridge tool parameters contain unknown fields.');
  }
}

function writePrivateJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}
