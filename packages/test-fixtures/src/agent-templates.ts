/** Generic, local-only starter templates for the US7 wizard. */

export interface AgentTemplateFixture {
  readonly key: string;
  readonly version: 1;
  readonly manifest: {
    readonly spec: 'munder-difflin/hire@1';
    readonly name: string;
    readonly description: string;
    readonly provider: 'codex';
    readonly model: 'gpt-5.6-terra';
    readonly goal: string;
    readonly capabilities: readonly string[];
    readonly isolate: boolean;
    readonly tokenCap: number;
    readonly author: 'ThreadHelm';
  };
}

function fixture(
  key: string,
  description: string,
  goal: string,
  capability: string,
): AgentTemplateFixture {
  return {
    key,
    version: 1,
    manifest: {
      spec: 'munder-difflin/hire@1',
      name: `${key} specialist`,
      description,
      provider: 'codex',
      model: 'gpt-5.6-terra',
      goal,
      capabilities: [capability],
      isolate: true,
      tokenCap: 250_000,
      author: 'ThreadHelm',
    },
  };
}

export const GENERIC_AGENT_TEMPLATE_FIXTURES: readonly AgentTemplateFixture[] = [
  fixture(
    'investigator',
    'Investigates a bounded question.',
    'Return cited findings.',
    'investigation',
  ),
  fixture(
    'implementer',
    'Implements a bounded approved change.',
    'Produce a focused change.',
    'implementation',
  ),
  fixture(
    'reviewer',
    'Reviews a proposed change.',
    'Report actionable review findings.',
    'code_review',
  ),
  fixture(
    'quality',
    'Checks deterministic quality gates.',
    'Run and report focused checks.',
    'quality_review',
  ),
  fixture(
    'documentation',
    'Improves a bounded documentation surface.',
    'Produce concise documentation.',
    'documentation',
  ),
  fixture(
    'release-gate',
    'Assesses declared release evidence.',
    'Report gate evidence and gaps.',
    'release_review',
  ),
];
