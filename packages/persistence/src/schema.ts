/**
 * SQLite schema (T019). One migration per version; CHECK constraints are built
 * from the contracts enums so the database and the wire types cannot drift.
 */

import { V3_SUPERVISOR } from './supervisor-schema.js';
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
  MemoryConfidence,
  MemoryKind,
  MemoryStatus,
  ProfileCompatibility,
  ProfileProviderId,
  ProfileState,
  ProviderId,
  RecoveryClassification,
  RecoveryResolution,
  StopKind,
  WorkOutcome,
} from '@threadhelm/contracts';

export const SCHEMA_VERSION = 5;

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

const V3 = `
CREATE TABLE shared_memory_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES approved_workspaces (id) ON DELETE RESTRICT,
  mission_id TEXT,
  kind TEXT NOT NULL CHECK (kind ${inList(MemoryKind.options)}),
  status TEXT NOT NULL CHECK (status ${inList(MemoryStatus.options)}),
  current_revision_id TEXT,
  created_by_session_id TEXT REFERENCES agent_sessions (id) ON DELETE RESTRICT,
  created_by_user INTEGER NOT NULL CHECK (created_by_user IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT,
  expired_at TEXT,
  content_deleted_at TEXT,
  CHECK ((workspace_id IS NOT NULL AND mission_id IS NULL)
      OR (workspace_id IS NULL AND mission_id IS NOT NULL)),
  CHECK ((created_by_session_id IS NOT NULL AND created_by_user = 0)
      OR (created_by_session_id IS NULL AND created_by_user = 1)),
  CHECK ((status = 'deleted' AND current_revision_id IS NULL AND content_deleted_at IS NOT NULL)
      OR (status <> 'deleted' AND current_revision_id IS NOT NULL))
);
CREATE INDEX shared_memory_entries_scope_status
  ON shared_memory_entries (workspace_id, mission_id, status, updated_at, id);
CREATE INDEX shared_memory_entries_expiry
  ON shared_memory_entries (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE shared_memory_revisions (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES shared_memory_entries (id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  title TEXT CHECK (title IS NULL OR length(title) <= 160),
  body TEXT,
  source_refs TEXT NOT NULL,
  author_session_id TEXT REFERENCES agent_sessions (id) ON DELETE RESTRICT,
  author_user INTEGER NOT NULL CHECK (author_user IN (0, 1)),
  confidence TEXT NOT NULL CHECK (confidence ${inList(MemoryConfidence.options)}),
  status TEXT NOT NULL CHECK (status ${inList(MemoryStatus.options)}),
  supersedes_revision_id TEXT REFERENCES shared_memory_revisions (id) ON DELETE RESTRICT,
  content_bytes INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE (entry_id, revision),
  CHECK ((author_session_id IS NOT NULL AND author_user = 0)
      OR (author_session_id IS NULL AND author_user = 1)),
  CHECK ((status = 'deleted' AND title IS NULL AND body IS NULL AND source_refs = '[]'
          AND content_bytes IS NULL)
      OR (status <> 'deleted' AND body IS NOT NULL AND content_bytes > 0))
);
CREATE INDEX shared_memory_revisions_entry_revision
  ON shared_memory_revisions (entry_id, revision DESC);
CREATE INDEX shared_memory_revisions_status_created
  ON shared_memory_revisions (status, created_at DESC, id DESC);
CREATE UNIQUE INDEX shared_memory_revisions_one_searchable_current
  ON shared_memory_revisions (entry_id) WHERE status IN ('active', 'contested');

CREATE TABLE memory_conflicts (
  id TEXT PRIMARY KEY,
  left_revision_id TEXT NOT NULL REFERENCES shared_memory_revisions (id) ON DELETE RESTRICT,
  right_revision_id TEXT NOT NULL REFERENCES shared_memory_revisions (id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK (state IN ('open', 'resolved')),
  reason_code TEXT NOT NULL,
  resolved_by_revision_id TEXT REFERENCES shared_memory_revisions (id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  CHECK (left_revision_id <> right_revision_id),
  CHECK ((state = 'open' AND resolved_by_revision_id IS NULL AND resolved_at IS NULL)
      OR (state = 'resolved' AND resolved_by_revision_id IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE UNIQUE INDEX memory_conflicts_one_open_pair
  ON memory_conflicts (left_revision_id, right_revision_id) WHERE state = 'open';
CREATE INDEX memory_conflicts_state_created ON memory_conflicts (state, created_at, id);

CREATE TABLE shared_memory_scope_quotas (
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('workspace', 'mission')),
  scope_id TEXT NOT NULL,
  active_revision_count INTEGER NOT NULL DEFAULT 0 CHECK (active_revision_count >= 0),
  retained_content_bytes INTEGER NOT NULL DEFAULT 0 CHECK (retained_content_bytes >= 0),
  PRIMARY KEY (scope_kind, scope_id)
);

CREATE VIRTUAL TABLE shared_memory_fts USING fts5(
  revision_id UNINDEXED,
  entry_id UNINDEXED,
  title,
  body,
  tokenize = 'unicode61'
);

CREATE TRIGGER shared_memory_revisions_immutable
BEFORE UPDATE ON shared_memory_revisions
WHEN NEW.id <> OLD.id
  OR NEW.entry_id <> OLD.entry_id
  OR NEW.revision <> OLD.revision
  OR NEW.author_session_id IS NOT OLD.author_session_id
  OR NEW.author_user <> OLD.author_user
  OR NEW.confidence <> OLD.confidence
  OR NEW.supersedes_revision_id IS NOT OLD.supersedes_revision_id
  OR NEW.created_at <> OLD.created_at
  OR (NEW.status <> 'deleted' AND (
       NEW.title IS NOT OLD.title OR NEW.body IS NOT OLD.body
       OR NEW.source_refs <> OLD.source_refs OR NEW.content_bytes IS NOT OLD.content_bytes))
BEGIN
  SELECT RAISE(ABORT, 'shared memory revisions are immutable');
END;

CREATE TRIGGER shared_memory_revisions_fts_insert
AFTER INSERT ON shared_memory_revisions
WHEN NEW.status IN ('active', 'contested') AND NEW.body IS NOT NULL
BEGIN
  INSERT INTO shared_memory_fts (revision_id, entry_id, title, body)
  VALUES (NEW.id, NEW.entry_id, COALESCE(NEW.title, ''), NEW.body);
END;

CREATE TRIGGER shared_memory_revisions_fts_update
AFTER UPDATE ON shared_memory_revisions
BEGIN
  DELETE FROM shared_memory_fts WHERE revision_id = OLD.id;
  INSERT INTO shared_memory_fts (revision_id, entry_id, title, body)
  SELECT NEW.id, NEW.entry_id, COALESCE(NEW.title, ''), NEW.body
  WHERE NEW.status IN ('active', 'contested') AND NEW.body IS NOT NULL;
END;

CREATE TRIGGER shared_memory_revisions_fts_delete
AFTER DELETE ON shared_memory_revisions
BEGIN
  DELETE FROM shared_memory_fts WHERE revision_id = OLD.id;
END;
`;

