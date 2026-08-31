/** Additive Feature 002 v3 slice; existing v3 stores receive it transactionally. */
export const V3_SUPERVISOR = `
CREATE TABLE supervisor_missions (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('running','paused','recovery_required','completed','cancelled','deleted')),
  version INTEGER NOT NULL CHECK(version > 0),
  supervisor_session_id TEXT,
  started_at TEXT NOT NULL,
  last_progress_at TEXT NOT NULL,
  turn_count INTEGER NOT NULL DEFAULT 0 CHECK(turn_count >= 0),
  output_bytes INTEGER NOT NULL DEFAULT 0 CHECK(output_bytes >= 0),
  tokens_used INTEGER NOT NULL DEFAULT 0 CHECK(tokens_used >= 0),
  reason_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX supervisor_missions_state ON supervisor_missions(state,updated_at,id);
CREATE TABLE supervisor_envelopes (
  mission_id TEXT NOT NULL REFERENCES supervisor_missions(id),
  version INTEGER NOT NULL,
  envelope_json TEXT,
  input_json TEXT,
  confirmed_at TEXT NOT NULL,
  PRIMARY KEY(mission_id,version)
);
CREATE TABLE supervisor_session_roles (
  id INTEGER PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES supervisor_missions(id),
  binding_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('supervisor','worker','reviewer','triage')),
  active INTEGER NOT NULL CHECK(active IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX supervisor_session_role_active ON supervisor_session_roles(session_id) WHERE active=1;
CREATE TABLE supervisor_work_items (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES supervisor_missions(id),
  workspace_id TEXT NOT NULL REFERENCES approved_workspaces(id),
  state TEXT NOT NULL CHECK(state IN ('blocked','ready','assigned','running','waiting','completed','failed','cancelled','escalated')),
  view_json TEXT NOT NULL,
  created_by_decision_id TEXT NOT NULL,
  UNIQUE(id,mission_id)
);
CREATE INDEX supervisor_work_items_state ON supervisor_work_items(mission_id,state,id);
CREATE TABLE supervisor_dependencies (
  mission_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  dependency_id TEXT NOT NULL,
  PRIMARY KEY(work_item_id,dependency_id),
  FOREIGN KEY(work_item_id,mission_id) REFERENCES supervisor_work_items(id,mission_id),
  FOREIGN KEY(dependency_id,mission_id) REFERENCES supervisor_work_items(id,mission_id)
);
CREATE TABLE supervisor_decisions (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES supervisor_missions(id),
  work_item_id TEXT REFERENCES supervisor_work_items(id),
  idempotency_key TEXT NOT NULL,
  fingerprint TEXT,
  request_digest TEXT,
  view_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(mission_id,idempotency_key)
);
CREATE INDEX supervisor_decisions_mission ON supervisor_decisions(mission_id,created_at,id);
CREATE TABLE supervisor_worker_leases (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES supervisor_missions(id),
  work_item_id TEXT NOT NULL REFERENCES supervisor_work_items(id),
  workspace_id TEXT NOT NULL REFERENCES approved_workspaces(id),
  profile_revision_id TEXT NOT NULL REFERENCES agent_profile_revisions(id),
  session_id TEXT,
  planned_session_id TEXT NOT NULL,
  volume_serial TEXT NOT NULL COLLATE NOCASE,
  file_id TEXT NOT NULL COLLATE NOCASE,
  mode TEXT NOT NULL CHECK(mode IN ('read','write')),
  state TEXT NOT NULL CHECK(state IN ('reserved','active','released','expired','unknown')),
  view_json TEXT NOT NULL
);
CREATE UNIQUE INDEX supervisor_one_live_work_lease ON supervisor_worker_leases(work_item_id) WHERE state IN ('reserved','active','unknown');
CREATE UNIQUE INDEX supervisor_one_write_identity ON supervisor_worker_leases(volume_serial,file_id) WHERE state IN ('reserved','active','unknown') AND mode='write';
CREATE INDEX supervisor_leases_mission_state ON supervisor_worker_leases(mission_id,state);
CREATE TABLE supervisor_work_attempts (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES supervisor_missions(id),
  work_item_id TEXT NOT NULL REFERENCES supervisor_work_items(id),
  decision_id TEXT NOT NULL REFERENCES supervisor_decisions(id),
  lease_id TEXT NOT NULL REFERENCES supervisor_worker_leases(id),
  binding_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('reserved','assigned','running','completed','failed','unknown','cancelled')),
  attempt_number INTEGER NOT NULL CHECK(attempt_number BETWEEN 1 AND 3),
  effect TEXT NOT NULL CHECK(effect IN ('none','possible')),
  retry_class TEXT,
  result_key TEXT,
  result_digest TEXT,
  turn_count INTEGER NOT NULL DEFAULT 0,
  output_bytes INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  last_progress_at TEXT NOT NULL,
  view_json TEXT NOT NULL,
  UNIQUE(work_item_id,attempt_number),
  UNIQUE(decision_id)
);
CREATE TABLE supervisor_events (
  mission_id TEXT NOT NULL REFERENCES supervisor_missions(id),
  sequence INTEGER NOT NULL,
  state TEXT NOT NULL,
  work_item_id TEXT,
  reason_code TEXT,
  occurred_at TEXT NOT NULL,
  PRIMARY KEY(mission_id,sequence)
);
`;
