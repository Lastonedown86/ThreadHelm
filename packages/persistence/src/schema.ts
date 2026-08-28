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
  EventKind,
  LifecycleState,
  ProviderId,
  RecoveryClassification,
  RecoveryResolution,
  StopKind,
} from '@threadhelm/contracts';

export const SCHEMA_VERSION = 1;

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

export const MIGRATIONS: readonly { version: number; sql: string }[] = [{ version: 1, sql: V1 }];