// Migration text is a historical record: this is the literal body of the
// version-3 migration and of a v3 database's agent_profiles table. It must
// never change shape, even when the "current" shape (see CURRENT_AGENT_PROFILES
// below) gains columns later, or the record of what that migration actually
// did becomes a lie.
const V3_AGENT_PROFILES = `
CREATE TABLE agent_profiles (
  id TEXT PRIMARY KEY,
  manifest_key TEXT NOT NULL,
  current_revision_id TEXT,
  state TEXT NOT NULL CHECK (state ${inList(ProfileState.options)}),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX agent_profiles_manifest_key ON agent_profiles (manifest_key);

CREATE TABLE agent_profile_revisions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES agent_profiles (id) ON DELETE RESTRICT,
  digest TEXT NOT NULL CHECK (length(digest) = 64),
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  requested_provider TEXT NOT NULL CHECK (requested_provider ${inList(ProfileProviderId.options)}),
  requested_model TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  isolate_requested INTEGER NOT NULL CHECK (isolate_requested IN (0, 1)),
  token_cap_requested INTEGER NOT NULL CHECK (token_cap_requested > 0),
  author TEXT NOT NULL,
  goal TEXT NOT NULL,
  manifest_spec TEXT NOT NULL,
  compatibility TEXT NOT NULL CHECK (compatibility ${inList(ProfileCompatibility.options)}),
  compatibility_reasons TEXT NOT NULL DEFAULT '[]',
  source_basename TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (profile_id, digest)
);
CREATE INDEX agent_profile_revisions_profile_created
  ON agent_profile_revisions (profile_id, created_at, id);

CREATE TABLE mission_profile_pins (
  mission_id TEXT NOT NULL,
  profile_id TEXT NOT NULL REFERENCES agent_profiles (id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES agent_profile_revisions (id) ON DELETE RESTRICT,
  pinned_at TEXT NOT NULL,
  PRIMARY KEY (mission_id, profile_id)
);
CREATE INDEX mission_profile_pins_profile ON mission_profile_pins (profile_id);
`;

