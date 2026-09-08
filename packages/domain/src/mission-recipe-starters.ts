import { MissionRecipeContent } from '@threadhelm/contracts';

/** Production content only. Never import the fixture/persona barrel here. */
export const MISSION_RECIPE_STARTERS = [
  {
    recipeId: '00600000-0000-4000-8000-000000000001',
    revisionId: '00610000-0000-4000-8000-000000000001',
    content: MissionRecipeContent.parse({
      name: 'Investigate a bug',
      description: 'Establish a reproducible explanation and proposed correction',
      outcomeScaffold:
        'Investigate {{symptom}}. Establish reproduction steps, the likely cause and a proposed correction. Additional context: {{context}}',
      acceptanceChecklist: [
        'Record reproduction steps and expected versus observed behavior.',
        'Explain the likely cause with supporting observations.',
        'Describe a correction and focused validation, including unresolved uncertainty.',
      ],
      suggestedRoles: [
        'Investigator: analyze reproduction and cause.',
        'Reviewer: challenge the explanation and proposed validation.',
      ],
      variables: [
        { key: 'symptom', label: 'Symptom', required: true },
        { key: 'context', label: 'Context', required: false },
      ],
    }),
  },
  {
    recipeId: '00600000-0000-4000-8000-000000000002',
    revisionId: '00610000-0000-4000-8000-000000000002',
    content: MissionRecipeContent.parse({
      name: 'Review a PR',
      description: 'Assess a supplied change reference and report findings',
      outcomeScaffold:
        'Review {{pr_reference}} for correctness, regressions and missing validation. Review focus: {{review_focus}}',
      acceptanceChecklist: [
        'State the reviewed scope and any unavailable material.',
        'Report actionable findings with supporting references, or explain that none were found.',
        'Identify validation performed and remaining uncertainty.',
      ],
      suggestedRoles: [
        'Reviewer: inspect correctness and regression risks.',
        'Validation reviewer: assess coverage and evidence gaps.',
      ],
      variables: [
        { key: 'pr_reference', label: 'PR reference (literal text)', required: true },
        { key: 'review_focus', label: 'Review focus', required: false },
      ],
    }),
  },
  {
    recipeId: '00600000-0000-4000-8000-000000000003',
    revisionId: '00610000-0000-4000-8000-000000000003',
    content: MissionRecipeContent.parse({
      name: 'Prepare a release',
      description: 'Assess readiness and describe remaining release work',
      outcomeScaffold:
        'Prepare a readiness assessment for {{release_name}}. Scope: {{release_scope}}. Identify remaining checks and proposed release steps for human review.',
      acceptanceChecklist: [
        'Summarize included changes and known limitations.',
        'Record validation evidence and unresolved release blockers.',
        'Describe proposed release and rollback steps requiring later authorization.',
      ],
      suggestedRoles: [
        'Release reviewer: assess readiness and blockers.',
        'Validation reviewer: check evidence and rollback preparation.',
      ],
      variables: [
        { key: 'release_name', label: 'Release name', required: true },
        { key: 'release_scope', label: 'Release scope', required: false },
      ],
    }),
  },
] as const;
