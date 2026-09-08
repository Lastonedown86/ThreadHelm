import { useEffect, useState, type ComponentProps } from 'react';
import type { RecipeEditor } from './RecipeEditor.js';

/** Browsing recipes does not allocate authoring schemas. */
export function LazyRecipeEditor(props: ComponentProps<typeof RecipeEditor>) {
  const [Editor, setEditor] = useState<typeof RecipeEditor | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void import('./RecipeEditor.js').then(
      (module) => {
        if (!cancelled) setEditor(() => module.RecipeEditor);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  if (Editor) return <Editor {...props} />;
  return (
    <section aria-label="Personal recipe editor loading">
      <p role="status">
        {failed
          ? 'The recipe editor could not load. Its saved buffer is available to resume.'
          : 'Loading personal recipe editor…'}
      </p>
      {failed ? (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry loading editor
        </button>
      ) : null}
      <button type="button" onClick={props.onClose}>
        Back to recipes
      </button>
    </section>
  );
}
