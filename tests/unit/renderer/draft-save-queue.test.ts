import { describe, expect, it, vi } from 'vitest';
import { createDraftSaveQueue } from '../../../apps/desktop/src/renderer/features/mission-composer/draft-save-queue.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('draft flush ordering', () => {
  it('waits for newer edits and shares one drain across simultaneous exits', async () => {
    let dirty = true;
    const first = deferred<number | null>();
    const second = deferred<number | null>();
    const save = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const flush = createDraftSaveQueue<number>(save, () => dirty);
    const a = flush();
    const b = flush();
    let navigated = false;
    void a.then(() => {
      navigated = true;
    });
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve(1);
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(navigated).toBe(false);
    dirty = false;
    second.resolve(2);
    expect(await a).toBe(2);
    expect(await b).toBe(2);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('stops on failure without retrying and allows a later explicit retry', async () => {
    let dirty = true;
    const save = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => {
        dirty = false;
        return 2;
      });
    const flush = createDraftSaveQueue<number>(save, () => dirty);
    expect(await flush()).toBeNull();
    expect(save).toHaveBeenCalledTimes(1);
    expect(dirty).toBe(true);
    expect(await flush()).toBe(2);
  });

  it('releases the queue after an unexpected rejection', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(3);
    const flush = createDraftSaveQueue<number>(save, () => false);
    await expect(flush()).rejects.toThrow('offline');
    expect(await flush()).toBe(3);
  });
});
