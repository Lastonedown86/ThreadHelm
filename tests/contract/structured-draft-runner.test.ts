import { describe, expect, it } from 'vitest';
import { runStructuredDraft } from '../../apps/desktop/src/main/providers/structured-draft.js';
import { createWorld } from './helpers/fake-context.js';

describe('structured-draft runner', () => {
  it('returns the adapter-parsed text on success', async () => {
    const world = createWorld();
    // Same override pattern already used for world.ctx.probes: tests assign
    // the field directly rather than going through a global test-hook.
    world.ctx.structuredDraft = {
      run: async (providerId) =>
        providerId === 'codex-cli'
          ? { text: '{"ideas":["a","b","c"]}' }
          : { held: true, reasonCode: 'STRUCTURED_DRAFT_UNSUPPORTED' },
    };
    const result = await runStructuredDraft(world.ctx, 'codex-cli', 'List three ideas.');
    expect(result).toEqual({ text: '{"ideas":["a","b","c"]}' });
  });

  it('reports held by default (fake context ships no structured-draft support)', async () => {
    const world = createWorld();
    const result = await runStructuredDraft(world.ctx, 'claude-code', 'List three ideas.');
    expect(result).toMatchObject({ held: true });
  });

  it('turns a throwing runner into a typed STRUCTURED_DRAFT_UNAVAILABLE error', async () => {
    const world = createWorld();
    world.ctx.structuredDraft = {
      run: async () => {
        throw new Error('spawn failed');
      },
    };
    await expect(runStructuredDraft(world.ctx, 'codex-cli', 'x')).rejects.toMatchObject({
      code: 'STRUCTURED_DRAFT_UNAVAILABLE',
    });
  });
});
