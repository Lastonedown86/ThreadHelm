/**
 * Shared contracts (T009): Zod schemas, operation/event names, host protocol,
 * stream frames, stable error codes, and the tuning constants every process
 * agrees on. Nothing here touches Electron, the filesystem, or a database.
 *
 * Source of truth: specs/001-local-agent-workspace/contracts/*.md
 */

import { z } from 'zod';
import { Bytes, Uuid } from './primitives.js';
export { Bytes, Uuid } from './primitives.js';
import { MAX_COLUMNS, MAX_ROWS, MAX_INPUT_BYTES } from './limits.js';
export * from './limits.js';
export { OutputFrame, OutputAck, OutputTruncated, StreamFrame } from './stream.js';

import type { EventName, OperationName } from './protocol.js';
import { isSafeAuthoredText } from './content-text.js';
export { isSafeAuthoredText } from './content-text.js';
export {
  eventNames,
  operationNames,
  STREAM_PORT_CHANNEL,
  type EventName,
  type OperationName,
} from './protocol.js';

// ---------------------------------------------------------------------------
// Constants (configuration, not user customization — research.md Decision 5)
// ---------------------------------------------------------------------------

export const PROTOCOL_VERSION = 1;
/** Candidate, preview, stop, and force-stop tokens all expire after this. */
export const TOKEN_TTL_MS = 120_000;
/** Bounded grace period for a clean stop before force stop is offered. */
export const STOP_GRACE_MS = 15_000;
/** How long an interrupt is observed before it is reported unresponsive. */
export const INTERRUPT_OBSERVE_MS = 5_000;
/** Bounded provider probe budget. */
export const PROBE_TIMEOUT_MS = 10_000;
/** Ceiling on an agent manifest's requested token budget (agent-profiles.md). */
export const MAX_TOKEN_CAP = 2_000_000;
/** Bounded length for reviewed free-text manifest fields (goal, description). */
export const MAX_GOAL_LENGTH = 4_000;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const ProviderId = z.enum(['codex-cli', 'claude-code']);
export type ProviderId = z.infer<typeof ProviderId>;

/** Portable agent-provider labels are data, not runtime adapter identifiers. */
export const ProfileProviderId = z.enum(['claude', 'codex', 'claude-code', 'codex-cli']);
export type ProfileProviderId = z.infer<typeof ProfileProviderId>;

export const LifecycleState = z.enum([
  'starting',
  'running',
  'interrupting',
  'stopping',
  'stopped',
  'failed',
  'recovery_required',
]);
export type LifecycleState = z.infer<typeof LifecycleState>;

export const ActivityState = z.enum(['unknown', 'working', 'idle', 'awaiting_user']);
export type ActivityState = z.infer<typeof ActivityState>;

export const Availability = z.enum([
  'available',
  'missing',
  'unsupported',
  'unauthenticated',
  'error',
]);
export type Availability = z.infer<typeof Availability>;

export const Authentication = z.enum(['authenticated', 'unauthenticated', 'unknown']);
export type Authentication = z.infer<typeof Authentication>;

export const AccessMode = z.enum(['write_capable']);
export type AccessMode = z.infer<typeof AccessMode>;

export const StopKind = z.enum(['clean', 'interrupted_exit', 'forced', 'crash_cleanup']);
export type StopKind = z.infer<typeof StopKind>;

export const EventKind = z.enum([
  'launch_requested',
  'launched',
  'state_changed',
  'interrupt_requested',
  'stop_requested',
  'force_stop_requested',
  'output_truncated',
  'reconciled',
  'recovery_resolved',
]);
export type EventKind = z.infer<typeof EventKind>;

export const Actor = z.enum(['user', 'threadhelm', 'provider', 'windows']);
export type Actor = z.infer<typeof Actor>;

export const RecoveryClassification = z.enum([
  'interrupted_start',
  'unexpected_shutdown',
  'incomplete_stop',
  'storage_repair',
  'observation_lost',
]);
export type RecoveryClassification = z.infer<typeof RecoveryClassification>;

export const RecoveryResolution = z.enum(['dismissed', 'superseded_by_new_session']);
export type RecoveryResolution = z.infer<typeof RecoveryResolution>;

export const DriveType = z.enum(['fixed_local']);
export type DriveType = z.infer<typeof DriveType>;

export const InterruptOutcome = z.enum(['returned_to_interactive', 'exited', 'unresponsive']);
export type InterruptOutcome = z.infer<typeof InterruptOutcome>;

export const PowerEvent = z.enum(['lock', 'suspend', 'resume', 'unlock']);
export type PowerEvent = z.infer<typeof PowerEvent>;

// Coordination state vocabularies are deliberately provider-neutral. They are
// shared here so the database, main process, bridge, and renderer cannot drift.
export const ConversationState = z.enum(['open', 'paused', 'resolved', 'closed']);
export type ConversationState = z.infer<typeof ConversationState>;

export const HandoffKind = z.enum([
  'request',
  'query',
  'proposal',
  'inform',
  'response',
  'completion',
  'refusal',
  'failure',
]);
export type HandoffKind = z.infer<typeof HandoffKind>;

export const HandoffOrigin = z.enum(['user', 'provider_bridge', 'threadhelm']);
export type HandoffOrigin = z.infer<typeof HandoffOrigin>;

export const DeliveryState = z.enum([
  'queued',
  'held',
  'manual_actionable',
  'presenting',
  'delivered',
  'acknowledged',
  'failed',
  'cancelled',
]);
export type DeliveryState = z.infer<typeof DeliveryState>;

export const DeliveryAttemptState = z.enum([
  'prepared',
  'dispatching',
  'applied',
  'failed_before_write',
  'unknown',
]);
export type DeliveryAttemptState = z.infer<typeof DeliveryAttemptState>;

export const WorkOutcome = z.enum([
  'pending',
  'completed',
  'refused',
  'failed',
  'cancelled',
  'escalated',
]);
export type WorkOutcome = z.infer<typeof WorkOutcome>;

export const EscalationKind = z.enum([
  'reply_depth',
  'equivalent_message_loop',
  'repeated_delivery_failure',
  'conflicting_instruction',
  'authority_required',
  'target_ambiguous',
  'storage_limit',
  'unknown_delivery',
]);
export type EscalationKind = z.infer<typeof EscalationKind>;

export const EscalationState = z.enum(['open', 'continued', 'redirected', 'closed']);
export type EscalationState = z.infer<typeof EscalationState>;

export const MemoryKind = z.enum(['fact', 'decision', 'constraint', 'artifact', 'lesson']);
export type MemoryKind = z.infer<typeof MemoryKind>;

export const MemoryStatus = z.enum([
  'active',
  'contested',
  'superseded',
  'retracted',
  'expired',
  'deleted',
]);
export type MemoryStatus = z.infer<typeof MemoryStatus>;

export const MemoryConfidence = z.enum(['unknown', 'low', 'medium', 'high']);
export type MemoryConfidence = z.infer<typeof MemoryConfidence>;

export const MemoryConflictState = z.enum(['open', 'resolved']);
export type MemoryConflictState = z.infer<typeof MemoryConflictState>;

// Agent profiles are reviewed portable manifests imported into a local
// roster. Import is never equivalent to launching or authorizing an agent;
// display name and capability labels are inert presentation data, never
// identity or authority (contracts/agent-profiles.md).
export const ProfileState = z.enum(['active', 'disabled', 'deleted']);
export type ProfileState = z.infer<typeof ProfileState>;

export const ProfileCompatibility = z.enum([
  'compatible',
  'incompatible_provider',
  'incompatible_model',
  'unavailable',
]);
export type ProfileCompatibility = z.infer<typeof ProfileCompatibility>;

export const ProfileEventKind = z.enum(['imported', 'enabled', 'disabled', 'deleted']);
export type ProfileEventKind = z.infer<typeof ProfileEventKind>;

export const CoordinationEventKind = z.enum([
  'created',
  'queued',
  'held',
  'presentation_requested',
  'dispatching',
  'delivered',
  'acknowledged',
  'outcome_recorded',
  'paused',
  'resumed',
  'retargeted',
  'cancelled',
  'content_deleted',
  'recovered',
]);
export type CoordinationEventKind = z.infer<typeof CoordinationEventKind>;

// ---------------------------------------------------------------------------
// Error codes and the one error type that crosses process boundaries
// ---------------------------------------------------------------------------

export const ErrorCode = z.enum([
  // workspaces
  'SELECTION_CANCELLED',
  'WORKSPACE_UNSUPPORTED',
  'WORKSPACE_AMBIGUOUS',
  'WORKSPACE_NOT_FOUND',
  'WORKSPACE_CHANGED',
  'WORKSPACE_ACTIVE',
  'CANDIDATE_EXPIRED',
  // providers
  'PROBE_FAILED',
  'PROVIDER_UNAVAILABLE',
  // launch
  'WRITE_LEASE_HELD',
  'PREVIEW_EXPIRED',
  'CONFIRMATION_REQUIRED',
  'SUPERVISION_FAILED',
  // sessions and control
  'SESSION_NOT_FOUND',
  'INVALID_STATE',
  'CONFIRMATION_EXPIRED',
  'TARGET_CHANGED',
  'FORCE_NOT_AVAILABLE',
  'NOT_SELECTED',
  'INPUT_BLOCKED',
  'BACKPRESSURE',
  'INVALID_DIMENSIONS',
  'STREAM_VIOLATION',
  // recovery and storage
  'INVALID_RESOLUTION',
  'RECORD_NOT_FOUND',
  'STORAGE_UNAVAILABLE',
  'STORAGE_DEGRADED',
  // coordination
  'CONVERSATION_NOT_FOUND',
  'HANDOFF_NOT_FOUND',
  'ESCALATION_NOT_FOUND',
  'COORDINATION_CONTENT_INVALID',
  'COORDINATION_LIMIT_REACHED',
  'COORDINATION_CAUSALITY_INVALID',
  'COORDINATION_TARGET_CHANGED',
  'COORDINATION_TARGET_NOT_SELECTED',
  'COORDINATION_NOT_ELIGIBLE',
  'COORDINATION_ATTEMPT_ACTIVE',
  'COORDINATION_DELIVERY_UNKNOWN',
  'COORDINATION_BRIDGE_UNAVAILABLE',
  'COORDINATION_AUTHORITY_REQUIRED',
  'COORDINATION_CLOSED',
  // shared memory
  'MEMORY_NOT_FOUND',
  'MEMORY_SCOPE_UNAUTHORIZED',
  'MEMORY_CONTENT_INVALID',
  'MEMORY_SOURCE_INVALID',
  'MEMORY_QUOTA_REACHED',
  'MEMORY_CONFLICT_OPEN',
  'MEMORY_REVISION_STALE',
  'MEMORY_CONTENT_DELETED',
  // agent profiles
  'PROFILE_SCHEMA_INVALID',
  'PROFILE_OVERSIZED',
  'PROFILE_UNREADABLE',
  'PROFILE_TOKEN_EXPIRED',
  'PROFILE_DIGEST_CHANGED',
  'PROFILE_LIMIT_REACHED',
  'PROFILE_NOT_FOUND',
  'PROFILE_INCOMPATIBLE',
  'PROFILE_REVISION_STALE',
  'PROFILE_MISSION_PINNED',
  'MISSION_NOT_FOUND',
  'MISSION_ENVELOPE_STALE',
  'MISSION_BOUND_REACHED',
  'SUPERVISOR_NOT_BOUND',
  'SUPERVISOR_ROLE_REQUIRED',
  'WORK_ITEM_NOT_FOUND',
  'WORK_DAG_INVALID',
  'WORK_LEASE_CONFLICT',
  'WORK_ATTEMPT_UNKNOWN',
  'WORKER_AUTOSTART_NOT_AUTHORIZED',
  'WORKER_AUTOSTART_PREFLIGHT_FAILED',
  'SUPERVISOR_DECISION_LOOP',
  'MISSION_AUTHORITY_REQUIRED',
  // mission composer drafts
  'MISSION_DRAFT_NOT_FOUND',
  'MISSION_DRAFT_STALE',
  'MISSION_DRAFT_LIMIT',
  'MISSION_DRAFT_SAVE_FAILED',
  'MISSION_DRAFT_DISCARD_STALE',
  'MISSION_CONFIRMATION_EXPIRED',
  // agent templates and wizard drafts
  'TEMPLATE_VARIABLE_UNRESOLVED',
  'TEMPLATE_DRAFT_INCOMPLETE',
  // application and boundary
  'ACTIVE_SESSIONS',
  'INVALID_REQUEST',
  'UNAUTHORIZED_SENDER',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Stable code plus a sanitized message. Never carries raw output or stacks. */
export class ThreadHelmError extends Error {
  readonly code: ErrorCode;
  readonly details: Readonly<Record<string, string | number | boolean>>;

  constructor(
    code: ErrorCode,
    message?: string,
    details: Record<string, string | number | boolean> = {},
  ) {
    super(message ?? code);
    this.name = 'ThreadHelmError';
    this.code = code;
    this.details = details;
  }
}

/** Wire form of an error crossing preload → renderer. */
export const SerializedError = z.object({
  code: ErrorCode,
  message: z.string().max(500),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});
export type SerializedError = z.infer<typeof SerializedError>;

export function serializeError(error: unknown): SerializedError {
  if (error instanceof ThreadHelmError) {
    return { code: error.code, message: error.message, details: { ...error.details } };
  }
  return { code: 'INTERNAL', message: 'An internal error occurred.', details: {} };
}

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const ConversationId = z.uuid().brand<'ConversationId'>();
export type ConversationId = z.infer<typeof ConversationId>;
export const HandoffId = z.uuid().brand<'HandoffId'>();
export type HandoffId = z.infer<typeof HandoffId>;
export const DeliveryAttemptId = z.uuid().brand<'DeliveryAttemptId'>();
export type DeliveryAttemptId = z.infer<typeof DeliveryAttemptId>;
export const CoordinationEventId = z.uuid().brand<'CoordinationEventId'>();
export type CoordinationEventId = z.infer<typeof CoordinationEventId>;
/** Stable roster identity. Never the mutable display name/persona. */
export const ProfileId = z.uuid().brand<'ProfileId'>();
export type ProfileId = z.infer<typeof ProfileId>;
export const ProfileRevisionId = z.uuid().brand<'ProfileRevisionId'>();
export type ProfileRevisionId = z.infer<typeof ProfileRevisionId>;
export const Timestamp = z.iso.datetime();
export const OpaqueToken = z.string().min(16).max(128);
export const SafeSummary = z.string().max(300);
export const ReasonCode = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{2,63}$/)
  .nullable();

/** Build an object schema that fails closed on fields absent from its contract. */
export function strictObject<const Shape extends z.ZodRawShape>(shape: Shape) {
  return z.strictObject(shape);
}

/** Per-process reasoning controls. `null` means preserve the provider CLI default. */
export const LaunchEffort = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
export type LaunchEffort = z.infer<typeof LaunchEffort>;

export const LaunchRuntimeSelection = strictObject({
  model: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, 'invalid provider model identifier')
    .nullable(),
  effort: LaunchEffort.nullable(),
});
export type LaunchRuntimeSelection = z.infer<typeof LaunchRuntimeSelection>;

