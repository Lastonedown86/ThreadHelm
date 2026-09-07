import { z } from 'zod';
import { Uuid } from './primitives.js';
import { isSafeAuthoredText } from './content-text.js';

/** Recipe text is context only. No profile, workspace or runtime types belong here. */
export const MISSION_RECIPE_JSON_BYTES = 1_048_576;
export const MISSION_RECIPE_EXPANDED_UNITS = 64_000;
const safe = (max: number) => z.string().max(max).refine(isSafeAuthoredText, 'UNSAFE_CONTENT');
const nonblank = (max: number) => safe(max).refine((v) => v.trim().length > 0, 'REQUIRED_VALUE');
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.iso.datetime();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const MissionRecipeVariable = z.strictObject({
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,39}$/)
    .refine((k) => !['constructor', 'prototype', '__proto__'].includes(k)),
  label: nonblank(120),
  required: z.boolean(),
});
const variables = z
  .array(MissionRecipeVariable)
  .max(20)
  .refine(
    (items) => new Set(items.map((item) => item.key)).size === items.length,
    'DUPLICATE_VARIABLE',
  );
export function recipeUtf8Bytes(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}
export const recipeJsonFits = (value: unknown): boolean =>
  recipeUtf8Bytes(JSON.stringify(value)) <= MISSION_RECIPE_JSON_BYTES;
const contentShape = {
  name: safe(120),
  description: safe(1000),
  outcomeScaffold: safe(8000),
  acceptanceChecklist: z.array(safe(1000)).max(30),
  suggestedRoles: z.array(safe(1000)).max(12),
  variables,
};
export const MissionRecipeEditorContent = z
  .strictObject(contentShape)
  .refine(recipeJsonFits, 'SERIALIZED_LIMIT');
export type MissionRecipeEditorContent = z.infer<typeof MissionRecipeEditorContent>;
/** Transient selected text may exceed authoring limits; never persist this shape. */
export const MissionRecipeSourceContent = z
  .strictObject({
    name: safe(120),
    description: safe(1000),
    outcomeScaffold: safe(64000),
    acceptanceChecklist: z.array(safe(64000)).max(2001),
    suggestedRoles: z.array(safe(64000)).max(12),
    variables,
  })
  .refine(recipeJsonFits, 'SERIALIZED_LIMIT');
export const MissionRecipeContent = z
  .strictObject({
    ...contentShape,
    name: nonblank(120),
    outcomeScaffold: nonblank(8000),
    acceptanceChecklist: z.array(nonblank(1000)).max(30),
    suggestedRoles: z.array(nonblank(1000)).max(12),
  })
  .refine(recipeJsonFits, 'SERIALIZED_LIMIT');
export type MissionRecipeContent = z.infer<typeof MissionRecipeContent>;
export const MissionRecipeValues = z
  .record(MissionRecipeVariable.shape.key, safe(2000))
  .refine((v) => Object.keys(v).length <= 20, 'FIELD_LIMIT');
