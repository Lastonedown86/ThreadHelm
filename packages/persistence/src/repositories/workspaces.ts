/** ApprovedWorkspace repository (T035). */

import { randomUUID } from 'node:crypto';
import type { ApprovedWorkspaceView } from '@threadhelm/contracts';

import type { Db } from '../migrate.js';
import { assertNoRawContent } from '../sanitize.js';

interface Row {
  id: string;
  selected_path: string;
  display_path: string;
  canonical_path: string;
  volume_serial: string;
  file_id: string;
  approved_at: string;
  last_validated_at: string;
  revoked_at: string | null;
}

const toView = (r: Row): ApprovedWorkspaceView => ({
  id: r.id,
  selectedPath: r.selected_path,
  displayPath: r.display_path,
  canonicalPath: r.canonical_path,
  volumeSerial: r.volume_serial,
  fileId: r.file_id,
  driveType: 'fixed_local',
  approvedAt: r.approved_at,
  lastValidatedAt: r.last_validated_at,
  revokedAt: r.revoked_at,
});

export interface ApprovedWorkspaceInsert {
  selectedPath: string;
  displayPath: string;
  canonicalPath: string;
  volumeSerial: string;
  fileId: string;
  approvedAt: string;
}

export class ApprovedWorkspaceRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  insertApproval(input: ApprovedWorkspaceInsert): ApprovedWorkspaceView {
    assertNoRawContent(input);
    const id = randomUUID();
    this.#db
      .prepare(
        `INSERT INTO approved_workspaces
           (id, selected_path, display_path, canonical_path, volume_serial, file_id, drive_type,
            approved_at, last_validated_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, 'fixed_local', ?, ?, NULL)`,
      )
      .run(
        id,
        input.selectedPath,
        input.displayPath,
        input.canonicalPath,
        input.volumeSerial,
        input.fileId,
        input.approvedAt,
        input.approvedAt,
      );
    return this.findById(id)!;
  }

  findById(id: string): ApprovedWorkspaceView | null {
    const row = this.#db.prepare('SELECT * FROM approved_workspaces WHERE id = ?').get(id) as
      Row | undefined;
    return row ? toView(row) : null;
  }

  findActiveByIdentity(volumeSerial: string, fileId: string): ApprovedWorkspaceView | null {
    const row = this.#db
      .prepare(
        `SELECT * FROM approved_workspaces
         WHERE volume_serial = ? AND file_id = ? AND revoked_at IS NULL`,
      )
      .get(volumeSerial, fileId) as Row | undefined;
    return row ? toView(row) : null;
  }

  listActive(): ApprovedWorkspaceView[] {
    return (
      this.#db
        .prepare('SELECT * FROM approved_workspaces WHERE revoked_at IS NULL ORDER BY approved_at')
        .all() as Row[]
    ).map(toView);
  }

  listAll(): ApprovedWorkspaceView[] {
    return (
      this.#db.prepare('SELECT * FROM approved_workspaces ORDER BY approved_at').all() as Row[]
    ).map(toView);
  }

  markValidated(id: string, at: string): void {
    this.#db
      .prepare('UPDATE approved_workspaces SET last_validated_at = ? WHERE id = ?')
      .run(at, id);
  }

  /** Caller is responsible for checking active sessions first (invariant 8). */
  revoke(id: string, at: string): ApprovedWorkspaceView | null {
    this.#db
      .prepare('UPDATE approved_workspaces SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .run(at, id);
    return this.findById(id);
  }
}