export const LaunchWorkType = z.enum(['general', 'test_authoring', 'failure_analysis']);
export type LaunchWorkType = z.infer<typeof LaunchWorkType>;

export const LaunchRuntimeSourceKind = z.enum([
  'one_run',
  'profile_revision',
  'task_type_policy',
  'project_policy',
  'cli_default',
]);
export type LaunchRuntimeSourceKind = z.infer<typeof LaunchRuntimeSourceKind>;

export const LaunchRuntimeSource = strictObject({
  kind: LaunchRuntimeSourceKind,
  /** Stable persisted policy/revision identity; absent for one-run and CLI-default values. */
  reference: z.string().min(1).max(200).nullable(),
});
export type LaunchRuntimeSource = z.infer<typeof LaunchRuntimeSource>;

export const LaunchRuntimeRecommendation = strictObject({
  model: z.string().min(1).max(128),
  effort: z.enum(['low', 'medium']),
  reason: z.string().min(1).max(300),
});
export type LaunchRuntimeRecommendation = z.infer<typeof LaunchRuntimeRecommendation>;

export const LaunchRuntimeResolution = strictObject({
  runtimeSelection: LaunchRuntimeSelection,
  modelSource: LaunchRuntimeSource,
  effortSource: LaunchRuntimeSource,
  workType: LaunchWorkType,
  recommendation: LaunchRuntimeRecommendation.nullable(),
  requiresEscalationReason: z.boolean(),
  escalationReason: z.string().trim().min(20).max(500).nullable(),
  disposition: z.enum(['ready', 'held']),
  reasonCode: z.literal('RUNTIME_ESCALATION_REASON_REQUIRED').nullable(),
});
export type LaunchRuntimeResolution = z.infer<typeof LaunchRuntimeResolution>;

/** Main-owned launch policy. Persona/profile/template text can never populate this value. */
export const RuntimePermissionPolicy = z.enum([
  'manual',
  'auto',
  'bounded_allowlist',
  'break_glass_bypass',
]);
export type RuntimePermissionPolicy = z.infer<typeof RuntimePermissionPolicy>;

export const RuntimePermissionSource = z.enum([
  'one_run',
  'task_policy',
  'project_policy',
  'provider_default',
]);
export type RuntimePermissionSource = z.infer<typeof RuntimePermissionSource>;

const BoundedPermissionTool = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_*.:/ -]+$/, 'invalid bounded provider tool pattern');

/** Direct renderer choice. `null` means resolve from main-owned policy/defaults. */
export const LaunchPermissionSelection = strictObject({
  policy: RuntimePermissionPolicy.nullable(),
  boundedAllowlist: z.array(BoundedPermissionTool).max(32),
}).superRefine((value, ctx) => {
  if (value.policy === 'bounded_allowlist' && value.boundedAllowlist.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['boundedAllowlist'], message: 'allowlist is required' });
  }
  if (value.policy !== 'bounded_allowlist' && value.boundedAllowlist.length !== 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['boundedAllowlist'],
      message: 'allowlist is valid only for bounded_allowlist',
    });
  }
});
export type LaunchPermissionSelection = z.infer<typeof LaunchPermissionSelection>;

/** Exact, time-bounded proof captured outside persona/profile state. */
export const PermissionCapabilityEvidence = strictObject({
  providerId: ProviderId,
  providerVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  model: z.string().min(1).max(128).nullable(),
  providerSurface: z.string().min(1).max(80),
  organizationPolicy: z.enum(['allowed', 'denied', 'unknown']),
  supportedPolicies: z.array(RuntimePermissionPolicy).min(1).max(4),
  observedAt: Timestamp,
  expiresAt: Timestamp,
});
export type PermissionCapabilityEvidence = z.infer<typeof PermissionCapabilityEvidence>;

/** Break-glass proof is volatile and valid for exactly one direct launch. */
export const BreakGlassIsolationProof = strictObject({
  isolationKind: z.enum(['container', 'vm', 'provider_sandbox']),
  freshRuntime: z.boolean(),
  childProcessContainment: z.boolean(),
  disposableWorkspaceOnlyWrites: z.boolean(),
  unrelatedCredentialsExcluded: z.boolean(),
  unrelatedEnvironmentExcluded: z.boolean(),
  networkDestinations: z.array(z.string().min(1).max(253)).min(1).max(16),
  processCleanupVerified: z.boolean(),
  workspaceCleanupVerified: z.boolean(),
  configCleanupVerified: z.boolean(),
});
export type BreakGlassIsolationProof = z.infer<typeof BreakGlassIsolationProof>;

export const ProviderPermissionMapping = z.enum([
  'provider_default',
  'claude_manual',
  'claude_auto',
  'claude_bounded_allowlist',
  'claude_bypass',
  'codex_manual',
  'codex_full_auto',
  'codex_bypass',
]);
export type ProviderPermissionMapping = z.infer<typeof ProviderPermissionMapping>;

export const PermissionFallbackAction = z.enum(['manual', 'bounded_allowlist']);
export type PermissionFallbackAction = z.infer<typeof PermissionFallbackAction>;

export const LaunchPermissionResolution = strictObject({
  policy: RuntimePermissionPolicy,
  source: RuntimePermissionSource,
  disposition: z.enum(['ready', 'held']),
  providerMapping: ProviderPermissionMapping.nullable(),
  reasonCode: ReasonCode,
  fallbackActions: z.array(PermissionFallbackAction).max(2),
  capabilityEvidence: PermissionCapabilityEvidence.nullable(),
  boundedAllowlist: z.array(BoundedPermissionTool).max(32),
});
export type LaunchPermissionResolution = z.infer<typeof LaunchPermissionResolution>;

/** Independent main-owned limits; permission mode never replaces these controls. */
export const ProviderExecutionBounds = strictObject({
  maxElapsedMs: z
    .number()
    .int()
    .min(1_000)
    .max(24 * 60 * 60_000),
  maxTurns: z.number().int().min(1).max(1_024),
  maxNoProgressMs: z
    .number()
    .int()
    .min(1_000)
    .max(60 * 60_000),
  maxOutputBytes: z
    .number()
    .int()
    .min(1_024)
    .max(64 * 1024 * 1024),
  maxConcurrentProcesses: z.number().int().min(1).max(16),
});
export type ProviderExecutionBounds = z.infer<typeof ProviderExecutionBounds>;

export const ProviderProgressEvent = strictObject({
  attemptId: Uuid,
  sessionId: Uuid,
  kind: z.enum(['started', 'turn_completed', 'tool_activity', 'heartbeat']),
  turnCount: z.number().int().min(0),
  elapsedMs: z.number().int().min(0),
  outputBytes: z.number().int().min(0),
  activeProcessCount: z.number().int().min(0),
  observedAt: Timestamp,
});
export type ProviderProgressEvent = z.infer<typeof ProviderProgressEvent>;

export const ProviderCancelRequest = strictObject({
  attemptId: Uuid,
  sessionId: Uuid,
  reason: z.enum(['user', 'elapsed_bound', 'turn_bound', 'no_progress', 'resource_bound']),
});
export type ProviderCancelRequest = z.infer<typeof ProviderCancelRequest>;

export const ProviderAttemptOutcomeKind = z.enum([
  'completed',
  'refused',
  'permission_denied',
  'classifier_failed',
  'timed_out',
  'cancelled',
  'no_progress',
  'budget_exhausted',
  'unknown',
]);
export type ProviderAttemptOutcomeKind = z.infer<typeof ProviderAttemptOutcomeKind>;

export const ProviderAttemptOutcome = strictObject({
  attemptId: Uuid,
  sessionId: Uuid,
  kind: ProviderAttemptOutcomeKind,
  retryDisposition: z.enum(['known_safe', 'user_action_required', 'prohibited']),
  reasonCode: ReasonCode,
  occurredAt: Timestamp,
});
export type ProviderAttemptOutcome = z.infer<typeof ProviderAttemptOutcome>;

export const CoordinationCursorToken = z.string().min(1).max(512);
export type CoordinationCursorToken = z.infer<typeof CoordinationCursorToken>;

/** Decoded keyset cursor. Encoding/verification remains a main-process concern. */
export const BoundedCoordinationCursor = strictObject({
  occurredAt: Timestamp,
  id: Uuid,
  sequence: z.number().int().min(1),
});
export type BoundedCoordinationCursor = z.infer<typeof BoundedCoordinationCursor>;

/**
 * Provider lifecycle evidence is deliberately content-free. Raw hook input,
 * transcript paths, assistant text, tool payloads, and provider errors are not
 * part of this strict schema and therefore fail closed at the main boundary.
 */
export const ProviderLifecycleEventKind = z.enum(['turn_completed', 'safe_point', 'session_ended']);
export type ProviderLifecycleEventKind = z.infer<typeof ProviderLifecycleEventKind>;

export const ProviderInputSafety = z.enum(['unknown', 'proved_no_pending_draft']);
export type ProviderInputSafety = z.infer<typeof ProviderInputSafety>;

export const ProviderLifecycleEvidence = strictObject({
  sessionId: Uuid,
  providerId: ProviderId,
  providerVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  eventKind: ProviderLifecycleEventKind,
  providerEventId: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[A-Za-z0-9._:-]+$/),
  turnId: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[A-Za-z0-9._:-]+$/)
    .nullable(),
  occurredAt: Timestamp,
  safePoint: z.boolean(),
  inputSafety: ProviderInputSafety,
});
export type ProviderLifecycleEvidence = z.infer<typeof ProviderLifecycleEvidence>;

export function boundedPageRequest(maximum: number) {
  if (!Number.isInteger(maximum) || maximum < 1) {
    throw new RangeError('maximum must be a positive integer');
  }
  return strictObject({
    cursor: CoordinationCursorToken.optional(),
    limit: z.number().int().min(1).max(maximum),
  });
}

export const CoordinationErrorCode = z.enum([
  'CONVERSATION_NOT_FOUND',
  'HANDOFF_NOT_FOUND',
  'ESCALATION_NOT_FOUND',
  'COORDINATION_CONTENT_INVALID',
  'COORDINATION_LIMIT_REACHED',
  'COORDINATION_CAUSALITY_INVALID',
  'COORDINATION_TARGET_CHANGED',
  'COORDINATION_TARGET_NOT_SELECTED',
  'COORDINATION_NOT_ELIGIBLE',
  'COORDINATION_ATTEMPT_ACTIVE',
  'COORDINATION_DELIVERY_UNKNOWN',
  'COORDINATION_BRIDGE_UNAVAILABLE',
  'COORDINATION_AUTHORITY_REQUIRED',
  'COORDINATION_CLOSED',
]);
export type CoordinationErrorCode = z.infer<typeof CoordinationErrorCode>;

export const CoordinationSafeError = strictObject({
  code: CoordinationErrorCode,
  message: z.string().min(1).max(300),
  reasonCode: ReasonCode,
});
export type CoordinationSafeError = z.infer<typeof CoordinationSafeError>;

/** Content-free main-to-renderer event shared by the coordination views. */
export const CoordinationEventEnvelope = strictObject({
  type: z.literal('coordination.handoffChanged'),
  eventId: CoordinationEventId,
  conversationId: ConversationId,
  handoffId: HandoffId.nullable(),
  sequence: z.number().int().min(1),
  kind: CoordinationEventKind,
  reasonCode: ReasonCode,
  safeSummary: z.string().min(1).max(300),
  occurredAt: Timestamp,
});
export type CoordinationEventEnvelope = z.infer<typeof CoordinationEventEnvelope>;

// US1 named schemas. These remain independent of Electron so both the router
// and provider-neutral tests validate the same exact addressed-handoff shape.
export const PreviewHandoffRequest = strictObject({
  sourceSessionId: Uuid,
  recipientSessionId: Uuid,
  kind: HandoffKind,
  purpose: z.string().min(1).max(320),
  body: z.string().min(1).max(16_384),
  responseExpected: z.boolean(),
  conversationId: ConversationId.optional(),
  inReplyToId: HandoffId.optional(),
}).refine((value) => value.sourceSessionId !== value.recipientSessionId, {
  message: 'sender and recipient must differ',
  path: ['recipientSessionId'],
});
export type PreviewHandoffRequest = z.infer<typeof PreviewHandoffRequest>;

export const ConfirmHandoffRequest = strictObject({
  previewToken: OpaqueToken,
  persistenceConfirmation: z.literal(true),
});
export type ConfirmHandoffRequest = z.infer<typeof ConfirmHandoffRequest>;

export const CancelHandoffRequest = strictObject({ handoffId: HandoffId });
export type CancelHandoffRequest = z.infer<typeof CancelHandoffRequest>;

export const PreviewRetargetRequest = strictObject({
  handoffId: HandoffId,
  recipientSessionId: Uuid,
});
export type PreviewRetargetRequest = z.infer<typeof PreviewRetargetRequest>;

export const ConfirmRetargetRequest = strictObject({
  retargetToken: OpaqueToken,
  retargetConfirmation: z.literal(true),
});
export type ConfirmRetargetRequest = z.infer<typeof ConfirmRetargetRequest>;

export const ConfirmPresentationRequest = strictObject({
  presentationToken: OpaqueToken,
  submitConfirmation: z.literal(true),
});
export type ConfirmPresentationRequest = z.infer<typeof ConfirmPresentationRequest>;