export type MissionRecipeValues = z.infer<typeof MissionRecipeValues>;
export const MissionRecipeIssue = z.strictObject({
  code: z.enum([
    'INVALID_RECIPE',
    'UNSAFE_CONTENT',
    'REQUIRED_VALUE',
    'UNDECLARED_VARIABLE',
    'FIELD_LIMIT',
    'EXPANDED_LIMIT',
    'COMPOSER_LIMIT',
    'SERIALIZED_LIMIT',
  ]),
  path: z.string().max(160),
  limit: z.number().int().nonnegative().optional(),
  actual: z.number().int().nonnegative().optional(),
});
export type MissionRecipeIssue = z.infer<typeof MissionRecipeIssue>;
export const MissionRecipeReference = z.strictObject({ recipeId: Uuid, revisionId: Uuid, version });
export type MissionRecipeReference = z.infer<typeof MissionRecipeReference>;
export const MissionRecipeSummary = z.strictObject({
  ...MissionRecipeReference.shape,
  name: safe(120),
  description: safe(1000),
  origin: z.enum(['bundled', 'personal']),
  schemaVersion: version,
  availability: z.enum(['enabled', 'disabled', 'unsupported']),
  ordinal: version,
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type MissionRecipeSummary = z.infer<typeof MissionRecipeSummary>;
export const MissionRecipeDetail = z.strictObject({
  ...MissionRecipeSummary.shape,
  content: MissionRecipeContent.nullable(),
  copiedFrom: MissionRecipeReference.nullable().optional(),
  digest,
});
export type MissionRecipeDetail = z.infer<typeof MissionRecipeDetail>;
export const MissionRecipeExpanded = z
  .strictObject({
    outcome: safe(64000),
    acceptanceChecklist: z.array(safe(64000)).max(30),
    suggestedRoles: z.array(safe(64000)).max(12),
  })
  .refine(
    (v) =>
      v.outcome.length +
        v.acceptanceChecklist.join('\n').length +
        v.suggestedRoles.join('').length <=
      64000,
    'EXPANDED_LIMIT',
  );
export type MissionRecipeExpanded = z.infer<typeof MissionRecipeExpanded>;
export const MissionRecipeProjection = z.strictObject({
  objective: safe(4000).refine((v) => recipeUtf8Bytes(v) <= 4000, 'COMPOSER_LIMIT'),
  completionEvidence: safe(2000).refine((v) => recipeUtf8Bytes(v) <= 2000, 'COMPOSER_LIMIT'),
});
export const MissionRecipePreview = z.strictObject({
  ...MissionRecipeReference.shape,
  previewId: Uuid.nullable(),
  expanded: MissionRecipeExpanded.nullable(),
  projection: MissionRecipeProjection.nullable(),
  issues: z.array(MissionRecipeIssue).max(128),
});
export type MissionRecipePreview = z.infer<typeof MissionRecipePreview>;
export const MissionRecipeSource = z.strictObject({
  kind: z.enum(['draft', 'mission']),
  id: Uuid,
  version,
});
export const MissionRecipeEditor = z
  .strictObject({
    editorId: Uuid,
    version,
    mode: z.enum(['create', 'edit', 'duplicate', 'save-source']),
    base: MissionRecipeReference.nullable(),
    source: MissionRecipeSource.nullable(),
    content: MissionRecipeEditorContent,
    updatedAt: timestamp,
  })
  .refine(recipeJsonFits, 'SERIALIZED_LIMIT');
export type MissionRecipeEditor = z.infer<typeof MissionRecipeEditor>;
export const MissionDraftRecipeContext = z
  .strictObject({
    recipeId: Uuid,
    revisionId: Uuid,
    name: safe(120),
    origin: z.enum(['bundled', 'personal']),
    appliedAt: timestamp,
    digest,
    expanded: MissionRecipeExpanded,
    suggestedRoles: z.array(safe(64000)).max(12),
  })
  .refine((v) => v.suggestedRoles.join('').length <= 64000, 'EXPANDED_LIMIT')
  .refine(recipeJsonFits, 'SERIALIZED_LIMIT');
export type MissionDraftRecipeContext = z.infer<typeof MissionDraftRecipeContext>;
export const MissionRecipeReceipt = z.strictObject({
  requestId: Uuid,
  kind: z.enum(['save', 'createDraft', 'setEnabled', 'delete']),
  targetId: Uuid,
  version,
  savedAt: timestamp,
});
export type MissionRecipeReceipt = z.infer<typeof MissionRecipeReceipt>;

export const missionRecipeOperations = {
  'missionRecipes.previewSource': {
    request: z.strictObject({
      source: MissionRecipeSource,
      fields: z
        .array(z.enum(['objective', 'completionEvidence', 'suggestedRoles']))
        .min(1)
        .max(3)
        .refine((v) => new Set(v).size === v.length),
    }),
    response: z.strictObject({ previewId: Uuid, content: MissionRecipeSourceContent }),
  },
  'missionRecipes.openEditor': {
    request: z
      .strictObject({
        sourcePreviewId: Uuid.optional(),
        content: MissionRecipeEditorContent.optional(),
      })
      .optional(),
    response: MissionRecipeEditor,
  },
  'missionRecipes.getEditor': {
    request: z.strictObject({ editorId: Uuid }),
    response: MissionRecipeEditor,
  },
  'missionRecipes.listEditors': {
    request: z.strictObject({ cursor: Uuid.nullable().optional() }).optional(),
    response: z.strictObject({
      items: z
        .array(z.strictObject({ editorId: Uuid, version, name: safe(120), updatedAt: timestamp }))
        .max(50),
      nextCursor: Uuid.nullable(),
    }),
  },
  'missionRecipes.saveEditor': {
    request: z.strictObject({
      editorId: Uuid,
      expectedVersion: version,
      content: MissionRecipeEditorContent,
    }),
    response: MissionRecipeEditor,
  },
  'missionRecipes.detachSource': {
    request: z.strictObject({ editorId: Uuid, expectedVersion: version }),
    response: MissionRecipeEditor,
  },
  'missionRecipes.discardEditor': {
    request: z.strictObject({ editorId: Uuid, expectedVersion: version }),
    response: z.strictObject({ discarded: z.literal(true) }),
  },
  'missionRecipes.previewSave': {
    request: z.strictObject({ editorId: Uuid, expectedVersion: version }),
    response: z.strictObject({ previewId: Uuid, content: MissionRecipeContent }),
  },
  'missionRecipes.save': {
    request: z.strictObject({ previewId: Uuid, requestId: Uuid }),
    response: MissionRecipeReceipt,
  },
  'missionRecipes.edit': {
    request: z.strictObject({ recipeId: Uuid, revisionId: Uuid, expectedVersion: version }),
    response: MissionRecipeEditor,
  },
  'missionRecipes.duplicate': {
    request: z.strictObject({ recipeId: Uuid, revisionId: Uuid, expectedVersion: version }),
    response: MissionRecipeEditor,
  },
  'missionRecipes.setEnabled': {
    request: z.strictObject({
      recipeId: Uuid,
      expectedVersion: version,
      enabled: z.boolean(),
      requestId: Uuid,
    }),
    response: MissionRecipeReceipt,
  },
  'missionRecipes.previewDelete': {
    request: z.strictObject({ recipeId: Uuid, expectedVersion: version }),
    response: z.strictObject({ previewId: Uuid, recipeId: Uuid, version, name: safe(120) }),
  },
  'missionRecipes.delete': {
    request: z.strictObject({ previewId: Uuid, requestId: Uuid }),
    response: MissionRecipeReceipt,
  },

  'missionRecipes.list': {
    request: z
      .strictObject({
        cursor: Uuid.nullable().optional(),
        origin: z.enum(['bundled', 'personal']).optional(),
        availability: z.enum(['enabled', 'disabled', 'unsupported']).optional(),
      })
      .optional(),
    response: z.strictObject({
      items: z.array(MissionRecipeSummary).max(50),
      nextCursor: Uuid.nullable(),
    }),
  },
  'missionRecipes.get': {
    request: z.strictObject({ recipeId: Uuid }),
    response: MissionRecipeDetail,
  },
  'missionRecipes.preview': {
    request: z.strictObject({
      recipeId: Uuid,
      revisionId: Uuid,
      expectedVersion: version,
      values: MissionRecipeValues,
    }),
    response: MissionRecipePreview,
  },
  'missionRecipes.createDraft': {
    request: z.strictObject({ previewId: Uuid, requestId: Uuid }),
    response: MissionRecipeReceipt,
  },
} as const;
