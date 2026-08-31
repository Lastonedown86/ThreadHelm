import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
await build({
  configFile: false,
  root: resolve(here, 'frontend'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@threadhelm/contracts/limits': resolve(root, 'packages/contracts/src/limits.ts'),
      '@threadhelm/contracts/stream': resolve(root, 'packages/contracts/src/stream.ts'),
      '@threadhelm/contracts/protocol': resolve(root, 'packages/contracts/src/protocol.ts'),
      '@threadhelm/contracts': resolve(root, 'packages/contracts/src/index.ts'),
      '@threadhelm/domain': resolve(root, 'packages/domain/src/index.ts'),
    },
  },
  build: {
    outDir: resolve(here, 'ui'),
    emptyOutDir: false,
    rollupOptions: { input: resolve(here, 'frontend/workspace.html') },
  },
});
