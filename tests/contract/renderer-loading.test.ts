import { resolve } from 'node:path';
import { build } from 'vite';
import { expect, it } from 'vitest';

it('keeps xterm and authoring validation outside the no-session renderer import graph', async () => {
  const root = resolve(import.meta.dirname, '../..');
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: {
        '@threadhelm/contracts/protocol': resolve(root, 'packages/contracts/src/protocol.ts'),
        '@threadhelm/contracts/limits': resolve(root, 'packages/contracts/src/limits.ts'),
        '@threadhelm/contracts/stream': resolve(root, 'packages/contracts/src/stream.ts'),
        '@threadhelm/contracts': resolve(root, 'packages/contracts/src/index.ts'),
      },
    },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: resolve(import.meta.dirname, '../../apps/desktop/src/renderer/main.tsx'),
        output: { format: 'es' },
      },
    },
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  if (!bundle || !('output' in bundle)) throw new Error('Expected an in-memory renderer bundle');
  const chunks = bundle.output.filter((item) => item.type === 'chunk');
  const entry = chunks.find((chunk) => chunk.isEntry);
  if (!entry) throw new Error('Missing renderer entry');
  const initial = new Set<string>();
  const visit = (fileName: string) => {
    if (initial.has(fileName)) return;
    initial.add(fileName);
    chunks.find((chunk) => chunk.fileName === fileName)?.imports.forEach(visit);
  };
  visit(entry.fileName);
  const eagerModules = chunks
    .filter((chunk) => initial.has(chunk.fileName))
    .flatMap((chunk) => Object.keys(chunk.modules));
  expect(
    eagerModules.filter((id) =>
      /[/\\]@xterm[/\\].*\.[cm]?js$|[/\\]AgentProfileWizard\.tsx$|[/\\]contracts[/\\]src[/\\]index\.ts$|[/\\]zod[/\\]/.test(
        id,
      ),
    ),
  ).toEqual([]);
  // The test must inspect a complete split build, not hide dependencies as externals.
  const deferredModules = chunks
    .filter((chunk) => !initial.has(chunk.fileName))
    .flatMap((chunk) => Object.keys(chunk.modules));
  expect(deferredModules.some((id) => /[/\\]@xterm[/\\]/.test(id))).toBe(true);
  expect(deferredModules.some((id) => /[/\\]AgentProfileWizard\.tsx$/.test(id))).toBe(true);
}, 30_000);
