/** One flush owns all saves needed to acknowledge the latest draft snapshot. */
export function createDraftSaveQueue<T>(
  save: () => Promise<T | null>,
  isDirty: () => boolean,
): () => Promise<T | null> {
  let running: Promise<T | null> | null = null;
  return () => {
    if (running) return running;
    const drain = async () => {
      let result: T | null;
      do {
        result = await save();
        // Failure preserves edits and waits for an explicit later attempt.
        if (result === null) return null;
      } while (isDirty());
      return result;
    };
    const promise = drain();
    running = promise;
    const release = () => {
      if (running === promise) running = null;
    };
    void promise.then(release, release);
    return promise;
  };
}
