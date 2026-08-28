import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

// CommonJS output on purpose: a sandboxed preload must be CJS, and keeping main
// and the session host on the same format avoids one more thing to reason about
// when the packaged app loads the native addon.
const cjs = { format: 'cjs' as const, entryFileNames: '[name].cjs' };

const root = resolve(__dirname, '../..');

// Workspace packages are bundled from TypeScript source (same aliases as
// vitest.config.ts) so a build never depends on a prior `tsc --build`.
const workspaceAliases = {
  '@threadhelm/contracts': resolve(root, 'packages/contracts/src/index.ts'),
  '@threadhelm/domain': resolve(root, 'packages/domain/src/index.ts'),
  '@threadhelm/persistence': resolve(root, 'packages/persistence/src/index.ts'),
  '@threadhelm/providers': resolve(root, 'packages/providers/src/index.ts'),
  '@threadhelm/test-fixtures': resolve(root, 'packages/test-fixtures/src/index.ts'),
};
const bundled = Object.keys(workspaceAliases);

// @threadhelm/test-fixtures resolves fake-agent.cjs next to its own module, so
// the bundled main process needs the script beside out/main/index.cjs.
const copyFixtureAgent = {
  name: 'threadhelm-copy-fixture-agent',
  closeBundle() {
    const outDir = resolve(__dirname, 'out/main');
    mkdirSync(outDir, { recursive: true });
    copyFileSync(
      resolve(root, 'packages/test-fixtures/src/fake-agent.cjs'),
      resolve(outDir, 'fake-agent.cjs'),
    );
  },
};
// Never bundle these: Electron is a runtime builtin, and the native addons load
// their .node binaries relative to their own package directory.
const external = [
  'electron',
  'node-pty',
  'better-sqlite3',
  '@threadhelm/windows-supervisor',
  /^node:/,
];

export default defineConfig({
  main: {
    // The native addons must NOT be bundled: a .node file rewritten into a
    // Rollup chunk loses its resolution path at runtime. Keep real dependencies
    // external and let Node load them from node_modules.
    plugins: [externalizeDepsPlugin({ exclude: bundled }), copyFixtureAgent],
    resolve: { alias: workspaceAliases },
    build: {
      rollupOptions: {
        external,
        // The session host is a separate entry: it is spawned as a utility
        // process, never imported by the coordinator.
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'session-host': resolve(__dirname, 'src/session-host/index.ts'),
        },
        output: cjs,
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: bundled })],
    resolve: { alias: workspaceAliases },
    build: {
      rollupOptions: {
        external,
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        output: cjs,
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    resolve: { alias: workspaceAliases },
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
    },
  },
});
