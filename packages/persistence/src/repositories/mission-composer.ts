import { randomUUID } from 'node:crypto';
import {
  MissionComposerFields,
  ThreadHelmError,
  type MissionComposerDraftState,
  type MissionComposerStage,
} from '@threadhelm/contracts';
import type { Db } from '../migrate.js';

export const MAX_OPEN_MISSION_DRAFTS = 20;
const OPEN_STATES = "('editing', 'ready_for_review')";
const STAGES: readonly MissionComposerStage[] = ['outcome', 'crew', 'access', 'review'];

export interface MissionComposerDraftSummary {
  draftId: string;
  version: number;
  state: MissionComposerDraftState;
  currentStage: MissionComposerStage;
  sourceMissionId: string | null;
  issueCodes: string[];
  createdAt: string;
  updatedAt: string;
}
export interface MissionComposerDraftDetail extends MissionComposerDraftSummary {
  fieldValues: MissionComposerFields;
  convertedMissionId: string | null;
}
interface Row {
  id: string;
  source_mission_id: string | null;
  state: MissionComposerDraftState;
  version: number;
  current_stage: MissionComposerStage;
  field_values: string;
  issue_codes: string;
  converted_mission_id: string | null;
  created_at: string;
  updated_at: string;
}

const notFound = (): never => {
  throw new ThreadHelmError('MISSION_DRAFT_NOT_FOUND');
};
const stale = (): never => {
  throw new ThreadHelmError('MISSION_DRAFT_STALE');
};

/** Only Electron main calls this; a draft is local editing state and grants no authority. */
export class MissionComposerRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  private summary(row: Row): MissionComposerDraftSummary {
    return {
      draftId: row.id,
      version: row.version,
      state: row.state,
      currentStage: row.current_stage,
      sourceMissionId: row.source_mission_id,
      issueCodes: JSON.parse(row.issue_codes) as string[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private row(draftId: string): Row {
    const row = this.db
      .prepare('SELECT * FROM mission_composer_drafts WHERE id = ?')
      .get(draftId) as Row | undefined;
    if (!row || row.state === 'deleted') notFound();
    return row as Row;
  }

  private mutable(draftId: string, expectedVersion: number): Row {
    const row = this.row(draftId);
    if (row.state === 'converted')
      throw new ThreadHelmError('INVALID_STATE');
    if (!Number.isSafeInteger(expectedVersion) || row.version !== expectedVersion) stale();
    return row;
  }

  createDraft(input: {
    sourceMissionId: string | null;
    fieldValues: MissionComposerFields;
    currentStage: MissionComposerStage;
    createdAt: string;
  }): { draftId: string } {
    return this.db.transaction(() => {
      const open = this.db
        .prepare(
          `SELECT COUNT(*) AS count FROM mission_composer_drafts WHERE state IN ${OPEN_STATES}`,
        )
        .get() as { count: number };
      if (open.count >= MAX_OPEN_MISSION_DRAFTS)
        throw new ThreadHelmError('MISSION_DRAFT_LIMIT');
      if (!STAGES.includes(input.currentStage)) throw new ThreadHelmError('INVALID_REQUEST');
      const draftId = randomUUID();
      this.db
        .prepare(
          'INSERT INTO mission_composer_drafts (id, source_mission_id, state, current_stage, field_values, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          draftId,
          input.sourceMissionId,
          'editing',
          input.currentStage,
          JSON.stringify(MissionComposerFields.parse(input.fieldValues)),
          input.createdAt,
          input.createdAt,
        );
      return { draftId };
    })();
  }

  listDrafts(limit = 20): MissionComposerDraftSummary[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20)
      throw new ThreadHelmError('INVALID_REQUEST');
    const rows = this.db
      .prepare(
        `SELECT * FROM mission_composer_drafts WHERE state IN ${OPEN_STATES} ORDER BY updated_at DESC, id LIMIT ?`,
      )
      .all(limit) as Row[];
    return rows.map((row) => this.summary(row));
  }

  getDraft(draftId: string): MissionComposerDraftDetail {
    const row = this.row(draftId);
    return {
      ...this.summary(row),
      fieldValues: MissionComposerFields.parse(JSON.parse(row.field_values)),
      convertedMissionId: row.converted_mission_id,
    };
  }

  updateDraft(input: {
    draftId: string;
    expectedVersion: number;
    fieldValues: MissionComposerFields;
    currentStage: MissionComposerStage;
    issueCodes: string[];
    state: 'editing' | 'ready_for_review';
    updatedAt: string;
  }): { version: number } {
    return this.db.transaction(() => {
      const row = this.mutable(input.draftId, input.expectedVersion);
      if (!STAGES.includes(input.currentStage)) throw new ThreadHelmError('INVALID_REQUEST');
      this.db
        .prepare(
          'UPDATE mission_composer_drafts SET field_values = ?, current_stage = ?, state = ?, issue_codes = ?, version = version + 1, updated_at = ? WHERE id = ?',
        )
        .run(
          JSON.stringify(MissionComposerFields.parse(input.fieldValues)),
          input.currentStage,
          input.state,
          JSON.stringify(input.issueCodes),
          input.updatedAt,
          input.draftId,
        );
      return { version: row.version + 1 };
    })();
  }

  markConverted(input: {
    draftId: string;
    expectedVersion: number;
    missionId: string;
    convertedAt: string;
  }): void {
    this.db.transaction(() => {
      this.mutable(input.draftId, input.expectedVersion);
      this.db
        .prepare(
          "UPDATE mission_composer_drafts SET state = 'converted', converted_mission_id = ?, converted_at = ?, updated_at = ?, version = version + 1 WHERE id = ?",
        )
        .run(input.missionId, input.convertedAt, input.convertedAt, input.draftId);
    })();
  }

  deleteDraft(input: { draftId: string; expectedVersion: number; deletedAt: string }): void {
    this.db.transaction(() => {
      this.mutable(input.draftId, input.expectedVersion);
      this.db
        .prepare(
          "UPDATE mission_composer_drafts SET state = 'deleted', field_values = '{}', issue_codes = '[]', deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ?",
        )
        .run(input.deletedAt, input.deletedAt, input.draftId);
    })();
  }
}
