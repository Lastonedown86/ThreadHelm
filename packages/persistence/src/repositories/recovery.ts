/** RecoveryRecord repository and resolution transitions (T080). */

import { randomUUID } from 'node:crypto';
import {
  ThreadHelmError,
  type LifecycleState,
  type RecoveryClassification,
  type RecoveryRecordView,
  type RecoveryResolution,
} from '@threadhelm/contracts';

import type { Db } from '../migrate.js';
import { assertNoRawContent, sanitizeSummary } from '../sanitize.js';

interface Row {
  id: string;
  session_id: string;
  last_known_state: LifecycleState;
  classification: RecoveryClassification;
  reason_code: string;
  safe_summary: string;
  created_at: string;
  resolved_at: string | null;
  resolution: RecoveryResolution | null;
}

const toView = (r: Row): RecoveryRecordView => ({
  id: r.id,
  sessionId: r.session_id,
  lastKnownState: r.last_known_state,
  classification: r.classification,
  reasonCode: r.reason_code,
  safeSummary: r.safe_summary,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
  resolution: r.resolution,
});

export interface RecoveryRecordInsert {
  sessionId: string;
  lastKnownState: LifecycleState;
  classification: RecoveryClassification;
  reasonCode: string;
  safeSummary: string;
  createdAt: string;
}

export class RecoveryRecordRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  create(input: RecoveryRecordInsert): RecoveryRecordView {
    assertNoRawContent({ reasonCode: input.reasonCode });
    const id = randomUUID();
    this.#db
      .prepare(
        `INSERT INTO recovery_records
           (id, session_id, last_known_state, classification, reason_code, safe_summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.sessionId,
        input.lastKnownState,
        input.classification,
        input.reasonCode,
        sanitizeSummary(input.safeSummary),
        input.createdAt,
      );
    return this.findById(id)!;
  }

  findById(id: string): RecoveryRecordView | null {
    const row = this.#db.prepare('SELECT * FROM recovery_records WHERE id = ?').get(id) as
      Row | undefined;
    return row ? toView(row) : null;
  }

  findUnresolvedBySession(sessionId: string): RecoveryRecordView | null {
    const row = this.#db
      .prepare('SELECT * FROM recovery_records WHERE session_id = ? AND resolved_at IS NULL')
      .get(sessionId) as Row | undefined;
    return row ? toView(row) : null;
  }

  listUnresolved(): RecoveryRecordView[] {
    return (
      this.#db
        .prepare('SELECT * FROM recovery_records WHERE resolved_at IS NULL ORDER BY created_at')
        .all() as Row[]
    ).map(toView);
  }

  listAll(): RecoveryRecordView[] {
    return (
      this.#db.prepare('SELECT * FROM recovery_records ORDER BY created_at').all() as Row[]
    ).map(toView);
  }

  /** unresolved → dismissed | superseded_by_new_session, exactly once. */
  resolve(id: string, resolution: RecoveryResolution, at: string): RecoveryRecordView {
    const current = this.findById(id);
    if (!current) throw new ThreadHelmError('RECORD_NOT_FOUND', 'Recovery record not found.');
    if (current.resolvedAt !== null) {
      throw new ThreadHelmError('INVALID_RESOLUTION', 'Recovery record is already resolved.', {
        resolution: current.resolution ?? '',
      });
    }
    this.#db
      .prepare('UPDATE recovery_records SET resolved_at = ?, resolution = ? WHERE id = ?')
      .run(at, resolution, id);
    return this.findById(id)!;
  }
}
