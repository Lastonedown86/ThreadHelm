/**
 * Shared contracts (T009): Zod schemas, operation/event names, host protocol,
 * stream frames, stable error codes, and the tuning constants every process
 * agrees on. Nothing here touches Electron, the filesystem, or a database.
 *
 * Source of truth: specs/001-local-agent-workspace/contracts/*.md
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants (configuration, not user customization — research.md Decision 5)
// ---------------------------------------------------------------------------

export const PROTOCOL_VERSION = 1;
export const SCROLLBACK_LINES = 10_000;
export const MAX_UNACKED_BYTES = 8 * 1024 * 1024;
export const HIGH_WATERMARK_BYTES = 6 * 1024 * 1024;
export const LOW_WATERMARK_BYTES = 2 * 1024 * 1024;
export const MAX_FRAME_BYTES = 64 * 1024;
export const MAX_INPUT_BYTES = 64 * 1024;
export const MAX_COLUMNS = 1000;
export const MAX_ROWS = 500;
/** Candidate, preview, stop, and force-stop tokens all expire after this. */
export const TOKEN_TTL_MS = 120_000;
/** Bounded grace period for a clean stop before force stop is offered. */
export const STOP_GRACE_MS = 15_000;
/** How long an interrupt is observed before it is reported unresponsive. */
export const INTERRUPT_OBSERVE_MS = 5_000;
/** Bounded provider probe budget. */
export const PROBE_TIMEOUT_MS = 10_000;
/** Ceiling on a hire manifest's requested token budget (agent-profiles.md). */
export const MAX_TOKEN_CAP = 2_000_000;
/** Bounded length for reviewed free-text manifest fields (goal, description). */
export const MAX_GOAL_LENGTH = 4_000;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const ProviderId = z.enum(['codex-cli', 'claude-code']);
export type ProviderId = z.infer<typeof ProviderId>;

/** Portable hire-provider labels are data, not runtime adapter identifiers. */
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

export const Uuid = z.uuid();
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
/** Plain `Uint8Array` (any buffer kind) — structured-clone safe across IPC. */
export const Bytes = z.custom<Uint8Array>((value) => value instanceof Uint8Array, 'expected bytes');
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
  id: z.string().trim().min(1).max(512),
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
// Agent profiles (contracts/agent-profiles.md). A hire manifest is untrusted
// portable data, never an instruction. `effort` is launch policy and is
// deliberately absent; capability labels and the display name never grant
// tools, roles, or budget expansion.
// ---------------------------------------------------------------------------

const ProfileCapabilityLabel = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, 'capability labels are inert lowercase routing tags');

const ProfileModelId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, 'invalid provider model identifier');

const ProfileDigest = z.string().regex(/^[0-9a-f]{64}$/, 'expected a SHA-256 hex digest');
const ProfileDigestPrefix = z.string().regex(/^[0-9a-f]{12}$/, 'expected a 12-hex digest prefix');

export const HireManifestV1 = strictObject({
  spec: z.literal('munder-difflin/hire@1'),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(MAX_GOAL_LENGTH),
  provider: ProfileProviderId,
  model: ProfileModelId,
  goal: z.string().trim().min(1).max(MAX_GOAL_LENGTH),
  capabilities: z.array(ProfileCapabilityLabel).max(16),
  isolate: z.boolean(),
  tokenCap: z.number().int().positive().max(MAX_TOKEN_CAP),
  author: z.string().trim().min(1).max(200),
});
export type HireManifestV1 = z.infer<typeof HireManifestV1>;

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
  manifestSpec: z.literal('munder-difflin/hire@1'),
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

/** Accepts only a renderer file-selection handle, never arbitrary provider input. */
export const PreviewImportProfileRequest = strictObject({
  fileHandle: z.string().min(1).max(256),
});
export type PreviewImportProfileRequest = z.infer<typeof PreviewImportProfileRequest>;

export const ProfilePreviewView = strictObject({
  previewToken: OpaqueToken,
  digest: ProfileDigest,
  basename: z.string().min(1).max(255),
  normalized: HireManifestV1,
  warnings: z.array(z.string().max(300)).max(20),
  compatibility: ProfileCompatibility,
  compatibilityReasons: z.array(z.string().max(300)).max(20),
  expiresAt: Timestamp,
});
export type ProfilePreviewView = z.infer<typeof ProfilePreviewView>;

export const ConfirmImportProfileRequest = strictObject({
  previewToken: OpaqueToken,
  importConfirmation: z.literal(true),
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
// Request/response operations. One entry per preload method; main validates
// every request against `request` before doing anything else.
// ---------------------------------------------------------------------------

const none = z.undefined();

export const operations = {
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
} as const;

export type OperationName = keyof typeof operations;
export type OperationRequest<N extends OperationName> = z.input<(typeof operations)[N]['request']>;
export type OperationResponse<N extends OperationName> = z.output<
  (typeof operations)[N]['response']
>;
export const operationNames = Object.keys(operations) as OperationName[];

// ---------------------------------------------------------------------------
// Main → renderer events
// ---------------------------------------------------------------------------

export const events = {
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
  'coordination.bridgeChanged': strictObject({
    sessionId: Uuid,
    capability: z.string(),
    connected: z.boolean(),
    reasonCode: ReasonCode.nullable(),
  }),
} as const;

export type EventName = keyof typeof events;
export type EventPayload<N extends EventName> = z.output<(typeof events)[N]>;
export const eventNames = Object.keys(events) as EventName[];

/** Channel that carries a transferred MessagePort for one session's output. */
export const STREAM_PORT_CHANNEL = 'session.streamPort';

// ---------------------------------------------------------------------------
// Terminal stream frames (host ↔ renderer over a session MessagePort)
// ---------------------------------------------------------------------------

export const OutputFrame = z.object({
  kind: z.literal('output'),
  sessionId: Uuid,
  sequence: z.number().int().min(1),
  bytes: Bytes.refine((b) => b.byteLength <= MAX_FRAME_BYTES, {
    message: 'frame exceeds MAX_FRAME_BYTES',
  }),
});
export type OutputFrame = z.infer<typeof OutputFrame>;

export const OutputAck = z.object({
  kind: z.literal('ack'),
  sessionId: Uuid,
  throughSequence: z.number().int().min(0),
});
export type OutputAck = z.infer<typeof OutputAck>;

/** Sent by the host when output had to be discarded; count is cumulative. */
export const OutputTruncated = z.object({
  kind: z.literal('truncated'),
  sessionId: Uuid,
  truncationCount: z.number().int().min(1),
});
export type OutputTruncated = z.infer<typeof OutputTruncated>;

export const StreamFrame = z.discriminatedUnion('kind', [OutputFrame, OutputAck, OutputTruncated]);
export type StreamFrame = z.infer<typeof StreamFrame>;

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
