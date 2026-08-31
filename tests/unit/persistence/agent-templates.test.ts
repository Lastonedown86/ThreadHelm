import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { createRepositories, migrate, openDatabase } from '@threadhelm/persistence';
import { GENERIC_AGENT_TEMPLATE_FIXTURES } from '@threadhelm/test-fixtures';
import { afterEach, describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_EXTENSIONS, MIGRATIONS } from '../../../packages/persistence/src/schema.js';

const AT = '2026-08-30T16:00:00.000Z';
const MANIFEST = GENERIC_AGENT_TEMPLATE_FIXTURES[3]!.manifest;
const connections: Database.Database[] = [];
const directories: string[] = [];

afterEach(() => {
  for (const db of connections.splice(0)) if (db.open) db.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function setup(path = ':memory:') {
  const db = openDatabase(path);
  connections.push(db);
  migrate(db);
  return { db, templates: createRepositories(db).agentTemplates };
}

function seedInput(key = 'quality', goal = MANIFEST.goal) {
  const manifestJson = JSON.stringify({ ...MANIFEST, goal });
  return {
    key,
    name: 'Quality verifier',
    manifestJson,
    digest: createHash('sha256').update(manifestJson).digest('hex'),
    createdAt: AT,
  };
}

describe('agent-template persistence', () => {
  it('retains an explicitly cleared field as an invalid resumable draft', () => {
    const { templates } = setup();
    const draft = templates.createDraft({ createdAt: AT });
    templates.updateDraft({
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { name: '' },
      currentStep: 'identity',
      updatedAt: AT,
    });
    expect(templates.getDraft(draft.draftId)).toMatchObject({
      state: 'invalid',
      version: 2,
      fieldValues: { name: '' },
      validationIssues: ['TEMPLATE_DRAFT_INCOMPLETE'],
    });
    templates.updateDraft({
      draftId: draft.draftId,
      expectedVersion: 2,
      fieldValues: { name: '  Quality  ', goal: '\nDraft text\n' },
      currentStep: 'role',
      updatedAt: AT,
    });
    expect(templates.getDraft(draft.draftId).fieldValues).toEqual({
      name: '  Quality  ',
      goal: '\nDraft text\n',
    });
  });

  it('rejects aggregate oversized Unicode defaults before they can seed an uneditable draft', () => {
    const { templates } = setup();
    expect(() =>
      templates.saveRevision({
        ...seedInput('large-defaults'),
        variables: Array.from({ length: 16 }, (_, index) => ({
          name: 'v' + index,
          type: 'text' as const,
          maxLength: 4000,
          defaultValue: '界'.repeat(4000),
        })),
      }),
    ).toThrow();
    expect(templates.listTemplates().items).toEqual([]);
  });

  it('lists drafts and templates in bounded pages without exposing goal or variable content', () => {
    const { templates } = setup();
    for (let index = 0; index < 4; index++) {
      templates.saveRevision(seedInput('local-' + index, 'PRIVATE_GOAL'));
      templates.createDraft({ createdAt: AT });
    }
    const first = templates.listTemplates({ limit: 2 });
    const second = templates.listTemplates({ limit: 2, cursor: first.nextCursor! });
    expect(new Set([...first.items, ...second.items].map((item) => item.templateId)).size).toBe(4);
    expect(second.nextCursor).toBeNull();
    expect(JSON.stringify(first)).not.toContain('PRIVATE_GOAL');
    const drafts = templates.listDrafts({ limit: 2 });
    expect(drafts.items).toHaveLength(2);
    expect(drafts.items[0]).not.toHaveProperty('fieldValues');
    expect(templates.listDrafts({ limit: 2, cursor: drafts.nextCursor! }).items).toHaveLength(2);
    expect(() => templates.listDrafts({ limit: 0 })).toThrow();
    expect(() => templates.listTemplates({ limit: 51 })).toThrow();
    expect(() => templates.listDrafts({ cursor: first.nextCursor! })).toThrow();
  });

  it('filters template summaries by active or disabled state without silently widening the result', () => {
    const { templates } = setup();
    const active = templates.saveRevision(seedInput('visible-active'));
    const disabled = templates.saveRevision(seedInput('visible-disabled'));
    templates.setEnabled({
      templateId: disabled.templateId,
      expectedRevisionId: disabled.revisionId,
      enabled: false,
      updatedAt: AT,
    });
    expect(
      templates.listTemplates({ state: 'active' }).items.map((item) => item.templateId),
    ).toEqual([active.templateId]);
    expect(
      templates.listTemplates({ state: 'disabled' }).items.map((item) => item.templateId),
    ).toEqual([disabled.templateId]);
  });

  it('copies a current compatible reviewed profile revision without granting execution authority', () => {
    const { db, templates } = setup();
    const profiles = createRepositories(db).agentProfiles;
    const profile = profiles.importManifest({
      manifestKey: 'quality',
      digest: 'a'.repeat(64),
      displayName: 'Quality',
      description: 'Reviewed quality role',
      requestedProvider: 'codex',
      requestedModel: 'gpt-5.6-terra',
      capabilities: ['quality_review'],
      isolateRequested: true,
      tokenCapRequested: 1000,
      author: 'Owner',
      goal: 'Untrusted persona goal',
      manifestSpec: 'munder-difflin/hire@1',
      compatibility: 'compatible',
      sourceBasename: 'quality.hire.json',
      createdAt: AT,
    });
    const draft = templates.createDraft({ profileRevisionId: profile.revisionId, createdAt: AT });
    expect(templates.getDraft(draft.draftId)).toMatchObject({
      sourceProfileRevisionId: profile.revisionId,
      sourceTemplateRevisionId: null,
      fieldValues: { name: 'Quality', goal: 'Untrusted persona goal' },
    });
    expect(templates.getDraft(draft.draftId).fieldValues).not.toHaveProperty('permissionMode');
    expect(db.prepare('SELECT COUNT(*) AS count FROM agent_sessions').get()).toEqual({ count: 0 });
    expect(() => templates.createDraft({ profileRevisionId: 'missing', createdAt: AT })).toThrow();
    expect(() =>
      templates.createDraft({
        profileRevisionId: profile.revisionId,
        templateRevisionId: 'missing',
        createdAt: AT,
      }),
    ).toThrow();
  });

  it('retains copied profile provenance after source deletion while direct copies still require live sources', () => {
    const { db, templates } = setup();
    const profiles = createRepositories(db).agentProfiles;
    const profile = profiles.importManifest({
      manifestKey: 'historical-source',
      digest: 'b'.repeat(64),
      displayName: 'Historical source',
      description: 'Reviewed source profile',
      requestedProvider: 'codex',
      requestedModel: 'gpt-5.6-terra',
      capabilities: ['quality_review'],
      isolateRequested: true,
      tokenCapRequested: 1000,
      author: 'Owner',
      goal: 'Copy this reviewed scaffold',
      manifestSpec: 'munder-difflin/hire@1',
      compatibility: 'compatible',
      sourceBasename: 'historical-source.hire.json',
      createdAt: AT,
    });
    const copied = templates.saveRevision({
      ...seedInput('profile-copy'),
      sourceProfileRevisionId: profile.revisionId,
    });
    profiles.setEnabled(profile.profileId, profile.revisionId, false, AT);
    profiles.confirmDelete(profile.profileId, AT);
    expect(() =>
      templates.saveRevision({
        ...seedInput('direct-deleted-profile'),
        sourceProfileRevisionId: profile.revisionId,
      }),
    ).toThrowError(expect.objectContaining({ code: 'PROFILE_NOT_FOUND' }));
    const duplicate = templates.duplicate({
      templateRevisionId: copied.revisionId,
      key: 'profile-copy-duplicate',
      name: 'Profile copy duplicate',
      createdAt: AT,
    });
    const revised = templates.saveRevision({
      ...seedInput('profile-copy', 'Revised copied scaffold'),
      templateId: copied.templateId,
      expectedRevisionId: copied.revisionId,
      sourceProfileRevisionId: profile.revisionId,
      sourceProfileIsHistorical: true,
    });
    expect(templates.getRevision(duplicate.revisionId).sourceProfileRevisionId).toBe(
      profile.revisionId,
    );
    expect(templates.getRevision(revised.revisionId).sourceProfileRevisionId).toBe(
      profile.revisionId,
    );
  });

  it('rolls back a failed v3 upgrade and keeps the earlier rows available', () => {
    const db = openDatabase(':memory:');
    connections.push(db);
    for (const migration of MIGRATIONS) db.exec(migration.sql);
    db.prepare('INSERT INTO schema_meta (version) VALUES (3)').run();
    db.exec(
      CURRENT_SCHEMA_EXTENSIONS.find((extension) => extension.table === 'agent_profile_templates')!
        .sql,
    );
    db.prepare(
      "INSERT INTO agent_profile_templates VALUES ('t', 'quality', 'bundled', 'active', 'r', ?, ?)",
    ).run(AT, AT);
    const seed = seedInput();
    db.prepare("INSERT INTO agent_profile_template_revisions VALUES ('r', 't', 1, ?, ?, ?, ?)").run(
      'x'.repeat(201),
      seed.manifestJson,
      seed.digest,
      AT,
    );
    expect(() => migrate(db)).toThrow();
    expect(
      db.prepare("SELECT manifest_json FROM agent_profile_template_revisions WHERE id = 'r'").get(),
    ).toEqual({ manifest_json: seed.manifestJson });
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE name = 'agent_template_storage_v1'").get(),
    ).toBeUndefined();
    db.prepare("UPDATE agent_profile_template_revisions SET name = 'Quality' WHERE id = 'r'").run();
    expect(() => migrate(db)).not.toThrow();
  });
  it('upgrades existing v3 foundation rows without losing identities or provenance', () => {
    const db = openDatabase(':memory:');
    connections.push(db);
    for (const migration of MIGRATIONS) db.exec(migration.sql);
    db.prepare('INSERT INTO schema_meta (version) VALUES (3)').run();
    db.exec(
      CURRENT_SCHEMA_EXTENSIONS.find((extension) => extension.table === 'agent_profile_templates')!
        .sql,
    );
    db.prepare(
      "INSERT INTO agent_profile_templates VALUES ('t', 'quality', 'bundled', 'active', 'r', ?, ?)",
    ).run(AT, AT);
    const seed = seedInput();
    db.prepare(
      "INSERT INTO agent_profile_template_revisions VALUES ('r', 't', 1, 'Quality', ?, ?, ?)",
    ).run(seed.manifestJson, seed.digest, AT);
    db.prepare("INSERT INTO agent_profile_drafts VALUES ('d', 'r', 'editing', ?, ?, NULL)").run(
      AT,
      AT,
    );
    migrate(db);
    migrate(db);
    const templates = createRepositories(db).agentTemplates;
    expect(templates.getDraft('d')).toMatchObject({
      sourceTemplateRevisionId: 'r',
      version: 1,
      fieldValues: { goal: 'Run and report focused checks.' },
    });
    expect(() =>
      templates.duplicate({ templateRevisionId: 'r', key: 'copy', name: 'Copy', createdAt: AT }),
    ).not.toThrow();
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });
  it('copies source fields and immutable provenance into a draft', () => {
    const { templates } = setup();
    const template = templates.createBundled(seedInput());
    const draft = templates.createDraft({ templateRevisionId: template.revisionId, createdAt: AT });
    expect(templates.getDraft(draft.draftId)).toMatchObject({
      version: 1,
      state: 'editing',
      currentStep: 'identity',
      sourceTemplateRevisionId: template.revisionId,
      fieldValues: { goal: 'Run and report focused checks.' },
    });
  });

  // Two real on-disk migrations/reopens can exceed Vitest's default 5s on a
  // hosted Windows disk. This is a durability/stale-write test, not the separate
  // UI or runtime recovery performance gate; retain every state assertion.
  it('recovers autosaved fields and step from disk and rejects stale writes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'threadhelm-template-'));
    directories.push(directory);
    const path = join(directory, 'state.sqlite');
    const first = setup(path);
    const draft = first.templates.createDraft({ createdAt: AT });
    first.templates.updateDraft({
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { name: 'My reviewer', goal: 'Review only this change.' },
      currentStep: 'role',
      variableValues: {},
      updatedAt: AT,
    });
    first.db.close();
    const { templates } = setup(path);
    expect(templates.getDraft(draft.draftId)).toMatchObject({
      version: 2,
      currentStep: 'role',
      fieldValues: { name: 'My reviewer', goal: 'Review only this change.' },
    });
    expect(() =>
      templates.updateDraft({
        draftId: draft.draftId,
        expectedVersion: 1,
        fieldValues: { name: 'Stale edit' },
        currentStep: 'identity',
        updatedAt: AT,
      }),
    ).toThrowError(expect.objectContaining({ code: 'PROFILE_REVISION_STALE' }));
    expect(templates.getDraft(draft.draftId).fieldValues.name).toBe('My reviewer');
  }, 15_000);

  it('requires complete valid fields and an exact version before immutable completion', () => {
    const { templates } = setup();
    const blank = templates.createDraft({ createdAt: AT });
    expect(() =>
      templates.completeDraft({ draftId: blank.draftId, expectedVersion: 1, completedAt: AT }),
    ).toThrowError(expect.objectContaining({ code: 'TEMPLATE_DRAFT_INCOMPLETE' }));
    const template = templates.createBundled(seedInput());
    const draft = templates.createDraft({ templateRevisionId: template.revisionId, createdAt: AT });
    expect(() =>
      templates.completeDraft({ draftId: draft.draftId, expectedVersion: 2, completedAt: AT }),
    ).toThrowError(expect.objectContaining({ code: 'PROFILE_REVISION_STALE' }));
    templates.completeDraft({ draftId: draft.draftId, expectedVersion: 1, completedAt: AT });
    expect(() =>
      templates.updateDraft({
        draftId: draft.draftId,
        expectedVersion: 2,
        fieldValues: {},
        currentStep: 'identity',
        updatedAt: AT,
      }),
    ).toThrow();
    expect(() =>
      templates.deleteDraft({ draftId: draft.draftId, expectedVersion: 2, deletedAt: AT }),
    ).toThrow();
    expect(templates.getDraft(draft.draftId).state).toBe('completed');
  });

  it('appends immutable revisions, deduplicates current content, and rejects stale sources', () => {
    const { templates } = setup();
    const first = templates.saveRevision(seedInput('local'));
    const draft = templates.createDraft({ templateRevisionId: first.revisionId, createdAt: AT });
    const second = templates.saveRevision({
      ...seedInput('local', 'New goal'),
      templateId: first.templateId,
      expectedRevisionId: first.revisionId,
    });
    expect(second.revisionId).not.toBe(first.revisionId);
    expect(templates.getRevision(first.revisionId).manifestJson).toContain(
      'Run and report focused checks.',
    );
    expect(templates.getDraft(draft.draftId).fieldValues.goal).toBe(
      'Run and report focused checks.',
    );
    expect(
      templates.saveRevision({
        ...seedInput('local', 'New goal'),
        templateId: first.templateId,
        expectedRevisionId: second.revisionId,
      }),
    ).toEqual(second);
    expect(() =>
      templates.saveRevision({
        ...seedInput('local', 'Another'),
        templateId: first.templateId,
        expectedRevisionId: first.revisionId,
      }),
    ).toThrow();
    expect(() =>
      templates.createDraft({ templateRevisionId: first.revisionId, createdAt: AT }),
    ).toThrow();
    expect(() =>
      templates.completeDraft({ draftId: draft.draftId, expectedVersion: 1, completedAt: AT }),
    ).toThrowError(expect.objectContaining({ code: 'PROFILE_REVISION_STALE' }));
  });

  it('duplicates under a new identity without weakening bundled immutability', () => {
    const { templates } = setup();
    const seed = templates.createBundled(seedInput());
    expect(templates.createBundled(seedInput())).toEqual(seed);
    expect(() => templates.createBundled(seedInput('quality', 'Changed'))).toThrow();
    const copy = templates.duplicate({
      templateRevisionId: seed.revisionId,
      key: 'local',
      name: 'Local quality',
      createdAt: AT,
    });
    expect(copy.templateId).not.toBe(seed.templateId);
    expect(templates.getRevision(copy.revisionId).digest).toBe(
      templates.getRevision(seed.revisionId).digest,
    );
    expect(() =>
      templates.setEnabled({
        templateId: seed.templateId,
        expectedRevisionId: seed.revisionId,
        enabled: false,
        updatedAt: AT,
      }),
    ).toThrow();
    expect(() =>
      templates.deleteTemplate({
        templateId: seed.templateId,
        expectedRevisionId: seed.revisionId,
        deletedAt: AT,
      }),
    ).toThrow();
    expect(() =>
      templates.saveRevision({
        ...seedInput(),
        templateId: seed.templateId,
        expectedRevisionId: seed.revisionId,
      }),
    ).toThrow();
  });

  it('blocks disabled seeds and pinned deletion, then scrubs deleted content', () => {
    const { db, templates } = setup();
    const template = templates.saveRevision(seedInput('local'));
    const draft = templates.createDraft({ templateRevisionId: template.revisionId, createdAt: AT });
    templates.setEnabled({
      templateId: template.templateId,
      expectedRevisionId: template.revisionId,
      enabled: false,
      updatedAt: AT,
    });
    expect(() =>
      templates.createDraft({ templateRevisionId: template.revisionId, createdAt: AT }),
    ).toThrow();
    expect(() =>
      templates.deleteTemplate({
        templateId: template.templateId,
        expectedRevisionId: template.revisionId,
        deletedAt: AT,
      }),
    ).toThrow();
    templates.deleteDraft({ draftId: draft.draftId, expectedVersion: 1, deletedAt: AT });
    expect(() => templates.getDraft(draft.draftId)).toThrow();
    expect(
      db
        .prepare('SELECT field_values, variable_values FROM agent_profile_drafts WHERE id = ?')
        .get(draft.draftId),
    ).toEqual({ field_values: '{}', variable_values: '{}' });
    templates.deleteTemplate({
      templateId: template.templateId,
      expectedRevisionId: template.revisionId,
      deletedAt: AT,
    });
    expect(() => templates.getRevision(template.revisionId)).toThrow();
    expect(
      db
        .prepare(
          'SELECT manifest_json, variables_json, name FROM agent_profile_template_revisions WHERE id = ?',
        )
        .get(template.revisionId),
    ).toEqual({ manifest_json: '{}', variables_json: '[]', name: '' });
  });

  it('enforces 20 open drafts and frees capacity after deletion', () => {
    const { templates } = setup();
    const drafts = Array.from({ length: 20 }, () => templates.createDraft({ createdAt: AT }));
    expect(() => templates.createDraft({ createdAt: AT })).toThrowError(
      expect.objectContaining({ code: 'PROFILE_LIMIT_REACHED' }),
    );
    templates.deleteDraft({ draftId: drafts[0]!.draftId, expectedVersion: 1, deletedAt: AT });
    expect(() => templates.createDraft({ createdAt: AT })).not.toThrow();
  });

  it('recovers a prepared export intent as unknown without replaying it', () => {
    const { db } = setup();
    const repos = createRepositories(db);
    const draft = repos.agentTemplates.createDraft({ createdAt: AT });
    const id = repos.agentProfileExports.begin({
      draftId: draft.draftId,
      draftVersion: 1,
      digest: 'a'.repeat(64),
      targetBasename: 'draft.hire.json',
      targetIdentity: 'b'.repeat(64),
      createdAt: AT,
    });
    repos.agentProfileExports.recoverUnknown(AT);
    expect(
      db
        .prepare('SELECT id, state, reason_code FROM agent_profile_export_intents WHERE id = ?')
        .get(id),
    ).toEqual({ id, state: 'unknown', reason_code: 'EXPORT_OUTCOME_UNKNOWN' });
    expect(repos.agentProfileExports.hasActive(draft.draftId)).toBe(false);
  });

  it('enforces 100 user templates while permitting bundled seeds and revisions at capacity', () => {
    const { templates } = setup();
    const first = templates.saveRevision(seedInput('local-0'));
    for (let index = 1; index < 100; index++) templates.saveRevision(seedInput('local-' + index));
    expect(() => templates.saveRevision(seedInput('overflow'))).toThrowError(
      expect.objectContaining({ code: 'PROFILE_LIMIT_REACHED' }),
    );
    expect(() => templates.createBundled(seedInput())).not.toThrow();
    expect(() =>
      templates.saveRevision({
        ...seedInput('local-0', 'Revised'),
        templateId: first.templateId,
        expectedRevisionId: first.revisionId,
      }),
    ).not.toThrow();
  });

  it('frees active-template capacity on disable and enforces it on re-enable', () => {
    const { templates } = setup();
    const first = templates.saveRevision(seedInput('active-0'));
    for (let index = 1; index < 100; index++) templates.saveRevision(seedInput(`active-${index}`));
    templates.setEnabled({
      templateId: first.templateId,
      expectedRevisionId: first.revisionId,
      enabled: false,
      updatedAt: AT,
    });
    expect(() => templates.saveRevision(seedInput('active-new'))).not.toThrow();
    expect(() =>
      templates.setEnabled({
        templateId: first.templateId,
        expectedRevisionId: first.revisionId,
        enabled: true,
        updatedAt: AT,
      }),
    ).toThrowError(expect.objectContaining({ code: 'PROFILE_LIMIT_REACHED' }));
  });

  it('enforces 32 immutable revisions for one user template', () => {
    const { templates } = setup();
    let current = templates.saveRevision(seedInput('revision-cap', 'Goal 0'));
    for (let revision = 1; revision < 32; revision++) {
      current = templates.saveRevision({
        ...seedInput('revision-cap', `Goal ${revision}`),
        templateId: current.templateId,
        expectedRevisionId: current.revisionId,
      });
    }
    expect(() =>
      templates.saveRevision({
        ...seedInput('revision-cap', 'Goal 32'),
        templateId: current.templateId,
        expectedRevisionId: current.revisionId,
      }),
    ).toThrowError(expect.objectContaining({ code: 'PROFILE_LIMIT_REACHED' }));
  });

  it('accepts all 20 valid maximum-text drafts within the one MiB aggregate quota', () => {
    const { templates } = setup();
    const text = 'x'.repeat(4000);
    const drafts = Array.from({ length: 20 }, () => templates.createDraft({ createdAt: AT }));
    for (const draft of drafts) {
      templates.updateDraft({
        draftId: draft.draftId,
        expectedVersion: 1,
        currentStep: 'role',
        fieldValues: { description: text, goal: text },
        updatedAt: AT,
      });
    }
    expect(templates.listDrafts({ limit: 20 }).items).toHaveLength(20);
  });

  it('rejects authority fields, oversized drafts and invalid digests without writes', () => {
    const { db, templates } = setup();
    expect(() => templates.saveRevision({ ...seedInput(), digest: '0'.repeat(64) })).toThrow();
    const draft = templates.createDraft({ createdAt: AT });
    for (const fieldValues of [
      { permissionMode: 'auto' },
      { goal: 'x'.repeat(4001) },
      { tokenCap: -1 },
    ]) {
      expect(() =>
        templates.updateDraft({
          draftId: draft.draftId,
          expectedVersion: 1,
          fieldValues,
          currentStep: 'role',
          updatedAt: AT,
        }),
      ).toThrow();
    }
    expect(templates.getDraft(draft.draftId).version).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS count FROM agent_profile_templates').get()).toEqual({
      count: 0,
    });
  });

  it('persists bounded literal variables without executing their values', () => {
    const { templates } = setup();
    const template = templates.saveRevision({
      ...seedInput('variable', 'Review {{area}}'),
      variables: [{ name: 'area', type: 'text', maxLength: 100, defaultValue: 'the change' }],
    });
    const draft = templates.createDraft({ templateRevisionId: template.revisionId, createdAt: AT });
    expect(templates.getDraft(draft.draftId).variableValues).toEqual({ area: 'the change' });
    expect(() =>
      templates.updateDraft({
        draftId: draft.draftId,
        expectedVersion: 1,
        fieldValues: MANIFEST,
        variableValues: { unknown: 'value' },
        currentStep: 'review',
        updatedAt: AT,
      }),
    ).toThrow();
    templates.updateDraft({
      draftId: draft.draftId,
      expectedVersion: 1,
      fieldValues: { ...MANIFEST, goal: 'Review {{area}}' },
      variableValues: { area: '$(echo data)' },
      currentStep: 'review',
      updatedAt: AT,
    });
    templates.completeDraft({ draftId: draft.draftId, expectedVersion: 2, completedAt: AT });
    expect(templates.getDraft(draft.draftId).fieldValues.goal).toBe('Review {{area}}');
    expect(templates.getDraft(draft.draftId).variableValues.area).toBe('$(echo data)');
  });

  it('rolls back revisions, current pointers and completion with the caller transaction', () => {
    const { db, templates } = setup();
    const template = templates.saveRevision(seedInput('local'));
    const draft = templates.createDraft({ templateRevisionId: template.revisionId, createdAt: AT });
    expect(() =>
      db.transaction(() => {
        templates.completeDraft({ draftId: draft.draftId, expectedVersion: 1, completedAt: AT });
        templates.saveRevision({
          ...seedInput('local', 'Changed'),
          templateId: template.templateId,
          expectedRevisionId: template.revisionId,
        });
        throw new Error('Injected failure');
      })(),
    ).toThrow('Injected failure');
    expect(templates.getDraft(draft.draftId).state).toBe('editing');
    expect(templates.getTemplate(template.templateId).currentRevisionId).toBe(template.revisionId);
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM agent_profile_template_revisions').get(),
    ).toEqual({ count: 1 });
  });
});
