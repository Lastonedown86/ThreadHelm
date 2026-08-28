import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Workspace packages resolve to TypeScript source so tests never depend on a
// prior `tsc --build`. electron.vite.config.ts uses the same aliases.
export const workspaceAliases = {
  '@threadhelm/contracts': resolve(import.meta.dirname, 'packages/contracts/src/index.ts'),
  '@threadhelm/domain': resolve(import.meta.dirname, 'packages/domain/src/index.ts'),
  '@threadhelm/persistence': resolve(import.meta.dirname, 'packages/persistence/src/index.ts'),
  '@threadhelm/providers': resolve(import.meta.dirname, 'packages/providers/src/index.ts'),
  '@threadhelm/test-fixtures': resolve(import.meta.dirname, 'packages/test-fixtures/src/index.ts'),
};

const project = (name: string, include: string[], extra: Record<string, unknown> = {}) => ({
  extends: true as const,
  test: { name, include, ...extra },
});

export default defineConfig({
  resolve: { alias: workspaceAliases },
  test: {
    // Vitest 4 dropped vitest.workspace.ts; projects live here instead (T006).
    projects: [
      project('unit', ['tests/unit/**/*.test.ts']),
      project('contract', ['tests/contract/**/*.test.ts']),
      project('integration', ['tests/integration/**/*.test.ts'], {
        testTimeout: 60_000,
        hookTimeout: 60_000,
        // Real processes and Job Objects: never interleave two integration files.
        fileParallelism: false,
      }),
      project('acceptance', ['tests/acceptance/**/*.test.ts'], {
        testTimeout: 300_000,
        hookTimeout: 300_000,
        fileParallelism: false,
      }),
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/desktop/src/main/**/*.ts'],
      exclude: ['**/*.d.ts', 'packages/test-fixtures/**'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
