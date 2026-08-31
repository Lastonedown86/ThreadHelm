/** Durable, content-free export intent evidence. A restart marks in-flight
 * writes unknown and never retries them automatically. */

import { randomUUID } from 'node:crypto';
import { ThreadHelmError } from '@threadhelm/contracts';
import type { Db } from '../migrate.js';

export type AgentProfileExportState = 'prepared' | 'writing' | 'completed' | 'failed' | 'unknown';

export class AgentProfileExportRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  recoverUnknown(at: string): void {
    this.db
      .prepare(
        "UPDATE agent_profile_export_intents SET state = 'unknown', reason_code = 'EXPORT_OUTCOME_UNKNOWN', completed_at = ? WHERE state IN ('prepared', 'writing')",
      )
      .run(at);
  }

  begin(input: {
    draftId: string;
    draftVersion: number;
    digest: string;
    targetBasename: string;
    targetIdentity: string;
    createdAt: string;
  }): string {
    const active = this.db
      .prepare(
        "SELECT 1 FROM agent_profile_export_intents WHERE draft_id = ? AND state IN ('prepared', 'writing') LIMIT 1",
      )
      .get(input.draftId);
    if (active)
      throw new ThreadHelmError(
        'INVALID_STATE',
        'An export is already in progress for this draft.',
      );
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO agent_profile_export_intents (id, draft_id, draft_version, digest, target_basename, target_identity, state, created_at) VALUES (?, ?, ?, ?, ?, ?, 'prepared', ?)",
      )
      .run(
        id,
        input.draftId,
        input.draftVersion,
        input.digest,
        input.targetBasename,
        input.targetIdentity,
        input.createdAt,
      );
    return id;
  }

  markWriting(id: string): void {
    this.db
      .prepare(
        "UPDATE agent_profile_export_intents SET state = 'writing' WHERE id = ? AND state = 'prepared'",
      )
      .run(id);
  }

  complete(id: string, at: string): void {
    this.db
      .prepare(
        "UPDATE agent_profile_export_intents SET state = 'completed', completed_at = ? WHERE id = ? AND state = 'writing'",
      )
      .run(at, id);
  }

  markUnknown(id: string, at: string): void {
    this.db
      .prepare(
        "UPDATE agent_profile_export_intents SET state = 'unknown', reason_code = 'EXPORT_OUTCOME_UNKNOWN', completed_at = ? WHERE id = ? AND state = 'writing'",
      )
      .run(at, id);
  }

  hasActive(draftId: string): boolean {
    return Boolean(
      this.db
        .prepare(
          "SELECT 1 FROM agent_profile_export_intents WHERE draft_id = ? AND state IN ('prepared', 'writing') LIMIT 1",
        )
        .get(draftId),
    );
  }

  fail(id: string, reasonCode: string, at: string): void {
    this.db
      .prepare(
        "UPDATE agent_profile_export_intents SET state = 'failed', reason_code = ?, completed_at = ? WHERE id = ? AND state IN ('prepared', 'writing')",
      )
      .run(reasonCode, at, id);
  }
}
