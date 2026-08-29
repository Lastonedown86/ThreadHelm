/**
 * SQLite schema (T019). One migration per version; CHECK constraints are built
 * from the contracts enums so the database and the wire types cannot drift.
 */

import {
  AccessMode,
  ActivityState,
  Actor,
  Authentication,
  Availability,
  DriveType,
  ConversationState,
  CoordinationEventKind,
  DeliveryAttemptState,
  DeliveryState,
  EscalationKind,
  EscalationState,
  EventKind,
  HandoffKind,
  HandoffOrigin,
  LifecycleState,
  ProviderId,
  RecoveryClassification,
  RecoveryResolution,
  StopKind,
  WorkOutcome,
} from '@threadhelm/contracts';

export const SCHEMA_VERSION = 2;

const inList = (values: readonly string[]): string =>
  `IN (${values.map((v) => `'${v}'`).join(', ')})`;

const V1 = `
CREATE TABLE schema_meta (
  version INTEGER NOT NULL
);

CREATE TABLE approved_workspaces (
  id TEXT PRIMARY KEY,
  selected_path TEXT NOT NULL,
  display_path TEXT NOT NULL,
  canonical_path TEXT NOT NULL,
  volume_serial TEXT NOT NULL,
  file_id TEXT NOT NULL,
  drive_type TEXT NOT NULL CHECK (drive_type ${inList(DriveType.options)}),
  approved_at TEXT NOT NULL,
  last_validated_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE UNIQUE INDEX approved_workspaces_active_identity
  ON approved_workspaces (volume_serial, file_id) WHERE revoked_at IS NULL;

CREATE TABLE agent_definitions (
  id TEXT PRIMARY KEY CHECK (id ${inList(ProviderId.options)}),
  display_name TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  executable_candidates TEXT NOT NULL,
  tested_version_range TEXT NOT NULL,
  capabilities TEXT NOT NULL
);

CREATE TABLE agent_readiness_snapshots (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES agent_definitions (id),
  resolved_executable TEXT,
  version TEXT,
  availability TEXT NOT NULL CHECK (availability ${inList(Availability.options)}),
  authentication TEXT NOT NULL CHECK (authentication ${inList(Authentication.options)}),
  probed_at TEXT NOT NULL,
  reason_code TEXT,
  safe_summary TEXT NOT NULL
);

CREATE TABLE agent_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES approved_workspaces (id),
  definition_id TEXT NOT NULL REFERENCES agent_definitions (id),
  readiness_snapshot_id TEXT NOT NULL REFERENCES agent_readiness_snapshots (id),
  access_mode TEXT NOT NULL CHECK (access_mode ${inList(AccessMode.options)}),
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state ${inList(LifecycleState.options)}),
  activity_state TEXT NOT NULL CHECK (activity_state ${inList(ActivityState.options)}),
  activity_evidence_kind TEXT NOT NULL DEFAULT 'none',
  activity_observed_at TEXT,
  host_pid INTEGER,
  root_pid INTEGER,
  columns INTEGER NOT NULL CHECK (columns > 0),
  rows INTEGER NOT NULL CHECK (rows > 0),
  started_at TEXT,
  ended_at TEXT,
  exit_code INTEGER,
  stop_kind TEXT CHECK (stop_kind IS NULL OR stop_kind ${inList(StopKind.options)}),
  truncation_count INTEGER NOT NULL DEFAULT 0 CHECK (truncation_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX agent_sessions_lifecycle ON agent_sessions (lifecycle_state);
CREATE INDEX agent_sessions_workspace ON agent_sessions (workspace_id);

CREATE TABLE session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES agent_sessions (id),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  kind TEXT NOT NULL CHECK (kind ${inList(EventKind.options)}),
  from_state TEXT CHECK (from_state IS NULL OR from_state ${inList(LifecycleState.options)}),
  to_state TEXT CHECK (to_state IS NULL OR to_state ${inList(LifecycleState.options)}),
  actor TEXT NOT NULL CHECK (actor ${inList(Actor.options)}),
  reason_code TEXT,
  safe_summary TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  UNIQUE (session_id, sequence)
);

CREATE TABLE recovery_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES agent_sessions (id),
  last_known_state TEXT NOT NULL CHECK (last_known_state ${inList(LifecycleState.options)}),
  classification TEXT NOT NULL CHECK (classification ${inList(RecoveryClassification.options)}),
  reason_code TEXT NOT NULL,
  safe_summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution TEXT CHECK (resolution IS NULL OR resolution ${inList(RecoveryResolution.options)})
);
CREATE UNIQUE INDEX recovery_records_unresolved_session
  ON recovery_records (session_id) WHERE resolved_at IS NULL;
`;

