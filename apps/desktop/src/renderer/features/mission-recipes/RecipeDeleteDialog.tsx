import { useEffect, useRef, useState } from 'react';
import type { MissionRecipeDetail } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { ModalDialog } from '../coordination/ModalDialog.js';
import { recipeError } from './RecipePreview.js';

export function RecipeDeleteDialog({
  recipe,
  onClose,
  onDeleted,
}: {
  recipe: MissionRecipeDetail;
  onClose(): void;
  onDeleted(): void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const request = useRef<{ previewId: string; requestId: string } | null>(null);
  const prepare = async () => {
    setError('');
    setPreviewId(null);
    request.current = null;
    try {
      const preview = await call(
        api.missionRecipes.previewDelete({
          recipeId: recipe.recipeId,
          expectedVersion: recipe.version,
        }),
      );
      setPreviewId(preview.previewId);
    } catch (cause) {
      setError(recipeError(cause));
    }
  };
  useEffect(() => {
    void prepare();
  }, []);
  return (
    <ModalDialog
      label="Delete personal recipe"
      onDismiss={() => {
        if (!pending.current) onClose();
      }}
    >
      <h2>Delete {recipe.name}?</h2>
      <p>
        {recipe.recipeId} · revision {recipe.ordinal}
      </p>
      <p>
        Recipe content and its authoring buffers will be removed. Existing draft copies and their
        captured provenance remain.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" disabled={busy} onClick={onClose}>
        Cancel
      </button>
      {error ? (
        <button type="button" disabled={busy} onClick={() => void prepare()}>
          Review deletion again
        </button>
      ) : null}
      <button
        type="button"
        className="danger"
        disabled={busy || !previewId}
        onClick={() => {
          if (!previewId || pending.current) return;
          pending.current = true;
          setBusy(true);
          request.current ??= { previewId, requestId: crypto.randomUUID() };
          void call(api.missionRecipes.delete(request.current))
            .then(onDeleted)
            .catch((cause) => {
              setError(recipeError(cause));
              setPreviewId(null);
            })
            .finally(() => {
              pending.current = false;
              setBusy(false);
            });
        }}
      >
        Delete recipe
      </button>
    </ModalDialog>
  );
}
