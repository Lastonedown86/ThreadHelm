import { resolve } from 'node:path';
import { build } from 'vite';
import { expect, it } from 'vitest';

it('keeps renderer stream, buffer and error helpers independent of the full application schemas', async () => {
  const root = resolve(import.meta.dirname, '../..');
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: {
        '@threadhelm/contracts/limits': resolve(root, 'packages/contracts/src/limits.ts'),
        '@threadhelm/contracts/stream': resolve(root, 'packages/contracts/src/stream.ts'),
        '@threadhelm/contracts': resolve(root, 'packages/contracts/src/index.ts'),
      },
    },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: [
          resolve(root, 'apps/desktop/src/renderer/features/session/stream.ts'),
          resolve(root, 'apps/desktop/src/renderer/features/session/buffer.ts'),
          resolve(root, 'apps/desktop/src/renderer/features/launch/LaunchErrors.tsx'),
        ],
        external: ['react', 'react/jsx-runtime'],
      },
    },
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  if (!bundle || !('output' in bundle)) throw new Error('Expected built renderer helpers');
  const modules = bundle.output.flatMap((entry) =>
    entry.type === 'chunk' ? Object.keys(entry.modules) : [],
  );
  expect(
    modules.filter((id) => /[/\\]contracts[/\\]src[/\\](?:index|content-text)\./.test(id)),
  ).toEqual([]);
}, 20_000);