// Assumes agent_profiles already exists — every real version-3 database has
// it (it shipped in the same migration, see V3_AGENT_PROFILES above). A v3
// database that is somehow missing agent_profiles will fail this ALTER with
// a raw SqliteError, because the migration runner applies pending migrations
// before it repairs missing CURRENT_SCHEMA_EXTENSIONS tables (see migrate.ts).
// Known limitation, not fixed here: see tests/unit/persistence/workspace-recon.test.ts
// "fails to migrate a v3 database that is missing agent_profiles (known limitation)".
const V4_RECON_PROVENANCE = `
ALTER TABLE agent_profiles ADD COLUMN recon_run_id TEXT;
ALTER TABLE agent_profiles ADD COLUMN derived_from_commit TEXT;
`;

const V5_MISSION_COMPOSER = `
CREATE TABLE mission_composer_drafts (
  id TEXT PRIMARY KEY,
  source_mission_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('editing', 'ready_for_review', 'converted', 'deleted')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  current_stage TEXT NOT NULL DEFAULT 'outcome'
    CHECK (current_stage IN ('outcome', 'crew', 'access', 'review')),
  field_values TEXT NOT NULL DEFAULT '{}' CHECK (length(CAST(field_values AS BLOB)) <= 65536),
  issue_codes TEXT NOT NULL DEFAULT '[]',
  converted_mission_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  converted_at TEXT,
  deleted_at TEXT
);
CREATE INDEX mission_composer_drafts_state ON mission_composer_drafts (state, updated_at, id);
`;

// The present-tense counterpart of V3_AGENT_PROFILES: what agent_profiles and
// its companions look like today. Composed as history-plus-deltas — the v3
// text followed by every migration applied since — rather than duplicated,
// so this can never drift from what a fully-migrated database actually looks
// like; CURRENT_SCHEMA_EXTENSIONS uses this (not V3_AGENT_PROFILES) to repair
// a database that is already at SCHEMA_VERSION but is somehow missing the
// table outright.
const CURRENT_AGENT_PROFILES = `${V3_AGENT_PROFILES}${V4_RECON_PROVENANCE}`;

const V3_AGENT_TEMPLATES = `
CREATE TABLE agent_profile_templates (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL CHECK (origin IN ('bundled', 'user')),
  state TEXT NOT NULL CHECK (state IN ('active', 'disabled', 'superseded', 'deleted')),
  current_revision_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE agent_profile_template_revisions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES agent_profile_templates (id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  name TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  digest TEXT NOT NULL CHECK (length(digest) = 64),
  created_at TEXT NOT NULL,
  UNIQUE (template_id, revision),
  UNIQUE (digest)
);
CREATE TABLE agent_profile_drafts (
  id TEXT PRIMARY KEY,
  source_template_revision_id TEXT REFERENCES agent_profile_template_revisions (id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK (state IN ('editing', 'invalid', 'ready_for_review', 'completed', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX agent_profile_drafts_source_state
  ON agent_profile_drafts (source_template_revision_id, state, updated_at);
`;

