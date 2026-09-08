import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MissionRecipeEditorContent, type MissionRecipeEditor } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { createDraftSaveQueue } from '../mission-composer/draft-save-queue.js';
import { recipeError } from './RecipePreview.js';

/** Reuses the composer drain: only acknowledged safe snapshots are recoverable. */
export function useRecipeEditor(initial: MissionRecipeEditor) {
  const [content, setContent] = useState(initial.content);
  const [editor, setEditor] = useState(initial);
  const [status, setStatus] = useState('Saved locally');
  const [error, setError] = useState('');
  const latest = useRef(initial.content);
  const acknowledged = useRef(initial);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => stopTimer(), []);
  const perform = useCallback(async () => {
    const snapshot = latest.current;
    const parsed = MissionRecipeEditorContent.safeParse(snapshot);
    if (!parsed.success) {
      setStatus('Not saved');
      setError(
        'These edits exceed a limit or contain invalid text. They remain on screen; only the last safe save is recoverable.',
      );
      return null;
    }
    setStatus('Saving locally');
    try {
      const saved = await call(
        api.missionRecipes.saveEditor({
          editorId: initial.editorId,
          expectedVersion: acknowledged.current.version,
          content: parsed.data,
        }),
      );
      acknowledged.current = saved;
      dirty.current = latest.current !== snapshot;
      setEditor(saved);
      setError('');
      setStatus(dirty.current ? 'Saving locally' : 'Saved locally');
      return saved;
    } catch (cause) {
      stopTimer();
      setStatus('Save failed');
      setError(recipeError(cause));
      return null;
    }
  }, [initial.editorId]);
  const drain = useMemo(() => createDraftSaveQueue(perform, () => dirty.current), [perform]);
  const flush = useCallback(async () => {
    stopTimer();
    return dirty.current ? drain() : acknowledged.current;
  }, [drain]);
  const update = (next: MissionRecipeEditorContent) => {
    latest.current = next;
    dirty.current = true;
    setContent(next);
    setStatus('Unsaved changes');
    stopTimer();
    timer.current = setTimeout(() => void flush(), 800);
  };
  const replace = (next: MissionRecipeEditor) => {
    stopTimer();
    acknowledged.current = next;
    latest.current = next.content;
    dirty.current = false;
    setEditor(next);
    setContent(next.content);
    setStatus('Saved locally');
    setError('');
  };
  return {
    content,
    editor,
    status,
    error,
    update,
    flush,
    replace,
    version: () => acknowledged.current.version,
  };
}