const V2 = `
CREATE TABLE coordination_conversations (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state ${inList(ConversationState.options)}),
  root_handoff_id TEXT REFERENCES coordination_handoffs (id) DEFERRABLE INITIALLY DEFERRED,
  auto_continue_enabled INTEGER NOT NULL DEFAULT 0 CHECK (auto_continue_enabled IN (0, 1)),
  auto_reply_depth_limit INTEGER NOT NULL DEFAULT 8 CHECK (auto_reply_depth_limit = 8),
  consecutive_delivery_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_delivery_failures >= 0),
  pause_reason_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  closed_at TEXT,
  content_deleted_at TEXT,
  CHECK (state <> 'paused' OR pause_reason_code IS NOT NULL),
  CHECK (state <> 'resolved' OR resolved_at IS NOT NULL),
  CHECK (state <> 'closed' OR closed_at IS NOT NULL)
);
CREATE INDEX coordination_conversations_state_updated
  ON coordination_conversations (state, updated_at);

CREATE TABLE coordination_handoffs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES coordination_conversations (id) ON DELETE RESTRICT,
  in_reply_to_id TEXT REFERENCES coordination_handoffs (id) ON DELETE RESTRICT,
  sender_session_id TEXT NOT NULL REFERENCES agent_sessions (id) ON DELETE RESTRICT,
  recipient_session_id TEXT NOT NULL REFERENCES agent_sessions (id) ON DELETE RESTRICT,
  sender_workspace_id_at_create TEXT NOT NULL REFERENCES approved_workspaces (id) ON DELETE RESTRICT,
  recipient_workspace_id_at_create TEXT NOT NULL REFERENCES approved_workspaces (id) ON DELETE RESTRICT,
  origin TEXT NOT NULL CHECK (origin ${inList(HandoffOrigin.options)}),
  kind TEXT NOT NULL CHECK (kind ${inList(HandoffKind.options)}),
  requires_reply INTEGER NOT NULL CHECK (requires_reply IN (0, 1)),
  purpose TEXT,
  body TEXT,
  content_bytes INTEGER,
  content_fingerprint BLOB,
  reply_depth INTEGER NOT NULL DEFAULT 0 CHECK (reply_depth >= 0),
  delivery_state TEXT NOT NULL CHECK (delivery_state ${inList(DeliveryState.options)}),
  work_outcome TEXT NOT NULL DEFAULT 'pending' CHECK (work_outcome ${inList(WorkOutcome.options)}),
  hold_reason_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT,
  acknowledged_at TEXT,
  content_deleted_at TEXT,
  CHECK (sender_session_id <> recipient_session_id),
  CHECK ((purpose IS NULL AND body IS NULL AND content_bytes IS NULL AND content_fingerprint IS NULL)
      OR (purpose IS NOT NULL AND body IS NOT NULL AND content_bytes > 0
          AND content_fingerprint IS NOT NULL AND length(content_fingerprint) = 32)),
  CHECK (kind NOT IN ('request', 'query') OR requires_reply = 1),
  CHECK (kind NOT IN ('completion', 'refusal', 'failure') OR requires_reply = 0),
  CHECK (delivery_state NOT IN ('held', 'manual_actionable') OR hold_reason_code IS NOT NULL)
);
CREATE INDEX coordination_handoffs_conversation_created
  ON coordination_handoffs (conversation_id, created_at, id);
CREATE INDEX coordination_handoffs_recipient_delivery
  ON coordination_handoffs (recipient_session_id, delivery_state);

CREATE TABLE coordination_delivery_attempts (
  id TEXT PRIMARY KEY,
  handoff_id TEXT NOT NULL REFERENCES coordination_handoffs (id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  recipient_session_id TEXT NOT NULL REFERENCES agent_sessions (id) ON DELETE RESTRICT,
  recipient_workspace_id_at_review TEXT NOT NULL REFERENCES approved_workspaces (id) ON DELETE RESTRICT,
  lifecycle_state_at_review TEXT NOT NULL CHECK (lifecycle_state_at_review ${inList(LifecycleState.options)}),
  activity_state_at_review TEXT NOT NULL CHECK (activity_state_at_review ${inList(ActivityState.options)}),
  activity_evidence_kind_at_review TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state ${inList(DeliveryAttemptState.options)}),
  control_sequence INTEGER CHECK (control_sequence IS NULL OR control_sequence >= 1),
  evidence_kind TEXT NOT NULL,
  reason_code TEXT,
  created_at TEXT NOT NULL,
  submitted_at TEXT,
  completed_at TEXT,
  UNIQUE (handoff_id, attempt_number),
  CHECK (state NOT IN ('failed_before_write', 'unknown') OR reason_code IS NOT NULL),
  CHECK (state <> 'dispatching' OR submitted_at IS NOT NULL),
  CHECK (state NOT IN ('applied', 'failed_before_write', 'unknown') OR completed_at IS NOT NULL)
);
CREATE UNIQUE INDEX coordination_attempts_one_active
  ON coordination_delivery_attempts (handoff_id) WHERE state IN ('prepared', 'dispatching');
CREATE UNIQUE INDEX coordination_attempts_one_applied
  ON coordination_delivery_attempts (handoff_id) WHERE state = 'applied';
CREATE INDEX coordination_attempts_state_created
  ON coordination_delivery_attempts (state, created_at);

CREATE TABLE coordination_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES coordination_conversations (id) ON DELETE RESTRICT,
  handoff_id TEXT REFERENCES coordination_handoffs (id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  kind TEXT NOT NULL CHECK (kind ${inList(CoordinationEventKind.options)}),
  actor TEXT NOT NULL CHECK (actor IN ('user', 'threadhelm', 'provider')),
  reason_code TEXT,
  safe_summary TEXT NOT NULL CHECK (length(safe_summary) BETWEEN 1 AND 300),
  occurred_at TEXT NOT NULL,
  UNIQUE (conversation_id, sequence)
);

CREATE TABLE coordination_escalations (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES coordination_conversations (id) ON DELETE RESTRICT,
  handoff_id TEXT REFERENCES coordination_handoffs (id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind ${inList(EscalationKind.options)}),
  state TEXT NOT NULL CHECK (state ${inList(EscalationState.options)}),
  reason_code TEXT NOT NULL,
  safe_summary TEXT NOT NULL CHECK (length(safe_summary) BETWEEN 1 AND 300),
  opened_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution TEXT CHECK (resolution IS NULL OR resolution IN ('continue', 'redirect', 'close')),
  CHECK ((state = 'open' AND resolved_at IS NULL AND resolution IS NULL)
      OR (state <> 'open' AND resolved_at IS NOT NULL AND resolution IS NOT NULL))
);
CREATE UNIQUE INDEX coordination_escalations_one_open
  ON coordination_escalations (conversation_id) WHERE state = 'open';
`;

export const MIGRATIONS: readonly { version: number; sql: string }[] = [
  { version: 1, sql: V1 },
  { version: 2, sql: V2 },
];