export const HandoffPreviewView = strictObject({
  previewToken: OpaqueToken,
  sourceSessionId: Uuid,
  recipientSessionId: Uuid,
  sourceWorkspaceId: Uuid,
  recipientWorkspaceId: Uuid,
  kind: HandoffKind,
  normalizedPurpose: z.string().min(1).max(320),
  normalizedBody: z.string().min(1).max(16_384),
  responseExpected: z.boolean(),
  retainedContentBytes: z
    .number()
    .int()
    .min(0)
    .max(64 * 1024 * 1024),
  persistenceDisclosure: z.string().min(1).max(500),
  expiresAt: Timestamp,
});
export type HandoffPreviewView = z.infer<typeof HandoffPreviewView>;

export const PresentationDisclosureView = strictObject({
  presentationToken: OpaqueToken,
  handoffId: HandoffId,
  recipientSessionId: Uuid,
  recipientWorkspaceId: Uuid,
  selectedSessionId: Uuid,
  lifecycleState: LifecycleState,
  activityState: ActivityState,
  activityEvidenceKind: z.string().min(1).max(100),
  activityObservedAt: Timestamp.nullable(),
  terminalEnvelope: z.string().min(1).max(MAX_INPUT_BYTES),
  manualRisk: z.string().min(1).max(500),
  expiresAt: Timestamp,
});
export type PresentationDisclosureView = z.infer<typeof PresentationDisclosureView>;

export const HandoffView = strictObject({
  id: HandoffId,
  conversationId: ConversationId,
  inReplyToId: HandoffId.nullable(),
  senderSessionId: Uuid,
  recipientSessionId: Uuid,
  origin: HandoffOrigin,
  kind: HandoffKind,
  responseExpected: z.boolean(),
  deliveryState: DeliveryState,
  workOutcome: WorkOutcome,
  holdReasonCode: ReasonCode,
  purpose: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deliveredAt: Timestamp.nullable(),
  acknowledgedAt: Timestamp.nullable(),
});
export type HandoffView = z.infer<typeof HandoffView>;

/** Bounded US1 mailbox surface. Rich conversation pagination begins in US2. */
export const HandoffSummaryView = HandoffView.omit({ purpose: true, body: true });
export type HandoffSummaryView = z.infer<typeof HandoffSummaryView>;

export const HandoffListView = strictObject({
  handoffs: z.array(HandoffSummaryView).max(100),
  storageDegraded: z.boolean(),
});
export type HandoffListView = z.infer<typeof HandoffListView>;

export const DeliveryAttemptView = strictObject({
  id: DeliveryAttemptId,
  handoffId: HandoffId,
  attemptNumber: z.number().int().min(1),
  recipientSessionId: Uuid,
  state: DeliveryAttemptState,
  evidenceKind: z.string().min(1).max(100),
  reasonCode: ReasonCode,
  controlSequence: z.number().int().min(1).nullable(),
  createdAt: Timestamp,
  submittedAt: Timestamp.nullable(),
  completedAt: Timestamp.nullable(),
});
export type DeliveryAttemptView = z.infer<typeof DeliveryAttemptView>;

export const RetargetDisclosureView = strictObject({
  retargetToken: OpaqueToken,
  handoffId: HandoffId,
  currentRecipientSessionId: Uuid,
  recipientSessionId: Uuid,
  recipientWorkspaceId: Uuid,
  expiresAt: Timestamp,
});
export type RetargetDisclosureView = z.infer<typeof RetargetDisclosureView>;

export const ConversationSummaryView = strictObject({
  id: ConversationId,
  state: ConversationState,
  rootHandoffId: HandoffId.nullable(),
  participantSessionIds: z.array(Uuid).min(1).max(2),
  handoffCount: z.number().int().min(0),
  unresolvedCount: z.number().int().min(0),
  autoContinueEnabled: z.boolean(),
  pauseReasonCode: ReasonCode.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  resolvedAt: Timestamp.nullable(),
  closedAt: Timestamp.nullable(),
  contentDeletedAt: Timestamp.nullable(),
});
export type ConversationSummaryView = z.infer<typeof ConversationSummaryView>;

export const ConversationListView = strictObject({
  conversations: z.array(ConversationSummaryView).max(100),
  nextCursor: z.string().nullable(),
  storageDegraded: z.boolean(),
});
export type ConversationListView = z.infer<typeof ConversationListView>;

export const ConversationDetailView = strictObject({
  summary: ConversationSummaryView,
  handoffs: z.array(HandoffView).max(128),
  events: z.array(CoordinationEventEnvelope).max(256),
  openEscalation: z.lazy(() => EscalationView).nullable(),
  nextCursor: z.string().nullable(),
});
export type ConversationDetailView = z.infer<typeof ConversationDetailView>;

export const DeleteContentDisclosureView = strictObject({
  deletionToken: OpaqueToken,
  conversationId: ConversationId,
  handoffCount: z.number().int().min(0),
  retainedContentBytes: z.number().int().min(0),
  expiresAt: Timestamp,
});
export type DeleteContentDisclosureView = z.infer<typeof DeleteContentDisclosureView>;

export const ConfirmDeleteContentRequest = strictObject({
  deletionToken: OpaqueToken,
  deletionConfirmation: z.literal(true),
});
export type ConfirmDeleteContentRequest = z.infer<typeof ConfirmDeleteContentRequest>;

export const EscalationDisposition = z.enum(['continue', 'redirect', 'close']);
export type EscalationDisposition = z.infer<typeof EscalationDisposition>;

export const PreviewAutoContinueRequest = strictObject({
  conversationId: ConversationId,
  enabled: z.boolean(),
});
export type PreviewAutoContinueRequest = z.infer<typeof PreviewAutoContinueRequest>;

export const ConfirmAutoContinueRequest = strictObject({
  autoContinueToken: OpaqueToken,
  autoContinueConfirmation: z.literal(true),
});
export type ConfirmAutoContinueRequest = z.infer<typeof ConfirmAutoContinueRequest>;

export const AutoContinueDisclosureView = strictObject({
  autoContinueToken: OpaqueToken,
  conversationId: ConversationId,
  participantSessionIds: z.tuple([Uuid, Uuid]),
  currentEnabled: z.boolean(),
  requestedEnabled: z.boolean(),
  replyDepthLimit: z.literal(8),
  equivalentRepeatThreshold: z.literal(3),
  equivalentRepeatWindow: z.literal(8),
  deliveryFailureThreshold: z.literal(3),
  heldKinds: z.tuple([z.literal('request'), z.literal('query'), z.literal('proposal')]),
  authorityDisclosure: z.string().min(1).max(500),
  expiresAt: Timestamp,
});
export type AutoContinueDisclosureView = z.infer<typeof AutoContinueDisclosureView>;

export const EscalationView = strictObject({
  id: Uuid,
  conversationId: ConversationId,
  handoffId: HandoffId.nullable(),
  kind: EscalationKind,
  state: EscalationState,
  reasonCode: ReasonCode.unwrap(),
  safeSummary: SafeSummary,
  openedAt: Timestamp,
  resolvedAt: Timestamp.nullable(),
  resolution: EscalationDisposition.nullable(),
});
export type EscalationView = z.infer<typeof EscalationView>;

// Shared memory is deliberately plain text, revisioned, and scope-filtered.
// Main derives provider scope/author; provider tool inputs below cannot name either.
const WorkspaceMemoryScope = strictObject({ workspaceId: Uuid, missionId: z.null().optional() });
const MissionMemoryScope = strictObject({ missionId: Uuid, workspaceId: z.null().optional() });
export const MemoryScope = z.union([WorkspaceMemoryScope, MissionMemoryScope]);
export type MemoryScope = z.infer<typeof MemoryScope>;

export const MemorySourceReference = strictObject({
  kind: z.enum(['handoff', 'work_item', 'memory', 'artifact']),
  id: z.string().trim().min(1).max(512).refine(isSafeAuthoredText, 'unsafe source reference'),
});
export type MemorySourceReference = z.infer<typeof MemorySourceReference>;

export const MemoryAuthorView = z.union([
  strictObject({ kind: z.literal('user') }),
  strictObject({ kind: z.literal('session'), sessionId: Uuid }),
]);
export type MemoryAuthorView = z.infer<typeof MemoryAuthorView>;