// Upgrade the earlier unreleased v3 foundation in the same migration transaction.
// Copy both related tables before rebuilding so foreign keys remain enabled.
// No persisted draft values existed in that foundation; seed them from provenance.
const V3_TEMPLATE_LIFECYCLE = `
CREATE TEMP TABLE template_revision_upgrade AS SELECT * FROM agent_profile_template_revisions;
CREATE TEMP TABLE template_draft_upgrade AS SELECT * FROM agent_profile_drafts;
DROP TABLE agent_profile_drafts;
DROP TABLE agent_profile_template_revisions;
CREATE TABLE agent_profile_template_revisions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES agent_profile_templates (id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  name TEXT NOT NULL CHECK (length(name) <= 200),
  manifest_json TEXT NOT NULL CHECK (length(CAST(manifest_json AS BLOB)) <= 65536),
  digest TEXT NOT NULL CHECK (length(digest) = 64),
  variables_json TEXT NOT NULL DEFAULT '[]',
  source_profile_revision_id TEXT REFERENCES agent_profile_revisions (id) ON DELETE RESTRICT,
  created_by_user INTEGER NOT NULL CHECK (created_by_user IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (template_id, revision)
);
CREATE INDEX agent_template_revision_digest ON agent_profile_template_revisions (template_id, digest);
INSERT INTO agent_profile_template_revisions
  (id, template_id, revision, name, manifest_json, digest, created_by_user, created_at)
SELECT r.id, r.template_id, r.revision, r.name, r.manifest_json, r.digest,
  CASE WHEN t.origin = 'user' THEN 1 ELSE 0 END, r.created_at
FROM template_revision_upgrade r JOIN agent_profile_templates t ON t.id = r.template_id;
CREATE TABLE agent_profile_drafts (
  id TEXT PRIMARY KEY,
  source_template_revision_id TEXT REFERENCES agent_profile_template_revisions (id) ON DELETE RESTRICT,
  source_profile_revision_id TEXT REFERENCES agent_profile_revisions (id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK (state IN ('editing', 'invalid', 'ready_for_review', 'completed', 'deleted')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  current_step TEXT NOT NULL DEFAULT 'identity' CHECK (current_step IN ('start', 'identity', 'role', 'capabilities', 'runtime', 'review')),
  field_values TEXT NOT NULL DEFAULT '{}' CHECK (length(CAST(field_values AS BLOB)) <= 65536),
  variable_values TEXT NOT NULL DEFAULT '{}',
  validation_issues TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  deleted_at TEXT,
  CHECK (source_template_revision_id IS NULL OR source_profile_revision_id IS NULL)
);
INSERT INTO agent_profile_drafts
  (id, source_template_revision_id, state, field_values, created_at, updated_at, completed_at, deleted_at)
SELECT d.id, d.source_template_revision_id, d.state,
  CASE WHEN d.state = 'deleted' THEN '{}' ELSE COALESCE(r.manifest_json, '{}') END,
  d.created_at, d.updated_at, d.completed_at,
  CASE WHEN d.state = 'deleted' THEN d.updated_at ELSE NULL END
FROM template_draft_upgrade d LEFT JOIN template_revision_upgrade r ON r.id = d.source_template_revision_id;
CREATE INDEX agent_profile_drafts_source_state ON agent_profile_drafts (source_template_revision_id, state, updated_at);
CREATE INDEX agent_profile_drafts_state ON agent_profile_drafts (state, updated_at, id);
CREATE INDEX agent_profile_templates_state ON agent_profile_templates (origin, state, updated_at, id);
DROP TABLE template_draft_upgrade;
DROP TABLE template_revision_upgrade;
CREATE TABLE agent_template_storage_v1 (version INTEGER PRIMARY KEY CHECK (version = 1));
INSERT INTO agent_template_storage_v1 VALUES (1);
`;

const V3_AGENT_EXPORT_INTENTS = `
CREATE TABLE agent_profile_export_intents (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES agent_profile_drafts (id) ON DELETE RESTRICT,
  draft_version INTEGER NOT NULL CHECK (draft_version >= 1),
  digest TEXT NOT NULL CHECK (length(digest) = 64),
  target_basename TEXT NOT NULL CHECK (length(target_basename) BETWEEN 1 AND 255),
  target_identity TEXT NOT NULL CHECK (length(target_identity) <= 512),
  state TEXT NOT NULL CHECK (state IN ('prepared', 'writing', 'completed', 'failed', 'unknown')),
  reason_code TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK ((state = 'completed' AND completed_at IS NOT NULL)
      OR (state <> 'completed'))
);
CREATE INDEX agent_profile_export_intents_draft_created
  ON agent_profile_export_intents (draft_id, created_at DESC);
`;

export const MIGRATIONS: readonly { version: number; sql: string }[] = [
  { version: 1, sql: V1 },
  { version: 2, sql: V2 },
  { version: 3, sql: `${V3}\n${V3_AGENT_PROFILES}` },
  { version: 4, sql: V4_RECON_PROVENANCE },
  { version: 5, sql: V5_MISSION_COMPOSER },
];

/** Additive slices intentionally delivered under the still-unreleased v3 schema. */
export const CURRENT_SCHEMA_EXTENSIONS: readonly { table: string; sql: string }[] = [
  { table: 'agent_profiles', sql: CURRENT_AGENT_PROFILES },
  { table: 'agent_profile_templates', sql: V3_AGENT_TEMPLATES },
  { table: 'agent_template_storage_v1', sql: V3_TEMPLATE_LIFECYCLE },
  { table: 'agent_profile_export_intents', sql: V3_AGENT_EXPORT_INTENTS },
  { table: 'supervisor_missions', sql: V3_SUPERVISOR },
  { table: 'mission_composer_drafts', sql: V5_MISSION_COMPOSER },
];
