/** Deterministic recon proposal set (Workspace Recon). Names are placeholders by design. */

function manifest(fields: Record<string, unknown>): string {
  return `${JSON.stringify(fields, null, 2)}\n`;
}

const COMMON = {
  spec: 'threadhelm/agent-profile@1',
  provider: 'claude-code',
  model: 'claude-sonnet-5',
  isolate: false,
  tokenCap: 200_000,
  author: 'ThreadHelm recon fixture',
} as const;

export const RECON_PROPOSAL_FIXTURES: readonly { basename: string; text: string }[] = [
  {
    basename: 'supervisor.agent.json',
    text: manifest({
      ...COMMON,
      name: 'Unnamed supervisor',
      description: 'Owns the outcome and delegates bounded work.',
      goal: 'Decompose one outcome into bounded assignments and verify each result before reporting done.',
      capabilities: ['delegation', 'verification'],
    }),
  },
  {
    basename: 'native-addon.agent.json',
    text: manifest({
      ...COMMON,
      name: 'Unnamed specialist',
      description: 'Rust Node-API addon work.',
      goal: 'Change the Rust supervisor addon and keep cargo fmt, check and test green.',
      capabilities: ['rust', 'node-api'],
    }),
  },
  {
    basename: 'renderer.agent.json',
    text: manifest({
      ...COMMON,
      name: 'Unnamed specialist',
      description: 'React renderer and accessibility.',
      goal: 'Change renderer features and keep keyboard access and visible focus intact.',
      capabilities: ['react', 'accessibility'],
    }),
  },
  {
    basename: 'testing.agent.json',
    text: manifest({
      ...COMMON,
      name: 'Unnamed specialist',
      description: 'Vitest and Playwright Electron suites.',
      goal: 'Write failing tests first and keep the unit, contract and e2e projects green.',
      capabilities: ['vitest', 'playwright'],
    }),
  },
  { basename: 'malformed.agent.json', text: '{ "spec": "threadhelm/agent-profile@1", ' },
];