export const MemorySummaryView = strictObject({
  entryId: Uuid,
  revisionId: Uuid,
  scope: MemoryScope,
  kind: MemoryKind,
  status: MemoryStatus,
  title: z.string().max(160).nullable(),
  author: MemoryAuthorView,
  sourceRefs: z.array(MemorySourceReference).max(32),
  confidence: MemoryConfidence,
  conflictCount: z.number().int().min(0),
  expiresAt: Timestamp.nullable(),
  expiredAt: Timestamp.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type MemorySummaryView = z.infer<typeof MemorySummaryView>;

export const MemoryRevisionView = strictObject({
  id: Uuid,
  entryId: Uuid,
  revision: z.number().int().min(1),
  title: z.string().max(160).nullable(),
  body: z
    .string()
    .max(16 * 1024)
    .nullable(),
  sourceRefs: z.array(MemorySourceReference).max(32),
  author: MemoryAuthorView,
  confidence: MemoryConfidence,
  status: MemoryStatus,
  supersedesRevisionId: Uuid.nullable(),
  contentBytes: z.number().int().min(0).nullable(),
  createdAt: Timestamp,
});
export type MemoryRevisionView = z.infer<typeof MemoryRevisionView>;

export const MemoryConflictView = strictObject({
  id: Uuid,
  leftRevisionId: Uuid,
  leftEntryId: Uuid,
  rightRevisionId: Uuid,
  rightEntryId: Uuid,
  state: MemoryConflictState,
  reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
  resolvedByRevisionId: Uuid.nullable(),
  createdAt: Timestamp,
  resolvedAt: Timestamp.nullable(),
});
export type MemoryConflictView = z.infer<typeof MemoryConflictView>;

export const MemoryDetailView = strictObject({
  summary: MemorySummaryView,
  body: z
    .string()
    .max(16 * 1024)
    .nullable(),
  lineage: z.array(MemoryRevisionView).max(10_000),
  conflicts: z.array(MemoryConflictView).max(100),
  availableActions: z.array(z.enum(['supersede', 'retract', 'resolve_conflict', 'delete'])).max(4),
});
export type MemoryDetailView = z.infer<typeof MemoryDetailView>;

export const MemorySearchResultView = MemorySummaryView.extend({
  excerpt: z.string().max(4096),
  rank: z.number().finite(),
}).strict();
export type MemorySearchResultView = z.infer<typeof MemorySearchResultView>;

export const MemorySearchPageView = strictObject({
  items: z.array(MemorySearchResultView).max(20),
  nextCursor: z.string().max(512).nullable(),
});
export type MemorySearchPageView = z.infer<typeof MemorySearchPageView>;

const MemoryPublicationContent = {
  kind: MemoryKind,
  title: z.string().trim().max(160).nullable().optional(),
  body: z
    .string()
    .min(1)
    .max(16 * 1024),
  sourceRefs: z.array(MemorySourceReference).max(32).default([]),
  confidence: MemoryConfidence.default('unknown'),
};

export const PreviewMemoryPublishRequest = strictObject({
  scope: MemoryScope,
  ...MemoryPublicationContent,
  memoryExpiresAt: Timestamp.nullable().optional(),
});
export type PreviewMemoryPublishRequest = z.infer<typeof PreviewMemoryPublishRequest>;

export const MemoryPublishDisclosureView = strictObject({
  publishToken: OpaqueToken,
  scope: MemoryScope,
  kind: MemoryKind,
  title: z.string().max(160).nullable(),
  body: z.string().max(16 * 1024),
  sourceRefs: z.array(MemorySourceReference).max(32),
  confidence: MemoryConfidence,
  memoryExpiresAt: Timestamp.nullable(),
  expiresAt: Timestamp,
  safeSummary: SafeSummary,
});
export type MemoryPublishDisclosureView = z.infer<typeof MemoryPublishDisclosureView>;

export const ConfirmMemoryPublishRequest = strictObject({
  publishToken: OpaqueToken,
  durableContentConfirmation: z.literal(true),
});
export type ConfirmMemoryPublishRequest = z.infer<typeof ConfirmMemoryPublishRequest>;

export const PreviewMemorySupersedeRequest = strictObject({
  entryId: Uuid,
  targetRevisionId: Uuid,
  title: z.string().trim().max(160).nullable().optional(),
  body: z
    .string()
    .min(1)
    .max(16 * 1024),
  sourceRefs: z.array(MemorySourceReference).max(32).default([]),
  confidence: MemoryConfidence.default('unknown'),
});
export type PreviewMemorySupersedeRequest = z.infer<typeof PreviewMemorySupersedeRequest>;

export const MemorySupersedeDisclosureView = strictObject({
  supersedeToken: OpaqueToken,
  entryId: Uuid,
  targetRevisionId: Uuid,
  title: z.string().max(160).nullable(),
  body: z.string().max(16 * 1024),
  sourceRefs: z.array(MemorySourceReference).max(32),
  confidence: MemoryConfidence,
  expiresAt: Timestamp,
  safeSummary: SafeSummary,
});
export type MemorySupersedeDisclosureView = z.infer<typeof MemorySupersedeDisclosureView>;

export const ConfirmMemorySupersedeRequest = strictObject({ supersedeToken: OpaqueToken });
export const RetractMemoryRequest = strictObject({
  entryId: Uuid,
  revisionId: Uuid,
  reasonCode: z.string().trim().min(1).max(160),
});
export const ResolveMemoryConflictRequest = strictObject({
  conflictId: Uuid,
  resolutionRevisionId: Uuid.nullable(),
});
export const RequestMemoryDeletionRequest = strictObject({ entryId: Uuid });
export const MemoryDeletionDisclosureView = strictObject({
  deletionToken: OpaqueToken,
  entryId: Uuid,
  expiresAt: Timestamp,
  safeSummary: SafeSummary,
});
export type MemoryDeletionDisclosureView = z.infer<typeof MemoryDeletionDisclosureView>;
export const ConfirmMemoryDeletionRequest = strictObject({
  deletionToken: OpaqueToken,
  permanentDeletionConfirmation: z.literal(true),
});

export const ProviderMemorySearchInput = strictObject({
  query: z.string().trim().min(1).max(500),
  kind: MemoryKind.optional(),
  includeContested: z.boolean().optional(),
  cursor: z.string().max(512).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});
export type ProviderMemorySearchInput = z.infer<typeof ProviderMemorySearchInput>;
export const ProviderMemoryGetInput = strictObject({
  entryId: Uuid,
  revisionId: Uuid.optional(),
});
export type ProviderMemoryGetInput = z.infer<typeof ProviderMemoryGetInput>;
export const ProviderMemoryProposeRevisionInput = strictObject({
  ...MemoryPublicationContent,
  memoryExpiresAt: Timestamp.nullable().optional(),
});
export type ProviderMemoryProposeRevisionInput = z.infer<typeof ProviderMemoryProposeRevisionInput>;

export const MemoryChangedEvent = strictObject({
  entryId: Uuid,
  revisionId: Uuid,
  scope: MemoryScope,
  kind: MemoryKind,
  status: MemoryStatus,
  author: MemoryAuthorView,
  conflictCount: z.number().int().min(0),
  sequence: z.number().int().min(1),
  occurredAt: Timestamp,
});
export type MemoryChangedEvent = z.infer<typeof MemoryChangedEvent>;
export const MemoryConflictChangedEvent = strictObject({
  conflictId: Uuid,
  state: MemoryConflictState,
  sequence: z.number().int().min(1),
  occurredAt: Timestamp,
});
export type MemoryConflictChangedEvent = z.infer<typeof MemoryConflictChangedEvent>;

export const ResolveEscalationRequest = z.discriminatedUnion('disposition', [
  strictObject({ escalationId: Uuid, disposition: z.literal('continue') }),
  strictObject({
    escalationId: Uuid,
    disposition: z.literal('redirect'),
    recipientSessionId: Uuid,
  }),
  strictObject({ escalationId: Uuid, disposition: z.literal('close') }),
]);
export type ResolveEscalationRequest = z.infer<typeof ResolveEscalationRequest>;

export const TerminalSize = z.object({
  columns: z.number().int().min(1).max(MAX_COLUMNS),
  rows: z.number().int().min(1).max(MAX_ROWS),
});
export type TerminalSize = z.infer<typeof TerminalSize>;

export const WorkspaceIdentity = z.object({
  volumeSerial: z.string().regex(/^[0-9a-f]{16}$/),
  fileId: z.string().regex(/^[0-9a-f]{32}$/),
});
export type WorkspaceIdentity = z.infer<typeof WorkspaceIdentity>;

export function workspaceIdentityKey(identity: WorkspaceIdentity): string {
  return `${identity.volumeSerial}:${identity.fileId}`;
}

// ---------------------------------------------------------------------------
// Views (main → renderer). Sanitized metadata only.
// ---------------------------------------------------------------------------

export const ApprovedWorkspaceView = z.object({
  id: Uuid,
  selectedPath: z.string(),
  displayPath: z.string(),
  canonicalPath: z.string(),
  volumeSerial: WorkspaceIdentity.shape.volumeSerial,
  fileId: WorkspaceIdentity.shape.fileId,
  driveType: DriveType,
  approvedAt: Timestamp,
  lastValidatedAt: Timestamp,
  revokedAt: Timestamp.nullable(),
});
export type ApprovedWorkspaceView = z.infer<typeof ApprovedWorkspaceView>;

export const WorkspaceCandidateView = z.object({
  candidateToken: OpaqueToken,
  selectedPath: z.string(),
  displayPath: z.string(),
  canonicalPath: z.string(),
  identity: WorkspaceIdentity,
  driveType: DriveType,
  isReparsePoint: z.boolean(),
  /** Set when an active approval already covers this effective directory. */
  existingWorkspaceId: Uuid.nullable(),
  expiresAt: Timestamp,
});
export type WorkspaceCandidateView = z.infer<typeof WorkspaceCandidateView>;

export const ReadinessView = z.object({
  providerId: ProviderId,
  displayName: z.string(),
  resolvedExecutable: z.string().nullable(),
  version: z.string().nullable(),
  availability: Availability,
  authentication: Authentication,
  reasonCode: ReasonCode,
  safeSummary: SafeSummary,
  probedAt: Timestamp,
});
export type ReadinessView = z.infer<typeof ReadinessView>;

export const LaunchPreviewView = z.object({
  previewToken: OpaqueToken,
  workspace: ApprovedWorkspaceView,
  readiness: ReadinessView,
  /** Fixed disclosure: ThreadHelm cannot confine the provider to the folder. */
  boundaryWarning: z.string(),
  terminal: TerminalSize,
  /** Exact per-process choices bound into this one-time preview. */
  runtimeSelection: LaunchRuntimeSelection,
  runtimeResolution: LaunchRuntimeResolution,
  permissionResolution: LaunchPermissionResolution,
  executionBounds: ProviderExecutionBounds,
  coordinationBridge: strictObject({
    enabled: z.boolean(),
    tools: z.tuple([
      z.literal('list pending'),
      z.literal('acknowledge'),
      z.literal('reply'),
      z.literal('report outcome'),
    ]),
    durableContent: z.literal(true),
    failureBehavior: z.literal('manual_only'),
  }).nullable(),
  expiresAt: Timestamp,
});
export type LaunchPreviewView = z.infer<typeof LaunchPreviewView>;

export const SessionView = z.object({
  id: Uuid,
  workspaceId: Uuid,
  workspaceDisplayPath: z.string(),
  providerId: ProviderId,
  providerDisplayName: z.string(),
  accessMode: AccessMode,
  lifecycleState: LifecycleState,
  activityState: ActivityState,
  activityEvidenceKind: z.string(),
  activityObservedAt: Timestamp.nullable(),
  columns: TerminalSize.shape.columns,
  rows: TerminalSize.shape.rows,
  startedAt: Timestamp.nullable(),
  endedAt: Timestamp.nullable(),
  exitCode: z.number().int().nullable(),
  stopKind: StopKind.nullable(),
  truncationCount: z.number().int().min(0),
  /** True while a clean stop timed out and force stop is the remaining option. */
  forceStopAvailable: z.boolean(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type SessionView = z.infer<typeof SessionView>;

export const SessionEventView = z.object({
  id: Uuid,
  sessionId: Uuid,
  sequence: z.number().int().min(1),
  kind: EventKind,
  fromState: LifecycleState.nullable(),
  toState: LifecycleState.nullable(),
  actor: Actor,
  reasonCode: ReasonCode,
  safeSummary: SafeSummary,
  occurredAt: Timestamp,
});
export type SessionEventView = z.infer<typeof SessionEventView>;

export const RecoveryRecordView = z.object({
  id: Uuid,
  sessionId: Uuid,
  lastKnownState: LifecycleState,
  classification: RecoveryClassification,
  reasonCode: z.string(),
  safeSummary: SafeSummary,
  createdAt: Timestamp,
  resolvedAt: Timestamp.nullable(),
  resolution: RecoveryResolution.nullable(),
});
export type RecoveryRecordView = z.infer<typeof RecoveryRecordView>;

export const SessionListView = z.object({
  sessions: z.array(SessionView),
  recoveryRecords: z.array(RecoveryRecordView),
  storageDegraded: z.boolean(),
});
export type SessionListView = z.infer<typeof SessionListView>;

const disclosureBase = {
  sessionId: Uuid,
  providerDisplayName: z.string(),
  workspaceDisplayPath: z.string(),
  expiresAt: Timestamp,
};

export const StopDisclosureView = z.object({
  ...disclosureBase,
  action: z.literal('stop'),
  stopToken: OpaqueToken,
  graceMs: z.number().int().positive(),
});
export type StopDisclosureView = z.infer<typeof StopDisclosureView>;

export const ForceStopDisclosureView = z.object({
  ...disclosureBase,
  action: z.literal('force_stop'),
  forceToken: OpaqueToken,
  risk: z.string(),
  processCount: z.number().int().min(0),
});
export type ForceStopDisclosureView = z.infer<typeof ForceStopDisclosureView>;

export const ControlAcceptedView = z.object({
  sessionId: Uuid,
  lifecycleState: LifecycleState,
  controlSequence: z.number().int().min(1),
});
export type ControlAcceptedView = z.infer<typeof ControlAcceptedView>;

export const CloseResultView = z.object({
  closing: z.boolean(),
  activeSessions: z.array(SessionView),
});
export type CloseResultView = z.infer<typeof CloseResultView>;

export const ApplicationInfoView = z.object({
  version: z.string(),
  electronVersion: z.string(),
  arch: z.string(),
  storageDegraded: z.boolean(),
});
export type ApplicationInfoView = z.infer<typeof ApplicationInfoView>;

export const SelectionView = z.object({ selectedSessionId: Uuid.nullable() });
export type SelectionView = z.infer<typeof SelectionView>;

// ---------------------------------------------------------------------------
// Agent profiles (contracts/agent-profiles.md). An agent manifest is untrusted
// portable data, never an instruction. `effort` is launch policy and is
// deliberately absent; capability labels and the display name never grant
// tools, roles, or budget expansion.
// ---------------------------------------------------------------------------

const ProfileCapabilityLabel = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, 'capability labels are inert lowercase routing tags')
  .refine(isSafeAuthoredText, 'unsafe capability label');

const ProfileModelId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, 'invalid provider model identifier')
  .refine(isSafeAuthoredText, 'unsafe model identifier');

const ProfileDigest = z.string().regex(/^[0-9a-f]{64}$/, 'expected a SHA-256 hex digest');
const ProfileDigestPrefix = z.string().regex(/^[0-9a-f]{12}$/, 'expected a 12-hex digest prefix');
const AuthoredText = z.string().refine(isSafeAuthoredText, 'unsafe authored text');

/** Native output format; the legacy identifier remains readable without rewriting imports. */
export const AGENT_PROFILE_MANIFEST_SPEC = 'threadhelm/agent-profile@1';
export const AgentProfileManifestSpec = z.enum([
  AGENT_PROFILE_MANIFEST_SPEC,
  'munder-difflin/hire@1',
]);
export type AgentProfileManifestSpec = z.infer<typeof AgentProfileManifestSpec>;

export const AgentManifestV1 = strictObject({
  spec: AgentProfileManifestSpec,
  name: AuthoredText.trim().min(1).max(200),
  description: AuthoredText.trim().min(1).max(MAX_GOAL_LENGTH),
  provider: ProfileProviderId,
  model: ProfileModelId,
  goal: AuthoredText.trim().min(1).max(MAX_GOAL_LENGTH),
  capabilities: z.array(ProfileCapabilityLabel).max(16),
  isolate: z.boolean(),
  tokenCap: z.number().int().positive().max(MAX_TOKEN_CAP),
  author: AuthoredText.trim().min(1).max(200),
});
export type AgentManifestV1 = z.infer<typeof AgentManifestV1>;

const AgentProfileSummaryFields = {
  profileId: ProfileId,
  currentRevisionId: ProfileRevisionId,
  displayName: z.string().min(1).max(200),
  description: z.string().min(1).max(MAX_GOAL_LENGTH),
  requestedProvider: ProfileProviderId,
  requestedModel: ProfileModelId,
  compatibility: ProfileCompatibility,
  state: ProfileState,
  capabilities: z.array(ProfileCapabilityLabel).max(16),
  isolateRequested: z.boolean(),
  tokenCapRequested: z.number().int().positive().max(MAX_TOKEN_CAP),
  author: z.string().min(1).max(200),
  digestPrefix: ProfileDigestPrefix,
  createdAt: Timestamp,
  updatedAt: Timestamp,
};

export const AgentProfileSummaryView = strictObject(AgentProfileSummaryFields);
export type AgentProfileSummaryView = z.infer<typeof AgentProfileSummaryView>;

export const AgentProfileDetailView = strictObject({
  ...AgentProfileSummaryFields,
  goal: z.string().min(1).max(MAX_GOAL_LENGTH),
  digest: ProfileDigest,
  manifestSpec: AgentProfileManifestSpec,
  compatibilityReasons: z.array(z.string().max(300)).max(20),
  revisionHistory: z
    .array(
      strictObject({
        revisionId: ProfileRevisionId,
        digest: ProfileDigest,
        createdAt: Timestamp,
      }),
    )
    .max(100),
});
export type AgentProfileDetailView = z.infer<typeof AgentProfileDetailView>;

// Workspace Recon (docs/superpowers/specs/2026-09-02-workspace-recon-design.md).
// A recon session is an ordinary session; these shapes add only the bounds and
// provenance a proposed roster needs.

export const RECON_NO_AUTO_HIRE_STATEMENT =
  'Recon proposes roles only. No agent is hired and no authority is granted until you review and confirm each one.';

export const ReconOutcome = z.enum([
  'completed',
  'partial',
  'no_output',
  'unparsable_output',
  'stopped_by_owner',
  // Not produced today: ThreadHelm has no token accounting. Reachable once a
  // provider reports usage labelled provider-reported or CLI-derived.
  'token_cap_reached',
  'provider_unauthenticated',
]);
export type ReconOutcome = z.infer<typeof ReconOutcome>;

export const ReconRole = z.enum(['supervisor', 'specialist']);
export type ReconRole = z.infer<typeof ReconRole>;

export const ReconProposalView = strictObject({
  proposalId: Uuid,
  role: ReconRole,
  sourceBasename: z.string().min(1).max(200),
  digest: ProfileDigest,
  manifest: AgentManifestV1,
  compatibility: ProfileCompatibility,
  compatibilityReasons: z.array(z.string().max(300)).max(20),
});
export type ReconProposalView = z.infer<typeof ReconProposalView>;

export const ReconRejectionView = strictObject({
  sourceBasename: z.string().min(1).max(200),
  /** A stable ThreadHelmError code; never a raw parser message. */
  errorCode: z.string().min(1).max(64),
});
export type ReconRejectionView = z.infer<typeof ReconRejectionView>;

export const ReconRunView = strictObject({
  runId: Uuid,
  workspaceId: Uuid,
  sessionId: Uuid.nullable(),
  /** Null while the run is still in flight. */
  outcome: ReconOutcome.nullable(),
  /** Null when the approved folder is not a Git working tree. */
  derivedFromCommit: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .nullable(),
  startedAt: Timestamp,
  completedAt: Timestamp.nullable(),
  /** Bound mirrors MAX_RECON_FILES in @threadhelm/domain; contracts cannot import domain. */
  proposals: z.array(ReconProposalView).max(12),
  rejected: z.array(ReconRejectionView).max(12),
  ignoredFileCount: z.number().int().min(0),
  /**
   * False when ThreadHelm could not submit the disclosed prompt to the session.
   * A `no_output` run with this false means the agent was never asked, not that
   * it was asked and produced nothing.
   */
  promptSubmitted: z.boolean(),
});
export type ReconRunView = z.infer<typeof ReconRunView>;

export const ReconLaunchPreviewView = strictObject({
  /** The unmodified session disclosure, boundary warning included. */
  launch: LaunchPreviewView,
  outputDirectory: z.string().min(1),
  /**
   * Asked of the agent in the prompt below, never enforced: ThreadHelm has no
   * token accounting. Named like AgentProfileSummaryView.tokenCapRequested
   * because it is a request carried to the agent, not a ceiling we hold.
   */
  tokenCapRequested: z.number().int().positive().max(MAX_TOKEN_CAP),
  /** The exact text sent as this session's first input. */
  reconPrompt: z.string().min(1).max(8000),
  autoHireStatement: z.literal(RECON_NO_AUTO_HIRE_STATEMENT),
});
export type ReconLaunchPreviewView = z.infer<typeof ReconLaunchPreviewView>;

/** Accepts a renderer file-selection handle or a recon proposal, never both. */
export const PreviewImportProfileRequest = strictObject({
  fileHandle: z.string().min(1).max(256).optional(),
  proposalId: Uuid.optional(),
}).refine(
  (value) => (value.fileHandle === undefined) !== (value.proposalId === undefined),
  'exactly one import source',
);
export type PreviewImportProfileRequest = z.infer<typeof PreviewImportProfileRequest>;

export const ProfilePreviewView = strictObject({
  previewToken: OpaqueToken,
  digest: ProfileDigest,
  basename: z.string().min(1).max(255),
  normalized: AgentManifestV1,
  warnings: z.array(z.string().max(300)).max(20),
  compatibility: ProfileCompatibility,
  compatibilityReasons: z.array(z.string().max(300)).max(20),
  expiresAt: Timestamp,
});
export type ProfilePreviewView = z.infer<typeof ProfilePreviewView>;

export const ConfirmImportProfileRequest = strictObject({
  previewToken: OpaqueToken,
  importConfirmation: z.literal(true),
  /**
   * The name the owner typed at acceptance. Absent leaves the reviewed
   * manifest's own name in place, so the file-picker path is unchanged.
   */
  displayName: AgentManifestV1.shape.name.optional(),
});
export type ConfirmImportProfileRequest = z.infer<typeof ConfirmImportProfileRequest>;

export const SetProfileEnabledRequest = strictObject({
  profileId: ProfileId,
  revisionId: ProfileRevisionId,
  enabled: z.boolean(),
});
export type SetProfileEnabledRequest = z.infer<typeof SetProfileEnabledRequest>;

/** Content-free: deletion is disclosed without goal/description text. */
export const ProfileDeletionDisclosureView = strictObject({
  deleteToken: OpaqueToken,
  profileId: ProfileId,
  displayName: z.string().min(1).max(200),
  expiresAt: Timestamp,
});
export type ProfileDeletionDisclosureView = z.infer<typeof ProfileDeletionDisclosureView>;

export const ConfirmDeleteProfileRequest = strictObject({
  deleteToken: OpaqueToken,
  deleteConfirmation: z.literal(true),
});
export type ConfirmDeleteProfileRequest = z.infer<typeof ConfirmDeleteProfileRequest>;

/** Content-free: ids, state, compatibility, digest prefix, and timestamps only. */
export const ProfileEventEnvelope = strictObject({
  type: z.literal('profiles.changed'),
  eventId: Uuid,
  profileId: ProfileId,
  revisionId: ProfileRevisionId,
  state: ProfileState,
  compatibility: ProfileCompatibility,
  digestPrefix: ProfileDigestPrefix,
  kind: ProfileEventKind,
  occurredAt: Timestamp,
});
export type ProfileEventEnvelope = z.infer<typeof ProfileEventEnvelope>;

// ---------------------------------------------------------------------------
// Agent creation wizard and local templates. These are bounded local draft
// data only; none can choose effective tools, permissions, roles, workspaces,
// or launch an agent.
// ---------------------------------------------------------------------------

export const AgentWizardStep = z.enum([
  'start',
  'identity',
  'role',
  'capabilities',
  'runtime',
  'review',
]);
export type AgentWizardStep = z.infer<typeof AgentWizardStep>;

export const AgentWizardDraftState = z.enum([
  'editing',
  'invalid',
  'ready_for_review',
  'completed',
  'deleted',
]);
export type AgentWizardDraftState = z.infer<typeof AgentWizardDraftState>;

export const AgentTemplateOrigin = z.enum(['bundled', 'user']);
export type AgentTemplateOrigin = z.infer<typeof AgentTemplateOrigin>;
export const AgentTemplateState = z.enum(['active', 'disabled', 'superseded', 'deleted']);
export type AgentTemplateState = z.infer<typeof AgentTemplateState>;

const BoundedVariableText = AuthoredText.refine(
  (value) => Array.from(value).length <= 256,
  'variable value exceeds 256 Unicode scalars',
);

export const AgentTemplateVariable = strictObject({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  type: z.literal('text'),
  maxLength: z.number().int().min(1).max(256),
  defaultValue: BoundedVariableText.optional(),
});
export type AgentTemplateVariable = z.infer<typeof AgentTemplateVariable>;

/** Draft storage accepts incomplete and deliberately cleared values; final
 * completion always re-parses the exact AgentManifestV1 schema. */
const WizardFieldValues = strictObject({
  spec: AgentProfileManifestSpec.optional(),
  name: AuthoredText.max(200).optional(),
  description: AuthoredText.max(MAX_GOAL_LENGTH).optional(),
  provider: ProfileProviderId.optional(),
  model: AuthoredText.max(128).optional(),
  goal: AuthoredText.max(MAX_GOAL_LENGTH).optional(),
  capabilities: z.array(AuthoredText.max(64)).max(16).optional(),
  isolate: z.boolean().optional(),
  tokenCap: z.number().int().min(0).max(MAX_TOKEN_CAP).optional(),
  author: AuthoredText.max(200).optional(),
});
const WizardVariableValues = z.record(
  z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  BoundedVariableText,
);
const WizardIssueCode = z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/);
const WizardFieldErrors = z
  .record(z.string().max(32), WizardIssueCode)
  .refine((value) => Object.keys(value).length <= 16, 'too many wizard field errors');

export const AgentWizardDraftSummaryView = strictObject({
  draftId: Uuid,
  version: z.number().int().positive(),
  state: AgentWizardDraftState,
  currentStep: AgentWizardStep,
  validationIssues: z.array(WizardIssueCode).max(20),
  updatedAt: Timestamp,
});
export type AgentWizardDraftSummaryView = z.infer<typeof AgentWizardDraftSummaryView>;

export const AgentWizardDraftDetailView = strictObject({
  ...AgentWizardDraftSummaryView.shape,
  fieldValues: WizardFieldValues,
  variableValues: WizardVariableValues,
  sourceTemplateRevisionId: Uuid.nullable(),
  sourceProfileRevisionId: Uuid.nullable(),
  provenance: strictObject({
    templateRevisionId: Uuid.nullable(),
    profileRevisionId: Uuid.nullable(),
  }),
  fieldErrors: WizardFieldErrors,
  createdAt: Timestamp,
  completedAt: Timestamp.nullable(),
});
export type AgentWizardDraftDetailView = z.infer<typeof AgentWizardDraftDetailView>;

const AgentTemplateSummaryFields = {
  templateId: Uuid,
  key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  currentRevisionId: Uuid,
  revision: z.number().int().positive(),
  name: AuthoredText.trim().min(1).max(200),
  origin: AgentTemplateOrigin,
  state: AgentTemplateState,
  updatedAt: Timestamp,
};
export const AgentTemplateSummaryView = strictObject(AgentTemplateSummaryFields);
export type AgentTemplateSummaryView = z.infer<typeof AgentTemplateSummaryView>;

export const AgentTemplateDetailView = strictObject({
  ...AgentTemplateSummaryFields,
  manifest: AgentManifestV1,
  manifestJson: z.string().min(2).max(65_536),
  digest: ProfileDigest,
  variables: z.array(AgentTemplateVariable).max(16),
  provenance: strictObject({ sourceProfileRevisionId: Uuid.nullable() }),
  createdAt: Timestamp,
});
export type AgentTemplateDetailView = z.infer<typeof AgentTemplateDetailView>;

export const CreateAgentWizardDraftRequest = strictObject({
  source: z.discriminatedUnion('kind', [
    strictObject({ kind: z.literal('blank') }),
    strictObject({ kind: z.literal('template'), templateRevisionId: Uuid }),
    strictObject({ kind: z.literal('profile'), profileRevisionId: Uuid }),
  ]),
});
export type CreateAgentWizardDraftRequest = z.infer<typeof CreateAgentWizardDraftRequest>;

const WizardRequestBase = {
  draftId: Uuid,
  version: z.number().int().positive(),
  nextStep: AgentWizardStep.optional(),
};
const WizardStepFields = z.discriminatedUnion('step', [
  strictObject({
    ...WizardRequestBase,
    step: z.literal('identity'),
    fields: strictObject({
      name: z.string().max(200).optional(),
      description: z.string().max(MAX_GOAL_LENGTH).optional(),
      author: z.string().max(200).optional(),
    }),
    variables: WizardVariableValues.optional(),
  }),
  strictObject({
    ...WizardRequestBase,
    step: z.literal('role'),
    fields: strictObject({
      goal: z.string().max(MAX_GOAL_LENGTH).optional(),
    }),
    variables: WizardVariableValues.optional(),
  }),
  strictObject({
    ...WizardRequestBase,
    step: z.literal('capabilities'),
    fields: strictObject({
      capabilities: z.array(z.string().max(64)).max(16).optional(),
    }),
    variables: WizardVariableValues.optional(),
  }),
  strictObject({
    ...WizardRequestBase,
    step: z.literal('runtime'),
    fields: strictObject({
      provider: ProfileProviderId.optional(),
      /** Empty is retained while editing; final review applies ProfileModelId. */
      model: z.string().max(128).optional(),
      isolate: z.boolean().optional(),
      tokenCap: z.number().int().min(0).max(MAX_TOKEN_CAP).optional(),
    }),
    variables: WizardVariableValues.optional(),
  }),
  strictObject({
    ...WizardRequestBase,
    step: z.literal('review'),
    fields: strictObject({}),
    variables: WizardVariableValues.optional(),
  }),
]);
export const UpdateAgentWizardStepRequest = WizardStepFields;
export type UpdateAgentWizardStepRequest = z.infer<typeof UpdateAgentWizardStepRequest>;

export const AgentWizardCompletionPreviewView = strictObject({
  completionToken: OpaqueToken,
  draftId: Uuid,
  version: z.number().int().positive(),
  manifest: AgentManifestV1,
  manifestJson: z.string().min(2).max(65_536),
  digest: ProfileDigest,
  compatibility: ProfileCompatibility,
  compatibilityReasons: z.array(z.string().max(300)).max(20),
  disclosure: z.string().max(500),
  expiresAt: Timestamp,
});
export type AgentWizardCompletionPreviewView = z.infer<typeof AgentWizardCompletionPreviewView>;

export const AgentWizardExportPreviewView = strictObject({
  exportToken: OpaqueToken,
  draftId: Uuid,
  displayPath: z.string().min(1).max(32_767),
  basename: z.string().min(1).max(255),
  collision: z.boolean(),
  requiresOverwriteConfirmation: z.boolean(),
  expiresAt: Timestamp,
});
export type AgentWizardExportPreviewView = z.infer<typeof AgentWizardExportPreviewView>;

export const AgentTemplateDeletePreviewView = strictObject({
  deleteToken: OpaqueToken,
  templateId: Uuid,
  revisionId: Uuid,
  name: z.string().min(1).max(200),
  expiresAt: Timestamp,
});
export type AgentTemplateDeletePreviewView = z.infer<typeof AgentTemplateDeletePreviewView>;

export const AgentWizardChangedEvent = strictObject({
  type: z.literal('agentWizard.changed'),
  draftId: Uuid,
  version: z.number().int().positive(),
  state: AgentWizardDraftState,
  currentStep: AgentWizardStep,
  validationIssues: z.array(WizardIssueCode).max(20),
  occurredAt: Timestamp,
});
export type AgentWizardChangedEvent = z.infer<typeof AgentWizardChangedEvent>;

export const AgentTemplatesChangedEvent = strictObject({
  type: z.literal('agentTemplates.changed'),
  templateId: Uuid,
  revisionId: Uuid,
  state: AgentTemplateState,
  occurredAt: Timestamp,
});
export type AgentTemplatesChangedEvent = z.infer<typeof AgentTemplatesChangedEvent>;

// ---------------------------------------------------------------------------
// Request/response operations. One entry per preload method; main validates
// every request against `request` before doing anything else.
// ---------------------------------------------------------------------------

// Bounded supervisor contracts. Persona fields never appear in role/authority inputs.
const MissionText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(isSafeAuthoredText, 'unsafe authored content')
    .refine((value) => {
      let bytes = 0;
      for (const character of value) {
        const point = character.codePointAt(0)!;
        bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
      }
      return bytes <= max;
    }, 'mission text exceeds its byte limit');
export const MissionState = z.enum([
  'running',
  'paused',
  'recovery_required',
  'completed',
  'cancelled',
  'deleted',
]);
export type MissionState = z.infer<typeof MissionState>;
export const SupervisorWorkState = z.enum([
  'blocked',
  'ready',
  'assigned',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled',
  'escalated',
]);
export type SupervisorWorkState = z.infer<typeof SupervisorWorkState>;
export const MissionRole = z.enum(['supervisor', 'worker', 'reviewer', 'triage']);
export type MissionRole = z.infer<typeof MissionRole>;
export const MissionBounds = ProviderExecutionBounds.extend({
  maxWorkers: z.number().int().min(1).max(16),
  maxWorkItems: z.number().int().min(1).max(64),
  maxDepth: z.number().int().min(1).max(8),
  maxAttempts: z.number().int().min(1).max(3),
  maxTokenBudget: z.number().int().min(1).max(MAX_TOKEN_CAP),
});
export type MissionBounds = z.infer<typeof MissionBounds>;
export const MissionRoutineAction = z.enum([
  'decompose',
  'assign',
  'retry',
  'reassign',
  'pause',
  'complete',
]);
const MissionWorkspaceInput = strictObject({ workspaceId: Uuid, mode: z.enum(['read', 'write']) });
const MissionAssignment = MissionText(2000);
const MissionEvidenceItem = MissionText(500);
const missionWorkerInputShape = {
  profileId: Uuid,
  profileRevisionId: Uuid,
  workspaceId: Uuid,
  sessionId: Uuid.nullable(),
  role: z.enum(['worker', 'reviewer', 'triage']).default('worker'),
  autoStart: z.boolean(),
  runtimeSelection: LaunchRuntimeSelection,
  permissionSelection: LaunchPermissionSelection,
  executionBounds: ProviderExecutionBounds,
} as const;
const missionWorkerNoBypass = (v: { permissionSelection: { policy: string | null } }) =>
  v.permissionSelection.policy !== 'break_glass_bypass';
const MissionWorkerInput = strictObject({
  ...missionWorkerInputShape,
  /** One bounded contribution for this mission; mission authority, not profile data. */
  assignment: MissionAssignment,
  requiredReturnEvidence: z.array(MissionEvidenceItem).min(1).max(8),
}).refine(missionWorkerNoBypass, 'mission bypass is prohibited');
/**
 * Tolerant read-time counterpart to `MissionWorkerInput`, used ONLY for parsing
 * an already-persisted `input_json` envelope. Missions confirmed before
 * `assignment`/`requiredReturnEvidence` became required have no such fields in
 * their stored JSON; `.catch()` fills in the same defaults the View schema
 * uses instead of throwing. Never use this for validating a live request.
 */
const MissionWorkerStoredInput = strictObject({
  ...missionWorkerInputShape,
  assignment: MissionAssignment.catch(''),
  requiredReturnEvidence: z.array(MissionEvidenceItem).max(8).catch([]),
}).refine(missionWorkerNoBypass, 'mission bypass is prohibited');
export const MissionEnvelopeInput = strictObject({
  objective: MissionText(4000),
  completionEvidence: MissionText(2000),
  exclusions: z.array(MissionEvidenceItem).max(8).default([]),
  workspaces: z.array(MissionWorkspaceInput).min(1).max(16),
  supervisor: strictObject({ profileId: Uuid, profileRevisionId: Uuid, sessionId: Uuid }),
  workers: z.array(MissionWorkerInput).min(1).max(16),
  bounds: MissionBounds,
  permittedRoutineActions: z.array(MissionRoutineAction).min(1).max(6),
  knownSafeRetryClasses: z.array(z.literal('failed_before_effect')).max(1),
  escalationRules: z
    .array(z.enum(['consequential', 'unknown', 'bounds', 'supervisor_loss']))
    .min(4)
    .max(4),
});
export type MissionEnvelopeInput = z.infer<typeof MissionEnvelopeInput>;
/**
 * Tolerant read-time counterpart to `MissionEnvelopeInput`. Use ONLY to parse
 * an already-persisted mission's stored `input_json` (e.g. `detail()` and the
 * composer revision path) — never to validate a live confirm/preview request.
 * Missions confirmed before `assignment`/`requiredReturnEvidence` were added
 * read back with the same defaults the View schema already tolerates.
 */
export const MissionEnvelopeStoredInput = MissionEnvelopeInput.extend({
  workers: z.array(MissionWorkerStoredInput).min(1).max(16),
});
export type MissionEnvelopeStoredInput = z.infer<typeof MissionEnvelopeStoredInput>;
export const MissionBindingView = strictObject({
  bindingId: Uuid,
  role: MissionRole,
  profileId: Uuid,
  profileRevisionId: Uuid,
  profileDigest: z.string().regex(/^[a-f0-9]{64}$/),
  workspaceId: Uuid,
  sessionId: Uuid.nullable(),
  autoStart: z.boolean(),
  mode: z.enum(['read', 'write']),
  providerId: ProviderId,
  identity: strictObject(WorkspaceIdentity.shape),
  canonicalPath: z.string().min(1).max(32768),
  displayPath: z.string().min(1).max(32768),
  readiness: strictObject(ReadinessView.shape),
  terminal: strictObject(TerminalSize.shape),
  runtimeSelection: LaunchRuntimeSelection,
  runtimeResolution: LaunchRuntimeResolution,
  permissionSelection: LaunchPermissionSelection,
  permissionResolution: LaunchPermissionResolution,
  executionBounds: ProviderExecutionBounds,
  requestedIsolation: z.boolean(),
  effectiveIsolation: z.boolean(),
  effectiveTokenBudget: z.number().int().positive(),
  launchDisposition: z.enum(['ready', 'held']),
  reasonCode: ReasonCode.nullable(),
  assignment: MissionAssignment.nullable().default(null),
  requiredReturnEvidence: z.array(MissionEvidenceItem).max(8).default([]),
});
export type MissionBindingView = z.infer<typeof MissionBindingView>;
export const MissionEnvelopeView = strictObject({
  objective: MissionText(4000),
  completionEvidence: MissionText(2000),
  exclusions: z.array(MissionEvidenceItem).max(8).default([]),
  workspaces: z.array(MissionWorkspaceInput).min(1).max(16),
  bindings: z.array(MissionBindingView).min(2).max(17),
  bounds: MissionBounds,
  permittedRoutineActions: z.array(MissionRoutineAction).min(1).max(6),
  knownSafeRetryClasses: z.array(z.literal('failed_before_effect')).max(1),
  escalationRules: z
    .array(z.enum(['consequential', 'unknown', 'bounds', 'supervisor_loss']))
    .min(4)
    .max(4),
});
export type MissionEnvelopeView = z.infer<typeof MissionEnvelopeView>;
export const MissionPreviewView = strictObject({
  previewToken: OpaqueToken,
  missionId: Uuid,
  version: z.number().int().positive(),
  envelope: MissionEnvelopeView,
  boundaryWarning: z.string().min(1).max(2000),
  expiresAt: Timestamp,
});
export type MissionPreviewView = z.infer<typeof MissionPreviewView>;
export const MissionComposerStage = z.enum(['outcome', 'crew', 'access', 'review']);
export type MissionComposerStage = z.infer<typeof MissionComposerStage>;
export const MissionComposerDraftState = z.enum([
  'editing',
  'ready_for_review',
  'converted',
  'deleted',
]);
export type MissionComposerDraftState = z.infer<typeof MissionComposerDraftState>;
/** Every envelope key optional; element shapes match the envelope so a draft never lies. */
export const MissionComposerFields = strictObject({
  objective: z.string().max(4000).optional(),
  completionEvidence: z.string().max(2000).optional(),
  exclusions: z.array(z.string().max(500)).max(8).optional(),
  workspaces: z.array(MissionWorkspaceInput).max(16).optional(),
  supervisor: strictObject({
    profileId: Uuid.nullable(),
    profileRevisionId: Uuid.nullable(),
    sessionId: Uuid.nullable(),
  }).optional(),
  workers: z
    .array(
      strictObject({
        profileId: Uuid.nullable(),
        profileRevisionId: Uuid.nullable(),
        workspaceId: Uuid.nullable(),
        sessionId: Uuid.nullable(),
        role: z.enum(['worker', 'reviewer', 'triage']),
        autoStart: z.boolean(),
        runtimeSelection: LaunchRuntimeSelection,
        permissionSelection: LaunchPermissionSelection,
        executionBounds: ProviderExecutionBounds,
        assignment: z.string().max(2000),
        requiredReturnEvidence: z.array(z.string().max(500)).max(8),
      }),
    )
    .max(16)
    .optional(),
  bounds: MissionBounds.optional(),
  permittedRoutineActions: z.array(MissionRoutineAction).max(6).optional(),
  knownSafeRetryClasses: z.array(z.literal('failed_before_effect')).max(1).optional(),
  escalationRules: z
    .array(z.enum(['consequential', 'unknown', 'bounds', 'supervisor_loss']))
    .max(4)
    .optional(),
});
export type MissionComposerFields = z.infer<typeof MissionComposerFields>;
const MissionComposerIssueCode = z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/);
export const MissionComposerDraftSummaryView = strictObject({
  draftId: Uuid,
  version: z.number().int().positive(),
  state: MissionComposerDraftState,
  currentStage: MissionComposerStage,
  sourceMissionId: Uuid.nullable(),
  issueCodes: z.array(MissionComposerIssueCode).max(20),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type MissionComposerDraftSummaryView = z.infer<typeof MissionComposerDraftSummaryView>;
export const MissionComposerDraftDetailView = strictObject({
  ...MissionComposerDraftSummaryView.shape,
  fieldValues: MissionComposerFields,
  convertedMissionId: Uuid.nullable(),
});
export type MissionComposerDraftDetailView = z.infer<typeof MissionComposerDraftDetailView>;
export const MissionComposerSaveReceipt = strictObject({
  draftId: Uuid,
  version: z.number().int().positive(),
  savedAt: Timestamp,
  currentStage: MissionComposerStage,
});
export type MissionComposerSaveReceipt = z.infer<typeof MissionComposerSaveReceipt>;
export const MissionComposerChangedEvent = strictObject({
  type: z.literal('missionComposer.changed'),
  draftId: Uuid,
  version: z.number().int().positive(),
  state: MissionComposerDraftState,
  currentStage: MissionComposerStage,
  occurredAt: Timestamp,
});
export type MissionComposerChangedEvent = z.infer<typeof MissionComposerChangedEvent>;
export const MissionEligibleSessionView = strictObject({
  sessionId: Uuid,
  workspaceId: Uuid,
  providerId: ProviderId,
  runtimeSelection: LaunchRuntimeSelection,
  permissionSelection: LaunchPermissionSelection,
  permissionResolution: LaunchPermissionResolution,
  executionBounds: ProviderExecutionBounds,
});
export type MissionEligibleSessionView = z.infer<typeof MissionEligibleSessionView>;
export const MissionSummaryView = strictObject({
  id: Uuid,
  version: z.number().int().positive(),
  state: MissionState,
  supervisorSessionId: Uuid.nullable(),
  workItemCount: z.number().int().min(0),
  completedWorkItemCount: z.number().int().min(0),
  activeWorkerCount: z.number().int().min(0),
  sequence: z.number().int().min(0),
  reasonCode: ReasonCode.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type MissionSummaryView = z.infer<typeof MissionSummaryView>;
export const SupervisorEvidenceRef = strictObject({
  kind: z.enum(['handoff', 'work_item', 'memory_revision', 'artifact']),
  id: MissionText(256),
});
export type SupervisorEvidenceRef = z.infer<typeof SupervisorEvidenceRef>;
export const SupervisorWorkInput = strictObject({
  id: Uuid,
  parentWorkItemId: Uuid.nullable(),
  workspaceId: Uuid,
  title: MissionText(160),
  specification: MissionText(4000),
  acceptanceCriteria: MissionText(2000),
  dependencies: z.array(Uuid).max(64),
  authorityClass: z.enum([
    'routine',
    'destructive',
    'privileged',
    'external',
    'spending',
    'credential',
    'workspace_expanding',
    'permission_changing',
    'scope_changing',
  ]),
});
export type SupervisorWorkInput = z.infer<typeof SupervisorWorkInput>;
export const SupervisorWorkView = strictObject({
  id: Uuid,
  missionId: Uuid,
  parentWorkItemId: Uuid.nullable(),
  workspaceId: Uuid,
  title: MissionText(160).nullable(),
  specification: MissionText(4000).nullable(),
  acceptanceCriteria: MissionText(2000).nullable(),
  dependencies: z.array(Uuid).max(64),
  authorityClass: SupervisorWorkInput.shape.authorityClass,
  state: SupervisorWorkState,
  assignedSessionId: Uuid.nullable(),
  attemptCount: z.number().int().min(0).max(3),
  reasonCode: ReasonCode.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type SupervisorWorkView = z.infer<typeof SupervisorWorkView>;
export const SupervisorDecisionView = strictObject({
  id: Uuid,
  missionId: Uuid,
  workItemId: Uuid.nullable(),
  supervisorSessionId: Uuid,
  envelopeVersion: z.number().int().positive().default(1),
  kind: z.enum(['decompose', 'assign', 'reassign', 'pause', 'complete', 'escalate']),
  policyResult: z.enum(['accepted', 'held', 'rejected']),
  reasonCode: ReasonCode.nullable(),
  rationale: MissionText(2000).nullable(),
  inputRefs: z.array(SupervisorEvidenceRef).max(16),
  expectedEvidence: MissionText(2000).nullable(),
  createdAt: Timestamp,
});
export type SupervisorDecisionView = z.infer<typeof SupervisorDecisionView>;
export const WorkerLeaseView = strictObject({
  id: Uuid,
  missionId: Uuid,
  workItemId: Uuid,
  workspaceId: Uuid,
  profileRevisionId: Uuid,
  sessionId: Uuid.nullable(),
  mode: z.enum(['read', 'write']),
  state: z.enum(['reserved', 'active', 'released', 'expired', 'unknown']),
  acquiredAt: Timestamp,
  expiresAt: Timestamp,
  releasedAt: Timestamp.nullable(),
});
export type WorkerLeaseView = z.infer<typeof WorkerLeaseView>;
export const SupervisorResultDisposition = z.enum([
  'completion',
  'refusal',
  'failure',
  'proposal',
  'authority_required',
  'permission_blocked',
  'classifier_failed',
  'timed_out',
  'cancelled',
  'no_progress',
  'budget_exhausted',
  'unknown',
]);
export type SupervisorResultDisposition = z.infer<typeof SupervisorResultDisposition>;
export const SupervisorAttemptView = strictObject({
  id: Uuid,
  missionId: Uuid,
  workItemId: Uuid,
  decisionId: Uuid,
  leaseId: Uuid,
  profileRevisionId: Uuid,
  sessionId: Uuid.nullable(),
  envelopeVersion: z.number().int().positive().default(1),
  reservedTokenBudget: z.number().int().positive().max(MAX_TOKEN_CAP).default(MAX_TOKEN_CAP),
  attemptNumber: z.number().int().min(1).max(3),
  state: z.enum(['reserved', 'assigned', 'running', 'completed', 'failed', 'unknown', 'cancelled']),
  workerStartDisposition: z.enum(['not_needed', 'started', 'held', 'failed']),
  handoffId: Uuid.nullable(),
  resultHandoffId: Uuid.nullable(),
  supervisorSessionId: Uuid,
  disposition: SupervisorResultDisposition.nullable(),
  explanation: MissionText(2000).nullable(),
  evidenceRefs: z.array(SupervisorEvidenceRef).max(16),
  reasonCode: ReasonCode.nullable(),
  createdAt: Timestamp,
  completedAt: Timestamp.nullable(),
});
export type SupervisorAttemptView = z.infer<typeof SupervisorAttemptView>;
export const MissionDetailView = MissionSummaryView.extend({
  envelope: MissionEnvelopeView.nullable(),
  // Reading back a persisted mission's original input must tolerate rows
  // stored before assignment/requiredReturnEvidence became required — see
  // MissionEnvelopeStoredInput.
  input: MissionEnvelopeStoredInput.nullable(),
  workItems: z.array(SupervisorWorkView).max(64),
  decisions: z.array(SupervisorDecisionView).max(100),
  leases: z.array(WorkerLeaseView).max(192),
  attempts: z.array(SupervisorAttemptView).max(192),
});
export type MissionDetailView = z.infer<typeof MissionDetailView>;
export const SupervisorWorkDetailView = strictObject({
  workItem: SupervisorWorkView,
  attempts: z.array(SupervisorAttemptView).max(3),
  decisions: z.array(SupervisorDecisionView).max(100),
});
export type SupervisorWorkDetailView = z.infer<typeof SupervisorWorkDetailView>;
const supervisorDecisionBase = {
  missionId: Uuid,
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  rationale: MissionText(2000),
  inputRefs: z.array(SupervisorEvidenceRef).max(16),
  expectedEvidence: MissionText(2000),
};
export const SupervisorDecomposeInput = strictObject({
  ...supervisorDecisionBase,
  items: z.array(SupervisorWorkInput).min(1).max(64),
});
export const SupervisorAssignInput = strictObject({
  ...supervisorDecisionBase,
  workItemId: Uuid,
  bindingId: Uuid,
});
export const SupervisorPauseInput = strictObject({
  ...supervisorDecisionBase,
  workItemId: Uuid.nullable(),
});
export const SupervisorCompleteInput = strictObject({
  ...supervisorDecisionBase,
  evidenceRefs: z.array(SupervisorEvidenceRef).min(1).max(16),
});
export const SupervisorEscalateInput = strictObject({
  ...supervisorDecisionBase,
  workItemId: Uuid.nullable(),
  authorityClass: SupervisorWorkInput.shape.authorityClass,
});
export const SupervisorInspectInput = strictObject({
  missionId: Uuid,
  view: z.enum(['mission', 'bindings', 'work_items', 'decisions', 'attempts']).default('mission'),
  cursor: z.number().int().min(0).max(192).default(0),
  limit: z.number().int().min(1).max(8).default(4),
  afterSequence: z.number().int().min(0).nullable().default(null),
  waitMs: z.number().int().min(0).max(15_000).default(0),
}).refine(
  (value) => value.waitMs === 0 || (value.view === 'mission' && value.afterSequence !== null),
  'A bounded wait requires the last observed mission sequence.',
);
export const SupervisorResultInput = strictObject({
  missionId: Uuid,
  workItemId: Uuid,
  attemptId: Uuid,
  idempotencyKey: supervisorDecisionBase.idempotencyKey,
  disposition: SupervisorResultDisposition,
  explanation: MissionText(2000),
  evidenceRefs: z.array(SupervisorEvidenceRef).max(16),
});
export type SupervisorResultInput = z.infer<typeof SupervisorResultInput>;
export const supervisorToolSchemas = {
  threadhelm_mission_inspect: SupervisorInspectInput,
  threadhelm_work_decompose: SupervisorDecomposeInput,
  threadhelm_work_assign: SupervisorAssignInput,
  threadhelm_work_reassign: SupervisorAssignInput,
  threadhelm_work_pause: SupervisorPauseInput,
  threadhelm_mission_complete: SupervisorCompleteInput,
  threadhelm_mission_escalate: SupervisorEscalateInput,
  threadhelm_work_result: SupervisorResultInput,
} as const;
export function supervisorToolDefinitions(names: readonly string[]) {
  return names.flatMap((name) => {
    const schema = supervisorToolSchemas[name as keyof typeof supervisorToolSchemas];
    return schema
      ? [
          {
            name,
            description:
              'Version 1 mission-scoped operation. Main validates the authenticated session and confirmed envelope.',
            inputSchema: z.toJSONSchema(schema, { io: 'input' }),
          },
        ]
      : [];
  });
}
export const MissionChangedEvent = strictObject({
  missionId: Uuid,
  sequence: z.number().int().positive(),
  state: MissionState,
  workItemId: Uuid.nullable(),
  reasonCode: ReasonCode.nullable(),
});
const MissionControlInput = strictObject({ missionId: Uuid });
const MissionConfirmInput = strictObject({
  previewToken: OpaqueToken,
  boundaryConfirmation: z.boolean(),
});
const none = z.undefined();

export const operations = {
  'missions.eligibleSessions': {
    request: none,
    response: z.array(MissionEligibleSessionView).max(500),
  },
  'missions.preview': {
    request: strictObject({ envelope: MissionEnvelopeInput }),
    response: MissionPreviewView,
  },
  'missions.confirm': { request: MissionConfirmInput, response: MissionDetailView },
  'missions.list': {
    request: strictObject({ limit: z.number().int().min(1).max(100).optional() }).optional(),
    response: z.array(MissionSummaryView),
  },
  'missions.detail': { request: MissionControlInput, response: MissionDetailView },
  'missions.pause': { request: MissionControlInput, response: MissionDetailView },
  'missions.resume': {
    request: strictObject({ missionId: Uuid, supervisorSessionId: Uuid }),
    response: MissionDetailView,
  },
  'missions.cancel': { request: MissionControlInput, response: MissionDetailView },
  'missions.previewRevision': {
    request: strictObject({
      missionId: Uuid,
      expectedVersion: z.number().int().positive(),
      envelope: MissionEnvelopeInput,
    }),
    response: MissionPreviewView,
  },
  'missions.confirmRevision': { request: MissionConfirmInput, response: MissionDetailView },
  'missions.workItem': {
    request: strictObject({ missionId: Uuid, workItemId: Uuid }),
    response: SupervisorWorkDetailView,
  },
  'missions.resolveEscalation': {
    request: z.discriminatedUnion('disposition', [
      strictObject({
        missionId: Uuid,
        workItemId: Uuid.nullable(),
        disposition: z.enum(['keep_paused', 'cancel_work']),
      }),
      strictObject({
        missionId: Uuid,
        workItemId: Uuid,
        disposition: z.literal('acknowledge_unknown'),
        expectedAttemptId: Uuid,
        expectedLeaseId: Uuid,
      }),
    ]),
    response: MissionDetailView,
  },
  'missions.previewDelete': {
    request: MissionControlInput,
    response: strictObject({ previewToken: OpaqueToken, missionId: Uuid, expiresAt: Timestamp }),
  },
  'missions.confirmDelete': {
    request: strictObject({ previewToken: OpaqueToken }),
    response: MissionDetailView,
  },
  'missionComposer.createDraft': {
    request: strictObject({ sourceMissionId: Uuid.optional() }).optional(),
    response: MissionComposerDraftDetailView,
  },
  'missionComposer.listDrafts': {
    request: strictObject({ limit: z.number().int().min(1).max(20).optional() }).optional(),
    response: strictObject({ drafts: z.array(MissionComposerDraftSummaryView).max(20) }),
  },
  'missionComposer.getDraft': {
    request: strictObject({ draftId: Uuid }),
    response: MissionComposerDraftDetailView,
  },
  'missionComposer.updateDraft': {
    request: strictObject({
      draftId: Uuid,
      expectedVersion: z.number().int().positive(),
      fieldValues: MissionComposerFields,
      currentStage: MissionComposerStage,
    }),
    response: MissionComposerSaveReceipt,
  },
  'missionComposer.preview': {
    request: strictObject({ draftId: Uuid, version: z.number().int().positive() }),
    response: strictObject({
      ...MissionPreviewView.shape,
      draftVersion: z.number().int().positive(),
    }),
  },
  'missionComposer.confirm': {
    request: strictObject({
      draftId: Uuid,
      version: z.number().int().positive(),
      previewToken: OpaqueToken,
    }),
    response: MissionDetailView,
  },
  'missionComposer.previewDiscard': {
    request: strictObject({ draftId: Uuid, version: z.number().int().positive() }),
    response: strictObject({
      discardToken: OpaqueToken,
      currentStage: MissionComposerStage,
      expiresAt: Timestamp,
    }),
  },
  'missionComposer.confirmDiscard': {
    request: strictObject({
      draftId: Uuid,
      version: z.number().int().positive(),
      discardToken: OpaqueToken,
    }),
    response: strictObject({
      draftId: Uuid,
      state: z.literal('deleted'),
      version: z.number().int().positive(),
      deletedAt: Timestamp,
    }),
  },
  'workspaces.choose': { request: none, response: WorkspaceCandidateView },
  'workspaces.approve': {
    request: z.object({ candidateToken: OpaqueToken }),
    response: ApprovedWorkspaceView,
  },
  'workspaces.list': { request: none, response: z.array(ApprovedWorkspaceView) },
  'workspaces.revoke': {
    request: z.object({ workspaceId: Uuid }),
    response: ApprovedWorkspaceView,
  },
  'providers.listReadiness': { request: none, response: z.array(ReadinessView) },
  'sessions.previewLaunch': {
    request: strictObject({
      workspaceId: Uuid,
      providerId: ProviderId,
      terminal: TerminalSize,
      runtimeSelection: LaunchRuntimeSelection.default({ model: null, effort: null }),
      workType: LaunchWorkType.default('general'),
      runtimeEscalationReason: z.string().trim().min(20).max(500).nullable().default(null),
      permissionSelection: LaunchPermissionSelection.default({
        policy: null,
        boundedAllowlist: [],
      }),
      executionBounds: ProviderExecutionBounds.default({
        maxElapsedMs: 30 * 60_000,
        maxTurns: 64,
        maxNoProgressMs: 5 * 60_000,
        maxOutputBytes: 8 * 1024 * 1024,
        maxConcurrentProcesses: 1,
      }),
    }),
    response: LaunchPreviewView,
  },
  'sessions.launch': {
    request: z.object({ previewToken: OpaqueToken, boundaryConfirmation: z.boolean() }),
    response: SessionView,
  },
  'sessions.list': {
    request: z.object({ limit: z.number().int().min(1).max(500).optional() }).optional(),
    response: SessionListView,
  },
  'sessions.events': {
    request: z.object({ sessionId: Uuid }),
    response: z.array(SessionEventView),
  },
  'sessions.select': {
    request: z.object({ sessionId: Uuid.nullable() }),
    response: SelectionView,
  },
  'sessions.interrupt': { request: z.object({ sessionId: Uuid }), response: ControlAcceptedView },
  'sessions.requestStop': { request: z.object({ sessionId: Uuid }), response: StopDisclosureView },
  'sessions.confirmStop': {
    request: z.object({ stopToken: OpaqueToken }),
    response: ControlAcceptedView,
  },
  'sessions.requestForceStop': {
    request: z.object({ sessionId: Uuid }),
    response: ForceStopDisclosureView,
  },
  'sessions.confirmForceStop': {
    request: z.object({ forceToken: OpaqueToken }),
    response: ControlAcceptedView,
  },
  'sessions.sendInput': {
    request: z.object({
      sessionId: Uuid,
      bytes: z
        .instanceof(Uint8Array)
        .refine((b) => b.byteLength > 0 && b.byteLength <= MAX_INPUT_BYTES, {
          message: 'input payload out of bounds',
        }),
    }),
    response: ControlAcceptedView,
  },
  'sessions.resize': {
    request: z.object({ sessionId: Uuid, ...TerminalSize.shape }),
    response: ControlAcceptedView,
  },
  'sessions.subscribeOutput': { request: z.object({ sessionId: Uuid }), response: z.boolean() },
  'recovery.resolve': {
    request: z.object({ recordId: Uuid, resolution: RecoveryResolution }),
    response: RecoveryRecordView,
  },
  'coordination.previewHandoff': {
    request: PreviewHandoffRequest,
    response: HandoffPreviewView,
  },
  'coordination.listHandoffs': {
    request: strictObject({ limit: z.number().int().min(1).max(100).optional() }).optional(),
    response: HandoffListView,
  },
  'coordination.confirmHandoff': {
    request: ConfirmHandoffRequest,
    response: HandoffView,
  },
  'coordination.requestPresentation': {
    request: strictObject({ handoffId: HandoffId }),
    response: PresentationDisclosureView,
  },
  'coordination.confirmPresentation': {
    request: ConfirmPresentationRequest,
    response: DeliveryAttemptView,
  },
  'coordination.cancelHandoff': {
    request: CancelHandoffRequest,
    response: HandoffView,
  },
  'coordination.previewRetarget': {
    request: PreviewRetargetRequest,
    response: RetargetDisclosureView,
  },
  'coordination.confirmRetarget': {
    request: ConfirmRetargetRequest,
    response: HandoffView,
  },
  'coordination.listConversations': {
    request: strictObject({
      state: ConversationState.optional(),
      cursor: z.string().max(512).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }).optional(),
    response: ConversationListView,
  },
  'coordination.getConversation': {
    request: strictObject({
      conversationId: ConversationId,
      cursor: z.string().max(512).optional(),
      limit: z.number().int().min(1).max(128).optional(),
    }),
    response: ConversationDetailView,
  },
  'coordination.pauseConversation': {
    request: strictObject({ conversationId: ConversationId }),
    response: ConversationSummaryView,
  },
  'coordination.previewAutoContinue': {
    request: PreviewAutoContinueRequest,
    response: AutoContinueDisclosureView,
  },
  'coordination.confirmAutoContinue': {
    request: ConfirmAutoContinueRequest,
    response: ConversationSummaryView,
  },
  'coordination.resolveEscalation': {
    request: ResolveEscalationRequest,
    response: EscalationView,
  },
  'coordination.requestContentDeletion': {
    request: strictObject({ conversationId: ConversationId }),
    response: DeleteContentDisclosureView,
  },
  'coordination.confirmContentDeletion': {
    request: ConfirmDeleteContentRequest,
    response: ConversationSummaryView,
  },
  'memory.search': {
    request: strictObject({
      scope: MemoryScope,
      query: z.string().trim().min(1).max(500),
      kind: MemoryKind.optional(),
      status: z.enum(['active', 'contested']).optional(),
      includeContested: z.boolean().optional(),
      cursor: z.string().max(512).optional(),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    response: MemorySearchPageView,
  },
  'memory.get': {
    request: strictObject({
      entryId: Uuid,
      scope: MemoryScope,
      revisionId: Uuid.optional(),
    }),
    response: MemoryDetailView,
  },
  'memory.previewPublish': {
    request: PreviewMemoryPublishRequest,
    response: MemoryPublishDisclosureView,
  },
  'memory.confirmPublish': {
    request: ConfirmMemoryPublishRequest,
    response: MemoryDetailView,
  },
  'memory.previewSupersede': {
    request: PreviewMemorySupersedeRequest,
    response: MemorySupersedeDisclosureView,
  },
  'memory.confirmSupersede': {
    request: ConfirmMemorySupersedeRequest,
    response: MemoryDetailView,
  },
  'memory.retract': {
    request: RetractMemoryRequest,
    response: MemoryDetailView,
  },
  'memory.resolveConflict': {
    request: ResolveMemoryConflictRequest,
    response: MemoryDetailView,
  },
  'memory.requestDeletion': {
    request: RequestMemoryDeletionRequest,
    response: MemoryDeletionDisclosureView,
  },
  'memory.confirmDeletion': {
    request: ConfirmMemoryDeletionRequest,
    response: MemoryDetailView,
  },
  'application.requestClose': { request: none, response: CloseResultView },
  'application.stopAllAndClose': { request: none, response: CloseResultView },
  'application.getInfo': { request: none, response: ApplicationInfoView },
  'profiles.chooseFile': {
    request: none,
    response: strictObject({ fileHandle: z.string().min(1).max(256) }),
  },
  'profiles.previewImport': {
    request: PreviewImportProfileRequest,
    response: ProfilePreviewView,
  },
  'profiles.confirmImport': {
    request: ConfirmImportProfileRequest,
    response: AgentProfileSummaryView,
  },
  'profiles.list': {
    request: strictObject({
      state: ProfileState.optional(),
      compatibility: ProfileCompatibility.optional(),
      cursor: z.string().max(512).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }).optional(),
    response: strictObject({
      profiles: z.array(AgentProfileSummaryView).max(100),
      nextCursor: z.string().max(512).nullable(),
    }),
  },
  'profiles.get': {
    request: strictObject({ profileId: ProfileId }),
    response: AgentProfileDetailView,
  },
  'profiles.setEnabled': {
    request: SetProfileEnabledRequest,
    response: AgentProfileSummaryView,
  },
  'profiles.previewDelete': {
    request: strictObject({ profileId: ProfileId }),
    response: ProfileDeletionDisclosureView,
  },
  'profiles.confirmDelete': {
    request: ConfirmDeleteProfileRequest,
    response: AgentProfileSummaryView,
  },
  'workspaceRecon.previewLaunch': {
    request: strictObject({
      workspaceId: Uuid,
      providerId: ProviderId,
      terminal: TerminalSize,
    }),
    response: ReconLaunchPreviewView,
  },
  'workspaceRecon.confirmLaunch': {
    request: strictObject({
      previewToken: OpaqueToken,
      boundaryConfirmation: z.literal(true),
    }),
    response: ReconRunView,
  },
  'workspaceRecon.getRun': {
    request: strictObject({ workspaceId: Uuid }),
    response: ReconRunView.nullable(),
  },
  'agentWizard.createDraft': {
    request: CreateAgentWizardDraftRequest,
    response: AgentWizardDraftDetailView,
  },
  'agentWizard.listDrafts': {
    request: strictObject({
      cursor: z.string().max(512).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }).optional(),
    response: strictObject({
      drafts: z.array(AgentWizardDraftSummaryView).max(50),
      nextCursor: z.string().max(512).nullable(),
    }),
  },
  'agentWizard.getDraft': {
    request: strictObject({ draftId: Uuid }),
    response: AgentWizardDraftDetailView,
  },
  'agentWizard.updateStep': {
    request: UpdateAgentWizardStepRequest,
    response: AgentWizardDraftDetailView,
  },
  'agentWizard.previewCompletion': {
    request: strictObject({
      draftId: Uuid,
      version: z.number().int().positive(),
      action: z.enum(['profile', 'export']),
    }),
    response: AgentWizardCompletionPreviewView,
  },
  'agentWizard.confirmProfile': {
    request: strictObject({ completionToken: OpaqueToken, profileConfirmation: z.literal(true) }),
    response: AgentProfileSummaryView,
  },
  'agentWizard.chooseExportTarget': {
    request: none,
    response: strictObject({ targetHandle: z.string().min(16).max(128) }),
  },
  'agentWizard.previewExport': {
    request: strictObject({
      completionToken: OpaqueToken,
      targetHandle: z.string().min(16).max(128),
    }),
    response: AgentWizardExportPreviewView,
  },
  'agentWizard.confirmExport': {
    request: strictObject({ exportToken: OpaqueToken, overwriteConfirmation: z.boolean() }),
    response: strictObject({
      draftId: Uuid,
      state: z.literal('completed'),
      digest: ProfileDigest,
      completedAt: Timestamp,
    }),
  },
  'agentWizard.deleteDraft': {
    request: strictObject({ draftId: Uuid, version: z.number().int().positive() }),
    response: strictObject({
      draftId: Uuid,
      state: z.literal('deleted'),
      version: z.number().int().positive(),
      deletedAt: Timestamp,
    }),
  },
  'agentTemplates.list': {
    request: strictObject({
      cursor: z.string().max(512).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      state: z.enum(['active', 'disabled']).optional(),
    }).optional(),
    response: strictObject({
      templates: z.array(AgentTemplateSummaryView).max(50),
      nextCursor: z.string().max(512).nullable(),
    }),
  },
  'agentTemplates.get': {
    request: strictObject({ templateId: Uuid }),
    response: AgentTemplateDetailView,
  },
  'agentTemplates.saveRevision': {
    request: strictObject({
      source: z.discriminatedUnion('kind', [
        strictObject({
          kind: z.literal('draft'),
          draftId: Uuid,
          version: z.number().int().positive(),
        }),
        strictObject({ kind: z.literal('profile'), profileRevisionId: Uuid }),
      ]),
      key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
      name: z.string().trim().min(1).max(200),
      variables: z.array(AgentTemplateVariable).max(16).optional(),
      templateId: Uuid.optional(),
      revisionId: Uuid.optional(),
    }).superRefine((value, ctx) => {
      if (Boolean(value.templateId) !== Boolean(value.revisionId))
        ctx.addIssue({ code: 'custom', message: 'templateId and revisionId must be paired' });
    }),
    response: AgentTemplateSummaryView,
  },
  'agentTemplates.duplicate': {
    request: strictObject({
      templateRevisionId: Uuid,
      key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
      name: AuthoredText.trim().min(1).max(200),
    }),
    response: AgentTemplateSummaryView,
  },
  'agentTemplates.setEnabled': {
    request: strictObject({ templateId: Uuid, revisionId: Uuid, enabled: z.boolean() }),
    response: AgentTemplateSummaryView,
  },
  'agentTemplates.previewDelete': {
    request: strictObject({ templateId: Uuid, revisionId: Uuid }),
    response: AgentTemplateDeletePreviewView,
  },
  'agentTemplates.delete': {
    request: strictObject({ deleteToken: OpaqueToken, deleteConfirmation: z.literal(true) }),
    response: AgentTemplateSummaryView,
  },
} as const satisfies Record<OperationName, { request: z.ZodType; response: z.ZodType }>;

export type OperationRequest<N extends OperationName> = z.input<(typeof operations)[N]['request']>;
export type OperationResponse<N extends OperationName> = z.output<
  (typeof operations)[N]['response']
>;

// ---------------------------------------------------------------------------
// Main → renderer events
// ---------------------------------------------------------------------------

export const events = {
  'mission.changed': MissionChangedEvent,
  'missionComposer.changed': MissionComposerChangedEvent,
  'workspace.changed': ApprovedWorkspaceView,
  'provider.readinessChanged': ReadinessView,
  'session.changed': z.object({
    session: SessionView,
    reasonCode: ReasonCode,
    sequence: z.number(),
  }),
  'session.activityChanged': z.object({
    sessionId: Uuid,
    activityState: ActivityState,
    evidenceKind: z.string(),
    observedAt: Timestamp.nullable(),
  }),
  'session.outputTruncated': z.object({ sessionId: Uuid, truncationCount: z.number().int() }),
  'session.interruptResult': z.object({ sessionId: Uuid, outcome: InterruptOutcome }),
  'recovery.changed': RecoveryRecordView,
  'application.powerChanged': z.object({
    event: PowerEvent,
    reconciled: z.number().int(),
    recoveryRequired: z.number().int(),
  }),
  'application.storageHealth': z.object({ degraded: z.boolean(), reasonCode: ReasonCode }),
  'application.closeBlocked': CloseResultView,
  'coordination.handoffChanged': CoordinationEventEnvelope,
  'coordination.conversationChanged': ConversationSummaryView,
  'coordination.escalationChanged': EscalationView,
  'memory.changed': MemoryChangedEvent,
  'memory.conflictChanged': MemoryConflictChangedEvent,
  'profiles.changed': ProfileEventEnvelope,
  'agentWizard.changed': AgentWizardChangedEvent,
  'agentTemplates.changed': AgentTemplatesChangedEvent,
  'coordination.bridgeChanged': strictObject({
    sessionId: Uuid,
    capability: z.string(),
    connected: z.boolean(),
    reasonCode: ReasonCode.nullable(),
  }),
} as const satisfies Record<EventName, z.ZodType>;

export type EventPayload<N extends EventName> = z.output<(typeof events)[N]>;

// ---------------------------------------------------------------------------
// Terminal stream frames (host ↔ renderer over a session MessagePort)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Provider adapter data (contracts/provider-adapter.md)
// ---------------------------------------------------------------------------

export const LaunchDescriptor = z.object({
  executable: z.string().min(1),
  args: z.array(z.string()),
  cwd: z.string().min(1),
  environmentPolicy: z.literal('inherit-sanitized'),
  terminal: TerminalSize,
});
export type LaunchDescriptor = z.infer<typeof LaunchDescriptor>;

/** Adapter-owned, bounded clean-stop recipe. Text is written to the PTY. */
export const CleanStopAction = z.object({
  writes: z.array(z.string().max(64)).max(4),
  graceMs: z.number().int().min(1000).max(60_000),
});
export type CleanStopAction = z.infer<typeof CleanStopAction>;

export const ActivityEvidence = z.object({
  state: ActivityState,
  evidenceKind: z.string().min(1),
  observedAt: Timestamp,
});
export type ActivityEvidence = z.infer<typeof ActivityEvidence>;

// ---------------------------------------------------------------------------
// Session host protocol (contracts/session-host.md)
// ---------------------------------------------------------------------------

const hostBase = { sessionId: Uuid, protocolVersion: z.literal(PROTOCOL_VERSION) };
const controlBase = { ...hostBase, controlSequence: z.number().int().min(1) };

export const MainToHostMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('host.bootstrap'),
    ...hostBase,
    bootstrapSecret: OpaqueToken,
  }),
  z.object({
    type: z.literal('host.launch'),
    ...hostBase,
    bootstrapSecret: OpaqueToken,
    descriptor: LaunchDescriptor,
    outputBudget: strictObject({
      attemptId: Uuid,
      maxOutputBytes: z
        .number()
        .int()
        .min(1)
        .max(64 * 1024 * 1024),
    }).optional(),
  }),
  z.object({
    type: z.literal('host.input'),
    ...controlBase,
    bytes: Bytes,
  }),
  z.object({ type: z.literal('host.resize'), ...controlBase, ...TerminalSize.shape }),
  z.object({ type: z.literal('host.interrupt'), ...controlBase }),
  z.object({ type: z.literal('host.cleanStop'), ...controlBase, action: CleanStopAction }),
  z.object({ type: z.literal('host.pauseOutput'), ...hostBase }),
  z.object({ type: z.literal('host.resumeOutput'), ...hostBase }),
  strictObject({
    type: z.literal('host.setOutputBudget'),
    ...hostBase,
    attemptId: Uuid,
    maxOutputBytes: z
      .number()
      .int()
      .min(1)
      .max(64 * 1024 * 1024),
  }),
  strictObject({ type: z.literal('host.clearOutputBudget'), ...hostBase, attemptId: Uuid }),
  z.object({ type: z.literal('host.shutdown'), ...hostBase }),
]);
export type MainToHostMessage = z.infer<typeof MainToHostMessage>;

export const HostFailureCode = z.enum([
  'HOST_ALREADY_LAUNCHED',
  'HOST_IDENTITY_MISMATCH',
  'HOST_BAD_SECRET',
  'HOST_INVALID_MESSAGE',
  'HOST_LAUNCH_TIMEOUT',
  'PTY_CREATE_FAILED',
  'PTY_WRITE_FAILED',
  'STREAM_VIOLATION',
  'INPUT_REJECTED',
]);
export type HostFailureCode = z.infer<typeof HostFailureCode>;

export const HostToMainMessage = z.discriminatedUnion('type', [
  strictObject({
    type: z.literal('host.outputProgress'),
    sessionId: Uuid,
    attemptId: Uuid.nullable(),
    totalOutputBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    outputBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    sequence: z.number().int().positive(),
    limitReached: z.boolean(),
  }),
  z.object({
    type: z.literal('host.ready'),
    sessionId: Uuid,
    hostPid: z.number().int().positive(),
    protocolVersion: z.number().int(),
  }),
  z.object({
    type: z.literal('host.launched'),
    sessionId: Uuid,
    rootPid: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('host.exit'),
    sessionId: Uuid,
    exitCode: z.number().int().nullable(),
    drained: z.boolean(),
  }),
  z.object({
    type: z.literal('host.controlApplied'),
    sessionId: Uuid,
    controlSequence: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('host.cleanStopTimeout'),
    sessionId: Uuid,
    controlSequence: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('host.outputTruncated'),
    sessionId: Uuid,
    truncationCount: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('host.failure'),
    sessionId: Uuid,
    code: HostFailureCode,
    detail: z.string().max(200).optional(),
  }),
]);
export type HostToMainMessage = z.infer<typeof HostToMainMessage>;

/** Fixed disclosure text shown before every launch (FR-004). */
export const BOUNDARY_WARNING =
  'ThreadHelm starts this agent with the approved folder as its working directory, but it cannot ' +
  'technically confine the agent to that folder. The agent may read or change files elsewhere ' +
  'and may make its own network requests. Confirm this session only if that is acceptable.';

/** Fixed force-stop risk text (FR-014). */
export const FORCE_STOP_RISK =
  'Force stop terminates every process in this session immediately. Unsaved work inside the ' +
  'agent and any files it is writing may be left inconsistent.';
