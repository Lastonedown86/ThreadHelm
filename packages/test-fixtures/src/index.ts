/// <reference types="node" />
/**
 * Deterministic fake terminal agents (T023). The executable is a plain
 * CommonJS script so any Node or Electron runtime can spawn it unbuilt.
 */

export {
  FAKE_AGENT_PATH,
  fakeAgentLaunch,
  resolveFixtureRuntime,
  type FakeAgentMode,
} from './runtime.js';

export { fixtureAdapter, type FixtureAdapterOptions } from './fixture-adapter.js';
export {
  COORDINATION_FIXTURE_IDS,
  COORDINATION_PARTICIPANTS,
  coordinationEventFixture,
  createCoordinationClock,
  createCoordinationUuidFactory,
  type CoordinationEventFixture,
  type CoordinationParticipantFixture,
} from './coordination.js';
export {
  CHANGED_AFTER_PREVIEW_EDITED_FIXTURE,
  CHANGED_AFTER_PREVIEW_ORIGINAL_FIXTURE,
  DUPLICATE_HIRE_MANIFEST_FIXTURE,
  EXCESSIVE_BOUND_HIRE_MANIFEST_FIXTURE,
  HIRE_MANIFEST_SPEC,
  HOSTILE_TEXT_HIRE_MANIFEST_FIXTURE,
  MALFORMED_HIRE_MANIFEST_TEXT_FIXTURES,
  MARVEL_ROSTER_FIXTURES,
  MAX_HIRE_MANIFEST_TOKEN_CAP,
  REVISED_HIRE_MANIFEST_FIXTURE,
  UNAVAILABLE_MODEL_HIRE_MANIFEST_FIXTURE,
  hireManifestDigest,
  writeHireManifestFile,
  type HireManifestFixture,
  type HireManifestFixtureFields,
} from './agent-profiles.js';
export { GENERIC_AGENT_TEMPLATE_FIXTURES, type AgentTemplateFixture } from './agent-templates.js';
export {
  bridgeAcknowledgeRequest,
  bridgeListPendingRequest,
  bridgeMemoryGetRequest,
  bridgeMemoryProposeRevisionRequest,
  bridgeMemorySearchRequest,
  bridgeMissionEscalateRequest,
  bridgeMissionInspectRequest,
  bridgeReplyRequest,
  bridgeReportOutcomeRequest,
  bridgeWorkAssignRequest,
  bridgeWorkDecomposeRequest,
  contentFreeBridgeEventFixture,
  providerLifecycleFixture,
  type BridgeMethod,
  type BridgeRequest,
  type BridgeResponse,
  type ContentFreeBridgeEvent,
  type ProviderLifecycleFixture,
} from './coordination-bridge.js';
export * from './supervisor.js';
