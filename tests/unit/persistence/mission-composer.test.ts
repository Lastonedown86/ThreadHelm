import { describe, expect, it } from 'vitest';
import { openStorage } from '@threadhelm/persistence';
import { MAX_OPEN_MISSION_DRAFTS } from '@threadhelm/persistence';

const AT = '2026-09-03T12:00:00.000Z';

function repo() {
  return openStorage(':memory:').repositories.missionComposer;
}

describe('mission composer drafts', () => {
  it('creates, reads and updates with expected versions', () => {
    const drafts = repo();
    const { draftId } = drafts.createDraft({
      sourceMissionId: null,
      fieldValues: {},
      currentStage: 'outcome',
      createdAt: AT,
    });
    const created = drafts.getDraft(draftId);
    expect(created).toMatchObject({ version: 1, state: 'editing', currentStage: 'outcome' });
    const saved = drafts.updateDraft({
      draftId,
      expectedVersion: 1,
      fieldValues: { objective: 'Fix it' },
      currentStage: 'crew',
      issueCodes: [],
      state: 'editing',
      updatedAt: AT,
    });
    expect(saved.version).toBe(2);
    expect(drafts.getDraft(draftId).fieldValues).toEqual({ objective: 'Fix it' });
    expect(() =>
      drafts.updateDraft({
        draftId,
        expectedVersion: 1,
        fieldValues: { objective: 'Stale' },
        currentStage: 'crew',
        issueCodes: [],
        state: 'editing',
        updatedAt: AT,
      }),
    ).toThrow(/MISSION_DRAFT_STALE/);
    expect(drafts.getDraft(draftId).fieldValues).toEqual({ objective: 'Fix it' });
  });

  it('lists open drafts without authored text and caps them at twenty', () => {
    const drafts = repo();
    for (let n = 0; n < MAX_OPEN_MISSION_DRAFTS; n++)
      drafts.createDraft({
        sourceMissionId: null,
        fieldValues: { objective: `secret ${n}` },
        currentStage: 'outcome',
        createdAt: AT,
      });
    expect(() =>
      drafts.createDraft({
        sourceMissionId: null,
        fieldValues: {},
        currentStage: 'outcome',
        createdAt: AT,
      }),
    ).toThrow(/MISSION_DRAFT_LIMIT/);
    const listed = drafts.listDrafts();
    expect(listed).toHaveLength(20);
    expect(JSON.stringify(listed)).not.toContain('secret');
  });

  it('marks conversion once and hides deleted drafts', () => {
    const drafts = repo();
    const { draftId } = drafts.createDraft({
      sourceMissionId: null,
      fieldValues: {},
      currentStage: 'review',
      createdAt: AT,
    });
    drafts.markConverted({
      draftId,
      expectedVersion: 1,
      missionId: '22222222-2222-4222-8222-222222222222',
      convertedAt: AT,
    });
    expect(drafts.getDraft(draftId)).toMatchObject({ state: 'converted', version: 2 });
    expect(drafts.listDrafts()).toHaveLength(0);
    expect(() =>
      drafts.updateDraft({
        draftId,
        expectedVersion: 2,
        fieldValues: {},
        currentStage: 'review',
        issueCodes: [],
        state: 'editing',
        updatedAt: AT,
      }),
    ).toThrow(/INVALID_STATE/);
    const other = drafts.createDraft({
      sourceMissionId: null,
      fieldValues: { objective: 'gone' },
      currentStage: 'outcome',
      createdAt: AT,
    });
    drafts.deleteDraft({ draftId: other.draftId, expectedVersion: 1, deletedAt: AT });
    expect(() => drafts.getDraft(other.draftId)).toThrow(/MISSION_DRAFT_NOT_FOUND/);
  });
});
