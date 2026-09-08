import { useEffect, useState, type ComponentProps } from 'react';
import type { MissionRecipeLibrary } from './MissionRecipeLibrary.js';

/** Keep recipe authoring and validation out of the initial renderer graph. */
export function LazyMissionRecipeLibrary(props: ComponentProps<typeof MissionRecipeLibrary>) {
  const [Library, setLibrary] = useState<typeof MissionRecipeLibrary | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void import('./MissionRecipeLibrary.js').then(
      (module) => {
        if (!cancelled) setLibrary(() => module.MissionRecipeLibrary);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  if (Library) return <Library {...props} />;
  return (
    <section className="composer recipe-workspace" aria-label="Mission recipes loading">
      <h1>Mission recipes</h1>
      <p role="status">
        {failed ? 'Recipes could not load. Retry or close this view.' : 'Loading mission recipes…'}
      </p>
      {failed ? (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry loading recipes
        </button>
      ) : null}
      <button type="button" onClick={props.onClose}>
        Close recipes
      </button>
    </section>
  );
}
