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

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const ProviderId = z.enum(['codex-cli', 'claude-code']);
export type ProviderId = z.infer<typeof ProviderId>;

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
/** Plain `Uint8Array` (any buffer kind) — structured-clone safe across IPC. */
export const Bytes = z.custom<Uint8Array>((value) => value instanceof Uint8Array, 'expected bytes');
export const Timestamp = z.iso.datetime();
export const OpaqueToken = z.string().min(16).max(128);
export const SafeSummary = z.string().max(300);
export const ReasonCode = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{2,63}$/)
  .nullable();

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
    request: z.object({ workspaceId: Uuid, providerId: ProviderId, terminal: TerminalSize }),
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
  'application.requestClose': { request: none, response: CloseResultView },
  'application.stopAllAndClose': { request: none, response: CloseResultView },
  'application.getInfo': { request: none, response: ApplicationInfoView },
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
