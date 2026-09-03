/** US7 wizard/template contracts: bounded inert data and exact review JSON. */

import {
  AgentTemplateVariable,
  AgentWizardDraftDetailView,
  AgentWizardExportPreviewView,
  operationNames,
} from '@threadhelm/contracts';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWorld, eventsNamed } from './helpers/fake-context.js';
import { openStorage } from '@threadhelm/persistence';
import { GENERIC_AGENT_TEMPLATE_FIXTURES } from '@threadhelm/test-fixtures/desktop';
import {
  AGENT_EXPORT_DEFAULT_FILENAME,
  createAgentWizardService,
} from '../../apps/desktop/src/main/coordination/profile-wizard.js';
import { createProfileService } from '../../apps/desktop/src/main/coordination/profiles.js';

describe('agent wizard contracts', () => {
  it('upgrades an old bundled database and completes its pinned draft without changing historical content', () => {
    const world = createWorld({ noStorage: true });
    const storage = openStorage(':memory:');
    world.ctx.storage = storage;
    try {
      const templates = storage.repositories.agentTemplates;
      const before = GENERIC_AGENT_TEMPLATE_FIXTURES.map((fixture) => {
        const fields = { ...fixture.manifest, spec: 'munder-difflin/hire@1' };
        const manifestJson = `${JSON.stringify(fields, null, 2)}\n`;
        const digest = createHash('sha256').update(manifestJson).digest('hex');
        const source = templates.createBundled({
          key: fixture.key,
          name: fixture.manifest.name,
          manifestJson,
          digest,
          createdAt: '2026-08-28T12:00:00.000Z',
        });
        return { ...source, fields, manifestJson, digest };
      });
      const source = before[0]!;
      const draft = templates.createDraft({
        templateRevisionId: source.revisionId,
        createdAt: '2026-08-28T12:00:00.000Z',
      });
      templates.updateDraft({
        draftId: draft.draftId,
        expectedVersion: 1,
        fieldValues: source.fields,
        currentStep: 'review',
        updatedAt: '2026-08-28T12:00:00.000Z',
      });
      const service = createAgentWizardService(world.ctx, createProfileService(world.ctx));
      expect(service.listTemplates({}).templates).toHaveLength(6);
      for (const old of before) {
        const current = templates.getTemplate(old.templateId).currentRevisionId!;
        expect(current).not.toBe(old.revisionId);
        expect(JSON.parse(templates.getRevision(current).manifestJson).spec).toBe(
          'threadhelm/agent-profile@1',
        );
        expect(templates.getRevision(old.revisionId)).toMatchObject({
          manifestJson: old.manifestJson,
          digest: old.digest,
        });
      }
      const preview = service.previewCompletion({
        draftId: draft.draftId,
        version: 2,
        action: 'profile',
      });
      expect(preview.manifest.spec).toBe('threadhelm/agent-profile@1');
      service.confirmProfile({
        completionToken: preview.completionToken,
        profileConfirmation: true,
      });
      expect(templates.getDraft(draft.draftId)).toMatchObject({
        state: 'completed',
        sourceTemplateRevisionId: source.revisionId,
        fieldValues: source.fields,
      });
      const revisions = service.listTemplates({}).templates.map((item) => item.currentRevisionId);
      const restarted = createAgentWizardService(world.ctx, createProfileService(world.ctx));
      expect(restarted.listTemplates({}).templates.map((item) => item.currentRevisionId)).toEqual(
        revisions,
      );
    } finally {
      storage.db.close();
    }
  });

  it('reviews a resumed legacy draft as native data without rewriting its source or saved fields', async () => {
    const world = createWorld();
    const templates = world.ctx.storage!.repositories.agentTemplates;
    const source = templates.listTemplates().items[0]!;
    const original = templates.getRevision(source.currentRevisionId!);
    const legacyFields = { ...JSON.parse(original.manifestJson), spec: 'munder-difflin/hire@1' };
    const manifestJson = JSON.stringify(legacyFields);
    const legacy = templates.saveRevision({
      key: 'legacy',
      name: 'Legacy source',
      manifestJson,
      digest: createHash('sha256').update(manifestJson).digest('hex'),
      createdAt: '2026-08-28T12:00:00.000Z',
    });
    const draft = templates.createDraft({
      templateRevisionId: legacy.revisionId,
      createdAt: '2026-08-28T12:00:00.000Z',
    });
    expect(templates.getDraft(draft.draftId).fieldValues.spec).toBe('threadhelm/agent-profile@1');
    // Simulate a persisted draft created by an earlier app version.
    templates.updateDraft({
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: legacyFields,
      currentStep: 'review',
      updatedAt: '2026-08-28T12:00:00.000Z',
    });
    const resumed = await world.ok<{ version: number; fieldValues: { spec: string } }>(
      'agentWizard.getDraft',
      { draftId: draft.draftId },
    );
    expect(resumed.fieldValues.spec).toBe('munder-difflin/hire@1');
    const preview = await world.ok<{
      manifest: { spec: string };
      manifestJson: string;
      digest: string;
      completionToken: string;
    }>('agentWizard.previewCompletion', {
      draftId: draft.draftId,
      version: resumed.version,
      action: 'profile',
    });
    expect(preview.manifest.spec).toBe('threadhelm/agent-profile@1');
    expect(JSON.parse(preview.manifestJson)).toEqual(preview.manifest);
    expect(preview.digest).toBe(createHash('sha256').update(preview.manifestJson).digest('hex'));
    await world.ok('agentWizard.confirmProfile', {
      completionToken: preview.completionToken,
      profileConfirmation: true,
    });
    expect(templates.getDraft(draft.draftId)).toMatchObject({
      state: 'completed',
      sourceTemplateRevisionId: legacy.revisionId,
      fieldValues: legacyFields,
    });
    expect(templates.getRevision(legacy.revisionId).manifestJson).toBe(manifestJson);
  });

  it('uses ThreadHelm content in every bundled template and completion preview', async () => {
    const world = createWorld();
    const listed = await world.ok<{
      templates: { templateId: string; currentRevisionId: string }[];
    }>('agentTemplates.list');
    expect(listed.templates).toHaveLength(6);
    for (const template of listed.templates) {
      const detail = await world.ok<{ manifestJson: string }>('agentTemplates.get', {
        templateId: template.templateId,
      });
      expect(JSON.parse(detail.manifestJson).spec).toBe('threadhelm/agent-profile@1');
      expect(detail.manifestJson).not.toMatch(/munder|difflin/i);
      const draft = await world.ok<{ draftId: string; version: number }>(
        'agentWizard.createDraft',
        {
          source: { kind: 'template', templateRevisionId: template.currentRevisionId },
        },
      );
      const preview = await world.ok<{ manifestJson: string; digest: string }>(
        'agentWizard.previewCompletion',
        {
          draftId: draft.draftId,
          version: draft.version,
          action: 'export',
        },
      );
      expect(JSON.parse(preview.manifestJson).spec).toBe('threadhelm/agent-profile@1');
      expect(preview.digest).toBe(createHash('sha256').update(preview.manifestJson).digest('hex'));
    }
  });

  it('offers a Save-dialog default filename its own export validator accepts', async () => {
    // The half of the rename nothing caught: the picker offered
    // 'agent-manifest.json' while previewExport required '.agent.json', so an
    // owner who accepted the offered name was refused by the operation behind
    // the dialog. Every other export test constructs its own path.
    const world = createWorld();
    const listed = await world.ok<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
    );
    const draft = await world.ok<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: listed.templates[0]!.currentRevisionId },
    });
    const completion = await world.ok<{ completionToken: string }>(
      'agentWizard.previewCompletion',
      { draftId: draft.draftId, version: draft.version, action: 'export' },
    );
    const dir = mkdtempSync(join(tmpdir(), 'agent-export-default-'));
    try {
      world.ctx.agentExportPicker = {
        pickTarget: async () => join(dir, AGENT_EXPORT_DEFAULT_FILENAME),
      };
      const chosen = await world.ok<{ targetHandle: string }>('agentWizard.chooseExportTarget');
      const result = await world.call('agentWizard.previewExport', {
        completionToken: completion.completionToken,
        targetHandle: chosen.targetHandle,
      });
      expect(result.ok ? 'OK' : result.error.code).toBe('OK');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects unsafe draft text and variables without persisting or echoing rejected content', async () => {
    const world = createWorld();
    const draft = await world.ok<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'blank' },
    });
    for (const value of [
      '\ud800',
      '\u001b]52;c;synthetic\u0007',
      'sk-ant-' + 'synthetic'.repeat(3),
      '-----BEGIN PRIVATE KEY-----',
      'access-token: syntheticexample',
    ]) {
      const result = await world.call('agentWizard.updateStep', {
        draftId: draft.draftId,
        version: draft.version,
        step: 'role',
        fields: { goal: value },
      });
      expect(result.ok, JSON.stringify(value)).toBe(false);
      expect(JSON.stringify(result)).not.toContain(value);
      expect(
        AgentTemplateVariable.safeParse({
          name: 'task',
          type: 'text',
          maxLength: 256,
          defaultValue: value,
        }).success,
      ).toBe(false);
    }
    const unchanged = await world.ok<{ version: number; fieldValues: Record<string, unknown> }>(
      'agentWizard.getDraft',
      { draftId: draft.draftId },
    );
    expect(unchanged.version).toBe(draft.version);
    expect(unchanged.fieldValues).not.toHaveProperty('goal');
  });

  it('accepts only bounded variable declarations and exposes no launch operation', () => {
    expect(
      AgentTemplateVariable.parse({ name: 'project', type: 'text', maxLength: 256 }),
    ).toMatchObject({ name: 'project' });
    expect(
      AgentTemplateVariable.parse({
        name: 'project',
        type: 'text',
        maxLength: 256,
        defaultValue: '😀'.repeat(256),
      }).defaultValue,
    ).toHaveLength(512);
    expect(() =>
      AgentTemplateVariable.parse({
        name: 'project',
        type: 'text',
        maxLength: 256,
        defaultValue: '😀'.repeat(257),
      }),
    ).toThrow();
    expect(() =>
      AgentTemplateVariable.parse({ name: 'project', type: 'text', maxLength: 257 }),
    ).toThrow();
    for (const name of [
      'agentWizard.createDraft',
      'agentWizard.listDrafts',
      'agentWizard.chooseExportTarget',
      'agentTemplates.saveRevision',
    ]) {
      expect(operationNames).toContain(name);
    }
    expect(operationNames).not.toContain('agentWizard.launch');
    expect(operationNames).not.toContain('agentTemplates.grantPermission');
  });

  it('rejects unsafe template display metadata before it reaches summaries', async () => {
    const world = createWorld();
    const source = await world.ok<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
    );
    for (const name of ['\ud800', '\u009b31m', 'API_TOKEN=synthetic']) {
      expect(
        (
          await world.call('agentTemplates.duplicate', {
            templateRevisionId: source.templates[0]!.currentRevisionId,
            key: 'unsafe-name',
            name,
          })
        ).ok,
      ).toBe(false);
    }
  });

  it('persists only fields owned by a submitted step and keeps changed events content-free', async () => {
    const world = createWorld();
    const created = await world.ok<{ draftId: string; version: number }>(
      'agentWizard.createDraft',
      { source: { kind: 'blank' } },
    );
    const rejected = await world.call('agentWizard.updateStep', {
      draftId: created.draftId,
      version: created.version,
      step: 'role',
      fields: { name: 'not role-owned' },
    });
    expect(rejected.ok).toBe(false);
    const updated = await world.ok<{
      version: number;
      currentStep: string;
      fieldValues: Record<string, unknown>;
    }>('agentWizard.updateStep', {
      draftId: created.draftId,
      version: created.version,
      step: 'identity',
      nextStep: 'role',
      fields: { name: 'Reviewer', description: 'Reviews a bounded change.', author: 'Owner' },
    });
    expect(updated.currentStep).toBe('role');
    expect(updated.fieldValues).toMatchObject({ name: 'Reviewer' });
    const events = eventsNamed(world, 'agentWizard.changed');
    expect(events).not.toHaveLength(0);
    expect(JSON.stringify(events)).not.toContain('Reviewer');
    const blank = await world.ok<{ fieldValues: Record<string, unknown> }>('agentWizard.getDraft', {
      draftId: created.draftId,
    });
    expect(blank.fieldValues.spec).toBe('threadhelm/agent-profile@1');
    await world.ok('agentWizard.deleteDraft', {
      draftId: created.draftId,
      version: updated.version,
    });
    expect(eventsNamed(world, 'agentWizard.changed').at(-1)).toMatchObject({
      draftId: created.draftId,
      version: updated.version + 1,
      state: 'deleted',
      currentStep: 'role',
      validationIssues: [],
    });
  });

  it('makes the completion preview exact and keeps filesystem paths restricted to export preview', async () => {
    const world = createWorld();
    const template = await world.ok<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
    );
    const draft = await world.ok<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: template.templates[0]!.currentRevisionId },
    });
    const preview = await world.ok<{
      manifestJson: string;
      digest: string;
      completionToken: string;
    }>('agentWizard.previewCompletion', {
      draftId: draft.draftId,
      version: draft.version,
      action: 'export',
    });
    expect(preview.manifestJson.endsWith('\n')).toBe(true);
    expect(preview.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(() =>
      AgentWizardExportPreviewView.parse({
        exportToken: 'x'.repeat(24),
        draftId: draft.draftId,
        displayPath: 'C:\\x.agent.json',
        basename: 'x.agent.json',
        collision: false,
        requiresOverwriteConfirmation: false,
        expiresAt: '2026-08-30T12:00:00.000Z',
        manifestJson: preview.manifestJson,
      }),
    ).toThrow();
    expect(
      AgentWizardDraftDetailView.parse(
        await world.ok('agentWizard.getDraft', { draftId: draft.draftId }),
      ).sourceTemplateRevisionId,
    ).toBe(template.templates[0]!.currentRevisionId);
  });

  it('binds completion tokens to one action and rejects replay or stale drafts', async () => {
    const world = createWorld();
    const listed = await world.ok<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
    );
    const draft = await world.ok<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: listed.templates[0]!.currentRevisionId },
    });
    const exportPreview = await world.ok<{ completionToken: string }>(
      'agentWizard.previewCompletion',
      {
        draftId: draft.draftId,
        version: draft.version,
        action: 'export',
      },
    );
    const wrongAction = await world.call('agentWizard.confirmProfile', {
      completionToken: exportPreview.completionToken,
      profileConfirmation: true,
    });
    expect(wrongAction.ok).toBe(false);
    const profilePreview = await world.ok<{ completionToken: string }>(
      'agentWizard.previewCompletion',
      {
        draftId: draft.draftId,
        version: draft.version,
        action: 'profile',
      },
    );
    await world.ok('agentWizard.updateStep', {
      draftId: draft.draftId,
      version: draft.version,
      step: 'identity',
      fields: { name: 'Changed' },
    });
    const stale = await world.call('agentWizard.confirmProfile', {
      completionToken: profilePreview.completionToken,
      profileConfirmation: true,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('PROFILE_REVISION_STALE');
  });

  it('keeps template events and literal variables inert', async () => {
    const world = createWorld();
    const listed = await world.ok<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
    );
    const draft = await world.ok<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: listed.templates[0]!.currentRevisionId },
    });
    const saved = await world.ok('agentTemplates.saveRevision', {
      source: { kind: 'draft', draftId: draft.draftId, version: draft.version },
      key: 'literal-vars',
      name: 'Literal vars',
      variables: [{ name: 'project', type: 'text', maxLength: 16, defaultValue: 'local' }],
    });
    expect(saved).toMatchObject({ origin: 'user' });
    expect(JSON.stringify(eventsNamed(world, 'agentTemplates.changed'))).not.toContain('local');
    expect(await world.ok('sessions.list')).toMatchObject({ sessions: [] });
  });

  it('retains whitespace draft errors, blocks next, and rejects later storage degradation', async () => {
    const world = createWorld();
    const draft = await world.ok<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'blank' },
    });
    const updated = await world.ok<{ currentStep: string; fieldErrors: Record<string, string> }>(
      'agentWizard.updateStep',
      {
        draftId: draft.draftId,
        version: draft.version,
        step: 'identity',
        nextStep: 'role',
        fields: { name: '   ', description: 'Valid description', author: 'Owner' },
      },
    );
    expect(updated.currentStep).toBe('identity');
    expect(updated.fieldErrors.name).toBe('TEMPLATE_DRAFT_INCOMPLETE');
    const capabilityDraft = await world.ok<{ draftId: string; version: number }>(
      'agentWizard.createDraft',
      { source: { kind: 'blank' } },
    );
    const capabilityUpdate = await world.ok<{ currentStep: string }>('agentWizard.updateStep', {
      draftId: capabilityDraft.draftId,
      version: capabilityDraft.version,
      step: 'capabilities',
      nextStep: 'runtime',
      fields: { capabilities: ['UPPERCASE'] },
    });
    expect(capabilityUpdate.currentStep).toBe('capabilities');
    expect(() =>
      world.ctx.health.required(() => {
        throw new Error('disk unavailable');
      }),
    ).toThrow();
    const blocked = await world.call('agentWizard.listDrafts');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('STORAGE_UNAVAILABLE');
  });

  it('preserves a source template placeholder when a draft becomes a local template', async () => {
    const world = createWorld();
    const manifest = {
      spec: 'munder-difflin/hire@1',
      name: 'Reviewer',
      description: 'Reviews a bounded change.',
      provider: 'codex',
      model: 'gpt-5.6-terra',
      goal: 'Review {{area}}.',
      capabilities: ['code_review'],
      isolate: true,
      tokenCap: 1000,
      author: 'Owner',
    };
    const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
    const seeded = world.ctx.storage!.repositories.agentTemplates.createBundled({
      key: 'placeholder-reviewer',
      name: 'Placeholder reviewer',
      manifestJson,
      digest: createHash('sha256').update(manifestJson).digest('hex'),
      variables: [{ name: 'area', type: 'text', maxLength: 32, defaultValue: 'schema' }],
      createdAt: '2026-08-28T12:00:00.000Z',
    });
    const draft = await world.ok<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: seeded.revisionId },
    });
    const edited = await world.ok<{ version: number }>('agentWizard.updateStep', {
      draftId: draft.draftId,
      version: draft.version,
      step: 'role',
      fields: { goal: 'Review {{area}} carefully.' },
    });
    const saved = await world.ok<{ templateId: string; currentRevisionId: string }>(
      'agentTemplates.saveRevision',
      {
        source: { kind: 'draft', draftId: draft.draftId, version: edited.version },
        key: 'saved-placeholder',
        name: 'Saved placeholder',
      },
    );
    const detail = await world.ok<{ manifestJson: string }>('agentTemplates.get', {
      templateId: saved.templateId,
    });
    expect(detail.manifestJson).toContain('Review {{area}} carefully.');
    const reinstantiated = await world.ok<{ draftId: string; version: number }>(
      'agentWizard.createDraft',
      { source: { kind: 'template', templateRevisionId: saved.currentRevisionId } },
    );
    const preview = await world.ok<{ manifestJson: string }>('agentWizard.previewCompletion', {
      draftId: reinstantiated.draftId,
      version: reinstantiated.version,
      action: 'profile',
    });
    expect(preview.manifestJson).toContain('Review schema carefully.');
  });

  it('reports a missing declared long-name variable against its manifest field', async () => {
    const world = createWorld();
    const variable = `v${'x'.repeat(63)}`;
    const manifest = {
      spec: 'munder-difflin/hire@1',
      name: 'Reviewer',
      description: 'Reviews a bounded change.',
      provider: 'codex',
      model: 'gpt-5.6-terra',
      goal: `Review {{${variable}}}.`,
      capabilities: ['code_review'],
      isolate: true,
      tokenCap: 1000,
      author: 'Owner',
    };
    const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
    const seeded = world.ctx.storage!.repositories.agentTemplates.createBundled({
      key: 'missing-long-variable',
      name: 'Missing long variable',
      manifestJson,
      digest: createHash('sha256').update(manifestJson).digest('hex'),
      variables: [{ name: variable, type: 'text', maxLength: 32 }],
      createdAt: '2026-08-28T12:00:00.000Z',
    });
    const draft = await world.ok<{
      draftId: string;
      version: number;
      fieldErrors: Record<string, string>;
    }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: seeded.revisionId },
    });
    expect(draft.fieldErrors).toEqual({ goal: 'TEMPLATE_VARIABLE_UNRESOLVED' });
    expect(
      await world.ok<{ currentStep: string; fieldErrors: Record<string, string> }>(
        'agentWizard.updateStep',
        {
          draftId: draft.draftId,
          version: draft.version,
          step: 'role',
          nextStep: 'capabilities',
          fields: { goal: manifest.goal },
        },
      ),
    ).toMatchObject({
      currentStep: 'role',
      fieldErrors: { goal: 'TEMPLATE_VARIABLE_UNRESOLVED' },
    });
  });

  it('attributes invalid literal expansions and keeps their role step visible', async () => {
    const world = createWorld();
    const cases: readonly (readonly [key: string, goal: string, defaultValue: string])[] = [
      ['overlong-expanded', `${'x'.repeat(3990)}{{area}}`, 'y'.repeat(32)],
      ['empty-expanded', '{{area}}', ''],
    ];
    for (const [key, goal, defaultValue] of cases) {
      const manifest = {
        spec: 'munder-difflin/hire@1',
        name: 'Reviewer',
        description: 'Reviews a bounded change.',
        provider: 'codex',
        model: 'gpt-5.6-terra',
        goal,
        capabilities: ['code_review'],
        isolate: true,
        tokenCap: 1000,
        author: 'Owner',
      };
      const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
      const seeded = world.ctx.storage!.repositories.agentTemplates.createBundled({
        key,
        name: key,
        manifestJson,
        digest: createHash('sha256').update(manifestJson).digest('hex'),
        variables: [{ name: 'area', type: 'text', maxLength: 32, defaultValue }],
        createdAt: '2026-08-28T12:00:00.000Z',
      });
      const draft = await world.ok<{
        draftId: string;
        version: number;
        fieldErrors: Record<string, string>;
      }>('agentWizard.createDraft', {
        source: { kind: 'template', templateRevisionId: seeded.revisionId },
      });
      expect(draft.fieldErrors.goal).toBe('TEMPLATE_DRAFT_INCOMPLETE');
      expect(
        await world.ok<{ currentStep: string; fieldErrors: Record<string, string> }>(
          'agentWizard.updateStep',
          {
            draftId: draft.draftId,
            version: draft.version,
            step: 'role',
            nextStep: 'capabilities',
            fields: { goal },
          },
        ),
      ).toMatchObject({
        currentStep: 'role',
        fieldErrors: { goal: 'TEMPLATE_DRAFT_INCOMPLETE' },
      });
    }
  });

  it('keeps a completed draft readable after its user source template is deleted', async () => {
    const world = createWorld();
    const bundled = await world.ok<{ templates: { currentRevisionId: string }[] }>(
      'agentTemplates.list',
    );
    const seed = await world.ok<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: bundled.templates[0]!.currentRevisionId },
    });
    const local = await world.ok<{ templateId: string; currentRevisionId: string }>(
      'agentTemplates.saveRevision',
      {
        source: { kind: 'draft', draftId: seed.draftId, version: seed.version },
        key: 'completed-source',
        name: 'Completed source',
      },
    );
    const draft = await world.ok<{ draftId: string; version: number }>('agentWizard.createDraft', {
      source: { kind: 'template', templateRevisionId: local.currentRevisionId },
    });
    const preview = await world.ok<{ completionToken: string }>('agentWizard.previewCompletion', {
      draftId: draft.draftId,
      version: draft.version,
      action: 'profile',
    });
    await world.ok('agentWizard.confirmProfile', {
      completionToken: preview.completionToken,
      profileConfirmation: true,
    });
    const deletion = await world.ok<{ deleteToken: string }>('agentTemplates.previewDelete', {
      templateId: local.templateId,
      revisionId: local.currentRevisionId,
    });
    await world.ok('agentTemplates.delete', {
      deleteToken: deletion.deleteToken,
      deleteConfirmation: true,
    });
    expect(
      await world.ok<{ state: string; sourceTemplateRevisionId: string | null }>(
        'agentWizard.getDraft',
        { draftId: draft.draftId },
      ),
    ).toMatchObject({ state: 'completed', sourceTemplateRevisionId: local.currentRevisionId });
  });
});
