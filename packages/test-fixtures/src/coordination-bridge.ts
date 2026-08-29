/** Bounded, deterministic protocol fixtures for the session-scoped bridge. */

import { COORDINATION_FIXTURE_IDS } from './coordination.js';

export type BridgeMethod =
  | 'threadhelm_list_pending'
  | 'threadhelm_acknowledge'
  | 'threadhelm_reply'
  | 'threadhelm_report_outcome'
  | 'threadhelm_memory_search'
  | 'threadhelm_memory_get'
  | 'threadhelm_memory_propose_revision'
  | 'threadhelm_mission_inspect'
  | 'threadhelm_work_decompose'
  | 'threadhelm_work_assign'
  | 'threadhelm_work_reassign'
  | 'threadhelm_work_pause'
  | 'threadhelm_mission_complete'
  | 'threadhelm_mission_escalate';

export interface BridgeRequest<M extends BridgeMethod = BridgeMethod> {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly method: M;
  readonly params: Readonly<Record<string, string | number | boolean | null>>;
}

export interface BridgeResponse {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ProviderLifecycleFixture {
  readonly sessionId: string;
  readonly providerId: 'codex-cli' | 'claude-code';
  readonly version: string;
  readonly eventKind: 'turn_started' | 'turn_completed' | 'safe_point' | 'session_ended';
  readonly providerEventId: string;
  readonly timestamp: string;
  readonly safePoint: boolean;
}

export interface ContentFreeBridgeEvent {
  readonly sessionId: string;
  readonly eventKind: 'bridge_changed' | 'handoff_changed' | 'memory_changed' | 'mission_changed';
  readonly subjectId: string;
  readonly sequence: number;
  readonly safeReason: string | null;
  readonly timestamp: string;
}

const request = <M extends BridgeMethod>(
  method: M,
  params: BridgeRequest<M>['params'],
): BridgeRequest<M> => ({
  jsonrpc: '2.0',
  id: 1,
  method,
  params,
});

export const bridgeListPendingRequest = (): BridgeRequest<'threadhelm_list_pending'> =>
  request('threadhelm_list_pending', { limit: 2 });

export const bridgeAcknowledgeRequest = (): BridgeRequest<'threadhelm_acknowledge'> =>
  request('threadhelm_acknowledge', { handoffId: COORDINATION_FIXTURE_IDS.handoff });

export const bridgeReplyRequest = (): BridgeRequest<'threadhelm_reply'> =>
  request('threadhelm_reply', {
    inReplyTo: COORDINATION_FIXTURE_IDS.handoff,
    kind: 'response',
    purpose: 'Fixture response',
    body: 'Fixture response body',
    responseExpectation: 'none',
    authorityRequired: false,
  });

export const bridgeReportOutcomeRequest = (): BridgeRequest<'threadhelm_report_outcome'> =>
  request('threadhelm_report_outcome', {
    handoffId: COORDINATION_FIXTURE_IDS.handoff,
    outcome: 'completed',
    reasonCode: null,
  });

export const providerLifecycleFixture = (
  overrides: Partial<ProviderLifecycleFixture> = {},
): ProviderLifecycleFixture => ({
  sessionId: COORDINATION_FIXTURE_IDS.recipientSession,
  providerId: 'claude-code',
  version: '5.0.0',
  eventKind: 'safe_point',
  providerEventId: 'fixture-event-1',
  timestamp: '2026-01-01T00:00:00.000Z',
  safePoint: true,
  ...overrides,
});

export const bridgeMemorySearchRequest = (): BridgeRequest<'threadhelm_memory_search'> =>
  request('threadhelm_memory_search', { query: 'fixture subject', limit: 2 });

export const bridgeMemoryGetRequest = (): BridgeRequest<'threadhelm_memory_get'> =>
  request('threadhelm_memory_get', { entryId: COORDINATION_FIXTURE_IDS.conversation });

export const bridgeMemoryProposeRevisionRequest =
  (): BridgeRequest<'threadhelm_memory_propose_revision'> =>
    request('threadhelm_memory_propose_revision', {
      kind: 'fact',
      title: 'Fixture subject',
      body: 'Fixture memory body',
      sourceReference: 'fixture-source-1',
      confidence: 0.8,
    });

export const bridgeMissionInspectRequest = (): BridgeRequest<'threadhelm_mission_inspect'> =>
  request('threadhelm_mission_inspect', { missionId: COORDINATION_FIXTURE_IDS.conversation });

export const bridgeWorkDecomposeRequest = (): BridgeRequest<'threadhelm_work_decompose'> =>
  request('threadhelm_work_decompose', {
    missionId: COORDINATION_FIXTURE_IDS.conversation,
    parentWorkItemId: null,
    specification: 'Fixture work item',
    acceptanceEvidence: 'Fixture evidence',
  });

export const bridgeWorkAssignRequest = (): BridgeRequest<'threadhelm_work_assign'> =>
  request('threadhelm_work_assign', {
    missionId: COORDINATION_FIXTURE_IDS.conversation,
    workItemId: COORDINATION_FIXTURE_IDS.handoff,
    sessionId: COORDINATION_FIXTURE_IDS.recipientSession,
  });

export const bridgeMissionEscalateRequest = (): BridgeRequest<'threadhelm_mission_escalate'> =>
  request('threadhelm_mission_escalate', {
    missionId: COORDINATION_FIXTURE_IDS.conversation,
    reasonCode: 'MISSION_AUTHORITY_REQUIRED',
  });

/** Renderer-safe event fixture; no purpose, body, objective, or rationale. */
export const contentFreeBridgeEventFixture = (
  overrides: Partial<ContentFreeBridgeEvent> = {},
): ContentFreeBridgeEvent => ({
  sessionId: COORDINATION_FIXTURE_IDS.recipientSession,
  eventKind: 'handoff_changed',
  subjectId: COORDINATION_FIXTURE_IDS.handoff,
  sequence: 1,
  safeReason: null,
  timestamp: '2026-01-01T00:00:00.000Z',
  ...overrides,
});
