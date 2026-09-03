import { afterEach, describe, expect, it } from 'vitest';
import type {
  MissionComposerDraftDetailView,
  MissionComposerSaveReceipt,
  MissionDetailView,
  MissionPreviewView,
} from '@threadhelm/contracts';
import { supervisorWorld } from './helpers/supervisor-world.js';
import { createWorld } from './helpers/fake-context.js';

type Preview = MissionPreviewView & { draftVersion: number };

describe('mission composer drafts', () => {
  let fixture: Awaited<ReturnType<typeof supervisorWorld>> | undefined;
  afterEach(() => fixture?.cleanup());

  it('creates, saves with expected versions and lists without authored text', async () => {
    const world = createWorld();
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.createDraft');
    expect(draft).toMatchObject({ version: 1, state: 'editing', currentStage: 'outcome' });
    const saved = await world.ok<MissionComposerSaveReceipt>('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { objective: 'secret objective' },
      currentStage: 'crew',
    });
    expect(saved.version).toBe(2);
    const stale = await world.call('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { objective: 'older' },
      currentStage: 'crew',
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('MISSION_DRAFT_STALE');
    const listed = await world.ok<{ drafts: unknown[] }>('missionComposer.listDrafts');
    expect(listed.drafts).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain('secret');
    expect(
      JSON.stringify(world.events.filter((e) => e.name === 'missionComposer.changed')),
    ).not.toContain('secret');
    const detail = await world.ok<MissionComposerDraftDetailView>('missionComposer.getDraft', {
      draftId: draft.draftId,
    });
    expect(detail.fieldValues.objective).toBe('secret objective');
  });

  it('previews an incomplete draft with field paths and converts a complete one atomically', async () => {
    fixture = await supervisorWorld();
    const { world, input } = fixture;
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.createDraft');
    const incomplete = await world.call('missionComposer.preview', {
      draftId: draft.draftId,
      version: draft.version,
    });
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) {
      expect(incomplete.error.code).toBe('INVALID_REQUEST');
      expect(String(incomplete.error.details['paths'])).toContain('objective');
    }
    const saved = await world.ok<MissionComposerSaveReceipt>('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: draft.version,
      fieldValues: input,
      currentStage: 'review',
    });
    const preview = await world.ok<Preview>('missionComposer.preview', {
      draftId: draft.draftId,
      version: saved.version,
    });
    expect(preview.draftVersion).toBe(saved.version);
    expect(preview.envelope.bindings.find((b) => b.role === 'worker')?.assignment).toBe(
      input.workers[0]!.assignment,
    );
    const mission = await world.ok<MissionDetailView>('missionComposer.confirm', {
      draftId: draft.draftId,
      version: saved.version,
      previewToken: preview.previewToken,
    });
    expect(mission.state).toBe('running');
    const after = await world.ok<MissionComposerDraftDetailView>('missionComposer.getDraft', {
      draftId: draft.draftId,
    });
    expect(after).toMatchObject({ state: 'converted', convertedMissionId: mission.id });
    const replay = await world.call('missionComposer.confirm', {
      draftId: draft.draftId,
      version: saved.version,
      previewToken: preview.previewToken,
    });
    expect(replay.ok).toBe(false);
  });

  it('rejects confirm after an edit and reports expiry by code', async () => {
    fixture = await supervisorWorld();
    const { world, input } = fixture;
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.createDraft');
    let saved = await world.ok<MissionComposerSaveReceipt>('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: draft.version,
      fieldValues: input,
      currentStage: 'review',
    });
    const preview = await world.ok<Preview>('missionComposer.preview', {
      draftId: draft.draftId,
      version: saved.version,
    });
    saved = await world.ok<MissionComposerSaveReceipt>('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: saved.version,
      fieldValues: { ...input, objective: 'Changed after preview' },
      currentStage: 'review',
    });
    const moved = await world.call('missionComposer.confirm', {
      draftId: draft.draftId,
      version: saved.version,
      previewToken: preview.previewToken,
    });
    expect(moved.ok).toBe(false);
    if (!moved.ok) expect(moved.error.code).toBe('MISSION_DRAFT_STALE');
    const again = await world.ok<Preview>('missionComposer.preview', {
      draftId: draft.draftId,
      version: saved.version,
    });
    world.clock.now += 121_000;
    const expired = await world.call('missionComposer.confirm', {
      draftId: draft.draftId,
      version: saved.version,
      previewToken: again.previewToken,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error.code).toBe('MISSION_CONFIRMATION_EXPIRED');
    expect(world.hosts).toHaveLength(1);
  });

  it('discards only with a matching version and token', async () => {
    const world = createWorld();
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.createDraft');
    const preview = await world.ok<{ discardToken: string }>('missionComposer.previewDiscard', {
      draftId: draft.draftId,
      version: draft.version,
    });
    await world.ok('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: draft.version,
      fieldValues: { objective: 'x' },
      currentStage: 'outcome',
    });
    const stale = await world.call('missionComposer.confirmDiscard', {
      draftId: draft.draftId,
      version: draft.version,
      discardToken: preview.discardToken,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('MISSION_DRAFT_DISCARD_STALE');
    const fresh = await world.ok<{ discardToken: string }>('missionComposer.previewDiscard', {
      draftId: draft.draftId,
      version: 2,
    });
    const gone = await world.ok<{ state: string }>('missionComposer.confirmDiscard', {
      draftId: draft.draftId,
      version: 2,
      discardToken: fresh.discardToken,
    });
    expect(gone.state).toBe('deleted');
    expect(
      (await world.ok<{ drafts: unknown[] }>('missionComposer.listDrafts')).drafts,
    ).toHaveLength(0);
  });

  it('seeds a revision draft from the mission input and applies through the revision path', async () => {
    fixture = await supervisorWorld();
    const { world, confirm } = fixture;
    const mission = await confirm();
    await world.ok('missions.pause', { missionId: mission.id });
    const draft = await world.ok<MissionComposerDraftDetailView>('missionComposer.createDraft', {
      sourceMissionId: mission.id,
    });
    expect(draft.currentStage).toBe('review');
    expect(draft.fieldValues.objective).toBe(mission.envelope!.objective);
    const saved = await world.ok<MissionComposerSaveReceipt>('missionComposer.updateDraft', {
      draftId: draft.draftId,
      expectedVersion: draft.version,
      fieldValues: { ...draft.fieldValues, objective: 'Revised objective' },
      currentStage: 'review',
    });
    const preview = await world.ok<Preview>('missionComposer.preview', {
      draftId: draft.draftId,
      version: saved.version,
    });
    const revised = await world.ok<MissionDetailView>('missionComposer.confirm', {
      draftId: draft.draftId,
      version: saved.version,
      previewToken: preview.previewToken,
    });
    expect(revised.id).toBe(mission.id);
    expect(revised.version).toBe(mission.version + 1);
    expect(revised.envelope!.objective).toBe('Revised objective');
  });

  it('blocks drafts while storage is degraded', async () => {
    const world = createWorld({ degraded: true });
    const result = await world.call('missionComposer.createDraft');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STORAGE_UNAVAILABLE');
  });
});
