import { describe, expect, it } from 'vitest';
import * as contracts from '@threadhelm/contracts';

const content = {
  name: 'Investigation',
  description: '',
  outcomeScaffold: 'Investigate {{symptom}}',
  acceptanceChecklist: ['Report findings'],
  suggestedRoles: ['Investigator'],
  variables: [{ key: 'symptom', label: 'Symptom', required: true }],
};

describe('mission recipe content contracts', () => {
  it('exports independent strict recipe schemas', () => {
    expect(contracts).toHaveProperty('MissionRecipeContent');
  });
  it('accepts literal commands but rejects authority, credentials and controls', () => {
    const schema = contracts.MissionRecipeContent;
    expect(
      schema.parse({ ...content, outcomeScaffold: 'Discuss echo hello and https://example.com' }),
    ).toBeTruthy();
    for (const key of ['providerId', 'model', 'permissions', 'workers', 'workspaceId', 'launch']) {
      expect(schema.safeParse({ ...content, [key]: 'forbidden' }).success).toBe(false);
    }
    for (const value of ['password=abcdefghijk', '\u0000', '\ud800']) {
      expect(schema.safeParse({ ...content, description: value }).success).toBe(false);
    }
  });
  it.each([
    ['name', 120],
    ['description', 1000],
    ['outcomeScaffold', 8000],
  ] as const)('bounds %s without truncation', (field, max) => {
    expect(
      contracts.MissionRecipeContent.safeParse({ ...content, [field]: 'a'.repeat(max) }).success,
    ).toBe(true);
    expect(
      contracts.MissionRecipeContent.safeParse({ ...content, [field]: 'a'.repeat(max + 1) })
        .success,
    ).toBe(false);
  });
  it.each([
    ['acceptanceChecklist', 30],
    ['suggestedRoles', 12],
  ] as const)('bounds %s entries and count', (field, max) => {
    expect(
      contracts.MissionRecipeContent.safeParse({
        ...content,
        [field]: Array(max).fill('a'.repeat(1000)),
      }).success,
    ).toBe(true);
    expect(
      contracts.MissionRecipeContent.safeParse({ ...content, [field]: Array(max + 1).fill('a') })
        .success,
    ).toBe(false);
    expect(
      contracts.MissionRecipeContent.safeParse({ ...content, [field]: ['a'.repeat(1001)] }).success,
    ).toBe(false);
  });
  it('bounds unique variable declarations and literal values separately', () => {
    const variables = Array.from({ length: 20 }, (_, i) => ({
      key: `v${i}`,
      label: 'Value',
      required: false,
    }));
    expect(contracts.MissionRecipeContent.safeParse({ ...content, variables }).success).toBe(true);
    expect(
      contracts.MissionRecipeContent.safeParse({
        ...content,
        variables: [...variables, variables[0]],
      }).success,
    ).toBe(false);
    expect(
      contracts.MissionRecipeContent.safeParse({
        ...content,
        variables: [variables[0], variables[0]],
      }).success,
    ).toBe(false);
    expect(contracts.MissionRecipeValues.safeParse({ v0: 'a'.repeat(2000) }).success).toBe(true);
    expect(contracts.MissionRecipeValues.safeParse({ v0: 'a'.repeat(2001) }).success).toBe(false);
    expect(
      contracts.MissionRecipeContent.safeParse({
        ...content,
        variables: [{ key: 'v', label: 'x'.repeat(121), required: true }],
      }).success,
    ).toBe(false);
  });
  it('permits incomplete safe editor content without publishing a recipe', () => {
    const empty = {
      name: '',
      description: '',
      outcomeScaffold: '',
      acceptanceChecklist: [],
      suggestedRoles: [],
      variables: [],
    };
    expect(contracts.MissionRecipeEditorContent.safeParse(empty).success).toBe(true);
    expect(contracts.MissionRecipeContent.safeParse(empty).success).toBe(false);
    expect(
      contracts.MissionRecipeEditorContent.safeParse({ ...empty, name: 'password=abcdefghijk' })
        .success,
    ).toBe(false);
  });
  it('measures serialized UTF-8 limits rather than character counts', () => {
    expect(contracts.recipeJsonFits('x'.repeat(1_048_574))).toBe(true);
    expect(contracts.recipeJsonFits('x'.repeat(1_048_575))).toBe(false);
    expect(contracts.recipeJsonFits('漢'.repeat(400_000))).toBe(false);
  });
  it('accepts unsupported metadata without pretending its content is readable', () => {
    const summary = {
      recipeId: '11111111-1111-4111-8111-111111111111',
      revisionId: '22222222-2222-4222-8222-222222222222',
      version: 1,
      ordinal: 1,
      schemaVersion: 99,
      name: 'Future recipe',
      description: '',
      origin: 'personal',
      availability: 'unsupported',
      createdAt: '2026-09-07T12:00:00.000Z',
      updatedAt: '2026-09-07T12:00:00.000Z',
    };
    expect(contracts.MissionRecipeSummary.safeParse(summary).success).toBe(true);
    expect(
      contracts.MissionRecipeSummary.safeParse({ ...summary, content: 'untrusted future format' })
        .success,
    ).toBe(false);
  });
});
